"""
pages/train.py — Configure & Train Models page
Use case: Machine Learning Model Training + Configure Model Parameters
"""
import streamlit as st
import pandas as pd
import numpy as np
import os, sys, joblib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.auth import require_access
from sklearn.ensemble import RandomForestRegressor
from sklearn.svm import SVR
from sklearn.impute import SimpleImputer
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

BASE_DIR      = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR    = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

def evaluate(y_true, y_pred):
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)
    return {"MAE": round(mae,3), "RMSE": round(rmse,3), "R2": round(r2,4)}

def show():
    require_access("Configure & Train")
    st.title("⚙️ Configure & Train Models")
    st.caption("Adjust model parameters and retrain Random Forest and SVR on the current dataset.")

    # check data exists
    x_train_path = os.path.join(PROCESSED_DIR, "X_train.csv")
    if not os.path.exists(x_train_path):
        st.warning("Preprocessed data not found. Run `python src/preprocess.py` first or upload a dataset.")
        return

    st.subheader("🌲 Random Forest Parameters")
    c1,c2,c3 = st.columns(3)
    with c1: n_estimators  = st.slider("Number of Trees",     50, 500, 200, 50)
    with c2: max_depth     = st.slider("Max Depth",            3,  20,  12,  1)
    with c3: min_samples   = st.slider("Min Samples per Leaf", 1,  20,   4,  1)

    st.subheader("📈 SVR Parameters")
    c4,c5,c6 = st.columns(3)
    with c4: C       = st.select_slider("C (Regularisation)", [0.1,1,10,50,100,200,500], value=100)
    with c5: epsilon = st.select_slider("Epsilon",            [0.1,0.3,0.5,1.0,2.0],    value=0.5)
    with c6: kernel  = st.selectbox("Kernel", ["rbf","linear","poly"], index=0)

    st.divider()

    if st.button("🚀 Train Models with These Parameters", type="primary"):
        with st.spinner("Loading data..."):
            X_train = pd.read_csv(os.path.join(PROCESSED_DIR, "X_train.csv"))
            X_test  = pd.read_csv(os.path.join(PROCESSED_DIR, "X_test.csv"))
            y_train = pd.read_csv(os.path.join(PROCESSED_DIR, "y_train.csv")).squeeze()
            y_test  = pd.read_csv(os.path.join(PROCESSED_DIR, "y_test.csv")).squeeze()
            feature_cols = list(X_train.columns)

        with st.spinner("Imputing missing values..."):
            imputer = SimpleImputer(strategy="median")
            X_train_imp = imputer.fit_transform(X_train)
            X_test_imp  = imputer.transform(X_test)
            scaler = StandardScaler()
            X_train_sc  = scaler.fit_transform(X_train_imp)
            X_test_sc   = scaler.transform(X_test_imp)

        results = []

        # ── Random Forest ─────────────────────────────────────────────────────
        with st.spinner(f"Training Random Forest ({n_estimators} trees)..."):
            rf = RandomForestRegressor(
                n_estimators=n_estimators, max_depth=max_depth,
                min_samples_leaf=min_samples, random_state=42, n_jobs=-1
            )
            rf.fit(X_train_imp, y_train)
            rf_preds = rf.predict(X_test_imp)
            rf_res   = evaluate(y_test, rf_preds)
            rf_res["model"] = "Random Forest"
            results.append(rf_res)
            joblib.dump(rf, os.path.join(MODELS_DIR, "random_forest.pkl"))
        st.success("✅ Random Forest trained.")

        # ── SVR ───────────────────────────────────────────────────────────────
        with st.spinner("Training SVR (may take ~30 seconds)..."):
            svr = SVR(kernel=kernel, C=C, epsilon=epsilon, gamma="scale")
            svr.fit(X_train_sc, y_train)
            svr_preds = svr.predict(X_test_sc)
            svr_res   = evaluate(y_test, svr_preds)
            svr_res["model"] = "SVR"
            results.append(svr_res)
            joblib.dump(svr, os.path.join(MODELS_DIR, "svr.pkl"))
        st.success("✅ SVR trained.")

        # ── save best ─────────────────────────────────────────────────────────
        results_df = pd.DataFrame(results)
        best_row   = results_df.loc[results_df["R2"].idxmax()]
        best_model = rf if best_row["model"] == "Random Forest" else svr
        joblib.dump(best_model,          os.path.join(MODELS_DIR, "best_model.pkl"))
        joblib.dump(best_row["model"],   os.path.join(MODELS_DIR, "best_model_name.pkl"))
        joblib.dump(imputer,             os.path.join(MODELS_DIR, "imputer.pkl"))
        joblib.dump(scaler,              os.path.join(MODELS_DIR, "scaler.pkl"))
        joblib.dump(feature_cols,        os.path.join(MODELS_DIR, "feature_cols.pkl"))
        results_df.to_csv(os.path.join(MODELS_DIR, "model_results.csv"), index=False)

        pred_df = pd.DataFrame({"y_true": y_test.values,
                                 "rf_pred": rf_preds, "svr_pred": svr_preds})
        pred_df.to_csv(os.path.join(MODELS_DIR, "test_predictions.csv"), index=False)

        # ── show results ──────────────────────────────────────────────────────
        st.divider()
        st.subheader("📊 Training Results")
        st.dataframe(results_df[["model","MAE","RMSE","R2"]], use_container_width=True)
        st.info(f"🏆 Best model: **{best_row['model']}** (R² = {best_row['R2']:.4f})")

        # feature importance
        st.subheader("🔍 Feature Importance (Random Forest)")
        imp = pd.Series(rf.feature_importances_, index=feature_cols).sort_values(ascending=True).tail(10)
        import plotly.express as px
        fig = px.bar(imp.reset_index(), x=0, y="index", orientation="h",
                     labels={0:"Importance","index":"Feature"},
                     color_discrete_sequence=["#1565c0"])
        fig.update_layout(margin=dict(t=10,b=10))
        st.plotly_chart(fig, use_container_width=True)
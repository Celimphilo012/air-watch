"""
train.py
--------
Trains two ML models on the preprocessed Eswatini air quality data:
  1. Random Forest Regressor
  2. Support Vector Regression (SVR)

Evaluates both using MAE, RMSE, R2.
Saves the better model as models/best_model.pkl

Run: python src/train.py
"""

import pandas as pd
import numpy as np
import os
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.svm import SVR
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

# ── paths ─────────────────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR    = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)


def load_data():
    X_train = pd.read_csv(os.path.join(PROCESSED_DIR, "X_train.csv"))
    X_test  = pd.read_csv(os.path.join(PROCESSED_DIR, "X_test.csv"))
    y_train = pd.read_csv(os.path.join(PROCESSED_DIR, "y_train.csv")).squeeze()
    y_test  = pd.read_csv(os.path.join(PROCESSED_DIR, "y_test.csv")).squeeze()
    return X_train, X_test, y_train, y_test


def evaluate(name, y_true, y_pred):
    mae  = mean_absolute_error(y_true, y_pred)
    rmse = np.sqrt(mean_squared_error(y_true, y_pred))
    r2   = r2_score(y_true, y_pred)
    print(f"\n  {name}")
    print(f"    MAE  : {mae:.3f} ug/m3")
    print(f"    RMSE : {rmse:.3f} ug/m3")
    print(f"    R2   : {r2:.4f}  ({r2*100:.1f}% variance explained)")
    return {"model": name, "MAE": round(mae, 3),
            "RMSE": round(rmse, 3), "R2": round(r2, 4)}


def main():
    print("=" * 55)
    print("  AirWatch Eswatini — Model Training")
    print("=" * 55)

    X_train, X_test, y_train, y_test = load_data()
    print(f"\n  Train : {X_train.shape[0]:,} rows x {X_train.shape[1]} features")
    print(f"  Test  : {X_test.shape[0]:,}  rows x {X_test.shape[1]} features")

    # ── impute any remaining NaNs (needed for SVR) ────────────────────────────
    print("\n  Imputing any remaining NaN values...")
    imputer = SimpleImputer(strategy="median")
    X_train_imp = imputer.fit_transform(X_train)
    X_test_imp  = imputer.transform(X_test)
    joblib.dump(imputer, os.path.join(MODELS_DIR, "imputer.pkl"))
    print(f"    NaNs in X_train after impute: {np.isnan(X_train_imp).sum()}")
    print(f"    NaNs in X_test  after impute: {np.isnan(X_test_imp).sum()}")

    results  = []
    all_preds = {}

    # ── 1. Random Forest ──────────────────────────────────────────────────────
    print("\n[1/2] Training Random Forest...")
    rf = RandomForestRegressor(
        n_estimators=200,
        max_depth=12,
        min_samples_leaf=4,
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train_imp, y_train)
    rf_preds = rf.predict(X_test_imp)
    rf_result = evaluate("Random Forest", y_test, rf_preds)
    results.append(rf_result)
    all_preds["rf_pred"] = rf_preds
    joblib.dump(rf, os.path.join(MODELS_DIR, "random_forest.pkl"))
    print("    Saved → models/random_forest.pkl")

    # feature importance
    importances = pd.Series(
        rf.feature_importances_, index=X_train.columns
    ).sort_values(ascending=False)
    print("\n  Top 5 most important features (Random Forest):")
    for feat, imp in importances.head(5).items():
        bar = "█" * int(imp * 60)
        print(f"    {feat:<18} {imp:.4f}  {bar}")

    # ── 2. SVR ────────────────────────────────────────────────────────────────
    print("\n[2/2] Training SVR (this may take ~30 seconds)...")
    svr = SVR(kernel="rbf", C=100, epsilon=0.5, gamma="scale")
    svr.fit(X_train_imp, y_train)
    svr_preds = svr.predict(X_test_imp)
    svr_result = evaluate("SVR", y_test, svr_preds)
    results.append(svr_result)
    all_preds["svr_pred"] = svr_preds
    joblib.dump(svr, os.path.join(MODELS_DIR, "svr.pkl"))
    print("    Saved → models/svr.pkl")

    # ── compare & save best ───────────────────────────────────────────────────
    print("\n" + "=" * 55)
    print("  Model Comparison")
    print("=" * 55)
    results_df = pd.DataFrame(results)
    print(results_df.to_string(index=False))

    best = results_df.loc[results_df["R2"].idxmax(), "model"]
    best_model = rf if best == "Random Forest" else svr

    print(f"\n  Best model: {best}  (highest R2)")
    joblib.dump(best_model, os.path.join(MODELS_DIR, "best_model.pkl"))
    joblib.dump(best,       os.path.join(MODELS_DIR, "best_model_name.pkl"))
    print(f"  Saved → models/best_model.pkl")

    results_df.to_csv(os.path.join(MODELS_DIR, "model_results.csv"), index=False)
    print(f"  Saved → models/model_results.csv")

    pred_df = pd.DataFrame({"y_true": y_test.values, **all_preds})
    pred_df.to_csv(os.path.join(MODELS_DIR, "test_predictions.csv"), index=False)
    print(f"  Saved → models/test_predictions.csv")

    print("\nDone. Run app/dashboard.py next.")


if __name__ == "__main__":
    main()
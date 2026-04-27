"""
pages/model_report.py — Model Performance Report
"""
import streamlit as st
import pandas as pd
import plotly.express as px
import os, sys, joblib

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.auth import require_access

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(BASE_DIR, "models")

@st.cache_resource
def load_assets():
    a = {}
    for n in ["model_results","test_predictions"]:
        p = os.path.join(MODELS_DIR, f"{n}.csv")
        if os.path.exists(p): a[n] = pd.read_csv(p)
    name_p = os.path.join(MODELS_DIR, "best_model_name.pkl")
    if os.path.exists(name_p): a["best_model_name"] = joblib.load(name_p)
    return a

def show():
    require_access("Model Report")
    st.title("🤖 Model Performance Report")
    st.caption("Comparison of Random Forest vs Support Vector Regression (SVR)")

    a = load_assets()
    if "model_results" not in a:
        st.error("No model results found. Train models first via **Configure & Train**.")
        return

    res   = a["model_results"]
    preds = a.get("test_predictions")
    rf    = res[res["model"]=="Random Forest"].iloc[0]
    svr   = res[res["model"]=="SVR"].iloc[0]

    st.subheader("Evaluation Metrics")
    c1,c2 = st.columns(2)
    with c1:
        st.markdown("**Random Forest**")
        st.metric("R²",   f"{rf['R2']:.4f}",  f"{rf['R2']*100:.1f}% variance explained")
        st.metric("MAE",  f"{rf['MAE']:.3f} µg/m³")
        st.metric("RMSE", f"{rf['RMSE']:.3f} µg/m³")
    with c2:
        st.markdown("**SVR**")
        st.metric("R²",   f"{svr['R2']:.4f}",  f"{svr['R2']*100:.1f}% variance explained")
        st.metric("MAE",  f"{svr['MAE']:.3f} µg/m³")
        st.metric("RMSE", f"{svr['RMSE']:.3f} µg/m³")

    st.subheader("Side-by-Side Comparison")
    fig = px.bar(res.melt(id_vars="model", value_vars=["MAE","RMSE","R2"]),
                 x="variable", y="value", color="model", barmode="group",
                 color_discrete_map={"Random Forest":"#1565c0","SVR":"#6a1b9a"},
                 text_auto=".3f", labels={"variable":"Metric","value":"Score","model":"Model"})
    fig.update_layout(margin=dict(t=10,b=10))
    st.plotly_chart(fig, use_container_width=True)

    if preds is not None:
        st.subheader("Actual vs Predicted PM2.5 (Test Set)")
        ca,cb = st.columns(2)
        mv = max(preds["y_true"].max(), preds["rf_pred"].max(), preds["svr_pred"].max())
        with ca:
            st.caption("Random Forest")
            fig2 = px.scatter(preds, x="y_true", y="rf_pred", opacity=0.5,
                              labels={"y_true":"Actual","rf_pred":"Predicted"},
                              color_discrete_sequence=["#1565c0"])
            fig2.add_shape(type="line",x0=0,y0=0,x1=mv,y1=mv,line=dict(dash="dash",color="red"))
            fig2.update_layout(margin=dict(t=10,b=10))
            st.plotly_chart(fig2, use_container_width=True)
        with cb:
            st.caption("SVR")
            fig3 = px.scatter(preds, x="y_true", y="svr_pred", opacity=0.5,
                              labels={"y_true":"Actual","svr_pred":"Predicted"},
                              color_discrete_sequence=["#6a1b9a"])
            fig3.add_shape(type="line",x0=0,y0=0,x1=mv,y1=mv,line=dict(dash="dash",color="red"))
            fig3.update_layout(margin=dict(t=10,b=10))
            st.plotly_chart(fig3, use_container_width=True)
        st.caption("Red dashed line = perfect prediction. Points closer to line = better accuracy.")

    best = res.loc[res["R2"].idxmax(),"model"]
    st.subheader("Interpretation")
    st.markdown(f"""
- **Best model: {best}** with R² = {res['R2'].max():.4f}
- Average prediction error (MAE) ~3.3 µg/m³ — acceptable for environmental forecasting
- Strongest predictor: **PM2.5 from the previous day** (lag1, ~79% importance in RF)
- Seasonal patterns and rolling averages contribute meaningfully to accuracy
- Both models confirm Eswatini industrial zones consistently exceed the WHO PM2.5 threshold
""")
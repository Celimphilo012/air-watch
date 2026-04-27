"""
pages/predict.py — Predict Air Quality page
Use case: Predict Future Air Quality + View Prediction Results
"""
import streamlit as st
import pandas as pd
import numpy as np
import plotly.graph_objects as go
import os, sys, joblib
from datetime import date

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.auth import require_access

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(BASE_DIR, "models")

AQI_COLORS = {"Good":"#2e7d32","Moderate":"#f9a825","Unhealthy":"#e65100","Hazardous":"#b71c1c"}

def who_cat(v):
    if v<=10: return "Good"
    elif v<=25: return "Moderate"
    elif v<=50: return "Unhealthy"
    return "Hazardous"

@st.cache_resource
def load_assets():
    a = {}
    for n in ["best_model","scaler","imputer","feature_cols","best_model_name"]:
        p = os.path.join(MODELS_DIR, f"{n}.pkl")
        if os.path.exists(p): a[n] = joblib.load(p)
    return a

def show():
    require_access("Predict Air Quality")
    st.title("🔮 Predict Future Air Quality")
    st.caption("Enter current pollutant readings to generate a 7-day PM2.5 forecast.")

    assets = load_assets()
    if "best_model" not in assets:
        st.error("No trained model found. Go to **Configure & Train** first.")
        return

    model        = assets["best_model"]
    model_name   = assets.get("best_model_name", "Model")
    scaler       = assets["scaler"]
    imputer      = assets["imputer"]
    feature_cols = assets["feature_cols"]

    st.info(f"Active model: **{model_name}**")

    with st.form("predict_form"):
        c1,c2,c3 = st.columns(3)
        with c1:
            zone      = st.selectbox("Industrial Zone", ["Matsapha","Simunye","Bhunya"])
            pred_date = st.date_input("Forecast Start Date", value=date.today())
        with c2:
            cur_pm25 = st.number_input("Current PM2.5 (µg/m³)", 0.0, 150.0, 18.0, 0.5)
            cur_pm10 = st.number_input("Current PM10 (µg/m³)",  0.0, 200.0, 32.0, 0.5)
        with c3:
            cur_no2  = st.number_input("Current NO2 (µg/m³)",   0.0, 100.0, 15.0, 0.5)
            cur_co   = st.number_input("Current CO (mg/m³)",     0.0,  10.0,  0.5, 0.05)
        submitted = st.form_submit_button("▶ Run Forecast", type="primary")

    if submitted:
        history   = [cur_pm25] * 30
        forecasts = []
        for d in range(1, 8):
            td = pd.Timestamp(pred_date) + pd.Timedelta(days=d)
            row = {
                "month": td.month, "year": td.year, "day_of_week": td.dayofweek,
                "pm10": cur_pm10, "no2": cur_no2, "co": cur_co,
                "pm25_lag1": history[-1], "pm25_lag3": history[-3], "pm25_lag7": history[-7],
                "pm25_roll7": np.mean(history[-7:]), "pm25_roll30": np.mean(history[-30:]),
                "is_dry_season": int(td.month in [5,6,7,8,9]),
            }
            for col in feature_cols:
                if col.startswith("loc_"):
                    row[col] = 0
            zone_col = f"loc_{zone}"
            if zone_col in feature_cols:
                row[zone_col] = 1
            X  = pd.DataFrame([row])[feature_cols]
            Xi = pd.DataFrame(imputer.transform(X), columns=feature_cols)
            Xs = pd.DataFrame(scaler.transform(Xi), columns=feature_cols)
            p  = max(round(float(model.predict(Xs.values)[0]), 2), 2.0)
            history.append(p)
            forecasts.append({"Date": td.strftime("%Y-%m-%d"),
                               "Day": td.strftime("%A"),
                               "PM2.5": p, "Category": who_cat(p)})

        fdf = pd.DataFrame(forecasts)

        # save to session for notifications page
        st.session_state["last_forecast"] = fdf
        st.session_state["last_forecast_zone"] = zone

        st.subheader(f"7-Day PM2.5 Forecast — {zone}")

        cols = st.columns(7)
        for i, row in fdf.iterrows():
            color = AQI_COLORS.get(row["Category"], "#9e9e9e")
            with cols[i]:
                st.markdown(f"""<div style="text-align:center;padding:8px;border-radius:8px;
border:2px solid {color};">
<div style="font-size:11px;color:#666;">{row['Day'][:3]}</div>
<div style="font-size:11px;color:#666;">{row['Date'][5:]}</div>
<div style="font-size:20px;font-weight:700;color:{color};">{row['PM2.5']}</div>
<div style="font-size:10px;color:{color};">{row['Category']}</div>
</div>""", unsafe_allow_html=True)

        st.write("")
        fig = go.Figure()
        fig.add_trace(go.Scatter(
            x=fdf["Date"], y=fdf["PM2.5"],
            mode="lines+markers+text",
            text=fdf["PM2.5"].round(1), textposition="top center",
            line=dict(color="#1565c0", width=2), marker=dict(size=8),
        ))
        fig.add_hline(y=10, line_dash="dash", line_color="red",
                      annotation_text="WHO Safe Limit (10 µg/m³)")
        fig.update_layout(yaxis_title="PM2.5 (µg/m³)", xaxis_title="Date",
                          margin=dict(t=20,b=20))
        st.plotly_chart(fig, use_container_width=True)

        worst = fdf.loc[fdf["PM2.5"].idxmax()]
        if worst["PM2.5"] > 25:
            st.warning(f"⚠️ Peak of **{worst['PM2.5']} µg/m³** on **{worst['Day']} {worst['Date']}** "
                       f"— {worst['Category']} levels. Go to **Email Notifications** to alert stakeholders.")
        elif worst["PM2.5"] > 10:
            st.info("ℹ️ Moderate levels forecast — above WHO guideline. Monitor closely.")
        else:
            st.success("✅ Good air quality forecast for this period.")

        # download forecast
        csv = fdf.to_csv(index=False).encode()
        st.download_button("⬇️ Download Forecast CSV", csv,
                           f"forecast_{zone}_{pred_date}.csv", "text/csv")
"""
dashboard.py — AirWatch Eswatini Streamlit Dashboard
Run: streamlit run app/dashboard.py
"""

import streamlit as st
import pandas as pd
import numpy as np
import os
import joblib
import plotly.express as px
import plotly.graph_objects as go
from datetime import date

BASE_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR    = os.path.join(BASE_DIR, "models")

st.set_page_config(page_title="AirWatch Eswatini", page_icon="🌿", layout="wide")

st.markdown("""
<style>
.who-warning{background:#fff3e0;border-left:4px solid #ff9800;padding:.7rem 1rem;border-radius:6px;font-size:.9rem;}
</style>""", unsafe_allow_html=True)

AQI_COLORS  = {"Good":"#2e7d32","Moderate":"#f9a825","Unhealthy":"#e65100","Hazardous":"#b71c1c","Unknown":"#9e9e9e"}
ZONE_COLORS = {"Matsapha":"#1565c0","Simunye":"#6a1b9a","Bhunya":"#00695c"}

@st.cache_data
def load_data():
    return pd.read_csv(os.path.join(PROCESSED_DIR,"airquality_eswatini.csv"), parse_dates=["date"])

@st.cache_resource
def load_assets():
    a = {}
    for n in ["best_model","random_forest","svr","scaler","imputer","feature_cols","best_model_name"]:
        p = os.path.join(MODELS_DIR, f"{n}.pkl")
        if os.path.exists(p): a[n] = joblib.load(p)
    for n in ["model_results","test_predictions"]:
        p = os.path.join(MODELS_DIR, f"{n}.csv")
        if os.path.exists(p): a[n] = pd.read_csv(p)
    return a

def who_cat(v):
    if v<=10: return "Good"
    elif v<=25: return "Moderate"
    elif v<=50: return "Unhealthy"
    return "Hazardous"

# ── sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.title("🌿 AirWatch Eswatini")
    st.caption("Environmental Monitoring System\nfor Air Quality Prediction")
    st.divider()
    page = st.radio("Navigate", ["📊 Overview","📈 Historical Trends","🔮 Predict Air Quality","🤖 Model Report"], label_visibility="collapsed")
    st.divider()
    st.markdown("**WHO PM2.5 Guideline:** Safe limit = **10 µg/m³**")
    st.markdown("""| Category | PM2.5 |\n|---|---|\n|🟢 Good|≤10|\n|🟡 Moderate|≤25|\n|🟠 Unhealthy|≤50|\n|🔴 Hazardous|>50|""")
    st.divider()
    st.caption("EMCU · BSc Computer Science\nMthokozisi Jele · 202280195")

df     = load_data()
assets = load_assets()

# ════════════════════════════════════════════════════
# PAGE 1 — OVERVIEW
# ════════════════════════════════════════════════════
if page == "📊 Overview":
    st.title("📊 Air Quality Overview")
    st.caption("Industrial zones: Matsapha · Simunye · Bhunya | Data: 2015–2020 (adapted to Eswatini baseline)")

    c1,c2,c3,c4 = st.columns(4)
    c1.metric("Overall PM2.5 Mean", f"{df['pm25'].mean():.1f} µg/m³", delta=f"{df['pm25'].mean()-10:.1f} above WHO", delta_color="inverse")
    c2.metric("Most Polluted Zone", df.groupby("location")["pm25"].mean().idxmax())
    c3.metric("Days Above WHO Limit", f"{(df['pm25']>10).mean()*100:.1f}%")
    c4.metric("Total Records", f"{len(df):,}")
    st.divider()

    ca, cb = st.columns(2)
    with ca:
        st.subheader("AQI Category Distribution")
        ac = df["aqi_category"].value_counts().reset_index()
        ac.columns = ["Category","Count"]
        fig = px.pie(ac, names="Category", values="Count", color="Category", color_discrete_map=AQI_COLORS, hole=0.4)
        fig.update_traces(textinfo="percent+label")
        fig.update_layout(showlegend=False, margin=dict(t=10,b=10))
        st.plotly_chart(fig, width="stretch")

    with cb:
        st.subheader("Average PM2.5 by Zone")
        zm = df.groupby("location")["pm25"].mean().reset_index()
        zm.columns = ["Zone","PM2.5"]
        fig2 = px.bar(zm, x="Zone", y="PM2.5", color="Zone", color_discrete_map=ZONE_COLORS, text=zm["PM2.5"].round(1))
        fig2.add_hline(y=10, line_dash="dash", line_color="red", annotation_text="WHO Limit (10 µg/m³)")
        fig2.update_layout(showlegend=False, margin=dict(t=10,b=10), yaxis_title="PM2.5 (µg/m³)")
        st.plotly_chart(fig2, width="stretch")

    st.subheader("Monthly PM2.5 Heatmap by Zone")
    pivot = df.groupby(["location","month"])["pm25"].mean().round(1).reset_index()
    pw = pivot.pivot(index="location", columns="month", values="pm25")
    pw.columns = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    fig3 = px.imshow(pw, text_auto=True, aspect="auto", color_continuous_scale="YlOrRd", labels=dict(color="PM2.5"))
    fig3.update_layout(margin=dict(t=10,b=10))
    st.plotly_chart(fig3, width="stretch")

    st.markdown('<div class="who-warning">⚠️ Eswatini national PM2.5 mean (~17 µg/m³) exceeds the WHO guideline of 10 µg/m³. Industrial zones are primary contributors. Source: WHO / World Bank EN.ATM.PM25.MC.M3</div>', unsafe_allow_html=True)

# ════════════════════════════════════════════════════
# PAGE 2 — HISTORICAL
# ════════════════════════════════════════════════════
elif page == "📈 Historical Trends":
    st.title("📈 Historical Air Quality Trends")
    c1,c2 = st.columns(2)
    with c1: zones = st.multiselect("Zones", ["Matsapha","Simunye","Bhunya"], default=["Matsapha","Simunye","Bhunya"])
    with c2: poll  = st.selectbox("Pollutant", ["pm25","pm10","no2","co"])

    fdf = df[df["location"].isin(zones)] if zones else df

    st.subheader(f"{poll.upper()} Over Time")
    mo = fdf.groupby(["date","location"])[poll].mean().reset_index()
    fig = px.line(mo, x="date", y=poll, color="location", color_discrete_map=ZONE_COLORS,
                  labels={"date":"Date", poll:f"{poll.upper()} (µg/m³)", "location":"Zone"})
    if poll=="pm25": fig.add_hline(y=10, line_dash="dash", line_color="red", annotation_text="WHO Limit")
    fig.update_layout(margin=dict(t=10,b=10))
    st.plotly_chart(fig, width="stretch")

    ca,cb = st.columns(2)
    with ca:
        st.subheader("Dry vs Wet Season PM2.5")
        fdf = fdf.copy()
        fdf["season"] = fdf["month"].apply(lambda m: "Dry (May–Sep)" if m in [5,6,7,8,9] else "Wet (Oct–Apr)")
        sd = fdf.groupby(["location","season"])["pm25"].mean().reset_index()
        fig2 = px.bar(sd, x="location", y="pm25", color="season", barmode="group",
                      color_discrete_map={"Dry (May–Sep)":"#e65100","Wet (Oct–Apr)":"#1565c0"},
                      labels={"pm25":"PM2.5 (µg/m³)","location":"Zone"})
        fig2.update_layout(margin=dict(t=10,b=10))
        st.plotly_chart(fig2, width="stretch")

    with cb:
        st.subheader("PM2.5 Distribution by Zone")
        fig3 = px.box(fdf, x="location", y="pm25", color="location", color_discrete_map=ZONE_COLORS,
                      labels={"pm25":"PM2.5 (µg/m³)","location":"Zone"})
        fig3.add_hline(y=10, line_dash="dash", line_color="red", annotation_text="WHO Limit")
        fig3.update_layout(showlegend=False, margin=dict(t=10,b=10))
        st.plotly_chart(fig3, width="stretch")

    with st.expander("View Raw Data"):
        st.dataframe(fdf[["date","location","pm25","pm10","no2","co","aqi_category"]].sort_values("date",ascending=False).head(200), width="stretch")

# ════════════════════════════════════════════════════
# PAGE 3 — PREDICT
# ════════════════════════════════════════════════════
elif page == "🔮 Predict Air Quality":
    st.title("🔮 Predict Future Air Quality")
    st.caption("Enter current conditions to forecast PM2.5 for the next 7 days.")

    if "best_model" not in assets:
        st.error("No model found. Run train.py first.")
    else:
        model        = assets["best_model"]
        model_name   = assets.get("best_model_name","Best Model")
        scaler       = assets["scaler"]
        imputer      = assets["imputer"]
        feature_cols = assets["feature_cols"]

        st.info(f"Using: **{model_name}** (highest R² on test set)")

        with st.form("pform"):
            c1,c2,c3 = st.columns(3)
            with c1:
                zone       = st.selectbox("Industrial Zone", ["Matsapha","Simunye","Bhunya"])
                pred_date  = st.date_input("Forecast Start Date", value=date.today())
            with c2:
                cur_pm25 = st.number_input("Current PM2.5 (µg/m³)", 0.0, 150.0, 18.0, 0.5)
                cur_pm10 = st.number_input("Current PM10 (µg/m³)",  0.0, 200.0, 32.0, 0.5)
            with c3:
                cur_no2  = st.number_input("Current NO2 (µg/m³)",   0.0, 100.0, 15.0, 0.5)
                cur_co   = st.number_input("Current CO (mg/m³)",     0.0,  10.0,  0.5, 0.05)
            submitted = st.form_submit_button("Run Forecast ▶", type="primary")

        if submitted:
            history  = [cur_pm25] * 30
            forecasts = []
            for d in range(1, 8):
                td  = pd.Timestamp(pred_date) + pd.Timedelta(days=d)
                row = {
                    "month": td.month, "year": td.year, "day_of_week": td.dayofweek,
                    "pm10": cur_pm10, "no2": cur_no2, "co": cur_co,
                    "pm25_lag1": history[-1], "pm25_lag3": history[-3], "pm25_lag7": history[-7],
                    "pm25_roll7": np.mean(history[-7:]), "pm25_roll30": np.mean(history[-30:]),
                    "loc_Bhunya":   int(zone=="Bhunya"),
                    "loc_Matsapha": int(zone=="Matsapha"),
                    "loc_Simunye":  int(zone=="Simunye"),
                    "is_dry_season": int(td.month in [5,6,7,8,9]),
                }
                X  = pd.DataFrame([row])[feature_cols]
                Xi = pd.DataFrame(imputer.transform(X), columns=feature_cols)
                Xs = pd.DataFrame(scaler.transform(Xi), columns=feature_cols)
                p  = max(round(float(model.predict(Xs)[0]), 2), 2.0)
                history.append(p)
                forecasts.append({"Date": td.strftime("%Y-%m-%d"), "Day": td.strftime("%A"), "PM2.5": p, "Category": who_cat(p)})

            fdf = pd.DataFrame(forecasts)
            st.subheader(f"7-Day PM2.5 Forecast — {zone}")

            cols = st.columns(7)
            for i, row in fdf.iterrows():
                color = AQI_COLORS.get(row["Category"], "#9e9e9e")
                with cols[i]:
                    st.markdown(f"""<div style="text-align:center;padding:8px;border-radius:8px;border:2px solid {color};">
<div style="font-size:11px;color:#666;">{row['Day'][:3]}</div>
<div style="font-size:11px;color:#666;">{row['Date'][5:]}</div>
<div style="font-size:20px;font-weight:700;color:{color};">{row['PM2.5']}</div>
<div style="font-size:10px;color:{color};">{row['Category']}</div>
</div>""", unsafe_allow_html=True)

            fig = go.Figure()
            fig.add_trace(go.Scatter(x=fdf["Date"], y=fdf["PM2.5"], mode="lines+markers+text",
                                     text=fdf["PM2.5"].round(1), textposition="top center",
                                     line=dict(color="#1565c0", width=2), marker=dict(size=8)))
            fig.add_hline(y=10, line_dash="dash", line_color="red", annotation_text="WHO Safe Limit")
            fig.update_layout(yaxis_title="PM2.5 (µg/m³)", xaxis_title="Date", margin=dict(t=20,b=20))
            st.plotly_chart(fig, width="stretch")

            worst = fdf.loc[fdf["PM2.5"].idxmax()]
            if worst["PM2.5"] > 25:
                st.warning(f"⚠️ Peak of **{worst['PM2.5']} µg/m³** on **{worst['Day']} {worst['Date']}** — {worst['Category']} levels. Consider early warning measures.")
            else:
                st.success("✅ All forecast days within Moderate or Good range.")

# ════════════════════════════════════════════════════
# PAGE 4 — MODEL REPORT
# ════════════════════════════════════════════════════
elif page == "🤖 Model Report":
    st.title("🤖 Model Performance Report")
    st.caption("Random Forest vs Support Vector Regression (SVR)")

    if "model_results" not in assets:
        st.error("Run train.py first.")
    else:
        res   = assets["model_results"]
        preds = assets.get("test_predictions")
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
        st.plotly_chart(fig, width="stretch")

        if preds is not None:
            st.subheader("Actual vs Predicted PM2.5 (Test Set)")
            ca,cb = st.columns(2)
            mv = max(preds["y_true"].max(), preds["rf_pred"].max(), preds["svr_pred"].max())
            with ca:
                st.caption("Random Forest")
                fig2 = px.scatter(preds, x="y_true", y="rf_pred", opacity=0.5,
                                  labels={"y_true":"Actual","rf_pred":"Predicted"},
                                  color_discrete_sequence=["#1565c0"])
                fig2.add_shape(type="line", x0=0,y0=0,x1=mv,y1=mv, line=dict(dash="dash",color="red"))
                fig2.update_layout(margin=dict(t=10,b=10))
                st.plotly_chart(fig2, width="stretch")
            with cb:
                st.caption("SVR")
                fig3 = px.scatter(preds, x="y_true", y="svr_pred", opacity=0.5,
                                  labels={"y_true":"Actual","svr_pred":"Predicted"},
                                  color_discrete_sequence=["#6a1b9a"])
                fig3.add_shape(type="line", x0=0,y0=0,x1=mv,y1=mv, line=dict(dash="dash",color="red"))
                fig3.update_layout(margin=dict(t=10,b=10))
                st.plotly_chart(fig3, width="stretch")
            st.caption("Red dashed line = perfect prediction. Closer = better.")

        best = res.loc[res["R2"].idxmax(),"model"]
        st.subheader("Interpretation")
        st.markdown(f"""
- **Best model: {best}** with R² = {res['R2'].max():.4f}
- Average prediction error (MAE) of ~3.3 µg/m³ — acceptable for environmental forecasting
- Strongest predictor: **PM2.5 from the previous day** (lag1 ~79% importance in RF)
- Seasonal patterns (dry vs wet) and rolling averages contribute meaningfully
- Both models confirm Eswatini industrial zones consistently exceed the WHO PM2.5 threshold
""")
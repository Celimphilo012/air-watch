"""
pages/report.py — Generate Report + Export PDF/CSV
Use case: Generate Reports + Export Report PDF/CSV
"""
import streamlit as st
import pandas as pd
import plotly.express as px
import io, os, sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.auth import require_access, current_user_name

BASE_DIR      = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR    = os.path.join(BASE_DIR, "models")
AQI_COLORS    = {"Good":"#2e7d32","Moderate":"#f9a825","Unhealthy":"#e65100","Hazardous":"#b71c1c"}
ZONE_COLORS   = {"Matsapha":"#1565c0","Simunye":"#6a1b9a","Bhunya":"#00695c"}

@st.cache_data
def load_data():
    p = os.path.join(PROCESSED_DIR, "airquality_eswatini.csv")
    if not os.path.exists(p): return None
    return pd.read_csv(p, parse_dates=["date"])

def show():
    require_access("Generate Report")
    st.title("📋 Generate Environmental Report")
    st.caption("Summarise air quality findings and export for stakeholders.")

    df = load_data()
    if df is None:
        st.warning("No data found. Upload a dataset first.")
        return

    # ── report header ─────────────────────────────────────────────────────────
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    st.markdown(f"""
<div style="background:#e8f5e9;border-left:4px solid #2e7d32;padding:1rem;border-radius:6px;margin-bottom:1rem;">
<h4 style="margin:0;">Environmental Monitoring Report — Eswatini Industrial Zones</h4>
<p style="margin:4px 0 0;font-size:13px;color:#555;">
Generated: {now} &nbsp;|&nbsp; Prepared by: {current_user_name()} &nbsp;|&nbsp;
Reference: WHO PM2.5 Guideline (10 µg/m³)
</p>
</div>""", unsafe_allow_html=True)

    # ── zone summary table ────────────────────────────────────────────────────
    st.subheader("1. Zone Summary")
    summary = df.groupby("location").agg(
        Records    = ("pm25","count"),
        PM25_Mean  = ("pm25","mean"),
        PM25_Max   = ("pm25","max"),
        PM25_Min   = ("pm25","min"),
        PM10_Mean  = ("pm10","mean"),
        NO2_Mean   = ("no2","mean"),
    ).round(2).reset_index()
    summary["Above_WHO_%"] = (
        df[df["pm25"]>10].groupby("location")["pm25"].count() /
        df.groupby("location")["pm25"].count() * 100
    ).round(1).values
    summary["Status"] = summary["PM25_Mean"].apply(
        lambda x: "🔴 Exceeds WHO" if x > 10 else "🟢 Within WHO"
    )
    st.dataframe(summary, use_container_width=True)

    # ── charts ────────────────────────────────────────────────────────────────
    st.subheader("2. PM2.5 Trend by Zone")
    monthly = df.groupby(["date","location"])["pm25"].mean().reset_index()
    fig = px.line(monthly, x="date", y="pm25", color="location",
                  color_discrete_map=ZONE_COLORS,
                  labels={"date":"Date","pm25":"PM2.5 (µg/m³)","location":"Zone"})
    fig.add_hline(y=10, line_dash="dash", line_color="red", annotation_text="WHO Limit")
    fig.update_layout(margin=dict(t=10,b=10))
    st.plotly_chart(fig, use_container_width=True)

    st.subheader("3. AQI Distribution")
    ac = df["aqi_category"].value_counts().reset_index()
    ac.columns = ["Category","Count"]
    fig2 = px.pie(ac, names="Category", values="Count",
                  color="Category", color_discrete_map=AQI_COLORS, hole=0.4)
    fig2.update_traces(textinfo="percent+label")
    fig2.update_layout(showlegend=False, margin=dict(t=10,b=10))
    st.plotly_chart(fig2, use_container_width=True)

    # ── model results ─────────────────────────────────────────────────────────
    model_path = os.path.join(MODELS_DIR, "model_results.csv")
    if os.path.exists(model_path):
        st.subheader("4. Machine Learning Model Performance")
        mdf = pd.read_csv(model_path)
        st.dataframe(mdf, use_container_width=True)
        best = mdf.loc[mdf["R2"].idxmax()]
        st.markdown(f"**Best model:** {best['model']} — R² = {best['R2']:.4f}, MAE = {best['MAE']:.3f} µg/m³")

    # ── recommendations ───────────────────────────────────────────────────────
    st.subheader("5. Recommendations")
    worst_zone = summary.loc[summary["PM25_Mean"].idxmax(), "location"]
    st.markdown(f"""
- **{worst_zone}** records the highest average PM2.5 — prioritise emission control measures here
- **{(df['pm25']>10).mean()*100:.1f}%** of all recorded days exceed the WHO PM2.5 guideline of 10 µg/m³
- Dry season months (May–September) consistently show elevated pollution levels — early warnings should be issued proactively
- Continuous monitoring infrastructure should be expanded across all three industrial zones
- Community awareness programmes recommended for Matsapha, Simunye, and Bhunya residents
""")

    st.divider()

    # ── exports ───────────────────────────────────────────────────────────────
    st.subheader("📥 Export Options")
    c1, c2 = st.columns(2)

    with c1:
        csv_data = df.to_csv(index=False).encode()
        st.download_button(
            "⬇️ Export Full Dataset (CSV)",
            csv_data,
            f"airwatch_eswatini_data_{datetime.now().strftime('%Y%m%d')}.csv",
            "text/csv",
            use_container_width=True,
        )

    with c2:
        summary_csv = summary.to_csv(index=False).encode()
        st.download_button(
            "⬇️ Export Zone Summary (CSV)",
            summary_csv,
            f"airwatch_zone_summary_{datetime.now().strftime('%Y%m%d')}.csv",
            "text/csv",
            use_container_width=True,
        )

    st.info("💡 To export as PDF: use your browser's Print function (Ctrl+P) and select 'Save as PDF'.")
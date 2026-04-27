"""
pages/historical.py — Historical Trends page
"""
import streamlit as st
import pandas as pd
import plotly.express as px
import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.auth import require_access

BASE_DIR      = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
ZONE_COLORS   = {"Matsapha":"#1565c0","Simunye":"#6a1b9a","Bhunya":"#00695c"}

@st.cache_data
def load_data():
    path = os.path.join(PROCESSED_DIR, "airquality_eswatini.csv")
    if not os.path.exists(path): return None
    return pd.read_csv(path, parse_dates=["date"])

def show():
    require_access("Historical Trends")
    st.title("📈 Historical Air Quality Trends")

    df = load_data()
    if df is None:
        st.warning("No data found. Please upload a dataset first via **Upload & Validate**.")
        return

    c1,c2 = st.columns(2)
    with c1: zones = st.multiselect("Zones", ["Matsapha","Simunye","Bhunya"], default=["Matsapha","Simunye","Bhunya"])
    with c2: poll  = st.selectbox("Pollutant", ["pm25","pm10","no2","co"])

    fdf = df[df["location"].isin(zones)].copy() if zones else df.copy()

    st.subheader(f"{poll.upper()} Over Time")
    mo = fdf.groupby(["date","location"])[poll].mean().reset_index()
    fig = px.line(mo, x="date", y=poll, color="location", color_discrete_map=ZONE_COLORS,
                  labels={"date":"Date", poll:f"{poll.upper()} (µg/m³)", "location":"Zone"})
    if poll == "pm25":
        fig.add_hline(y=10, line_dash="dash", line_color="red", annotation_text="WHO Limit")
    fig.update_layout(margin=dict(t=10,b=10))
    st.plotly_chart(fig, use_container_width=True)

    ca, cb = st.columns(2)
    with ca:
        st.subheader("Dry vs Wet Season PM2.5")
        fdf["season"] = fdf["month"].apply(lambda m: "Dry (May–Sep)" if m in [5,6,7,8,9] else "Wet (Oct–Apr)")
        sd = fdf.groupby(["location","season"])["pm25"].mean().reset_index()
        fig2 = px.bar(sd, x="location", y="pm25", color="season", barmode="group",
                      color_discrete_map={"Dry (May–Sep)":"#e65100","Wet (Oct–Apr)":"#1565c0"},
                      labels={"pm25":"PM2.5 (µg/m³)","location":"Zone"})
        fig2.update_layout(margin=dict(t=10,b=10))
        st.plotly_chart(fig2, use_container_width=True)

    with cb:
        st.subheader("PM2.5 Distribution by Zone")
        fig3 = px.box(fdf, x="location", y="pm25", color="location",
                      color_discrete_map=ZONE_COLORS,
                      labels={"pm25":"PM2.5 (µg/m³)","location":"Zone"})
        fig3.add_hline(y=10, line_dash="dash", line_color="red", annotation_text="WHO Limit")
        fig3.update_layout(showlegend=False, margin=dict(t=10,b=10))
        st.plotly_chart(fig3, use_container_width=True)

    with st.expander("View Raw Data"):
        st.dataframe(
            fdf[["date","location","pm25","pm10","no2","co","aqi_category"]]
            .sort_values("date", ascending=False).head(200),
            use_container_width=True
        )
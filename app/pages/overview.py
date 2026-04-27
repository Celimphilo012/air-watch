"""
pages/overview.py — Air Quality Overview page
"""
import streamlit as st
import pandas as pd
import plotly.express as px
import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.auth import require_access

BASE_DIR      = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")

AQI_COLORS  = {"Good":"#2e7d32","Moderate":"#f9a825","Unhealthy":"#e65100","Hazardous":"#b71c1c","Unknown":"#9e9e9e"}
ZONE_COLORS = {"Matsapha":"#1565c0","Simunye":"#6a1b9a","Bhunya":"#00695c"}

@st.cache_data
def load_data():
    path = os.path.join(PROCESSED_DIR, "airquality_eswatini.csv")
    if not os.path.exists(path):
        return None
    return pd.read_csv(path, parse_dates=["date"])

def show():
    require_access("Overview")
    st.title("📊 Air Quality Overview")
    st.caption("Industrial zones: Matsapha · Simunye · Bhunya")

    df = load_data()
    if df is None:
        st.warning("No data found. Please upload a dataset first via **Upload & Validate**.")
        return

    c1,c2,c3,c4 = st.columns(4)
    c1.metric("Overall PM2.5 Mean",  f"{df['pm25'].mean():.1f} µg/m³",
              delta=f"{df['pm25'].mean()-10:.1f} above WHO", delta_color="inverse")
    c2.metric("Most Polluted Zone",  df.groupby("location")["pm25"].mean().idxmax())
    c3.metric("Days Above WHO Limit", f"{(df['pm25']>10).mean()*100:.1f}%")
    c4.metric("Total Records",        f"{len(df):,}")
    st.divider()

    ca, cb = st.columns(2)
    with ca:
        st.subheader("AQI Category Distribution")
        ac = df["aqi_category"].value_counts().reset_index()
        ac.columns = ["Category","Count"]
        fig = px.pie(ac, names="Category", values="Count", color="Category",
                     color_discrete_map=AQI_COLORS, hole=0.4)
        fig.update_traces(textinfo="percent+label")
        fig.update_layout(showlegend=False, margin=dict(t=10,b=10))
        st.plotly_chart(fig, use_container_width=True)

    with cb:
        st.subheader("Average PM2.5 by Zone")
        zm = df.groupby("location")["pm25"].mean().reset_index()
        zm.columns = ["Zone","PM2.5"]
        fig2 = px.bar(zm, x="Zone", y="PM2.5", color="Zone",
                      color_discrete_map=ZONE_COLORS, text=zm["PM2.5"].round(1))
        fig2.add_hline(y=10, line_dash="dash", line_color="red",
                       annotation_text="WHO Limit (10 µg/m³)")
        fig2.update_layout(showlegend=False, margin=dict(t=10,b=10),
                           yaxis_title="PM2.5 (µg/m³)")
        st.plotly_chart(fig2, use_container_width=True)

    st.subheader("Monthly PM2.5 Heatmap by Zone")
    pivot = df.groupby(["location","month"])["pm25"].mean().round(1).reset_index()
    pw = pivot.pivot(index="location", columns="month", values="pm25")
    pw.columns = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    fig3 = px.imshow(pw, text_auto=True, aspect="auto",
                     color_continuous_scale="YlOrRd", labels=dict(color="PM2.5"))
    fig3.update_layout(margin=dict(t=10,b=10))
    st.plotly_chart(fig3, use_container_width=True)

    st.markdown("""
<div style="background:#fff3e0;border-left:4px solid #ff9800;padding:.7rem 1rem;border-radius:6px;font-size:.9rem;">
⚠️ Eswatini's national PM2.5 mean (~17 µg/m³) exceeds the WHO guideline of 10 µg/m³.
Industrial zones Matsapha, Simunye, and Bhunya are primary contributors.
Source: WHO Global Air Quality Database / World Bank Indicator EN.ATM.PM25.MC.M3
</div>""", unsafe_allow_html=True)
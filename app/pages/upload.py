"""
pages/upload.py — Upload & Validate Dataset page
Use case: Upload/Import Air Quality Dataset + Validate & Audit Data
"""
import streamlit as st
import pandas as pd
import numpy as np
import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.auth import require_access

BASE_DIR      = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
os.makedirs(PROCESSED_DIR, exist_ok=True)

REQUIRED_COLS = ["date","location","pm25","pm10","no2","co"]
VALID_ZONES   = ["Matsapha","Simunye","Bhunya"]
PM25_MAX      = 500.0
PM25_MIN      = 0.0

def who_category(pm25):
    if pd.isna(pm25):  return "Unknown"
    if pm25 <= 10:     return "Good"
    elif pm25 <= 25:   return "Moderate"
    elif pm25 <= 50:   return "Unhealthy"
    return "Hazardous"

def validate(df: pd.DataFrame) -> tuple[bool, list, list]:
    errors   = []
    warnings = []

    # 1. required columns
    missing = [c for c in REQUIRED_COLS if c not in df.columns]
    if missing:
        errors.append(f"Missing required columns: {missing}")
        return False, errors, warnings

    # 2. date parseable
    try:
        df["date"] = pd.to_datetime(df["date"])
    except Exception:
        errors.append("Column 'date' could not be parsed as dates.")

    # 3. location values
    bad_zones = df[~df["location"].isin(VALID_ZONES)]["location"].unique().tolist()
    if bad_zones:
        errors.append(f"Unknown location values: {bad_zones}. Expected: {VALID_ZONES}")

    # 4. pm25 range
    out_of_range = df[(df["pm25"] < PM25_MIN) | (df["pm25"] > PM25_MAX)]
    if len(out_of_range):
        warnings.append(f"{len(out_of_range)} PM2.5 values outside realistic range (0–500). Will be capped.")

    # 5. null check
    null_pct = df[REQUIRED_COLS].isnull().mean() * 100
    high_null = null_pct[null_pct > 30]
    if not high_null.empty:
        warnings.append(f"High null % in columns: {high_null.round(1).to_dict()}")

    # 6. duplicates
    dupes = df.duplicated(subset=["date","location"]).sum()
    if dupes:
        warnings.append(f"{dupes} duplicate date+location rows found. Will be dropped.")

    return len(errors) == 0, errors, warnings


def process_and_save(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["date"]     = pd.to_datetime(df["date"])
    df["month"]    = df["date"].dt.month
    df["year"]     = df["date"].dt.year
    df["day_of_week"] = df["date"].dt.dayofweek

    # cap and fill
    df["pm25"] = df["pm25"].clip(0, 500)
    for col in ["pm10","no2","co"]:
        if col in df.columns:
            df[col] = df.groupby("location")[col].transform(lambda x: x.fillna(x.median()))

    # drop duplicates
    df = df.drop_duplicates(subset=["date","location"])

    # AQI category
    df["aqi_category"] = df["pm25"].apply(who_category)

    df = df.sort_values(["location","date"]).reset_index(drop=True)
    df.to_csv(os.path.join(PROCESSED_DIR, "airquality_eswatini.csv"), index=False)
    return df


def show():
    require_access("Upload & Validate")
    st.title("📂 Upload & Validate Dataset")
    st.caption("Upload a CSV file containing air quality readings for Eswatini industrial zones.")

    # ── expected format ───────────────────────────────────────────────────────
    with st.expander("📋 Expected CSV Format"):
        sample = pd.DataFrame({
            "date":     ["2024-01-01","2024-01-02","2024-01-03"],
            "location": ["Matsapha","Simunye","Bhunya"],
            "pm25":     [18.5, 15.2, 12.1],
            "pm10":     [32.0, 27.5, 22.0],
            "no2":      [15.0, 12.0,  9.5],
            "co":       [0.50,  0.40,  0.30],
        })
        st.dataframe(sample, use_container_width=True)
        st.caption("Required columns: date, location, pm25, pm10, no2, co")
        st.caption("Valid locations: Matsapha, Simunye, Bhunya")

        # download sample
        csv_sample = sample.to_csv(index=False).encode()
        st.download_button("⬇️ Download Sample CSV", csv_sample,
                           "sample_airquality.csv", "text/csv")

    st.divider()

    # ── file upload ───────────────────────────────────────────────────────────
    uploaded = st.file_uploader("Choose a CSV file", type=["csv"])

    if uploaded is not None:
        try:
            df = pd.read_csv(uploaded)
        except Exception as e:
            st.error(f"Could not read file: {e}")
            return

        st.subheader("📄 File Preview")
        st.dataframe(df.head(10), use_container_width=True)
        st.caption(f"Rows: {len(df):,}   Columns: {list(df.columns)}")
        st.divider()

        # ── validation ────────────────────────────────────────────────────────
        st.subheader("🔍 Validation & Audit Report")
        valid, errors, warnings = validate(df)

        if errors:
            st.error("**Validation Failed — fix these errors before proceeding:**")
            for e in errors:
                st.markdown(f"- ❌ {e}")
            return

        st.success("✅ All required columns present and location values valid.")

        if warnings:
            st.warning("**Warnings (will be handled automatically):**")
            for w in warnings:
                st.markdown(f"- ⚠️ {w}")
        else:
            st.success("✅ No warnings. Data looks clean.")

        # ── column stats ──────────────────────────────────────────────────────
        st.subheader("📊 Data Quality Summary")
        stats = df[["pm25","pm10","no2","co"]].describe().round(2)
        st.dataframe(stats, use_container_width=True)

        null_summary = df[REQUIRED_COLS].isnull().sum().reset_index()
        null_summary.columns = ["Column","Null Count"]
        null_summary["Null %"] = (null_summary["Null Count"] / len(df) * 100).round(1)
        st.dataframe(null_summary, use_container_width=True)

        st.divider()

        # ── confirm and save ──────────────────────────────────────────────────
        st.subheader("✅ Confirm & Save")
        st.info("Clicking **Process & Save** will clean the data and save it as the active dataset for the system.")

        if st.button("Process & Save Dataset", type="primary"):
            with st.spinner("Processing..."):
                processed = process_and_save(df)
            st.success(f"Dataset saved. {len(processed):,} rows ready for analysis and prediction.")
            st.cache_data.clear()
            st.balloons()
"""
ingest.py
---------
Loads real air quality data from the Kaggle India dataset (city_day.csv),
selects 3 industrial cities that match Eswatini's pollution profile,
rescales values to match Eswatini's WHO-reported baseline (PM2.5 ~17 ug/m3),
and relabels locations to Matsapha, Simunye, and Bhunya.

Target PM2.5 means (based on WHO/World Bank data cited in proposal):
  Matsapha : ~19  ug/m3  (heaviest - manufacturing hub)
  Simunye  : ~16  ug/m3  (mid      - agro-processing)
  Bhunya   : ~14  ug/m3  (lowest   - paper mill, rural)

Output: data/processed/airquality_eswatini.csv
"""

import pandas as pd
import numpy as np
import os

# ── paths ─────────────────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW_FILE      = os.path.join(BASE_DIR, "data", "raw", "city_day.csv")
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
OUTPUT_FILE   = os.path.join(PROCESSED_DIR, "airquality_eswatini.csv")
os.makedirs(PROCESSED_DIR, exist_ok=True)

# ── city mapping ──────────────────────────────────────────────────────────────
# Scale factors tuned so PM2.5 means land near Eswatini targets above
CITY_MAP = {
    "Ahmedabad": {"zone": "Matsapha", "scale": 0.28},
    "Lucknow":   {"zone": "Simunye",  "scale": 0.14},
    "Shillong":  {"zone": "Bhunya",   "scale": 0.52},
}

# PM2.5 caps per zone — no single reading should exceed these realistically
PM25_CAP = {
    "Matsapha": 60.0,
    "Simunye":  50.0,
    "Bhunya":   40.0,
}

KEEP_COLS = ["City", "Date", "PM2.5", "PM10", "NO2", "CO", "AQI", "AQI_Bucket"]


def load_and_adapt() -> pd.DataFrame:
    print(f"Loading {RAW_FILE} ...")
    raw = pd.read_csv(RAW_FILE, parse_dates=["Date"])

    cities = list(CITY_MAP.keys())
    df = raw[raw["City"].isin(cities)][KEEP_COLS].copy()
    print(f"  Rows after city filter  : {len(df):,}")

    df = df.dropna(subset=["PM2.5"])
    print(f"  Rows after PM2.5 dropna : {len(df):,}")

    frames = []
    for indian_city, meta in CITY_MAP.items():
        chunk = df[df["City"] == indian_city].copy()
        s     = meta["scale"]
        zone  = meta["zone"]
        cap   = PM25_CAP[zone]

        # rescale
        chunk["PM2.5"] = (chunk["PM2.5"] * s).round(2)
        chunk["PM10"]  = (chunk["PM10"]  * s).round(2)
        chunk["NO2"]   = (chunk["NO2"]   * s).round(2)
        chunk["CO"]    = (chunk["CO"]    * s).round(3)

        # cap outliers — clip anything above the zone cap
        chunk["PM2.5"] = chunk["PM2.5"].clip(upper=cap)
        chunk["PM10"]  = chunk["PM10"].clip(upper=cap * 2)

        # enforce realistic minimum (air never perfectly clean)
        chunk["PM2.5"] = chunk["PM2.5"].clip(lower=2.0)
        chunk["PM10"]  = chunk["PM10"].clip(lower=4.0)
        chunk["NO2"]   = chunk["NO2"].clip(lower=1.0)
        chunk["CO"]    = chunk["CO"].clip(lower=0.05)

        chunk["location"] = zone
        frames.append(chunk)

    df = pd.concat(frames, ignore_index=True)

    # ── rename columns ────────────────────────────────────────────────────────
    df = df.rename(columns={
        "Date":       "date",
        "PM2.5":      "pm25",
        "PM10":       "pm10",
        "NO2":        "no2",
        "CO":         "co",
        "AQI":        "aqi",
        "AQI_Bucket": "aqi_category",
    })

    # ── time features ─────────────────────────────────────────────────────────
    df["month"]       = df["date"].dt.month
    df["year"]        = df["date"].dt.year
    df["day_of_week"] = df["date"].dt.dayofweek

    # ── reclassify using WHO PM2.5 bands ─────────────────────────────────────
    def who_category(pm25):
        if pd.isna(pm25):  return "Unknown"
        if pm25 <= 10:     return "Good"
        elif pm25 <= 25:   return "Moderate"
        elif pm25 <= 50:   return "Unhealthy"
        else:              return "Hazardous"

    df["aqi_category"] = df["pm25"].apply(who_category)

    # ── fill nulls with zone median ───────────────────────────────────────────
    for col in ["pm10", "no2", "co"]:
        df[col] = df.groupby("location")[col].transform(
            lambda x: x.fillna(x.median())
        )

    df = df.drop(columns=["City"], errors="ignore")

    col_order = [
        "date", "month", "year", "day_of_week",
        "location", "pm25", "pm10", "no2", "co",
        "aqi", "aqi_category",
    ]
    df = df[[c for c in col_order if c in df.columns]]
    df = df.sort_values(["location", "date"]).reset_index(drop=True)

    return df


def main():
    print("=" * 55)
    print("  AirWatch Eswatini — Data Ingestion")
    print("=" * 55)

    df = load_and_adapt()
    df.to_csv(OUTPUT_FILE, index=False)

    print(f"\n  Final rows   : {len(df):,}")
    print(f"  Final columns: {list(df.columns)}")
    print(f"  Saved to     : {OUTPUT_FILE}")

    print("\nPM2.5 summary by zone:")
    print(df.groupby("location")["pm25"].describe().round(2).to_string())

    print("\nAQI category distribution:")
    print(df["aqi_category"].value_counts().to_string())

    print("\nSample rows:")
    print(df.head(6).to_string(index=False))

    print("\nDone. Run preprocess.py next.")


if __name__ == "__main__":
    main()
"""
preprocess.py
-------------
Reads data/processed/airquality_eswatini.csv and prepares it for ML:

  1. Adds lag features  (pm25 from 1, 3, 7 days ago)
  2. Adds rolling means (7-day and 30-day window)
  3. Encodes location   (one-hot)
  4. Encodes season     (derived from month)
  5. Scales features    (StandardScaler — needed for SVR)
  6. Splits into train / test sets (80/20, time-based)
  7. Saves everything to data/processed/

Run: python src/preprocess.py
"""

import pandas as pd
import numpy as np
import os
import joblib
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split

# ── paths ─────────────────────────────────────────────────────────────────────
BASE_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
MODELS_DIR    = os.path.join(BASE_DIR, "models")
INPUT_FILE    = os.path.join(PROCESSED_DIR, "airquality_eswatini.csv")
os.makedirs(MODELS_DIR, exist_ok=True)


# ── season encoder ────────────────────────────────────────────────────────────
def get_season(month: int) -> str:
    """
    Eswatini seasons:
      Dry   (May–Sep)  → more biomass burning, higher pollution
      Wet   (Oct–Apr)  → rain clears the air
    """
    return "dry" if month in [5, 6, 7, 8, 9] else "wet"


# ── lag & rolling features ────────────────────────────────────────────────────
def add_lag_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    For each zone separately, add:
      - pm25_lag1  : PM2.5 value 1 day ago
      - pm25_lag3  : PM2.5 value 3 days ago
      - pm25_lag7  : PM2.5 value 7 days ago
      - pm25_roll7 : 7-day rolling average
      - pm25_roll30: 30-day rolling average

    Why lags? Yesterday's PM2.5 is the strongest single predictor of today's.
    """
    frames = []
    for zone in df["location"].unique():
        chunk = df[df["location"] == zone].copy().sort_values("date")

        chunk["pm25_lag1"]   = chunk["pm25"].shift(1)
        chunk["pm25_lag3"]   = chunk["pm25"].shift(3)
        chunk["pm25_lag7"]   = chunk["pm25"].shift(7)
        chunk["pm25_roll7"]  = chunk["pm25"].shift(1).rolling(7).mean()
        chunk["pm25_roll30"] = chunk["pm25"].shift(1).rolling(30).mean()

        frames.append(chunk)

    return pd.concat(frames, ignore_index=True)


# ── main ──────────────────────────────────────────────────────────────────────
def main():
    print("=" * 55)
    print("  AirWatch Eswatini — Preprocessing")
    print("=" * 55)

    # ── load ──────────────────────────────────────────────────────────────────
    print(f"\nLoading {INPUT_FILE} ...")
    df = pd.read_csv(INPUT_FILE, parse_dates=["date"])
    print(f"  Rows loaded: {len(df):,}")

    # ── season feature ────────────────────────────────────────────────────────
    df["season"] = df["month"].apply(get_season)

    # ── lag & rolling features ────────────────────────────────────────────────
    print("  Adding lag and rolling features...")
    df = add_lag_features(df)

    # drop rows where lags are NaN (first 30 days per zone)
    before = len(df)
    df = df.dropna(subset=["pm25_lag1", "pm25_lag3", "pm25_lag7",
                            "pm25_roll7", "pm25_roll30"])
    print(f"  Dropped {before - len(df)} rows (lag warmup) → {len(df):,} remain")

    # ── encode location (one-hot) ─────────────────────────────────────────────
    df = pd.get_dummies(df, columns=["location"], prefix="loc", dtype=int)

    # ── encode season (binary) ────────────────────────────────────────────────
    df["is_dry_season"] = (df["season"] == "dry").astype(int)
    df = df.drop(columns=["season"])

    # ── define features (X) and target (y) ───────────────────────────────────
    DROP_COLS = ["date", "aqi", "aqi_category", "pm25"]
    feature_cols = [c for c in df.columns if c not in DROP_COLS]
    target_col   = "pm25"

    X = df[feature_cols]
    y = df[target_col]

    print(f"\n  Features ({len(feature_cols)}): {feature_cols}")
    print(f"  Target              : {target_col}")

    # ── time-based train/test split (80/20) ───────────────────────────────────
    # We sort by date so test set is always the most recent data
    # This is more realistic than random split for time-series
    df_sorted = df.sort_values("date").reset_index(drop=True)
    X_sorted  = df_sorted[feature_cols]
    y_sorted  = df_sorted[target_col]

    split_idx = int(len(df_sorted) * 0.80)
    X_train, X_test = X_sorted.iloc[:split_idx], X_sorted.iloc[split_idx:]
    y_train, y_test = y_sorted.iloc[:split_idx], y_sorted.iloc[split_idx:]

    print(f"\n  Train set : {len(X_train):,} rows")
    print(f"  Test set  : {len(X_test):,}  rows")

    # ── scale features ────────────────────────────────────────────────────────
    # SVR is sensitive to feature scale, RF is not — but we scale for both
    # so the same preprocessed data works for both models
    scaler  = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled  = scaler.transform(X_test)

    # convert back to DataFrames (keeps column names)
    X_train_scaled = pd.DataFrame(X_train_scaled, columns=feature_cols)
    X_test_scaled  = pd.DataFrame(X_test_scaled,  columns=feature_cols)

    # ── save everything ───────────────────────────────────────────────────────
    X_train_scaled.to_csv(os.path.join(PROCESSED_DIR, "X_train.csv"), index=False)
    X_test_scaled.to_csv( os.path.join(PROCESSED_DIR, "X_test.csv"),  index=False)
    y_train.to_csv(        os.path.join(PROCESSED_DIR, "y_train.csv"), index=False)
    y_test.to_csv(         os.path.join(PROCESSED_DIR, "y_test.csv"),  index=False)

    # save scaler and feature list — needed later for predictions
    joblib.dump(scaler,       os.path.join(MODELS_DIR, "scaler.pkl"))
    joblib.dump(feature_cols, os.path.join(MODELS_DIR, "feature_cols.pkl"))

    print("\n  Saved:")
    print(f"    data/processed/X_train.csv  ({len(X_train_scaled):,} rows)")
    print(f"    data/processed/X_test.csv   ({len(X_test_scaled):,} rows)")
    print(f"    data/processed/y_train.csv")
    print(f"    data/processed/y_test.csv")
    print(f"    models/scaler.pkl")
    print(f"    models/feature_cols.pkl")

    print("\nDone. Run train.py next.")


if __name__ == "__main__":
    main()
"""
predict.py
----------
Standalone prediction script for AirWatch Eswatini.
Can be used from the command line without the dashboard.

Usage:
  python src/predict.py --zone Matsapha --pm25 18.5 --pm10 32.0 --no2 15.0 --co 0.5
  python src/predict.py --zone Bhunya   --pm25 12.0 --pm10 22.0 --no2 10.0 --co 0.3 --days 3
"""

import argparse
import numpy as np
import pandas as pd
import os
import joblib
from datetime import date, timedelta

BASE_DIR     = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR   = os.path.join(BASE_DIR, "models")


def who_category(pm25: float) -> str:
    if pm25 <= 10:   return "Good      🟢"
    elif pm25 <= 25: return "Moderate  🟡"
    elif pm25 <= 50: return "Unhealthy 🟠"
    return "Hazardous 🔴"


def load_assets():
    required = ["best_model", "scaler", "imputer", "feature_cols"]
    assets   = {}
    for name in required:
        path = os.path.join(MODELS_DIR, f"{name}.pkl")
        if not os.path.exists(path):
            raise FileNotFoundError(f"Missing {path}. Run train.py first.")
        assets[name] = joblib.load(path)
    name_path = os.path.join(MODELS_DIR, "best_model_name.pkl")
    assets["model_name"] = joblib.load(name_path) if os.path.exists(name_path) else "Model"
    return assets


def predict_zone(zone, pm25, pm10, no2, co, days, assets):
    model        = assets["best_model"]
    scaler       = assets["scaler"]
    imputer      = assets["imputer"]
    feature_cols = assets["feature_cols"]

    history   = [pm25] * 30
    forecasts = []
    today     = date.today()

    for d in range(1, days + 1):
        td = today + timedelta(days=d)
        row = {
            "month": td.month, "year": td.year, "day_of_week": td.weekday(),
            "pm10": pm10, "no2": no2, "co": co,
            "pm25_lag1":   history[-1],
            "pm25_lag3":   history[-3],
            "pm25_lag7":   history[-7],
            "pm25_roll7":  np.mean(history[-7:]),
            "pm25_roll30": np.mean(history[-30:]),
            "loc_Bhunya":   int(zone == "Bhunya"),
            "loc_Matsapha": int(zone == "Matsapha"),
            "loc_Simunye":  int(zone == "Simunye"),
            "is_dry_season": int(td.month in [5, 6, 7, 8, 9]),
        }
        X  = pd.DataFrame([row])[feature_cols]
        Xi = pd.DataFrame(imputer.transform(X), columns=feature_cols)
        Xs = pd.DataFrame(scaler.transform(Xi), columns=feature_cols)
        p  = max(round(float(model.predict(Xs)[0]), 2), 2.0)
        history.append(p)
        forecasts.append({
            "Date":     td.strftime("%Y-%m-%d"),
            "Day":      td.strftime("%A"),
            "PM2.5":    p,
            "Category": who_category(p),
        })

    return forecasts


def main():
    parser = argparse.ArgumentParser(description="AirWatch Eswatini — PM2.5 Predictor")
    parser.add_argument("--zone",  required=True, choices=["Matsapha","Simunye","Bhunya"])
    parser.add_argument("--pm25",  type=float, required=True, help="Current PM2.5 (µg/m³)")
    parser.add_argument("--pm10",  type=float, required=True, help="Current PM10 (µg/m³)")
    parser.add_argument("--no2",   type=float, required=True, help="Current NO2 (µg/m³)")
    parser.add_argument("--co",    type=float, required=True, help="Current CO (mg/m³)")
    parser.add_argument("--days",  type=int, default=7, help="Days to forecast (default: 7)")
    args = parser.parse_args()

    assets = load_assets()

    print("=" * 55)
    print(f"  AirWatch Eswatini — {args.days}-Day PM2.5 Forecast")
    print("=" * 55)
    print(f"  Zone   : {args.zone}")
    print(f"  Model  : {assets['model_name']}")
    print(f"  Inputs : PM2.5={args.pm25}, PM10={args.pm10}, NO2={args.no2}, CO={args.co}")
    print()

    forecasts = predict_zone(
        args.zone, args.pm25, args.pm10, args.no2, args.co, args.days, assets
    )

    print(f"  {'Date':<13} {'Day':<12} {'PM2.5':>8}  Category")
    print(f"  {'-'*13} {'-'*12} {'-'*8}  {'-'*18}")
    for f in forecasts:
        flag = " ⚠️" if f["PM2.5"] > 25 else ""
        print(f"  {f['Date']:<13} {f['Day']:<12} {f['PM2.5']:>7.2f}  {f['Category']}{flag}")

    peak = max(forecasts, key=lambda x: x["PM2.5"])
    print()
    print(f"  WHO safe limit : 10 µg/m³")
    print(f"  Peak forecast  : {peak['PM2.5']} µg/m³ on {peak['Day']} {peak['Date']}")

    if peak["PM2.5"] > 25:
        print("  ⚠️  Warning: Unhealthy levels forecast. Notify stakeholders.")
    elif peak["PM2.5"] > 10:
        print("  ℹ️  Moderate levels — above WHO guideline but manageable.")
    else:
        print("  ✅  Good air quality forecast for this period.")


if __name__ == "__main__":
    main()
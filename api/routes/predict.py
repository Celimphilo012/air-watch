"""
routes/predict.py — Prediction endpoint
"""
from flask import Blueprint, request, jsonify, session
from api.db import get_connection
import numpy as np
import pandas as pd
import joblib, os
from datetime import date, timedelta

predict_bp = Blueprint("predict", __name__)
BASE_DIR   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(BASE_DIR, "models")

def load_assets():
    assets = {}
    for n in ["best_model","scaler","imputer","feature_cols","best_model_name"]:
        p = os.path.join(MODELS_DIR, f"{n}.pkl")
        if os.path.exists(p):
            assets[n] = joblib.load(p)
    return assets

def who_cat(v):
    if v <= 10:  return "Good"
    elif v <= 25: return "Moderate"
    elif v <= 50: return "Unhealthy"
    return "Hazardous"

@predict_bp.route("/api/predict", methods=["POST"])
def predict():
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    data     = request.get_json()
    zone     = data.get("zone", "Matsapha")
    pm25     = float(data.get("pm25", 18.0))
    pm10     = float(data.get("pm10", 32.0))
    no2      = float(data.get("no2",  15.0))
    co       = float(data.get("co",    0.5))
    days     = int(data.get("days",    7))
    start_dt = date.today()

    try:
        assets       = load_assets()
        model        = assets["best_model"]
        scaler       = assets["scaler"]
        imputer      = assets["imputer"]
        feature_cols = assets["feature_cols"]
        model_name   = assets.get("best_model_name","Model")
    except Exception as e:
        return jsonify({"error": f"Model load failed: {e}"}), 500

    history   = [pm25] * 30
    forecasts = []

    for d in range(1, days + 1):
        td = start_dt + timedelta(days=d)
        row = {
            "month": td.month, "year": td.year, "day_of_week": td.weekday(),
            "pm10": pm10, "no2": no2, "co": co,
            "pm25_lag1":   history[-1],
            "pm25_lag3":   history[-3],
            "pm25_lag7":   history[-7],
            "pm25_roll7":  float(np.mean(history[-7:])),
            "pm25_roll30": float(np.mean(history[-30:])),
            "loc_Bhunya":   int(zone == "Bhunya"),
            "loc_Matsapha": int(zone == "Matsapha"),
            "loc_Simunye":  int(zone == "Simunye"),
            "is_dry_season": int(td.month in [5,6,7,8,9]),
        }
        X  = pd.DataFrame([row])[feature_cols]
        Xi = pd.DataFrame(imputer.transform(X), columns=feature_cols)
        Xs = pd.DataFrame(scaler.transform(Xi), columns=feature_cols)
        p  = max(round(float(model.predict(Xs.values)[0]), 2), 2.0)
        history.append(p)
        forecasts.append({
            "date":     td.strftime("%Y-%m-%d"),
            "day":      td.strftime("%A"),
            "pm25":     p,
            "category": who_cat(p),
        })

    # save to db
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            for f in forecasts:
                cur.execute("""
                    INSERT INTO predictions
                    (zone, forecast_date, predicted_pm25, category, model_used, created_by)
                    VALUES (%s,%s,%s,%s,%s,%s)
                """, (zone, f["date"], f["pm25"], f["category"],
                      model_name, session["username"]))
        conn.commit()
        conn.close()
    except Exception:
        pass  # don't fail if db save fails

    return jsonify({"zone": zone, "model": model_name, "forecasts": forecasts})
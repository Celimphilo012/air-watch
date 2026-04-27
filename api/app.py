"""
app.py — AirWatch Eswatini Flask API
Run: python api/app.py  (from the project root)
"""
import sys, os
# Ensure the project root is on sys.path so `from api.routes.*` resolves
# regardless of which directory the script is launched from.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
app.secret_key = "airwatch-eswatini-secret-2024"
CORS(app, supports_credentials=True, origins=["http://localhost:5173"])

from api.routes.auth    import auth_bp
from api.routes.data    import data_bp
from api.routes.predict import predict_bp
from api.routes.users   import users_bp
from api.routes.zones   import zones_bp

app.register_blueprint(auth_bp)
app.register_blueprint(data_bp)
app.register_blueprint(predict_bp)
app.register_blueprint(users_bp)
app.register_blueprint(zones_bp)

@app.route("/api/health")
def health():
    return {"status": "ok", "app": "AirWatch Eswatini API"}

@app.route("/api/train", methods=["POST"])
def train():
    from flask import request, session, jsonify
    import os, joblib
    import pandas as pd
    import numpy as np
    from sklearn.ensemble import RandomForestRegressor
    from sklearn.svm import SVR
    from sklearn.impute import SimpleImputer
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get("role") not in ["environmental_officer", "admin"]:
        return jsonify({"error": "Access denied"}), 403

    BASE_DIR      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    PROCESSED_DIR = os.path.join(BASE_DIR, "data", "processed")
    MODELS_DIR    = os.path.join(BASE_DIR, "models")
    os.makedirs(MODELS_DIR, exist_ok=True)

    data_file = os.path.join(PROCESSED_DIR, "airquality_eswatini.csv")
    if not os.path.exists(data_file):
        return jsonify({"error": "No dataset found. Upload a dataset first."}), 400

    p = request.get_json() or {}
    n_estimators = int(p.get("n_estimators", 200))
    max_depth    = int(p.get("max_depth", 12))
    min_samples  = int(p.get("min_samples", 4))
    C            = float(p.get("C", 100))
    epsilon      = float(p.get("epsilon", 0.5))
    kernel       = str(p.get("kernel", "rbf"))

    try:
        # ── preprocess ────────────────────────────────────────────────────────
        df = pd.read_csv(data_file, parse_dates=["date"])
        df["month"]       = df["date"].dt.month
        df["year"]        = df["date"].dt.year
        df["day_of_week"] = df["date"].dt.dayofweek

        for col in ["pm10", "no2", "co"]:
            if col not in df.columns:
                df[col] = np.nan

        # lag features computed per zone to avoid cross-zone leakage
        frames = []
        for zone in df["location"].unique():
            chunk = df[df["location"] == zone].copy().sort_values("date")
            chunk["pm25_lag1"]   = chunk["pm25"].shift(1)
            chunk["pm25_lag3"]   = chunk["pm25"].shift(3)
            chunk["pm25_lag7"]   = chunk["pm25"].shift(7)
            chunk["pm25_roll7"]  = chunk["pm25"].shift(1).rolling(7).mean()
            chunk["pm25_roll30"] = chunk["pm25"].shift(1).rolling(30).mean()
            frames.append(chunk)
        df = pd.concat(frames, ignore_index=True)
        df = df.dropna(subset=["pm25_lag1", "pm25_lag3", "pm25_lag7",
                                "pm25_roll7", "pm25_roll30"])

        df = pd.get_dummies(df, columns=["location"], prefix="loc", dtype=int)
        df["is_dry_season"] = df["month"].apply(lambda m: 1 if m in [5,6,7,8,9] else 0)

        DROP = {"date", "aqi", "aqi_category", "pm25", "season",
                "aqi_bucket", "year_x", "month_x"}
        feature_cols = [c for c in df.columns if c not in DROP and c != "pm25"]
        # ensure loc columns for all three zones exist even if one is absent
        for loc_col in ["loc_Matsapha", "loc_Simunye", "loc_Bhunya"]:
            if loc_col not in df.columns:
                df[loc_col] = 0
                feature_cols.append(loc_col)

        X = df[feature_cols]
        y = df["pm25"]

        df_s = df.sort_values("date").reset_index(drop=True)
        split = int(len(df_s) * 0.80)
        X_train = df_s[feature_cols].iloc[:split]
        X_test  = df_s[feature_cols].iloc[split:]
        y_train = df_s["pm25"].iloc[:split]
        y_test  = df_s["pm25"].iloc[split:]

        imputer    = SimpleImputer(strategy="median")
        X_tr_imp   = imputer.fit_transform(X_train)
        X_te_imp   = imputer.transform(X_test)

        scaler     = StandardScaler()
        X_tr_sc    = scaler.fit_transform(X_tr_imp)
        X_te_sc    = scaler.transform(X_te_imp)

        def metrics(y_true, y_pred):
            return {
                "MAE":  round(float(mean_absolute_error(y_true, y_pred)), 3),
                "RMSE": round(float(np.sqrt(mean_squared_error(y_true, y_pred))), 3),
                "R2":   round(float(r2_score(y_true, y_pred)), 4),
            }

        # ── Random Forest (trained on scaled for consistency with predict) ────
        rf = RandomForestRegressor(
            n_estimators=n_estimators, max_depth=max_depth,
            min_samples_leaf=min_samples, random_state=42, n_jobs=-1,
        )
        rf.fit(X_tr_sc, y_train)
        rf_preds = rf.predict(X_te_sc)
        rf_res   = {"model": "Random Forest", **metrics(y_test, rf_preds)}

        # ── SVR ───────────────────────────────────────────────────────────────
        svr = SVR(kernel=kernel, C=C, epsilon=epsilon, gamma="scale")
        svr.fit(X_tr_sc, y_train)
        svr_preds = svr.predict(X_te_sc)
        svr_res   = {"model": "SVR", **metrics(y_test, svr_preds)}

        results_df = pd.DataFrame([rf_res, svr_res])
        best_name  = results_df.loc[results_df["R2"].idxmax(), "model"]
        best_model = rf if best_name == "Random Forest" else svr

        # ── save artifacts ────────────────────────────────────────────────────
        joblib.dump(rf,           os.path.join(MODELS_DIR, "random_forest.pkl"))
        joblib.dump(svr,          os.path.join(MODELS_DIR, "svr.pkl"))
        joblib.dump(best_model,   os.path.join(MODELS_DIR, "best_model.pkl"))
        joblib.dump(best_name,    os.path.join(MODELS_DIR, "best_model_name.pkl"))
        joblib.dump(imputer,      os.path.join(MODELS_DIR, "imputer.pkl"))
        joblib.dump(scaler,       os.path.join(MODELS_DIR, "scaler.pkl"))
        joblib.dump(feature_cols, os.path.join(MODELS_DIR, "feature_cols.pkl"))
        results_df.to_csv(os.path.join(MODELS_DIR, "model_results.csv"), index=False)
        pd.DataFrame({"y_true": y_test.values,
                      "rf_pred": rf_preds, "svr_pred": svr_preds}) \
          .to_csv(os.path.join(MODELS_DIR, "test_predictions.csv"), index=False)
        pd.Series(rf.feature_importances_, index=feature_cols) \
          .sort_values(ascending=False) \
          .reset_index() \
          .rename(columns={"index": "feature", 0: "importance"}) \
          .to_csv(os.path.join(MODELS_DIR, "feature_importances.csv"), index=False)

        pd.DataFrame(X_tr_sc, columns=feature_cols) \
          .to_csv(os.path.join(PROCESSED_DIR, "X_train.csv"), index=False)
        pd.DataFrame(X_te_sc, columns=feature_cols) \
          .to_csv(os.path.join(PROCESSED_DIR, "X_test.csv"), index=False)
        y_train.to_csv(os.path.join(PROCESSED_DIR, "y_train.csv"), index=False)
        y_test.to_csv( os.path.join(PROCESSED_DIR, "y_test.csv"),  index=False)

        return jsonify({
            "best_model": best_name,
            "rf_mae": rf_res["MAE"],   "rf_r2": rf_res["R2"],
            "svr_mae": svr_res["MAE"], "svr_r2": svr_res["R2"],
        })

    except Exception as e:
        import traceback
        return jsonify({"error": str(e), "detail": traceback.format_exc()}), 500


# email notification route
@app.route("/api/notify", methods=["POST"])
def notify():
    from flask import request, session, jsonify
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401

    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    data       = request.get_json()
    sender     = data.get("senderEmail","")
    password   = data.get("appPassword","")
    recipients = data.get("recipients",[])
    subject    = data.get("subject","Air Quality Alert")
    forecasts  = data.get("forecasts",[])
    zone       = data.get("zone","")

    if not sender or not password or not recipients:
        return jsonify({"error": "Email, password and recipients required"}), 400

    rows = "".join([
        f"<tr><td>{f['date']}</td><td>{f['day']}</td><td>{f['pm25']} µg/m³</td><td>{f['category']}</td></tr>"
        for f in forecasts
    ])
    body = f"""<html><body>
<h2>🌿 AirWatch Eswatini — Air Quality Alert</h2>
<p><strong>Zone:</strong> {zone}</p>
<table border="1" cellpadding="6" style="border-collapse:collapse">
<tr><th>Date</th><th>Day</th><th>PM2.5</th><th>Category</th></tr>
{rows}
</table>
<p>WHO PM2.5 safe limit: <strong>10 µg/m³</strong></p>
</body></html>"""

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = sender
        msg["To"]      = ", ".join(recipients)
        msg.attach(MIMEText(body, "html"))
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as s:
            s.login(sender, password)
            s.sendmail(sender, recipients, msg.as_string())
        return jsonify({"message": f"Sent to {len(recipients)} recipient(s)."})
    except smtplib.SMTPAuthenticationError:
        return jsonify({"error": "Gmail authentication failed. Check your App Password."}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500


if __name__ == "__main__":
    app.run(debug=True, port=5000)
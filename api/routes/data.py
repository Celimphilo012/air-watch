"""
routes/data.py — Air quality data endpoints
"""
from flask import Blueprint, request, jsonify, session
from api.db import get_connection
import pandas as pd
import os

data_bp  = Blueprint("data", __name__)
# data.py lives at api/routes/data.py — three dirname calls reach the project root
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def require_auth():
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    return None

@data_bp.route("/api/data/overview", methods=["GET"])
def overview():
    err = require_auth()
    if err: return err
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) as total FROM air_quality_data")
            total = cur.fetchone()["total"]
            cur.execute("SELECT AVG(pm25) as mean FROM air_quality_data")
            mean_pm25 = round(cur.fetchone()["mean"] or 0, 2)
            cur.execute("""
                SELECT location, AVG(pm25) as mean_pm25
                FROM air_quality_data GROUP BY location
                ORDER BY mean_pm25 DESC LIMIT 1
            """)
            worst = cur.fetchone()
            cur.execute("SELECT COUNT(*) as cnt FROM air_quality_data WHERE pm25 > 10")
            above = cur.fetchone()["cnt"]
        conn.close()
        pct_above = round(above / total * 100, 1) if total else 0
        return jsonify({
            "total_records":   total,
            "overall_pm25_mean": mean_pm25,
            "most_polluted_zone": worst["location"] if worst else "N/A",
            "pct_above_who":   pct_above,
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@data_bp.route("/api/data/zone-summary", methods=["GET"])
def zone_summary():
    err = require_auth()
    if err: return err
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT location,
                       COUNT(*)    as records,
                       AVG(pm25)   as mean_pm25,
                       MAX(pm25)   as max_pm25,
                       MIN(pm25)   as min_pm25,
                       AVG(pm10)   as mean_pm10,
                       AVG(no2)    as mean_no2,
                       SUM(CASE WHEN pm25 > 10 THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as pct_above_who
                FROM air_quality_data
                GROUP BY location
            """)
            rows = cur.fetchall()
        conn.close()
        for r in rows:
            for k in ["mean_pm25","max_pm25","min_pm25","mean_pm10","mean_no2","pct_above_who"]:
                if r[k] is not None: r[k] = round(float(r[k]), 2)
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@data_bp.route("/api/data/aqi-distribution", methods=["GET"])
def aqi_distribution():
    err = require_auth()
    if err: return err
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT aqi_category as category, COUNT(*) as count
                FROM air_quality_data
                WHERE aqi_category IS NOT NULL
                GROUP BY aqi_category
            """)
            rows = cur.fetchall()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@data_bp.route("/api/data/monthly-heatmap", methods=["GET"])
def monthly_heatmap():
    err = require_auth()
    if err: return err
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("""
                SELECT location, month, ROUND(AVG(pm25),2) as avg_pm25
                FROM air_quality_data
                GROUP BY location, month
                ORDER BY location, month
            """)
            rows = cur.fetchall()
        conn.close()
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@data_bp.route("/api/data/trends", methods=["GET"])
def trends():
    err = require_auth()
    if err: return err
    location = request.args.get("location", "all")
    pollutant = request.args.get("pollutant", "pm25")
    allowed   = ["pm25","pm10","no2","co"]
    if pollutant not in allowed:
        pollutant = "pm25"
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            if location == "all":
                cur.execute(f"""
                    SELECT date, location, ROUND(AVG({pollutant}),2) as value
                    FROM air_quality_data
                    GROUP BY date, location ORDER BY date
                """)
            else:
                cur.execute(f"""
                    SELECT date, location, ROUND(AVG({pollutant}),2) as value
                    FROM air_quality_data WHERE location = %s
                    GROUP BY date, location ORDER BY date
                """, (location,))
            rows = cur.fetchall()
        conn.close()
        for r in rows:
            if r.get("date"):
                r["date"] = str(r["date"])
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

COLUMN_ALIASES = {
    "city":      "location",
    "pm2.5":     "pm25",
    "aqi_bucket": "aqi_category",
    "datetime":  "date",
}

def _normalize_columns(df):
    df.columns = [c.strip().lower() for c in df.columns]
    return df.rename(columns=COLUMN_ALIASES)

@data_bp.route("/api/data/upload", methods=["POST"])
def upload():
    err = require_auth()
    if err: return err
    if session.get("role") not in ["environmental_officer","admin"]:
        return jsonify({"error": "Access denied"}), 403

    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    try:
        df = pd.read_csv(file, sep=None, engine="python", encoding_errors="replace")
    except Exception as e:
        return jsonify({"error": f"Could not read CSV: {e}"}), 400

    df = _normalize_columns(df)

    required = ["date","location","pm25"]
    missing  = [c for c in required if c not in df.columns]
    if missing:
        return jsonify({"error": f"Missing columns: {missing}"}), 400

    # apply zone mapping if caller supplied one
    import json as _json
    zone_mapping_raw = request.form.get("zone_mapping", "")
    if zone_mapping_raw:
        try:
            zone_mapping = _json.loads(zone_mapping_raw)
            df["location"] = df["location"].map(
                lambda v: zone_mapping.get(str(v), v)
            )
        except Exception:
            pass

    _conn = get_connection()
    with _conn.cursor() as _cur:
        _cur.execute("SELECT name FROM zones")
        valid_zones = [r["name"] for r in _cur.fetchall()]
    _conn.close()
    if not valid_zones:
        valid_zones = ["Matsapha", "Simunye", "Bhunya"]
    bad_zones = df[~df["location"].isin(valid_zones)]["location"].unique().tolist()
    if bad_zones:
        return jsonify({"error": f"Invalid locations: {bad_zones}. Use zone_mapping to assign them to one of: {valid_zones}."}), 400

    # drop rows where pm25 is missing — can't train or categorise without it
    df = df.dropna(subset=["pm25"])

    dates = pd.to_datetime(df["date"])
    df["date"]        = dates.dt.date
    df["month"]       = dates.dt.month
    df["year"]        = dates.dt.year
    df["day_of_week"] = dates.dt.dayofweek
    df["pm25"]        = df["pm25"].clip(0, 500)

    # aggregate hourly → daily (multiple readings per day get averaged)
    num_cols = ["pm25", "pm10", "no2", "co"]
    for col in num_cols:
        if col not in df.columns:
            df[col] = None
    grp = df.groupby(["date", "location"])
    agg = grp[num_cols].mean().reset_index()
    meta = df[["date", "location", "month", "year", "day_of_week"]].drop_duplicates(subset=["date", "location"])
    df = agg.merge(meta, on=["date", "location"], how="left")

    def who_cat(v):
        if v <= 10:  return "Good"
        elif v <= 25: return "Moderate"
        elif v <= 50: return "Unhealthy"
        return "Hazardous"

    df["aqi_category"] = df["pm25"].apply(who_cat)

    for col in ["pm10", "no2", "co"]:
        if col not in df.columns:
            df[col] = None

    def _f(val):
        """Convert to float, return None for NaN/None."""
        try:
            f = float(val)
            return None if f != f else f  # NaN check: NaN != NaN
        except (TypeError, ValueError):
            return None

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM air_quality_data")
            for _, row in df.iterrows():
                cur.execute("""
                    INSERT INTO air_quality_data
                    (date,month,year,day_of_week,location,pm25,pm10,no2,co,aqi_category)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """, (
                    row["date"], int(row["month"]), int(row["year"]),
                    int(row["day_of_week"]), row["location"],
                    _f(row["pm25"]),
                    _f(row.get("pm10")),
                    _f(row.get("no2")),
                    _f(row.get("co")),
                    row["aqi_category"],
                ))
        conn.commit()
        conn.close()
        # also save processed CSV for ML pipeline
        out = os.path.join(BASE_DIR,"data","processed","airquality_eswatini.csv")
        os.makedirs(os.path.dirname(out), exist_ok=True)
        df.to_csv(out, index=False)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    return jsonify({"message": f"{len(df):,} rows imported successfully."})


@data_bp.route("/api/model/results", methods=["GET"])
def model_results():
    err = require_auth()
    if err: return err
    import pandas as pd
    MODELS_DIR = os.path.join(BASE_DIR, "models")
    rp  = os.path.join(MODELS_DIR, "model_results.csv")
    pp  = os.path.join(MODELS_DIR, "test_predictions.csv")
    fip = os.path.join(MODELS_DIR, "feature_importances.csv")
    if not os.path.exists(rp):
        return jsonify({"error": "No model results found"}), 404
    res  = pd.read_csv(rp).to_dict(orient="records")
    pred = pd.read_csv(pp).to_dict(orient="records") if os.path.exists(pp) else []
    fi   = pd.read_csv(fip).head(12).to_dict(orient="records") if os.path.exists(fip) else []
    return jsonify({"results": res, "predictions": pred, "feature_importances": fi})
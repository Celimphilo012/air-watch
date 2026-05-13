"""
routes/history.py — Training history and model rollback
"""
import os, shutil
from flask import Blueprint, jsonify, session, request
from api.db import get_connection
from api.routes.audit import log_action

history_bp = Blueprint("history", __name__)

BASE_DIR   = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
MODELS_DIR = os.path.join(BASE_DIR, "models")

MODEL_FILES = [
    "best_model.pkl", "best_model_name.pkl", "random_forest.pkl", "svr.pkl",
    "imputer.pkl", "scaler.pkl", "feature_cols.pkl",
    "model_results.csv", "test_predictions.csv", "train_metrics.csv",
    "feature_importances.csv",
]


@history_bp.route("/api/model/history", methods=["GET"])
def get_history():
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM training_history ORDER BY trained_at DESC")
            rows = cur.fetchall()
        conn.close()
        # Convert datetime to string for JSON serialisation
        for r in rows:
            if r.get("trained_at"):
                r["trained_at"] = r["trained_at"].strftime("%Y-%m-%d %H:%M:%S")
        return jsonify({"history": rows})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@history_bp.route("/api/model/rollback/<run_id>", methods=["POST"])
def rollback(run_id):
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get("role") not in ["environmental_officer", "admin"]:
        return jsonify({"error": "Access denied"}), 403
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT model_dir FROM training_history WHERE run_id = %s", (run_id,)
            )
            row = cur.fetchone()

        if not row:
            conn.close()
            return jsonify({"error": "Run not found"}), 404

        model_dir = row["model_dir"]
        if not os.path.isdir(model_dir):
            conn.close()
            return jsonify({"error": "Model files not found on disk"}), 404

        for fname in MODEL_FILES:
            src = os.path.join(model_dir, fname)
            dst = os.path.join(MODELS_DIR, fname)
            if os.path.exists(src):
                shutil.copy2(src, dst)

        with conn.cursor() as cur:
            cur.execute("UPDATE training_history SET is_active = 0")
            cur.execute(
                "UPDATE training_history SET is_active = 1 WHERE run_id = %s", (run_id,)
            )
            conn.commit()
        conn.close()

        log_action("MODEL_ROLLBACK", f"run_id={run_id}")
        return jsonify({"message": f"Rolled back to {run_id}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@history_bp.route("/api/model/history/<run_id>", methods=["DELETE"])
def delete_run(run_id):
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT model_dir, is_active FROM training_history WHERE run_id = %s",
                (run_id,),
            )
            row = cur.fetchone()

        if not row:
            conn.close()
            return jsonify({"error": "Run not found"}), 404
        if row["is_active"]:
            conn.close()
            return jsonify({"error": "Cannot delete the currently active run"}), 400

        model_dir = row["model_dir"]
        if model_dir and os.path.isdir(model_dir):
            shutil.rmtree(model_dir)

        with conn.cursor() as cur:
            cur.execute("DELETE FROM training_history WHERE run_id = %s", (run_id,))
            conn.commit()
        conn.close()

        log_action("MODEL_HISTORY_DELETE", f"run_id={run_id}")
        return jsonify({"message": f"Deleted run {run_id}"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

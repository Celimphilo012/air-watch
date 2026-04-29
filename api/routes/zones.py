"""
routes/zones.py — Industrial zones CRUD (admin-only for write operations)
"""
from flask import Blueprint, request, jsonify, session
from api.db import get_connection
from api.routes.audit import log_action

zones_bp = Blueprint("zones", __name__)


def _require_auth():
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    return None


def _require_admin():
    err = _require_auth()
    if err:
        return err
    if session.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    return None


@zones_bp.route("/api/zones", methods=["GET"])
def list_zones():
    err = _require_auth()
    if err:
        return err
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id, name, created_at FROM zones ORDER BY name")
            rows = cur.fetchall()
        conn.close()
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = str(r["created_at"])
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@zones_bp.route("/api/zones", methods=["POST"])
def add_zone():
    err = _require_admin()
    if err:
        return err
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Zone name is required"}), 400
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("INSERT INTO zones (name) VALUES (%s)", (name,))
        conn.commit()
        conn.close()
        log_action("ZONE_ADD", f"name={name}")
        return jsonify({"message": f"Zone '{name}' added successfully."})
    except Exception as e:
        msg = str(e)
        if "Duplicate entry" in msg or "1062" in msg:
            return jsonify({"error": f"Zone '{name}' already exists."}), 409
        return jsonify({"error": msg}), 500


@zones_bp.route("/api/zones/<int:zone_id>", methods=["DELETE"])
def delete_zone(zone_id):
    err = _require_admin()
    if err:
        return err
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT name FROM zones WHERE id = %s", (zone_id,))
            row = cur.fetchone()
            if not row:
                conn.close()
                return jsonify({"error": "Zone not found"}), 404
            name = row["name"]
            cur.execute("SELECT COUNT(*) as cnt FROM zones")
            total = cur.fetchone()["cnt"]
            if total <= 1:
                conn.close()
                return jsonify({"error": "Cannot delete the last zone."}), 400
            cur.execute("DELETE FROM zones WHERE id = %s", (zone_id,))
        conn.commit()
        conn.close()
        log_action("ZONE_DELETE", f"name={name}")
        return jsonify({"message": f"Zone '{name}' removed."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

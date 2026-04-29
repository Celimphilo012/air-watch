"""
routes/config.py — System configuration (admin manage, users read safe keys)
"""
from flask import Blueprint, jsonify, session, request
from api.db import get_connection

config_bp = Blueprint("config", __name__)

SENSITIVE_KEYS = {"email_password"}


def _require_admin():
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    return None


def _get_all():
    conn = get_connection()
    with conn.cursor() as cur:
        cur.execute("SELECT `key`, value FROM system_config")
        rows = {r["key"]: r["value"] for r in cur.fetchall()}
    conn.close()
    return rows


@config_bp.route("/api/config", methods=["GET"])
def get_config():
    err = _require_admin()
    if err: return err
    try:
        return jsonify(_get_all())
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@config_bp.route("/api/config", methods=["PUT"])
def update_config():
    err = _require_admin()
    if err: return err
    data = request.get_json() or {}
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            for key, value in data.items():
                cur.execute(
                    "INSERT INTO system_config (`key`, value) VALUES (%s, %s) "
                    "ON DUPLICATE KEY UPDATE value = VALUES(value)",
                    (key, str(value) if value is not None else ""),
                )
        conn.commit()
        conn.close()
        from api.routes.audit import log_action
        log_action("CONFIG_UPDATE", f"keys={list(data.keys())}")
        return jsonify({"message": "Configuration saved."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@config_bp.route("/api/config/email", methods=["GET"])
def get_email_config():
    """Return saved email credentials — available to any authenticated user."""
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT `key`, value FROM system_config "
                "WHERE `key` IN ('email_sender', 'email_password', 'email_recipients')"
            )
            rows = {r["key"]: r["value"] for r in cur.fetchall()}
        conn.close()
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@config_bp.route("/api/config/visibility", methods=["GET"])
def get_visibility():
    """Return page_visibility config — available to any authenticated user."""
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT value FROM system_config WHERE `key` = 'page_visibility'"
            )
            row = cur.fetchone()
        conn.close()
        import json
        return jsonify(json.loads(row["value"]) if row else {})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

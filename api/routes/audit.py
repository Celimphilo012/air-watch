"""
routes/audit.py — Audit log (admin-only viewer + shared log_action helper)
"""
from flask import Blueprint, jsonify, session, request
from api.db import get_connection

audit_bp = Blueprint("audit", __name__)


def log_action(action: str, details: str = ""):
    """Record an action to the audit log. Silently ignores errors."""
    try:
        actor = session.get("username", "anonymous")
        ip    = request.remote_addr or "?"
        conn  = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO audit_log (actor, action, details, ip) VALUES (%s, %s, %s, %s)",
                (actor, action, details, ip),
            )
        conn.commit()
        conn.close()
    except Exception:
        pass


@audit_bp.route("/api/audit", methods=["GET"])
def get_audit():
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    try:
        limit  = min(int(request.args.get("limit", 300)), 1000)
        action = request.args.get("action", "")
        conn   = get_connection()
        with conn.cursor() as cur:
            if action:
                cur.execute(
                    "SELECT * FROM audit_log WHERE action = %s ORDER BY created_at DESC LIMIT %s",
                    (action, limit),
                )
            else:
                cur.execute(
                    "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT %s",
                    (limit,),
                )
            rows = cur.fetchall()
        conn.close()
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = str(r["created_at"])
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


LOGGABLE_CLIENT_ACTIONS = {"REPORT_EXPORT"}

@audit_bp.route("/api/audit/log", methods=["POST"])
def client_log():
    """Allow authenticated frontend code to log whitelisted actions."""
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    data    = request.get_json() or {}
    action  = data.get("action", "").upper()
    details = data.get("details", "")
    if action not in LOGGABLE_CLIENT_ACTIONS:
        return jsonify({"error": "Action not permitted"}), 400
    log_action(action, details)
    return jsonify({"ok": True})


@audit_bp.route("/api/audit/actions", methods=["GET"])
def get_action_types():
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT DISTINCT action FROM audit_log ORDER BY action")
            rows = [r["action"] for r in cur.fetchall()]
        conn.close()
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

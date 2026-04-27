"""
routes/users.py — User management (admin only)
"""
from flask import Blueprint, request, jsonify, session
from api.db import get_connection
import hashlib

users_bp = Blueprint("users", __name__)

def hash_pw(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

def require_admin():
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    if session.get("role") != "admin":
        return jsonify({"error": "Admin access required"}), 403
    return None

@users_bp.route("/api/users", methods=["GET"])
def list_users():
    err = require_admin()
    if err: return err
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("SELECT id, username, name, role, created_at FROM users")
            rows = cur.fetchall()
        conn.close()
        for r in rows:
            if r.get("created_at"):
                r["created_at"] = str(r["created_at"])
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@users_bp.route("/api/users", methods=["POST"])
def add_user():
    err = require_admin()
    if err: return err
    data = request.get_json()
    username = data.get("username","").strip()
    name     = data.get("name","").strip()
    password = data.get("password","")
    role     = data.get("role","researcher")

    if not username or not name or not password:
        return jsonify({"error": "All fields required"}), 400
    valid_roles = ["environmental_officer","researcher","admin"]
    if role not in valid_roles:
        return jsonify({"error": "Invalid role"}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO users (username,name,password_hash,role) VALUES (%s,%s,%s,%s)",
                (username, name, hash_pw(password), role)
            )
        conn.commit()
        conn.close()
        return jsonify({"message": f"User '{username}' created."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@users_bp.route("/api/users/<int:user_id>", methods=["DELETE"])
def delete_user(user_id):
    err = require_admin()
    if err: return err
    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        conn.close()
        return jsonify({"message": "User deleted."})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
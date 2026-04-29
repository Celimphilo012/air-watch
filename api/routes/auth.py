"""
routes/auth.py — Login / logout / session
"""
from flask import Blueprint, request, jsonify, session
from api.db import get_connection
from api.routes.audit import log_action
import hashlib

auth_bp = Blueprint("auth", __name__)

def hash_pw(pw):
    return hashlib.sha256(pw.encode()).hexdigest()

@auth_bp.route("/api/auth/login", methods=["POST"])
def login():
    data     = request.get_json()
    username = data.get("username", "").strip()
    password = data.get("password", "")

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    try:
        conn = get_connection()
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, username, name, role, password_hash FROM users WHERE username = %s",
                (username,)
            )
            user = cur.fetchone()
        conn.close()
    except Exception as e:
        return jsonify({"error": str(e)}), 500

    if not user or user["password_hash"] != hash_pw(password):
        return jsonify({"error": "Invalid username or password"}), 401

    session["user_id"]  = user["id"]
    session["username"] = user["username"]
    session["name"]     = user["name"]
    session["role"]     = user["role"]

    log_action("LOGIN", f"role={user['role']}")
    return jsonify({
        "message":  "Login successful",
        "username": user["username"],
        "name":     user["name"],
        "role":     user["role"],
    })

@auth_bp.route("/api/auth/logout", methods=["POST"])
def logout():
    log_action("LOGOUT", "")
    session.clear()
    return jsonify({"message": "Logged out"})

@auth_bp.route("/api/auth/me", methods=["GET"])
def me():
    if "username" not in session:
        return jsonify({"error": "Not authenticated"}), 401
    return jsonify({
        "username": session["username"],
        "name":     session["name"],
        "role":     session["role"],
    })
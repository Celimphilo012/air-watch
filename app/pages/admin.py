"""
pages/admin.py — Manage Users (Admin only)
Use case: Administration / Manage Users
"""
import streamlit as st
import hashlib
import os, sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from app.auth import require_access

def _hash(p): return hashlib.sha256(p.encode()).hexdigest()

ROLE_OPTIONS = {
    "Environmental Officer": "environmental_officer",
    "Researcher / Analyst":  "researcher",
    "System Administrator":  "admin",
}

def show():
    require_access("Manage Users")
    st.title("👥 Manage Users")
    st.caption("Add, remove, or update system user accounts. Admin access only.")

    users = st.session_state.get("users", {})

    # ── current users ─────────────────────────────────────────────────────────
    st.subheader("Current Users")
    if users:
        rows = [{"Username": u, "Name": d["name"], "Role": d["role"]}
                for u, d in users.items()]
        udf = st.dataframe(rows, use_container_width=True)
    else:
        st.info("No users found.")

    st.divider()

    # ── add user ──────────────────────────────────────────────────────────────
    st.subheader("Add New User")
    with st.form("add_user_form"):
        c1,c2 = st.columns(2)
        with c1:
            new_username = st.text_input("Username")
            new_name     = st.text_input("Full Name")
        with c2:
            new_role     = st.selectbox("Role", list(ROLE_OPTIONS.keys()))
            new_password = st.text_input("Password", type="password")
            confirm_pw   = st.text_input("Confirm Password", type="password")
        add = st.form_submit_button("➕ Add User", type="primary")

    if add:
        if not new_username or not new_name or not new_password:
            st.error("All fields are required.")
        elif new_password != confirm_pw:
            st.error("Passwords do not match.")
        elif new_username in users:
            st.error(f"Username '{new_username}' already exists.")
        else:
            users[new_username] = {
                "name":     new_name,
                "password": _hash(new_password),
                "role":     ROLE_OPTIONS[new_role],
            }
            st.session_state["users"] = users
            st.success(f"✅ User '{new_username}' added successfully.")
            st.rerun()

    st.divider()

    # ── remove user ───────────────────────────────────────────────────────────
    st.subheader("Remove User")
    removable = [u for u in users if u != st.session_state.get("username")]
    if removable:
        with st.form("remove_user_form"):
            to_remove = st.selectbox("Select user to remove", removable)
            remove    = st.form_submit_button("🗑️ Remove User", type="secondary")
        if remove:
            del users[to_remove]
            st.session_state["users"] = users
            st.success(f"User '{to_remove}' removed.")
            st.rerun()
    else:
        st.info("No other users to remove.")
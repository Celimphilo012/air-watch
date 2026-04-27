"""
auth.py
-------
Handles login, session state, and role-based access control.

Users are stored as a simple dict (no database needed for this project).
In a production system this would connect to a real user database.

Roles:
  environmental_officer  → full access except admin
  researcher             → read-only + predict
  admin                  → full access including user management
"""

import streamlit as st
import hashlib

# ── user store ────────────────────────────────────────────────────────────────
# password is stored as sha256 hash
# to generate a hash: hashlib.sha256("yourpassword".encode()).hexdigest()

def _hash(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

USERS = {
    "officer": {
        "name":     "Environmental Officer",
        "password": _hash("officer123"),
        "role":     "environmental_officer",
    },
    "analyst": {
        "name":     "Researcher / Analyst",
        "password": _hash("analyst123"),
        "role":     "researcher",
    },
    "admin": {
        "name":     "System Administrator",
        "password": _hash("admin123"),
        "role":     "admin",
    },
}

# ── page access per role ──────────────────────────────────────────────────────
ROLE_ACCESS = {
    "environmental_officer": [
        "Overview", "Historical Trends", "Upload & Validate",
        "Configure & Train", "Predict Air Quality",
        "Generate Report", "Email Notifications", "Model Report",
    ],
    "researcher": [
        "Overview", "Historical Trends",
        "Predict Air Quality", "Generate Report", "Model Report",
    ],
    "admin": [
        "Overview", "Historical Trends", "Upload & Validate",
        "Configure & Train", "Predict Air Quality",
        "Generate Report", "Email Notifications",
        "Model Report", "Manage Users",
    ],
}

# ── session helpers ───────────────────────────────────────────────────────────

def init_session():
    """Initialise session state keys if not already set."""
    defaults = {
        "logged_in":   False,
        "username":    None,
        "role":        None,
        "user_name":   None,
        "users":       dict(USERS),   # mutable copy for admin edits
    }
    for key, val in defaults.items():
        if key not in st.session_state:
            st.session_state[key] = val


def login(username: str, password: str) -> tuple[bool, str]:
    """
    Attempt login. Returns (success, message).
    Checks against session_state users so admin additions work live.
    """
    users = st.session_state.get("users", USERS)
    if username not in users:
        return False, "Username not found."
    if users[username]["password"] != _hash(password):
        return False, "Incorrect password."
    st.session_state["logged_in"] = True
    st.session_state["username"]  = username
    st.session_state["role"]      = users[username]["role"]
    st.session_state["user_name"] = users[username]["name"]
    return True, "Login successful."


def logout():
    """Clear session and force re-login."""
    for key in ["logged_in", "username", "role", "user_name"]:
        st.session_state[key] = None
    st.session_state["logged_in"] = False


def is_logged_in() -> bool:
    return st.session_state.get("logged_in", False)


def current_role() -> str:
    return st.session_state.get("role", "")


def current_user_name() -> str:
    return st.session_state.get("user_name", "")


def can_access(page: str) -> bool:
    """Return True if the current user's role can access this page."""
    role   = current_role()
    access = ROLE_ACCESS.get(role, [])
    return page in access


def require_access(page: str):
    """
    Call at the top of any page.
    Stops rendering and shows an error if the user cannot access this page.
    """
    if not is_logged_in():
        st.error("Please log in to access this page.")
        st.stop()
    if not can_access(page):
        st.error(f"⛔ Your role ({current_role()}) does not have access to '{page}'.")
        st.stop()


# ── login page UI ─────────────────────────────────────────────────────────────

def show_login_page():
    """Render the login form. Called from main.py when not logged in."""
    st.markdown("""
<div style="max-width:420px; margin: 4rem auto;">
""", unsafe_allow_html=True)

    col1, col2, col3 = st.columns([1, 3, 1])
    with col2:
        st.markdown("## 🌿 AirWatch Eswatini")
        st.markdown("##### Environmental Monitoring System")
        st.markdown("---")

        with st.form("login_form"):
            st.markdown("**Sign In**")
            username = st.text_input("Username", placeholder="Enter username")
            password = st.text_input("Password", type="password", placeholder="Enter password")
            submitted = st.form_submit_button("Login", type="primary", use_container_width=True)

            if submitted:
                if not username or not password:
                    st.error("Please enter both username and password.")
                else:
                    success, msg = login(username, password)
                    if success:
                        st.success(msg)
                        st.rerun()
                    else:
                        st.error(msg)

        st.markdown("---")
        st.caption("Demo credentials:")
        st.caption("👷 Officer: `officer` / `officer123`")
        st.caption("🔬 Analyst: `analyst` / `analyst123`")
        st.caption("⚙️ Admin:   `admin`   / `admin123`")

    st.markdown("</div>", unsafe_allow_html=True)
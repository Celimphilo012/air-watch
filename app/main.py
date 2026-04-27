"""
main.py
-------
AirWatch Eswatini — Entry point.
Handles login gate and sidebar navigation routing.

Run: streamlit run app/main.py
"""

import streamlit as st
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.auth import (
    init_session, is_logged_in, show_login_page,
    logout, current_user_name, current_role, can_access, ROLE_ACCESS
)

# ── page config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="AirWatch Eswatini",
    page_icon="🌿",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── global styles ─────────────────────────────────────────────────────────────
st.markdown("""
<style>
  [data-testid="stSidebar"] { min-width: 240px; }
  .role-badge {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 8px;
  }
  .role-officer  { background:#e3f2fd; color:#1565c0; }
  .role-analyst  { background:#f3e5f5; color:#6a1b9a; }
  .role-admin    { background:#fce4ec; color:#b71c1c; }
</style>
""", unsafe_allow_html=True)

# ── role badge helper ─────────────────────────────────────────────────────────
ROLE_LABELS = {
    "environmental_officer": ("Environmental Officer", "role-officer"),
    "researcher":            ("Researcher / Analyst",  "role-analyst"),
    "admin":                 ("System Administrator",  "role-admin"),
}

# ── ALL pages in order ────────────────────────────────────────────────────────
ALL_PAGES = [
    "📊 Overview",
    "📈 Historical Trends",
    "📂 Upload & Validate",
    "⚙️ Configure & Train",
    "🔮 Predict Air Quality",
    "📋 Generate Report",
    "📧 Email Notifications",
    "🤖 Model Report",
    "👥 Manage Users",
]

# strip emoji prefix for access check
def page_label(p: str) -> str:
    return p.split(" ", 1)[1]


# ── session init ──────────────────────────────────────────────────────────────
init_session()

# ── gate: show login if not authenticated ─────────────────────────────────────
if not is_logged_in():
    show_login_page()
    st.stop()

# ── sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 🌿 AirWatch Eswatini")
    st.caption("Environmental Monitoring System\nfor Air Quality Prediction")
    st.divider()

    # user info
    role  = current_role()
    label, badge_class = ROLE_LABELS.get(role, ("Unknown", "role-analyst"))
    st.markdown(f"👤 **{current_user_name()}**")
    st.markdown(f'<span class="role-badge {badge_class}">{label}</span>',
                unsafe_allow_html=True)
    st.divider()

    # only show pages the current role can access
    visible = [p for p in ALL_PAGES if can_access(page_label(p))]
    page    = st.radio("Navigation", visible, label_visibility="collapsed")

    st.divider()
    st.markdown("**WHO PM2.5 Guideline**")
    st.markdown("""
| | Category | PM2.5 |
|---|---|---|
|🟢| Good      | ≤ 10  |
|🟡| Moderate  | ≤ 25  |
|🟠| Unhealthy | ≤ 50  |
|🔴| Hazardous | > 50  |
""")
    st.divider()
    if st.button("🚪 Logout", use_container_width=True):
        logout()
        st.rerun()

    st.caption("EMCU · BSc Computer Science\nMthokozisi Jele · 202280195")

# ── page routing ──────────────────────────────────────────────────────────────
label = page_label(page)

if label == "Overview":
    from app.pages.overview import show
    show()
elif label == "Historical Trends":
    from app.pages.historical import show
    show()
elif label == "Upload & Validate":
    from app.pages.upload import show
    show()
elif label == "Configure & Train":
    from app.pages.train import show
    show()
elif label == "Predict Air Quality":
    from app.pages.predict import show
    show()
elif label == "Generate Report":
    from app.pages.report import show
    show()
elif label == "Email Notifications":
    from app.pages.notifications import show
    show()
elif label == "Model Report":
    from app.pages.model_report import show
    show()
elif label == "Manage Users":
    from app.pages.admin import show
    show()
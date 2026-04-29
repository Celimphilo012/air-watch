import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useEffect, useState } from "react";
import api from "../api";
import {
  LayoutDashboard,
  TrendingUp,
  Upload,
  Settings,
  Zap,
  FileText,
  Bell,
  Bot,
  Users,
  MapPin,
  LogOut,
  Sun,
  Moon,
  Leaf,
  Shield,
  SlidersHorizontal,
} from "lucide-react";

const ROLE_LABELS = {
  environmental_officer: {
    label: "Environmental Officer",
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  },
  researcher: {
    label: "Researcher / Analyst",
    color:
      "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  },
  admin: {
    label: "System Administrator",
    color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  },
};

// pageKey is the visibility config key; adminOnly items always show for admin
const ALL_NAV = [
  { to: "/",             icon: LayoutDashboard,   label: "Overview",            pageKey: "overview" },
  { to: "/historical",   icon: TrendingUp,         label: "Historical Trends",   pageKey: "historical" },
  { to: "/upload",       icon: Upload,             label: "Upload & Validate",   pageKey: "upload" },
  { to: "/train",        icon: Settings,           label: "Configure & Train",   pageKey: "train" },
  { to: "/predict",      icon: Zap,                label: "Predict Air Quality", pageKey: "predict" },
  { to: "/report",       icon: FileText,           label: "Generate Report",     pageKey: "report" },
  { to: "/notifications",icon: Bell,               label: "Notifications",       pageKey: "notifications" },
  { to: "/model-report", icon: Bot,                label: "Model Report",        pageKey: "model-report" },
  { to: "/admin",        icon: Users,              label: "Manage Users",        adminOnly: true },
  { to: "/zones",        icon: MapPin,             label: "Manage Zones",        adminOnly: true },
  { to: "/audit",        icon: Shield,             label: "Audit Log",           adminOnly: true },
  { to: "/config",       icon: SlidersHorizontal,  label: "System Config",       adminOnly: true },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const [visibility, setVisibility] = useState(null);

  useEffect(() => {
    api.get("/api/config/visibility")
      .then(r => setVisibility(r.data))
      .catch(() => {});
  }, []);

  const nav = ALL_NAV.filter(n => {
    if (user?.role === "admin") return true;
    if (n.adminOnly) return false;
    if (!visibility) {
      // fallback while loading: use hardcoded defaults
      const defaults = {
        environmental_officer: ["overview","historical","upload","train","predict","report","notifications","model-report"],
        researcher: ["overview","historical","predict","report","model-report"],
      };
      return (defaults[user?.role] || []).includes(n.pageKey);
    }
    return (visibility[user?.role] || []).includes(n.pageKey);
  });
  const roleInfo = ROLE_LABELS[user?.role] || {
    label: user?.role,
    color: "bg-gray-100 text-gray-800",
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* ── sidebar ── */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800">
        {/* logo */}
        <div className="p-5 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <Leaf className="text-green-600" size={22} />
            <div>
              <p className="font-bold text-sm leading-tight">
                AirWatch Eswatini
              </p>
              <p className="text-xs text-gray-400">Environmental Monitor</p>
            </div>
          </div>
        </div>

        {/* user info */}
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <p className="text-sm font-medium truncate">{user?.name}</p>
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${roleInfo.color}`}
          >
            {roleInfo.label}
          </span>
        </div>

        {/* nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {nav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg mb-0.5 text-sm transition-colors
                 ${
                   isActive
                     ? "bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-medium"
                     : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
                 }`
              }
            >
              <Icon size={16} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* bottom actions */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-1">
          <button
            onClick={toggle}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm
                       text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {dark ? <Sun size={16} /> : <Moon size={16} />}
            {dark ? "Light Mode" : "Dark Mode"}
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm
                       text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>

        <div className="px-4 pb-3">
          <p className="text-xs text-gray-400">EMCU · BSc CS</p>
          <p className="text-xs text-gray-400">Mthokozisi Jele · 202280195</p>
        </div>
      </aside>

      {/* ── main content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

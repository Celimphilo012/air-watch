import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
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

const ALL_NAV = [
  { to: "/", icon: LayoutDashboard, label: "Overview", roles: null },
  {
    to: "/historical",
    icon: TrendingUp,
    label: "Historical Trends",
    roles: null,
  },
  {
    to: "/upload",
    icon: Upload,
    label: "Upload & Validate",
    roles: ["environmental_officer", "admin"],
  },
  {
    to: "/train",
    icon: Settings,
    label: "Configure & Train",
    roles: ["environmental_officer", "admin"],
  },
  { to: "/predict", icon: Zap, label: "Predict Air Quality", roles: null },
  { to: "/report", icon: FileText, label: "Generate Report", roles: null },
  {
    to: "/notifications",
    icon: Bell,
    label: "Notifications",
    roles: ["environmental_officer", "admin"],
  },
  { to: "/model-report", icon: Bot, label: "Model Report", roles: null },
  { to: "/admin", icon: Users, label: "Manage Users", roles: ["admin"] },
  { to: "/zones", icon: MapPin, label: "Manage Zones", roles: ["admin"] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();

  const nav = ALL_NAV.filter((n) => !n.roles || n.roles.includes(user?.role));
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

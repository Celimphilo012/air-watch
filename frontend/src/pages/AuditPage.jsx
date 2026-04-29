import { useEffect, useState } from "react";
import api from "../api";
import { Shield } from "lucide-react";

const ACTION_COLORS = {
  LOGIN:         "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
  LOGOUT:        "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400",
  DATA_UPLOAD:   "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  MANUAL_ENTRY:  "bg-cyan-100 dark:bg-cyan-900 text-cyan-800 dark:text-cyan-200",
  MODEL_TRAIN:   "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
  NOTIFY_SENT:   "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200",
  PREDICTION:    "bg-sky-100 dark:bg-sky-900 text-sky-800 dark:text-sky-200",
  REPORT_EXPORT: "bg-teal-100 dark:bg-teal-900 text-teal-800 dark:text-teal-200",
  ZONE_ADD:      "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200",
  ZONE_DELETE:   "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
  USER_ADD:      "bg-emerald-100 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200",
  USER_EDIT:     "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200",
  USER_DELETE:   "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
  CONFIG_UPDATE: "bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200",
};

export default function AuditPage() {
  const [logs, setLogs]       = useState([]);
  const [actions, setActions] = useState([]);
  const [filter, setFilter]   = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const fetchLogs = (action = filter) => {
    setLoading(true);
    api.get("/api/audit", { params: { action, limit: 300 } })
      .then(r => setLogs(r.data))
      .catch(e => setError(e.response?.data?.error || "Failed to load audit log."))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchLogs();
    api.get("/api/audit/actions").then(r => setActions(r.data)).catch(() => {});
  }, []);

  const handleFilter = (val) => {
    setFilter(val);
    fetchLogs(val);
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield size={22} className="text-indigo-500" /> Audit Log
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            System activity history — admin access only.
          </p>
        </div>
        <button
          onClick={() => fetchLogs(filter)}
          className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                     text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* filter */}
      <div className="flex gap-3 flex-wrap">
        <button
          onClick={() => handleFilter("")}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            filter === ""
              ? "bg-blue-600 text-white"
              : "border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          }`}
        >
          All
        </button>
        {actions.map(a => (
          <button
            key={a}
            onClick={() => handleFilter(a)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === a
                ? "bg-blue-600 text-white"
                : `border border-gray-200 dark:border-gray-700 ${ACTION_COLORS[a] || ""} hover:opacity-80`
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {/* table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {loading ? (
          <p className="text-gray-400 text-sm p-6">Loading…</p>
        ) : error ? (
          <p className="text-red-500 text-sm p-6">{error}</p>
        ) : logs.length === 0 ? (
          <p className="text-gray-400 text-sm p-6">No entries found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                  {["Time", "User", "Action", "Details", "IP"].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logs.map(row => (
                  <tr key={row.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {row.created_at?.replace("T", " ").slice(0, 19)}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-gray-700 dark:text-gray-300">
                      {row.actor}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLORS[row.action] || "bg-gray-100 text-gray-600"}`}>
                        {row.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {row.details || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-gray-400 font-mono">
                      {row.ip}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-xs text-gray-400">Showing last 300 entries · newest first</p>
    </div>
  );
}

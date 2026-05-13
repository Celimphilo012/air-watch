import { useEffect, useState, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { RefreshCw, RotateCcw, Trash2, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

const MODEL_COLORS = { "Random Forest": "#1565c0", SVR: "#6a1b9a" };

function Badge({ children, variant = "default" }) {
  const cls = {
    default:  "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
    active:   "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300",
    rf:       "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
    svr:      "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
    warn:     "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300",
  }[variant] || "";
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
      {children}
    </span>
  );
}

function MetricCell({ value, highlight }) {
  if (value == null) return <td className="px-3 py-2 text-center text-gray-400">—</td>;
  return (
    <td className={`px-3 py-2 text-center font-mono text-sm ${highlight ? "font-bold text-green-600 dark:text-green-400" : "text-gray-700 dark:text-gray-300"}`}>
      {value}
    </td>
  );
}

function ExpandedRow({ run }) {
  const params = [
    { label: "n_estimators", value: run.n_estimators },
    { label: "max_depth",    value: run.max_depth },
    { label: "min_samples",  value: run.min_samples },
    { label: "SVR C",        value: run.svr_c },
    { label: "SVR ε",        value: run.svr_epsilon },
    { label: "SVR kernel",   value: run.svr_kernel },
  ];
  const overfitRF  = run.rf_train_r2  != null && run.rf_r2  != null && (run.rf_train_r2  - run.rf_r2)  > 0.15;
  const overfitSVR = run.svr_train_r2 != null && run.svr_r2 != null && (run.svr_train_r2 - run.svr_r2) > 0.15;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 py-4 bg-gray-50 dark:bg-gray-900/60 border-t border-gray-100 dark:border-gray-800">
      {/* Hyperparameters */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Hyperparameters</p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {params.map(p => (
            <div key={p.label} className="flex justify-between">
              <span className="text-gray-500">{p.label}</span>
              <span className="font-mono text-gray-800 dark:text-gray-200">{p.value ?? "—"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Train vs Test */}
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Train vs Test R²</p>
        <table className="w-full text-xs text-center border-collapse">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="pb-1 text-left text-gray-400 font-normal">Model</th>
              <th className="pb-1 text-gray-400 font-normal">Train R²</th>
              <th className="pb-1 text-gray-400 font-normal">Test R²</th>
              <th className="pb-1 text-gray-400 font-normal">Gap</th>
            </tr>
          </thead>
          <tbody>
            {[
              { name: "Random Forest", trainR2: run.rf_train_r2,  testR2: run.rf_r2,  overfit: overfitRF  },
              { name: "SVR",           trainR2: run.svr_train_r2, testR2: run.svr_r2, overfit: overfitSVR },
            ].map(row => {
              const gap = row.trainR2 != null && row.testR2 != null
                ? (row.trainR2 - row.testR2).toFixed(3)
                : null;
              return (
                <tr key={row.name} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-1 text-left text-gray-700 dark:text-gray-300">{row.name}</td>
                  <td className="py-1 text-gray-700 dark:text-gray-300">{row.trainR2 ?? "—"}</td>
                  <td className="py-1 text-gray-700 dark:text-gray-300">{row.testR2 ?? "—"}</td>
                  <td className="py-1">
                    {gap != null ? (
                      <span className={row.overfit ? "text-orange-600 font-semibold" : "text-gray-500"}>
                        {gap} {row.overfit ? "⚠" : ""}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="text-xs text-gray-400 mt-2">Gap &gt; 0.15 may indicate overfitting.</p>
      </div>

      {/* Storage path */}
      <div className="md:col-span-2">
        <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Model snapshot path</p>
        <p className="text-xs font-mono text-gray-500 break-all">{run.model_dir || "—"}</p>
      </div>
    </div>
  );
}

export default function TrainingHistoryPage() {
  const { user } = useAuth();
  const [history, setHistory]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [expanded, setExpanded]     = useState(null);
  const [confirm, setConfirm]       = useState(null); // { type: "rollback"|"delete", run }
  const [actionLoading, setActLoad] = useState(false);
  const [toast, setToast]           = useState("");

  const canRollback = ["environmental_officer", "admin"].includes(user?.role);
  const canDelete   = user?.role === "admin";

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    api.get("/api/model/history")
      .then(r => setHistory(r.data.history || []))
      .catch(e => setError(e.response?.data?.error || e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRollback = async () => {
    if (!confirm) return;
    setActLoad(true);
    try {
      await api.post(`/api/model/rollback/${confirm.run.run_id}`);
      showToast(`Rolled back to ${confirm.run.run_id}`);
      load();
    } catch (e) {
      showToast("Rollback failed: " + (e.response?.data?.error || e.message));
    } finally {
      setActLoad(false);
      setConfirm(null);
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    setActLoad(true);
    try {
      await api.delete(`/api/model/history/${confirm.run.run_id}`);
      showToast(`Deleted run ${confirm.run.run_id}`);
      load();
    } catch (e) {
      showToast("Delete failed: " + (e.response?.data?.error || e.message));
    } finally {
      setActLoad(false);
      setConfirm(null);
    }
  };

  // Stats
  const activeRun  = history.find(r => r.is_active);
  const bestRfR2   = history.length ? Math.max(...history.map(r => r.rf_r2  ?? -Infinity)).toFixed(4) : "—";
  const bestSvrR2  = history.length ? Math.max(...history.map(r => r.svr_r2 ?? -Infinity)).toFixed(4) : "—";

  // Chart data — chronological order
  const chartData = [...history].reverse().map((r, i) => ({
    name: `#${i + 1}`,
    label: r.run_id,
    rfR2:  r.rf_r2,
    svrR2: r.svr_r2,
  }));

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm px-4 py-3 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Training History</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Every training run is snapshotted — compare metrics and roll back at any time.
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total runs",     value: history.length },
          { label: "Active run",     value: activeRun ? activeRun.run_id.replace("run_", "") : "—" },
          { label: "Best RF R²",     value: history.length ? bestRfR2  : "—" },
          { label: "Best SVR R²",    value: history.length ? bestSvrR2 : "—" },
        ].map(s => (
          <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
            <p className="text-xs text-gray-400 mb-1">{s.label}</p>
            <p className="text-lg font-bold text-gray-900 dark:text-white truncate">{s.value}</p>
          </div>
        ))}
      </div>

      {/* R² over time chart */}
      {chartData.length > 1 && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">R² Over Training Runs</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 1]} tick={{ fontSize: 11 }} tickFormatter={v => v.toFixed(2)} />
              <Tooltip
                formatter={(v, name) => [v?.toFixed(4), name]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.label || ""}
              />
              <Legend />
              <Line type="monotone" dataKey="rfR2"  name="Random Forest R²" stroke={MODEL_COLORS["Random Forest"]} strokeWidth={2} dot={{ r: 4 }} />
              <Line type="monotone" dataKey="svrR2" name="SVR R²"            stroke={MODEL_COLORS["SVR"]}           strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200">All Runs</h2>
        </div>

        {loading && (
          <p className="text-gray-400 text-center py-12">Loading history…</p>
        )}
        {!loading && error && (
          <p className="text-red-500 text-center py-12">{error}</p>
        )}
        {!loading && !error && history.length === 0 && (
          <p className="text-gray-400 text-center py-12">
            No training runs yet. Train a model to start recording history.
          </p>
        )}

        {!loading && history.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  {["Run", "Trained at", "By", "Best model", "RF R²", "SVR R²", "RF MAE", "SVR MAE", "Status", "Actions"].map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {history.map(run => {
                  const isOpen = expanded === run.run_id;
                  return (
                    <>
                      <tr
                        key={run.run_id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800/40 cursor-pointer ${run.is_active ? "bg-green-50/40 dark:bg-green-950/20" : ""}`}
                        onClick={() => setExpanded(isOpen ? null : run.run_id)}
                      >
                        <td className="px-3 py-3 font-mono text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                            {run.run_id}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap text-xs">{run.trained_at}</td>
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-400 text-xs">{run.trained_by || "—"}</td>
                        <td className="px-3 py-3">
                          <Badge variant={run.best_model === "Random Forest" ? "rf" : "svr"}>
                            {run.best_model}
                          </Badge>
                        </td>
                        <MetricCell value={run.rf_r2}  highlight={run.best_model === "Random Forest"} />
                        <MetricCell value={run.svr_r2} highlight={run.best_model === "SVR"} />
                        <MetricCell value={run.rf_mae} />
                        <MetricCell value={run.svr_mae} />
                        <td className="px-3 py-3">
                          {run.is_active
                            ? <Badge variant="active"><span className="flex items-center gap-1"><CheckCircle size={10} /> Active</span></Badge>
                            : <Badge>Archived</Badge>
                          }
                        </td>
                        <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-2">
                            {canRollback && !run.is_active && (
                              <button
                                title="Roll back to this run"
                                onClick={() => setConfirm({ type: "rollback", run })}
                                className="p-1.5 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                              >
                                <RotateCcw size={14} />
                              </button>
                            )}
                            {canDelete && !run.is_active && (
                              <button
                                title="Delete this run"
                                onClick={() => setConfirm({ type: "delete", run })}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr key={`${run.run_id}-exp`}>
                          <td colSpan={10} className="p-0">
                            <ExpandedRow run={run} />
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-6 max-w-sm w-full mx-4">
            {confirm.type === "rollback" ? (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-xl">
                    <RotateCcw size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Roll Back Model</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  This will restore all model files from:
                </p>
                <p className="text-xs font-mono text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950 rounded-lg px-3 py-2 mb-4 break-all">
                  {confirm.run.run_id}
                </p>
                <p className="text-xs text-gray-500 mb-5">
                  The current active model will be replaced. You can always roll forward again from history.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirm(null)}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRollback}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 rounded-xl text-sm bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Rolling back…" : "Roll Back"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-3">
                  <div className="p-2 bg-red-100 dark:bg-red-900 rounded-xl">
                    <Trash2 size={20} className="text-red-600 dark:text-red-400" />
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">Delete Run</h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                  Permanently delete this run and its model files?
                </p>
                <p className="text-xs font-mono text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2 mb-4">
                  {confirm.run.run_id}
                </p>
                <p className="text-xs text-gray-500 mb-5">This action cannot be undone.</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setConfirm(null)}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 rounded-xl text-sm border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={actionLoading}
                    className="flex-1 px-4 py-2 rounded-xl text-sm bg-red-600 hover:bg-red-700 text-white font-medium transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

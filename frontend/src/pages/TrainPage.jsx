import { useState } from "react";
import api from "../api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export default function TrainPage() {
  const [params, setParams] = useState({
    n_estimators: 200,
    max_depth: 12,
    min_samples: 4,
    C: 100,
    epsilon: 0.5,
    kernel: "rbf",
  });
  const [training, setTraining] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState("");

  const set = (k, v) => setParams((p) => ({ ...p, [k]: v }));

  const handleTrain = async () => {
    setTraining(true);
    setError("");
    setResults(null);
    try {
      const r = await api.post("/api/train", params);
      setResults(r.data);
    } catch (err) {
      setError(err.response?.data?.error || "Training failed.");
    } finally {
      setTraining(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Configure & Train Models
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Adjust parameters and retrain Random Forest and SVR models.
        </p>
      </div>

      {/* RF params */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
          🌲 Random Forest
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {[
            {
              label: "Number of Trees",
              key: "n_estimators",
              min: 50,
              max: 500,
              step: 50,
            },
            { label: "Max Depth", key: "max_depth", min: 3, max: 20, step: 1 },
            {
              label: "Min Leaf Samples",
              key: "min_samples",
              min: 1,
              max: 20,
              step: 1,
            },
          ].map(({ label, key, min, max, step }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 dark:text-gray-400">
                {label}
              </label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min={min}
                  max={max}
                  step={step}
                  value={params[key]}
                  onChange={(e) => set(key, Number(e.target.value))}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-8 text-gray-700 dark:text-gray-300">
                  {params[key]}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SVR params */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
          📈 SVR
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              C (Regularisation)
            </label>
            <select
              value={params.C}
              onChange={(e) => set("C", Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
            >
              {[0.1, 1, 10, 50, 100, 200, 500].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Epsilon
            </label>
            <select
              value={params.epsilon}
              onChange={(e) => set("epsilon", Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
            >
              {[0.1, 0.3, 0.5, 1.0, 2.0].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Kernel
            </label>
            <select
              value={params.kernel}
              onChange={(e) => set("kernel", e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
            >
              {["rbf", "linear", "poly"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleTrain}
        disabled={training}
        className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                   text-white font-semibold text-sm transition-colors"
      >
        {training
          ? "⏳ Training models... (this may take ~30 seconds)"
          : "🚀 Train Models"}
      </button>

      {error && (
        <div
          className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800
                        rounded-xl p-4 text-sm text-red-700 dark:text-red-300"
        >
          ❌ {error}
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4">
            <p className="font-semibold text-green-800 dark:text-green-200">
              ✅ Training complete — best model: <strong>{results.best_model}</strong>
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
              {results.train_samples?.toLocaleString()} training samples · {results.test_samples?.toLocaleString()} test samples (80/20 split)
            </p>
          </div>

          {/* Train vs Test comparison table */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">
              Train vs Test Metrics
            </h2>
            <p className="text-xs text-gray-400 mb-4">
              If Train R² is much higher than Test R², the model may be overfitting.
            </p>
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 text-gray-500 font-medium">Model</th>
                  <th className="pb-2 text-center text-gray-500 font-medium">Set</th>
                  <th className="pb-2 text-center text-gray-500 font-medium">MAE (µg/m³)</th>
                  <th className="pb-2 text-center text-gray-500 font-medium">RMSE (µg/m³)</th>
                  <th className="pb-2 text-center text-gray-500 font-medium">R²</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {[
                  { name: "Random Forest", set: "Train", mae: results.rf_train_mae, rmse: results.rf_train_rmse, r2: results.rf_train_r2, color: "#1565c0" },
                  { name: "Random Forest", set: "Test",  mae: results.rf_mae,       rmse: results.rf_rmse,       r2: results.rf_r2,       color: "#1565c0" },
                  { name: "SVR",           set: "Train", mae: results.svr_train_mae, rmse: results.svr_train_rmse, r2: results.svr_train_r2, color: "#6a1b9a" },
                  { name: "SVR",           set: "Test",  mae: results.svr_mae,        rmse: results.svr_rmse,       r2: results.svr_r2,       color: "#6a1b9a" },
                ].map((row, i) => {
                  const isTest = row.set === "Test";
                  const overfit = isTest
                    ? null
                    : (() => {
                        const trainR2 = row.r2;
                        const testR2  = row.name === "Random Forest" ? results.rf_r2 : results.svr_r2;
                        return trainR2 - testR2 > 0.15;
                      })();
                  return (
                    <tr key={i} className={isTest ? "bg-gray-50 dark:bg-gray-800/40" : ""}>
                      <td className="py-2 pr-4">
                        {i === 0 || i === 2 ? (
                          <span className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full inline-block" style={{ background: row.color }} />
                            <strong className="text-gray-800 dark:text-gray-200">{row.name}</strong>
                          </span>
                        ) : null}
                      </td>
                      <td className="py-2 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          isTest
                            ? "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300"
                            : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300"
                        }`}>{row.set}</span>
                      </td>
                      <td className="py-2 text-center text-gray-700 dark:text-gray-300">{row.mae ?? "—"}</td>
                      <td className="py-2 text-center text-gray-700 dark:text-gray-300">{row.rmse ?? "—"}</td>
                      <td className="py-2 text-center">
                        <span className={overfit ? "text-orange-600 font-semibold" : "text-gray-700 dark:text-gray-300"}>
                          {row.r2 ?? "—"}
                        </span>
                        {overfit && <span className="ml-1 text-xs text-orange-500">⚠ overfit?</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

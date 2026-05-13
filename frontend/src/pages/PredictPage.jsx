import { useState, useEffect } from "react";
import api from "../api";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";

const AQI_COLORS = {
  Good: "#2e7d32",
  Moderate: "#f9a825",
  Unhealthy: "#e65100",
  Hazardous: "#b71c1c",
};

// WHO annual guideline limits (2005)
const WHO_LIMITS = [
  { key: "pm25", label: "PM2.5", limit: 10,  unit: "µg/m³" },
  { key: "pm10", label: "PM10",  limit: 20,  unit: "µg/m³" },
  { key: "no2",  label: "NO₂",   limit: 40,  unit: "µg/m³" },
  { key: "co",   label: "CO",    limit: 10,  unit: "mg/m³" },
];

export default function PredictPage() {
  const [zones, setZones] = useState(["Matsapha", "Simunye", "Bhunya"]);
  const [form, setForm] = useState({
    zone: "Matsapha",
    pm25: 18.0,
    pm10: 32.0,
    no2: 15.0,
    co: 0.5,
    days: 7,
  });
  const [loading, setLoading] = useState(false);
  const [forecasts, setForecasts] = useState(null);
  const [modelName, setModelName] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/api/zones")
      .then(r => {
        const names = r.data.map(z => z.name);
        setZones(names);
        if (names.length > 0) setForm(f => ({ ...f, zone: names[0] }));
      })
      .catch(() => {});
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handlePredict = async () => {
    setLoading(true);
    setError("");
    setForecasts(null);
    try {
      const r = await api.post("/api/predict", form);
      setForecasts(r.data.forecasts);
      setModelName(r.data.model);
      // save to session storage for notifications page
      sessionStorage.setItem("last_forecast", JSON.stringify(r.data.forecasts));
      sessionStorage.setItem("last_zone", r.data.zone);
    } catch (err) {
      setError(err.response?.data?.error || "Prediction failed.");
    } finally {
      setLoading(false);
    }
  };

  const worst = forecasts
    ? forecasts.reduce((a, b) => (a.pm25 > b.pm25 ? a : b))
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Predict Air Quality
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Enter current pollutant readings to generate a 7-day PM2.5 forecast.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Industrial Zone
            </label>
            <select
              value={form.zone}
              onChange={(e) => set("zone", e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
            >
              {zones.map(z => <option key={z} value={z}>{z}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              Forecast Days
            </label>
            <select
              value={form.days}
              onChange={(e) => set("days", Number(e.target.value))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
            >
              {[3, 5, 7, 10, 14].map((d) => (
                <option key={d} value={d}>
                  {d} days
                </option>
              ))}
            </select>
          </div>
          {[
            {
              label: "Current PM2.5 (µg/m³)",
              key: "pm25",
              min: 0,
              max: 150,
              step: 0.5,
            },
            {
              label: "Current PM10 (µg/m³)",
              key: "pm10",
              min: 0,
              max: 200,
              step: 0.5,
            },
            {
              label: "Current NO2 (µg/m³)",
              key: "no2",
              min: 0,
              max: 100,
              step: 0.5,
            },
            {
              label: "Current CO (mg/m³)",
              key: "co",
              min: 0,
              max: 10,
              step: 0.05,
            },
          ].map(({ label, key, min, max, step }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 dark:text-gray-400">
                {label}
              </label>
              <input
                type="number"
                value={form[key]}
                min={min}
                max={max}
                step={step}
                onChange={(e) => set(key, parseFloat(e.target.value))}
                className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                           bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300
                           focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))}
        </div>
        <button
          onClick={handlePredict}
          disabled={loading}
          className="mt-4 w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                     text-white font-semibold text-sm transition-colors"
        >
          {loading ? "Running forecast..." : "▶ Run Forecast"}
        </button>
      </div>

      {error && (
        <div
          className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800
                        rounded-xl p-4 text-sm text-red-700 dark:text-red-300"
        >
          ❌ {error}
        </div>
      )}

      {forecasts && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">
              {form.days}-Day PM2.5 Forecast — {form.zone}
            </h2>
            <span className="text-xs text-gray-400">Model: {modelName}</span>
          </div>

          {/* day cards */}
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${forecasts.length}, 1fr)` }}
          >
            {forecasts.map((f) => {
              const color = AQI_COLORS[f.category] || "#9e9e9e";
              return (
                <div
                  key={f.date}
                  className="text-center p-3 rounded-xl border-2 bg-white dark:bg-gray-900"
                  style={{ borderColor: color }}
                >
                  <p className="text-xs text-gray-400">{f.day.slice(0, 3)}</p>
                  <p className="text-xs text-gray-400">{f.date.slice(5)}</p>
                  <p className="text-xl font-bold mt-1" style={{ color }}>
                    {f.pm25}
                  </p>
                  <p className="text-xs font-medium mt-0.5" style={{ color }}>
                    {f.category}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {((f.pm25 / 10) * 100).toFixed(0)}% WHO
                  </p>
                </div>
              );
            })}
          </div>

          {/* chart */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={forecasts}
                margin={{ top: 10, right: 20, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" µg" />
                <Tooltip formatter={(v) => [`${v} µg/m³`, "PM2.5"]} />
                <ReferenceLine
                  y={10}
                  stroke="red"
                  strokeDasharray="4 4"
                  label={{ value: "WHO limit", position: "right", fontSize: 10 }}
                />
                <Line
                  type="monotone"
                  dataKey="pm25"
                  stroke="#1565c0"
                  strokeWidth={2}
                  dot={{ r: 5, fill: "#1565c0" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Current input readings vs WHO guidelines */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
            <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-1">
              Input Readings vs WHO Guidelines
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              WHO annual mean guidelines (2005). Ratio &gt;100% exceeds the limit.
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {WHO_LIMITS.map(({ key, label, limit, unit }) => {
                const val   = form[key];
                const ratio = val != null ? (val / limit) * 100 : null;
                const over  = ratio != null && ratio > 100;
                return (
                  <div key={key} className={`rounded-lg p-3 border ${
                    over
                      ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950"
                      : "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950"
                  }`}>
                    <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">{label}</p>
                    <p className="text-lg font-bold mt-1 text-gray-900 dark:text-white">
                      {val} <span className="text-xs font-normal">{unit}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Limit: {limit} {unit}
                    </p>
                    <p className={`text-xs font-semibold mt-1 ${over ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}>
                      {ratio != null ? `${ratio.toFixed(0)}% of WHO limit` : "—"}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Status banner — 3-tier based on WHO limit (10 µg/m³) */}
          {worst?.pm25 > 25 ? (
            <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-xl p-4 text-sm text-orange-800 dark:text-orange-200">
              ⚠️ Peak forecast of <strong>{worst.pm25} µg/m³</strong> on{" "}
              <strong>{worst.day} {worst.date}</strong> — {worst.category} levels (
              {((worst.pm25 / 10) * 100).toFixed(0)}% of WHO limit). Go to{" "}
              <strong>Notifications</strong> to alert stakeholders.
            </div>
          ) : worst?.pm25 > 10 ? (
            <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-300 dark:border-yellow-700 rounded-xl p-4 text-sm text-yellow-800 dark:text-yellow-200">
              ⚠️ Forecast exceeds the WHO PM2.5 limit (10 µg/m³) — peak{" "}
              <strong>{worst.pm25} µg/m³</strong> ({worst.category}) on{" "}
              <strong>{worst.day} {worst.date}</strong> is{" "}
              <strong>{((worst.pm25 / 10) * 100).toFixed(0)}%</strong> of the safe limit.
            </div>
          ) : (
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4 text-sm text-green-800 dark:text-green-200">
              ✅ All forecast days are within the WHO PM2.5 safe limit (≤10 µg/m³).
            </div>
          )}
        </>
      )}
    </div>
  );
}

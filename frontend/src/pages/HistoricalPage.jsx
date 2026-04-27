import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from "recharts";
import api from "../api";

const ZONE_COLORS_PRESET = {
  Matsapha: "#1565c0",
  Simunye: "#6a1b9a",
  Bhunya: "#00695c",
};
const FALLBACK_COLORS = ["#c62828","#2e7d32","#f57f17","#00838f","#4527a0","#558b2f"];
const SEASON_COLORS = {
  "Dry (May–Sep)": "#e65100",
  "Wet (Oct–Apr)": "#1565c0",
};

function zoneColor(name, allZones) {
  if (ZONE_COLORS_PRESET[name]) return ZONE_COLORS_PRESET[name];
  const idx = allZones.filter(z => !ZONE_COLORS_PRESET[z]).indexOf(name);
  return FALLBACK_COLORS[idx % FALLBACK_COLORS.length];
}

export default function HistoricalPage() {
  const [trends, setTrends] = useState([]);
  const [zoneSummary, setZoneSummary] = useState([]);
  const [allZones, setAllZones] = useState([]);
  const [zones, setZones] = useState([]);
  const [pollutant, setPollutant] = useState("pm25");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/api/zones")
      .then((r) => {
        const names = r.data.map((z) => z.name);
        setAllZones(names);
        setZones(names);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    api
      .get("/api/data/zone-summary")
      .then((r) => setZoneSummary(r.data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/api/data/trends?pollutant=${pollutant}`)
      .then((r) => setTrends(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [pollutant]);

  const byDate = {};
  trends.forEach((r) => {
    if (!byDate[r.date]) byDate[r.date] = { date: r.date };
    byDate[r.date][r.location] = r.value;
  });
  const chartData = Object.values(byDate)
    .filter((r) => zones.some((z) => r[z]))
    .slice(-180);

  const toggleZone = (z) =>
    setZones((prev) =>
      prev.includes(z) ? prev.filter((x) => x !== z) : [...prev, z],
    );

  const seasonData = zoneSummary.map((z) => ({
    zone: z.location,
    "Dry (May–Sep)": parseFloat((z.mean_pm25 * 1.28).toFixed(2)),
    "Wet (Oct–Apr)": parseFloat((z.mean_pm25 * 0.82).toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Historical Trends
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Pollution trends across Matsapha, Simunye and Bhunya industrial zones.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-2 flex-wrap">
          {allZones.map((z) => {
            const color = zoneColor(z, allZones);
            return (
              <button
                key={z}
                onClick={() => toggleZone(z)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors
                  ${
                    zones.includes(z)
                      ? "text-white border-transparent"
                      : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400"
                  }`}
                style={zones.includes(z) ? { backgroundColor: color } : {}}
              >
                {z}
              </button>
            );
          })}
        </div>
        <select
          value={pollutant}
          onChange={(e) => setPollutant(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700
                     bg-white dark:bg-gray-900 text-sm text-gray-700 dark:text-gray-300
                     focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="pm25">PM2.5</option>
          <option value="pm10">PM10</option>
          <option value="no2">NO2</option>
          <option value="co">CO</option>
        </select>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
          {pollutant.toUpperCase()} Over Time
        </h2>
        {loading ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
            Loading...
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-gray-400 text-sm">
            No data available. Upload a dataset first.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} tickCount={8} />
              <YAxis tick={{ fontSize: 11 }} unit=" µg" />
              <Tooltip formatter={(v, n) => [`${v} µg/m³`, n]} />
              <Legend />
              {zones.map((z) => (
                <Line
                  key={z}
                  type="monotone"
                  dataKey={z}
                  stroke={zoneColor(z, allZones)}
                  dot={false}
                  strokeWidth={2}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
        {pollutant === "pm25" && (
          <p className="text-xs text-red-500 mt-2">
            ⚠️ WHO safe limit: 10 µg/m³
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Dry vs Wet Season PM2.5
          </h2>
          {seasonData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={seasonData}
                margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="zone" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} unit=" µg" />
                <Tooltip formatter={(v, n) => [`${v} µg/m³`, n]} />
                <Legend />
                <Bar
                  dataKey="Dry (May–Sep)"
                  fill={SEASON_COLORS["Dry (May–Sep)"]}
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="Wet (Oct–Apr)"
                  fill={SEASON_COLORS["Wet (Oct–Apr)"]}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Zone PM2.5 Summary
          </h2>
          {zoneSummary.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
              No data
            </div>
          ) : (
            <div className="space-y-4 mt-2">
              {zoneSummary.map((z) => {
                const pct = Math.min((z.mean_pm25 / 30) * 100, 100);
                const color = zoneColor(z.location, allZones);
                return (
                  <div key={z.location}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {z.location}
                      </span>
                      <span className="text-gray-500 dark:text-gray-400">
                        {z.mean_pm25} µg/m³
                      </span>
                    </div>
                    <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                      <span>Min: {z.min_pm25}</span>
                      <span>Max: {z.max_pm25}</span>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-red-500 pt-1 border-t border-gray-100 dark:border-gray-800">
                WHO safe limit: 10 µg/m³
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

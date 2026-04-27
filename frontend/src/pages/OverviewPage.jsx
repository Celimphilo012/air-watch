import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import api from "../api";

const AQI_COLORS = {
  Good: "#2e7d32",
  Moderate: "#f9a825",
  Unhealthy: "#e65100",
  Hazardous: "#b71c1c",
};
const ZONE_COLORS = {
  Matsapha: "#1565c0",
  Simunye: "#6a1b9a",
  Bhunya: "#00695c",
};
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function StatCard({ label, value, sub, subColor }) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-1 ${subColor || "text-gray-400"}`}>{sub}</p>
      )}
    </div>
  );
}

export default function OverviewPage() {
  const [overview, setOverview] = useState(null);
  const [zones, setZones] = useState([]);
  const [aqi, setAqi] = useState([]);
  const [heatmap, setHeatmap] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/data/overview"),
      api.get("/api/data/zone-summary"),
      api.get("/api/data/aqi-distribution"),
      api.get("/api/data/monthly-heatmap"),
    ])
      .then(([o, z, a, h]) => {
        setOverview(o.data);
        setZones(z.data);
        setAqi(a.data);
        setHeatmap(h.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="text-gray-400 py-20 text-center">Loading overview...</div>
    );
  if (!overview?.total_records)
    return (
      <div className="text-center py-20">
        <p className="text-gray-400 mb-2">No data available.</p>
        <p className="text-sm text-gray-400">
          Go to <strong>Upload & Validate</strong> to import a dataset.
        </p>
      </div>
    );

  // build heatmap grid per zone
  const heatmapByZone = {};
  heatmap.forEach((r) => {
    if (!heatmapByZone[r.location]) heatmapByZone[r.location] = {};
    heatmapByZone[r.location][r.month] = r.avg_pm25;
  });

  const maxHeat = Math.max(...heatmap.map((r) => r.avg_pm25 || 0));

  function heatColor(val) {
    if (!val) return "bg-gray-100 dark:bg-gray-800";
    const pct = val / maxHeat;
    if (pct < 0.3)
      return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
    if (pct < 0.6)
      return "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200";
    if (pct < 0.85)
      return "bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200";
    return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Air Quality Overview
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Industrial zones: Matsapha · Simunye · Bhunya
        </p>
      </div>

      {/* stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Overall PM2.5 Mean"
          value={`${overview.overall_pm25_mean} µg/m³`}
          sub={`${(overview.overall_pm25_mean - 10).toFixed(1)} above WHO limit`}
          subColor="text-red-500"
        />
        <StatCard
          label="Most Polluted Zone"
          value={overview.most_polluted_zone}
        />
        <StatCard
          label="Days Above WHO Limit"
          value={`${overview.pct_above_who}%`}
          sub="WHO safe limit: 10 µg/m³"
        />
        <StatCard
          label="Total Records"
          value={overview.total_records.toLocaleString()}
        />
      </div>

      {/* charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* AQI pie */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
            AQI Category Distribution
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={aqi}
                dataKey="count"
                nameKey="category"
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                label={({ category, percent }) =>
                  `${category} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {aqi.map((e) => (
                  <Cell
                    key={e.category}
                    fill={AQI_COLORS[e.category] || "#9e9e9e"}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(v, n) => [v, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Zone bar */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
          <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Average PM2.5 by Zone
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart
              data={zones}
              margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="location" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} unit=" µg" />
              <Tooltip formatter={(v) => [`${v} µg/m³`, "PM2.5"]} />
              <Bar
                dataKey="mean_pm25"
                radius={[6, 6, 0, 0]}
                label={{
                  position: "top",
                  fontSize: 11,
                  formatter: (v) => `${v}`,
                }}
              >
                {zones.map((z) => (
                  <Cell
                    key={z.location}
                    fill={ZONE_COLORS[z.location] || "#888"}
                  />
                ))}
              </Bar>
              {/* WHO reference line */}
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-red-500 mt-1">— WHO limit: 10 µg/m³</p>
        </div>
      </div>

      {/* heatmap */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Monthly PM2.5 Heatmap by Zone
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-center">
            <thead>
              <tr>
                <th className="text-left text-gray-500 pb-2 pr-3">Zone</th>
                {MONTHS.map((m) => (
                  <th key={m} className="text-gray-500 pb-2 px-1">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(heatmapByZone).map(([zone, months]) => (
                <tr key={zone}>
                  <td className="text-left font-medium text-gray-700 dark:text-gray-300 py-1 pr-3">
                    {zone}
                  </td>
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                    const val = months[m];
                    return (
                      <td key={m} className="py-1 px-0.5">
                        <div className={`rounded px-1 py-1 ${heatColor(val)}`}>
                          {val ? val.toFixed(0) : "-"}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950 border-l-4 border-amber-400 rounded-lg p-4 text-sm text-amber-800 dark:text-amber-200">
        ⚠️ Eswatini's national PM2.5 mean (~17 µg/m³) exceeds the WHO guideline
        of 10 µg/m³. Industrial zones Matsapha, Simunye, and Bhunya are primary
        contributors.
      </div>
    </div>
  );
}

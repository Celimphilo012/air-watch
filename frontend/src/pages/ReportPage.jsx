import { useEffect, useState } from "react";
import api from "../api";
import { useAuth } from "../context/AuthContext";

export default function ReportPage() {
  const { user } = useAuth();
  const [zones, setZones] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/data/overview"),
      api.get("/api/data/zone-summary"),
    ])
      .then(([o, z]) => {
        setOverview(o.data);
        setZones(z.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const downloadCSV = (data, filename) => {
    if (!data.length) return;
    const keys = Object.keys(data[0]);
    const csv = [
      keys.join(","),
      ...data.map((r) => keys.map((k) => r[k]).join(",")),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading)
    return (
      <div className="text-gray-400 py-20 text-center">Loading report...</div>
    );

  const worst = zones.length
    ? zones.reduce((a, b) => (a.mean_pm25 > b.mean_pm25 ? a : b))
    : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Environmental Report
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Generated: {new Date().toLocaleString()} · Prepared by: {user?.name}
          </p>
        </div>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          🖨️ Print / Save PDF
        </button>
      </div>

      {/* zone summary */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
          1. Zone Summary
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                {[
                  "Zone",
                  "Records",
                  "PM2.5 Mean",
                  "PM2.5 Max",
                  "PM10 Mean",
                  "Above WHO %",
                  "Status",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left py-2 pr-4 text-xs font-medium text-gray-500 dark:text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map((z) => (
                <tr
                  key={z.location}
                  className="border-b border-gray-100 dark:border-gray-800"
                >
                  <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200">
                    {z.location}
                  </td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                    {z.records?.toLocaleString()}
                  </td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                    {z.mean_pm25} µg/m³
                  </td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                    {z.max_pm25} µg/m³
                  </td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                    {z.mean_pm10} µg/m³
                  </td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">
                    {z.pct_above_who}%
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        z.mean_pm25 > 10
                          ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300"
                          : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                      }`}
                    >
                      {z.mean_pm25 > 10 ? "Exceeds WHO" : "Within WHO"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* recommendations */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
          2. Recommendations
        </h2>
        <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
          {worst && (
            <li>
              • <strong>{worst.location}</strong> records the highest PM2.5 mean
              ({worst.mean_pm25} µg/m³) — prioritise emission control here
            </li>
          )}
          {overview && (
            <li>
              • <strong>{overview.pct_above_who}%</strong> of all recorded days
              exceed the WHO PM2.5 guideline of 10 µg/m³
            </li>
          )}
          <li>
            • Dry season months (May–September) consistently show elevated
            pollution — issue early warnings proactively
          </li>
          <li>
            • Expand continuous monitoring infrastructure across all three
            industrial zones
          </li>
          <li>
            • Community awareness programmes recommended for Matsapha, Simunye,
            and Bhunya residents
          </li>
        </ul>
      </div>

      {/* exports */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
          3. Export Data
        </h2>
        <div className="flex gap-3">
          <button
            onClick={() => downloadCSV(zones, "zone_summary.csv")}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                       text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            ⬇️ Zone Summary CSV
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          💡 To save as PDF: click Print / Save PDF above and select "Save as
          PDF" in your browser.
        </p>
      </div>
    </div>
  );
}

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

  const handlePrint = () => {
    api.post("/api/audit/log", { action: "REPORT_EXPORT", details: `prepared_by=${user?.name}` }).catch(() => {});
    const date = new Date().toLocaleString("en-ZA", {
      year: "numeric", month: "long", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

    const worst = zones.length
      ? zones.reduce((a, b) => (a.mean_pm25 > b.mean_pm25 ? a : b))
      : null;

    const zonesRows = zones.map((z) => `
      <tr>
        <td style="font-weight:600;">${z.location}</td>
        <td>${z.records?.toLocaleString()}</td>
        <td>${z.mean_pm25} µg/m³</td>
        <td>${z.max_pm25} µg/m³</td>
        <td>${z.mean_pm10} µg/m³</td>
        <td>${z.pct_above_who}%</td>
        <td style="color:${z.mean_pm25 > 10 ? "#b91c1c" : "#15803d"};font-weight:600;">
          ${z.mean_pm25 > 10 ? "Exceeds WHO" : "Within WHO"}
        </td>
      </tr>`).join("");

    const recItems = [
      worst
        ? `<strong>${worst.location}</strong> records the highest PM2.5 mean (${worst.mean_pm25} µg/m³) — prioritise emission control here`
        : null,
      overview
        ? `<strong>${overview.pct_above_who}%</strong> of all recorded days exceed the WHO PM2.5 guideline of 10 µg/m³`
        : null,
      "Dry season months (May–September) consistently show elevated pollution — issue early warnings proactively",
      "Expand continuous monitoring infrastructure across all three industrial zones",
      "Community awareness programmes recommended for Matsapha, Simunye, and Bhunya residents",
    ]
      .filter(Boolean)
      .map((r) => `<li>${r}</li>`)
      .join("");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Environmental Report — AirWatch Eswatini</title>
  <style>
    *  { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; color: #1a1a1a; background: #fff; }
    @page { margin: 2cm; size: A4 portrait; }

    /* ── Letterhead ── */
    .letterhead {
      display: flex; justify-content: space-between; align-items: flex-start;
      padding-bottom: 14px; border-bottom: 3px solid #1565c0; margin-bottom: 20px;
    }
    .org-name  { font-size: 20px; font-weight: 700; color: #1565c0; letter-spacing: -0.3px; }
    .org-sub   { font-size: 11px; color: #555; margin-top: 3px; }
    .meta      { text-align: right; font-size: 11px; color: #444; line-height: 1.7; }
    .meta strong { color: #1a1a1a; }

    /* ── Titles ── */
    .report-title    { font-size: 15px; font-weight: 700; margin-bottom: 3px; }
    .report-subtitle { font-size: 11px; color: #666; margin-bottom: 18px; }

    /* ── Summary cards ── */
    .cards { display: flex; gap: 10px; margin-bottom: 22px; }
    .card  { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px 12px; }
    .card-label { font-size: 10px; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .card-value { font-size: 17px; font-weight: 700; }
    .card-sub   { font-size: 10px; color: #e53e3e; margin-top: 2px; }

    /* ── Sections ── */
    .section       { margin-bottom: 22px; page-break-inside: avoid; }
    .section-title {
      font-size: 11px; font-weight: 700; color: #1565c0;
      text-transform: uppercase; letter-spacing: 0.6px;
      border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; margin-bottom: 12px;
    }

    /* ── Table ── */
    table  { width: 100%; border-collapse: collapse; font-size: 11px; }
    th     { background: #f1f5f9; text-align: left; padding: 7px 9px; font-weight: 600;
             color: #475569; font-size: 10px; text-transform: uppercase; letter-spacing: 0.3px;
             border-bottom: 2px solid #e2e8f0; }
    td     { padding: 7px 9px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    tr:last-child td { border-bottom: none; }
    tr:nth-child(even) td { background: #fafafa; }

    /* ── Recommendations ── */
    .rec-list    { list-style: none; }
    .rec-list li {
      padding: 8px 12px; margin-bottom: 7px;
      background: #f8fafc; border-left: 3px solid #1565c0;
      border-radius: 0 4px 4px 0; line-height: 1.5;
    }

    /* ── Warning banner ── */
    .warning {
      background: #fff7ed; border-left: 3px solid #f59e0b;
      padding: 9px 14px; border-radius: 0 6px 6px 0;
      font-size: 11px; color: #92400e; margin-bottom: 22px;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 28px; padding-top: 10px; border-top: 1px solid #e2e8f0;
      font-size: 10px; color: #888;
      display: flex; justify-content: space-between;
    }
  </style>
</head>
<body>

  <!-- Letterhead -->
  <div class="letterhead">
    <div>
      <div class="org-name">&#127807; AirWatch Eswatini</div>
      <div class="org-sub">Environmental Air Quality Monitoring System</div>
      <div class="org-sub">Eswatini Ministry of Tourism &amp; Environmental Affairs</div>
    </div>
    <div class="meta">
      <div><strong>CONFIDENTIAL</strong></div>
      <div>Generated: ${date}</div>
      <div>Prepared by: <strong>${user?.name ?? "System"}</strong></div>
      <div>Role: ${(user?.role ?? "").replace(/_/g, " ")}</div>
    </div>
  </div>

  <!-- Title -->
  <div class="report-title">Environmental Air Quality Report</div>
  <div class="report-subtitle">
    Industrial Zones: Matsapha &middot; Simunye &middot; Bhunya &nbsp;|&nbsp;
    Total Records: ${overview?.total_records?.toLocaleString() ?? "&mdash;"}
  </div>

  <!-- Summary cards -->
  ${overview ? `
  <div class="cards">
    <div class="card">
      <div class="card-label">Overall PM2.5 Mean</div>
      <div class="card-value">${overview.overall_pm25_mean} <span style="font-size:12px;font-weight:400;">µg/m³</span></div>
      <div class="card-sub">+${(overview.overall_pm25_mean - 10).toFixed(1)} µg/m³ above WHO limit</div>
    </div>
    <div class="card">
      <div class="card-label">Most Polluted Zone</div>
      <div class="card-value" style="font-size:14px;">${overview.most_polluted_zone}</div>
    </div>
    <div class="card">
      <div class="card-label">Days Above WHO Limit</div>
      <div class="card-value">${overview.pct_above_who}%</div>
      <div class="card-sub">WHO safe limit: 10 µg/m³</div>
    </div>
    <div class="card">
      <div class="card-label">Total Records</div>
      <div class="card-value" style="font-size:14px;">${overview.total_records?.toLocaleString()}</div>
    </div>
  </div>` : ""}

  <!-- Zone Summary -->
  <div class="section">
    <div class="section-title">1. Zone Summary</div>
    <table>
      <thead>
        <tr>
          <th>Zone</th><th>Records</th><th>PM2.5 Mean</th><th>PM2.5 Max</th>
          <th>PM10 Mean</th><th>Above WHO %</th><th>WHO Status</th>
        </tr>
      </thead>
      <tbody>${zonesRows}</tbody>
    </table>
  </div>

  <!-- Warning -->
  <div class="warning">
    &#9888; Eswatini's national PM2.5 mean (~${overview?.overall_pm25_mean} µg/m³) exceeds the WHO guideline of 10 µg/m³.
    Industrial zones Matsapha, Simunye, and Bhunya are primary contributors.
  </div>

  <!-- Recommendations -->
  <div class="section">
    <div class="section-title">2. Recommendations</div>
    <ul class="rec-list">${recItems}</ul>
  </div>

  <!-- Footer -->
  <div class="footer">
    <span>AirWatch Eswatini &middot; Environmental Monitoring &amp; Control Unit (EMCU) &middot; BSc CS</span>
    <span>System-generated report. For official use only.</span>
  </div>

</body>
</html>`;

    const win = window.open("", "_blank", "width=900,height=700");
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 300);
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
          onClick={handlePrint}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"
        >
          🖨️ Export as PDF
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
                  "Zone", "Records", "PM2.5 Mean", "PM2.5 Max",
                  "PM10 Mean", "Above WHO %", "Status",
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
                <tr key={z.location} className="border-b border-gray-100 dark:border-gray-800">
                  <td className="py-2 pr-4 font-medium text-gray-800 dark:text-gray-200">{z.location}</td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{z.records?.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{z.mean_pm25} µg/m³</td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{z.max_pm25} µg/m³</td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{z.mean_pm10} µg/m³</td>
                  <td className="py-2 pr-4 text-gray-600 dark:text-gray-400">{z.pct_above_who}%</td>
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
          <li>• Dry season months (May–September) consistently show elevated pollution — issue early warnings proactively</li>
          <li>• Expand continuous monitoring infrastructure across all three industrial zones</li>
          <li>• Community awareness programmes recommended for Matsapha, Simunye, and Bhunya residents</li>
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
      </div>
    </div>
  );
}

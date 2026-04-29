import { useState, useCallback, useEffect } from "react";
import api from "../api";
import { Upload, CheckCircle, AlertCircle, FileText, ArrowRight, PenLine } from "lucide-react";

const COLUMN_ALIASES = {
  city:     "location",
  "pm2.5":  "pm25",
  date:     "date",
  datetime: "date",
  pm10:     "pm10",
  no2:      "no2",
  co:       "co",
};

function normalizeHeader(h) {
  const key = h.trim().toLowerCase();
  return COLUMN_ALIASES[key] ?? key;
}

function parseCSV(text) {
  const lines = text.trim().split("\n");
  if (!lines.length) return { headers: [], rows: [], rawHeaders: [] };
  const rawHeaders = lines[0].split(",").map((h) => h.trim());
  const headers    = rawHeaders.map(normalizeHeader);
  const rows       = lines.slice(1).map((l) => l.split(",").map((c) => c.trim()));
  return { headers, rawHeaders, rows };
}

const inputCls =
  "mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 " +
  "bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500";

const today = () => new Date().toISOString().slice(0, 10);

export default function UploadPage() {
  const [tab, setTab] = useState("csv"); // "csv" | "manual"

  // CSV state
  const [validZones, setValidZones]     = useState(["Matsapha", "Simunye", "Bhunya"]);
  const [file, setFile]                 = useState(null);
  const [parsed, setParsed]             = useState(null);
  const [zoneMapping, setZoneMapping]   = useState({});
  const [uploading, setUploading]       = useState(false);
  const [csvResult, setCsvResult]       = useState(null);

  // Manual entry state
  const [form, setForm] = useState({ date: today(), location: "", pm25: "", pm10: "", no2: "", co: "" });
  const [saving, setSaving]     = useState(false);
  const [manResult, setManResult] = useState(null);

  useEffect(() => {
    api.get("/api/zones")
      .then(r => setValidZones(r.data.map(z => z.name)))
      .catch(() => {});
  }, []);

  // ── CSV handlers ──────────────────────────────────────────────────────────

  const handleFile = useCallback((e) => {
    const f = e.target.files[0];
    if (!f) return;
    setFile(f);
    setCsvResult(null);
    setParsed(null);
    setZoneMapping({});

    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target.result);
      const locIdx = headers.indexOf("location");
      let uniqueCities = [];
      if (locIdx !== -1) {
        const vals = [...new Set(rows.map((r) => r[locIdx]).filter(Boolean))];
        uniqueCities = vals.some((v) => !validZones.includes(v)) ? vals : [];
      }
      const missing = ["date", "location", "pm25"].filter((c) => !headers.includes(c));
      setParsed({ headers, rows, uniqueCities, missing });
      const initial = {};
      uniqueCities.forEach((c) => { if (validZones.includes(c)) initial[c] = c; });
      setZoneMapping(initial);
    };
    reader.readAsText(f);
  }, [validZones]);

  const mappingComplete =
    parsed?.uniqueCities.length === 0 ||
    parsed?.uniqueCities.every((c) => zoneMapping[c]);

  const handleUpload = async () => {
    if (!file || !mappingComplete) return;
    setUploading(true);
    setCsvResult(null);
    const fd = new FormData();
    fd.append("file", file);
    if (parsed?.uniqueCities.length > 0)
      fd.append("zone_mapping", JSON.stringify(zoneMapping));
    try {
      const r = await api.post("/api/data/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setCsvResult({ success: true, message: r.data.message });
    } catch (err) {
      setCsvResult({ success: false, message: err.response?.data?.error || "Upload failed." });
    } finally {
      setUploading(false);
    }
  };

  // ── Manual entry handlers ─────────────────────────────────────────────────

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    setManResult(null);
    try {
      const payload = {
        date:     form.date,
        location: form.location,
        pm25:     parseFloat(form.pm25),
        pm10:     form.pm10 !== "" ? parseFloat(form.pm10) : null,
        no2:      form.no2  !== "" ? parseFloat(form.no2)  : null,
        co:       form.co   !== "" ? parseFloat(form.co)   : null,
      };
      const r = await api.post("/api/data/reading", payload);
      setManResult({ success: true, message: r.data.message });
      setForm(f => ({ ...f, pm25: "", pm10: "", no2: "", co: "" }));
    } catch (err) {
      setManResult({ success: false, message: err.response?.data?.error || "Save failed." });
    } finally {
      setSaving(false);
    }
  };

  const previewRows = parsed?.rows.slice(0, 5) ?? [];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload & Validate Dataset</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Import a CSV file or enter a single day's readings manually.
        </p>
      </div>

      {/* tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {[
          { id: "csv",    label: "Import CSV",    icon: Upload   },
          { id: "manual", label: "Manual Entry",  icon: PenLine  },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id
                ? "border-blue-600 text-blue-600 dark:text-blue-400"
                : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── CSV tab ── */}
      {tab === "csv" && (
        <>
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4 space-y-3">
            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">Accepted formats</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-blue-700 dark:text-blue-300">
              <div>
                <p className="font-semibold mb-1">Standard (Eswatini)</p>
                <code className="block whitespace-pre bg-blue-100 dark:bg-blue-900 rounded p-2">
{`date, location, pm25, pm10, no2, co
2024-01-01, Matsapha, 18.5, 32, 15, 0.5`}
                </code>
              </div>
              <div>
                <p className="font-semibold mb-1">Raw city dataset</p>
                <code className="block whitespace-pre bg-blue-100 dark:bg-blue-900 rounded p-2">
{`City, Date, PM2.5, PM10, NO2, CO, …
Ahmedabad, 2015-01-01, 18.5, 32, 15, 0.5`}
                </code>
              </div>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400">
              Column names are case-insensitive. Extra columns are ignored.
            </p>
          </div>

          <label className="flex flex-col items-center justify-center border-2 border-dashed
                           border-gray-300 dark:border-gray-700 rounded-xl p-10 cursor-pointer
                           hover:border-blue-400 dark:hover:border-blue-600 transition-colors
                           bg-white dark:bg-gray-900">
            <Upload className="text-gray-400 mb-3" size={32} />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {file ? file.name : "Click to select a CSV file"}
            </p>
            <p className="text-xs text-gray-400 mt-1">CSV files only</p>
            <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </label>

          {parsed && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} className="text-gray-400" />
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  File Preview
                  <span className="ml-2 text-xs text-gray-400 font-normal">(columns auto-normalised)</span>
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                      {parsed.headers.map((h, i) => (
                        <td key={i} className="pr-4 py-1 whitespace-nowrap">{h}</td>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => (
                      <tr key={i} className="text-gray-500 dark:text-gray-400">
                        {row.map((cell, j) => (
                          <td key={j} className="pr-4 py-0.5 whitespace-nowrap">{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {parsed && (
            parsed.missing.length > 0 ? (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4">
                <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800 dark:text-red-200">Missing required columns</p>
                  <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                    {parsed.missing.join(", ")} — detected: {parsed.headers.join(", ")}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-4">
                <CheckCircle size={16} className="text-green-600 mt-0.5 shrink-0" />
                <p className="text-sm font-medium text-green-800 dark:text-green-200">All required columns detected</p>
              </div>
            )
          )}

          {parsed?.missing.length === 0 && parsed.uniqueCities.length > 0 && (
            <div className="bg-white dark:bg-gray-900 rounded-xl border border-yellow-300 dark:border-yellow-700 p-5">
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-1">Assign cities to Eswatini zones</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                The dataset contains city names that need to be mapped to the three industrial monitoring zones.
              </p>
              <div className="space-y-3">
                {parsed.uniqueCities.map((city) => (
                  <div key={city} className="flex items-center gap-3">
                    <span className="text-sm text-gray-700 dark:text-gray-300 w-36 truncate font-mono">{city}</span>
                    <ArrowRight size={14} className="text-gray-400 shrink-0" />
                    <select
                      value={zoneMapping[city] ?? ""}
                      onChange={(e) => setZoneMapping((m) => ({ ...m, [city]: e.target.value }))}
                      className="flex-1 max-w-xs px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700
                                 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm
                                 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">— select zone —</option>
                      {validZones.map((z) => <option key={z} value={z}>{z}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              {!mappingComplete && (
                <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-3">
                  Assign all cities to a zone before uploading.
                </p>
              )}
            </div>
          )}

          {parsed?.missing.length === 0 && mappingComplete && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                         text-white font-medium text-sm transition-colors"
            >
              {uploading ? "Uploading & processing…" : "Process & Save Dataset"}
            </button>
          )}

          {csvResult && (
            <div className={`rounded-xl border p-4 text-sm ${
              csvResult.success
                ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
            }`}>
              {csvResult.success ? "✅" : "❌"} {csvResult.message}
            </div>
          )}
        </>
      )}

      {/* ── Manual entry tab ── */}
      {tab === "manual" && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Enter a single day's readings for one zone. If a record already exists for that date and zone, it will be updated.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Date *</label>
              <input
                type="date"
                value={form.date}
                onChange={e => setF("date", e.target.value)}
                max={today()}
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-gray-400">Zone *</label>
              <select value={form.location} onChange={e => setF("location", e.target.value)} className={inputCls}>
                <option value="">— select zone —</option>
                {validZones.map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>

            {[
              { key: "pm25", label: "PM2.5 (µg/m³) *", required: true,  min: 0, max: 500 },
              { key: "pm10", label: "PM10 (µg/m³)",    required: false, min: 0, max: 1000 },
              { key: "no2",  label: "NO₂ (µg/m³)",     required: false, min: 0, max: 500 },
              { key: "co",   label: "CO (mg/m³)",       required: false, min: 0, max: 50 },
            ].map(({ key, label, min, max }) => (
              <div key={key}>
                <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
                <input
                  type="number"
                  step="0.01"
                  min={min}
                  max={max}
                  value={form[key]}
                  onChange={e => setF(key, e.target.value)}
                  placeholder="—"
                  className={inputCls}
                />
              </div>
            ))}
          </div>

          {form.pm25 !== "" && !isNaN(parseFloat(form.pm25)) && (() => {
            const v = parseFloat(form.pm25);
            const [label, color] =
              v <= 10  ? ["Good",      "text-green-600"]  :
              v <= 25  ? ["Moderate",  "text-yellow-600"] :
              v <= 50  ? ["Unhealthy", "text-orange-600"] :
                         ["Hazardous", "text-red-600"];
            return (
              <p className={`text-sm font-medium ${color}`}>
                AQI Category: <strong>{label}</strong>
              </p>
            );
          })()}

          {manResult && (
            <div className={`rounded-lg border p-3 text-sm ${
              manResult.success
                ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
                : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
            }`}>
              {manResult.success ? "✅" : "❌"} {manResult.message}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !form.date || !form.location || form.pm25 === ""}
            className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                       text-white text-sm font-medium transition-colors"
          >
            {saving ? "Saving…" : "Save Reading"}
          </button>
        </div>
      )}
    </div>
  );
}

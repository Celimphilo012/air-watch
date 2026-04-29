import { useEffect, useState } from "react";
import api from "../api";
import { Settings, Eye, Mail } from "lucide-react";

const ALL_PAGES = [
  { key: "overview",     label: "Overview" },
  { key: "historical",   label: "Historical Trends" },
  { key: "upload",       label: "Upload & Validate" },
  { key: "train",        label: "Configure & Train" },
  { key: "predict",      label: "Predict Air Quality" },
  { key: "report",       label: "Generate Report" },
  { key: "notifications",label: "Notifications" },
  { key: "model-report", label: "Model Report" },
];

const ROLES = [
  { value: "environmental_officer", label: "Environmental Officer" },
  { value: "researcher",            label: "Researcher / Analyst" },
];

const inputCls =
  "mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 " +
  "bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function ConfigPage() {
  const [email, setEmail]       = useState({ email_sender: "", email_password: "", email_recipients: "" });
  const [visibility, setVis]    = useState({
    environmental_officer: ALL_PAGES.map(p => p.key),
    researcher: ["overview", "historical", "predict", "report", "model-report"],
  });
  const [saving, setSaving]     = useState(false);
  const [success, setSuccess]   = useState("");
  const [error, setError]       = useState("");

  useEffect(() => {
    api.get("/api/config")
      .then(r => {
        const cfg = r.data;
        setEmail({
          email_sender:     cfg.email_sender     || "",
          email_password:   cfg.email_password   || "",
          email_recipients: cfg.email_recipients || "",
        });
        if (cfg.page_visibility) {
          try { setVis(JSON.parse(cfg.page_visibility)); } catch {}
        }
      })
      .catch(() => {});
  }, []);

  const setE = (k, v) => setEmail(e => ({ ...e, [k]: v }));

  const togglePage = (role, pageKey) => {
    setVis(prev => {
      const current = prev[role] || [];
      const updated  = current.includes(pageKey)
        ? current.filter(p => p !== pageKey)
        : [...current, pageKey];
      return { ...prev, [role]: updated };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    setSuccess("");
    setError("");
    try {
      await api.put("/api/config", {
        ...email,
        page_visibility: JSON.stringify(visibility),
      });
      setSuccess("Configuration saved.");
    } catch (err) {
      setError(err.response?.data?.error || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Settings size={22} className="text-blue-500" /> System Configuration
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Admin-only settings. Changes apply immediately.
        </p>
      </div>

      {/* ── Email / Notification Settings ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Mail size={16} /> Notification / Email Settings
        </h2>
        <p className="text-xs text-gray-400">
          These credentials are used automatically on the Notifications page so users don't have to re-enter them each time.
        </p>

        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Gmail Address</label>
          <input
            type="email"
            value={email.email_sender}
            onChange={e => setE("email_sender", e.target.value)}
            placeholder="airwatch@gmail.com"
            className={inputCls}
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">App Password</label>
          <input
            type="password"
            value={email.email_password}
            onChange={e => setE("email_password", e.target.value)}
            placeholder="xxxx xxxx xxxx xxxx"
            className={inputCls}
          />
          <p className="text-xs text-gray-400 mt-1">
            Gmail App Password (not your normal password). Enable at myaccount.google.com → Security → App passwords.
          </p>
        </div>
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">Default Recipients (one email per line)</label>
          <textarea
            value={email.email_recipients}
            onChange={e => setE("email_recipients", e.target.value)}
            rows={3}
            placeholder={"officer@eea.org.sz\nmanager@environment.gov.sz"}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      {/* ── Page Visibility ── */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
          <Eye size={16} /> Page Visibility per Role
        </h2>
        <p className="text-xs text-gray-400">
          Admin always sees all pages. Configure which pages each other role can access in the sidebar.
        </p>

        {ROLES.map(role => (
          <div key={role.value}>
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{role.label}</p>
            <div className="grid grid-cols-2 gap-2">
              {ALL_PAGES.map(page => {
                const checked = (visibility[role.value] || []).includes(page.key);
                return (
                  <label
                    key={page.key}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-950"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePage(role.value, page.key)}
                      className="accent-blue-600"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">{page.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {error   && <p className="text-sm text-red-600 dark:text-red-400">&#10060; {error}</p>}
      {success && <p className="text-sm text-green-600 dark:text-green-400">&#9989; {success}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                   text-white text-sm font-medium transition-colors"
      >
        {saving ? "Saving…" : "Save Configuration"}
      </button>
    </div>
  );
}

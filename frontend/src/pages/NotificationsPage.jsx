import { useState, useEffect } from "react";
import api from "../api";

export default function NotificationsPage() {
  const [forecasts, setForecasts] = useState(null);
  const [zone, setZone] = useState("");
  const [form, setForm] = useState({
    senderEmail: "",
    appPassword: "",
    recipients: "",
    subject: "",
  });
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const f = sessionStorage.getItem("last_forecast");
    const z = sessionStorage.getItem("last_zone");
    if (f) {
      setForecasts(JSON.parse(f));
      setZone(z || "");
    }
    const subject = z
      ? `Air Quality Alert — ${z} — ${new Date().toISOString().slice(0, 10)}`
      : "";

    // Auto-load saved email config from system settings
    import("../api").then(({ default: api }) => {
      api.get("/api/config/email")
        .then(r => {
          setForm(prev => ({
            ...prev,
            senderEmail: r.data.email_sender     || prev.senderEmail,
            appPassword: r.data.email_password   || prev.appPassword,
            recipients:  r.data.email_recipients || prev.recipients,
            subject:     subject || prev.subject,
          }));
        })
        .catch(() => {
          if (subject) setForm(prev => ({ ...prev, subject }));
        });
    });
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSend = async () => {
    setSending(true);
    setResult(null);
    try {
      const r = await api.post("/api/notify", {
        ...form,
        forecasts,
        zone,
        recipients: form.recipients
          .split("\n")
          .map((r) => r.trim())
          .filter(Boolean),
      });
      setResult({ success: true, message: r.data.message });
    } catch (err) {
      setResult({
        success: false,
        message: err.response?.data?.error || "Failed to send.",
      });
    } finally {
      setSending(false);
    }
  };

  if (!forecasts)
    return (
      <div className="text-center py-20">
        <p className="text-gray-400">No forecast available.</p>
        <p className="text-sm text-gray-400 mt-1">
          Go to <strong>Predict Air Quality</strong> first.
        </p>
      </div>
    );

  const AQI_COLORS = {
    Good: "#2e7d32",
    Moderate: "#f9a825",
    Unhealthy: "#e65100",
    Hazardous: "#b71c1c",
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Email Notifications
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Send air quality forecast alerts to stakeholders.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
          Forecast to be sent — {zone}
        </p>
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: `repeat(${forecasts.length}, 1fr)` }}
        >
          {forecasts.map((f) => {
            const color = AQI_COLORS[f.category] || "#9e9e9e";
            return (
              <div
                key={f.date}
                className="text-center p-2 rounded-lg border"
                style={{ borderColor: color }}
              >
                <p className="text-xs text-gray-400">{f.day?.slice(0, 3)}</p>
                <p className="text-sm font-bold" style={{ color }}>
                  {f.pm25}
                </p>
                <p className="text-xs" style={{ color }}>
                  {f.category}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-xl p-4 text-xs text-blue-800 dark:text-blue-200">
        💡 Uses Gmail SMTP. You need a Gmail App Password — not your normal
        password. Enable at: myaccount.google.com → Security → 2-Step
        Verification → App passwords
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 space-y-4">
        {[
          {
            label: "Your Gmail Address",
            key: "senderEmail",
            type: "email",
            placeholder: "you@gmail.com",
          },
          {
            label: "App Password",
            key: "appPassword",
            type: "password",
            placeholder: "xxxx xxxx xxxx xxxx",
          },
          {
            label: "Subject",
            key: "subject",
            type: "text",
            placeholder: "Air Quality Alert...",
          },
        ].map(({ label, key, type, placeholder }) => (
          <div key={key}>
            <label className="text-xs text-gray-500 dark:text-gray-400">
              {label}
            </label>
            <input
              type={type}
              value={form[key]}
              onChange={(e) => set(key, e.target.value)}
              placeholder={placeholder}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300
                         focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-gray-500 dark:text-gray-400">
            Recipient Emails (one per line)
          </label>
          <textarea
            value={form.recipients}
            onChange={(e) => set("recipients", e.target.value)}
            rows={3}
            placeholder="officer@eea.org.sz&#10;manager@environment.gov.sz"
            className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300
                       focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
        </div>
        <button
          onClick={handleSend}
          disabled={sending}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                     text-white font-semibold text-sm transition-colors"
        >
          {sending ? "Sending..." : "📤 Send Notification"}
        </button>
      </div>

      {result && (
        <div
          className={`rounded-xl border p-4 text-sm ${
            result.success
              ? "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200"
              : "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200"
          }`}
        >
          {result.success ? "✅" : "❌"} {result.message}
        </div>
      )}
    </div>
  );
}

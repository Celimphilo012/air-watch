import { useState, useEffect } from "react";
import api from "../api";
import { MapPin, Plus, Trash2, AlertCircle } from "lucide-react";

export default function ZonesPage() {
  const [zones, setZones]     = useState([]);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding]   = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState("");

  const fetchZones = () => {
    setLoading(true);
    api.get("/api/zones")
      .then(r => setZones(r.data))
      .catch(e => setError(e.response?.data?.error || "Failed to load zones."))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchZones(); }, []);

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setAdding(true);
    setError("");
    setSuccess("");
    try {
      const r = await api.post("/api/zones", { name });
      setSuccess(r.data.message);
      setNewName("");
      fetchZones();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to add zone.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (zone) => {
    if (!window.confirm(`Remove zone "${zone.name}"? This does not delete existing data.`)) return;
    setError("");
    setSuccess("");
    try {
      const r = await api.delete(`/api/zones/${zone.id}`);
      setSuccess(r.data.message);
      fetchZones();
    } catch (e) {
      setError(e.response?.data?.error || "Failed to remove zone.");
    }
  };

  return (
    <div className="space-y-6 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Manage Industrial Zones
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Add or remove monitoring zones. Zones are used during data upload and forecasting.
        </p>
      </div>

      {/* add zone */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <p className="text-sm font-semibold text-gray-800 dark:text-gray-100 mb-3">
          Add New Zone
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleAdd()}
            placeholder="Zone name, e.g. Nhlangano"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm
                       focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !newName.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700
                       disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            <Plus size={15} />
            {adding ? "Adding…" : "Add"}
          </button>
        </div>
      </div>

      {/* feedback */}
      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4">
          <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950 p-4">
          <p className="text-sm text-green-800 dark:text-green-200">✅ {success}</p>
        </div>
      )}

      {/* zone list */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
        {loading ? (
          <p className="text-sm text-gray-400 p-5 text-center">Loading zones…</p>
        ) : zones.length === 0 ? (
          <p className="text-sm text-gray-400 p-5 text-center">No zones configured.</p>
        ) : (
          zones.map(zone => (
            <div key={zone.id} className="flex items-center justify-between px-5 py-3">
              <div className="flex items-center gap-3">
                <MapPin size={15} className="text-blue-500 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {zone.name}
                  </p>
                  <p className="text-xs text-gray-400">
                    Added {zone.created_at ? zone.created_at.slice(0, 10) : "—"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(zone)}
                className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50
                           dark:hover:bg-red-950 transition-colors"
                title={`Remove ${zone.name}`}
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))
        )}
      </div>

      <div className="rounded-xl border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-950 p-4">
        <p className="text-xs text-yellow-800 dark:text-yellow-300">
          <strong>Note:</strong> Removing a zone does not delete historical readings for that zone.
          It only prevents future uploads from mapping data to it.
        </p>
      </div>
    </div>
  );
}

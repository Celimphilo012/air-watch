import { useEffect, useState } from "react";
import api from "../api";
import { Trash2, UserPlus } from "lucide-react";

const ROLES = [
  { value: "environmental_officer", label: "Environmental Officer" },
  { value: "researcher", label: "Researcher / Analyst" },
  { value: "admin", label: "System Administrator" },
];

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    username: "",
    name: "",
    password: "",
    role: "researcher",
  });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchUsers = () => {
    api
      .get("/api/users")
      .then((r) => setUsers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleAdd = async () => {
    setAdding(true);
    setError("");
    setSuccess("");
    try {
      const r = await api.post("/api/users", form);
      setSuccess(r.data.message);
      setForm({ username: "", name: "", password: "", role: "researcher" });
      fetchUsers();
    } catch (err) {
      setError(err.response?.data?.error || "Failed to add user.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id, username) => {
    if (!confirm(`Remove user '${username}'?`)) return;
    try {
      await api.delete(`/api/users/${id}`);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || "Delete failed.");
    }
  };

  const ROLE_BADGE = {
    environmental_officer:
      "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
    researcher:
      "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
    admin: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Manage Users
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Admin access only.
        </p>
      </div>

      {/* current users */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Current Users
        </h2>
        {loading ? (
          <p className="text-gray-400 text-sm">Loading...</p>
        ) : (
          <div className="space-y-2">
            {users.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 rounded-lg
                                        bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {u.name}
                  </p>
                  <p className="text-xs text-gray-400 font-mono">
                    {u.username}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[u.role] || ""}`}
                  >
                    {ROLES.find((r) => r.value === u.role)?.label || u.role}
                  </span>
                  <button
                    onClick={() => handleDelete(u.id, u.username)}
                    className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* add user */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-2">
          <UserPlus size={18} /> Add New User
        </h2>
        <div className="grid grid-cols-2 gap-4">
          {[
            {
              label: "Username",
              key: "username",
              type: "text",
              placeholder: "pmthethwa",
            },
            {
              label: "Full Name",
              key: "name",
              type: "text",
              placeholder: "Phiwa Mthethwa",
            },
            {
              label: "Password",
              key: "password",
              type: "password",
              placeholder: "••••••••",
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
              Role
            </label>
            <select
              value={form.role}
              onChange={(e) => set("role", e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                         bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            ❌ {error}
          </p>
        )}
        {success && (
          <p className="mt-3 text-sm text-green-600 dark:text-green-400">
            ✅ {success}
          </p>
        )}
        <button
          onClick={handleAdd}
          disabled={adding}
          className="mt-4 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                     text-white text-sm font-medium transition-colors"
        >
          {adding ? "Adding..." : "+ Add User"}
        </button>
      </div>
    </div>
  );
}

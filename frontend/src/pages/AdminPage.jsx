import { useEffect, useState } from "react";
import api from "../api";
import { Trash2, UserPlus, Pencil, X } from "lucide-react";

const ROLES = [
  { value: "environmental_officer", label: "Environmental Officer" },
  { value: "researcher", label: "Researcher / Analyst" },
  { value: "admin", label: "System Administrator" },
];

const ROLE_BADGE = {
  environmental_officer:
    "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200",
  researcher:
    "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
  admin: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
};

const inputCls =
  "mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 " +
  "bg-white dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 " +
  "focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // add-user form
  const [form, setForm] = useState({ username: "", name: "", password: "", role: "researcher" });
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // edit modal
  const [editUser, setEditUser] = useState(null); // null | {id, username, name, role, password:""}
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // delete confirm modal
  const [deleteConfirm, setDeleteConfirm] = useState(null); // null | {id, username}
  const [deleting, setDeleting] = useState(false);

  const fetchUsers = () => {
    api
      .get("/api/users")
      .then((r) => setUsers(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, []);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setEdit = (k, v) => setEditUser((u) => ({ ...u, [k]: v }));

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

  const openEdit = (u) =>
    setEditUser({ id: u.id, username: u.username, name: u.name, role: u.role, password: "" });

  const handleSaveEdit = async () => {
    setEditSaving(true);
    setEditError("");
    try {
      await api.put(`/api/users/${editUser.id}`, editUser);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setEditError(err.response?.data?.error || "Update failed.");
    } finally {
      setEditSaving(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/users/${deleteConfirm.id}`);
      setDeleteConfirm(null);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || "Delete failed.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Manage Users</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Admin access only.</p>
      </div>

      {/* current users */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200 mb-4">Current Users</h2>
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
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{u.name}</p>
                  <p className="text-xs text-gray-400 font-mono">{u.username}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_BADGE[u.role] || ""}`}>
                    {ROLES.find((r) => r.value === u.role)?.label || u.role}
                  </span>
                  <button
                    onClick={() => openEdit(u)}
                    title="Edit user"
                    className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950 transition-colors"
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm({ id: u.id, username: u.username })}
                    title="Delete user"
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
            { label: "Username", key: "username", type: "text", placeholder: "pmthethwa" },
            { label: "Full Name", key: "name", type: "text", placeholder: "Phiwa Mthethwa" },
            { label: "Password", key: "password", type: "password", placeholder: "••••••••" },
          ].map(({ label, key, type, placeholder }) => (
            <div key={key}>
              <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
              <input
                type={type}
                value={form[key]}
                onChange={(e) => set(key, e.target.value)}
                placeholder={placeholder}
                className={inputCls}
              />
            </div>
          ))}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400">Role</label>
            <select value={form.role} onChange={(e) => set("role", e.target.value)} className={inputCls}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>
        {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">&#10060; {error}</p>}
        {success && <p className="mt-3 text-sm text-green-600 dark:text-green-400">&#9989; {success}</p>}
        <button
          onClick={handleAdd}
          disabled={adding}
          className="mt-4 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                     text-white text-sm font-medium transition-colors"
        >
          {adding ? "Adding..." : "+ Add User"}
        </button>
      </div>

      {/* edit modal */}
      {editUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700
                          shadow-xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-800 dark:text-gray-200">Edit User</h2>
              <button onClick={() => setEditUser(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              {[
                { label: "Full Name", key: "name", type: "text" },
                { label: "Username", key: "username", type: "text" },
                { label: "New Password", key: "password", type: "password", placeholder: "Leave blank to keep current" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="text-xs text-gray-500 dark:text-gray-400">{label}</label>
                  <input
                    type={type}
                    value={editUser[key]}
                    onChange={(e) => setEdit(key, e.target.value)}
                    placeholder={placeholder || ""}
                    className={inputCls}
                  />
                </div>
              ))}
              <div>
                <label className="text-xs text-gray-500 dark:text-gray-400">Role</label>
                <select value={editUser.role} onChange={(e) => setEdit("role", e.target.value)} className={inputCls}>
                  {ROLES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            </div>
            {editError && <p className="text-sm text-red-600 dark:text-red-400">&#10060; {editError}</p>}
            <div className="flex justify-end gap-3 pt-1">
              <button
                onClick={() => setEditUser(null)}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                           text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-60
                           text-white text-sm font-medium transition-colors"
              >
                {editSaving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* delete confirmation modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700
                          shadow-xl w-full max-w-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-800 dark:text-gray-200">Delete User</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to remove{" "}
              <span className="font-mono font-medium text-gray-800 dark:text-gray-200">
                {deleteConfirm.username}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700
                           text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60
                           text-white text-sm font-medium transition-colors"
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STANDARD";
  active: boolean;
  createdAt: string;
}

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  details: string | null;
  createdAt: string;
  user: { name: string; email: string; role: string } | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "changeme", role: "STANDARD" });

  async function load() {
    const res = await fetch("/api/users");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (res.status === 403) {
      setError("Administrator access is required.");
      return;
    }
    const data = await res.json();
    setUsers(data.users || []);
    setAudit(data.auditLogs || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function post(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Request failed");
      return;
    }
    await load();
  }

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white">Users and audit</h1>
        <p className="mt-1 text-xs text-slate-400">
          Admins manage the directory. Standard users can see every site and edit only what is inside racks.
        </p>
      </div>
      {error && <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</div>}

      <form
        className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-5"
        onSubmit={(e) => {
          e.preventDefault();
          post({ action: "CREATE_USER", ...form });
          setForm({ name: "", email: "", password: "changeme", role: "STANDARD" });
        }}
      >
        <input
          required
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
        />
        <input
          required
          type="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
        />
        <input
          required
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
        />
        <select
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs"
        >
          <option value="STANDARD">STANDARD</option>
          <option value="ADMIN">ADMIN</option>
        </select>
        <button className="rounded bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950">Create user</button>
      </form>

      <div className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2">Person</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Reset password</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-3 py-2">
                  <div className="font-semibold text-white">{user.name}</div>
                  <div className="text-slate-500">{user.email}</div>
                </td>
                <td className="px-3 py-2">
                  <select
                    value={user.role}
                    className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                    onChange={(e) => post({ action: "UPDATE_USER", userId: user.id, role: e.target.value })}
                  >
                    <option value="STANDARD">STANDARD</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </td>
                <td className="px-3 py-2">
                  <button
                    className={user.active ? "text-emerald-300" : "text-rose-300"}
                    onClick={() => post({ action: "UPDATE_USER", userId: user.id, active: !user.active })}
                  >
                    {user.active ? "Active" : "Disabled"}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <form
                    className="flex gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const fd = new FormData(e.currentTarget);
                      post({ action: "UPDATE_USER", userId: user.id, newPassword: fd.get("newPassword") });
                      e.currentTarget.reset();
                    }}
                  >
                    <input name="newPassword" placeholder="New password" className="w-36 rounded border border-slate-700 bg-slate-950 px-2 py-1" />
                    <button className="text-cyan-300">Set</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Recent changes</h2>
        <div className="space-y-2 text-xs">
          {audit.map((row) => (
            <div key={row.id} className="flex flex-wrap justify-between gap-2 border-b border-slate-800 pb-2">
              <span className="text-slate-200">
                <span className="font-semibold text-cyan-300">{row.action}</span> {row.details}
              </span>
              <span className="text-slate-500">
                {row.user?.name || "system"} · {new Date(row.createdAt).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

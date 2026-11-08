"use client";

import React, { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import {
  AlertBanner,
  Field,
  Modal,
  ModalFooter,
  PageHeader,
  SectionCard,
  btnPrimary,
  btnSecondary,
  compactInputClass,
  inputClass,
  tableClasses,
} from "@/components/ui/primitives";

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
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState("");
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

  async function post(body: Record<string, unknown>, message?: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return false;
      }
      if (message) setNotice(message);
      await load();
      return true;
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        kicker="Directory & Access Control"
        icon={<Users className="h-3.5 w-3.5" />}
        title="Users and audit"
        subtitle="Admins manage the directory. Standard users can see every site and edit only what is inside racks."
        actions={
          <button
            type="button"
            onClick={() => {
              setError(null);
              setCreateOpen(true);
            }}
            className={btnPrimary}
          >
            <Plus className="h-3.5 w-3.5" />
            Create user
          </button>
        }
      />

      {!createOpen && !resetTarget && <AlertBanner error={error} notice={notice} />}

      <SectionCard
        title="Operator directory"
        subtitle={`${users.length} ${users.length === 1 ? "account" : "accounts"} configured`}
      >
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead className={tableClasses.thead}>
              <tr>
                <th className={tableClasses.th}>Person</th>
                <th className={tableClasses.th}>Role</th>
                <th className={tableClasses.th}>State</th>
                <th className={tableClasses.thRight}>Password</th>
              </tr>
            </thead>
            <tbody className={tableClasses.tbody}>
              {users.map((user) => (
                <tr key={user.id} className={tableClasses.tr}>
                  <td className={tableClasses.td}>
                    <div className="font-semibold text-white">{user.name}</div>
                    <div className="text-slate-500">{user.email}</div>
                  </td>
                  <td className={tableClasses.td}>
                    <select
                      aria-label={`Role for ${user.name}`}
                      value={user.role}
                      className={compactInputClass}
                      onChange={(e) =>
                        void post(
                          { action: "UPDATE_USER", userId: user.id, role: e.target.value },
                          `Updated role for ${user.name}.`
                        )
                      }
                    >
                      <option value="STANDARD">STANDARD</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className={tableClasses.td}>
                    <button
                      type="button"
                      className={user.active ? "font-semibold text-emerald-300 hover:underline" : "font-semibold text-rose-300 hover:underline"}
                      onClick={() =>
                        void post(
                          { action: "UPDATE_USER", userId: user.id, active: !user.active },
                          `${user.name} ${user.active ? "disabled" : "activated"}.`
                        )
                      }
                    >
                      {user.active ? "Active" : "Disabled"}
                    </button>
                  </td>
                  <td className={tableClasses.tdRight}>
                    <button
                      type="button"
                      onClick={() => {
                        setError(null);
                        setNewPassword("");
                        setResetTarget(user);
                      }}
                      className={btnSecondary}
                    >
                      Reset password
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Recent changes"
        subtitle="Audit trail across facility, power, catalog, and rack operations"
      >
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead className={tableClasses.thead}>
              <tr>
                <th className={tableClasses.th}>Action</th>
                <th className={tableClasses.th}>Details</th>
                <th className={tableClasses.th}>Operator</th>
                <th className={tableClasses.thRight}>Timestamp</th>
              </tr>
            </thead>
            <tbody className={tableClasses.tbody}>
              {audit.map((row) => (
                <tr key={row.id} className={tableClasses.tr}>
                  <td className={`${tableClasses.td} font-semibold text-cyan-300`}>{row.action}</td>
                  <td className={`${tableClasses.td} text-slate-200`}>{row.details || row.entityType}</td>
                  <td className={tableClasses.td}>{row.user?.name || "system"}</td>
                  <td className={`${tableClasses.tdRight} text-slate-500`}>
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {createOpen && (
        <Modal title="Create user" onClose={() => setCreateOpen(false)}>
          <AlertBanner error={error} />
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await post({ action: "CREATE_USER", ...form }, `Created ${form.name}.`);
              if (ok) {
                setForm({ name: "", email: "", password: "changeme", role: "STANDARD" });
                setCreateOpen(false);
              }
            }}
          >
            <Field label="Name">
              <input
                required
                placeholder="Name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input
                required
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Initial password">
                <input
                  required
                  placeholder="Password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Role">
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className={inputClass}
                >
                  <option value="STANDARD">STANDARD</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </Field>
            </div>
            <ModalFooter
              onCancel={() => setCreateOpen(false)}
              submitLabel="Create user"
              saving={saving}
            />
          </form>
        </Modal>
      )}

      {resetTarget && (
        <Modal
          title={`Reset password — ${resetTarget.name}`}
          onClose={() => setResetTarget(null)}
        >
          <AlertBanner error={error} />
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await post(
                { action: "UPDATE_USER", userId: resetTarget.id, newPassword },
                `Password updated for ${resetTarget.name}.`
              );
              if (ok) {
                setNewPassword("");
                setResetTarget(null);
              }
            }}
          >
            <Field label="New password" hint={`Updating credentials for ${resetTarget.email}`}>
              <input
                required
                name="newPassword"
                placeholder="New password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClass}
              />
            </Field>
            <ModalFooter
              onCancel={() => setResetTarget(null)}
              submitLabel="Set password"
              saving={saving}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Catalog {
  counts: { sites: number; rooms: number; racks: number; devices: number; users: number };
  entities: { key: string; label: string }[];
  scenarios: { id: string; name: string; summary: string }[];
}

export default function SystemManagementPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [entity, setEntity] = useState("racks");
  const [confirmWipe, setConfirmWipe] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await fetch("/api/system");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "System management is unavailable");
      return;
    }
    setCatalog(data);
    if (data.entities?.[0] && !data.entities.some((item: { key: string }) => item.key === entity)) {
      setEntity(data.entities[0].key);
    }
  }

  useEffect(() => {
    load();
    // The catalog is loaded once when the page opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Request failed");
        return;
      }
      setMessage(
        body.action === "IMPORT_CSV"
          ? `Imported ${data.written} rows.`
          : "Infrastructure updated. Accounts were left in place."
      );
      setConfirmWipe("");
      await load();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function onSnapshotFile(file: File | undefined) {
    if (!file) return;
    const text = await file.text();
    let snapshot: unknown;
    try {
      snapshot = JSON.parse(text);
    } catch {
      setError("That file is not JSON.");
      return;
    }
    if (!window.confirm("Replace the current infrastructure with this snapshot? Accounts stay.")) {
      return;
    }
    await post({ action: "IMPORT_SNAPSHOT", snapshot });
  }

  async function onCsvFile(file: File | undefined) {
    if (!file) return;
    const csv = await file.text();
    await post({ action: "IMPORT_CSV", entity, csv });
  }

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <div className="border-b border-slate-800 pb-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
          System management
        </div>
        <h1 className="mt-1 text-2xl font-bold text-white">Data, import, and demo scenarios</h1>
        <p className="mt-1 max-w-3xl text-xs text-slate-400">
          Snapshots and wipes replace sites, rooms, racks, power, and devices. Signed-in accounts stay.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-3 py-2 text-xs text-emerald-200">
          {message}
        </div>
      )}

      {catalog && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {(
            [
              ["Sites", catalog.counts.sites],
              ["Rooms", catalog.counts.rooms],
              ["Racks", catalog.counts.racks],
              ["Devices", catalog.counts.devices],
              ["Users", catalog.counts.users],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/70 px-4 py-3">
              <div className="text-[11px] uppercase tracking-wider text-slate-500">{label}</div>
              <div className="mt-1 text-xl font-semibold text-white">{value}</div>
            </div>
          ))}
        </div>
      )}

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-bold text-white">Database snapshot</h2>
        <p className="text-xs text-slate-400">
          JSON of the infrastructure tables. Import replaces what is there now and keeps user accounts.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <a
            href="/api/system?format=json"
            className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-100"
          >
            Export JSON
          </a>
          <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200">
            Import JSON
            <input
              type="file"
              accept="application/json,.json"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                void onSnapshotFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-5">
        <h2 className="text-sm font-bold text-white">CSV by entity</h2>
        <p className="text-xs text-slate-400">
          One table at a time. Import upserts rows by id and creates rows that have no id. Parent ids in the file must already exist.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white"
          >
            {(catalog?.entities || [{ key: "racks", label: "Racks" }]).map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          <a
            href={`/api/system?format=csv&entity=${encodeURIComponent(entity)}`}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200"
          >
            Export CSV
          </a>
          <label className="cursor-pointer rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200">
            Import CSV
            <input
              type="file"
              accept="text/csv,.csv"
              className="hidden"
              disabled={busy}
              onChange={(event) => {
                void onCsvFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-bold text-white">Demo scenarios</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {(catalog?.scenarios || []).map((scenario) => (
            <div key={scenario.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
              <div className="text-sm font-semibold text-white">{scenario.name}</div>
              <p className="mt-1 text-xs text-slate-400">{scenario.summary}</p>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (
                    window.confirm(
                      `Replace the current infrastructure with “${scenario.name}”? Accounts stay.`
                    )
                  ) {
                    void post({ action: "PROVISION", scenario: scenario.id, confirm: "REPLACE" });
                  }
                }}
                className="mt-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100 disabled:opacity-50"
              >
                Provision
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-3 rounded-xl border border-rose-500/30 bg-rose-950/20 p-5">
        <h2 className="text-sm font-bold text-rose-100">Wipe infrastructure</h2>
        <p className="text-xs text-rose-200/80">
          Deletes sites, rooms, racks, power, cooling, and devices. User accounts and the audit trail stay.
        </p>
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void post({ action: "WIPE", confirm: confirmWipe });
          }}
        >
          <input
            value={confirmWipe}
            onChange={(event) => setConfirmWipe(event.target.value)}
            placeholder="Type WIPE"
            className="w-36 rounded-lg border border-rose-500/40 bg-slate-950 px-3 py-2 text-xs text-white"
          />
          <button
            type="submit"
            disabled={busy || confirmWipe !== "WIPE"}
            className="rounded-lg border border-rose-500/50 bg-rose-500/20 px-3 py-2 text-xs font-semibold text-rose-100 disabled:opacity-40"
          >
            Wipe database
          </button>
        </form>
      </section>
    </div>
  );
}

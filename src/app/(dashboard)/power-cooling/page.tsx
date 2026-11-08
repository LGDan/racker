"use client";

import React, { useEffect, useState } from "react";
import { Plus, Zap } from "lucide-react";
import {
  AlertBanner,
  Field,
  Modal,
  ModalFooter,
  PageHeader,
  SectionCard,
  btnPrimary,
  compactInputClass,
  inputClass,
  tableClasses,
} from "@/components/ui/primitives";

interface Snapshot {
  currentUser: { role: "ADMIN" | "STANDARD" };
  sites: { id: string; name: string; code: string }[];
  rooms: { id: string; name: string; code: string }[];
  racks: { id: string; code: string; name: string }[];
  powerSources: {
    id: string;
    name: string;
    sourceType: string;
    redundancyGroup: string;
    status: string;
    capacityKw: number;
    voltageV: number;
    maxAmps: number;
    batteryRuntimeMins: number | null;
    fuelRuntimeHours: number | null;
    upstreamSourceAId: string | null;
    upstreamSourceBId: string | null;
  }[];
  powerPanels: {
    id: string;
    name: string;
    feedSide: string;
    maxAmpsPerPhase: number;
    voltageLToN: number;
    voltageLToL: number;
    upstreamSource: { name: string };
    room: { name: string };
    circuits: { id: string }[];
  }[];
  powerCircuits: {
    id: string;
    name: string;
    floorSocketLabel: string;
    phaseAllocation: string;
    ratedAmps: number;
    voltageV: number;
    socketType: string;
    panel: { name: string };
    rack: { code: string } | null;
  }[];
  capacity: {
    roomsCooling: {
      roomId: string;
      roomName: string;
      itLoadKw: number;
      onlineCoolingKw: number;
      standbyCoolingKw: number;
      redundancyMode: string;
      nPlusOneCompliant: boolean;
    }[];
  };
}

type ModalKind = "supply" | "panel" | "socket" | "cooling" | null;

export default function PowerCoolingPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [coolingUnits, setCoolingUnits] = useState<
    { id: string; name: string; unitType: string; capacityKw: number; status: string; roomName: string }[]
  >([]);
  const [modal, setModal] = useState<ModalKind>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/infrastructure");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    setSnap(data);
    const units: typeof coolingUnits = [];
    for (const site of data.sites || []) {
      for (const b of site.buildings || []) {
        for (const f of b.floors || []) {
          for (const room of f.rooms || []) {
            for (const cu of room.coolingUnits || []) {
              units.push({ ...cu, roomName: room.name });
            }
          }
        }
      }
    }
    setCoolingUnits(units);
  }

  useEffect(() => {
    load();
  }, []);

  async function mutate(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/power-cooling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
        return false;
      }
      setNotice("Saved.");
      await load();
      return true;
    } finally {
      setSaving(false);
    }
  }

  if (!snap) return <div className="p-8 text-sm text-slate-400">Loading power and cooling plant…</div>;
  const admin = snap.currentUser.role === "ADMIN";

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        kicker="Facility Electrical & Thermal Plant"
        icon={<Zap className="h-3.5 w-3.5" />}
        title="Power chain and cooling"
        subtitle={
          <>
            Utility feeds, generators, transfer switches, UPS systems, three-phase panels, floor whips, and room cooling units.
            {admin ? " Admins can add plant." : " You can view the plant. Rack-level cords are edited in the rack studio."}
          </>
        }
        actions={
          admin ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setModal("supply");
              }}
              className={btnPrimary}
            >
              <Plus className="h-3.5 w-3.5" />
              Add supply
            </button>
          ) : undefined
        }
      />

      {!modal && <AlertBanner error={error} notice={notice} />}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Upstream power supplies</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {snap.powerSources.map((s) => (
            <article key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs">
              <div className="flex items-center justify-between">
                <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
                  {s.sourceType}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                    s.status === "ONLINE"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {s.status}
                </span>
              </div>
              <h3 className="mt-2 font-semibold text-white">{s.name}</h3>
              <p className="mt-1 text-slate-400">
                Bus {s.redundancyGroup} · {s.capacityKw} kW · {s.voltageV} V · {s.maxAmps} A
              </p>
              {s.batteryRuntimeMins ? <p className="mt-1 text-slate-500">{s.batteryRuntimeMins} min battery</p> : null}
              {s.fuelRuntimeHours ? <p className="mt-1 text-slate-500">{s.fuelRuntimeHours} h fuel</p> : null}
            </article>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Room thermal envelopes</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {snap.capacity.roomsCooling.map((room) => (
            <div key={room.roomId} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-white">{room.roomName}</div>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    room.nPlusOneCompliant
                      ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : "border border-rose-500/30 bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {room.nPlusOneCompliant ? "N+1 SAFE" : "DEGRADED"}
                </span>
              </div>
              <div className="mt-1 text-slate-400">
                {room.itLoadKw} kW heat · {room.onlineCoolingKw} kW online · {room.standbyCoolingKw} kW standby · {room.redundancyMode}{" "}
                {room.nPlusOneCompliant ? "holds" : "would miss N+1"}
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard
          title="Panels and phases"
          subtitle="Three-phase distribution panels feeding room floor whips"
          actions={
            admin ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setModal("panel");
                }}
                className={btnPrimary}
              >
                <Plus className="h-3.5 w-3.5" />
                Add panel
              </button>
            ) : undefined
          }
        >
          <div className={tableClasses.wrapper}>
            <table className={tableClasses.table}>
              <thead className={tableClasses.thead}>
                <tr>
                  <th className={tableClasses.th}>Panel</th>
                  <th className={tableClasses.th}>Room</th>
                  <th className={tableClasses.th}>Upstream</th>
                  <th className={tableClasses.th}>Rating</th>
                  <th className={tableClasses.th}>Breakers</th>
                </tr>
              </thead>
              <tbody className={tableClasses.tbody}>
                {snap.powerPanels.map((p) => (
                  <tr key={p.id} className={tableClasses.tr}>
                    <td className={`${tableClasses.td} font-semibold text-white`}>
                      {p.name}
                      <span className="ml-2 text-[11px] font-normal text-slate-400">
                        Feed {p.feedSide}
                      </span>
                    </td>
                    <td className={tableClasses.td}>{p.room.name}</td>
                    <td className={tableClasses.td}>{p.upstreamSource.name}</td>
                    <td className={tableClasses.td}>
                      {p.voltageLToN}/{p.voltageLToL} V · {p.maxAmpsPerPhase} A/phase
                    </td>
                    <td className={tableClasses.td}>{p.circuits.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Floor sockets and breakers"
          subtitle="Whips from distribution panels to rack PDUs"
          actions={
            admin ? (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setModal("socket");
                }}
                className={btnPrimary}
              >
                <Plus className="h-3.5 w-3.5" />
                Add socket
              </button>
            ) : undefined
          }
        >
          <div className="max-h-96 overflow-auto">
            <table className={tableClasses.table}>
              <thead className={tableClasses.thead}>
                <tr>
                  <th className={tableClasses.th}>Socket</th>
                  <th className={tableClasses.th}>Panel</th>
                  <th className={tableClasses.th}>Connector</th>
                  <th className={tableClasses.th}>Rack</th>
                  <th className={tableClasses.thRight}>Phase</th>
                </tr>
              </thead>
              <tbody className={tableClasses.tbody}>
                {snap.powerCircuits.map((c) => (
                  <tr key={c.id} className={tableClasses.tr}>
                    <td className={`${tableClasses.td} font-semibold text-white`}>
                      {c.floorSocketLabel}
                    </td>
                    <td className={tableClasses.td}>{c.panel.name}</td>
                    <td className={tableClasses.td}>
                      {c.ratedAmps} A · {c.socketType}
                    </td>
                    <td className={tableClasses.td}>{c.rack ? c.rack.code : "—"}</td>
                    <td className={tableClasses.tdRight}>
                      {admin ? (
                        <select
                          aria-label={`Phase for ${c.floorSocketLabel}`}
                          value={c.phaseAllocation}
                          className={compactInputClass}
                          onChange={(e) =>
                            void mutate({
                              action: "UPDATE_CIRCUIT_PHASE",
                              circuitId: c.id,
                              phaseAllocation: e.target.value,
                            })
                          }
                        >
                          {["L1", "L2", "L3", "THREE_PHASE"].map((p) => (
                            <option key={p}>{p}</option>
                          ))}
                        </select>
                      ) : (
                        c.phaseAllocation
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Cooling units"
        subtitle="CRAC, CRAH, in-row, and chiller units assigned to data halls"
        actions={
          admin ? (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setModal("cooling");
              }}
              className={btnPrimary}
            >
              <Plus className="h-3.5 w-3.5" />
              Add cooling unit
            </button>
          ) : undefined
        }
      >
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead className={tableClasses.thead}>
              <tr>
                <th className={tableClasses.th}>Unit</th>
                <th className={tableClasses.th}>Type</th>
                <th className={tableClasses.th}>Capacity</th>
                <th className={tableClasses.th}>Room</th>
                <th className={tableClasses.thRight}>Status</th>
              </tr>
            </thead>
            <tbody className={tableClasses.tbody}>
              {coolingUnits.map((cu) => (
                <tr key={cu.id} className={tableClasses.tr}>
                  <td className={`${tableClasses.td} font-semibold text-white`}>{cu.name}</td>
                  <td className={tableClasses.td}>{cu.unitType}</td>
                  <td className={tableClasses.td}>{cu.capacityKw} kW</td>
                  <td className={tableClasses.td}>{cu.roomName}</td>
                  <td className={tableClasses.tdRight}>
                    {admin ? (
                      <select
                        aria-label={`Status for ${cu.name}`}
                        value={cu.status}
                        className={compactInputClass}
                        onChange={(e) =>
                          void mutate({
                            action: "TOGGLE_COOLING_STATUS",
                            id: cu.id,
                            status: e.target.value,
                          })
                        }
                      >
                        {["ONLINE", "STANDBY", "MAINTENANCE", "FAULT"].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400">{cu.status}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {admin && modal === "supply" && (
        <Modal title="Add a supply" onClose={() => setModal(null)}>
          <AlertBanner error={error} />
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const ok = await mutate({
                action: "CREATE_POWER_SOURCE",
                siteId: fd.get("siteId"),
                name: fd.get("name"),
                sourceType: fd.get("sourceType"),
                redundancyGroup: fd.get("redundancyGroup"),
                capacityKw: fd.get("capacityKw"),
                voltageV: 400,
                maxAmps: fd.get("maxAmps"),
                status: fd.get("status"),
                upstreamSourceAId: fd.get("upstream") || null,
              });
              if (ok) setModal(null);
            }}
          >
            <Field label="Site">
              <select name="siteId" className={inputClass} required>
                {snap.sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name">
              <input name="name" required placeholder="Name" className={inputClass} />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Type">
                <select name="sourceType" className={inputClass}>
                  {["UTILITY", "GENERATOR", "ATS", "UPS", "TRANSFORMER"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Bus">
                <select name="redundancyGroup" className={inputClass}>
                  <option>A</option>
                  <option>B</option>
                  <option>SHARED</option>
                </select>
              </Field>
              <Field label="Status">
                <select name="status" className={inputClass}>
                  <option>ONLINE</option>
                  <option>STANDBY</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Capacity (kW)">
                <input name="capacityKw" type="number" defaultValue={500} placeholder="kW" className={inputClass} />
              </Field>
              <Field label="Max current (Amps)">
                <input name="maxAmps" type="number" defaultValue={720} placeholder="Amps" className={inputClass} />
              </Field>
            </div>
            <Field label="Upstream supply">
              <select name="upstream" className={inputClass}>
                <option value="">No upstream</option>
                {snap.powerSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    Fed from {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <ModalFooter
              onCancel={() => setModal(null)}
              submitLabel="Add supply"
              saving={saving}
            />
          </form>
        </Modal>
      )}

      {admin && modal === "panel" && (
        <Modal title="Add distribution panel" onClose={() => setModal(null)}>
          <AlertBanner error={error} />
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const ok = await mutate({
                action: "CREATE_POWER_PANEL",
                roomId: fd.get("roomId"),
                upstreamSourceId: fd.get("upstreamSourceId"),
                name: fd.get("name"),
                feedSide: fd.get("feedSide"),
                maxAmpsPerPhase: fd.get("maxAmpsPerPhase"),
              });
              if (ok) setModal(null);
            }}
          >
            <Field label="Panel name">
              <input name="name" required placeholder="Panel name" className={inputClass} />
            </Field>
            <Field label="Room">
              <select name="roomId" className={inputClass}>
                {snap.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Upstream supply">
              <select name="upstreamSourceId" className={inputClass}>
                {snap.powerSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Feed side">
                <select name="feedSide" className={inputClass}>
                  <option>A</option>
                  <option>B</option>
                </select>
              </Field>
              <Field label="Max amps per phase">
                <input name="maxAmpsPerPhase" type="number" defaultValue={125} className={inputClass} />
              </Field>
            </div>
            <ModalFooter
              onCancel={() => setModal(null)}
              submitLabel="Add panel"
              saving={saving}
            />
          </form>
        </Modal>
      )}

      {admin && modal === "socket" && (
        <Modal title="Add floor socket / whip" onClose={() => setModal(null)}>
          <AlertBanner error={error} />
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const panel = snap.powerPanels.find((p) => p.id === fd.get("panelId"));
              const ok = await mutate({
                action: "CREATE_POWER_CIRCUIT",
                panelId: fd.get("panelId"),
                roomId: fd.get("roomId"),
                rackId: fd.get("rackId") || null,
                name: fd.get("name"),
                floorSocketLabel: fd.get("floorSocketLabel"),
                breakerNumber: snap.powerCircuits.length + 1,
                phaseAllocation: fd.get("phaseAllocation"),
                ratedAmps: fd.get("ratedAmps"),
                socketType: fd.get("socketType"),
                voltageV: panel?.voltageLToN || 230,
              });
              if (ok) setModal(null);
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Whip name">
                <input name="name" required placeholder="Whip name" className={inputClass} />
              </Field>
              <Field label="Floor socket label">
                <input name="floorSocketLabel" required placeholder="Floor socket label" className={inputClass} />
              </Field>
            </div>
            <Field label="Distribution panel">
              <select name="panelId" className={inputClass}>
                {snap.powerPanels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Room">
                <select name="roomId" className={inputClass}>
                  {snap.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Target rack">
                <select name="rackId" className={inputClass}>
                  <option value="">Any rack</option>
                  {snap.racks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Phase">
                <select name="phaseAllocation" className={inputClass}>
                  {["L1", "L2", "L3", "THREE_PHASE"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Rated amps">
                <input name="ratedAmps" type="number" defaultValue={32} className={inputClass} />
              </Field>
              <Field label="Connector">
                <select name="socketType" className={inputClass}>
                  <option>IEC_60309_32A_1P</option>
                  <option>IEC_60309_32A_3P</option>
                  <option>IEC_60309_63A_3P</option>
                </select>
              </Field>
            </div>
            <ModalFooter
              onCancel={() => setModal(null)}
              submitLabel="Add socket"
              saving={saving}
            />
          </form>
        </Modal>
      )}

      {admin && modal === "cooling" && (
        <Modal title="Add cooling unit" onClose={() => setModal(null)}>
          <AlertBanner error={error} />
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const ok = await mutate({
                action: "CREATE_COOLING_UNIT",
                roomId: fd.get("roomId"),
                name: fd.get("name"),
                unitType: fd.get("unitType"),
                capacityKw: fd.get("capacityKw"),
                status: "ONLINE",
              });
              if (ok) setModal(null);
            }}
          >
            <Field label="Unit name">
              <input name="name" required placeholder="Unit name" className={inputClass} />
            </Field>
            <Field label="Room">
              <select name="roomId" className={inputClass}>
                {snap.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Unit type">
                <select name="unitType" className={inputClass}>
                  {["CRAC", "CRAH", "IN_ROW", "CHILLER"].map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Capacity (kW)">
                <input name="capacityKw" type="number" defaultValue={45} className={inputClass} />
              </Field>
            </div>
            <ModalFooter
              onCancel={() => setModal(null)}
              submitLabel="Add unit"
              saving={saving}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

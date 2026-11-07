"use client";

import React, { useEffect, useState } from "react";

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
  roomsFull?: never;
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

export default function PowerCoolingPage() {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [coolingUnits, setCoolingUnits] = useState<
    { id: string; name: string; unitType: string; capacityKw: number; status: string; roomName: string }[]
  >([]);
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
    setError(null);
    setNotice(null);
    const res = await fetch("/api/power-cooling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Update failed");
      return;
    }
    setNotice("Saved.");
    await load();
  }

  if (!snap) return <div className="p-8 text-sm text-slate-400">Loading power and cooling plant…</div>;
  const admin = snap.currentUser.role === "ADMIN";

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <div className="border-b border-slate-800 pb-5">
        <h1 className="text-2xl font-bold text-white">Power chain and cooling</h1>
        <p className="mt-1 text-xs text-slate-400">
          Utility feeds, generators, transfer switches, UPS systems, three-phase panels, floor whips, and room cooling units.
          {admin ? " Admins can add plant." : " You can view the plant. Rack-level cords are edited in the rack studio."}
        </p>
      </div>
      {error && <div className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</div>}
      {notice && <div className="rounded border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">{notice}</div>}

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {snap.powerSources.map((s) => (
          <article key={s.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-cyan-300">{s.sourceType}</span>
              <span className={s.status === "ONLINE" ? "text-emerald-300" : "text-amber-300"}>{s.status}</span>
            </div>
            <h2 className="mt-1 font-semibold text-white">{s.name}</h2>
            <p className="mt-1 text-slate-400">
              Bus {s.redundancyGroup} · {s.capacityKw} kW · {s.voltageV} V · {s.maxAmps} A
            </p>
            {s.batteryRuntimeMins ? <p className="text-slate-500">{s.batteryRuntimeMins} min battery</p> : null}
            {s.fuelRuntimeHours ? <p className="text-slate-500">{s.fuelRuntimeHours} h fuel</p> : null}
          </article>
        ))}
      </section>

      {admin && (
        <form
          className="grid gap-2 rounded-xl border border-slate-800 bg-slate-900/50 p-4 md:grid-cols-6"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            mutate({
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
            e.currentTarget.reset();
          }}
        >
          <h2 className="text-sm font-semibold text-white md:col-span-6">Add a supply</h2>
          <select name="siteId" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs" required>
            {snap.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code}
              </option>
            ))}
          </select>
          <input name="name" required placeholder="Name" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs md:col-span-2" />
          <select name="sourceType" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
            {["UTILITY", "GENERATOR", "ATS", "UPS", "TRANSFORMER"].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
          <select name="redundancyGroup" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
            <option>A</option>
            <option>B</option>
            <option>SHARED</option>
          </select>
          <select name="status" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
            <option>ONLINE</option>
            <option>STANDBY</option>
          </select>
          <input name="capacityKw" type="number" defaultValue={500} className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs" placeholder="kW" />
          <input name="maxAmps" type="number" defaultValue={720} className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs" placeholder="Amps" />
          <select name="upstream" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs md:col-span-2">
            <option value="">No upstream</option>
            {snap.powerSources.map((s) => (
              <option key={s.id} value={s.id}>
                Fed from {s.name}
              </option>
            ))}
          </select>
          <button className="rounded bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950">Add supply</button>
        </form>
      )}

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Panels and phases</h2>
          <div className="space-y-3 text-xs">
            {snap.powerPanels.map((p) => (
              <div key={p.id} className="rounded-lg border border-slate-800 p-3">
                <div className="font-semibold text-white">{p.name}</div>
                <div className="text-slate-400">
                  {p.room.name} · from {p.upstreamSource.name} · {p.voltageLToN}/{p.voltageLToL} V · {p.maxAmpsPerPhase} A/phase · {p.circuits.length} breakers
                </div>
              </div>
            ))}
          </div>
          {admin && (
            <form
              className="mt-4 grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                mutate({
                  action: "CREATE_POWER_PANEL",
                  roomId: fd.get("roomId"),
                  upstreamSourceId: fd.get("upstreamSourceId"),
                  name: fd.get("name"),
                  feedSide: fd.get("feedSide"),
                  maxAmpsPerPhase: fd.get("maxAmpsPerPhase"),
                });
                e.currentTarget.reset();
              }}
            >
              <input name="name" required placeholder="Panel name" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs" />
              <select name="roomId" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
                {snap.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select name="upstreamSourceId" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
                {snap.powerSources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <select name="feedSide" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
                  <option>A</option>
                  <option>B</option>
                </select>
                <input name="maxAmpsPerPhase" type="number" defaultValue={125} className="w-28 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs" />
                <button className="rounded bg-slate-800 px-3 py-1.5 text-xs text-white">Add panel</button>
              </div>
            </form>
          )}
        </div>

        <div className="rounded-xl border border-slate-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">Floor sockets and breakers</h2>
          <div className="max-h-80 space-y-2 overflow-auto text-xs">
            {snap.powerCircuits.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2">
                <div>
                  <div className="text-slate-100">{c.floorSocketLabel}</div>
                  <div className="text-slate-500">
                    {c.panel.name} · {c.phaseAllocation} · {c.ratedAmps} A · {c.socketType}
                    {c.rack ? ` · ${c.rack.code}` : ""}
                  </div>
                </div>
                {admin && (
                  <select
                    value={c.phaseAllocation}
                    className="rounded border border-slate-700 bg-slate-950 px-1 py-1 text-[11px]"
                    onChange={(e) =>
                      mutate({
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
                )}
              </div>
            ))}
          </div>
          {admin && (
            <form
              className="mt-4 grid gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const panel = snap.powerPanels.find((p) => p.id === fd.get("panelId"));
                mutate({
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
                e.currentTarget.reset();
              }}
            >
              <input name="name" required placeholder="Whip name" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs" />
              <input name="floorSocketLabel" required placeholder="Floor socket label" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs" />
              <select name="panelId" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
                {snap.powerPanels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select name="roomId" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
                {snap.rooms.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <select name="rackId" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
                <option value="">Any rack</option>
                {snap.racks.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <select name="phaseAllocation" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
                  {["L1", "L2", "L3", "THREE_PHASE"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
                <input name="ratedAmps" type="number" defaultValue={32} className="w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs" />
                <select name="socketType" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
                  <option>IEC_60309_32A_1P</option>
                  <option>IEC_60309_32A_3P</option>
                  <option>IEC_60309_63A_3P</option>
                </select>
                <button className="rounded bg-slate-800 px-3 py-1.5 text-xs text-white">Add socket</button>
              </div>
            </form>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-800 p-4">
        <h2 className="mb-3 text-sm font-semibold text-white">Cooling units</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {snap.capacity.roomsCooling.map((room) => (
            <div key={room.roomId} className="rounded-lg border border-slate-800 p-3 text-xs">
              <div className="font-semibold text-white">{room.roomName}</div>
              <div className="text-slate-400">
                {room.itLoadKw} kW heat · {room.onlineCoolingKw} kW online · {room.standbyCoolingKw} kW standby · {room.redundancyMode}{" "}
                {room.nPlusOneCompliant ? "holds" : "would miss N+1"}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2">
          {coolingUnits.map((cu) => (
            <div key={cu.id} className="flex items-center justify-between text-xs">
              <span className="text-slate-200">
                {cu.name} · {cu.unitType} · {cu.capacityKw} kW · {cu.roomName}
              </span>
              {admin ? (
                <select
                  value={cu.status}
                  className="rounded border border-slate-700 bg-slate-950 px-2 py-1"
                  onChange={(e) => mutate({ action: "TOGGLE_COOLING_STATUS", id: cu.id, status: e.target.value })}
                >
                  {["ONLINE", "STANDBY", "MAINTENANCE", "FAULT"].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              ) : (
                <span className="text-slate-400">{cu.status}</span>
              )}
            </div>
          ))}
        </div>
        {admin && (
          <form
            className="mt-4 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              mutate({
                action: "CREATE_COOLING_UNIT",
                roomId: fd.get("roomId"),
                name: fd.get("name"),
                unitType: fd.get("unitType"),
                capacityKw: fd.get("capacityKw"),
                status: "ONLINE",
              });
              e.currentTarget.reset();
            }}
          >
            <input name="name" required placeholder="Unit name" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs" />
            <select name="roomId" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
              {snap.rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
            <select name="unitType" className="rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs">
              {["CRAC", "CRAH", "IN_ROW", "CHILLER"].map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
            <input name="capacityKw" type="number" defaultValue={45} className="w-24 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs" />
            <button className="rounded bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950">Add unit</button>
          </form>
        )}
      </section>
    </div>
  );
}

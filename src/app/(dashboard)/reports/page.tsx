"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";

interface Capacity {
  totals: {
    usedU: number;
    totalU: number;
    freeU: number;
    totalItKw: number;
    freePduOutlets: number;
    totalPduOutlets: number;
    totalOnlineCoolingKw: number;
    spofDevicesCount: number;
  };
  racks: {
    id: string;
    code: string;
    name: string;
    roomName: string;
    siteCode: string;
    usedU: number;
    totalU: number;
    freeU: number;
    largestContiguousFreeU: number;
    currentPowerWatts: number;
    maxPowerWatts: number;
    powerUtilizationPct: number;
    freeOutlets: number;
    totalOutlets: number;
    feedAWatts: number;
    feedBWatts: number;
    spofDeviceCount: number;
  }[];
  pdus: {
    id: string;
    name: string;
    rackCode: string;
    feedSide: string;
    loadWatts: number;
    loadAmps: number;
    maxAmps: number;
    loadPct: number;
    freeOutlets: number;
    totalOutlets: number;
    c13Used: number;
    c13Total: number;
    c19Used: number;
    c19Total: number;
    floorSocketLabel: string | null;
  }[];
  panels: {
    id: string;
    name: string;
    feedSide: string;
    maxAmpsPerPhase: number;
    usedBreakerSlots: number;
    totalBreakerSlots: number;
    maxPhaseLoadPct: number;
    phaseLoad: {
      ampsL1: number;
      ampsL2: number;
      ampsL3: number;
      wattsL1: number;
      wattsL2: number;
      wattsL3: number;
      imbalancePct: number;
    };
  }[];
  roomsCooling: {
    roomName: string;
    siteName: string;
    itLoadKw: number;
    itHeatBtuHr: number;
    onlineCoolingKw: number;
    standbyCoolingKw: number;
    thermalUtilizationPct: number;
    redundancyMode: string;
    nPlusOneCompliant: boolean;
  }[];
  powerSources: {
    name: string;
    sourceType: string;
    redundancyGroup: string;
    status: string;
    loadKw: number;
    capacityKw: number;
    loadPct: number;
    loadAmps: number;
    maxAmps: number;
  }[];
}

function csvEscape(value: unknown) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function download(name: string, rows: unknown[][]) {
  const body = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
  const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [capacity, setCapacity] = useState<Capacity | null>(null);

  useEffect(() => {
    fetch("/api/infrastructure").then(async (res) => {
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      setCapacity(data.capacity);
    });
  }, []);

  if (!capacity) {
    return <div className="p-8 text-sm text-slate-400">Building capacity report…</div>;
  }

  return (
    <div className="space-y-8 p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white">Capacity and phase report</h1>
          <p className="mt-1 text-xs text-slate-400">
            {capacity.totals.usedU} of {capacity.totals.totalU} U occupied · {capacity.totals.totalItKw} kW IT ·{" "}
            {capacity.totals.freePduOutlets} of {capacity.totals.totalPduOutlets} PDU sockets free ·{" "}
            {capacity.totals.totalOnlineCoolingKw} kW cooling online · {capacity.totals.spofDevicesCount} single-corded devices
          </p>
        </div>
        <button
          onClick={() =>
            download("racker-capacity.csv", [
              ["Rack", "Site", "Room", "Used U", "Total U", "Largest free block", "Watts", "Max watts", "Feed A W", "Feed B W", "Free outlets", "SPOF devices"],
              ...capacity.racks.map((r) => [
                r.code,
                r.siteCode,
                r.roomName,
                r.usedU,
                r.totalU,
                r.largestContiguousFreeU,
                r.currentPowerWatts,
                r.maxPowerWatts,
                r.feedAWatts,
                r.feedBWatts,
                r.freeOutlets,
                r.spofDeviceCount,
              ]),
            ])
          }
          className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950"
        >
          Export rack CSV
        </button>
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-800">
        <header className="flex items-center justify-between bg-slate-900 px-4 py-3">
          <h2 className="text-sm font-semibold text-white">Distribution panels</h2>
          <button
            className="text-xs text-cyan-400"
            onClick={() =>
              download("racker-phases.csv", [
                ["Panel", "Feed", "L1 A", "L2 A", "L3 A", "L1 W", "L2 W", "L3 W", "Imbalance %", "Max phase %", "Breakers used"],
                ...capacity.panels.map((p) => [
                  p.name,
                  p.feedSide,
                  p.phaseLoad.ampsL1,
                  p.phaseLoad.ampsL2,
                  p.phaseLoad.ampsL3,
                  p.phaseLoad.wattsL1,
                  p.phaseLoad.wattsL2,
                  p.phaseLoad.wattsL3,
                  p.phaseLoad.imbalancePct,
                  p.maxPhaseLoadPct,
                  `${p.usedBreakerSlots}/${p.totalBreakerSlots}`,
                ]),
              ])
            }
          >
            Export phases
          </button>
        </header>
        <div className="divide-y divide-slate-800">
          {capacity.panels.map((p) => (
            <div key={p.id} className="grid gap-3 bg-slate-950/40 p-4 md:grid-cols-[1.2fr_2fr]">
              <div>
                <div className="text-sm font-semibold text-white">{p.name}</div>
                <div className="text-xs text-slate-400">
                  Feed {p.feedSide} · imbalance {p.phaseLoad.imbalancePct}% · busiest phase {p.maxPhaseLoadPct}% of {p.maxAmpsPerPhase} A
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {(["L1", "L2", "L3"] as const).map((phase) => {
                  const amps = p.phaseLoad[phase === "L1" ? "ampsL1" : phase === "L2" ? "ampsL2" : "ampsL3"];
                  const watts = p.phaseLoad[phase === "L1" ? "wattsL1" : phase === "L2" ? "wattsL2" : "wattsL3"];
                  const pct = Math.min(100, (amps / p.maxAmpsPerPhase) * 100);
                  return (
                    <div key={phase} className="rounded border border-slate-800 p-2">
                      <div className="flex justify-between text-slate-300">
                        <span>{phase}</span>
                        <span className="font-mono">{amps} A</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800">
                        <div className={`h-full ${pct >= 80 ? "bg-rose-400" : "bg-cyan-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 font-mono text-[10px] text-slate-500">{watts.toLocaleString()} W</div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900 text-[11px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2">Rack</th>
              <th className="px-3 py-2">U</th>
              <th className="px-3 py-2">Power</th>
              <th className="px-3 py-2">Sockets</th>
              <th className="px-3 py-2">Redundancy</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {capacity.racks.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <Link href={`/racks/${r.id}`} className="font-semibold text-cyan-300">
                    {r.code}
                  </Link>
                  <div className="text-slate-500">{r.roomName}</div>
                </td>
                <td className="px-3 py-2 font-mono text-slate-200">
                  {r.usedU}/{r.totalU} · gap {r.largestContiguousFreeU}U
                </td>
                <td className="px-3 py-2 font-mono">
                  {r.currentPowerWatts} / {r.maxPowerWatts} W
                  <div className="text-[10px] text-slate-500">
                    A {r.feedAWatts} · B {r.feedBWatts}
                  </div>
                </td>
                <td className="px-3 py-2 font-mono">{r.freeOutlets} free / {r.totalOutlets}</td>
                <td className={`px-3 py-2 ${r.spofDeviceCount ? "text-amber-300" : "text-emerald-300"}`}>
                  {r.spofDeviceCount ? `${r.spofDeviceCount} single-corded` : "A+B"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-800 p-4">
          <h2 className="mb-3 text-sm font-semibold text-white">PDU sockets and amps</h2>
          <div className="space-y-2 text-xs">
            {capacity.pdus.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b border-slate-800/80 pb-2">
                <div>
                  <div className="text-slate-100">{p.name}</div>
                  <div className="text-slate-500">
                    {p.rackCode} · feed {p.feedSide} · {p.floorSocketLabel || "no floor socket"}
                  </div>
                </div>
                <div className="text-right font-mono text-slate-300">
                  {p.loadAmps}/{p.maxAmps} A · {p.loadPct}%
                  <div className="text-[10px] text-slate-500">
                    C13 {p.c13Total - p.c13Used}/{p.c13Total} · C19 {p.c19Total - p.c19Used}/{p.c19Total}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 p-4">
            <h2 className="mb-3 text-sm font-semibold text-white">Room thermal margin</h2>
            {capacity.roomsCooling.map((r) => (
              <div key={r.roomName} className="mb-3 text-xs">
                <div className="flex justify-between text-slate-200">
                  <span>{r.roomName}</span>
                  <span>{r.thermalUtilizationPct}%</span>
                </div>
                <div className="text-slate-500">
                  {r.itLoadKw} kW · {r.itHeatBtuHr.toLocaleString()} BTU/h · {r.onlineCoolingKw} kW online · {r.redundancyMode}{" "}
                  {r.nPlusOneCompliant ? "holds" : "short"}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-800">
                  <div className="h-full bg-sky-400" style={{ width: `${Math.min(100, r.thermalUtilizationPct)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-xl border border-slate-800 p-4 text-xs">
            <h2 className="mb-3 text-sm font-semibold text-white">Upstream supply headroom</h2>
            {capacity.powerSources.map((s) => (
              <div key={s.name} className="mb-2 flex justify-between gap-3">
                <span className="text-slate-300">
                  {s.sourceType} {s.redundancyGroup} · {s.name}
                </span>
                <span className="font-mono text-slate-400">
                  {s.loadKw}/{s.capacityKw} kW · {s.loadAmps}/{s.maxAmps} A
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

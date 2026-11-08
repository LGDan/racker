"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import {
  PageHeader,
  SectionCard,
  SortHeader,
  btnPrimary,
  btnSecondary,
  tableClasses,
  useTableSort,
} from "@/components/ui/primitives";

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

  const racksSort = useTableSort(
    capacity?.racks ?? [],
    {
      code: (r) => r.code,
      usedU: (r) => r.usedU,
      power: (r) => r.currentPowerWatts,
      sockets: (r) => r.freeOutlets,
      redundancy: (r) => r.spofDeviceCount,
    },
    "code"
  );

  const pdusSort = useTableSort(
    capacity?.pdus ?? [],
    {
      name: (p) => p.name,
      rack: (p) => `${p.rackCode} ${p.feedSide}`,
      whip: (p) => p.floorSocketLabel ?? "",
      load: (p) => p.loadPct,
      sockets: (p) => p.freeOutlets,
    },
    "name"
  );

  const suppliesSort = useTableSort(
    capacity?.powerSources ?? [],
    {
      name: (s) => s.name,
      type: (s) => `${s.sourceType} ${s.redundancyGroup}`,
      power: (s) => s.loadKw,
      current: (s) => s.loadAmps,
    },
    "name"
  );

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
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        kicker="Telemetry & Capacity Audit"
        icon={<BarChart3 className="h-3.5 w-3.5" />}
        title="Capacity and phase report"
        subtitle={`${capacity.totals.usedU} of ${capacity.totals.totalU} U occupied · ${capacity.totals.totalItKw} kW IT · ${capacity.totals.freePduOutlets} of ${capacity.totals.totalPduOutlets} PDU sockets free · ${capacity.totals.totalOnlineCoolingKw} kW cooling online · ${capacity.totals.spofDevicesCount} single-corded devices`}
        actions={
          <button
            type="button"
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
            className={btnPrimary}
          >
            Export rack CSV
          </button>
        }
      />

      <SectionCard
        title="Distribution panels"
        subtitle="Three-phase current and balance across L1 / L2 / L3"
        actions={
          <button
            type="button"
            className={btnSecondary}
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
        }
      >
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
      </SectionCard>

      <SectionCard
        title="Rack capacity matrix"
        subtitle="U space, contiguous free blocks, A/B power draw, and socket availability"
      >
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead className={tableClasses.thead}>
              <tr>
                <SortHeader label="Rack" column="code" sortKey={racksSort.sortKey} sortDir={racksSort.sortDir} onSort={racksSort.toggleSort} />
                <SortHeader label="U" column="usedU" sortKey={racksSort.sortKey} sortDir={racksSort.sortDir} onSort={racksSort.toggleSort} />
                <SortHeader label="Power" column="power" sortKey={racksSort.sortKey} sortDir={racksSort.sortDir} onSort={racksSort.toggleSort} />
                <SortHeader label="Sockets" column="sockets" sortKey={racksSort.sortKey} sortDir={racksSort.sortDir} onSort={racksSort.toggleSort} />
                <SortHeader label="Redundancy" column="redundancy" sortKey={racksSort.sortKey} sortDir={racksSort.sortDir} onSort={racksSort.toggleSort} />
              </tr>
            </thead>
            <tbody className={tableClasses.tbody}>
              {racksSort.sorted.map((r) => (
                <tr key={r.id} className={tableClasses.tr}>
                  <td className={tableClasses.td}>
                    <Link href={`/racks/${r.id}`} className="font-semibold text-cyan-300 hover:underline">
                      {r.code}
                    </Link>
                    <div className="text-slate-500">{r.roomName}</div>
                  </td>
                  <td className={`${tableClasses.td} font-mono text-slate-200`}>
                    {r.usedU}/{r.totalU} · gap {r.largestContiguousFreeU}U
                  </td>
                  <td className={`${tableClasses.td} font-mono`}>
                    {r.currentPowerWatts} / {r.maxPowerWatts} W
                    <div className="text-[10px] text-slate-500">
                      A {r.feedAWatts} · B {r.feedBWatts}
                    </div>
                  </td>
                  <td className={`${tableClasses.td} font-mono`}>{r.freeOutlets} free / {r.totalOutlets}</td>
                  <td className={`${tableClasses.td} ${r.spofDeviceCount ? "text-amber-300" : "text-emerald-300"}`}>
                    {r.spofDeviceCount ? `${r.spofDeviceCount} single-corded` : "A+B"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="PDU sockets and amps"
          subtitle="Rack PDU load and free C13 / C19 outlets"
        >
          <div className={tableClasses.wrapper}>
            <table className={tableClasses.table}>
              <thead className={tableClasses.thead}>
                <tr>
                  <SortHeader label="PDU" column="name" sortKey={pdusSort.sortKey} sortDir={pdusSort.sortDir} onSort={pdusSort.toggleSort} />
                  <SortHeader label="Rack / Feed" column="rack" sortKey={pdusSort.sortKey} sortDir={pdusSort.sortDir} onSort={pdusSort.toggleSort} />
                  <SortHeader label="Whip" column="whip" sortKey={pdusSort.sortKey} sortDir={pdusSort.sortDir} onSort={pdusSort.toggleSort} />
                  <SortHeader label="Load" column="load" sortKey={pdusSort.sortKey} sortDir={pdusSort.sortDir} onSort={pdusSort.toggleSort} />
                  <SortHeader label="Free sockets" column="sockets" align="right" sortKey={pdusSort.sortKey} sortDir={pdusSort.sortDir} onSort={pdusSort.toggleSort} />
                </tr>
              </thead>
              <tbody className={tableClasses.tbody}>
                {pdusSort.sorted.map((p) => (
                  <tr key={p.id} className={tableClasses.tr}>
                    <td className={`${tableClasses.td} font-semibold text-white`}>{p.name}</td>
                    <td className={tableClasses.td}>
                      {p.rackCode} · feed {p.feedSide}
                    </td>
                    <td className={tableClasses.td}>{p.floorSocketLabel || "no floor socket"}</td>
                    <td className={`${tableClasses.td} font-mono`}>
                      {p.loadAmps}/{p.maxAmps} A · {p.loadPct}%
                    </td>
                    <td className={`${tableClasses.tdRight} font-mono text-slate-400`}>
                      C13 {p.c13Total - p.c13Used}/{p.c13Total} · C19 {p.c19Total - p.c19Used}/{p.c19Total}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title="Room thermal margin"
            subtitle="IT heat output vs online cooling capacity"
            padded
          >
            <div className="space-y-3">
              {capacity.roomsCooling.map((r) => (
                <div key={r.roomName} className="text-xs">
                  <div className="flex justify-between font-medium text-slate-200">
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
          </SectionCard>

          <SectionCard
            title="Upstream supply headroom"
            subtitle="Load and current across utility feeds, generators, ATS, and UPS"
          >
            <div className={tableClasses.wrapper}>
              <table className={tableClasses.table}>
                <thead className={tableClasses.thead}>
                  <tr>
                    <SortHeader label="Supply" column="name" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                    <SortHeader label="Type / Bus" column="type" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                    <SortHeader label="Power" column="power" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                    <SortHeader label="Current" column="current" align="right" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                  </tr>
                </thead>
                <tbody className={tableClasses.tbody}>
                  {suppliesSort.sorted.map((s) => (
                    <tr key={s.name} className={tableClasses.tr}>
                      <td className={`${tableClasses.td} font-semibold text-white`}>{s.name}</td>
                      <td className={tableClasses.td}>
                        {s.sourceType} {s.redundancyGroup}
                      </td>
                      <td className={`${tableClasses.td} font-mono`}>
                        {s.loadKw}/{s.capacityKw} kW
                      </td>
                      <td className={`${tableClasses.tdRight} font-mono text-slate-400`}>
                        {s.loadAmps}/{s.maxAmps} A
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

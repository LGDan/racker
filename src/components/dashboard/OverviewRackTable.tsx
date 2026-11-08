"use client";

import React from "react";
import Link from "next/link";
import { ArrowUpRight, CheckCircle2 } from "lucide-react";
import { SortHeader, tableClasses, useTableSort } from "@/components/ui/primitives";

export interface OverviewRackRow {
  id: string;
  code: string;
  name: string;
  siteCode: string;
  roomName: string;
  usedU: number;
  totalU: number;
  freeU: number;
  uUtilizationPct: number;
  currentPowerWatts: number;
  maxPowerWatts: number;
  feedAWatts: number;
  feedBWatts: number;
  freeOutlets: number;
  totalOutlets: number;
  spofDeviceCount: number;
}

export function OverviewRackTable({ racks }: { racks: OverviewRackRow[] }) {
  const sort = useTableSort(
    racks,
    {
      code: (r) => r.code,
      location: (r) => `${r.siteCode} ${r.roomName}`,
      usedU: (r) => r.usedU,
      power: (r) => r.currentPowerWatts,
      sockets: (r) => r.freeOutlets,
    },
    "code"
  );

  return (
    <div className={tableClasses.wrapper}>
      <table className={tableClasses.table}>
        <thead className={tableClasses.thead}>
          <tr>
            <SortHeader label="Rack" column="code" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
            <SortHeader label="Location" column="location" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
            <SortHeader label="U Consumed" column="usedU" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
            <SortHeader label="Power Draw (A/B)" column="power" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
            <SortHeader label="PDU Sockets" column="sockets" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
            <th className={tableClasses.thRight}>Action</th>
          </tr>
        </thead>
        <tbody className={tableClasses.tbody}>
          {sort.sorted.map((rack) => (
            <tr key={rack.id} className={tableClasses.tr}>
              <td className="py-3.5 px-4">
                <div className="font-bold text-white flex items-center gap-1.5">
                  {rack.code}
                  {rack.spofDeviceCount > 0 ? (
                    <span
                      title={`${rack.spofDeviceCount} single-corded device(s)`}
                      className="px-1.5 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    >
                      SPOF
                    </span>
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                </div>
                <div className="text-[11px] text-slate-400 truncate max-w-[160px]">
                  {rack.name}
                </div>
              </td>
              <td className="py-3.5 px-4">
                <div className="text-slate-200 font-medium">{rack.siteCode}</div>
                <div className="text-[11px] text-slate-400">{rack.roomName}</div>
              </td>
              <td className="py-3.5 px-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-200">
                    {rack.usedU}/{rack.totalU}U
                  </span>
                  <span className="text-[11px] text-slate-400">
                    {rack.freeU}U free
                  </span>
                </div>
                <div className="w-24 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-cyan-400"
                    style={{ width: `${Math.min(100, rack.uUtilizationPct)}%` }}
                  />
                </div>
              </td>
              <td className="py-3.5 px-4">
                <div className="font-mono text-white font-semibold">
                  {(rack.currentPowerWatts / 1000).toFixed(2)} kW{" "}
                  <span className="text-[11px] font-normal text-slate-400">
                    / {(rack.maxPowerWatts / 1000).toFixed(0)}kW
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  <span className="text-blue-400">A: {rack.feedAWatts}W</span> •{" "}
                  <span className="text-amber-400">B: {rack.feedBWatts}W</span>
                </div>
              </td>
              <td className="py-3.5 px-4">
                <span className="px-2 py-1 rounded bg-slate-800 text-slate-200 font-mono text-[11px]">
                  {rack.freeOutlets} free / {rack.totalOutlets}
                </span>
              </td>
              <td className="py-3.5 px-4 text-right">
                <Link
                  href={`/racks/${rack.id}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 font-medium transition-colors"
                >
                  Open Rack
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

import React from "react";
import Link from "next/link";
import { getFullInfrastructureSnapshot } from "@/lib/capacity-engine";
import { OverviewRackTable } from "@/components/dashboard/OverviewRackTable";
import {
  Building2,
  Server,
  Zap,
  ThermometerSnowflake,
  AlertTriangle,
  ArrowUpRight,
  PlugZap,
  Layers,
  Activity,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function ExecutiveDashboardPage() {
  const snapshot = await getFullInfrastructureSnapshot();
  const { capacity, sites } = snapshot;
  const { totals, racks, panels, roomsCooling, powerSources, alerts } = capacity;

  const uPct =
    totals.totalU > 0
      ? Math.round((totals.usedU / totals.totalU) * 1000) / 10
      : 0;
  const outletPct =
    totals.totalPduOutlets > 0
      ? Math.round((totals.usedPduOutlets / totals.totalPduOutlets) * 1000) / 10
      : 0;

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">
            <Activity className="w-3.5 h-3.5" />
            Live Infrastructure Telemetry & Capacity Rollup
          </div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white mt-1">
            Global Datacenter Operations Center
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time spatial hierarchy, rack U occupancy, PDU socket capacity,
            3-phase L1/L2/L3 balance, and room thermal margins.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/hierarchy"
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
            Floor Plan Explorer
          </Link>
          <Link
            href="/diagrams"
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            Single-Line & Layer Diagrams
          </Link>
          {racks[0] && (
            <Link
              href={`/racks/${racks[0].id}`}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-cyan-500/20"
            >
              <Server className="w-3.5 h-3.5" />
              Open Interactive Rack Studio
            </Link>
          )}
        </div>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Rack Space U Consumed */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Rack U Space Consumed
            </span>
            <Server className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold text-white">
              {totals.usedU}U{" "}
              <span className="text-sm font-normal text-slate-400">
                / {totals.totalU}U
              </span>
            </div>
            <span className="text-xs font-semibold text-cyan-400">{uPct}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full"
              style={{ width: `${Math.min(100, uPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>{totals.freeU}U Available</span>
            <span>
              {totals.rackCount} Racks • {totals.deviceCount} Devices
            </span>
          </div>
        </div>

        {/* Active IT Power Load */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Active IT Power Draw
            </span>
            <Zap className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold text-white">
              {totals.totalItKw} kW
            </div>
            <span className="text-xs font-mono text-amber-300">
              {totals.totalItWatts.toLocaleString()} W
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (totals.totalItKw /
                      Math.max(1, totals.totalOnlineCoolingKw)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>Dual Bus A/B Monitored</span>
            <span>{panels.length} Distribution Panels</span>
          </div>
        </div>

        {/* PDU Socket Availability */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              PDU Sockets Available
            </span>
            <PlugZap className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold text-white">
              {totals.freePduOutlets}{" "}
              <span className="text-sm font-normal text-slate-400">
                free of {totals.totalPduOutlets}
              </span>
            </div>
            <span className="text-xs font-semibold text-emerald-400">
              {outletPct}% used
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${Math.min(100, outletPct)}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>{totals.usedPduOutlets} Corded PSUs</span>
            <span>IEC C13 & High-Amp C19</span>
          </div>
        </div>

        {/* Cooling & Thermal Margin */}
        <div className="p-5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">
              Online Cooling Capacity
            </span>
            <ThermometerSnowflake className="w-4 h-4 text-sky-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <div className="text-2xl font-bold text-white">
              {totals.totalOnlineCoolingKw} kW
            </div>
            <span className="text-xs font-semibold text-sky-400">
              {Math.round(totals.totalItKw * 3412.14).toLocaleString()} BTU/h IT
            </span>
          </div>
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
            <div
              className="h-full bg-sky-500 rounded-full"
              style={{
                width: `${Math.min(
                  100,
                  Math.round(
                    (totals.totalItKw /
                      Math.max(1, totals.totalOnlineCoolingKw)) *
                      100
                  )
                )}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400">
            <span>
              Headroom:{" "}
              {Math.max(
                0,
                Math.round((totals.totalOnlineCoolingKw - totals.totalItKw) * 10) /
                  10
              )}{" "}
              kW
            </span>
            <span>N+1 / 2N Active</span>
          </div>
        </div>
      </div>

      {/* Live Engineering & Capacity Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-400">
              <AlertTriangle className="w-4 h-4" />
              Active Infrastructure & Redundancy Advisories ({alerts.length})
            </div>
            <Link
              href="/reports"
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
            >
              Full Audit Report <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {alerts.map((al, i) => (
              <div
                key={i}
                className={`p-3.5 rounded-lg border flex items-start justify-between gap-3 ${
                  al.severity === "CRITICAL"
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-200"
                    : "bg-amber-500/10 border-amber-500/30 text-amber-200"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-black/30">
                      {al.category}
                    </span>
                    <span className="text-xs font-semibold text-white">
                      {al.title}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {al.description}
                  </p>
                </div>
                {al.entityId && al.category === "REDUNDANCY" && (
                  <Link
                    href={`/racks/${al.entityId}`}
                    className="shrink-0 px-2.5 py-1.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[11px] font-medium border border-amber-500/40"
                  >
                    Fix in Rack
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Two-Column Grid: Racks Capacity Table + 3-Phase Panels & Cooling */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Rack Fleet Status (7 cols) */}
        <div className="xl:col-span-7 rounded-xl bg-slate-900/90 border border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white">
                Rack Fleet Capacity & Power Matrix
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Click any rack to launch the interactive U-slot & PSU/PDU cable
                studio.
              </p>
            </div>
            <Link
              href="/hierarchy"
              className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
            >
              Room Floor Plans <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <OverviewRackTable racks={racks} />
        </div>

        {/* Right Column: 3-Phase Distribution Panels & Room Cooling (5 cols) */}
        <div className="xl:col-span-5 space-y-6">
          {/* 3-Phase Electrical Panels */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  3-Phase Distribution Panels (L1 / L2 / L3)
                </h2>
                <p className="text-xs text-slate-400">
                  Live phase current (Amps) and phase balance across floor whips
                </p>
              </div>
              <Link
                href="/power-cooling"
                className="text-xs text-cyan-400 hover:underline"
              >
                Manage Power
              </Link>
            </div>

            <div className="space-y-3">
              {panels.map((panel) => (
                <div
                  key={panel.id}
                  className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span
                        className={`inline-block w-2 h-2 rounded-full mr-2 ${
                          panel.feedSide === "A" ? "bg-blue-400" : "bg-amber-400"
                        }`}
                      />
                      <span className="text-xs font-bold text-white">
                        {panel.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      Imbalance:{" "}
                      <strong
                        className={
                          panel.phaseLoad.imbalancePct > 15
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }
                      >
                        {panel.phaseLoad.imbalancePct}%
                      </strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    {(["L1", "L2", "L3"] as const).map((phase) => {
                      const amps =
                        phase === "L1"
                          ? panel.phaseLoad.ampsL1
                          : phase === "L2"
                          ? panel.phaseLoad.ampsL2
                          : panel.phaseLoad.ampsL3;
                      const watts =
                        phase === "L1"
                          ? panel.phaseLoad.wattsL1
                          : phase === "L2"
                          ? panel.phaseLoad.wattsL2
                          : panel.phaseLoad.wattsL3;
                      const pct = Math.min(
                        100,
                        Math.round((amps / panel.maxAmpsPerPhase) * 100)
                      );
                      return (
                        <div
                          key={phase}
                          className="p-2 rounded bg-slate-900 border border-slate-800/90"
                        >
                          <div className="flex justify-between text-slate-400 mb-1">
                            <span className="font-bold text-slate-200">
                              {phase}
                            </span>
                            <span className="font-mono text-cyan-300">
                              {amps}A / {panel.maxAmpsPerPhase}A
                            </span>
                          </div>
                          <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                            <div
                              className={`h-full ${
                                pct > 80 ? "bg-rose-500" : "bg-cyan-500"
                              }`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="text-[10px] text-slate-500 mt-1 font-mono">
                            {watts.toLocaleString()} W
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Room Thermal & Cooling Capacity */}
          <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-white">
                  Room Cooling & Thermal Envelopes
                </h2>
                <p className="text-xs text-slate-400">
                  Active CRAC/CRAH/In-Row cooling vs IT heat rejection
                </p>
              </div>
              <Link
                href="/cooling"
                className="text-xs text-cyan-400 hover:underline"
              >
                Cooling Plant
              </Link>
            </div>

            <div className="space-y-3">
              {roomsCooling.map((rc) => (
                <div
                  key={rc.roomId}
                  className="p-3.5 rounded-lg bg-slate-950/70 border border-slate-800 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-bold text-white">
                        {rc.roomName}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {rc.siteName} • Redundancy: {rc.redundancyMode}
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        rc.nPlusOneCompliant
                          ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                      }`}
                    >
                      {rc.nPlusOneCompliant ? "N+1 SAFE" : "DEGRADED"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-slate-400">
                      Heat Output:{" "}
                      <strong className="text-white">{rc.itLoadKw} kW</strong> (
                      {rc.itHeatBtuHr.toLocaleString()} BTU/hr)
                    </span>
                    <span className="text-sky-300 font-mono">
                      {rc.onlineCoolingKw} kW Online (+{rc.standbyCoolingKw} kW
                      Standby)
                    </span>
                  </div>

                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-sky-400"
                      style={{
                        width: `${Math.min(100, rc.thermalUtilizationPct)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Upstream Power Supply Chain Summary Bar */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Upstream Facility Power Supplies (Utility, Generators, ATS & UPS)
            </h2>
            <p className="text-xs text-slate-400">
              Aggregated downstream load and available kW/Amps headroom per
              supply
            </p>
          </div>
          <Link
            href="/diagrams"
            className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
          >
            Interactive Electrical SLD <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {powerSources.map((src) => (
            <div
              key={src.id}
              className="p-3.5 rounded-lg bg-slate-950/80 border border-slate-800 space-y-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300">
                  {src.sourceType} • BUS {src.redundancyGroup}
                </span>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    src.status === "ONLINE"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {src.status}
                </span>
              </div>
              <div className="text-xs font-bold text-white truncate">
                {src.name}
              </div>
              <div className="flex items-baseline justify-between text-xs font-mono">
                <span className="text-slate-300">
                  {src.loadKw} / {src.capacityKw} kW
                </span>
                <span className="text-slate-400">
                  {src.loadAmps} / {src.maxAmps} A
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{ width: `${Math.min(100, src.loadPct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hierarchical Sites Overview */}
      <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-white">
              Global Spatial Hierarchy Tree (Sites → Buildings → Floors → Rooms →
              Rows → Racks)
            </h2>
          </div>
          <Link
            href="/hierarchy"
            className="text-xs text-cyan-400 hover:underline"
          >
            Open Interactive Hierarchy Manager →
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sites.map((site) => (
            <div
              key={site.id}
              className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                <div>
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 mr-2">
                    {site.code}
                  </span>
                  <span className="text-sm font-bold text-white">
                    {site.name}
                  </span>
                </div>
                <span className="text-xs text-slate-400">
                  {site.city}, {site.country} ({site.utilityCapacityKw} kW Grid)
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {site.buildings.map((bldg) => (
                  <div key={bldg.id} className="pl-2 space-y-1.5">
                    <div className="font-semibold text-slate-200">
                      🏢 {bldg.name} ({bldg.code})
                    </div>
                    {bldg.floors.map((fl) => (
                      <div
                        key={fl.id}
                        className="pl-4 border-l border-slate-800 space-y-1.5"
                      >
                        <div className="text-slate-300 font-medium">
                          ↳ {fl.name} (Level {fl.levelNumber})
                        </div>
                        {fl.rooms.map((rm) => (
                          <div
                            key={rm.id}
                            className="pl-4 py-1.5 px-2.5 rounded bg-slate-900/90 border border-slate-800/80 flex flex-wrap items-center justify-between gap-2"
                          >
                            <div>
                              <span className="font-semibold text-cyan-300">
                                {rm.name}
                              </span>{" "}
                              <span className="text-[11px] text-slate-400">
                                ({rm.coolingCapacityKw} kW Cooling •{" "}
                                {rm.rows.length} Rows)
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              {rm.rows.flatMap((rw) =>
                                rw.racks.map((rk) => (
                                  <Link
                                    key={rk.id}
                                    href={`/racks/${rk.id}`}
                                    className="px-2 py-0.5 rounded bg-slate-800 hover:bg-cyan-500/20 text-slate-200 hover:text-cyan-300 border border-slate-700 text-[11px] font-mono"
                                  >
                                    {rk.code}
                                  </Link>
                                ))
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

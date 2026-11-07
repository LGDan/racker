"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

type Layer = "power" | "network" | "cooling" | "spatial";

interface Source {
  id: string;
  name: string;
  sourceType: string;
  redundancyGroup: string;
  status: string;
  capacityKw: number;
  upstreamSourceAId: string | null;
  upstreamSourceBId: string | null;
  batteryRuntimeMins: number | null;
  fuelRuntimeHours: number | null;
}

interface Panel {
  id: string;
  name: string;
  upstreamSourceId: string;
  feedSide: string;
  room: { name: string };
}

interface Circuit {
  id: string;
  panelId: string;
  name: string;
  phaseAllocation: string;
  ratedAmps: number;
  status: string;
}

interface Pdu {
  id: string;
  name: string;
  rackId: string;
  circuitId: string | null;
  feedSide: string;
  status: string;
  rack: { code: string };
}

interface Device {
  id: string;
  name: string;
  deviceType: string;
  rackId: string;
  nominalWatts: number;
  rack: { code: string };
  psus: {
    id: string;
    connectedOutlet: { pdu: { id: string; feedSide: string } } | null;
  }[];
  networkPorts: { id: string; name: string }[];
}

interface Cable {
  id: string;
  label: string;
  cableType: string;
  portA: { id: string; name: string; device: { id: string; name: string; rack: { code: string } } };
  portB: { id: string; name: string; device: { id: string; name: string; rack: { code: string } } };
}

function InfraNode({ data }: { data: { title: string; subtitle: string; tone: string; kind: string } }) {
  return (
    <div className={`min-w-[190px] rounded-lg border px-3 py-2 text-xs shadow-lg ${data.tone}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-70">{data.kind}</div>
      <div className="font-semibold text-white">{data.title}</div>
      <div className="mt-0.5 text-[11px] text-slate-200">{data.subtitle}</div>
    </div>
  );
}

const nodeTypes = { infra: InfraNode };

function sourceAvailable(
  id: string,
  failed: Set<string>,
  sources: Source[],
  memo: Map<string, boolean>
): boolean {
  if (memo.has(id)) return memo.get(id)!;
  const src = sources.find((s) => s.id === id);
  if (!src || failed.has(id) || src.status === "OFFLINE") {
    memo.set(id, false);
    return false;
  }
  const ups = [src.upstreamSourceAId, src.upstreamSourceBId].filter(Boolean) as string[];
  if (ups.length === 0) {
    const ok = src.status !== "OFFLINE";
    memo.set(id, ok);
    return ok;
  }
  memo.set(id, false);
  const ok = ups.some((u) => sourceAvailable(u, failed, sources, memo));
  memo.set(id, ok);
  return ok;
}

export function LayeredVisualizer() {
  const [layer, setLayer] = useState<Layer>("power");
  const [failed, setFailed] = useState<string[]>([]);
  const [snap, setSnap] = useState<{
    sites: {
      id: string;
      name: string;
      code: string;
      buildings: {
        id: string;
        name: string;
        floors: {
          id: string;
          name: string;
          rooms: { id: string; name: string; rows: { racks: { id: string; code: string }[] }[] }[];
        }[];
      }[];
    }[];
    powerSources: Source[];
    powerPanels: Panel[];
    powerCircuits: Circuit[];
    pdus: Pdu[];
    devices: Device[];
    networkCables: Cable[];
    capacity: {
      panels: {
        id: string;
        name: string;
        phaseLoad: { ampsL1: number; ampsL2: number; ampsL3: number; imbalancePct: number };
        maxAmpsPerPhase: number;
      }[];
      roomsCooling: {
        roomId: string;
        roomName: string;
        itLoadKw: number;
        onlineCoolingKw: number;
        standbyCoolingKw: number;
        thermalUtilizationPct: number;
        redundancyMode: string;
        nPlusOneCompliant: boolean;
      }[];
      pdus: { id: string; loadWatts: number; loadPct: number; freeOutlets: number }[];
    };
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/infrastructure");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (res.ok) setSnap(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const failedSet = useMemo(() => new Set(failed), [failed]);

  const graph = useMemo(() => {
    if (!snap) return { nodes: [] as Node[], edges: [] as Edge[] };
    if (layer === "power") return powerGraph(snap, failedSet);
    if (layer === "network") return networkGraph(snap);
    if (layer === "cooling") return coolingGraph(snap);
    return spatialGraph(snap);
  }, [snap, layer, failedSet]);

  const impact = useMemo(() => {
    if (!snap || layer !== "power") return null;
    return blastRadius(snap, failedSet);
  }, [snap, layer, failedSet]);

  if (!snap) {
    return <div className="p-8 text-sm text-slate-400">Loading diagrams…</div>;
  }

  return (
    <div className="flex h-[calc(100vh-0px)] min-h-[720px] flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-bold text-white">Layered diagrams</h1>
          <p className="text-xs text-slate-400">
            Electrical single-line, network patching, cooling, and the spatial tree. Toggle a supply offline to see the blast radius.
          </p>
        </div>
        <div className="flex flex-wrap gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs">
          {(
            [
              ["power", "Electrical SLD"],
              ["network", "Network"],
              ["cooling", "Cooling"],
              ["spatial", "Hierarchy"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setLayer(id)}
              className={`rounded px-3 py-1.5 ${
                layer === id ? "bg-cyan-500/20 text-cyan-200" : "text-slate-400"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3 overflow-auto border-r border-slate-800 p-4 text-xs">
          {layer === "power" ? (
            <>
              <div className="font-semibold text-white">Failure simulation</div>
              <p className="text-slate-400">
                Generators stay available as the alternate path unless you fail them too. A device goes dark only when every corded PSU loses power.
              </p>
              {snap.powerSources.map((s) => (
                <label key={s.id} className="flex items-start gap-2 text-slate-300">
                  <input
                    type="checkbox"
                    checked={failed.includes(s.id)}
                    onChange={() =>
                      setFailed((cur) =>
                        cur.includes(s.id) ? cur.filter((x) => x !== s.id) : [...cur, s.id]
                      )
                    }
                  />
                  <span>
                    <span className="text-white">{s.name}</span>
                    <span className="block text-[10px] text-slate-500">
                      {s.sourceType} · bus {s.redundancyGroup} · {s.status}
                      {s.batteryRuntimeMins ? ` · ${s.batteryRuntimeMins} min battery` : ""}
                      {s.fuelRuntimeHours ? ` · ${s.fuelRuntimeHours} h fuel` : ""}
                    </span>
                  </span>
                </label>
              ))}
              {impact && (
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <div className="font-semibold text-white">Downstream</div>
                  <div className="mt-1 text-rose-300">{impact.dark} devices fully dark</div>
                  <div className="text-amber-300">{impact.degraded} devices on one feed</div>
                  <div className="text-emerald-300">{impact.healthy} devices still redundant</div>
                </div>
              )}
            </>
          ) : (
            <p className="text-slate-400">
              {layer === "network" &&
                "Each edge is a documented patch cable. Colors follow the cable record."}
              {layer === "cooling" &&
                "Room heat output against online CRAC/CRAH/in-row capacity, including N+1 standby."}
              {layer === "spatial" &&
                "Sites, buildings, floors, rooms, and racks. Open a rack from the hierarchy or studio."}
            </p>
          )}
        </aside>
        <div className="min-h-[560px] bg-slate-950">
          <ReactFlow
            nodes={graph.nodes}
            edges={graph.edges}
            nodeTypes={nodeTypes}
            fitView
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#1e293b" gap={18} />
            <Controls />
            <MiniMap pannable zoomable maskColor="rgba(2,6,23,0.7)" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}

function tone(alive: boolean, kind: string) {
  if (!alive) return "border-rose-500/70 bg-rose-950/80";
  if (kind === "GENERATOR") return "border-amber-500/50 bg-amber-950/40";
  if (kind === "UPS") return "border-emerald-500/50 bg-emerald-950/40";
  return "border-slate-600 bg-slate-900";
}

function powerGraph(
  snap: {
    powerSources: Source[];
    powerPanels: Panel[];
    powerCircuits: Circuit[];
    pdus: Pdu[];
    capacity: {
      panels: {
        id: string;
        phaseLoad: { ampsL1: number; ampsL2: number; ampsL3: number; imbalancePct: number };
      }[];
      pdus: { id: string; loadWatts: number; loadPct: number; freeOutlets: number }[];
    };
  },
  failed: Set<string>
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const memo = new Map<string, boolean>();
  const columns: Record<string, number> = {
    UTILITY: 0,
    GENERATOR: 0,
    ATS: 280,
    UPS: 560,
    TRANSFORMER: 280,
  };
  const colCount: Record<string, number> = {};
  for (const s of snap.powerSources) {
    const col = columns[s.sourceType] ?? 0;
    const row = colCount[s.sourceType] || 0;
    colCount[s.sourceType] = row + 1;
    const alive = sourceAvailable(s.id, failed, snap.powerSources, memo);
    nodes.push({
      id: s.id,
      type: "infra",
      position: { x: col, y: row * 120 },
      data: {
        kind: `${s.sourceType} ${s.redundancyGroup}`,
        title: s.name,
        subtitle: alive ? `${s.capacityKw} kW available` : "Offline in this simulation",
        tone: tone(alive, s.sourceType),
      },
    });
    if (s.upstreamSourceAId) {
      edges.push({
        id: `${s.upstreamSourceAId}-${s.id}-a`,
        source: s.upstreamSourceAId,
        target: s.id,
        style: { stroke: "#38bdf8" },
      });
    }
    if (s.upstreamSourceBId) {
      edges.push({
        id: `${s.upstreamSourceBId}-${s.id}-b`,
        source: s.upstreamSourceBId,
        target: s.id,
        style: { stroke: "#f59e0b" },
      });
    }
  }

  snap.powerPanels.forEach((panel, i) => {
    const srcAlive = sourceAvailable(panel.upstreamSourceId, failed, snap.powerSources, memo);
    const phase = snap.capacity.panels.find((p) => p.id === panel.id);
    nodes.push({
      id: panel.id,
      type: "infra",
      position: { x: 860, y: i * 150 },
      data: {
        kind: `Panel feed ${panel.feedSide}`,
        title: panel.name,
        subtitle: phase
          ? `L1 ${phase.phaseLoad.ampsL1}A · L2 ${phase.phaseLoad.ampsL2}A · L3 ${phase.phaseLoad.ampsL3}A · Δ ${phase.phaseLoad.imbalancePct}%`
          : panel.room.name,
        tone: tone(srcAlive, "PANEL"),
      },
    });
    edges.push({
      id: `${panel.upstreamSourceId}-${panel.id}`,
      source: panel.upstreamSourceId,
      target: panel.id,
      style: { stroke: panel.feedSide === "A" ? "#3b82f6" : "#f59e0b" },
    });
  });

  const panelAlive = (panelId: string) => {
    const panel = snap.powerPanels.find((p) => p.id === panelId);
    if (!panel) return false;
    return sourceAvailable(panel.upstreamSourceId, failed, snap.powerSources, memo);
  };

  snap.pdus.forEach((pdu, i) => {
    const circuit = snap.powerCircuits.find((c) => c.id === pdu.circuitId);
    const alive = Boolean(circuit) && panelAlive(circuit!.panelId) && pdu.status !== "OFFLINE" && !failed.has(pdu.id);
    const metric = snap.capacity.pdus.find((p) => p.id === pdu.id);
    nodes.push({
      id: pdu.id,
      type: "infra",
      position: { x: 1180, y: i * 90 },
      data: {
        kind: `${pdu.rack.code} PDU ${pdu.feedSide}`,
        title: pdu.name,
        subtitle: metric ? `${metric.loadWatts} W · ${metric.loadPct}% · ${metric.freeOutlets} free` : "Unfed",
        tone: tone(alive, "PDU"),
      },
    });
    if (circuit) {
      edges.push({
        id: `${circuit.panelId}-${pdu.id}`,
        source: circuit.panelId,
        target: pdu.id,
        label: circuit.phaseAllocation,
        style: { stroke: "#94a3b8" },
      });
    }
  });

  return { nodes, edges };
}

function blastRadius(
  snap: {
    powerSources: Source[];
    powerPanels: Panel[];
    powerCircuits: Circuit[];
    pdus: Pdu[];
    devices: Device[];
  },
  failed: Set<string>
) {
  const memo = new Map<string, boolean>();
  const pduAlive = new Map<string, boolean>();
  for (const pdu of snap.pdus) {
    const circuit = snap.powerCircuits.find((c) => c.id === pdu.circuitId);
    const panel = circuit && snap.powerPanels.find((p) => p.id === circuit.panelId);
    const alive = Boolean(
      panel &&
        sourceAvailable(panel.upstreamSourceId, failed, snap.powerSources, memo) &&
        pdu.status !== "OFFLINE"
    );
    pduAlive.set(pdu.id, alive);
  }
  let dark = 0;
  let degraded = 0;
  let healthy = 0;
  for (const device of snap.devices) {
    const corded = device.psus.filter((p) => p.connectedOutlet);
    if (corded.length === 0) continue;
    const liveFeeds = new Set(
      corded
        .filter((p) => pduAlive.get(p.connectedOutlet!.pdu.id))
        .map((p) => p.connectedOutlet!.pdu.feedSide)
    );
    if (liveFeeds.size === 0) dark++;
    else if (liveFeeds.size === 1) degraded++;
    else healthy++;
  }
  return { dark, degraded, healthy };
}

function networkGraph(snap: { devices: Device[]; networkCables: Cable[] }) {
  const used = new Set<string>();
  for (const c of snap.networkCables) {
    used.add(c.portA.device.id);
    used.add(c.portB.device.id);
  }
  const devices = snap.devices.filter((d) => used.has(d.id) || d.deviceType === "SWITCH");
  const nodes: Node[] = devices.map((d, i) => ({
    id: d.id,
    type: "infra",
    position: { x: (i % 4) * 280, y: Math.floor(i / 4) * 130 },
    data: {
      kind: `${d.rack.code} ${d.deviceType}`,
      title: d.name,
      subtitle: `${d.nominalWatts} W · ${d.networkPorts.length} ports`,
      tone: d.deviceType === "SWITCH" ? "border-violet-500/60 bg-violet-950/50" : "border-slate-600 bg-slate-900",
    },
  }));
  const edges: Edge[] = snap.networkCables.map((c) => ({
    id: c.id,
    source: c.portA.device.id,
    target: c.portB.device.id,
    label: `${c.portA.name} → ${c.portB.name}`,
    style: { stroke: "#34d399" },
  }));
  return { nodes, edges };
}

function coolingGraph(snap: {
  capacity: {
    roomsCooling: {
      roomId: string;
      roomName: string;
      itLoadKw: number;
      onlineCoolingKw: number;
      standbyCoolingKw: number;
      thermalUtilizationPct: number;
      redundancyMode: string;
      nPlusOneCompliant: boolean;
    }[];
  };
}) {
  const nodes: Node[] = snap.capacity.roomsCooling.map((r, i) => ({
    id: r.roomId,
    type: "infra",
    position: { x: (i % 2) * 420, y: Math.floor(i / 2) * 180 },
    data: {
      kind: r.redundancyMode,
      title: r.roomName,
      subtitle: `${r.itLoadKw} kW IT heat vs ${r.onlineCoolingKw} kW online (+${r.standbyCoolingKw} standby) · ${r.thermalUtilizationPct}% · ${
        r.nPlusOneCompliant ? "N+1 holds" : "N+1 would fail"
      }`,
      tone: r.nPlusOneCompliant ? "border-sky-500/50 bg-sky-950/40" : "border-rose-500/60 bg-rose-950/50",
    },
  }));
  return { nodes, edges: [] as Edge[] };
}

function spatialGraph(snap: {
  sites: {
    id: string;
    name: string;
    code: string;
    buildings: {
      id: string;
      name: string;
      floors: {
        id: string;
        name: string;
        rooms: { id: string; name: string; rows: { racks: { id: string; code: string }[] }[] }[];
      }[];
    }[];
  }[];
}) {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  let y = 0;
  for (const site of snap.sites) {
    nodes.push({
      id: site.id,
      type: "infra",
      position: { x: 0, y },
      data: { kind: "Site", title: site.code, subtitle: site.name, tone: "border-cyan-500/50 bg-slate-900" },
    });
    site.buildings.forEach((b, bi) => {
      const by = y + bi * 80;
      nodes.push({
        id: b.id,
        type: "infra",
        position: { x: 260, y: by },
        data: { kind: "Building", title: b.name, subtitle: `${b.floors.length} floors`, tone: "border-slate-600 bg-slate-900" },
      });
      edges.push({ id: `${site.id}-${b.id}`, source: site.id, target: b.id });
      b.floors.forEach((f) => {
        f.rooms.forEach((room) => {
          const racks = room.rows.flatMap((row) => row.racks);
          nodes.push({
            id: room.id,
            type: "infra",
            position: { x: 540, y },
            data: {
              kind: "Room",
              title: room.name,
              subtitle: racks.map((r) => r.code).join(", ") || "No racks",
              tone: "border-slate-600 bg-slate-900",
            },
          });
          edges.push({ id: `${b.id}-${room.id}`, source: b.id, target: room.id });
          y += 110;
        });
      });
    });
    y += 40;
  }
  return { nodes, edges };
}

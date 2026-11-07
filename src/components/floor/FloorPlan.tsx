"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Box, Layers, Pencil } from "lucide-react";

export type FloorLayer = "UNDERFLOOR" | "FLOOR" | "RACK" | "OVERHEAD";
export type HeatmapMode = "POWER_KW" | "U_SPACE" | "REDUNDANCY";

export interface FloorDevice {
  id: string;
  name: string;
  deviceType: string;
  startU: number;
  uHeight: number;
}

export interface FloorRack {
  id: string;
  name: string;
  code: string;
  totalU: number;
  posX: number;
  posY: number;
  devices?: FloorDevice[];
}

export interface FloorRoom {
  id: string;
  gridCols: number;
  gridRows: number;
  floorTiles?: { posX: number; posY: number; surface: string }[];
  obstructions?: { id: string; posX: number; posY: number; label?: string }[];
  coolingUnits: {
    id: string;
    name: string;
    unitType: string;
    capacityKw: number;
    status: string;
    posX: number;
    posY: number;
  }[];
  rows: {
    id: string;
    name: string;
    orientation: string;
    gridX: number;
    gridY: number;
    racks: FloorRack[];
  }[];
}

export interface FloorSocket {
  id: string;
  floorSocketLabel: string;
  phaseAllocation: string;
  ratedAmps: number;
  posX: number;
  posY: number;
  elevation: string;
}

export interface FloorRackMetric {
  powerUtilizationPct: number;
  uUtilizationPct: number;
  spofDeviceCount: number;
  totalU: number;
}

const FloorPlan3D = dynamic(
  () => import("./FloorPlan3D").then((mod) => mod.FloorPlan3D),
  {
    ssr: false,
    loading: () => (
      <div className="h-[560px] grid place-items-center text-sm text-slate-400 rounded-xl border border-slate-800">
        Loading 3D room…
      </div>
    ),
  }
);

const COOLING_TYPES = ["CRAC", "CRAH", "IN_ROW", "AHU", "CHILLER"] as const;

function onPlan(posX: number, posY: number) {
  return posX >= 1 && posY >= 1;
}

const LAYERS: { id: FloorLayer; label: string }[] = [
  { id: "UNDERFLOOR", label: "Underfloor" },
  { id: "FLOOR", label: "Floor" },
  { id: "RACK", label: "Rack" },
  { id: "OVERHEAD", label: "Overhead" },
];

function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

export function rackColor(
  mode: HeatmapMode,
  metric: FloorRackMetric | undefined
): string {
  const power = metric?.powerUtilizationPct ?? 0;
  const space = metric?.uUtilizationPct ?? 0;
  const spof = (metric?.spofDeviceCount ?? 0) > 0;
  if (mode === "POWER_KW") {
    if (power >= 75) return "#f43f5e";
    if (power >= 40) return "#f59e0b";
    return "#10b981";
  }
  if (mode === "U_SPACE") {
    if (space >= 80) return "#f43f5e";
    return "#22d3ee";
  }
  return spof ? "#f59e0b" : "#10b981";
}

type DragKind = "RACK" | "COOLING_UNIT" | "FLOOR_SOCKET" | "ROW";

interface DragState {
  kind: DragKind;
  id: string;
  originX: number;
  originY: number;
  hover: { x: number; y: number } | null;
}

export function FloorPlan({
  room,
  sockets,
  metrics,
  admin,
  onChanged,
}: {
  room: FloorRoom;
  sockets: FloorSocket[];
  metrics: Record<string, FloorRackMetric | undefined>;
  admin: boolean;
  onChanged: () => void | Promise<void>;
}) {
  const [layer, setLayer] = useState<FloorLayer>("RACK");
  const [heatmap, setHeatmap] = useState<HeatmapMode>("POWER_KW");
  const [view, setView] = useState<"2D" | "3D">("2D");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [cols, setCols] = useState(room.gridCols);
  const [rows, setRows] = useState(room.gridRows);
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [unitName, setUnitName] = useState("");
  const [unitType, setUnitType] = useState<(typeof COOLING_TYPES)[number]>("AHU");
  const [unitKw, setUnitKw] = useState(150);
  const [grillX, setGrillX] = useState(1);
  const [grillY, setGrillY] = useState(1);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const router = useRouter();

  useEffect(() => {
    setCols(room.gridCols);
    setRows(room.gridRows);
    setPlacingId(null);
  }, [room.id, room.gridCols, room.gridRows]);

  const grills = new Set(
    (room.floorTiles || [])
      .filter((tile) => tile.surface === "GRILL")
      .map((tile) => cellKey(tile.posX, tile.posY))
  );
  const obstructions = new Map(
    (room.obstructions || []).map((tile) => [cellKey(tile.posX, tile.posY), tile])
  );
  const racks = room.rows.flatMap((row) =>
    row.racks.map((rack) => ({ ...rack, rowId: row.id, rowName: row.name }))
  );
  const rackAt = new Map(racks.map((rack) => [cellKey(rack.posX, rack.posY), rack]));
  const coolingAt = new Map(
    room.coolingUnits
      .filter((unit) => unit.posX >= 1 && unit.posY >= 1)
      .map((unit) => [cellKey(unit.posX, unit.posY), unit])
  );
  const rowAt = new Map(
    room.rows.map((row) => [cellKey(row.gridX, row.gridY), row])
  );

  const rackColors: Record<string, string> = {};
  for (const rack of racks) rackColors[rack.id] = rackColor(heatmap, metrics[rack.id]);

  function cellFromPoint(clientX: number, clientY: number) {
    const el = gridRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const gridCols = Number(el.dataset.cols);
    const gridRows = Number(el.dataset.rows);
    const label = 24;
    const gap = 4;
    const innerW = rect.width - label - gap;
    const innerH = rect.height - label - gap;
    const cellW = (innerW - gap * (gridCols - 1)) / gridCols;
    const cellH = (innerH - gap * (gridRows - 1)) / gridRows;
    const localX = clientX - rect.left - label - gap;
    const localY = clientY - rect.top - label - gap;
    if (localX < 0 || localY < 0) return null;
    const x = Math.floor(localX / (cellW + gap)) + 1;
    const y = Math.floor(localY / (cellH + gap)) + 1;
    if (x < 1 || y < 1 || x > gridCols || y > gridRows) return null;
    return { x, y };
  }

  async function postLayout(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/hierarchy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "Layout change was rejected");
        return false;
      }
      await onChanged();
      return true;
    } finally {
      setSaving(false);
    }
  }

  function beginDrag(event: React.PointerEvent, kind: DragKind, id: string) {
    if (!editing || saving) return;
    event.preventDefault();
    event.stopPropagation();
    const originX = event.clientX;
    const originY = event.clientY;
    dragRef.current = {
      kind,
      id,
      originX,
      originY,
      hover: cellFromPoint(originX, originY),
    };
    setDraggingId(id);
    setHover(dragRef.current.hover);

    function move(e: PointerEvent) {
      const next = cellFromPoint(e.clientX, e.clientY);
      if (dragRef.current) dragRef.current.hover = next;
      setHover(next);
    }
    function up(e: PointerEvent) {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const drag = dragRef.current;
      dragRef.current = null;
      setDraggingId(null);
      setHover(null);
      if (!drag) return;
      const target = cellFromPoint(e.clientX, e.clientY);
      const moved = Math.hypot(e.clientX - drag.originX, e.clientY - drag.originY) > 4;
      if (!moved) {
        if (drag.kind === "RACK") router.push(`/racks/${drag.id}`);
        return;
      }
      if (!target) return;
      void postLayout({
        entityType: "MOVE_ON_FLOOR",
        kind: drag.kind,
        id: drag.id,
        posX: target.x,
        posY: target.y,
      });
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function placeCooling(id: string, x: number, y: number) {
    const ok = await postLayout({
      entityType: "MOVE_ON_FLOOR",
      kind: "COOLING_UNIT",
      id,
      posX: x,
      posY: y,
    });
    if (ok) setPlacingId(null);
  }

  async function toggleGrill(x: number, y: number) {
    if (!editing || saving || layer !== "FLOOR") return;
    const surface = grills.has(cellKey(x, y)) ? "SOLID" : "GRILL";
    await postLayout({
      entityType: "SET_FLOOR_TILE",
      roomId: room.id,
      posX: x,
      posY: y,
      surface,
    });
  }

  async function toggleObstruction(x: number, y: number) {
    if (!editing || saving || layer !== "RACK") return;
    const key = cellKey(x, y);
    if (rackAt.has(key) || coolingAt.has(key)) return;
    await postLayout({
      entityType: "SET_OBSTRUCTION",
      roomId: room.id,
      posX: x,
      posY: y,
      obstructed: !obstructions.has(key),
    });
  }

  async function shiftElevation(socket: FloorSocket) {
    const elevation = socket.elevation === "OVERHEAD" ? "UNDERFLOOR" : "OVERHEAD";
    await postLayout({
      entityType: "MOVE_ON_FLOOR",
      kind: "FLOOR_SOCKET",
      id: socket.id,
      posX: socket.posX,
      posY: socket.posY,
      elevation,
    });
  }

  const canDragRack = editing && layer === "RACK";
  const socketLayer = layer === "UNDERFLOOR" || layer === "OVERHEAD";

  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          <Layers className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
          {LAYERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setLayer(item.id)}
              className={`px-2.5 py-1 rounded font-medium ${
                layer === item.id
                  ? "bg-cyan-500/20 text-cyan-200 border border-cyan-500/40"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setView("2D")}
              className={`px-2.5 py-1 rounded font-medium ${
                view === "2D" ? "bg-slate-800 text-white" : "text-slate-400"
              }`}
            >
              2D
            </button>
            <button
              type="button"
              onClick={() => setView("3D")}
              className={`px-2.5 py-1 rounded font-medium inline-flex items-center gap-1 ${
                view === "3D" ? "bg-slate-800 text-white" : "text-slate-400"
              }`}
            >
              <Box className="w-3 h-3" /> 3D
            </button>
          </div>
          {view === "2D" && (
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
              {(
                [
                  ["POWER_KW", "Power"],
                  ["U_SPACE", "U space"],
                  ["REDUNDANCY", "A/B"],
                ] as const
              ).map(([mode, label]) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setHeatmap(mode)}
                  className={`px-2.5 py-1 rounded font-medium ${
                    heatmap === mode
                      ? "bg-amber-500/20 text-amber-200"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {admin && view === "2D" && (
            <button
              type="button"
              onClick={() => setEditing((value) => !value)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold inline-flex items-center gap-1.5 ${
                editing
                  ? "bg-cyan-500/20 border-cyan-400 text-cyan-100"
                  : "bg-slate-950 border-slate-700 text-slate-300"
              }`}
            >
              <Pencil className="w-3 h-3" />
              {editing ? "Editing layout" : "Edit layout"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-slate-400">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-emerald-500/70" /> Rack
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-sm bg-sky-400/70" /> Cooling
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm border border-slate-400"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(-45deg, #94a3b8 0 1px, #334155 1px 3px)",
              }}
            />
            Obstructed
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="w-3 h-3 rounded-sm border border-cyan-400"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(90deg, #22d3ee 0 1px, transparent 1px 3px)",
              }}
            />
            Grill
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Underfloor
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-purple-400" /> Overhead
          </span>
        </div>
        <span>
          {room.gridCols} × {room.gridRows} tiles · 600 mm
          {saving ? " · saving…" : ""}
        </span>
      </div>

      {error && (
        <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-500/40 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {view === "3D" ? (
        <FloorPlan3D
          room={room}
          sockets={sockets}
          rackColors={rackColors}
          activeLayer={layer}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-3">
          <div
            ref={gridRef}
            data-cols={room.gridCols}
            data-rows={room.gridRows}
            className="inline-grid"
            style={{
              gridTemplateColumns: `24px repeat(${room.gridCols}, minmax(58px, 1fr))`,
              gridTemplateRows: `24px repeat(${room.gridRows}, minmax(58px, 1fr))`,
              gap: 4,
            }}
          >
            <div />
            {Array.from({ length: room.gridCols }, (_, index) => (
              <div
                key={`x-${index + 1}`}
                className="text-[10px] text-slate-500 text-center leading-6"
              >
                {index + 1}
              </div>
            ))}
            {Array.from({ length: room.gridRows }, (_, rowIndex) => {
              const y = rowIndex + 1;
              return (
                <React.Fragment key={`row-${y}`}>
                  <div className="text-[10px] text-slate-500 text-right pr-1 leading-[58px]">
                    {y}
                  </div>
                  {Array.from({ length: room.gridCols }, (_, colIndex) => {
                    const x = colIndex + 1;
                    const key = cellKey(x, y);
                    const grill = grills.has(key);
                    const blocked = obstructions.has(key);
                    const rack = rackAt.get(key);
                    const cooling = coolingAt.get(key);
                    const row = rowAt.get(key);
                    const under = sockets.filter(
                      (socket) =>
                        socket.posX === x &&
                        socket.posY === y &&
                        socket.elevation !== "OVERHEAD"
                    );
                    const over = sockets.filter(
                      (socket) =>
                        socket.posX === x &&
                        socket.posY === y &&
                        socket.elevation === "OVERHEAD"
                    );
                    const activeSockets =
                      layer === "OVERHEAD" ? over : layer === "UNDERFLOOR" ? under : [];
                    const targeted =
                      hover?.x === x && hover?.y === y && draggingId != null;
                    const floorFocus = layer === "FLOOR";
                    const rackFocus = layer === "RACK";
                    return (
                      <div
                        key={key}
                        onClick={() => {
                          if (placingId && rackFocus) {
                            if (rack || cooling || blocked) {
                              setError(
                                "Choose an empty tile with no rack, cooling unit, or obstruction"
                              );
                              return;
                            }
                            void placeCooling(placingId, x, y);
                            return;
                          }
                          if (floorFocus) void toggleGrill(x, y);
                          else if (rackFocus) void toggleObstruction(x, y);
                        }}
                        className={`relative rounded-md border overflow-hidden ${
                          targeted
                            ? "border-cyan-300 ring-2 ring-cyan-300"
                            : "border-slate-800"
                        } ${
                          (editing && (floorFocus || (rackFocus && !rack && !cooling))) ||
                          (placingId && rackFocus && !rack && !cooling && !blocked)
                            ? "cursor-pointer"
                            : ""
                        }`}
                        style={{
                          background: grill
                            ? floorFocus
                              ? "repeating-linear-gradient(90deg, rgba(34,211,238,0.85) 0 3px, rgba(8,47,73,0.95) 3px 10px)"
                              : "repeating-linear-gradient(90deg, rgba(34,211,238,0.28) 0 2px, rgba(15,23,42,0.95) 2px 8px)"
                            : floorFocus
                            ? "#0f172a"
                            : "#020617",
                        }}
                        aria-label={`Tile ${x},${y}${blocked ? " obstructed" : ""}${
                          grill ? " grill" : " solid"
                        }`}
                      >
                        {blocked && (
                          <div
                            className={`absolute inset-0 z-[5] flex items-end justify-center px-1 pb-1 text-[9px] font-bold tracking-wide text-slate-100 truncate ${
                              rackFocus ? "" : "opacity-40"
                            } pointer-events-none`}
                            style={{
                              backgroundImage: rackFocus
                                ? "repeating-linear-gradient(-45deg, rgba(148,163,184,0.95) 0 3px, rgba(30,41,59,0.96) 3px 8px)"
                                : "repeating-linear-gradient(-45deg, rgba(148,163,184,0.45) 0 2px, transparent 2px 7px)",
                            }}
                          >
                            {rackFocus
                              ? obstructions.get(key)?.label || "BLOCKED"
                              : ""}
                          </div>
                        )}
                        {rack && layer !== "RACK" && (
                          <div className="absolute inset-1 rounded border border-cyan-400/30 text-[9px] text-cyan-200/50 flex items-center justify-center pointer-events-none">
                            {rack.code}
                          </div>
                        )}
                        {cooling && layer !== "RACK" && !rack && (
                          <div className="absolute inset-1 rounded border border-sky-400/30 pointer-events-none" />
                        )}
                        {layer !== "UNDERFLOOR" &&
                          under.map((socket) => (
                            <span
                              key={socket.id}
                              className="absolute bottom-1 left-1 w-1.5 h-1.5 rounded-full bg-amber-400/50 pointer-events-none"
                            />
                          ))}
                        {layer !== "OVERHEAD" &&
                          over.map((socket) => (
                            <span
                              key={socket.id}
                              className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-purple-400/50 pointer-events-none"
                            />
                          ))}

                        {layer === "RACK" && rack && (
                          canDragRack ? (
                            <div
                              onPointerDown={(event) =>
                                beginDrag(event, "RACK", rack.id)
                              }
                              className="absolute inset-1 rounded px-1 py-2 text-center cursor-grab active:cursor-grabbing z-10"
                              style={{ background: rackColors[rack.id] }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="text-[11px] font-bold text-slate-950 leading-tight">
                                {rack.code}
                              </div>
                            </div>
                          ) : (
                            <Link
                              href={`/racks/${rack.id}`}
                              className="absolute inset-1 rounded px-1 py-2 text-center z-10 hover:brightness-110"
                              style={{ background: rackColors[rack.id] }}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="text-[11px] font-bold text-slate-950 leading-tight">
                                {rack.code}
                              </div>
                            </Link>
                          )
                        )}

                        {layer === "RACK" && cooling && !rack && (
                          <div
                            onPointerDown={(event) =>
                              canDragRack &&
                              beginDrag(event, "COOLING_UNIT", cooling.id)
                            }
                            className={`absolute inset-1 rounded bg-sky-400/80 text-slate-950 text-[10px] font-semibold px-1 py-1 z-10 ${
                              canDragRack ? "cursor-grab" : ""
                            }`}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {cooling.unitType}
                            {canDragRack && (
                              <button
                                type="button"
                                className="block mt-0.5 underline font-medium"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void postLayout({
                                    entityType: "UNPLACE_COOLING",
                                    id: cooling.id,
                                  });
                                }}
                              >
                                Off plan
                              </button>
                            )}
                          </div>
                        )}

                        {layer === "RACK" && row && (
                          <button
                            type="button"
                            onPointerDown={(event) =>
                              beginDrag(event, "ROW", row.id)
                            }
                            className={`absolute top-0 left-0 z-20 max-w-full truncate px-1 text-[9px] font-semibold bg-slate-950/80 text-white ${
                              canDragRack ? "cursor-grab" : "pointer-events-none"
                            }`}
                            title={row.name}
                            onClick={(event) => event.stopPropagation()}
                          >
                            {row.name}
                          </button>
                        )}

                        {socketLayer &&
                          activeSockets.map((socket) => (
                            <div
                              key={socket.id}
                              onPointerDown={(event) =>
                                editing &&
                                beginDrag(event, "FLOOR_SOCKET", socket.id)
                              }
                              className={`absolute inset-1 rounded z-10 px-1 py-1 text-[9px] leading-tight font-semibold ${
                                layer === "OVERHEAD"
                                  ? "bg-purple-400/90 text-slate-950"
                                  : "bg-amber-400/90 text-slate-950"
                              } ${editing ? "cursor-grab" : ""}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              <div className="truncate">{socket.floorSocketLabel}</div>
                              <div className="opacity-80">
                                {socket.phaseAllocation} · {socket.ratedAmps}A
                              </div>
                              {editing && (
                                <button
                                  type="button"
                                  className="mt-0.5 underline"
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void shiftElevation(socket);
                                  }}
                                >
                                  {layer === "OVERHEAD" ? "To underfloor" : "To overhead"}
                                </button>
                              )}
                            </div>
                          ))}
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {admin && editing && view === "2D" && (
        <form
          className="flex flex-wrap items-end gap-3 text-xs"
          onSubmit={(event) => {
            event.preventDefault();
            void postLayout({
              entityType: "RESIZE_ROOM",
              roomId: room.id,
              gridCols: cols,
              gridRows: rows,
            });
          }}
        >
          <label className="space-y-1 text-slate-400">
            <span>Columns</span>
            <input
              type="number"
              min={1}
              max={40}
              value={cols}
              onChange={(event) => setCols(Number(event.target.value))}
              className="block w-20 rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-white"
            />
          </label>
          <label className="space-y-1 text-slate-400">
            <span>Rows</span>
            <input
              type="number"
              min={1}
              max={40}
              value={rows}
              onChange={(event) => setRows(Number(event.target.value))}
              className="block w-20 rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-white"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 rounded-md bg-slate-800 border border-slate-600 text-slate-100 font-semibold"
          >
            Resize room
          </button>
          <span className="text-slate-500 pb-1">
            {placingId
              ? "Click an empty rack tile to place the selected cooling unit."
              : layer === "FLOOR"
              ? "Click a tile to toggle a solid slab and an airflow grill."
              : socketLayer
              ? "Drag a socket on this elevation, or send it to the other plane."
              : "Drag a rack, a cooling unit, or a row label. Click an empty tile to mark it obstructed."}
          </span>
        </form>
      )}

      <CoolingRegister
        room={room}
        admin={admin}
        editing={editing && view === "2D"}
        saving={saving}
        placingId={placingId}
        unitName={unitName}
        unitType={unitType}
        unitKw={unitKw}
        onUnitName={setUnitName}
        onUnitType={setUnitType}
        onUnitKw={setUnitKw}
        onPlace={(id) => {
          setPlacingId(id);
          setLayer("RACK");
          setView("2D");
          setError(null);
        }}
        onCancelPlace={() => setPlacingId(null)}
        onUnplace={(id) =>
          void postLayout({ entityType: "UNPLACE_COOLING", id })
        }
        onDelete={(id) =>
          void postLayout({ entityType: "DELETE_COOLING_UNIT", id })
        }
        onCreate={() => {
          const name = unitName.trim();
          if (!name) {
            setError("Cooling unit name is required");
            return;
          }
          void postLayout({
            entityType: "CREATE_COOLING_UNIT",
            roomId: room.id,
            name,
            unitType,
            capacityKw: unitKw,
          }).then((ok) => {
            if (ok) setUnitName("");
          });
        }}
      />

      <GrillRegister
        room={room}
        grills={(room.floorTiles || [])
          .filter((tile) => tile.surface === "GRILL")
          .sort((a, b) => a.posY - b.posY || a.posX - b.posX)
          .map((tile) => cellKey(tile.posX, tile.posY))}
        admin={admin}
        editing={editing && view === "2D"}
        saving={saving}
        grillX={grillX}
        grillY={grillY}
        onGrillX={setGrillX}
        onGrillY={setGrillY}
        onAdd={() =>
          void postLayout({
            entityType: "SET_FLOOR_TILE",
            roomId: room.id,
            posX: grillX,
            posY: grillY,
            surface: "GRILL",
          })
        }
        onRemove={(x, y) =>
          void postLayout({
            entityType: "SET_FLOOR_TILE",
            roomId: room.id,
            posX: x,
            posY: y,
            surface: "SOLID",
          })
        }
      />
    </div>
  );
}

function CoolingRegister({
  room,
  admin,
  editing,
  saving,
  placingId,
  unitName,
  unitType,
  unitKw,
  onUnitName,
  onUnitType,
  onUnitKw,
  onPlace,
  onCancelPlace,
  onUnplace,
  onDelete,
  onCreate,
}: {
  room: FloorRoom;
  admin: boolean;
  editing: boolean;
  saving: boolean;
  placingId: string | null;
  unitName: string;
  unitType: (typeof COOLING_TYPES)[number];
  unitKw: number;
  onUnitName: (value: string) => void;
  onUnitType: (value: (typeof COOLING_TYPES)[number]) => void;
  onUnitKw: (value: number) => void;
  onPlace: (id: string) => void;
  onCancelPlace: () => void;
  onUnplace: (id: string) => void;
  onDelete: (id: string) => void;
  onCreate: () => void;
}) {
  const units = [...room.coolingUnits].sort((a, b) => {
    const placed = Number(onPlan(a.posX, a.posY)) - Number(onPlan(b.posX, b.posY));
    if (placed !== 0) return placed;
    return a.name.localeCompare(b.name);
  });
  const offPlan = units.filter((unit) => !onPlan(unit.posX, unit.posY));

  return (
    <section className="rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white">Cooling for this room</h3>
        <p className="text-[11px] text-slate-400 mt-1">
          Air handlers and chillers that are not in this tile grid stay in this
          list and still count toward the room cooling total.
          {offPlan.length > 0
            ? ` ${offPlan.length} ${offPlan.length === 1 ? "unit is" : "units are"} off the plan.`
            : ""}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-800">
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Capacity</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Location</th>
              {editing && <th className="px-3 py-2 font-medium"> </th>}
            </tr>
          </thead>
          <tbody>
            {units.length === 0 && (
              <tr>
                <td colSpan={editing ? 6 : 5} className="px-4 py-3 text-slate-500">
                  No cooling units serve this room yet.
                </td>
              </tr>
            )}
            {units.map((unit) => {
              const placed = onPlan(unit.posX, unit.posY);
              return (
                <tr key={unit.id} className="border-b border-slate-800/80 text-slate-200">
                  <td className="px-4 py-2 font-medium">{unit.name}</td>
                  <td className="px-3 py-2">{unit.unitType}</td>
                  <td className="px-3 py-2">{unit.capacityKw} kW</td>
                  <td className="px-3 py-2">{unit.status}</td>
                  <td className="px-3 py-2">
                    {placed ? `Tile ${unit.posX},${unit.posY}` : "Not on this plan"}
                  </td>
                  {editing && (
                    <td className="px-3 py-2 text-right whitespace-nowrap space-x-2">
                      {placed ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => onUnplace(unit.id)}
                          className="text-cyan-300 hover:text-cyan-100"
                        >
                          Remove from plan
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() =>
                              placingId === unit.id ? onCancelPlace() : onPlace(unit.id)
                            }
                            className="text-cyan-300 hover:text-cyan-100"
                          >
                            {placingId === unit.id ? "Cancel place" : "Place on plan"}
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => onDelete(unit.id)}
                            className="text-rose-300 hover:text-rose-100"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {admin && editing && (
        <form
          className="flex flex-wrap items-end gap-2 px-4 py-3 border-t border-slate-800"
          onSubmit={(event) => {
            event.preventDefault();
            onCreate();
          }}
        >
          <label className="space-y-1 text-slate-400">
            <span>Off-plan unit</span>
            <input
              value={unitName}
              onChange={(event) => onUnitName(event.target.value)}
              placeholder="Roof AHU 1"
              className="block w-40 rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-white"
            />
          </label>
          <label className="space-y-1 text-slate-400">
            <span>Type</span>
            <select
              value={unitType}
              onChange={(event) =>
                onUnitType(event.target.value as (typeof COOLING_TYPES)[number])
              }
              className="block rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-white"
            >
              {COOLING_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-slate-400">
            <span>kW</span>
            <input
              type="number"
              min={1}
              step="any"
              value={unitKw}
              onChange={(event) => onUnitKw(Number(event.target.value))}
              className="block w-20 rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-white"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 rounded-md bg-sky-500 text-slate-950 font-semibold"
          >
            Add off-plan unit
          </button>
        </form>
      )}
    </section>
  );
}

function GrillRegister({
  room,
  grills,
  admin,
  editing,
  saving,
  grillX,
  grillY,
  onGrillX,
  onGrillY,
  onAdd,
  onRemove,
}: {
  room: FloorRoom;
  grills: string[];
  admin: boolean;
  editing: boolean;
  saving: boolean;
  grillX: number;
  grillY: number;
  onGrillX: (value: number) => void;
  onGrillY: (value: number) => void;
  onAdd: () => void;
  onRemove: (x: number, y: number) => void;
}) {
  return (
    <section className="rounded-xl border border-slate-800 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-800">
        <h3 className="text-sm font-semibold text-white">Airflow grills</h3>
        <p className="text-[11px] text-slate-400 mt-1">
          {grills.length} grill {grills.length === 1 ? "tile" : "tiles"}. Add one
          by coordinate, or click a tile on the Floor layer while editing.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-slate-500">
            <tr className="border-b border-slate-800">
              <th className="px-4 py-2 font-medium">Tile</th>
              {editing && <th className="px-3 py-2 font-medium"> </th>}
            </tr>
          </thead>
          <tbody>
            {grills.length === 0 && (
              <tr>
                <td colSpan={editing ? 2 : 1} className="px-4 py-3 text-slate-500">
                  This room has no airflow grills.
                </td>
              </tr>
            )}
            {grills.map((key) => {
              const [x, y] = key.split(",");
              return (
                <tr key={key} className="border-b border-slate-800/80 text-slate-200">
                  <td className="px-4 py-2">Tile {x},{y}</td>
                  {editing && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => onRemove(Number(x), Number(y))}
                        className="text-rose-300 hover:text-rose-100"
                      >
                        Make solid
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {admin && editing && (
        <form
          className="flex flex-wrap items-end gap-2 px-4 py-3 border-t border-slate-800"
          onSubmit={(event) => {
            event.preventDefault();
            onAdd();
          }}
        >
          <label className="space-y-1 text-slate-400">
            <span>Column</span>
            <input
              type="number"
              min={1}
              max={room.gridCols}
              value={grillX}
              onChange={(event) => onGrillX(Number(event.target.value))}
              className="block w-20 rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-white"
            />
          </label>
          <label className="space-y-1 text-slate-400">
            <span>Row</span>
            <input
              type="number"
              min={1}
              max={room.gridRows}
              value={grillY}
              onChange={(event) => onGrillY(Number(event.target.value))}
              className="block w-20 rounded-md bg-slate-950 border border-slate-700 px-2 py-1 text-white"
            />
          </label>
          <button
            type="submit"
            disabled={saving}
            className="px-3 py-1.5 rounded-md bg-cyan-400 text-slate-950 font-semibold"
          >
            Add grill
          </button>
        </form>
      )}
    </section>
  );
}

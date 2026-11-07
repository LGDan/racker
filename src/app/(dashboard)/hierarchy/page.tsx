"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  Building2,
  Plus,
  Server,
  ThermometerSnowflake,
  PlugZap,
  ChevronRight,
  Layers,
  ShieldAlert,
  ArrowUpRight,
  Flame,
  CheckCircle2,
} from "lucide-react";

interface RackSummary {
  id: string;
  name: string;
  code: string;
  rowId: string;
  rowName: string;
  roomId: string;
  roomName: string;
  totalU: number;
  usedU: number;
  freeU: number;
  uUtilizationPct: number;
  maxPowerWatts: number;
  currentPowerWatts: number;
  powerUtilizationPct: number;
  spofDeviceCount: number;
  freeOutlets: number;
  totalOutlets: number;
}

interface HierarchySite {
  id: string;
  name: string;
  code: string;
  city: string;
  country: string;
  utilityCapacityKw: number;
  buildings: {
    id: string;
    name: string;
    code: string;
    floors: {
      id: string;
      name: string;
      levelNumber: number;
      rooms: {
        id: string;
        name: string;
        code: string;
        roomType: string;
        coolingCapacityKw: number;
        coolingRedundancy: string;
        ambientTempTargetC: number;
        gridCols: number;
        gridRows: number;
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
          aisleContainment: string;
          gridX: number;
          gridY: number;
          racks: {
            id: string;
            name: string;
            code: string;
            totalU: number;
            maxPowerWatts: number;
            posX: number;
            posY: number;
          }[];
        }[];
      }[];
    }[];
  }[];
}

interface PowerCircuitItem {
  id: string;
  roomId: string;
  rackId: string | null;
  name: string;
  floorSocketLabel: string;
  phaseAllocation: string;
  ratedAmps: number;
  voltageV: number;
  socketType: string;
  posX: number;
  posY: number;
}

export default function HierarchyExplorerPage() {
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState<HierarchySite[]>([]);
  const [rackMetrics, setRackMetrics] = useState<Record<string, RackSummary>>(
    {}
  );
  const [circuits, setCircuits] = useState<PowerCircuitItem[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<"ADMIN" | "STANDARD">(
    "STANDARD"
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string>("");
  const [heatmapMode, setHeatmapMode] = useState<
    "U_SPACE" | "POWER_KW" | "REDUNDANCY"
  >("POWER_KW");

  // Modal state for Admin adding hierarchy entities
  const [modalOpen, setModalOpen] = useState(false);
  const [entityType, setEntityType] = useState<
    "SITE" | "BUILDING" | "FLOOR" | "ROOM" | "ROW" | "RACK"
  >("RACK");
  const [formParentId, setFormParentId] = useState("");
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formNumber1, setFormNumber1] = useState("42");
  const [formNumber2, setFormNumber2] = useState("12000");
  const [formPosX, setFormPosX] = useState("4");
  const [formPosY, setFormPosY] = useState("3");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchSnapshot = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/infrastructure");
    if (res.ok) {
      const data = await res.json();
      setSites(data.sites || []);
      setCurrentUserRole(data.currentUser?.role || "STANDARD");
      setCircuits(data.powerCircuits || []);
      const map: Record<string, RackSummary> = {};
      for (const r of data.capacity?.racks || []) {
        map[r.id] = r;
      }
      setRackMetrics(map);

      if (!selectedRoomId && data.sites?.[0]?.buildings?.[0]?.floors?.[0]?.rooms?.[0]) {
        setSelectedRoomId(data.sites[0].buildings[0].floors[0].rooms[0].id);
      }
    }
    setLoading(false);
  }, [selectedRoomId]);

  useEffect(() => {
    fetchSnapshot();
  }, [fetchSnapshot]);

  // Flatten rooms for easy lookup
  const allRooms = sites.flatMap((s) =>
    s.buildings.flatMap((b) =>
      b.floors.flatMap((f) =>
        f.rooms.map((rm) => ({
          ...rm,
          siteName: s.name,
          siteCode: s.code,
          buildingName: b.name,
          floorName: f.name,
        }))
      )
    )
  );

  const activeRoom =
    allRooms.find((r) => r.id === selectedRoomId) || allRooms[0];

  function openAddModal(
    type: "SITE" | "BUILDING" | "FLOOR" | "ROOM" | "ROW" | "RACK",
    parentId = ""
  ) {
    setEntityType(type);
    setFormParentId(parentId);
    setFormName("");
    setFormCode("");
    setErrorMsg(null);
    if (type === "RACK") {
      setFormNumber1("42");
      setFormNumber2("12000");
    } else if (type === "ROOM") {
      setFormNumber1("150");
      setFormNumber2("21.5");
    } else if (type === "SITE") {
      setFormNumber1("3000");
    }
    setModalOpen(true);
  }

  async function handleCreateEntity(e: React.FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    const payload: Record<string, unknown> = {
      entityType,
      name: formName,
      code: formCode,
    };

    if (entityType === "SITE") {
      payload.utilityCapacityKw = Number(formNumber1);
    } else if (entityType === "BUILDING") {
      payload.siteId = formParentId;
    } else if (entityType === "FLOOR") {
      payload.buildingId = formParentId;
      payload.levelNumber = Number(formNumber1 || 1);
    } else if (entityType === "ROOM") {
      payload.floorId = formParentId;
      payload.coolingCapacityKw = Number(formNumber1 || 150);
      payload.ambientTempTargetC = Number(formNumber2 || 21.5);
    } else if (entityType === "ROW") {
      payload.roomId = formParentId;
      payload.gridX = Number(formPosX || 2);
      payload.gridY = Number(formPosY || 3);
    } else if (entityType === "RACK") {
      payload.rowId = formParentId;
      payload.totalU = Number(formNumber1 || 42);
      payload.maxPowerWatts = Number(formNumber2 || 12000);
      payload.posX = Number(formPosX || 4);
      payload.posY = Number(formPosY || 3);
    }

    const res = await fetch("/api/hierarchy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      setErrorMsg(data.error || "Failed to create item");
      return;
    }
    setModalOpen(false);
    fetchSnapshot();
  }

  if (loading && sites.length === 0) {
    return (
      <div className="p-8 text-sm text-slate-400">
        Loading spatial hierarchy and 2D floor plans...
      </div>
    );
  }

  const roomCircuits = activeRoom
    ? circuits.filter((c) => c.roomId === activeRoom.id)
    : [];

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">
            <Building2 className="w-3.5 h-3.5" />
            Spatial Infrastructure Hierarchy & Room Floor Plan
          </div>
          <h1 className="text-2xl font-bold text-white mt-1">
            Sites, Buildings, Floors, Data Halls, Rows & Racks
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Navigate the physical hierarchy and inspect interactive 2D room floor
            plans with thermal zones, floor power whips, and rack capacity
            heatmaps.
          </p>
        </div>

        {currentUserRole === "ADMIN" ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => openAddModal("SITE")}
              className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              New Site
            </button>
            {activeRoom && (
              <button
                onClick={() => openAddModal("ROW", activeRoom.id)}
                className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                Add Row in {activeRoom.code}
              </button>
            )}
            {activeRoom?.rows?.[0] && (
              <button
                onClick={() => openAddModal("RACK", activeRoom.rows[0].id)}
                className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                Provision Rack
              </button>
            )}
          </div>
        ) : (
          <div className="px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-emerald-400" />
            <span>
              Standard Mode: Full hierarchy read access. Click any rack to edit
              devices & cabling.
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Left Tree Navigator (4 cols) */}
        <div className="xl:col-span-4 rounded-xl bg-slate-900/90 border border-slate-800 p-4 space-y-4 max-h-[820px] overflow-y-auto">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Location Hierarchy Tree
            </span>
            <span className="text-[11px] text-slate-500">
              {sites.length} Sites • {allRooms.length} Rooms
            </span>
          </div>

          <div className="space-y-4">
            {sites.map((site) => (
              <div
                key={site.id}
                className="rounded-lg bg-slate-950/70 border border-slate-800 p-3 space-y-2.5"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 mr-1.5">
                      {site.code}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {site.name}
                    </span>
                  </div>
                  {currentUserRole === "ADMIN" && (
                    <button
                      onClick={() => openAddModal("BUILDING", site.id)}
                      className="text-[10px] text-cyan-400 hover:underline"
                    >
                      + Bldg
                    </button>
                  )}
                </div>

                {site.buildings.map((bldg) => (
                  <div
                    key={bldg.id}
                    className="pl-2 border-l border-slate-800 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-200">
                        {bldg.name} ({bldg.code})
                      </span>
                      {currentUserRole === "ADMIN" && (
                        <button
                          onClick={() => openAddModal("FLOOR", bldg.id)}
                          className="text-[10px] text-cyan-400 hover:underline"
                        >
                          + Floor
                        </button>
                      )}
                    </div>

                    {bldg.floors.map((floor) => (
                      <div
                        key={floor.id}
                        className="pl-2.5 border-l border-slate-800/80 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-[11px] text-slate-400">
                          <span>
                            Level {floor.levelNumber}: {floor.name}
                          </span>
                          {currentUserRole === "ADMIN" && (
                            <button
                              onClick={() => openAddModal("ROOM", floor.id)}
                              className="text-[10px] text-cyan-400 hover:underline"
                            >
                              + Room
                            </button>
                          )}
                        </div>

                        {floor.rooms.map((rm) => {
                          const isSelected = activeRoom?.id === rm.id;
                          return (
                            <div key={rm.id} className="space-y-1">
                              <button
                                onClick={() => setSelectedRoomId(rm.id)}
                                className={`w-full text-left p-2 rounded-lg border text-xs transition-all flex items-center justify-between ${
                                  isSelected
                                    ? "bg-cyan-500/15 border-cyan-500/50 text-white"
                                    : "bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700"
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
                                  <span className="font-semibold">
                                    {rm.name}
                                  </span>
                                </div>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-sky-300">
                                  {rm.coolingCapacityKw}kW
                                </span>
                              </button>

                              {/* Rows and Racks inside Room */}
                              <div className="pl-4 space-y-1.5 pt-1">
                                {rm.rows.map((row) => (
                                  <div
                                    key={row.id}
                                    className="p-2 rounded bg-slate-900/50 border border-slate-800/70 space-y-1.5"
                                  >
                                    <div className="flex items-center justify-between text-[11px]">
                                      <span className="text-slate-300 font-medium">
                                        {row.name}
                                      </span>
                                      {currentUserRole === "ADMIN" && (
                                        <button
                                          onClick={() =>
                                            openAddModal("RACK", row.id)
                                          }
                                          className="text-[10px] text-cyan-400 hover:underline"
                                        >
                                          + Rack
                                        </button>
                                      )}
                                    </div>
                                    <div className="flex flex-wrap gap-1.5">
                                      {row.racks.map((rk) => {
                                        const m = rackMetrics[rk.id];
                                        return (
                                          <Link
                                            key={rk.id}
                                            href={`/racks/${rk.id}`}
                                            className="px-2 py-1 rounded bg-slate-950 hover:bg-cyan-500/20 border border-slate-700 hover:border-cyan-500/50 text-[11px] font-mono text-slate-200 flex items-center gap-1"
                                          >
                                            <Server className="w-3 h-3 text-cyan-400" />
                                            <span>{rk.code}</span>
                                            {m && (
                                              <span className="text-[10px] text-slate-400">
                                                ({m.usedU}/{m.totalU}U)
                                              </span>
                                            )}
                                          </Link>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Right Interactive 2D Room Floor Plan & Layer Heatmap (8 cols) */}
        <div className="xl:col-span-8 space-y-6">
          {activeRoom ? (
            <div className="rounded-xl bg-slate-900/90 border border-slate-800 p-5 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300">
                      {activeRoom.code}
                    </span>
                    <h2 className="text-lg font-bold text-white">
                      {activeRoom.name} — 2D Raised-Floor Tile Map
                    </h2>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    {activeRoom.siteName} → {activeRoom.buildingName} →{" "}
                    {activeRoom.floorName} • Cooling:{" "}
                    <strong className="text-sky-300">
                      {activeRoom.coolingCapacityKw} kW (
                      {activeRoom.coolingRedundancy})
                    </strong>{" "}
                    • Target Temp: {activeRoom.ambientTempTargetC}°C
                  </p>
                </div>

                {/* Heatmap Layer Selector */}
                <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                  <Layers className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
                  <button
                    onClick={() => setHeatmapMode("POWER_KW")}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      heatmapMode === "POWER_KW"
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    Power Heatmap
                  </button>
                  <button
                    onClick={() => setHeatmapMode("U_SPACE")}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      heatmapMode === "U_SPACE"
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    U Space
                  </button>
                  <button
                    onClick={() => setHeatmapMode("REDUNDANCY")}
                    className={`px-2.5 py-1 rounded font-medium transition-colors ${
                      heatmapMode === "REDUNDANCY"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    A/B Redundancy
                  </button>
                </div>
              </div>

              {/* 2D Raised Floor Grid Visualization */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
                <div className="min-w-[680px] space-y-4">
                  {/* Legend */}
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pb-2 border-b border-slate-800/80 gap-3">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-cyan-500/30 border border-cyan-400 inline-block" />
                        Rack Enclosure (Click to Open)
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-sky-500/30 border border-sky-400 inline-block" />
                        CRAC / CRAH / In-Row Cooling Unit
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded bg-amber-500/30 border border-amber-400 inline-block" />
                        Under-Floor Commando Socket (L1/L2/L3)
                      </span>
                    </div>
                    <span>
                      Grid: {activeRoom.gridCols} × {activeRoom.gridRows} Raised
                      Floor Tiles (600mm × 600mm)
                    </span>
                  </div>

                  {/* Floor Plan Sections: Perimeter Cooling, Rows & Floor Sockets */}
                  <div className="space-y-4">
                    {/* Cooling Units Bar */}
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-sky-400 mb-2 flex items-center gap-1.5">
                        <ThermometerSnowflake className="w-3.5 h-3.5" />
                        Room Cooling Plant & Perimeter CRAH/In-Row Units
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {activeRoom.coolingUnits.map((cu) => (
                          <div
                            key={cu.id}
                            className="p-3 rounded-lg bg-sky-950/30 border border-sky-500/30 flex items-center justify-between"
                          >
                            <div>
                              <div className="text-xs font-bold text-white">
                                {cu.name}
                              </div>
                              <div className="text-[11px] text-sky-300 font-mono">
                                {cu.unitType} • {cu.capacityKw} kW Thermal
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                cu.status === "ONLINE"
                                  ? "bg-emerald-500/20 text-emerald-300"
                                  : "bg-amber-500/20 text-amber-300"
                              }`}
                            >
                              {cu.status}
                            </span>
                          </div>
                        ))}
                        {activeRoom.coolingUnits.length === 0 && (
                          <div className="text-xs text-slate-500 italic">
                            No dedicated cooling units documented in this room.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Rows and Racks Floor Layout */}
                    {activeRoom.rows.map((row) => (
                      <div
                        key={row.id}
                        className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              {row.name}
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                              {row.aisleContainment.replace("_", " ")}
                            </span>
                          </div>
                          {currentUserRole === "ADMIN" && (
                            <button
                              onClick={() => openAddModal("RACK", row.id)}
                              className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Add Rack to Row
                            </button>
                          )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {row.racks.map((rk) => {
                            const m = rackMetrics[rk.id];
                            const uPct = m?.uUtilizationPct ?? 0;
                            const pwrPct = m?.powerUtilizationPct ?? 0;
                            const hasSpof = (m?.spofDeviceCount ?? 0) > 0;

                            let borderClass =
                              "border-cyan-500/40 bg-slate-950/90";
                            if (heatmapMode === "POWER_KW") {
                              borderClass =
                                pwrPct >= 75
                                  ? "border-rose-500/60 bg-rose-950/20"
                                  : pwrPct >= 40
                                  ? "border-amber-500/60 bg-amber-950/20"
                                  : "border-emerald-500/50 bg-emerald-950/15";
                            } else if (heatmapMode === "U_SPACE") {
                              borderClass =
                                uPct >= 80
                                  ? "border-rose-500/60 bg-rose-950/20"
                                  : "border-cyan-500/50 bg-cyan-950/15";
                            } else if (heatmapMode === "REDUNDANCY") {
                              borderClass = hasSpof
                                ? "border-amber-500/70 bg-amber-950/25"
                                : "border-emerald-500/60 bg-emerald-950/20";
                            }

                            const rackSockets = roomCircuits.filter(
                              (c) => c.rackId === rk.id
                            );

                            return (
                              <Link
                                key={rk.id}
                                href={`/racks/${rk.id}`}
                                className={`p-3.5 rounded-xl border ${borderClass} hover:scale-[1.01] transition-all flex flex-col justify-between gap-3 group`}
                              >
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="text-sm font-bold text-white flex items-center gap-1.5 group-hover:text-cyan-300">
                                      <Server className="w-4 h-4 text-cyan-400" />
                                      {rk.code}
                                      <ArrowUpRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                                    </div>
                                    <div className="text-[11px] text-slate-400 mt-0.5">
                                      {rk.name}
                                    </div>
                                  </div>
                                  {hasSpof ? (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                      <Flame className="w-3 h-3" /> SPOF
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3" /> 2N OK
                                    </span>
                                  )}
                                </div>

                                {m && (
                                  <div className="space-y-2 text-xs">
                                    <div>
                                      <div className="flex justify-between text-[11px] mb-1">
                                        <span className="text-slate-400">
                                          U Space
                                        </span>
                                        <span className="font-mono text-white">
                                          {m.usedU}/{m.totalU}U ({m.freeU}U
                                          free)
                                        </span>
                                      </div>
                                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                        <div
                                          className="h-full bg-cyan-400"
                                          style={{
                                            width: `${Math.min(100, uPct)}%`,
                                          }}
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <div className="flex justify-between text-[11px] mb-1">
                                        <span className="text-slate-400">
                                          Power Load
                                        </span>
                                        <span className="font-mono text-amber-300">
                                          {m.currentPowerWatts}W /{" "}
                                          {m.maxPowerWatts}W
                                        </span>
                                      </div>
                                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                                        <div
                                          className="h-full bg-amber-400"
                                          style={{
                                            width: `${Math.min(100, pwrPct)}%`,
                                          }}
                                        />
                                      </div>
                                    </div>

                                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-slate-800/80 text-slate-400">
                                      <span>
                                        PDU Outlets: {m.freeOutlets} free /{" "}
                                        {m.totalOutlets}
                                      </span>
                                    </div>
                                  </div>
                                )}

                                {/* Floor Sockets under this Rack */}
                                {rackSockets.length > 0 && (
                                  <div className="pt-2 border-t border-slate-800/80 space-y-1">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                                      <PlugZap className="w-3 h-3 text-amber-400" />
                                      Floor Power Whips:
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {rackSockets.map((fs) => (
                                        <span
                                          key={fs.id}
                                          className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-amber-200"
                                        >
                                          {fs.floorSocketLabel} (
                                          {fs.phaseAllocation} • {fs.ratedAmps}
                                          A)
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-slate-900 border border-slate-800 text-center text-sm text-slate-400">
              Select a room from the hierarchy tree to view its floor plan.
            </div>
          )}
        </div>
      </div>

      {/* Admin Add Hierarchy Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white">
                Add New {entityType} to Infrastructure
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleCreateEntity} className="space-y-3 text-xs">
              <div>
                <label htmlFor="hierarchy-name" className="block text-slate-300 mb-1 font-medium">
                  Name / Description
                </label>
                <input
                  id="hierarchy-name"
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder={`e.g. ${
                    entityType === "RACK"
                      ? "Rack A04 (Compute)"
                      : entityType === "ROOM"
                      ? "Data Hall 1B"
                      : "New Item"
                  }`}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white"
                />
              </div>

              {(entityType === "SITE" ||
                entityType === "BUILDING" ||
                entityType === "ROOM" ||
                entityType === "RACK") && (
                <div>
                  <label htmlFor="hierarchy-code" className="block text-slate-300 mb-1 font-medium">
                    Short Code
                  </label>
                  <input
                    id="hierarchy-code"
                    type="text"
                    required
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    placeholder={
                      entityType === "RACK"
                        ? "R-A04"
                        : entityType === "SITE"
                        ? "FRA-DC3"
                        : "CODE-01"
                    }
                    className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white font-mono"
                  />
                </div>
              )}

              {entityType === "RACK" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      Height (Total U)
                    </label>
                    <input
                      type="number"
                      value={formNumber1}
                      onChange={(e) => setFormNumber1(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      Max Power (Watts)
                    </label>
                    <input
                      type="number"
                      value={formNumber2}
                      onChange={(e) => setFormNumber2(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white"
                    />
                  </div>
                </div>
              )}

              {entityType === "ROOM" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      Cooling Capacity (kW)
                    </label>
                    <input
                      type="number"
                      value={formNumber1}
                      onChange={(e) => setFormNumber1(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1 font-medium">
                      Target Temp (°C)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={formNumber2}
                      onChange={(e) => setFormNumber2(e.target.value)}
                      className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3 py-2 rounded bg-slate-800 text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded bg-cyan-500 text-slate-950 font-semibold"
                >
                  Create {entityType}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  Building2,
  ChevronRight,
  Columns3,
  Globe,
  Grid2x2,
  Layers,
  PanelLeftClose,
  PlugZap,
  Search,
  Server,
  Zap,
} from "lucide-react";
import {
  useInfrastructure,
  type FloorCircuit,
  type TreeBuilding,
  type TreeFloor,
  type TreePanel,
  type TreeRoom,
  type TreeRow,
  type TreeSite,
} from "./infrastructure-context";

const PHASES = ["L1", "L2", "L3", "THREE_PHASE"] as const;

function includes(query: string, ...parts: Array<string | number | undefined>) {
  return parts.some((part) => String(part ?? "").toLowerCase().includes(query));
}

function filterSites(
  sites: TreeSite[],
  query: string,
  panelsByRoom: Map<string, TreePanel[]>,
  circuitsByPanel: Map<string, FloorCircuit[]>
): TreeSite[] {
  if (!query) return sites;
  return sites.flatMap((site) => {
    if (includes(query, site.name, site.code, site.city)) return [site];
    const buildings = site.buildings.flatMap((building) =>
      filterBuilding(building, query, panelsByRoom, circuitsByPanel)
    );
    return buildings.length ? [{ ...site, buildings }] : [];
  });
}

function filterBuilding(
  building: TreeBuilding,
  query: string,
  panelsByRoom: Map<string, TreePanel[]>,
  circuitsByPanel: Map<string, FloorCircuit[]>
): TreeBuilding[] {
  if (includes(query, building.name, building.code)) return [building];
  const floors = building.floors.flatMap((floor) =>
    filterFloor(floor, query, panelsByRoom, circuitsByPanel)
  );
  return floors.length ? [{ ...building, floors }] : [];
}

function filterFloor(
  floor: TreeFloor,
  query: string,
  panelsByRoom: Map<string, TreePanel[]>,
  circuitsByPanel: Map<string, FloorCircuit[]>
): TreeFloor[] {
  if (includes(query, floor.name, floor.levelNumber)) return [floor];
  const rooms = floor.rooms.flatMap((room) =>
    filterRoom(room, query, panelsByRoom, circuitsByPanel)
  );
  return rooms.length ? [{ ...floor, rooms }] : [];
}

function filterRoom(
  room: TreeRoom,
  query: string,
  panelsByRoom: Map<string, TreePanel[]>,
  circuitsByPanel: Map<string, FloorCircuit[]>
): TreeRoom[] {
  if (includes(query, room.name, room.code)) return [room];
  const rows = room.rows.flatMap((row) => filterRow(row, query));
  const roomPanels = panelsByRoom.get(room.id) || [];
  const powerMatched = roomPanels.some((panel) => {
    if (includes(query, panel.name, `feed ${panel.feedSide}`)) return true;
    const panelCircuits = circuitsByPanel.get(panel.id) || [];
    return panelCircuits.some((c) =>
      includes(
        query,
        c.floorSocketLabel,
        c.name,
        c.phaseAllocation,
        c.socketType,
        `#${c.breakerNumber}`
      )
    );
  });
  if (rows.length || powerMatched) {
    return [{ ...room, rows: rows.length ? rows : room.rows }];
  }
  return [];
}

function filterRow(row: TreeRow, query: string): TreeRow[] {
  if (includes(query, row.name)) return [row];
  const racks = row.racks.filter((rack) => includes(query, rack.code, rack.name));
  return racks.length ? [{ ...row, racks }] : [];
}

export function LocationTree({
  collapsed,
  onCollapse,
}: {
  collapsed: boolean;
  onCollapse: () => void;
}) {
  const {
    loading,
    role,
    sites,
    panels,
    circuits,
    rackMetrics,
    panelMetrics,
    expanded,
    toggle,
    openAdd,
  } = useInfrastructure();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const roomId = searchParams.get("room") || "";
  const activePanelId = pathname.startsWith("/power-cooling")
    ? searchParams.get("panel") || ""
    : "";
  const activePhase = pathname.startsWith("/power-cooling")
    ? searchParams.get("phase") || ""
    : "";
  const activeSocketId = pathname.startsWith("/power-cooling")
    ? searchParams.get("socket") || ""
    : "";
  const rackId = pathname.match(/^\/racks\/([^/]+)/)?.[1] || "";
  const siteId = pathname.match(/^\/sites\/([^/]+)/)?.[1] || "";
  const buildingId = pathname.match(/^\/buildings\/([^/]+)/)?.[1] || "";
  const floorId = pathname.match(/^\/floors\/([^/]+)/)?.[1] || "";
  const rowId = pathname.match(/^\/rows\/([^/]+)/)?.[1] || "";

  const panelsByRoom = useMemo(() => {
    const map = new Map<string, TreePanel[]>();
    for (const p of panels) {
      const list = map.get(p.roomId) || [];
      list.push(p);
      map.set(p.roomId, list);
    }
    return map;
  }, [panels]);

  const circuitsByPanel = useMemo(() => {
    const map = new Map<string, FloorCircuit[]>();
    for (const c of circuits) {
      const list = map.get(c.panelId) || [];
      list.push(c);
      map.set(c.panelId, list);
    }
    return map;
  }, [circuits]);

  const rackCodeById = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of sites) {
      for (const b of s.buildings) {
        for (const f of b.floors) {
          for (const rm of f.rooms) {
            for (const rw of rm.rows) {
              for (const rk of rw.racks) map.set(rk.id, rk.code);
            }
          }
        }
      }
    }
    return map;
  }, [sites]);

  const searching = query.trim().length > 0;
  const normalizedQuery = query.trim().toLowerCase();
  const visible = filterSites(sites, normalizedQuery, panelsByRoom, circuitsByPanel);
  const admin = role === "ADMIN";

  function isOpen(id: string) {
    return searching || expanded.has(id);
  }

  function selectRoom(id: string) {
    router.push(`/hierarchy?room=${encodeURIComponent(id)}`);
  }

  if (collapsed) {
    return (
      <div className="hidden lg:flex h-full w-12 flex-col items-center border-r border-slate-800 bg-slate-900 py-3">
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Show locations"
          title="Show locations"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <PanelLeftClose className="h-4 w-4 rotate-180" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-[280px] flex-col border-r border-slate-800 bg-slate-900">
      <div className="space-y-2 border-b border-slate-800 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Locations
          </span>
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse locations"
            title="Collapse locations"
            className="hidden rounded-md p-1 text-slate-500 hover:bg-slate-800 hover:text-white lg:inline-flex"
          >
            <PanelLeftClose className="h-3.5 w-3.5" />
          </button>
        </div>
        <label className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-2 py-1.5">
          <Search className="h-3.5 w-3.5 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label="Search locations"
            placeholder="Search"
            className="w-full bg-transparent text-xs text-white outline-none placeholder:text-slate-600"
          />
        </label>
      </div>
      <nav aria-label="Locations" className="min-h-0 flex-1 overflow-y-auto px-2 py-2 text-xs">
        {loading && sites.length === 0 && (
          <p className="px-2 py-3 text-slate-500">Loading locations…</p>
        )}
        {!loading && visible.length === 0 && (
          <p className="px-2 py-3 text-slate-500">
            {sites.length === 0 ? "No sites yet." : "No locations match that search."}
          </p>
        )}
        <ul className="space-y-1">
          {visible.map((site) => (
            <li key={site.id}>
              <div className="flex items-center gap-1 rounded-md px-1 py-1">
                <BranchToggle
                  open={isOpen(site.id)}
                  onClick={() => toggle(site.id)}
                />
                <Globe className="h-3.5 w-3.5 shrink-0 text-cyan-400" aria-hidden="true" />
                <Link
                  href={`/sites/${site.id}`}
                  aria-current={site.id === siteId ? "page" : undefined}
                  className={`min-w-0 truncate rounded-md px-1 py-0.5 font-semibold ${
                    site.id === siteId
                      ? "bg-cyan-500/15 text-white"
                      : "text-white hover:bg-slate-800"
                  }`}
                >
                  {site.name}
                </Link>
                <span className="shrink-0 text-[10px] font-bold text-cyan-300">{site.code}</span>
                {admin && (
                  <button
                    type="button"
                    onClick={() => openAdd("BUILDING", site.id)}
                    className="ml-auto shrink-0 text-[10px] text-cyan-400 hover:underline"
                  >
                    + Bldg
                  </button>
                )}
              </div>
              {isOpen(site.id) && (
                <ul className="space-y-1 border-l border-slate-800 ml-3 pl-1">
                  {site.buildings.map((building) => (
                    <li key={building.id}>
                      <div className="flex items-center gap-1 rounded-md px-1 py-1">
                        <BranchToggle
                          open={isOpen(building.id)}
                          onClick={() => toggle(building.id)}
                        />
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-sky-400" aria-hidden="true" />
                        <Link
                          href={`/buildings/${building.id}`}
                          aria-current={building.id === buildingId ? "page" : undefined}
                          className={`min-w-0 truncate rounded-md px-1 py-0.5 font-medium ${
                            building.id === buildingId
                              ? "bg-cyan-500/15 text-white"
                              : "text-slate-200 hover:bg-slate-800"
                          }`}
                        >
                          {building.name} ({building.code})
                        </Link>
                        {admin && (
                          <button
                            type="button"
                            onClick={() => openAdd("FLOOR", building.id)}
                            className="ml-auto shrink-0 text-[10px] text-cyan-400 hover:underline"
                          >
                            + Floor
                          </button>
                        )}
                      </div>
                      {isOpen(building.id) && (
                        <ul className="space-y-1 border-l border-slate-800/80 ml-3 pl-1">
                          {building.floors.map((floor) => (
                            <li key={floor.id}>
                              <div className="flex items-center gap-1 rounded-md px-1 py-1 text-slate-400">
                                <BranchToggle
                                  open={isOpen(floor.id)}
                                  onClick={() => toggle(floor.id)}
                                />
                                <Layers className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                                <Link
                                  href={`/floors/${floor.id}`}
                                  aria-current={floor.id === floorId ? "page" : undefined}
                                  className={`min-w-0 truncate rounded-md px-1 py-0.5 ${
                                    floor.id === floorId
                                      ? "bg-cyan-500/15 text-white"
                                      : "hover:bg-slate-800 hover:text-slate-200"
                                  }`}
                                >
                                  Level {floor.levelNumber}: {floor.name}
                                </Link>
                                {admin && (
                                  <button
                                    type="button"
                                    onClick={() => openAdd("ROOM", floor.id)}
                                    className="ml-auto shrink-0 text-[10px] text-cyan-400 hover:underline"
                                  >
                                    + Room
                                  </button>
                                )}
                              </div>
                              {isOpen(floor.id) && (
                                <ul className="space-y-1 ml-3">
                                  {floor.rooms.map((room) => {
                                    const selected =
                                      pathname.startsWith("/hierarchy") && room.id === roomId;
                                    const rackCount = room.rows.reduce(
                                      (count, row) => count + row.racks.length,
                                      0
                                    );
                                    const roomPanels = panelsByRoom.get(room.id) || [];
                                    return (
                                      <li key={room.id}>
                                        <div className="flex items-center gap-1">
                                          <BranchToggle
                                            open={isOpen(room.id)}
                                            onClick={() => toggle(room.id)}
                                          />
                                          <Grid2x2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" aria-hidden="true" />
                                          <button
                                            type="button"
                                            onClick={() => selectRoom(room.id)}
                                            className={`min-w-0 flex-1 truncate rounded-md px-1.5 py-1 text-left font-semibold ${
                                              selected
                                                ? "bg-cyan-500/15 text-white"
                                                : "text-slate-200 hover:bg-slate-800"
                                            }`}
                                          >
                                            {room.name}
                                          </button>
                                          <span className="shrink-0 text-[10px] text-sky-300">
                                            {rackCount}
                                          </span>
                                        </div>
                                        {isOpen(room.id) && (
                                          <ul className="mt-1 space-y-1 ml-4">
                                            {room.rows.map((row) => (
                                              <li key={row.id}>
                                                <div className="flex items-center gap-1 px-1 py-0.5">
                                                  <BranchToggle
                                                    open={isOpen(row.id)}
                                                    onClick={() => toggle(row.id)}
                                                  />
                                                  <Columns3 className="h-3.5 w-3.5 shrink-0 text-violet-400" aria-hidden="true" />
                                                  <Link
                                                    href={`/rows/${row.id}`}
                                                    aria-current={row.id === rowId ? "page" : undefined}
                                                    className={`min-w-0 truncate rounded-md px-1 py-0.5 ${
                                                      row.id === rowId
                                                        ? "bg-cyan-500/15 text-white"
                                                        : "text-slate-300 hover:bg-slate-800"
                                                    }`}
                                                  >
                                                    {row.name}
                                                  </Link>
                                                  {admin && (
                                                    <button
                                                      type="button"
                                                      onClick={() => openAdd("RACK", row.id)}
                                                      className="ml-auto shrink-0 text-[10px] text-cyan-400 hover:underline"
                                                    >
                                                      + Rack
                                                    </button>
                                                  )}
                                                </div>
                                                {isOpen(row.id) && (
                                                  <ul className="ml-5 space-y-0.5 py-0.5">
                                                    {row.racks.map((rack) => {
                                                      const metric = rackMetrics[rack.id];
                                                      const rackSelected = rack.id === rackId;
                                                      return (
                                                        <li key={rack.id}>
                                                          <Link
                                                            href={`/racks/${rack.id}`}
                                                            aria-label={rack.code}
                                                            className={`flex items-center gap-1.5 rounded px-1.5 py-1 font-mono ${
                                                              rackSelected
                                                                ? "bg-cyan-500/15 text-cyan-100"
                                                                : "text-slate-300 hover:bg-slate-800"
                                                            }`}
                                                          >
                                                            <Server
                                                              className={`h-3 w-3 shrink-0 ${
                                                                rackSelected ? "text-cyan-400" : "text-slate-500"
                                                              }`}
                                                              aria-hidden="true"
                                                            />
                                                            <span>{rack.code}</span>
                                                            <span className="truncate font-sans text-[10px] text-slate-500">
                                                              {rack.name}
                                                            </span>
                                                            {metric && (
                                                              <span className="ml-auto shrink-0 font-sans text-[10px] text-slate-500">
                                                                {metric.usedU}/{metric.totalU}U
                                                              </span>
                                                            )}
                                                          </Link>
                                                        </li>
                                                      );
                                                    })}
                                                  </ul>
                                                )}
                                              </li>
                                            ))}

                                            {roomPanels.map((panel) => {
                                              const panelCircuits =
                                                circuitsByPanel.get(panel.id) || [];
                                              const pm = panelMetrics[panel.id];
                                              const panelSelected =
                                                activePanelId === panel.id &&
                                                !activePhase &&
                                                !activeSocketId;
                                              return (
                                                <li key={panel.id}>
                                                  <div className="flex items-center gap-1 px-1 py-0.5">
                                                    <BranchToggle
                                                      open={isOpen(panel.id)}
                                                      onClick={() => toggle(panel.id)}
                                                    />
                                                    <Zap
                                                      className={`h-3.5 w-3.5 shrink-0 ${
                                                        panel.feedSide === "A"
                                                          ? "text-blue-400"
                                                          : "text-amber-400"
                                                      }`}
                                                      aria-hidden="true"
                                                    />
                                                    <Link
                                                      href={`/power-cooling?panel=${encodeURIComponent(panel.id)}`}
                                                      className={`min-w-0 truncate rounded-md px-1 py-0.5 ${
                                                        panelSelected
                                                          ? "bg-cyan-500/15 text-white"
                                                          : "text-slate-300 hover:bg-slate-800"
                                                      }`}
                                                    >
                                                      {panel.name}
                                                    </Link>
                                                    <span
                                                      className={`ml-auto shrink-0 rounded px-1 py-0.5 text-[9px] font-bold ${
                                                        panel.feedSide === "A"
                                                          ? "bg-blue-500/15 text-blue-300"
                                                          : "bg-amber-500/15 text-amber-300"
                                                      }`}
                                                    >
                                                      {panel.feedSide}
                                                    </span>
                                                  </div>
                                                  {isOpen(panel.id) && (
                                                    <ul className="ml-4 space-y-0.5 border-l border-slate-800/80 pl-1 py-0.5">
                                                      {PHASES.map((phase) => {
                                                        const phaseCircuits = panelCircuits.filter(
                                                          (c) => c.phaseAllocation === phase
                                                        );
                                                        if (
                                                          phase === "THREE_PHASE" &&
                                                          phaseCircuits.length === 0
                                                        ) {
                                                          return null;
                                                        }
                                                        const phaseNodeId = `${panel.id}:${phase}`;
                                                        const phaseAmps =
                                                          phase === "L1"
                                                            ? pm?.phaseLoad.ampsL1 ?? 0
                                                            : phase === "L2"
                                                            ? pm?.phaseLoad.ampsL2 ?? 0
                                                            : phase === "L3"
                                                            ? pm?.phaseLoad.ampsL3 ?? 0
                                                            : null;
                                                        const phaseSelected =
                                                          activePanelId === panel.id &&
                                                          activePhase === phase;
                                                        const phaseLabel =
                                                          phase === "THREE_PHASE"
                                                            ? "3-Phase"
                                                            : `Phase ${phase}`;
                                                        return (
                                                          <li key={phaseNodeId}>
                                                            <div className="flex items-center gap-1 px-1 py-0.5">
                                                              <BranchToggle
                                                                open={isOpen(phaseNodeId)}
                                                                onClick={() => toggle(phaseNodeId)}
                                                              />
                                                              <Activity
                                                                className="h-3 w-3 shrink-0 text-cyan-400"
                                                                aria-hidden="true"
                                                              />
                                                              <Link
                                                                href={`/power-cooling?panel=${encodeURIComponent(panel.id)}&phase=${encodeURIComponent(phase)}`}
                                                                className={`min-w-0 truncate rounded px-1 py-0.5 text-[11px] ${
                                                                  phaseSelected
                                                                    ? "bg-cyan-500/15 text-white"
                                                                    : "text-slate-300 hover:bg-slate-800"
                                                                }`}
                                                              >
                                                                {phaseLabel}
                                                              </Link>
                                                              <span className="ml-auto shrink-0 font-mono text-[10px] text-slate-500">
                                                                {phaseAmps !== null
                                                                  ? `${phaseAmps}A`
                                                                  : `${phaseCircuits.length}`}
                                                              </span>
                                                            </div>
                                                            {isOpen(phaseNodeId) && (
                                                              <ul className="ml-5 space-y-0.5 py-0.5">
                                                                {phaseCircuits.length === 0 ? (
                                                                  <li className="px-1.5 py-0.5 text-[10px] text-slate-500">
                                                                    No floor sockets
                                                                  </li>
                                                                ) : (
                                                                  phaseCircuits.map((circuit) => {
                                                                    const socketSelected =
                                                                      activeSocketId === circuit.id;
                                                                    const rackCode = circuit.rackId
                                                                      ? rackCodeById.get(
                                                                          circuit.rackId
                                                                        )
                                                                      : null;
                                                                    return (
                                                                      <li key={circuit.id}>
                                                                        <Link
                                                                          href={`/power-cooling?socket=${encodeURIComponent(circuit.id)}`}
                                                                          className={`flex items-center gap-1.5 rounded px-1.5 py-1 font-mono text-[11px] ${
                                                                            socketSelected
                                                                              ? "bg-cyan-500/15 text-cyan-100"
                                                                              : "text-slate-300 hover:bg-slate-800"
                                                                          }`}
                                                                        >
                                                                          <PlugZap
                                                                            className={`h-3 w-3 shrink-0 ${
                                                                              socketSelected
                                                                                ? "text-cyan-400"
                                                                                : "text-amber-400"
                                                                            }`}
                                                                            aria-hidden="true"
                                                                          />
                                                                          <span className="truncate">
                                                                            {circuit.floorSocketLabel}
                                                                          </span>
                                                                          <span className="truncate font-sans text-[10px] text-slate-500">
                                                                            #{circuit.breakerNumber}{" "}
                                                                            · {circuit.ratedAmps}A
                                                                          </span>
                                                                          {rackCode && (
                                                                            <span className="ml-auto shrink-0 font-mono text-[10px] text-cyan-400">
                                                                              {rackCode}
                                                                            </span>
                                                                          )}
                                                                        </Link>
                                                                      </li>
                                                                    );
                                                                  })
                                                                )}
                                                              </ul>
                                                            )}
                                                          </li>
                                                        );
                                                      })}
                                                    </ul>
                                                  )}
                                                </li>
                                              );
                                            })}
                                          </ul>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function BranchToggle({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={open ? "Collapse" : "Expand"}
      className="grid h-5 w-5 shrink-0 place-items-center rounded text-slate-500 hover:bg-slate-800 hover:text-white"
    >
      <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
    </button>
  );
}

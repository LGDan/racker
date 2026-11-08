"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, PanelLeftClose, Search } from "lucide-react";
import {
  useInfrastructure,
  type TreeBuilding,
  type TreeFloor,
  type TreeRoom,
  type TreeRow,
  type TreeSite,
} from "./infrastructure-context";

function includes(query: string, ...parts: Array<string | number | undefined>) {
  return parts.some((part) => String(part ?? "").toLowerCase().includes(query));
}

function filterSites(sites: TreeSite[], query: string): TreeSite[] {
  if (!query) return sites;
  return sites.flatMap((site) => {
    if (includes(query, site.name, site.code, site.city)) return [site];
    const buildings = site.buildings.flatMap((building) => filterBuilding(building, query));
    return buildings.length ? [{ ...site, buildings }] : [];
  });
}

function filterBuilding(building: TreeBuilding, query: string): TreeBuilding[] {
  if (includes(query, building.name, building.code)) return [building];
  const floors = building.floors.flatMap((floor) => filterFloor(floor, query));
  return floors.length ? [{ ...building, floors }] : [];
}

function filterFloor(floor: TreeFloor, query: string): TreeFloor[] {
  if (includes(query, floor.name, floor.levelNumber)) return [floor];
  const rooms = floor.rooms.flatMap((room) => filterRoom(room, query));
  return rooms.length ? [{ ...floor, rooms }] : [];
}

function filterRoom(room: TreeRoom, query: string): TreeRoom[] {
  if (includes(query, room.name, room.code)) return [room];
  const rows = room.rows.flatMap((row) => filterRow(row, query));
  return rows.length ? [{ ...room, rows }] : [];
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
    rackMetrics,
    expanded,
    toggle,
    openAdd,
  } = useInfrastructure();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const roomId = searchParams.get("room") || "";
  const rackMatch = pathname.match(/^\/racks\/([^/]+)/);
  const rackId = rackMatch?.[1] || "";
  const searching = query.trim().length > 0;
  const visible = filterSites(sites, query.trim().toLowerCase());
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
                <span className="truncate font-semibold text-white">{site.name}</span>
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
                        <span className="truncate font-medium text-slate-200">
                          {building.name} ({building.code})
                        </span>
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
                                <span className="truncate">
                                  Level {floor.levelNumber}: {floor.name}
                                </span>
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
                                    return (
                                      <li key={room.id}>
                                        <div className="flex items-center gap-1">
                                          <BranchToggle
                                            open={isOpen(room.id)}
                                            onClick={() => toggle(room.id)}
                                          />
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
                                                  <span className="truncate text-slate-300">
                                                    {row.name}
                                                  </span>
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

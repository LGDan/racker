"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";

export type AddEntity = "SITE" | "BUILDING" | "FLOOR" | "ROOM" | "ROW" | "RACK";

export interface TreeRack {
  id: string;
  name: string;
  code: string;
  totalU: number;
  maxPowerWatts: number;
  posX: number;
  posY: number;
  devices?: {
    id: string;
    name: string;
    deviceType: string;
    startU: number;
    uHeight: number;
  }[];
}

export interface TreeRow {
  id: string;
  name: string;
  orientation: string;
  aisleContainment: string;
  gridX: number;
  gridY: number;
  racks: TreeRack[];
}

export interface TreeRoom {
  id: string;
  name: string;
  code: string;
  roomType: string;
  coolingCapacityKw: number;
  coolingRedundancy: string;
  ambientTempTargetC: number;
  gridCols: number;
  gridRows: number;
  floorTiles?: { id: string; posX: number; posY: number; surface: string }[];
  obstructions?: { id: string; posX: number; posY: number; label: string }[];
  coolingUnits: {
    id: string;
    name: string;
    unitType: string;
    capacityKw: number;
    status: string;
    posX: number;
    posY: number;
  }[];
  rows: TreeRow[];
}

export interface TreeFloor {
  id: string;
  name: string;
  levelNumber: number;
  rooms: TreeRoom[];
}

export interface TreeBuilding {
  id: string;
  name: string;
  code: string;
  floors: TreeFloor[];
}

export interface TreeSite {
  id: string;
  name: string;
  code: string;
  city: string;
  country: string;
  utilityCapacityKw: number;
  buildings: TreeBuilding[];
}

export interface RackMetric {
  id: string;
  usedU: number;
  totalU: number;
  uUtilizationPct: number;
  powerUtilizationPct: number;
  spofDeviceCount: number;
}

export interface FloorCircuit {
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
  elevation?: string;
}

const EMPTY_SITES: TreeSite[] = [];

interface Snapshot {
  sites: TreeSite[];
  powerCircuits: FloorCircuit[];
  capacity?: { racks?: RackMetric[] };
  currentUser?: { role?: "ADMIN" | "STANDARD" };
}

interface InfrastructureValue {
  loading: boolean;
  role: "ADMIN" | "STANDARD";
  sites: TreeSite[];
  circuits: FloorCircuit[];
  rackMetrics: Record<string, RackMetric>;
  expanded: ReadonlySet<string>;
  toggle: (id: string) => void;
  expand: (id: string) => void;
  openAdd: (type: AddEntity, parentId?: string) => void;
  refresh: () => Promise<void>;
}

const InfrastructureContext = createContext<InfrastructureValue | null>(null);

export function useInfrastructure() {
  const value = useContext(InfrastructureContext);
  if (!value) {
    throw new Error("useInfrastructure must be used inside InfrastructureProvider");
  }
  return value;
}

function parentLookup(sites: TreeSite[]) {
  const parents = new Map<string, string | undefined>();
  for (const site of sites) {
    parents.set(site.id, undefined);
    for (const building of site.buildings) {
      parents.set(building.id, site.id);
      for (const floor of building.floors) {
        parents.set(floor.id, building.id);
        for (const room of floor.rooms) {
          parents.set(room.id, floor.id);
          for (const row of room.rows) {
            parents.set(row.id, room.id);
            for (const rack of row.racks) parents.set(rack.id, row.id);
          }
        }
      }
    }
  }
  return parents;
}

export function ancestorIds(
  sites: TreeSite[],
  selection: { roomId?: string; rackId?: string }
) {
  for (const site of sites) {
    for (const building of site.buildings) {
      for (const floor of building.floors) {
        for (const room of floor.rooms) {
          if (selection.rackId) {
            for (const row of room.rows) {
              if (row.racks.some((rack) => rack.id === selection.rackId)) {
                return [site.id, building.id, floor.id, room.id, row.id];
              }
            }
          }
          if (selection.roomId && room.id === selection.roomId) {
            return [site.id, building.id, floor.id];
          }
        }
      }
    }
  }
  return [];
}

export function roomIdForRack(sites: TreeSite[], rackId: string) {
  for (const site of sites) {
    for (const building of site.buildings) {
      for (const floor of building.floors) {
        for (const room of floor.rooms) {
          for (const row of room.rows) {
            if (row.racks.some((rack) => rack.id === rackId)) return room.id;
          }
        }
      }
    }
  }
  return undefined;
}

export function firstRackInRoom(sites: TreeSite[], roomId: string) {
  for (const site of sites) {
    for (const building of site.buildings) {
      for (const floor of building.floors) {
        for (const room of floor.rooms) {
          if (room.id !== roomId) continue;
          for (const row of room.rows) {
            if (row.racks[0]) return row.racks[0].id;
          }
        }
      }
    }
  }
  return undefined;
}

export function InfrastructureProvider({
  role,
  children,
}: {
  role: "ADMIN" | "STANDARD";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [resolvedRole, setResolvedRole] = useState(role);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [addRequest, setAddRequest] = useState<{
    type: AddEntity;
    parentId: string;
  } | null>(null);
  const sitesRef = useRef<TreeSite[]>([]);

  const sites = snapshot?.sites ?? EMPTY_SITES;
  sitesRef.current = sites;

  const refresh = useCallback(async () => {
    const res = await fetch("/api/infrastructure");
    if (!res.ok) return;
    const data = (await res.json()) as Snapshot;
    setSnapshot(data);
    if (data.currentUser?.role) setResolvedRole(data.currentUser.role);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    refresh().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const roomId = searchParams.get("room") || "";
  const rackMatch = pathname.match(/^\/racks\/([^/]+)/);
  const rackId = rackMatch?.[1] || "";

  useEffect(() => {
    const ids = ancestorIds(sites, { roomId, rackId });
    if (!ids.length) return;
    setExpanded((prev) => {
      let changed = false;
      const next = new Set(prev);
      for (const id of ids) {
        if (!next.has(id)) {
          next.add(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [sites, roomId, rackId]);

  const expand = useCallback((id: string) => {
    const parents = parentLookup(sitesRef.current);
    setExpanded((prev) => {
      const next = new Set(prev);
      let current: string | undefined = id;
      while (current) {
        next.add(current);
        current = parents.get(current);
      }
      return next;
    });
  }, []);

  const toggle = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openAdd = useCallback(
    (type: AddEntity, parentId = "") => {
      if (parentId) expand(parentId);
      setAddRequest({ type, parentId });
    },
    [expand]
  );

  const rackMetrics = useMemo(() => {
    const map: Record<string, RackMetric> = {};
    for (const rack of snapshot?.capacity?.racks || []) map[rack.id] = rack;
    return map;
  }, [snapshot]);

  const value = useMemo<InfrastructureValue>(
    () => ({
      loading,
      role: resolvedRole,
      sites,
      circuits: snapshot?.powerCircuits || [],
      rackMetrics,
      expanded,
      toggle,
      expand,
      openAdd,
      refresh,
    }),
    [
      loading,
      resolvedRole,
      sites,
      snapshot?.powerCircuits,
      rackMetrics,
      expanded,
      toggle,
      expand,
      openAdd,
      refresh,
    ]
  );

  return (
    <InfrastructureContext.Provider value={value}>
      {children}
      {addRequest && (
        <HierarchyCreateDialog
          type={addRequest.type}
          parentId={addRequest.parentId}
          onClose={() => setAddRequest(null)}
          onCreated={refresh}
        />
      )}
    </InfrastructureContext.Provider>
  );
}

function HierarchyCreateDialog({
  type,
  parentId,
  onClose,
  onCreated,
}: {
  type: AddEntity;
  parentId: string;
  onClose: () => void;
  onCreated: () => Promise<void>;
}) {
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [formNumber1, setFormNumber1] = useState(
    type === "SITE" ? "3000" : type === "ROOM" ? "150" : "42"
  );
  const [formNumber2, setFormNumber2] = useState(type === "ROOM" ? "21.5" : "12000");
  const [formPosX, setFormPosX] = useState("4");
  const [formPosY, setFormPosY] = useState("3");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleCreateEntity(event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg(null);
    const payload: Record<string, unknown> = {
      entityType: type,
      name: formName,
      code: formCode,
    };
    if (type === "SITE") {
      payload.utilityCapacityKw = Number(formNumber1);
    } else if (type === "BUILDING") {
      payload.siteId = parentId;
    } else if (type === "FLOOR") {
      payload.buildingId = parentId;
      payload.levelNumber = 1;
    } else if (type === "ROOM") {
      payload.floorId = parentId;
      payload.coolingCapacityKw = Number(formNumber1 || 150);
      payload.ambientTempTargetC = Number(formNumber2 || 21.5);
    } else if (type === "ROW") {
      payload.roomId = parentId;
      payload.gridX = Number(formPosX || 2);
      payload.gridY = Number(formPosY || 3);
    } else if (type === "RACK") {
      payload.rowId = parentId;
      payload.totalU = Number(formNumber1 || 42);
      payload.maxPowerWatts = Number(formNumber2 || 12000);
      payload.posX = Number(formPosX || 4);
      payload.posY = Number(formPosY || 3);
    }

    setSaving(true);
    try {
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
      await onCreated();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">
            Add New {type} to Infrastructure
          </h3>
          <button
            type="button"
            onClick={onClose}
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
              onChange={(event) => setFormName(event.target.value)}
              placeholder={`e.g. ${
                type === "RACK"
                  ? "Rack A04 (Compute)"
                  : type === "ROOM"
                  ? "Data Hall 1B"
                  : "New Item"
              }`}
              className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white"
            />
          </div>

          {(type === "SITE" || type === "BUILDING" || type === "ROOM" || type === "RACK") && (
            <div>
              <label htmlFor="hierarchy-code" className="block text-slate-300 mb-1 font-medium">
                Short Code
              </label>
              <input
                id="hierarchy-code"
                type="text"
                required
                value={formCode}
                onChange={(event) => setFormCode(event.target.value)}
                placeholder={
                  type === "RACK" ? "R-A04" : type === "SITE" ? "FRA-DC3" : "CODE-01"
                }
                className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>
          )}

          {type === "RACK" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Height (Total U)</label>
                <input
                  type="number"
                  value={formNumber1}
                  onChange={(event) => setFormNumber1(event.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Max Power (Watts)</label>
                <input
                  type="number"
                  value={formNumber2}
                  onChange={(event) => setFormNumber2(event.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white"
                />
              </div>
            </div>
          )}

          {type === "ROOM" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-medium">
                  Cooling Capacity (kW)
                </label>
                <input
                  type="number"
                  value={formNumber1}
                  onChange={(event) => setFormNumber1(event.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-medium">Target Temp (°C)</label>
                <input
                  type="number"
                  step="0.5"
                  value={formNumber2}
                  onChange={(event) => setFormNumber2(event.target.value)}
                  className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded bg-slate-800 text-slate-300"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded bg-cyan-500 text-slate-950 font-semibold disabled:opacity-60"
            >
              Create {type}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

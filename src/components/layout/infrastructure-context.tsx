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
import { placedCode, suggestedCode } from "@/lib/suggested-code";

export type AddEntity = "SITE" | "BUILDING" | "FLOOR" | "ROOM" | "ROW" | "RACK";

export interface TreeRack {
  id: string;
  name: string;
  code: string;
  totalU: number;
  maxPowerWatts: number;
  maxWeightKg: number;
  posX: number;
  posY: number;
  devices?: {
    id: string;
    name: string;
    hostname?: string | null;
    deviceType: string;
    startU: number;
    uHeight: number;
  }[];
}

export interface TreeRow {
  id: string;
  name: string;
  code?: string | null;
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
  code?: string | null;
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
  address: string;
  city: string;
  country: string;
  utilityCapacityKw: number;
  pueTarget: number;
  buildings: TreeBuilding[];
}

export interface RackMetric {
  id: string;
  usedU: number;
  totalU: number;
  uUtilizationPct: number;
  powerUtilizationPct: number;
  currentPowerWatts: number;
  feedAWatts: number;
  feedBWatts: number;
  spofDeviceCount: number;
}

export interface SiteSupply {
  id: string;
  siteId: string;
  name: string;
  sourceType: string;
  redundancyGroup: string;
  status: string;
  capacityKw: number;
  loadKw: number;
  loadPct: number;
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

interface RawSupply {
  id: string;
  siteId: string;
  name: string;
  sourceType: string;
  redundancyGroup: string;
  status: string;
  capacityKw: number;
}

interface SupplySummary {
  id: string;
  name: string;
  sourceType: string;
  redundancyGroup: string;
  status: string;
  capacityKw: number;
  loadKw: number;
  loadPct: number;
}

interface Snapshot {
  sites: TreeSite[];
  powerCircuits: FloorCircuit[];
  powerSources?: RawSupply[];
  capacity?: { racks?: RackMetric[]; powerSources?: SupplySummary[] };
  currentUser?: { role?: "ADMIN" | "STANDARD" };
}

export interface EditDraft {
  type: AddEntity;
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  utilityCapacityKw: string;
  pueTarget: string;
  levelNumber: string;
  roomType: string;
  coolingCapacityKw: string;
  coolingRedundancy: string;
  ambientTempTargetC: string;
  orientation: string;
  aisleContainment: string;
  totalU: string;
  maxPowerWatts: string;
  maxWeightKg: string;
}

interface InfrastructureValue {
  loading: boolean;
  role: "ADMIN" | "STANDARD";
  sites: TreeSite[];
  circuits: FloorCircuit[];
  rackMetrics: Record<string, RackMetric>;
  powerSources: SiteSupply[];
  expanded: ReadonlySet<string>;
  toggle: (id: string) => void;
  expand: (id: string) => void;
  openAdd: (type: AddEntity, parentId?: string) => void;
  openEdit: (type: AddEntity, id: string, onSaved?: () => void | Promise<void>) => void;
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
  selection: {
    siteId?: string;
    buildingId?: string;
    floorId?: string;
    roomId?: string;
    rowId?: string;
    rackId?: string;
  }
) {
  for (const site of sites) {
    if (selection.siteId && site.id === selection.siteId) return [];
    for (const building of site.buildings) {
      if (selection.buildingId && building.id === selection.buildingId) return [site.id];
      for (const floor of building.floors) {
        if (selection.floorId && floor.id === selection.floorId) {
          return [site.id, building.id];
        }
        for (const room of floor.rooms) {
          for (const row of room.rows) {
            if (selection.rackId && row.racks.some((rack) => rack.id === selection.rackId)) {
              return [site.id, building.id, floor.id, room.id, row.id];
            }
            if (selection.rowId && row.id === selection.rowId) {
              return [site.id, building.id, floor.id, room.id];
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

function blankDraft(type: AddEntity, id: string, name: string): EditDraft {
  return {
    type,
    id,
    name,
    code: "",
    address: "",
    city: "",
    country: "",
    utilityCapacityKw: "",
    pueTarget: "",
    levelNumber: "1",
    roomType: "DATA_HALL",
    coolingCapacityKw: "",
    coolingRedundancy: "N_PLUS_1",
    ambientTempTargetC: "",
    orientation: "HORIZONTAL",
    aisleContainment: "COLD_AISLE",
    totalU: "42",
    maxPowerWatts: "",
    maxWeightKg: "",
  };
}

export function readEditDraft(sites: TreeSite[], type: AddEntity, id: string): EditDraft | null {
  for (const site of sites) {
    if (type === "SITE" && site.id === id) {
      return {
        ...blankDraft(type, id, site.name),
        code: site.code,
        address: site.address || "",
        city: site.city || "",
        country: site.country || "",
        utilityCapacityKw: String(site.utilityCapacityKw ?? ""),
        pueTarget: String(site.pueTarget ?? ""),
      };
    }
    for (const building of site.buildings) {
      if (type === "BUILDING" && building.id === id) {
        return { ...blankDraft(type, id, building.name), code: building.code };
      }
      for (const floor of building.floors) {
        if (type === "FLOOR" && floor.id === id) {
          return {
            ...blankDraft(type, id, floor.name),
            code: floor.code || placedCode(sites, "FLOOR", floor.id, floor.name),
            levelNumber: String(floor.levelNumber),
          };
        }
        for (const room of floor.rooms) {
          if (type === "ROOM" && room.id === id) {
            return {
              ...blankDraft(type, id, room.name),
              code: room.code,
              roomType: room.roomType,
              coolingCapacityKw: String(room.coolingCapacityKw),
              coolingRedundancy: room.coolingRedundancy,
              ambientTempTargetC: String(room.ambientTempTargetC),
            };
          }
          for (const row of room.rows) {
            if (type === "ROW" && row.id === id) {
              return {
                ...blankDraft(type, id, row.name),
                code: row.code || placedCode(sites, "ROW", row.id),
                orientation: row.orientation,
                aisleContainment: row.aisleContainment,
              };
            }
            for (const rack of row.racks) {
              if (type === "RACK" && rack.id === id) {
                return {
                  ...blankDraft(type, id, rack.name),
                  code: rack.code,
                  totalU: String(rack.totalU),
                  maxPowerWatts: String(rack.maxPowerWatts),
                  maxWeightKg: String(rack.maxWeightKg ?? ""),
                };
              }
            }
          }
        }
      }
    }
  }
  return null;
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
  const [editRequest, setEditRequest] = useState<EditDraft | null>(null);
  const editSavedRef = useRef<(() => void | Promise<void>) | null>(null);
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

  const siteId = pathname.match(/^\/sites\/([^/]+)/)?.[1] || "";
  const buildingId = pathname.match(/^\/buildings\/([^/]+)/)?.[1] || "";
  const floorId = pathname.match(/^\/floors\/([^/]+)/)?.[1] || "";
  const rowId = pathname.match(/^\/rows\/([^/]+)/)?.[1] || "";
  const rackId = pathname.match(/^\/racks\/([^/]+)/)?.[1] || "";
  const roomId = pathname.startsWith("/hierarchy") ? searchParams.get("room") || "" : "";

  useEffect(() => {
    const ids = ancestorIds(sites, { siteId, buildingId, floorId, roomId, rowId, rackId });
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
  }, [sites, siteId, buildingId, floorId, roomId, rowId, rackId]);

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

  const openEdit = useCallback((type: AddEntity, id: string, onSaved?: () => void | Promise<void>) => {
    const draft = readEditDraft(sitesRef.current, type, id);
    if (!draft) return;
    editSavedRef.current = onSaved ?? null;
    setEditRequest(draft);
  }, []);

  const rackMetrics = useMemo(() => {
    const map: Record<string, RackMetric> = {};
    for (const rack of snapshot?.capacity?.racks || []) map[rack.id] = rack;
    return map;
  }, [snapshot]);

  const powerSources = useMemo(() => {
    const loads = new Map<string, SupplySummary>();
    for (const summary of snapshot?.capacity?.powerSources || []) loads.set(summary.id, summary);
    return (snapshot?.powerSources || []).map((source) => {
      const summary = loads.get(source.id);
      return {
        id: source.id,
        siteId: source.siteId,
        name: summary?.name || source.name,
        sourceType: summary?.sourceType || source.sourceType,
        redundancyGroup: summary?.redundancyGroup || source.redundancyGroup,
        status: summary?.status || source.status,
        capacityKw: summary?.capacityKw ?? source.capacityKw,
        loadKw: summary?.loadKw ?? 0,
        loadPct: summary?.loadPct ?? 0,
      };
    });
  }, [snapshot]);

  const value = useMemo<InfrastructureValue>(
    () => ({
      loading,
      role: resolvedRole,
      sites,
      circuits: snapshot?.powerCircuits || [],
      rackMetrics,
      powerSources,
      expanded,
      toggle,
      expand,
      openAdd,
      openEdit,
      refresh,
    }),
    [
      loading,
      resolvedRole,
      sites,
      snapshot?.powerCircuits,
      rackMetrics,
      powerSources,
      expanded,
      toggle,
      expand,
      openAdd,
      openEdit,
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
      {editRequest && (
        <HierarchyEditDialog
          key={editRequest.id + editRequest.type}
          draft={editRequest}
          onClose={() => setEditRequest(null)}
          onSaved={async () => {
            await refresh();
            await editSavedRef.current?.();
          }}
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
  const { sites } = useInfrastructure();
  const [formName, setFormName] = useState("");
  const [formCode, setFormCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const suggested = useMemo(
    () => suggestedCode(sites, type, parentId, formName),
    [sites, type, parentId, formName]
  );
  const shortCode = codeTouched ? formCode : suggested;
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
      code: shortCode,
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

          <div>
            <label htmlFor="hierarchy-code" className="block text-slate-300 mb-1 font-medium">
              Short Code
            </label>
            <input
              id="hierarchy-code"
              type="text"
              required
              value={shortCode}
              onChange={(event) => {
                setCodeTouched(true);
                setFormCode(event.target.value);
              }}
              placeholder={type === "SITE" ? "npl-ted" : "npl-ted.f12"}
              className="w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white font-mono"
            />
            <p className="mt-1 text-[11px] text-slate-500">
              {type === "SITE"
                ? "Suggested from the name. You can change it."
                : "Suggested from the parent. You can change it."}
            </p>
          </div>

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

const fieldClass = "w-full px-3 py-2 rounded bg-slate-950 border border-slate-700 text-white";

function HierarchyEditDialog({
  draft,
  onClose,
  onSaved,
}: {
  draft: EditDraft;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [form, setForm] = useState(draft);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function setField(key: keyof EditDraft, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setErrorMsg(null);
    const payload: Record<string, unknown> = {
      entityType: `UPDATE_${form.type}`,
      id: form.id,
      name: form.name,
    };
    if (form.type === "SITE") {
      payload.code = form.code;
      payload.address = form.address;
      payload.city = form.city;
      payload.country = form.country;
      payload.utilityCapacityKw = Number(form.utilityCapacityKw);
      payload.pueTarget = Number(form.pueTarget);
    } else if (form.type === "BUILDING") {
      payload.code = form.code;
    } else if (form.type === "FLOOR") {
      payload.code = form.code;
      payload.levelNumber = Number(form.levelNumber);
    } else if (form.type === "ROOM") {
      payload.code = form.code;
      payload.roomType = form.roomType;
      payload.coolingCapacityKw = Number(form.coolingCapacityKw);
      payload.coolingRedundancy = form.coolingRedundancy;
      payload.ambientTempTargetC = Number(form.ambientTempTargetC);
    } else if (form.type === "ROW") {
      payload.code = form.code;
      payload.orientation = form.orientation;
      payload.aisleContainment = form.aisleContainment;
    } else if (form.type === "RACK") {
      payload.code = form.code;
      payload.totalU = Number(form.totalU);
      payload.maxPowerWatts = Number(form.maxPowerWatts);
      payload.maxWeightKg = Number(form.maxWeightKg);
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
        setErrorMsg(data.error || "Failed to save changes");
        return;
      }
      await onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-xl bg-slate-900 border border-slate-700 p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">Edit {form.type}</h3>
          <button type="button" onClick={onClose} className="text-xs text-slate-400 hover:text-white">
            Close
          </button>
        </div>
        {errorMsg && (
          <div className="p-3 rounded bg-rose-500/15 border border-rose-500/30 text-xs text-rose-200">
            {errorMsg}
          </div>
        )}
        <form onSubmit={handleSave} className="space-y-3 text-xs">
          <Field label="Name" value={form.name} onChange={(value) => setField("name", value)} />
          <Field label="Short Code" value={form.code} onChange={(value) => setField("code", value)} mono />
          {form.type === "SITE" && (
            <>
              <Field label="Address" value={form.address} onChange={(value) => setField("address", value)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="City" value={form.city} onChange={(value) => setField("city", value)} />
                <Field label="Country" value={form.country} onChange={(value) => setField("country", value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Utility capacity (kW)"
                  value={form.utilityCapacityKw}
                  onChange={(value) => setField("utilityCapacityKw", value)}
                  number
                />
                <Field
                  label="PUE target"
                  value={form.pueTarget}
                  onChange={(value) => setField("pueTarget", value)}
                  number
                  step="0.01"
                />
              </div>
            </>
          )}
          {form.type === "FLOOR" && (
            <Field
              label="Level number"
              value={form.levelNumber}
              onChange={(value) => setField("levelNumber", value)}
              number
            />
          )}
          {form.type === "ROOM" && (
            <>
              <SelectField
                label="Room type"
                value={form.roomType}
                onChange={(value) => setField("roomType", value)}
                options={[
                  ["DATA_HALL", "Data hall"],
                  ["POWER_ROOM", "Power room"],
                  ["COOLING_PLANT", "Cooling plant"],
                  ["MEET_ME", "Meet-me"],
                ]}
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Cooling capacity (kW)"
                  value={form.coolingCapacityKw}
                  onChange={(value) => setField("coolingCapacityKw", value)}
                  number
                />
                <Field
                  label="Target temp (°C)"
                  value={form.ambientTempTargetC}
                  onChange={(value) => setField("ambientTempTargetC", value)}
                  number
                  step="0.5"
                />
              </div>
              <SelectField
                label="Redundancy"
                value={form.coolingRedundancy}
                onChange={(value) => setField("coolingRedundancy", value)}
                options={[
                  ["N", "N"],
                  ["N_PLUS_1", "N+1"],
                  ["TWO_N", "2N"],
                ]}
              />
            </>
          )}
          {form.type === "ROW" && (
            <>
              <SelectField
                label="Orientation"
                value={form.orientation}
                onChange={(value) => setField("orientation", value)}
                options={[
                  ["HORIZONTAL", "Horizontal"],
                  ["VERTICAL", "Vertical"],
                ]}
              />
              <SelectField
                label="Aisle containment"
                value={form.aisleContainment}
                onChange={(value) => setField("aisleContainment", value)}
                options={[
                  ["NONE", "None"],
                  ["COLD_AISLE", "Cold aisle"],
                  ["HOT_AISLE", "Hot aisle"],
                ]}
              />
            </>
          )}
          {form.type === "RACK" && (
            <>
              <Field
                label="Height (total U)"
                value={form.totalU}
                onChange={(value) => setField("totalU", value)}
                number
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Max power (watts)"
                  value={form.maxPowerWatts}
                  onChange={(value) => setField("maxPowerWatts", value)}
                  number
                />
                <Field
                  label="Max weight (kg)"
                  value={form.maxWeightKg}
                  onChange={(value) => setField("maxWeightKg", value)}
                  number
                />
              </div>
            </>
          )}
          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-3 py-2 rounded bg-slate-800 text-slate-300">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded bg-cyan-500 text-slate-950 font-semibold disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  number,
  step,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  number?: boolean;
  step?: string;
  mono?: boolean;
}) {
  return (
    <label className="block text-slate-300 font-medium">
      {label}
      <input
        required={label === "Name" || label === "Short Code"}
        type={number ? "number" : "text"}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} mt-1 ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
}) {
  return (
    <label className="block text-slate-300 font-medium">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} mt-1`}
      >
        {options.map((option) => (
          <option key={option[0]} value={option[0]}>
            {option[1]}
          </option>
        ))}
      </select>
    </label>
  );
}

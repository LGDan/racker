"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, ThermometerSnowflake, Zap } from "lucide-react";
import { useInfrastructure } from "@/components/layout/infrastructure-context";
import {
  AlertBanner,
  Field,
  Modal,
  ModalFooter,
  PageHeader,
  SectionCard,
  SortHeader,
  btnPrimary,
  btnSecondary,
  compactInputClass,
  inputClass,
  tableClasses,
  useTableSort,
} from "@/components/ui/primitives";

interface PowerSourceRow {
  id: string;
  siteId: string;
  name: string;
  sourceType: string;
  redundancyGroup: string;
  status: string;
  capacityKw: number;
  voltageV: number;
  maxAmps: number;
  batteryRuntimeMins: number | null;
  fuelRuntimeHours: number | null;
  upstreamSourceAId: string | null;
  upstreamSourceBId: string | null;
}

interface PowerPanelRow {
  id: string;
  roomId: string;
  upstreamSourceId: string;
  name: string;
  feedSide: string;
  maxAmpsPerPhase: number;
  voltageLToN: number;
  voltageLToL: number;
  totalBreakerSlots: number;
  status: string;
  upstreamSource: { name: string };
  room: { name: string };
  circuits: { id: string }[];
}

interface PowerCircuitRow {
  id: string;
  panelId: string;
  roomId: string;
  rackId: string | null;
  name: string;
  floorSocketLabel: string;
  breakerNumber: number;
  phaseAllocation: string;
  ratedAmps: number;
  voltageV: number;
  socketType: string;
  status: string;
  elevation: string;
  panel: { name: string };
  room: { name: string };
  rack: { code: string } | null;
}

interface Snapshot {
  currentUser: { role: "ADMIN" | "STANDARD" };
  sites: { id: string; name: string; code: string }[];
  rooms: { id: string; name: string; code: string }[];
  racks: { id: string; code: string; name: string }[];
  powerSources: PowerSourceRow[];
  powerPanels: PowerPanelRow[];
  powerCircuits: PowerCircuitRow[];
  capacity: {
    totals: {
      totalItKw: number;
    };
    powerSources: {
      id: string;
      loadKw: number;
      loadPct: number;
      loadAmps: number;
    }[];
    panels: {
      id: string;
      phaseLoad: {
        ampsL1: number;
        ampsL2: number;
        ampsL3: number;
        wattsL1: number;
        wattsL2: number;
        wattsL3: number;
        imbalancePct: number;
      };
      maxPhaseLoadPct: number;
    }[];
  };
}

interface SupplyDraft {
  siteId: string;
  name: string;
  sourceType: string;
  redundancyGroup: string;
  status: string;
  capacityKw: string;
  voltageV: string;
  maxAmps: string;
  batteryRuntimeMins: string;
  fuelRuntimeHours: string;
  upstreamSourceAId: string;
  upstreamSourceBId: string;
}

interface PanelDraft {
  name: string;
  roomId: string;
  upstreamSourceId: string;
  feedSide: string;
  maxAmpsPerPhase: string;
  voltageLToN: string;
  voltageLToL: string;
  totalBreakerSlots: string;
  status: string;
}

interface SocketDraft {
  name: string;
  floorSocketLabel: string;
  panelId: string;
  roomId: string;
  rackId: string;
  breakerNumber: string;
  phaseAllocation: string;
  ratedAmps: string;
  voltageV: string;
  socketType: string;
  elevation: string;
  status: string;
}

type ModalKind = "supply" | "panel" | "socket" | null;

const SOURCE_TYPES = ["UTILITY", "GENERATOR", "ATS", "UPS", "TRANSFORMER"] as const;
const SOURCE_STATUSES = ["ONLINE", "STANDBY", "BYPASS", "OFFLINE"] as const;
const SOCKET_TYPES = [
  "IEC_60309_32A_1P",
  "IEC_60309_32A_3P",
  "IEC_60309_63A_3P",
  "NEMA_L6_30R",
] as const;

export default function PowerCoolingPage() {
  const searchParams = useSearchParams();
  const { refresh: refreshTree } = useInfrastructure();
  const selectedPanelId = searchParams.get("panel") || "";
  const selectedPhase = searchParams.get("phase") || "";
  const selectedSocketId = searchParams.get("socket") || "";
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [modal, setModal] = useState<ModalKind>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [supplyDraft, setSupplyDraft] = useState<SupplyDraft>({
    siteId: "",
    name: "",
    sourceType: "UTILITY",
    redundancyGroup: "A",
    status: "ONLINE",
    capacityKw: "500",
    voltageV: "400",
    maxAmps: "720",
    batteryRuntimeMins: "",
    fuelRuntimeHours: "",
    upstreamSourceAId: "",
    upstreamSourceBId: "",
  });
  const [panelDraft, setPanelDraft] = useState<PanelDraft>({
    name: "",
    roomId: "",
    upstreamSourceId: "",
    feedSide: "A",
    maxAmpsPerPhase: "125",
    voltageLToN: "230",
    voltageLToL: "400",
    totalBreakerSlots: "24",
    status: "ONLINE",
  });
  const [socketDraft, setSocketDraft] = useState<SocketDraft>({
    name: "",
    floorSocketLabel: "",
    panelId: "",
    roomId: "",
    rackId: "",
    breakerNumber: "1",
    phaseAllocation: "L1",
    ratedAmps: "32",
    voltageV: "230",
    socketType: "IEC_60309_32A_1P",
    elevation: "UNDERFLOOR",
    status: "ONLINE",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const siteMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of snap?.sites || []) map.set(s.id, s.code);
    return map;
  }, [snap?.sites]);

  const sourceMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of snap?.powerSources || []) map.set(s.id, s.name);
    return map;
  }, [snap?.powerSources]);

  const sourceLoadMap = useMemo(() => {
    const map = new Map<string, { loadKw: number; loadPct: number; loadAmps: number }>();
    for (const s of snap?.capacity?.powerSources || []) map.set(s.id, s);
    return map;
  }, [snap?.capacity?.powerSources]);

  const panelPhaseMap = useMemo(() => {
    const map = new Map<string, Snapshot["capacity"]["panels"][number]>();
    for (const p of snap?.capacity?.panels || []) map.set(p.id, p);
    return map;
  }, [snap?.capacity?.panels]);

  const suppliesSort = useTableSort(
    snap?.powerSources ?? [],
    {
      name: (s) => s.name,
      site: (s) => siteMap.get(s.siteId) || "",
      sourceType: (s) => s.sourceType,
      bus: (s) => s.redundancyGroup,
      capacityKw: (s) => s.capacityKw,
      load: (s) => sourceLoadMap.get(s.id)?.loadKw ?? 0,
      upstream: (s) => sourceMap.get(s.upstreamSourceAId || "") || "",
      status: (s) => s.status,
    },
    "name"
  );

  const filteredPanels = useMemo(() => {
    const all = snap?.powerPanels ?? [];
    if (selectedSocketId) {
      const sock = (snap?.powerCircuits ?? []).find((c) => c.id === selectedSocketId);
      if (sock) return all.filter((p) => p.id === sock.panelId);
    }
    if (selectedPanelId) return all.filter((p) => p.id === selectedPanelId);
    return all;
  }, [snap?.powerPanels, snap?.powerCircuits, selectedPanelId, selectedSocketId]);

  const filteredCircuits = useMemo(() => {
    let list = snap?.powerCircuits ?? [];
    if (selectedSocketId) {
      return list.filter((c) => c.id === selectedSocketId);
    }
    if (selectedPanelId) {
      list = list.filter((c) => c.panelId === selectedPanelId);
    }
    if (selectedPhase) {
      list = list.filter((c) => c.phaseAllocation === selectedPhase);
    }
    return list;
  }, [snap?.powerCircuits, selectedPanelId, selectedPhase, selectedSocketId]);

  const panelsSort = useTableSort(
    filteredPanels,
    {
      name: (p) => p.name,
      room: (p) => p.room.name,
      upstream: (p) => p.upstreamSource.name,
      rating: (p) => p.maxAmpsPerPhase,
      phases: (p) => panelPhaseMap.get(p.id)?.maxPhaseLoadPct ?? 0,
      imbalance: (p) => panelPhaseMap.get(p.id)?.phaseLoad.imbalancePct ?? 0,
      breakers: (p) => p.circuits.length,
    },
    "name"
  );

  const socketsSort = useTableSort(
    filteredCircuits,
    {
      socket: (c) => c.floorSocketLabel,
      name: (c) => c.name,
      panel: (c) => c.panel.name,
      room: (c) => c.room?.name || "",
      connector: (c) => c.ratedAmps,
      rack: (c) => c.rack?.code ?? "",
      phase: (c) => c.phaseAllocation,
    },
    "socket"
  );

  async function load() {
    const res = await fetch("/api/infrastructure");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    setSnap(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function mutate(body: Record<string, unknown>, successMsg = "Saved.") {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/power-cooling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Update failed");
        return false;
      }
      setNotice(successMsg);
      await Promise.all([load(), refreshTree()]);
      return true;
    } finally {
      setSaving(false);
    }
  }

  function openNewSupply() {
    setEditingId(null);
    setSupplyDraft({
      siteId: snap?.sites[0]?.id || "",
      name: "",
      sourceType: "UTILITY",
      redundancyGroup: "A",
      status: "ONLINE",
      capacityKw: "500",
      voltageV: "400",
      maxAmps: "720",
      batteryRuntimeMins: "",
      fuelRuntimeHours: "",
      upstreamSourceAId: "",
      upstreamSourceBId: "",
    });
    setError(null);
    setModal("supply");
  }

  function openEditSupply(s: PowerSourceRow) {
    setEditingId(s.id);
    setSupplyDraft({
      siteId: s.siteId,
      name: s.name,
      sourceType: s.sourceType,
      redundancyGroup: s.redundancyGroup,
      status: s.status,
      capacityKw: String(s.capacityKw),
      voltageV: String(s.voltageV),
      maxAmps: String(s.maxAmps),
      batteryRuntimeMins: s.batteryRuntimeMins != null ? String(s.batteryRuntimeMins) : "",
      fuelRuntimeHours: s.fuelRuntimeHours != null ? String(s.fuelRuntimeHours) : "",
      upstreamSourceAId: s.upstreamSourceAId || "",
      upstreamSourceBId: s.upstreamSourceBId || "",
    });
    setError(null);
    setModal("supply");
  }

  function openNewPanel() {
    setEditingId(null);
    setPanelDraft({
      name: "",
      roomId: snap?.rooms[0]?.id || "",
      upstreamSourceId: snap?.powerSources[0]?.id || "",
      feedSide: "A",
      maxAmpsPerPhase: "125",
      voltageLToN: "230",
      voltageLToL: "400",
      totalBreakerSlots: "24",
      status: "ONLINE",
    });
    setError(null);
    setModal("panel");
  }

  function openEditPanel(p: PowerPanelRow) {
    setEditingId(p.id);
    setPanelDraft({
      name: p.name,
      roomId: p.roomId,
      upstreamSourceId: p.upstreamSourceId,
      feedSide: p.feedSide,
      maxAmpsPerPhase: String(p.maxAmpsPerPhase),
      voltageLToN: String(p.voltageLToN),
      voltageLToL: String(p.voltageLToL),
      totalBreakerSlots: String(p.totalBreakerSlots || 24),
      status: p.status || "ONLINE",
    });
    setError(null);
    setModal("panel");
  }

  function openNewSocket() {
    setEditingId(null);
    const defaultPanel = snap?.powerPanels[0];
    setSocketDraft({
      name: "",
      floorSocketLabel: "",
      panelId: defaultPanel?.id || "",
      roomId: defaultPanel?.roomId || snap?.rooms[0]?.id || "",
      rackId: "",
      breakerNumber: String((snap?.powerCircuits.length || 0) + 1),
      phaseAllocation: "L1",
      ratedAmps: "32",
      voltageV: String(defaultPanel?.voltageLToN || 230),
      socketType: "IEC_60309_32A_1P",
      elevation: "UNDERFLOOR",
      status: "ONLINE",
    });
    setError(null);
    setModal("socket");
  }

  function openEditSocket(c: PowerCircuitRow) {
    setEditingId(c.id);
    setSocketDraft({
      name: c.name,
      floorSocketLabel: c.floorSocketLabel,
      panelId: c.panelId,
      roomId: c.roomId,
      rackId: c.rackId || "",
      breakerNumber: String(c.breakerNumber || 1),
      phaseAllocation: c.phaseAllocation,
      ratedAmps: String(c.ratedAmps),
      voltageV: String(c.voltageV),
      socketType: c.socketType,
      elevation: c.elevation || "UNDERFLOOR",
      status: c.status || "ONLINE",
    });
    setError(null);
    setModal("socket");
  }

  function closeModal() {
    setModal(null);
    setEditingId(null);
  }

  async function removeItem(
    targetType: "POWER_SOURCE" | "POWER_PANEL" | "POWER_CIRCUIT",
    id: string,
    label: string
  ) {
    if (!window.confirm(`Remove ${label}?`)) return;
    await mutate({ action: "DELETE_ITEM", targetType, id }, `Removed ${label}.`);
  }

  if (!snap) return <div className="p-8 text-sm text-slate-400">Loading electrical power chain…</div>;
  const admin = snap.currentUser.role === "ADMIN";

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        kicker="Facility Electrical Distribution"
        icon={<Zap className="h-3.5 w-3.5" />}
        title="Electrical power chain"
        subtitle={
          <>
            Upstream utility feeds, generators, transfer switches, and UPS systems flowing into three-phase distribution panels and floor whips.
            {admin ? " Admins can add and edit every stage of the power chain." : " Rack-level cords are edited in the rack studio."}
          </>
        }
        actions={
          <>
            <Link href="/cooling" className={btnSecondary}>
              <ThermometerSnowflake className="h-3.5 w-3.5 text-sky-400" />
              Cooling plant
            </Link>
            {admin && (
              <button type="button" onClick={openNewSupply} className={btnPrimary}>
                <Plus className="h-3.5 w-3.5" />
                Add supply
              </button>
            )}
          </>
        }
      />

      {!modal && <AlertBanner error={error} notice={notice} />}

      {(selectedPanelId || selectedPhase || selectedSocketId) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-xs text-cyan-200">
          <span>
            Showing tree selection:{" "}
            <strong className="text-white">
              {selectedSocketId
                ? snap.powerCircuits.find((c) => c.id === selectedSocketId)?.floorSocketLabel ||
                  "Socket"
                : [
                    snap.powerPanels.find((p) => p.id === selectedPanelId)?.name,
                    selectedPhase ? `Phase ${selectedPhase}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </strong>
          </span>
          <Link href="/power-cooling" className="font-semibold text-cyan-300 hover:underline">
            Show all panels & sockets
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Upstream supplies
          </div>
          <div className="mt-1 text-lg font-bold text-white">{snap.powerSources.length}</div>
          <div className="text-[11px] text-slate-400">
            {snap.powerSources.filter((s) => s.status === "ONLINE").length} online
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            3-Phase panels
          </div>
          <div className="mt-1 text-lg font-bold text-white">{snap.powerPanels.length}</div>
          <div className="text-[11px] text-slate-400">L1 / L2 / L3 monitored</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Floor sockets / whips
          </div>
          <div className="mt-1 text-lg font-bold text-white">{snap.powerCircuits.length}</div>
          <div className="text-[11px] text-slate-400">Underfloor & overhead</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Active IT power
          </div>
          <div className="mt-1 text-lg font-bold text-amber-300">
            {snap.capacity.totals.totalItKw} kW
          </div>
          <div className="text-[11px] text-slate-400">Dual-bus A/B load</div>
        </div>
      </div>

      <SectionCard
        title="Upstream power supplies"
        subtitle="Utility feeds, standby generators, transfer switches, transformers, and UPS systems"
        actions={
          admin ? (
            <button type="button" onClick={openNewSupply} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" />
              Add supply
            </button>
          ) : undefined
        }
      >
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead className={tableClasses.thead}>
              <tr>
                <SortHeader label="Supply" column="name" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                <SortHeader label="Site" column="site" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                <SortHeader label="Type" column="sourceType" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                <SortHeader label="Bus" column="bus" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                <SortHeader label="Rating" column="capacityKw" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                <SortHeader label="Downstream load" column="load" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                <SortHeader label="Upstream feed" column="upstream" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                <SortHeader label="Status" column="status" sortKey={suppliesSort.sortKey} sortDir={suppliesSort.sortDir} onSort={suppliesSort.toggleSort} />
                {admin && <th className={tableClasses.thRight}> </th>}
              </tr>
            </thead>
            <tbody className={tableClasses.tbody}>
              {suppliesSort.sorted.map((s) => {
                const load = sourceLoadMap.get(s.id);
                const upA = s.upstreamSourceAId ? sourceMap.get(s.upstreamSourceAId) : null;
                const upB = s.upstreamSourceBId ? sourceMap.get(s.upstreamSourceBId) : null;
                const upLabel = [upA, upB].filter(Boolean).join(" + ") || "Grid / primary";
                return (
                  <tr key={s.id} className={tableClasses.tr}>
                    <td className={tableClasses.td}>
                      <h3 className="font-semibold text-white">{s.name}</h3>
                      {(s.batteryRuntimeMins || s.fuelRuntimeHours) && (
                        <div className="text-[11px] text-slate-500">
                          {s.batteryRuntimeMins ? `${s.batteryRuntimeMins} min battery` : ""}
                          {s.batteryRuntimeMins && s.fuelRuntimeHours ? " · " : ""}
                          {s.fuelRuntimeHours ? `${s.fuelRuntimeHours} h fuel` : ""}
                        </div>
                      )}
                    </td>
                    <td className={tableClasses.td}>{siteMap.get(s.siteId) || "—"}</td>
                    <td className={tableClasses.td}>
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
                        {s.sourceType}
                      </span>
                    </td>
                    <td className={tableClasses.td}>Bus {s.redundancyGroup}</td>
                    <td className={`${tableClasses.td} font-mono`}>
                      {s.capacityKw} kW · {s.voltageV}V · {s.maxAmps}A
                    </td>
                    <td className={`${tableClasses.td} font-mono`}>
                      {load ? `${load.loadKw} kW (${load.loadPct}%)` : "0 kW"}
                    </td>
                    <td className={tableClasses.td}>{upLabel}</td>
                    <td className={tableClasses.td}>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          s.status === "ONLINE"
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        {s.status}
                      </span>
                    </td>
                    {admin && (
                      <td className={tableClasses.tdRight}>
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEditSupply(s)}
                            className="text-cyan-400 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeItem("POWER_SOURCE", s.id, s.name)}
                            className="text-rose-300 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Panels and phases"
        subtitle="Three-phase distribution panels, L1/L2/L3 phase currents, and breaker capacity"
        actions={
          admin ? (
            <button type="button" onClick={openNewPanel} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" />
              Add panel
            </button>
          ) : undefined
        }
      >
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead className={tableClasses.thead}>
              <tr>
                <SortHeader label="Panel" column="name" sortKey={panelsSort.sortKey} sortDir={panelsSort.sortDir} onSort={panelsSort.toggleSort} />
                <SortHeader label="Room" column="room" sortKey={panelsSort.sortKey} sortDir={panelsSort.sortDir} onSort={panelsSort.toggleSort} />
                <SortHeader label="Upstream" column="upstream" sortKey={panelsSort.sortKey} sortDir={panelsSort.sortDir} onSort={panelsSort.toggleSort} />
                <SortHeader label="Rating" column="rating" sortKey={panelsSort.sortKey} sortDir={panelsSort.sortDir} onSort={panelsSort.toggleSort} />
                <SortHeader label="Phase load (L1 / L2 / L3)" column="phases" sortKey={panelsSort.sortKey} sortDir={panelsSort.sortDir} onSort={panelsSort.toggleSort} />
                <SortHeader label="Imbalance" column="imbalance" sortKey={panelsSort.sortKey} sortDir={panelsSort.sortDir} onSort={panelsSort.toggleSort} />
                <SortHeader label="Breakers" column="breakers" sortKey={panelsSort.sortKey} sortDir={panelsSort.sortDir} onSort={panelsSort.toggleSort} />
                {admin && <th className={tableClasses.thRight}> </th>}
              </tr>
            </thead>
            <tbody className={tableClasses.tbody}>
              {panelsSort.sorted.map((p) => {
                const phase = panelPhaseMap.get(p.id);
                return (
                  <tr key={p.id} className={tableClasses.tr}>
                    <td className={`${tableClasses.td} font-semibold text-white`}>
                      {p.name}
                      <span
                        className={`ml-2 rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          p.feedSide === "A"
                            ? "bg-blue-500/15 text-blue-300"
                            : "bg-amber-500/15 text-amber-300"
                        }`}
                      >
                        Feed {p.feedSide}
                      </span>
                    </td>
                    <td className={tableClasses.td}>{p.room.name}</td>
                    <td className={tableClasses.td}>{p.upstreamSource.name}</td>
                    <td className={`${tableClasses.td} font-mono`}>
                      {p.voltageLToN}/{p.voltageLToL}V · {p.maxAmpsPerPhase}A/phase
                    </td>
                    <td className={`${tableClasses.td} font-mono`}>
                      {phase
                        ? `${phase.phaseLoad.ampsL1}A / ${phase.phaseLoad.ampsL2}A / ${phase.phaseLoad.ampsL3}A`
                        : "0A / 0A / 0A"}
                    </td>
                    <td className={`${tableClasses.td} font-mono`}>
                      <span
                        className={
                          (phase?.phaseLoad.imbalancePct ?? 0) > 15
                            ? "text-amber-300"
                            : "text-emerald-300"
                        }
                      >
                        {phase?.phaseLoad.imbalancePct ?? 0}%
                      </span>
                    </td>
                    <td className={`${tableClasses.td} font-mono`}>
                      {p.circuits.length}/{p.totalBreakerSlots || 24}
                    </td>
                    {admin && (
                      <td className={tableClasses.tdRight}>
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => openEditPanel(p)}
                            className="text-cyan-400 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeItem("POWER_PANEL", p.id, p.name)}
                            className="text-rose-300 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        title="Floor sockets and breakers"
        subtitle="Underfloor and overhead power whips from distribution panels to rack PDUs"
        actions={
          admin ? (
            <button type="button" onClick={openNewSocket} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" />
              Add socket
            </button>
          ) : undefined
        }
      >
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead className={tableClasses.thead}>
              <tr>
                <SortHeader label="Socket" column="socket" sortKey={socketsSort.sortKey} sortDir={socketsSort.sortDir} onSort={socketsSort.toggleSort} />
                <SortHeader label="Whip name" column="name" sortKey={socketsSort.sortKey} sortDir={socketsSort.sortDir} onSort={socketsSort.toggleSort} />
                <SortHeader label="Panel" column="panel" sortKey={socketsSort.sortKey} sortDir={socketsSort.sortDir} onSort={socketsSort.toggleSort} />
                <SortHeader label="Room" column="room" sortKey={socketsSort.sortKey} sortDir={socketsSort.sortDir} onSort={socketsSort.toggleSort} />
                <SortHeader label="Connector" column="connector" sortKey={socketsSort.sortKey} sortDir={socketsSort.sortDir} onSort={socketsSort.toggleSort} />
                <SortHeader label="Rack" column="rack" sortKey={socketsSort.sortKey} sortDir={socketsSort.sortDir} onSort={socketsSort.toggleSort} />
                <SortHeader label="Phase" column="phase" sortKey={socketsSort.sortKey} sortDir={socketsSort.sortDir} onSort={socketsSort.toggleSort} />
                {admin && <th className={tableClasses.thRight}> </th>}
              </tr>
            </thead>
            <tbody className={tableClasses.tbody}>
              {socketsSort.sorted.map((c) => (
                <tr key={c.id} className={tableClasses.tr}>
                  <td className={`${tableClasses.td} font-semibold text-white`}>
                    {c.floorSocketLabel}
                  </td>
                  <td className={tableClasses.td}>{c.name}</td>
                  <td className={tableClasses.td}>{c.panel.name}</td>
                  <td className={tableClasses.td}>{c.room?.name || "—"}</td>
                  <td className={`${tableClasses.td} font-mono`}>
                    {c.ratedAmps}A · {c.voltageV}V · {c.socketType}
                  </td>
                  <td className={tableClasses.td}>{c.rack ? c.rack.code : "Any"}</td>
                  <td className={tableClasses.td}>
                    {admin ? (
                      <select
                        aria-label={`Phase for ${c.floorSocketLabel}`}
                        value={c.phaseAllocation}
                        className={compactInputClass}
                        onChange={(e) =>
                          void mutate(
                            {
                              action: "UPDATE_CIRCUIT_PHASE",
                              circuitId: c.id,
                              phaseAllocation: e.target.value,
                            },
                            `Updated phase for ${c.floorSocketLabel}.`
                          )
                        }
                      >
                        {["L1", "L2", "L3", "THREE_PHASE"].map((p) => (
                          <option key={p}>{p}</option>
                        ))}
                      </select>
                    ) : (
                      c.phaseAllocation
                    )}
                  </td>
                  {admin && (
                    <td className={tableClasses.tdRight}>
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => openEditSocket(c)}
                          className="text-cyan-400 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            void removeItem("POWER_CIRCUIT", c.id, c.floorSocketLabel)
                          }
                          className="text-rose-300 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {admin && modal === "supply" && (
        <Modal
          title={editingId ? "Edit power supply" : "Add a supply"}
          onClose={closeModal}
          wide
        >
          <AlertBanner error={error} />
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await mutate(
                {
                  action: editingId ? "UPDATE_POWER_SOURCE" : "CREATE_POWER_SOURCE",
                  id: editingId,
                  siteId: supplyDraft.siteId,
                  name: supplyDraft.name,
                  sourceType: supplyDraft.sourceType,
                  redundancyGroup: supplyDraft.redundancyGroup,
                  status: supplyDraft.status,
                  capacityKw: supplyDraft.capacityKw,
                  voltageV: supplyDraft.voltageV,
                  maxAmps: supplyDraft.maxAmps,
                  batteryRuntimeMins: supplyDraft.batteryRuntimeMins || null,
                  fuelRuntimeHours: supplyDraft.fuelRuntimeHours || null,
                  upstreamSourceAId: supplyDraft.upstreamSourceAId || null,
                  upstreamSourceBId: supplyDraft.upstreamSourceBId || null,
                },
                editingId ? `Updated ${supplyDraft.name}.` : `Added ${supplyDraft.name}.`
              );
              if (ok) closeModal();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Site">
                <select
                  name="siteId"
                  required
                  value={supplyDraft.siteId}
                  onChange={(e) => setSupplyDraft({ ...supplyDraft, siteId: e.target.value })}
                  className={inputClass}
                >
                  {snap.sites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Name" className="sm:col-span-2">
                <input
                  name="name"
                  required
                  placeholder="Name"
                  value={supplyDraft.name}
                  onChange={(e) => setSupplyDraft({ ...supplyDraft, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Type">
                <select
                  name="sourceType"
                  value={supplyDraft.sourceType}
                  onChange={(e) => setSupplyDraft({ ...supplyDraft, sourceType: e.target.value })}
                  className={inputClass}
                >
                  {SOURCE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Bus">
                <select
                  name="redundancyGroup"
                  value={supplyDraft.redundancyGroup}
                  onChange={(e) =>
                    setSupplyDraft({ ...supplyDraft, redundancyGroup: e.target.value })
                  }
                  className={inputClass}
                >
                  <option>A</option>
                  <option>B</option>
                  <option>SHARED</option>
                </select>
              </Field>
              <Field label="Status">
                <select
                  name="status"
                  value={supplyDraft.status}
                  onChange={(e) => setSupplyDraft({ ...supplyDraft, status: e.target.value })}
                  className={inputClass}
                >
                  {SOURCE_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Capacity (kW)">
                <input
                  name="capacityKw"
                  type="number"
                  placeholder="kW"
                  value={supplyDraft.capacityKw}
                  onChange={(e) => setSupplyDraft({ ...supplyDraft, capacityKw: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Voltage (V)">
                <input
                  name="voltageV"
                  type="number"
                  value={supplyDraft.voltageV}
                  onChange={(e) => setSupplyDraft({ ...supplyDraft, voltageV: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Max current (Amps)">
                <input
                  name="maxAmps"
                  type="number"
                  placeholder="Amps"
                  value={supplyDraft.maxAmps}
                  onChange={(e) => setSupplyDraft({ ...supplyDraft, maxAmps: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Battery runtime (mins)">
                <input
                  name="batteryRuntimeMins"
                  type="number"
                  placeholder="Optional"
                  value={supplyDraft.batteryRuntimeMins}
                  onChange={(e) =>
                    setSupplyDraft({ ...supplyDraft, batteryRuntimeMins: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Fuel runtime (hours)">
                <input
                  name="fuelRuntimeHours"
                  type="number"
                  step="0.5"
                  placeholder="Optional"
                  value={supplyDraft.fuelRuntimeHours}
                  onChange={(e) =>
                    setSupplyDraft({ ...supplyDraft, fuelRuntimeHours: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Upstream supply">
                <select
                  name="upstream"
                  value={supplyDraft.upstreamSourceAId}
                  onChange={(e) =>
                    setSupplyDraft({ ...supplyDraft, upstreamSourceAId: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">No upstream</option>
                  {snap.powerSources
                    .filter((s) => s.id !== editingId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        Fed from {s.name}
                      </option>
                    ))}
                </select>
              </Field>
              <Field label="Secondary upstream (ATS / dual-input)">
                <select
                  name="upstreamB"
                  value={supplyDraft.upstreamSourceBId}
                  onChange={(e) =>
                    setSupplyDraft({ ...supplyDraft, upstreamSourceBId: e.target.value })
                  }
                  className={inputClass}
                >
                  <option value="">None</option>
                  {snap.powerSources
                    .filter((s) => s.id !== editingId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        Alternate from {s.name}
                      </option>
                    ))}
                </select>
              </Field>
            </div>
            <ModalFooter
              onCancel={closeModal}
              submitLabel={editingId ? "Save supply" : "Add supply"}
              saving={saving}
            />
          </form>
        </Modal>
      )}

      {admin && modal === "panel" && (
        <Modal
          title={editingId ? "Edit distribution panel" : "Add distribution panel"}
          onClose={closeModal}
          wide
        >
          <AlertBanner error={error} />
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await mutate(
                {
                  action: editingId ? "UPDATE_POWER_PANEL" : "CREATE_POWER_PANEL",
                  id: editingId,
                  name: panelDraft.name,
                  roomId: panelDraft.roomId,
                  upstreamSourceId: panelDraft.upstreamSourceId,
                  feedSide: panelDraft.feedSide,
                  maxAmpsPerPhase: panelDraft.maxAmpsPerPhase,
                  voltageLToN: panelDraft.voltageLToN,
                  voltageLToL: panelDraft.voltageLToL,
                  totalBreakerSlots: panelDraft.totalBreakerSlots,
                  status: panelDraft.status,
                },
                editingId ? `Updated ${panelDraft.name}.` : `Added ${panelDraft.name}.`
              );
              if (ok) closeModal();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Panel name">
                <input
                  name="name"
                  required
                  placeholder="Panel name"
                  value={panelDraft.name}
                  onChange={(e) => setPanelDraft({ ...panelDraft, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Room">
                <select
                  name="roomId"
                  value={panelDraft.roomId}
                  onChange={(e) => setPanelDraft({ ...panelDraft, roomId: e.target.value })}
                  className={inputClass}
                >
                  {snap.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Upstream supply">
                <select
                  name="upstreamSourceId"
                  value={panelDraft.upstreamSourceId}
                  onChange={(e) =>
                    setPanelDraft({ ...panelDraft, upstreamSourceId: e.target.value })
                  }
                  className={inputClass}
                >
                  {snap.powerSources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Feed side">
                <select
                  name="feedSide"
                  value={panelDraft.feedSide}
                  onChange={(e) => setPanelDraft({ ...panelDraft, feedSide: e.target.value })}
                  className={inputClass}
                >
                  <option>A</option>
                  <option>B</option>
                </select>
              </Field>
              <Field label="Max amps per phase">
                <input
                  name="maxAmpsPerPhase"
                  type="number"
                  value={panelDraft.maxAmpsPerPhase}
                  onChange={(e) =>
                    setPanelDraft({ ...panelDraft, maxAmpsPerPhase: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Breaker slots">
                <input
                  name="totalBreakerSlots"
                  type="number"
                  value={panelDraft.totalBreakerSlots}
                  onChange={(e) =>
                    setPanelDraft({ ...panelDraft, totalBreakerSlots: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Voltage L-N (V)">
                <input
                  name="voltageLToN"
                  type="number"
                  value={panelDraft.voltageLToN}
                  onChange={(e) => setPanelDraft({ ...panelDraft, voltageLToN: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Voltage L-L (V)">
                <input
                  name="voltageLToL"
                  type="number"
                  value={panelDraft.voltageLToL}
                  onChange={(e) => setPanelDraft({ ...panelDraft, voltageLToL: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Status">
                <select
                  name="status"
                  value={panelDraft.status}
                  onChange={(e) => setPanelDraft({ ...panelDraft, status: e.target.value })}
                  className={inputClass}
                >
                  <option>ONLINE</option>
                  <option>OFFLINE</option>
                </select>
              </Field>
            </div>
            <ModalFooter
              onCancel={closeModal}
              submitLabel={editingId ? "Save panel" : "Add panel"}
              saving={saving}
            />
          </form>
        </Modal>
      )}

      {admin && modal === "socket" && (
        <Modal
          title={editingId ? "Edit floor socket / whip" : "Add floor socket / whip"}
          onClose={closeModal}
          wide
        >
          <AlertBanner error={error} />
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await mutate(
                {
                  action: editingId ? "UPDATE_POWER_CIRCUIT" : "CREATE_POWER_CIRCUIT",
                  id: editingId,
                  panelId: socketDraft.panelId,
                  roomId: socketDraft.roomId,
                  rackId: socketDraft.rackId || null,
                  name: socketDraft.name,
                  floorSocketLabel: socketDraft.floorSocketLabel,
                  breakerNumber: socketDraft.breakerNumber,
                  phaseAllocation: socketDraft.phaseAllocation,
                  ratedAmps: socketDraft.ratedAmps,
                  voltageV: socketDraft.voltageV,
                  socketType: socketDraft.socketType,
                  elevation: socketDraft.elevation,
                  status: socketDraft.status,
                },
                editingId
                  ? `Updated ${socketDraft.floorSocketLabel}.`
                  : `Added ${socketDraft.floorSocketLabel}.`
              );
              if (ok) closeModal();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Whip name">
                <input
                  name="name"
                  required
                  placeholder="Whip name"
                  value={socketDraft.name}
                  onChange={(e) => setSocketDraft({ ...socketDraft, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Floor socket label">
                <input
                  name="floorSocketLabel"
                  required
                  placeholder="Floor socket label"
                  value={socketDraft.floorSocketLabel}
                  onChange={(e) =>
                    setSocketDraft({ ...socketDraft, floorSocketLabel: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Breaker #">
                <input
                  name="breakerNumber"
                  type="number"
                  min={1}
                  value={socketDraft.breakerNumber}
                  onChange={(e) =>
                    setSocketDraft({ ...socketDraft, breakerNumber: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Distribution panel">
                <select
                  name="panelId"
                  value={socketDraft.panelId}
                  onChange={(e) => {
                    const panel = snap.powerPanels.find((p) => p.id === e.target.value);
                    setSocketDraft({
                      ...socketDraft,
                      panelId: e.target.value,
                      roomId: panel?.roomId || socketDraft.roomId,
                    });
                  }}
                  className={inputClass}
                >
                  {snap.powerPanels.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Room">
                <select
                  name="roomId"
                  value={socketDraft.roomId}
                  onChange={(e) => setSocketDraft({ ...socketDraft, roomId: e.target.value })}
                  className={inputClass}
                >
                  {snap.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Target rack">
                <select
                  name="rackId"
                  value={socketDraft.rackId}
                  onChange={(e) => setSocketDraft({ ...socketDraft, rackId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Any rack</option>
                  {snap.racks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Phase">
                <select
                  name="phaseAllocation"
                  value={socketDraft.phaseAllocation}
                  onChange={(e) =>
                    setSocketDraft({ ...socketDraft, phaseAllocation: e.target.value })
                  }
                  className={inputClass}
                >
                  {["L1", "L2", "L3", "THREE_PHASE"].map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Rated amps">
                <input
                  name="ratedAmps"
                  type="number"
                  value={socketDraft.ratedAmps}
                  onChange={(e) => setSocketDraft({ ...socketDraft, ratedAmps: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Voltage (V)">
                <input
                  name="voltageV"
                  type="number"
                  value={socketDraft.voltageV}
                  onChange={(e) => setSocketDraft({ ...socketDraft, voltageV: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Connector">
                <select
                  name="socketType"
                  value={socketDraft.socketType}
                  onChange={(e) => setSocketDraft({ ...socketDraft, socketType: e.target.value })}
                  className={inputClass}
                >
                  {SOCKET_TYPES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Elevation">
                <select
                  name="elevation"
                  value={socketDraft.elevation}
                  onChange={(e) => setSocketDraft({ ...socketDraft, elevation: e.target.value })}
                  className={inputClass}
                >
                  <option value="UNDERFLOOR">UNDERFLOOR</option>
                  <option value="OVERHEAD">OVERHEAD</option>
                </select>
              </Field>
              <Field label="Status">
                <select
                  name="status"
                  value={socketDraft.status}
                  onChange={(e) => setSocketDraft({ ...socketDraft, status: e.target.value })}
                  className={inputClass}
                >
                  <option>ONLINE</option>
                  <option>TRIPPED</option>
                  <option>OFF</option>
                </select>
              </Field>
            </div>
            <ModalFooter
              onCancel={closeModal}
              submitLabel={editingId ? "Save socket" : "Add socket"}
              saving={saving}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

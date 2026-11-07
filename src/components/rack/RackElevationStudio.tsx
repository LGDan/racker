"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Cable,
  CheckCircle2,
  ChevronDown,
  PlugZap,
  Plus,
  Server,
  Trash2,
  Unplug,
  Zap,
} from "lucide-react";

type Mode = "power" | "network";

interface Psu {
  id: string;
  name: string;
  plugType: string;
  cableColor: string;
  connectedOutletId: string | null;
  connectedOutlet: {
    id: string;
    outletNumber: number;
    socketType: string;
    label: string;
    pdu: { id: string; name: string; feedSide: string };
  } | null;
}

interface NetPort {
  id: string;
  name: string;
  portNumber: number;
  portType: string;
  speedGbps: number;
  vlanTag: number | null;
  isManagement: boolean;
  cableAsPortA: { id: string; label: string; color: string; portBId: string } | null;
  cableAsPortB: { id: string; label: string; color: string; portAId: string } | null;
}

interface Device {
  id: string;
  name: string;
  hostname: string | null;
  assetTag: string | null;
  deviceType: string;
  manufacturer: string;
  model: string;
  startU: number;
  uHeight: number;
  status: string;
  nominalWatts: number;
  peakWatts: number;
  weightKg: number;
  psus: Psu[];
  networkPorts: NetPort[];
}

interface Outlet {
  id: string;
  outletNumber: number;
  label: string;
  bankPhase: string;
  socketType: string;
  maxAmps: number;
  connectedPsu: { id: string; name: string; device: { id: string; name: string } } | null;
}

interface Pdu {
  id: string;
  name: string;
  model: string;
  mounting: string;
  feedSide: string;
  phaseMode: string;
  maxAmps: number;
  voltageV: number;
  maxWatts: number;
  circuitId: string | null;
  circuit: { id: string; floorSocketLabel: string; phaseAllocation: string; ratedAmps: number } | null;
  outlets: Outlet[];
}

interface FloorSocket {
  id: string;
  name: string;
  floorSocketLabel: string;
  phaseAllocation: string;
  ratedAmps: number;
  voltageV: number;
  rackId: string | null;
}

interface Rack {
  id: string;
  name: string;
  code: string;
  totalU: number;
  maxPowerWatts: number;
  maxWeightKg: number;
  row: { name: string; room: { id: string; name: string; code: string } };
  pdus: Pdu[];
  devices: Device[];
  floorSockets: FloorSocket[];
}

interface Template {
  id: string;
  manufacturer: string;
  model: string;
  deviceType: string;
  uHeight: number;
  defaultWatts: number;
  peakWatts: number;
  weightKg: number;
  psuCount: number;
  psuPlugType: string;
  portCount: number;
  portType: string;
}

interface RackMetric {
  usedU: number;
  freeU: number;
  totalU: number;
  uUtilizationPct: number;
  currentPowerWatts: number;
  maxPowerWatts: number;
  powerUtilizationPct: number;
  freeOutlets: number;
  totalOutlets: number;
  feedAWatts: number;
  feedBWatts: number;
  spofDeviceCount: number;
  largestContiguousFreeU: number;
}

interface PduMetric {
  id: string;
  loadWatts: number;
  loadAmps: number;
  loadPct: number;
  freeOutlets: number;
  totalOutlets: number;
  c13Used: number;
  c13Total: number;
  c19Used: number;
  c19Total: number;
}

const U_H = 22;
const RACK_X = 210;
const RACK_W = 300;

const TYPE_COLOR: Record<string, string> = {
  SERVER: "#0891b2",
  SWITCH: "#7c3aed",
  ROUTER: "#2563eb",
  FIREWALL: "#e11d48",
  STORAGE: "#d97706",
  PATCH_PANEL: "#475569",
  UPS_RACK: "#059669",
};

function plugFits(plug: string, socket: string): { ok: boolean; warning?: string } {
  if (plug === "C20" && socket === "C13") {
    return { ok: false, warning: "A C20 plug cannot mate with a C13 outlet. Use a C19." };
  }
  if (plug === "C14" && socket === "C19") {
    return { ok: true, warning: "C14 fits a C19, but a C13 is the usual mate." };
  }
  return { ok: true };
}

function portCable(port: NetPort) {
  return port.cableAsPortA || port.cableAsPortB;
}

export function RackElevationStudio({ rackId }: { rackId: string }) {
  const [rack, setRack] = useState<Rack | null>(null);
  const [allRacks, setAllRacks] = useState<{ id: string; code: string; name: string }[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [circuits, setCircuits] = useState<FloorSocket[]>([]);
  const [metric, setMetric] = useState<RackMetric | null>(null);
  const [pduMetrics, setPduMetrics] = useState<Record<string, PduMetric>>({});
  const [portIndex, setPortIndex] = useState<
    Record<string, { portName: string; deviceName: string; rackCode: string }>
  >({});
  const [mode, setMode] = useState<Mode>("power");
  const [face, setFace] = useState<"FRONT" | "REAR">("REAR");
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedPsuId, setSelectedPsuId] = useState<string | null>(null);
  const [selectedPortId, setSelectedPortId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showPdu, setShowPdu] = useState(false);
  const [pduDraft, setPduDraft] = useState({
    name: "",
    feedSide: "A",
    mounting: "ZERO_U_LEFT",
    circuitId: "",
  });
  const [templateId, setTemplateId] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    deviceType: "SERVER",
    manufacturer: "Dell",
    model: "PowerEdge R760",
    startU: 10,
    uHeight: 2,
    nominalWatts: 500,
    peakWatts: 800,
    weightKg: 22,
    psuCount: 2,
    psuPlugType: "C14",
    portCount: 4,
    portType: "SFP28_25G",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/infrastructure");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      setError("Could not load rack.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    const found = (data.racks as Rack[]).find((r) => r.id === rackId) || null;
    setRack(found);
    setAllRacks(
      (data.racks as Rack[]).map((r) => ({ id: r.id, code: r.code, name: r.name }))
    );
    setTemplates(data.templates || []);
    setCircuits(data.powerCircuits || []);
    const m = (data.capacity?.racks || []).find((r: { id: string }) => r.id === rackId);
    setMetric(m || null);
    const pm: Record<string, PduMetric> = {};
    for (const p of data.capacity?.pdus || []) pm[p.id] = p;
    setPduMetrics(pm);
    const idx: Record<string, { portName: string; deviceName: string; rackCode: string }> = {};
    for (const r of data.racks as Rack[]) {
      for (const d of r.devices) {
        for (const p of d.networkPorts) {
          idx[p.id] = { portName: p.name, deviceName: d.name, rackCode: r.code };
        }
      }
    }
    setPortIndex(idx);
    setLoading(false);
  }, [rackId]);

  useEffect(() => {
    setLoading(true);
    setSelectedDeviceId(null);
    setSelectedPsuId(null);
    setSelectedPortId(null);
    load();
  }, [load]);

  const selected = rack?.devices.find((d) => d.id === selectedDeviceId) || null;
  const selectedPsu = selected?.psus.find((p) => p.id === selectedPsuId) || null;

  const roomCircuits = useMemo(() => {
    if (!rack) return [];
    return circuits.filter((c) => c.rackId === rack.id || !c.rackId);
  }, [circuits, rack]);

  async function operate(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch("/api/racks/operations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Update failed");
      return false;
    }
    await load();
    return true;
  }

  function applyTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((x) => x.id === id);
    if (!t || !rack) return;
    const startU = suggestStart(rack, t.uHeight);
    setDraft({
      name: `${t.manufacturer} ${t.model}`.slice(0, 48),
      deviceType: t.deviceType,
      manufacturer: t.manufacturer,
      model: t.model,
      startU,
      uHeight: t.uHeight,
      nominalWatts: t.defaultWatts,
      peakWatts: t.peakWatts,
      weightKg: t.weightKg,
      psuCount: t.psuCount,
      psuPlugType: t.psuPlugType,
      portCount: t.portCount,
      portType: t.portType,
    });
  }

  async function addDevice(e: React.FormEvent) {
    e.preventDefault();
    if (!rack) return;
    const ok = await operate({ action: "ADD_DEVICE", rackId: rack.id, ...draft });
    if (ok) {
      setShowAdd(false);
      setMessage(`Installed ${draft.name} at U${draft.startU}.`);
    }
  }

  async function connectOutlet(outlet: Outlet, pdu: Pdu) {
    if (!selectedPsu) {
      setError("Select a PSU on the rear of a device, then click a free outlet.");
      return;
    }
    const fit = plugFits(selectedPsu.plugType, outlet.socketType);
    if (!fit.ok) {
      setError(fit.warning || "Incompatible plug and socket.");
      return;
    }
    const ok = await operate({
      action: "CONNECT_PSU_TO_OUTLET",
      psuId: selectedPsu.id,
      outletId: outlet.id,
    });
    if (ok) {
      setMessage(
        `${selectedPsu.name} patched to ${pdu.name} outlet #${outlet.outletNumber} (${pdu.feedSide} / ${outlet.bankPhase}).${
          fit.warning ? " " + fit.warning : ""
        }`
      );
      setSelectedPsuId(null);
    }
  }

  async function connectPort(port: NetPort) {
    if (!selectedPortId) {
      setSelectedPortId(port.id);
      setMessage(`Source ${port.name} selected. Click the destination port.`);
      return;
    }
    if (selectedPortId === port.id) {
      setSelectedPortId(null);
      return;
    }
    const ok = await operate({
      action: "CONNECT_NETWORK_PORTS",
      portAId: selectedPortId,
      portBId: port.id,
      cableType: port.portType.includes("FIBER") || port.portType.includes("QSFP") ? "MMF_OM4" : "DAC",
      color: "#10b981",
      label: `PATCH-${port.name}`,
    });
    if (ok) {
      setMessage("Patch cable landed.");
      setSelectedPortId(null);
    }
  }

  if (loading || !rack) {
    return (
      <div className="p-8 text-sm text-slate-400">
        {error || "Loading rack elevation…"}
      </div>
    );
  }

  const stageH = 48 + rack.totalU * U_H;
  const leftPdus = rack.pdus.filter((p) => p.mounting !== "ZERO_U_RIGHT");
  const rightPdus = rack.pdus.filter((p) => p.mounting === "ZERO_U_RIGHT");
  const powerLinks = rack.devices.flatMap((d) =>
    d.psus
      .filter((p) => p.connectedOutlet)
      .map((p) => ({
        psu: p,
        device: d,
        outletId: p.connectedOutlet!.id,
        feed: p.connectedOutlet!.pdu.feedSide,
      }))
  );

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
            Interactive rack elevation
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">
            {rack.code}{" "}
            <span className="text-base font-normal text-slate-400">{rack.name}</span>
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            {rack.row.room.name} · {rack.row.name} · {rack.totalU}U ·{" "}
            {rack.maxPowerWatts.toLocaleString()} W envelope
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs text-slate-400">
            Rack
            <select
              className="ml-2 rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-white"
              value={rack.id}
              onChange={(e) => {
                window.location.href = `/racks/${e.target.value}`;
              }}
            >
              {allRacks.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => {
              setShowAdd((v) => !v);
              if (rack) setDraft((d) => ({ ...d, startU: suggestStart(rack, d.uHeight) }));
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3 py-2 text-xs font-semibold text-slate-950"
          >
            <Plus className="h-3.5 w-3.5" /> Install device
          </button>
          <button
            type="button"
            onClick={() => setShowPdu((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-100"
          >
            <PlugZap className="h-3.5 w-3.5 text-amber-300" /> Add PDU
          </button>
        </div>
      </div>

      {metric && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Meter
            label="U consumed"
            value={`${metric.usedU} / ${metric.totalU}U`}
            hint={`${metric.freeU}U free · largest gap ${metric.largestContiguousFreeU}U`}
            pct={metric.uUtilizationPct}
            tone="cyan"
          />
          <Meter
            label="Rack power"
            value={`${metric.currentPowerWatts.toLocaleString()} W`}
            hint={`A ${metric.feedAWatts} W · B ${metric.feedBWatts} W`}
            pct={metric.powerUtilizationPct}
            tone="amber"
          />
          <Meter
            label="PDU sockets free"
            value={`${metric.freeOutlets}`}
            hint={`${metric.totalOutlets - metric.freeOutlets} used of ${metric.totalOutlets}`}
            pct={
              metric.totalOutlets
                ? ((metric.totalOutlets - metric.freeOutlets) / metric.totalOutlets) * 100
                : 0
            }
            tone="emerald"
          />
          <Meter
            label="Dual-feed health"
            value={metric.spofDeviceCount === 0 ? "Redundant" : `${metric.spofDeviceCount} SPOF`}
            hint={
              metric.spofDeviceCount
                ? "A device is single-corded or unpowered"
                : "Every corded device has A and B"
            }
            pct={metric.spofDeviceCount ? 100 : 8}
            tone={metric.spofDeviceCount ? "rose" : "emerald"}
          />
        </div>
      )}

      {(error || message) && (
        <div
          className={`rounded-lg border px-3 py-2 text-xs ${
            error
              ? "border-rose-500/40 bg-rose-500/10 text-rose-100"
              : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {error || message}
        </div>
      )}

      {showAdd && (
        <form
          onSubmit={addDevice}
          className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 md:grid-cols-6"
        >
          <label className="text-xs text-slate-400 md:col-span-2">
            Catalog template
            <select
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
              value={templateId}
              onChange={(e) => applyTemplate(e.target.value)}
            >
              <option value="">Custom device</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.manufacturer} {t.model}
                </option>
              ))}
            </select>
          </label>
          <Field label="Name" className="md:col-span-2">
            <input
              required
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            />
          </Field>
          <Field label="Type">
            <select
              value={draft.deviceType}
              onChange={(e) => setDraft({ ...draft, deviceType: e.target.value })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            >
              {["SERVER", "SWITCH", "ROUTER", "FIREWALL", "STORAGE", "PATCH_PANEL", "UPS_RACK"].map(
                (t) => (
                  <option key={t}>{t}</option>
                )
              )}
            </select>
          </Field>
          <Field label="Start U">
            <input
              type="number"
              min={1}
              max={rack.totalU}
              value={draft.startU}
              onChange={(e) => setDraft({ ...draft, startU: Number(e.target.value) })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            />
          </Field>
          <Field label="Height U">
            <input
              type="number"
              min={1}
              value={draft.uHeight}
              onChange={(e) => setDraft({ ...draft, uHeight: Number(e.target.value) })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            />
          </Field>
          <Field label="Watts">
            <input
              type="number"
              value={draft.nominalWatts}
              onChange={(e) => setDraft({ ...draft, nominalWatts: Number(e.target.value) })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            />
          </Field>
          <Field label="PSUs">
            <input
              type="number"
              min={0}
              value={draft.psuCount}
              onChange={(e) => setDraft({ ...draft, psuCount: Number(e.target.value) })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            />
          </Field>
          <Field label="Plug">
            <select
              value={draft.psuPlugType}
              onChange={(e) => setDraft({ ...draft, psuPlugType: e.target.value })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            >
              <option>C14</option>
              <option>C20</option>
            </select>
          </Field>
          <Field label="Ports">
            <input
              type="number"
              min={0}
              value={draft.portCount}
              onChange={(e) => setDraft({ ...draft, portCount: Number(e.target.value) })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            />
          </Field>
          <div className="flex items-end md:col-span-2">
            <button
              disabled={busy}
              className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
            >
              {busy ? "Installing…" : "Place in rack"}
            </button>
          </div>
        </form>
      )}

      {showPdu && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await operate({
              action: "ADD_RACK_PDU",
              rackId: rack.id,
              name: pduDraft.name,
              feedSide: pduDraft.feedSide,
              mounting: pduDraft.mounting,
              circuitId: pduDraft.circuitId || null,
              phaseMode: "SINGLE_PHASE",
              maxAmps: 32,
              voltageV: 230,
            });
            if (ok) {
              setShowPdu(false);
              setMessage(`Added ${pduDraft.name}.`);
            }
          }}
          className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/80 p-4 md:grid-cols-5"
        >
          <Field label="PDU name" className="md:col-span-2">
            <input
              required
              value={pduDraft.name}
              onChange={(e) => setPduDraft({ ...pduDraft, name: e.target.value })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            />
          </Field>
          <Field label="Feed">
            <select
              value={pduDraft.feedSide}
              onChange={(e) =>
                setPduDraft({
                  ...pduDraft,
                  feedSide: e.target.value,
                  mounting: e.target.value === "B" ? "ZERO_U_RIGHT" : "ZERO_U_LEFT",
                })
              }
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            >
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          </Field>
          <Field label="Mounting">
            <select
              value={pduDraft.mounting}
              onChange={(e) => setPduDraft({ ...pduDraft, mounting: e.target.value })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            >
              <option value="ZERO_U_LEFT">ZERO_U_LEFT</option>
              <option value="ZERO_U_RIGHT">ZERO_U_RIGHT</option>
              <option value="RACKMOUNT">RACKMOUNT</option>
            </select>
          </Field>
          <Field label="Floor socket">
            <select
              value={pduDraft.circuitId}
              onChange={(e) => setPduDraft({ ...pduDraft, circuitId: e.target.value })}
              className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
            >
              <option value="">None yet</option>
              {roomCircuits.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.floorSocketLabel} · {c.phaseAllocation} · {c.ratedAmps}A
                </option>
              ))}
            </select>
          </Field>
          <div className="flex items-end">
            <button
              disabled={busy}
              className="rounded-lg bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-950 disabled:opacity-50"
            >
              {busy ? "Adding…" : "Add PDU"}
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs">
          <button
            onClick={() => {
              setMode("power");
              setFace("REAR");
            }}
            className={`inline-flex items-center gap-1 rounded px-3 py-1.5 ${
              mode === "power" ? "bg-amber-500/20 text-amber-200" : "text-slate-400"
            }`}
          >
            <Zap className="h-3.5 w-3.5" /> Power patching
          </button>
          <button
            onClick={() => {
              setMode("network");
              setFace("FRONT");
            }}
            className={`inline-flex items-center gap-1 rounded px-3 py-1.5 ${
              mode === "network" ? "bg-emerald-500/20 text-emerald-200" : "text-slate-400"
            }`}
          >
            <Cable className="h-3.5 w-3.5" /> Network patching
          </button>
        </div>
        <div className="flex rounded-lg border border-slate-800 bg-slate-900 p-1 text-xs">
          {(["FRONT", "REAR"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFace(f)}
              className={`rounded px-3 py-1.5 ${
                face === f ? "bg-slate-700 text-white" : "text-slate-400"
              }`}
            >
              {f === "FRONT" ? "Front face" : "Rear face"}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          {mode === "power"
            ? "Select a PSU, then click a free PDU outlet. Feed A is blue, feed B is amber."
            : "Select a port, then a second port, to land a patch cable."}
        </p>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950 p-4">
          <div className="relative mx-auto" style={{ width: 820, height: stageH }}>
            <div
              className="absolute rounded-md border-2 border-slate-600 bg-gradient-to-b from-slate-800 to-slate-900"
              style={{ left: RACK_X, top: 28, width: RACK_W, height: rack.totalU * U_H }}
            >
              {Array.from({ length: rack.totalU }, (_, i) => {
                const u = rack.totalU - i;
                return (
                  <div
                    key={u}
                    className="flex items-center border-b border-slate-700/70 text-[10px] text-slate-500"
                    style={{ height: U_H }}
                  >
                    <span className="w-7 pl-1 font-mono">{u}</span>
                    <span className="h-px flex-1 bg-slate-700/40" />
                    <span className="w-7 pr-1 text-right font-mono">{u}</span>
                  </div>
                );
              })}
            </div>

            {rack.devices.map((d) => {
              const top = 28 + (rack.totalU - (d.startU + d.uHeight - 1)) * U_H + 1;
              const height = d.uHeight * U_H - 2;
              const active = d.id === selectedDeviceId;
              const feeds = new Set(
                d.psus.map((p) => p.connectedOutlet?.pdu.feedSide).filter(Boolean)
              );
              const spof = d.psus.length > 0 && feeds.size < 2;
              return (
                <button
                  key={d.id}
                  onClick={() => {
                    setSelectedDeviceId(d.id);
                    setSelectedPsuId(null);
                  }}
                  className={`absolute overflow-hidden rounded border px-2 text-left ${
                    active ? "ring-2 ring-white" : ""
                  }`}
                  style={{
                    left: RACK_X + 28,
                    top,
                    width: RACK_W - 56,
                    height,
                    background: TYPE_COLOR[d.deviceType] || "#334155",
                  }}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-semibold leading-none text-white">
                    <span className="truncate">{d.name}</span>
                    {spof ? (
                      <span className="shrink-0 rounded bg-black/40 px-1 text-[9px] text-amber-200">
                        SPOF
                      </span>
                    ) : d.psus.length > 0 ? (
                      <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-200" />
                    ) : null}
                  </div>
                  {height > 28 && (
                    <div className="mt-1 truncate text-[10px] text-white/80">
                      U{d.startU} · {d.nominalWatts} W · {d.manufacturer}
                    </div>
                  )}
                </button>
              );
            })}

            <OutletStrip
              pdus={leftPdus}
              side="left"
              rack={rack}
              selectedPsu={selectedPsu}
              onOutlet={connectOutlet}
            />
            <OutletStrip
              pdus={rightPdus}
              side="right"
              rack={rack}
              selectedPsu={selectedPsu}
              onOutlet={connectOutlet}
            />

            <svg className="pointer-events-none absolute inset-0 z-20 h-full w-full">
              {mode === "power" &&
                face === "REAR" &&
                powerLinks.map((link) => {
                  const outletPos = outletPosition(rack, link.outletId, leftPdus, rightPdus);
                  const devPos = deviceAnchor(rack, link.device, link.psu.id, link.feed);
                  if (!outletPos || !devPos) return null;
                  const color = link.feed === "A" ? "#3b82f6" : "#f59e0b";
                  const mid = (outletPos.x + devPos.x) / 2;
                  const d = `M ${outletPos.x} ${outletPos.y} C ${mid} ${outletPos.y}, ${mid} ${devPos.y}, ${devPos.x} ${devPos.y}`;
                  const active = selectedPsuId === link.psu.id;
                  return (
                    <g key={link.psu.id}>
                      <path d={d} stroke="#020617" strokeWidth={active ? 6 : 4.5} fill="none" strokeLinecap="round" />
                      <path
                        d={d}
                        stroke={color}
                        strokeWidth={active ? 3 : 2.2}
                        fill="none"
                        strokeLinecap="round"
                      />
                      <circle cx={devPos.x} cy={devPos.y} r={active ? 5 : 4} fill={color} stroke="#020617" strokeWidth={1.5} />
                    </g>
                  );
                })}
            </svg>
          </div>
          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {rack.pdus.map((pdu) => {
              const m = pduMetrics[pdu.id];
              return (
                <label key={pdu.id} className="rounded-lg border border-slate-800 bg-slate-900 p-2 text-[11px] text-slate-400">
                  <span className={pdu.feedSide === "A" ? "text-blue-300" : "text-amber-300"}>
                    {pdu.name}
                  </span>
                  {m ? ` · ${m.loadWatts} W · ${m.loadAmps} A · ${m.freeOutlets} sockets free` : ""}
                  <select
                    className="mt-1 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-200"
                    value={pdu.circuitId || ""}
                    onChange={async (e) => {
                      const ok = await operate({
                        action: "CONNECT_PDU_TO_FLOOR_SOCKET",
                        pduId: pdu.id,
                        circuitId: e.target.value || null,
                      });
                      if (ok) setMessage(`${pdu.name} whip updated.`);
                    }}
                  >
                    <option value="">No floor socket</option>
                    {roomCircuits.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.floorSocketLabel} · {c.phaseAllocation} · {c.ratedAmps}A
                      </option>
                    ))}
                  </select>
                </label>
              );
            })}
          </div>
        </div>

        <aside className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/80 p-4">
          {!selected && (
            <div className="text-sm text-slate-400">
              <Server className="mb-2 h-5 w-5 text-cyan-400" />
              Select a device in the elevation to move it, cord its PSUs, or patch its ports.
            </div>
          )}
          {selected && (
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {selected.deviceType}
                </div>
                <h2 className="text-base font-bold text-white">{selected.name}</h2>
                <p className="text-xs text-slate-400">
                  {selected.manufacturer} {selected.model}
                  {selected.hostname ? ` · ${selected.hostname}` : ""}
                </p>
              </div>
              <div className="flex items-end gap-2">
                <label className="text-xs text-slate-400">
                  Move to U
                  <input
                    id="move-u"
                    type="number"
                    defaultValue={selected.startU}
                    key={selected.id + selected.startU}
                    className="mt-1 w-20 rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-white"
                  />
                </label>
                <button
                  disabled={busy}
                  onClick={async () => {
                    const el = document.getElementById("move-u") as HTMLInputElement | null;
                    const next = Number(el?.value);
                    const ok = await operate({
                      action: "MOVE_DEVICE",
                      deviceId: selected.id,
                      newStartU: next,
                    });
                    if (ok) setMessage(`Moved to U${next}.`);
                  }}
                  className="rounded border border-slate-600 px-2 py-1.5 text-xs text-slate-200"
                >
                  Move
                </button>
                <button
                  disabled={busy}
                  onClick={async () => {
                    if (!confirm(`Remove ${selected.name} from the rack?`)) return;
                    const ok = await operate({ action: "DELETE_DEVICE", deviceId: selected.id });
                    if (ok) {
                      setSelectedDeviceId(null);
                      setMessage("Device removed. Cables and cords were released.");
                    }
                  }}
                  className="ml-auto inline-flex items-center gap-1 rounded border border-rose-500/40 px-2 py-1.5 text-xs text-rose-300"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              </div>

              {mode === "power" && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-amber-300">Power supplies</div>
                  {selected.psus.length === 0 && (
                    <p className="text-xs text-slate-500">This device has no PSUs.</p>
                  )}
                  {selected.psus.map((psu) => {
                    const on = psu.id === selectedPsuId;
                    return (
                      <div
                        key={psu.id}
                        className={`rounded-lg border p-2 text-xs ${
                          on ? "border-amber-400 bg-amber-500/10" : "border-slate-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">
                            {psu.name} · {psu.plugType}
                          </span>
                          <button
                            onClick={() => setSelectedPsuId(on ? null : psu.id)}
                            className="rounded bg-slate-800 px-2 py-1 text-[11px] text-amber-200"
                          >
                            {on ? "Selecting outlet…" : "Patch"}
                          </button>
                        </div>
                        <div className="mt-1 text-slate-400">
                          {psu.connectedOutlet ? (
                            <span>
                              {psu.connectedOutlet.pdu.name} #{psu.connectedOutlet.outletNumber}{" "}
                              <span
                                className={
                                  psu.connectedOutlet.pdu.feedSide === "A"
                                    ? "text-blue-300"
                                    : "text-amber-300"
                                }
                              >
                                feed {psu.connectedOutlet.pdu.feedSide}
                              </span>
                            </span>
                          ) : (
                            <span className="text-rose-300">Not corded</span>
                          )}
                        </div>
                        {psu.connectedOutlet && (
                          <button
                            className="mt-1 inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-white"
                            onClick={async () => {
                              const ok = await operate({
                                action: "CONNECT_PSU_TO_OUTLET",
                                psuId: psu.id,
                                outletId: null,
                              });
                              if (ok) setMessage(`${psu.name} unplugged.`);
                            }}
                          >
                            <Unplug className="h-3 w-3" /> Unplug
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {mode === "network" && (
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-emerald-300">Ports</div>
                  <div className="max-h-80 space-y-1 overflow-auto">
                    {selected.networkPorts.map((port) => {
                      const cable = portCable(port);
                      const otherId = port.cableAsPortA?.portBId || port.cableAsPortB?.portAId;
                      const other = otherId ? portIndex[otherId] : null;
                      const on = selectedPortId === port.id;
                      return (
                        <button
                          key={port.id}
                          onClick={() => connectPort(port)}
                          className={`flex w-full items-center justify-between rounded border px-2 py-1.5 text-left text-xs ${
                            on
                              ? "border-emerald-400 bg-emerald-500/10"
                              : "border-slate-700 hover:border-slate-500"
                          }`}
                        >
                          <span>
                            <span className="font-semibold text-white">{port.name}</span>
                            <span className="ml-1 text-slate-500">
                              {port.portType} · {port.speedGbps}G
                            </span>
                          </span>
                          <span className="max-w-[140px] truncate text-[11px] text-emerald-300">
                            {other
                              ? `${other.rackCode} ${other.deviceName} ${other.portName}`
                              : cable
                                ? cable.label
                                : "open"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {selected.networkPorts.some((p) => portCable(p)) && (
                    <div className="space-y-1 border-t border-slate-800 pt-2">
                      {selected.networkPorts
                        .filter((p) => portCable(p))
                        .map((p) => {
                          const cable = portCable(p)!;
                          return (
                            <button
                              key={cable.id}
                              className="text-[11px] text-slate-400 hover:text-rose-300"
                              onClick={() =>
                                operate({ action: "DISCONNECT_NETWORK_CABLE", cableId: cable.id })
                              }
                            >
                              Pull {cable.label}
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <Link href="/diagrams" className="inline-flex items-center gap-1 text-xs text-cyan-400">
            <PlugZap className="h-3.5 w-3.5" /> Trace this rack on the single-line diagram
            <ChevronDown className="h-3 w-3 -rotate-90" />
          </Link>
        </aside>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`text-xs text-slate-400 ${className}`}>
      {label}
      {children}
    </label>
  );
}

function Meter({
  label,
  value,
  hint,
  pct,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  pct: number;
  tone: "cyan" | "amber" | "emerald" | "rose";
}) {
  const bar =
    tone === "amber"
      ? "bg-amber-400"
      : tone === "emerald"
        ? "bg-emerald-400"
        : tone === "rose"
          ? "bg-rose-400"
          : "bg-cyan-400";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-3">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-lg font-bold text-white">{value}</div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full ${bar}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <div className="mt-1 text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}

function suggestStart(rack: Rack, uHeight: number) {
  const occ = Array(rack.totalU + 1).fill(false);
  for (const d of rack.devices) {
    for (let u = d.startU; u < d.startU + d.uHeight; u++) occ[u] = true;
  }
  for (let u = rack.totalU - uHeight + 1; u >= 1; u--) {
    let free = true;
    for (let k = 0; k < uHeight; k++) if (occ[u + k]) free = false;
    if (free) return u;
  }
  return 1;
}

function deviceAnchor(rack: Rack, device: Device, psuId: string, feed: string) {
  const idx = Math.max(0, device.psus.findIndex((p) => p.id === psuId));
  const top = 28 + (rack.totalU - (device.startU + device.uHeight - 1)) * U_H;
  const faceHeight = device.uHeight * U_H;
  const y = top + Math.min(faceHeight - 6, 10 + idx * 8);
  const x = feed === "B" ? RACK_X + RACK_W - 36 : RACK_X + 36;
  return { x, y };
}

function outletPosition(rack: Rack, outletId: string, left: Pdu[], right: Pdu[]) {
  const scan = (pdus: Pdu[], x: number) => {
    let n = 0;
    const total = pdus.reduce((a, p) => a + p.outlets.length, 0) || 1;
    const gap = (rack.totalU * U_H - 16) / total;
    for (const p of pdus) {
      for (const o of p.outlets) {
        const y = 36 + n * gap;
        n++;
        if (o.id === outletId) return { x, y };
      }
    }
    return null;
  };
  return scan(left, 164) || scan(right, 656);
}

function spreadOutlets(pdus: Pdu[], rack: Rack) {
  const total = pdus.reduce((a, p) => a + p.outlets.length, 0) || 1;
  const gap = (rack.totalU * U_H - 16) / total;
  const items: { outlet: Outlet; pdu: Pdu; y: number }[] = [];
  let n = 0;
  for (const pdu of pdus) {
    for (const outlet of pdu.outlets) {
      items.push({ outlet, pdu, y: 36 + n * gap });
      n++;
    }
  }
  return items;
}

function OutletStrip({
  pdus,
  side,
  rack,
  selectedPsu,
  onOutlet,
}: {
  pdus: Pdu[];
  side: "left" | "right";
  rack: Rack;
  selectedPsu: Psu | null;
  onOutlet: (outlet: Outlet, pdu: Pdu) => void;
}) {
  const x = side === "left" ? 4 : 656;
  const items = spreadOutlets(pdus, rack);
  return (
    <>
      <div
        className={`absolute text-[10px] font-bold uppercase tracking-wider ${
          side === "left" ? "text-blue-300" : "text-amber-300"
        }`}
        style={{ left: x, top: 6 }}
      >
        {side === "left" ? "Feed A outlets" : "Feed B outlets"}
      </div>
      {items.map(({ outlet, pdu, y }) => {
        const used = Boolean(outlet.connectedPsu);
        const incompatible =
          selectedPsu && !plugFits(selectedPsu.plugType, outlet.socketType).ok;
        return (
          <button
            key={outlet.id}
            disabled={used && outlet.connectedPsu?.id !== selectedPsu?.id}
            onClick={() => onOutlet(outlet, pdu)}
            title={`${pdu.name} ${outlet.label}`}
            className={`absolute flex items-center justify-between rounded px-1 text-[9px] ${
              used
                ? "bg-slate-700 text-slate-200"
                : incompatible
                  ? "bg-rose-950 text-rose-200"
                  : selectedPsu
                    ? "bg-emerald-900/70 text-emerald-100"
                    : "bg-slate-800 text-slate-300"
            }`}
            style={{ left: x, top: y - 7, width: 156, height: 14 }}
          >
            <span>
              #{outlet.outletNumber} {outlet.socketType} {outlet.bankPhase}
            </span>
            <span className="max-w-[78px] truncate">
              {outlet.connectedPsu ? outlet.connectedPsu.device.name : "free"}
            </span>
          </button>
        );
      })}
    </>
  );
}

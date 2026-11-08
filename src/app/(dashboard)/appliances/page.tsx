"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Cpu, Library, Plus } from "lucide-react";
import { useInfrastructure } from "@/components/layout/infrastructure-context";
import {
  APPLIANCE_TYPES,
  PLUG_TYPES,
  PORT_TYPES,
  applianceLabel,
  btuFromWatts,
  heatBtu,
} from "@/lib/appliance-catalog";
import { deviceKind, suggestedCode } from "@/lib/suggested-code";
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
  inputClass,
  tableClasses,
  useTableSort,
} from "@/components/ui/primitives";

interface InstalledDevice {
  id: string;
  rackId: string;
  templateId: string | null;
  name: string;
  hostname: string | null;
  assetTag: string | null;
  serialNumber: string | null;
  deviceType: string;
  manufacturer: string;
  model: string;
  startU: number;
  uHeight: number;
  status: string;
  nominalWatts: number;
  peakWatts: number;
  weightKg: number;
  rack: {
    id: string;
    code: string;
    name: string;
    totalU: number;
  };
  psus: {
    id: string;
    name: string;
    plugType: string;
    connectedOutletId: string | null;
    connectedOutlet: {
      id: string;
      outletNumber: number;
      pdu: { id: string; name: string; feedSide: string };
    } | null;
  }[];
  networkPorts: {
    id: string;
    name: string;
    portType: string;
  }[];
}

interface RackOption {
  id: string;
  code: string;
  name: string;
  totalU: number;
  row: { name: string; room: { id: string; name: string } };
  devices: { id: string; startU: number; uHeight: number }[];
}

interface CatalogTemplate {
  id: string;
  name?: string;
  manufacturer: string;
  model: string;
  deviceType: string;
  uHeight: number;
  defaultWatts: number;
  peakWatts: number;
  btuPerHour?: number;
  weightKg: number;
  psuCount: number;
  psuPlugType: string;
  portCount: number;
  portType: string;
}

const STATUSES = ["ACTIVE", "PROVISIONING", "MAINTENANCE", "OFFLINE"] as const;

export default function AppliancesPage() {
  const searchParams = useSearchParams();
  const selectedDeviceId = searchParams.get("device") || "";
  const selectedRackQuery = searchParams.get("rack") || "";
  const { role, sites, refresh: refreshTree } = useInfrastructure();
  const [devices, setDevices] = useState<InstalledDevice[]>([]);
  const [racks, setRacks] = useState<RackOption[]>([]);
  const [templates, setTemplates] = useState<CatalogTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [installOpen, setInstallOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [hostnameTouched, setHostnameTouched] = useState(false);
  const [installDraft, setInstallDraft] = useState({
    rackId: "",
    name: "",
    hostname: "",
    assetTag: "",
    deviceType: "SERVER",
    manufacturer: "Dell",
    model: "PowerEdge R760",
    startU: "1",
    uHeight: "2",
    nominalWatts: "500",
    peakWatts: "800",
    weightKg: "22",
    psuCount: "2",
    psuPlugType: "C14",
    portCount: "4",
    portType: "SFP28_25G",
  });

  const [editing, setEditing] = useState<InstalledDevice | null>(null);
  const [editDraft, setEditDraft] = useState({
    rackId: "",
    name: "",
    hostname: "",
    assetTag: "",
    serialNumber: "",
    deviceType: "SERVER",
    manufacturer: "",
    model: "",
    startU: "1",
    uHeight: "1",
    status: "ACTIVE",
    nominalWatts: "500",
    peakWatts: "800",
    weightKg: "20",
  });

  const load = useCallback(async () => {
    const res = await fetch("/api/infrastructure");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    if (!res.ok) {
      setError("Could not load appliances.");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setDevices(data.devices || []);
    setRacks(data.racks || []);
    setTemplates(data.templates || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const roomByRackId = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of racks) {
      map.set(r.id, r.row?.room?.name || "—");
    }
    return map;
  }, [racks]);

  const filteredDevices = useMemo(() => {
    if (selectedDeviceId) {
      return devices.filter((d) => d.id === selectedDeviceId);
    }
    if (selectedRackQuery) {
      return devices.filter((d) => d.rackId === selectedRackQuery);
    }
    return devices;
  }, [devices, selectedDeviceId, selectedRackQuery]);

  const sort = useTableSort(
    filteredDevices,
    {
      name: (d) => d.name,
      hostname: (d) => d.hostname || "",
      type: (d) => d.deviceType,
      rack: (d) => `${d.rack.code} ${String(d.startU).padStart(2, "0")}`,
      uRange: (d) => d.startU,
      watts: (d) => d.nominalWatts,
      feeds: (d) =>
        new Set(d.psus.map((p) => p.connectedOutlet?.pdu.feedSide).filter(Boolean)).size,
      ports: (d) => d.networkPorts.length,
      status: (d) => d.status,
    },
    "rack"
  );

  const suggestedHostname = useMemo(
    () =>
      installDraft.rackId
        ? suggestedCode(
            sites,
            deviceKind(installDraft.deviceType),
            installDraft.rackId,
            installDraft.name
          )
        : "",
    [sites, installDraft.rackId, installDraft.deviceType, installDraft.name]
  );

  useEffect(() => {
    if (!hostnameTouched && installOpen) {
      setInstallDraft((current) => ({ ...current, hostname: suggestedHostname }));
    }
  }, [suggestedHostname, hostnameTouched, installOpen]);

  function openInstall() {
    const firstRack = racks[0];
    const startU = firstRack ? suggestFreeU(firstRack, 2) : 1;
    setTemplateId("");
    setHostnameTouched(false);
    setInstallDraft({
      rackId: firstRack?.id || "",
      name: "",
      hostname: "",
      assetTag: "",
      deviceType: "SERVER",
      manufacturer: "Dell",
      model: "PowerEdge R760",
      startU: String(startU),
      uHeight: "2",
      nominalWatts: "500",
      peakWatts: "800",
      weightKg: "22",
      psuCount: "2",
      psuPlugType: "C14",
      portCount: "4",
      portType: "SFP28_25G",
    });
    setError(null);
    setInstallOpen(true);
  }

  function applyCatalogTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((item) => item.id === id);
    if (!t) return;
    const targetRack = racks.find((r) => r.id === installDraft.rackId);
    const startU = targetRack ? suggestFreeU(targetRack, t.uHeight) : 1;
    setInstallDraft((current) => ({
      ...current,
      name: applianceLabel(t).slice(0, 48),
      deviceType: t.deviceType,
      manufacturer: t.manufacturer,
      model: t.model,
      startU: String(startU),
      uHeight: String(t.uHeight),
      nominalWatts: String(t.defaultWatts),
      peakWatts: String(t.peakWatts),
      weightKg: String(t.weightKg),
      psuCount: String(t.psuCount),
      psuPlugType: t.psuPlugType,
      portCount: String(t.portCount),
      portType: t.portType,
    }));
  }

  function beginEdit(dev: InstalledDevice) {
    setEditing(dev);
    setEditDraft({
      rackId: dev.rackId,
      name: dev.name,
      hostname: dev.hostname || "",
      assetTag: dev.assetTag || "",
      serialNumber: dev.serialNumber || "",
      deviceType: dev.deviceType,
      manufacturer: dev.manufacturer,
      model: dev.model,
      startU: String(dev.startU),
      uHeight: String(dev.uHeight),
      status: dev.status,
      nominalWatts: String(dev.nominalWatts),
      peakWatts: String(dev.peakWatts),
      weightKg: String(dev.weightKg),
    });
    setError(null);
  }

  async function mutate(body: Record<string, unknown>, successMsg: string) {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/racks/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Operation failed");
        return false;
      }
      setNotice(successMsg);
      await Promise.all([load(), refreshTree()]);
      return true;
    } finally {
      setSaving(false);
    }
  }

  async function removeDevice(dev: InstalledDevice) {
    if (!window.confirm(`Remove ${dev.name} from rack ${dev.rack.code}?`)) return;
    await mutate(
      { action: "DELETE_DEVICE", deviceId: dev.id },
      `Removed ${dev.name} from ${dev.rack.code}.`
    );
  }

  if (loading) {
    return <div className="p-8 text-sm text-slate-400">Loading installed rack appliances…</div>;
  }

  const totalWatts = devices.reduce((sum, d) => sum + d.nominalWatts, 0);
  const totalUUsed = devices.reduce((sum, d) => sum + d.uHeight, 0);
  const redundantCount = devices.filter((d) => {
    const feeds = new Set(
      d.psus.map((p) => p.connectedOutlet?.pdu.feedSide).filter(Boolean)
    );
    return feeds.size >= 2;
  }).length;
  const chosenTemplate = templates.find((t) => t.id === templateId);

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        kicker="In-Rack IT & Network Fleet"
        icon={<Cpu className="h-3.5 w-3.5" />}
        title="Installed rack appliances"
        subtitle={
          <>
            Servers, switches, routers, firewalls, storage arrays, patch panels, and rack UPS units deployed across racks. Click any appliance in the tree or table to edit its U-slot, rack, hostname, or power ratings.
          </>
        }
        actions={
          <>
            <Link href="/catalog" className={btnSecondary}>
              <Library className="h-3.5 w-3.5 text-cyan-400" />
              Appliance catalog
            </Link>
            <button type="button" onClick={openInstall} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" />
              Install appliance
            </button>
          </>
        }
      />

      {!installOpen && !editing && <AlertBanner error={error} notice={notice} />}

      {(selectedDeviceId || selectedRackQuery) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2.5 text-xs text-cyan-200">
          <span>
            Showing tree selection:{" "}
            <strong className="text-white">
              {selectedDeviceId
                ? devices.find((d) => d.id === selectedDeviceId)?.name || "Appliance"
                : racks.find((r) => r.id === selectedRackQuery)?.code || "Rack"}
            </strong>
          </span>
          <Link href="/appliances" className="font-semibold text-cyan-300 hover:underline">
            Show all installed appliances
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Installed appliances
          </div>
          <div className="mt-1 text-lg font-bold text-white">{devices.length}</div>
          <div className="text-[11px] text-slate-400">Across {racks.length} racks</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            U space occupied
          </div>
          <div className="mt-1 text-lg font-bold text-white">{totalUUsed}U</div>
          <div className="text-[11px] text-slate-400">Active elevation footprint</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Total nominal draw
          </div>
          <div className="mt-1 text-lg font-bold text-amber-300">
            {(totalWatts / 1000).toFixed(2)} kW
          </div>
          <div className="text-[11px] text-slate-400">
            {btuFromWatts(totalWatts).toLocaleString()} BTU/h heat
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Dual-corded (A+B)
          </div>
          <div className="mt-1 text-lg font-bold text-emerald-300">
            {redundantCount} / {devices.length}
          </div>
          <div className="text-[11px] text-slate-400">Redundant PSU feeds</div>
        </div>
      </div>

      <SectionCard
        title="Deployed rack appliances"
        subtitle={`${filteredDevices.length} ${
          filteredDevices.length === 1 ? "appliance" : "appliances"
        } shown`}
        actions={
          <button type="button" onClick={openInstall} className={btnPrimary}>
            <Plus className="h-3.5 w-3.5" />
            Install appliance
          </button>
        }
      >
        {filteredDevices.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">
            No appliances installed yet. Click Install appliance to place gear into a rack.
          </div>
        ) : (
          <div className={tableClasses.wrapper}>
            <table className={tableClasses.table}>
              <thead className={tableClasses.thead}>
                <tr>
                  <SortHeader label="Appliance" column="name" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
                  <SortHeader label="Short code" column="hostname" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
                  <SortHeader label="Type" column="type" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
                  <SortHeader label="Rack & room" column="rack" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
                  <SortHeader label="U slot" column="uRange" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
                  <SortHeader label="Power / Heat" column="watts" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
                  <SortHeader label="PSU feeds" column="feeds" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
                  <SortHeader label="Ports" column="ports" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
                  <SortHeader label="Status" column="status" sortKey={sort.sortKey} sortDir={sort.sortDir} onSort={sort.toggleSort} />
                  <th className={tableClasses.thRight}> </th>
                </tr>
              </thead>
              <tbody className={tableClasses.tbody}>
                {sort.sorted.map((dev) => {
                  const endU = dev.startU + dev.uHeight - 1;
                  const feeds = Array.from(
                    new Set(
                      dev.psus
                        .map((p) => p.connectedOutlet?.pdu.feedSide)
                        .filter(Boolean)
                    )
                  );
                  const cordedCount = dev.psus.filter((p) => p.connectedOutlet).length;
                  return (
                    <tr key={dev.id} className={tableClasses.tr}>
                      <td className={tableClasses.td}>
                        <div className="font-semibold text-white">{dev.name}</div>
                        <div className="text-slate-500">
                          {dev.manufacturer} {dev.model}
                        </div>
                      </td>
                      <td className={`${tableClasses.td} font-mono text-slate-300`}>
                        {dev.hostname || "—"}
                      </td>
                      <td className={tableClasses.td}>
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase text-cyan-300">
                          {dev.deviceType}
                        </span>
                      </td>
                      <td className={tableClasses.td}>
                        <Link
                          href={`/racks/${dev.rackId}`}
                          className="font-mono font-semibold text-cyan-300 hover:underline"
                        >
                          {dev.rack.code}
                        </Link>
                        <div className="text-[11px] text-slate-500">
                          {roomByRackId.get(dev.rackId) || dev.rack.name}
                        </div>
                      </td>
                      <td className={`${tableClasses.td} font-mono`}>
                        {dev.uHeight === 1 ? `U${dev.startU}` : `U${dev.startU}–U${endU}`} (
                        {dev.uHeight}U)
                      </td>
                      <td className={`${tableClasses.td} font-mono`}>
                        {dev.nominalWatts.toLocaleString()} W
                        <div className="text-[10px] text-slate-500">
                          {btuFromWatts(dev.nominalWatts).toLocaleString()} BTU/h
                        </div>
                      </td>
                      <td className={tableClasses.td}>
                        <span
                          className={
                            feeds.length >= 2
                              ? "font-semibold text-emerald-300"
                              : cordedCount > 0
                              ? "font-semibold text-amber-300"
                              : "text-rose-300"
                          }
                        >
                          {cordedCount}/{dev.psus.length} corded
                          {feeds.length > 0 ? ` (${feeds.sort().join("+")})` : ""}
                        </span>
                      </td>
                      <td className={tableClasses.td}>{dev.networkPorts.length}</td>
                      <td className={tableClasses.td}>{dev.status}</td>
                      <td className={tableClasses.tdRight}>
                        <div className="flex justify-end gap-3 whitespace-nowrap">
                          <Link
                            href={`/racks/${dev.rackId}`}
                            className="text-slate-400 hover:text-white"
                          >
                            Rack
                          </Link>
                          <button
                            type="button"
                            onClick={() => beginEdit(dev)}
                            className="text-cyan-400 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void removeDevice(dev)}
                            className="text-rose-300 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {installOpen && (
        <Modal title="Install appliance in rack" onClose={() => setInstallOpen(false)} wide>
          <AlertBanner error={error} />
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await mutate(
                {
                  action: "ADD_DEVICE",
                  rackId: installDraft.rackId,
                  templateId: templateId || null,
                  name: installDraft.name,
                  hostname: installDraft.hostname,
                  assetTag: installDraft.assetTag || null,
                  deviceType: installDraft.deviceType,
                  manufacturer: installDraft.manufacturer,
                  model: installDraft.model,
                  startU: Number(installDraft.startU),
                  uHeight: Number(installDraft.uHeight),
                  nominalWatts: Number(installDraft.nominalWatts),
                  peakWatts: Number(installDraft.peakWatts),
                  weightKg: Number(installDraft.weightKg),
                  psuCount: Number(installDraft.psuCount),
                  psuPlugType: installDraft.psuPlugType,
                  portCount: Number(installDraft.portCount),
                  portType: installDraft.portType,
                },
                `Installed ${installDraft.name}.`
              );
              if (ok) setInstallOpen(false);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Target rack">
                <select
                  value={installDraft.rackId}
                  onChange={(e) => {
                    const nextRack = racks.find((r) => r.id === e.target.value);
                    const nextStart = nextRack
                      ? suggestFreeU(nextRack, Number(installDraft.uHeight || 1))
                      : 1;
                    setInstallDraft({
                      ...installDraft,
                      rackId: e.target.value,
                      startU: String(nextStart),
                    });
                  }}
                  className={inputClass}
                  required
                >
                  {racks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <label className="text-xs font-medium text-slate-300 sm:col-span-2">
                <span className="flex items-center justify-between gap-2">
                  Catalog template
                  {role === "ADMIN" && (
                    <Link href="/catalog" className="text-cyan-400 hover:underline">
                      Edit catalog
                    </Link>
                  )}
                </span>
                <select
                  value={templateId}
                  onChange={(e) => applyCatalogTemplate(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Custom device</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {applianceLabel(t)}
                    </option>
                  ))}
                </select>
                {chosenTemplate && (
                  <span className="mt-1 block font-normal text-[11px] text-slate-500">
                    {chosenTemplate.uHeight}U · {chosenTemplate.defaultWatts} W ·{" "}
                    {heatBtu(chosenTemplate).toLocaleString()} BTU/h ·{" "}
                    {chosenTemplate.psuCount}× {chosenTemplate.psuPlugType} ·{" "}
                    {chosenTemplate.portCount} {chosenTemplate.portType}
                  </span>
                )}
              </label>

              <Field label="Name">
                <input
                  required
                  value={installDraft.name}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, name: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Short Code">
                <input
                  required
                  value={installDraft.hostname}
                  onChange={(e) => {
                    setHostnameTouched(true);
                    setInstallDraft({ ...installDraft, hostname: e.target.value });
                  }}
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="Type">
                <select
                  value={installDraft.deviceType}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, deviceType: e.target.value })
                  }
                  className={inputClass}
                >
                  {APPLIANCE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Manufacturer">
                <input
                  required
                  value={installDraft.manufacturer}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, manufacturer: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Model">
                <input
                  required
                  value={installDraft.model}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, model: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Asset tag">
                <input
                  placeholder="Optional"
                  value={installDraft.assetTag}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, assetTag: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Start U">
                <input
                  type="number"
                  min={1}
                  max={58}
                  value={installDraft.startU}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, startU: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Height U">
                <input
                  type="number"
                  min={1}
                  max={58}
                  value={installDraft.uHeight}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, uHeight: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Watts">
                <input
                  type="number"
                  min={0}
                  value={installDraft.nominalWatts}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, nominalWatts: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="PSUs">
                <input
                  type="number"
                  min={0}
                  max={8}
                  value={installDraft.psuCount}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, psuCount: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Plug">
                <select
                  value={installDraft.psuPlugType}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, psuPlugType: e.target.value })
                  }
                  className={inputClass}
                >
                  {PLUG_TYPES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ports">
                <input
                  type="number"
                  min={0}
                  max={256}
                  value={installDraft.portCount}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, portCount: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Port type">
                <select
                  value={installDraft.portType}
                  onChange={(e) =>
                    setInstallDraft({ ...installDraft, portType: e.target.value })
                  }
                  className={inputClass}
                >
                  {PORT_TYPES.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </Field>
            </div>
            <ModalFooter
              onCancel={() => setInstallOpen(false)}
              submitLabel="Place in rack"
              saving={saving}
            />
          </form>
        </Modal>
      )}

      {editing && (
        <Modal
          title={`Edit appliance — ${editing.name}`}
          onClose={() => setEditing(null)}
          wide
        >
          <AlertBanner error={error} />
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              const ok = await mutate(
                {
                  action: "UPDATE_DEVICE",
                  deviceId: editing.id,
                  rackId: editDraft.rackId,
                  name: editDraft.name,
                  hostname: editDraft.hostname,
                  assetTag: editDraft.assetTag,
                  serialNumber: editDraft.serialNumber,
                  deviceType: editDraft.deviceType,
                  manufacturer: editDraft.manufacturer,
                  model: editDraft.model,
                  startU: Number(editDraft.startU),
                  uHeight: Number(editDraft.uHeight),
                  status: editDraft.status,
                  nominalWatts: Number(editDraft.nominalWatts),
                  peakWatts: Number(editDraft.peakWatts),
                  weightKg: Number(editDraft.weightKg),
                },
                `Updated ${editDraft.name}.`
              );
              if (ok) setEditing(null);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name">
                <input
                  required
                  value={editDraft.name}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, name: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Short Code / Hostname">
                <input
                  value={editDraft.hostname}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, hostname: e.target.value })
                  }
                  className={`${inputClass} font-mono`}
                />
              </Field>
              <Field label="Type">
                <select
                  value={editDraft.deviceType}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, deviceType: e.target.value })
                  }
                  className={inputClass}
                >
                  {APPLIANCE_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Manufacturer">
                <input
                  required
                  value={editDraft.manufacturer}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, manufacturer: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Model">
                <input
                  required
                  value={editDraft.model}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, model: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Status">
                <select
                  value={editDraft.status}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, status: e.target.value })
                  }
                  className={inputClass}
                >
                  {STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Rack">
                <select
                  value={editDraft.rackId}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, rackId: e.target.value })
                  }
                  className={inputClass}
                >
                  {racks.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.code} — {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Start U">
                <input
                  type="number"
                  min={1}
                  max={58}
                  value={editDraft.startU}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, startU: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Height (U)">
                <input
                  type="number"
                  min={1}
                  max={58}
                  value={editDraft.uHeight}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, uHeight: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Nominal watts">
                <input
                  type="number"
                  min={0}
                  value={editDraft.nominalWatts}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, nominalWatts: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Peak watts">
                <input
                  type="number"
                  min={0}
                  value={editDraft.peakWatts}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, peakWatts: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Weight (kg)">
                <input
                  type="number"
                  step="0.1"
                  min={0}
                  value={editDraft.weightKg}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, weightKg: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Asset tag">
                <input
                  value={editDraft.assetTag}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, assetTag: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Serial number" className="sm:col-span-2">
                <input
                  value={editDraft.serialNumber}
                  onChange={(e) =>
                    setEditDraft({ ...editDraft, serialNumber: e.target.value })
                  }
                  className={inputClass}
                />
              </Field>
            </div>
            <ModalFooter
              onCancel={() => setEditing(null)}
              submitLabel="Save appliance"
              saving={saving}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

function suggestFreeU(rack: RackOption, uHeight: number) {
  const occupied = new Array(rack.totalU + 1).fill(false);
  for (const d of rack.devices || []) {
    for (let u = d.startU; u < d.startU + d.uHeight && u <= rack.totalU; u++) {
      occupied[u] = true;
    }
  }
  for (let u = rack.totalU - uHeight + 1; u >= 1; u--) {
    let free = true;
    for (let k = 0; k < uHeight; k++) {
      if (occupied[u + k]) free = false;
    }
    if (free) return u;
  }
  return 1;
}

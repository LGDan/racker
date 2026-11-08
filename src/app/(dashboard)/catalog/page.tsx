"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Library, PlugZap, Plus, Trash2 } from "lucide-react";
import { useInfrastructure } from "@/components/layout/infrastructure-context";
import {
  APPLIANCE_TYPES,
  PDU_INPUT_PLUG_TYPES,
  PDU_MOUNTING_TYPES,
  PDU_PHASE_MODES,
  PDU_SOCKET_TYPES,
  PLUG_TYPES,
  PORT_TYPES,
  type OutletBankSpec,
  type PduSocketType,
  applianceLabel,
  btuFromWatts,
  describeOutletSpecs,
  formatOutletSpecs,
  heatBtu,
  parseOutletSpecs,
  pduMaxWatts,
} from "@/lib/appliance-catalog";
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

interface Appliance {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  deviceType: string;
  uHeight: number;
  defaultWatts: number;
  peakWatts: number;
  btuPerHour: number;
  weightKg: number;
  psuCount: number;
  psuPlugType: string;
  portCount: number;
  portType: string;
  installedCount: number;
}

interface PduCatalogItem {
  id: string;
  name: string;
  manufacturer: string;
  model: string;
  mounting: string;
  uHeight: number;
  phaseMode: string;
  maxAmps: number;
  voltageV: number;
  inputPlugType: string;
  outletSpecs: string;
  installedCount: number;
}

interface Draft {
  name: string;
  manufacturer: string;
  model: string;
  deviceType: string;
  uHeight: string;
  defaultWatts: string;
  peakWatts: string;
  btuPerHour: string;
  weightKg: string;
  psuCount: string;
  psuPlugType: string;
  portCount: string;
  portType: string;
}

interface PduDraft {
  name: string;
  manufacturer: string;
  model: string;
  mounting: string;
  uHeight: string;
  phaseMode: string;
  maxAmps: string;
  voltageV: string;
  inputPlugType: string;
  banks: OutletBankSpec[];
}

const EMPTY: Draft = {
  name: "",
  manufacturer: "",
  model: "",
  deviceType: "SERVER",
  uHeight: "1",
  defaultWatts: "450",
  peakWatts: "700",
  btuPerHour: String(btuFromWatts(450)),
  weightKg: "18",
  psuCount: "2",
  psuPlugType: "C14",
  portCount: "4",
  portType: "SFP28_25G",
};

const EMPTY_PDU: PduDraft = {
  name: "",
  manufacturer: "APC",
  model: "AP8853 Zero-U 32A",
  mounting: "ZERO_U_LEFT",
  uHeight: "0",
  phaseMode: "SINGLE_PHASE",
  maxAmps: "32",
  voltageV: "230",
  inputPlugType: "IEC_60309_32A_1P",
  banks: [
    { socketType: "C13", count: 12 },
    { socketType: "C19", count: 4 },
  ],
};

export default function CatalogPage() {
  const { role } = useInfrastructure();
  const admin = role === "ADMIN";
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [pduTemplates, setPduTemplates] = useState<PduCatalogItem[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pduDraft, setPduDraft] = useState<PduDraft>(EMPTY_PDU);
  const [editingPduId, setEditingPduId] = useState<string | null>(null);
  const [pduModalOpen, setPduModalOpen] = useState(false);
  const [btuTouched, setBtuTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const catalogSort = useTableSort(
    appliances,
    {
      name: (item) => applianceLabel(item),
      deviceType: (item) => item.deviceType,
      uHeight: (item) => item.uHeight,
      defaultWatts: (item) => item.defaultWatts,
      btuPerHour: (item) => heatBtu(item),
      psuCount: (item) => item.psuCount,
      psuPlugType: (item) => item.psuPlugType,
      portCount: (item) => item.portCount,
      installedCount: (item) => item.installedCount,
    },
    "name"
  );

  const pduSort = useTableSort(
    pduTemplates,
    {
      name: (item) => applianceLabel(item),
      mounting: (item) => item.mounting,
      phaseMode: (item) => item.phaseMode,
      rating: (item) => pduMaxWatts(item.phaseMode, item.maxAmps, item.voltageV),
      inputPlug: (item) => item.inputPlugType,
      outlets: (item) =>
        parseOutletSpecs(item.outletSpecs).reduce((sum, b) => sum + b.count, 0),
      installedCount: (item) => item.installedCount,
    },
    "name"
  );

  async function load() {
    const res = await fetch("/api/catalog");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load the catalog");
      return;
    }
    setAppliances(data.appliances || []);
    setPduTemplates(data.pduTemplates || []);
  }

  useEffect(() => {
    load();
  }, []);

  function setField(key: keyof Draft, value: string) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "defaultWatts" && !btuTouched) {
        next.btuPerHour = String(btuFromWatts(Number(value)));
      }
      return next;
    });
  }

  function beginCreate() {
    setEditingId(null);
    setBtuTouched(false);
    setDraft(EMPTY);
    setError(null);
    setModalOpen(true);
  }

  function beginEdit(item: Appliance) {
    const storedHeat = item.btuPerHour > 0;
    setEditingId(item.id);
    setBtuTouched(storedHeat);
    setDraft({
      name: item.name || applianceLabel(item),
      manufacturer: item.manufacturer,
      model: item.model,
      deviceType: item.deviceType,
      uHeight: String(item.uHeight),
      defaultWatts: String(item.defaultWatts),
      peakWatts: String(item.peakWatts),
      btuPerHour: String(heatBtu(item)),
      weightKg: String(item.weightKg),
      psuCount: String(item.psuCount),
      psuPlugType: item.psuPlugType,
      portCount: String(item.portCount),
      portType: item.portType,
    });
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
    setBtuTouched(false);
    setDraft(EMPTY);
  }

  function beginCreatePdu() {
    setEditingPduId(null);
    setPduDraft(EMPTY_PDU);
    setError(null);
    setPduModalOpen(true);
  }

  function beginEditPdu(item: PduCatalogItem) {
    setEditingPduId(item.id);
    setPduDraft({
      name: item.name || applianceLabel(item),
      manufacturer: item.manufacturer,
      model: item.model,
      mounting: item.mounting,
      uHeight: String(item.uHeight || (item.mounting === "RACKMOUNT" ? 1 : 0)),
      phaseMode: item.phaseMode,
      maxAmps: String(item.maxAmps),
      voltageV: String(item.voltageV),
      inputPlugType: item.inputPlugType,
      banks: parseOutletSpecs(item.outletSpecs),
    });
    setError(null);
    setPduModalOpen(true);
  }

  function closePduModal() {
    setPduModalOpen(false);
    setEditingPduId(null);
    setPduDraft(EMPTY_PDU);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: editingId ? "UPDATE" : "CREATE",
        id: editingId,
        ...draft,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not save the appliance");
      return;
    }
    closeModal();
    await load();
  }

  async function savePdu(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    const outletSpecs = formatOutletSpecs(pduDraft.banks);
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: editingPduId ? "UPDATE_PDU" : "CREATE_PDU",
        id: editingPduId,
        name: pduDraft.name,
        manufacturer: pduDraft.manufacturer,
        model: pduDraft.model,
        mounting: pduDraft.mounting,
        uHeight: pduDraft.mounting === "RACKMOUNT" ? pduDraft.uHeight : "0",
        phaseMode: pduDraft.phaseMode,
        maxAmps: pduDraft.maxAmps,
        voltageV: pduDraft.voltageV,
        inputPlugType: pduDraft.inputPlugType,
        outletSpecs,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not save the PDU template");
      return;
    }
    closePduModal();
    await load();
  }

  async function remove(item: Appliance) {
    const label = applianceLabel(item);
    const installed =
      item.installedCount === 0
        ? ""
        : item.installedCount === 1
          ? " The installed device keeps its current settings."
          : ` ${item.installedCount} installed devices keep their current settings.`;
    if (!window.confirm(`Remove ${label} from the catalog?${installed}`)) return;
    setError(null);
    setNotice(null);
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE", id: item.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not remove the appliance");
      return;
    }
    if (editingId === item.id) closeModal();
    await load();
  }

  async function removePdu(item: PduCatalogItem) {
    const label = applianceLabel(item);
    const installed =
      item.installedCount === 0
        ? ""
        : item.installedCount === 1
          ? " The installed rack PDU keeps its current outlets."
          : ` ${item.installedCount} installed rack PDUs keep their current outlets.`;
    if (!window.confirm(`Remove ${label} from the PDU catalog?${installed}`)) return;
    setError(null);
    setNotice(null);
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "DELETE_PDU", id: item.id }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not remove the PDU template");
      return;
    }
    if (editingPduId === item.id) closePduModal();
    await load();
  }

  async function importCsv(file: File | undefined, kind: "appliance" | "pdu") {
    if (!file) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const csv = await file.text();
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: kind === "pdu" ? "IMPORT_PDU_CSV" : "IMPORT_CSV",
        csv,
      }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not import the catalog");
      return;
    }
    const written = Number(data.written || 0);
    if (kind === "pdu") {
      setNotice(
        written === 1 ? "Imported 1 PDU template." : `Imported ${written} PDU templates.`
      );
    } else {
      setNotice(
        written === 1 ? "Imported 1 appliance." : `Imported ${written} appliances.`
      );
    }
    await load();
  }

  function updateBank(index: number, patch: Partial<OutletBankSpec>) {
    setPduDraft((current) => ({
      ...current,
      banks: current.banks.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }));
  }

  function addBank() {
    const used = new Set(pduDraft.banks.map((b) => b.socketType));
    const nextType =
      PDU_SOCKET_TYPES.find((t) => !used.has(t)) || PDU_SOCKET_TYPES[0];
    setPduDraft((current) => ({
      ...current,
      banks: [...current.banks, { socketType: nextType, count: 4 }],
    }));
  }

  function removeBank(index: number) {
    setPduDraft((current) => ({
      ...current,
      banks: current.banks.filter((_, i) => i !== index),
    }));
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        kicker="Appliance Library & Specs"
        icon={<Library className="h-3.5 w-3.5" />}
        title="Appliance & PDU catalog"
        subtitle={
          <>
            Predefined servers, network gear, and custom rack PDUs with configurable socket banks.{" "}
            <Link href="/racks" className="text-cyan-400 hover:underline">
              Open a rack
            </Link>{" "}
            and use Install device or Add PDU to apply a template.
          </>
        }
        actions={
          <>
            <a href="/api/catalog?format=csv" className={btnSecondary}>
              Export CSV
            </a>
            {admin && (
              <>
                <label className={`cursor-pointer ${btnSecondary}`}>
                  Import CSV
                  <input
                    type="file"
                    accept="text/csv,.csv"
                    className="hidden"
                    disabled={saving}
                    onChange={(event) => {
                      void importCsv(event.target.files?.[0], "appliance");
                      event.target.value = "";
                    }}
                  />
                </label>
                <button type="button" onClick={beginCreatePdu} className={btnSecondary}>
                  <PlugZap className="h-3.5 w-3.5 text-amber-300" />
                  New PDU template
                </button>
                <button type="button" onClick={beginCreate} className={btnPrimary}>
                  <Plus className="h-3.5 w-3.5" />
                  New appliance
                </button>
              </>
            )}
          </>
        }
      />

      {admin && (
        <p className="-mt-3 text-[11px] text-slate-500">
          A blank id adds an entry. An existing id updates that row. Leave BTU/h blank to fill it from watts.
        </p>
      )}

      {!modalOpen && !pduModalOpen && <AlertBanner error={error} notice={notice} />}

      {appliances.length === 0 ? (
        <SectionCard
          title="Catalog templates"
          subtitle="Servers, switches, routers, firewalls, storage, patch panels, and rack UPS"
          padded
        >
          <p className="text-sm text-slate-400">The appliance catalog is empty.</p>
        </SectionCard>
      ) : (
        <SectionCard
          title="Catalog templates"
          subtitle={`${appliances.length} ${appliances.length === 1 ? "appliance" : "appliances"} configured`}
        >
          <div className={tableClasses.wrapper}>
            <table className={tableClasses.table}>
              <thead className={tableClasses.thead}>
                <tr>
                  <SortHeader label="Name" column="name" sortKey={catalogSort.sortKey} sortDir={catalogSort.sortDir} onSort={catalogSort.toggleSort} />
                  <SortHeader label="Type" column="deviceType" sortKey={catalogSort.sortKey} sortDir={catalogSort.sortDir} onSort={catalogSort.toggleSort} />
                  <SortHeader label="Height" column="uHeight" sortKey={catalogSort.sortKey} sortDir={catalogSort.sortDir} onSort={catalogSort.toggleSort} />
                  <SortHeader label="Watts" column="defaultWatts" sortKey={catalogSort.sortKey} sortDir={catalogSort.sortDir} onSort={catalogSort.toggleSort} />
                  <SortHeader label="BTU/h" column="btuPerHour" sortKey={catalogSort.sortKey} sortDir={catalogSort.sortDir} onSort={catalogSort.toggleSort} />
                  <SortHeader label="PSUs" column="psuCount" sortKey={catalogSort.sortKey} sortDir={catalogSort.sortDir} onSort={catalogSort.toggleSort} />
                  <SortHeader label="Plug" column="psuPlugType" sortKey={catalogSort.sortKey} sortDir={catalogSort.sortDir} onSort={catalogSort.toggleSort} />
                  <SortHeader label="Ports" column="portCount" sortKey={catalogSort.sortKey} sortDir={catalogSort.sortDir} onSort={catalogSort.toggleSort} />
                  <SortHeader label="Installed" column="installedCount" sortKey={catalogSort.sortKey} sortDir={catalogSort.sortDir} onSort={catalogSort.toggleSort} />
                  <th className={tableClasses.thRight}> </th>
                </tr>
              </thead>
              <tbody className={tableClasses.tbody}>
                {catalogSort.sorted.map((item) => (
                  <tr key={item.id} className={tableClasses.tr}>
                    <td className={tableClasses.td}>
                      <div className="font-semibold text-white">{applianceLabel(item)}</div>
                      <div className="text-slate-500">
                        {item.manufacturer} {item.model}
                      </div>
                    </td>
                    <td className={tableClasses.td}>{item.deviceType}</td>
                    <td className={tableClasses.td}>{item.uHeight}U</td>
                    <td className={tableClasses.td}>
                      {item.defaultWatts}
                      <span className="text-slate-500"> / {item.peakWatts} peak</span>
                    </td>
                    <td className={tableClasses.td}>{heatBtu(item).toLocaleString()}</td>
                    <td className={tableClasses.td}>{item.psuCount}</td>
                    <td className={tableClasses.td}>{item.psuPlugType}</td>
                    <td className={tableClasses.td}>
                      {item.portCount}
                      <span className="text-slate-500"> {item.portType}</span>
                    </td>
                    <td className={tableClasses.td}>{item.installedCount}</td>
                    <td className={tableClasses.tdRight}>
                      {admin && (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            onClick={() => beginEdit(item)}
                            className="text-cyan-400 hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => remove(item)}
                            className="text-rose-300 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      <SectionCard
        title="Rack PDU templates"
        subtitle="Custom zero-U and rackmount PDUs with varying outlet socket banks (C13, C19, UK BS1363, Schuko, NEMA)"
        actions={
          <>
            <a href="/api/catalog?format=csv&kind=pdu" className={btnSecondary}>
              Export PDU CSV
            </a>
            {admin && (
              <>
                <label className={`cursor-pointer ${btnSecondary}`}>
                  Import PDU CSV
                  <input
                    type="file"
                    accept="text/csv,.csv"
                    className="hidden"
                    disabled={saving}
                    onChange={(event) => {
                      void importCsv(event.target.files?.[0], "pdu");
                      event.target.value = "";
                    }}
                  />
                </label>
                <button type="button" onClick={beginCreatePdu} className={btnPrimary}>
                  <Plus className="h-3.5 w-3.5" />
                  New PDU template
                </button>
              </>
            )}
          </>
        }
      >
        {pduTemplates.length === 0 ? (
          <div className="p-4 text-sm text-slate-400">
            No custom PDU templates yet. Click New PDU template to define socket banks for C13, C19, UK BS1363, Schuko, or NEMA outlets.
          </div>
        ) : (
          <div className={tableClasses.wrapper}>
            <table className={tableClasses.table}>
              <thead className={tableClasses.thead}>
                <tr>
                  <SortHeader label="Name" column="name" sortKey={pduSort.sortKey} sortDir={pduSort.sortDir} onSort={pduSort.toggleSort} />
                  <SortHeader label="Mounting" column="mounting" sortKey={pduSort.sortKey} sortDir={pduSort.sortDir} onSort={pduSort.toggleSort} />
                  <SortHeader label="Phase" column="phaseMode" sortKey={pduSort.sortKey} sortDir={pduSort.sortDir} onSort={pduSort.toggleSort} />
                  <SortHeader label="Rating" column="rating" sortKey={pduSort.sortKey} sortDir={pduSort.sortDir} onSort={pduSort.toggleSort} />
                  <SortHeader label="Input whip" column="inputPlug" sortKey={pduSort.sortKey} sortDir={pduSort.sortDir} onSort={pduSort.toggleSort} />
                  <SortHeader label="Socket banks" column="outlets" sortKey={pduSort.sortKey} sortDir={pduSort.sortDir} onSort={pduSort.toggleSort} />
                  <SortHeader label="Installed" column="installedCount" sortKey={pduSort.sortKey} sortDir={pduSort.sortDir} onSort={pduSort.toggleSort} />
                  <th className={tableClasses.thRight}> </th>
                </tr>
              </thead>
              <tbody className={tableClasses.tbody}>
                {pduSort.sorted.map((item) => {
                  const watts = pduMaxWatts(item.phaseMode, item.maxAmps, item.voltageV);
                  return (
                    <tr key={item.id} className={tableClasses.tr}>
                      <td className={tableClasses.td}>
                        <div className="font-semibold text-white">{applianceLabel(item)}</div>
                        <div className="text-slate-500">
                          {item.manufacturer} {item.model}
                        </div>
                      </td>
                      <td className={tableClasses.td}>
                        {item.mounting}
                        {item.mounting === "RACKMOUNT" ? ` (${item.uHeight}U)` : ""}
                      </td>
                      <td className={tableClasses.td}>{item.phaseMode}</td>
                      <td className={`${tableClasses.td} font-mono`}>
                        {item.maxAmps}A · {item.voltageV}V
                        <div className="text-[10px] text-slate-500">
                          {(watts / 1000).toFixed(1)} kW max
                        </div>
                      </td>
                      <td className={`${tableClasses.td} font-mono`}>{item.inputPlugType}</td>
                      <td className={tableClasses.td}>
                        <span className="font-medium text-amber-200">
                          {describeOutletSpecs(item.outletSpecs)}
                        </span>
                      </td>
                      <td className={tableClasses.td}>{item.installedCount}</td>
                      <td className={tableClasses.tdRight}>
                        {admin && (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              onClick={() => beginEditPdu(item)}
                              className="text-cyan-400 hover:underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removePdu(item)}
                              className="text-rose-300 hover:underline"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {admin && modalOpen && (
        <Modal
          title={editingId ? "Edit appliance" : "New appliance"}
          onClose={closeModal}
          wide
        >
          <AlertBanner error={error} />
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Name">
                <input
                  required
                  value={draft.name}
                  onChange={(event) => setField("name", event.target.value)}
                  placeholder="1U compute server"
                  className={inputClass}
                />
              </Field>
              <Field label="Manufacturer">
                <input
                  required
                  value={draft.manufacturer}
                  onChange={(event) => setField("manufacturer", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Model">
                <input
                  required
                  value={draft.model}
                  onChange={(event) => setField("model", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Type">
                <select
                  value={draft.deviceType}
                  onChange={(event) => setField("deviceType", event.target.value)}
                  className={inputClass}
                >
                  {APPLIANCE_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </Field>
              <Field label="Height (U)">
                <input
                  required
                  type="number"
                  min={1}
                  max={58}
                  value={draft.uHeight}
                  onChange={(event) => setField("uHeight", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Weight (kg)">
                <input
                  required
                  type="number"
                  min={0}
                  step="0.1"
                  value={draft.weightKg}
                  onChange={(event) => setField("weightKg", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Watts">
                <input
                  required
                  type="number"
                  min={0}
                  value={draft.defaultWatts}
                  onChange={(event) => setField("defaultWatts", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Peak watts">
                <input
                  required
                  type="number"
                  min={0}
                  value={draft.peakWatts}
                  onChange={(event) => setField("peakWatts", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="BTU/h">
                <input
                  required
                  type="number"
                  min={0}
                  value={draft.btuPerHour}
                  onChange={(event) => {
                    setBtuTouched(true);
                    setField("btuPerHour", event.target.value);
                  }}
                  className={inputClass}
                />
              </Field>
              <Field label="PSUs">
                <input
                  required
                  type="number"
                  min={0}
                  max={8}
                  value={draft.psuCount}
                  onChange={(event) => setField("psuCount", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Plug">
                <select
                  value={draft.psuPlugType}
                  onChange={(event) => setField("psuPlugType", event.target.value)}
                  className={inputClass}
                >
                  {PLUG_TYPES.map((plug) => (
                    <option key={plug}>{plug}</option>
                  ))}
                </select>
              </Field>
              <Field label="Ports">
                <input
                  required
                  type="number"
                  min={0}
                  max={256}
                  value={draft.portCount}
                  onChange={(event) => setField("portCount", event.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Port type">
                <select
                  value={draft.portType}
                  onChange={(event) => setField("portType", event.target.value)}
                  className={inputClass}
                >
                  {PORT_TYPES.map((port) => (
                    <option key={port}>{port}</option>
                  ))}
                </select>
              </Field>
            </div>
            <ModalFooter
              onCancel={closeModal}
              submitLabel={editingId ? "Save appliance" : "Add appliance"}
              saving={saving}
              hint="BTU/h follows watts until you edit it. 1 W is about 3.412 BTU/h."
            />
          </form>
        </Modal>
      )}

      {admin && pduModalOpen && (
        <Modal
          title={editingPduId ? "Edit PDU template" : "New PDU template"}
          onClose={closePduModal}
          wide
        >
          <AlertBanner error={error} />
          <form onSubmit={savePdu} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="PDU name">
                <input
                  required
                  value={pduDraft.name}
                  onChange={(e) => setPduDraft({ ...pduDraft, name: e.target.value })}
                  placeholder="Zero-U 32A Mixed C13/C19"
                  className={inputClass}
                />
              </Field>
              <Field label="Manufacturer">
                <input
                  required
                  value={pduDraft.manufacturer}
                  onChange={(e) => setPduDraft({ ...pduDraft, manufacturer: e.target.value })}
                  placeholder="APC / Raritan / ServerTech"
                  className={inputClass}
                />
              </Field>
              <Field label="Model">
                <input
                  required
                  value={pduDraft.model}
                  onChange={(e) => setPduDraft({ ...pduDraft, model: e.target.value })}
                  placeholder="AP8853"
                  className={inputClass}
                />
              </Field>
              <Field label="Mounting">
                <select
                  value={pduDraft.mounting}
                  onChange={(e) =>
                    setPduDraft({
                      ...pduDraft,
                      mounting: e.target.value,
                      uHeight:
                        e.target.value === "RACKMOUNT"
                          ? pduDraft.uHeight === "0"
                            ? "1"
                            : pduDraft.uHeight
                          : "0",
                    })
                  }
                  className={inputClass}
                >
                  {PDU_MOUNTING_TYPES.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </Field>
              {pduDraft.mounting === "RACKMOUNT" && (
                <Field label="Height (U)">
                  <input
                    required
                    type="number"
                    min={1}
                    max={4}
                    value={pduDraft.uHeight}
                    onChange={(e) => setPduDraft({ ...pduDraft, uHeight: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              )}
              <Field label="Phase mode">
                <select
                  value={pduDraft.phaseMode}
                  onChange={(e) => {
                    const phaseMode = e.target.value;
                    setPduDraft({
                      ...pduDraft,
                      phaseMode,
                      voltageV: phaseMode === "THREE_PHASE" ? "400" : "230",
                      inputPlugType:
                        phaseMode === "THREE_PHASE"
                          ? "IEC_60309_32A_3P"
                          : "IEC_60309_32A_1P",
                    });
                  }}
                  className={inputClass}
                >
                  {PDU_PHASE_MODES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Max amps">
                <input
                  required
                  type="number"
                  min={1}
                  max={125}
                  value={pduDraft.maxAmps}
                  onChange={(e) => setPduDraft({ ...pduDraft, maxAmps: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Voltage (V)">
                <input
                  required
                  type="number"
                  min={100}
                  max={480}
                  value={pduDraft.voltageV}
                  onChange={(e) => setPduDraft({ ...pduDraft, voltageV: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Input whip plug">
                <select
                  value={pduDraft.inputPlugType}
                  onChange={(e) =>
                    setPduDraft({ ...pduDraft, inputPlugType: e.target.value })
                  }
                  className={inputClass}
                >
                  {PDU_INPUT_PLUG_TYPES.map((plug) => (
                    <option key={plug} value={plug}>
                      {plug}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-950/60 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">
                    Socket banks ({pduDraft.banks.reduce((sum, b) => sum + Number(b.count || 0), 0)} total outlets)
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Combine different socket types (e.g. 12× C13 + 4× C19, or UK BS1363 / Schuko / NEMA banks).
                  </div>
                </div>
                <button
                  type="button"
                  onClick={addBank}
                  className={btnSecondary}
                >
                  <Plus className="h-3 w-3" /> Add socket bank
                </button>
              </div>

              <div className="space-y-2 pt-1">
                {pduDraft.banks.map((bank, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <select
                      aria-label={`Socket type ${index + 1}`}
                      value={bank.socketType}
                      onChange={(e) =>
                        updateBank(index, {
                          socketType: e.target.value as PduSocketType,
                        })
                      }
                      className={`${compactInputClass} flex-1`}
                    >
                      {PDU_SOCKET_TYPES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    <input
                      aria-label={`Socket count ${index + 1}`}
                      type="number"
                      min={1}
                      max={64}
                      value={bank.count}
                      onChange={(e) =>
                        updateBank(index, { count: Number(e.target.value) })
                      }
                      className={`${compactInputClass} w-24`}
                    />
                    <span className="text-xs text-slate-400">sockets</span>
                    {pduDraft.banks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeBank(index)}
                        className="rounded p-1 text-slate-400 hover:text-rose-300"
                        title="Remove bank"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <ModalFooter
              onCancel={closePduModal}
              submitLabel={editingPduId ? "Save PDU template" : "Add PDU template"}
              saving={saving}
              hint={`Max power: ${(
                pduMaxWatts(
                  pduDraft.phaseMode,
                  Number(pduDraft.maxAmps || 0),
                  Number(pduDraft.voltageV || 0)
                ) / 1000
              ).toFixed(1)} kW`}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

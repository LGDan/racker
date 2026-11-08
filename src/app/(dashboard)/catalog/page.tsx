"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Library, Plus } from "lucide-react";
import { useInfrastructure } from "@/components/layout/infrastructure-context";
import {
  APPLIANCE_TYPES,
  PLUG_TYPES,
  PORT_TYPES,
  applianceLabel,
  btuFromWatts,
  heatBtu,
} from "@/lib/appliance-catalog";
import {
  AlertBanner,
  Field,
  Modal,
  ModalFooter,
  PageHeader,
  SectionCard,
  btnPrimary,
  btnSecondary,
  inputClass,
  tableClasses,
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

export default function CatalogPage() {
  const { role } = useInfrastructure();
  const admin = role === "ADMIN";
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [btuTouched, setBtuTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  async function importCsv(file: File | undefined) {
    if (!file) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    const csv = await file.text();
    const res = await fetch("/api/catalog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "IMPORT_CSV", csv }),
    });
    const data = await res.json();
    setSaving(false);
    if (!res.ok) {
      setError(data.error || "Could not import the catalog");
      return;
    }
    const written = Number(data.written || 0);
    setNotice(written === 1 ? "Imported 1 appliance." : `Imported ${written} appliances.`);
    await load();
  }

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        kicker="Appliance Library & Specs"
        icon={<Library className="h-3.5 w-3.5" />}
        title="Appliance catalog"
        subtitle={
          <>
            Predefined gear for the rack install list. Choosing one fills in the name, type, height,
            power, PSUs, plug, and ports.{" "}
            <Link href="/racks" className="text-cyan-400 hover:underline">
              Open a rack
            </Link>{" "}
            and use Install device to apply one.
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
                      void importCsv(event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
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
          A blank id adds an appliance. An existing id updates that row. Leave BTU/h blank to fill it from watts.
        </p>
      )}

      {!modalOpen && <AlertBanner error={error} notice={notice} />}

      {appliances.length === 0 ? (
        <SectionCard padded>
          <p className="text-sm text-slate-400">The catalog is empty.</p>
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
                  <th className={tableClasses.th}>Name</th>
                  <th className={tableClasses.th}>Type</th>
                  <th className={tableClasses.th}>Height</th>
                  <th className={tableClasses.th}>Watts</th>
                  <th className={tableClasses.th}>BTU/h</th>
                  <th className={tableClasses.th}>PSUs</th>
                  <th className={tableClasses.th}>Plug</th>
                  <th className={tableClasses.th}>Ports</th>
                  <th className={tableClasses.th}>Installed</th>
                  <th className={tableClasses.thRight}> </th>
                </tr>
              </thead>
              <tbody className={tableClasses.tbody}>
                {appliances.map((item) => (
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
    </div>
  );
}

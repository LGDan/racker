"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ThermometerSnowflake } from "lucide-react";
import {
  AlertBanner,
  Field,
  Modal,
  ModalFooter,
  PageHeader,
  SectionCard,
  SortHeader,
  btnPrimary,
  compactInputClass,
  inputClass,
  tableClasses,
  useTableSort,
} from "@/components/ui/primitives";

interface CoolingUnitRow {
  id: string;
  roomId: string;
  roomName: string;
  siteName: string;
  name: string;
  unitType: string;
  capacityKw: number;
  airflowCfm: number;
  supplyTempC: number;
  returnTempC: number;
  powerDrawWatts: number;
  status: string;
  posX: number;
  posY: number;
}

interface RoomCoolingSummary {
  roomId: string;
  roomName: string;
  roomCode: string;
  siteName: string;
  itLoadKw: number;
  itHeatBtuHr: number;
  onlineCoolingKw: number;
  standbyCoolingKw: number;
  redundancyMode: string;
  thermalUtilizationPct: number;
  nPlusOneCompliant: boolean;
}

interface CoolingSnapshot {
  currentUser: { role: "ADMIN" | "STANDARD" };
  rooms: { id: string; name: string; code: string }[];
  capacity: {
    totals: {
      totalItKw: number;
      totalOnlineCoolingKw: number;
    };
    roomsCooling: RoomCoolingSummary[];
  };
}

interface UnitDraft {
  roomId: string;
  name: string;
  unitType: string;
  capacityKw: string;
  airflowCfm: string;
  supplyTempC: string;
  returnTempC: string;
  powerDrawWatts: string;
  status: string;
}

const COOLING_TYPES = ["CRAC", "CRAH", "IN_ROW", "AHU", "CHILLER"] as const;
const COOLING_STATUSES = ["ONLINE", "STANDBY", "MAINTENANCE", "FAULT"] as const;

const EMPTY_DRAFT: UnitDraft = {
  roomId: "",
  name: "",
  unitType: "CRAH",
  capacityKw: "45",
  airflowCfm: "14000",
  supplyTempC: "18.5",
  returnTempC: "27.0",
  powerDrawWatts: "6000",
  status: "ONLINE",
};

export default function CoolingPage() {
  const [snap, setSnap] = useState<CoolingSnapshot | null>(null);
  const [units, setUnits] = useState<CoolingUnitRow[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<UnitDraft>(EMPTY_DRAFT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const unitsSort = useTableSort(
    units,
    {
      name: (u) => u.name,
      unitType: (u) => u.unitType,
      roomName: (u) => u.roomName,
      capacityKw: (u) => u.capacityKw,
      airflowCfm: (u) => u.airflowCfm,
      temps: (u) => u.supplyTempC,
      location: (u) => (u.posX >= 1 && u.posY >= 1 ? `Tile ${u.posX},${u.posY}` : "Off plan"),
      status: (u) => u.status,
    },
    "name"
  );

  async function load() {
    const res = await fetch("/api/infrastructure");
    if (res.status === 401) {
      window.location.href = "/login";
      return;
    }
    const data = await res.json();
    setSnap(data);
    const list: CoolingUnitRow[] = [];
    for (const site of data.sites || []) {
      for (const b of site.buildings || []) {
        for (const f of b.floors || []) {
          for (const room of f.rooms || []) {
            for (const cu of room.coolingUnits || []) {
              list.push({
                ...cu,
                roomId: room.id,
                roomName: room.name,
                siteName: site.name,
              });
            }
          }
        }
      }
    }
    setUnits(list);
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
      await load();
      return true;
    } finally {
      setSaving(false);
    }
  }

  function beginCreate() {
    setEditingId(null);
    setDraft({
      ...EMPTY_DRAFT,
      roomId: snap?.rooms[0]?.id || "",
    });
    setError(null);
    setModalOpen(true);
  }

  function beginEdit(unit: CoolingUnitRow) {
    setEditingId(unit.id);
    setDraft({
      roomId: unit.roomId,
      name: unit.name,
      unitType: unit.unitType,
      capacityKw: String(unit.capacityKw),
      airflowCfm: String(unit.airflowCfm ?? 14000),
      supplyTempC: String(unit.supplyTempC ?? 18.5),
      returnTempC: String(unit.returnTempC ?? 27.0),
      powerDrawWatts: String(unit.powerDrawWatts ?? 6000),
      status: unit.status,
    });
    setError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingId(null);
  }

  async function removeUnit(unit: CoolingUnitRow) {
    if (!window.confirm(`Remove cooling unit ${unit.name}?`)) return;
    await mutate(
      { action: "DELETE_ITEM", targetType: "COOLING_UNIT", id: unit.id },
      `Removed ${unit.name}.`
    );
  }

  if (!snap) {
    return <div className="p-8 text-sm text-slate-400">Loading cooling and thermal plant…</div>;
  }

  const admin = snap.currentUser.role === "ADMIN";
  const onlineUnits = units.filter((u) => u.status === "ONLINE").length;
  const standbyUnits = units.filter((u) => u.status === "STANDBY").length;
  const headroomKw = Math.max(
    0,
    Math.round(
      (snap.capacity.totals.totalOnlineCoolingKw - snap.capacity.totals.totalItKw) * 10
    ) / 10
  );

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        kicker="Thermal Envelopes & HVAC Plant"
        icon={<ThermometerSnowflake className="h-3.5 w-3.5" />}
        title="Cooling and thermal management"
        subtitle={
          <>
            CRAC, CRAH, in-row coolers, air handling units, and chillers across data halls, with N+1 thermal margin tracking.
            {admin ? " Admins can add, edit, or decommission cooling units." : ""}
          </>
        }
        actions={
          admin ? (
            <button type="button" onClick={beginCreate} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" />
              Add cooling unit
            </button>
          ) : undefined
        }
      />

      {!modalOpen && <AlertBanner error={error} notice={notice} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Online cooling
          </div>
          <div className="mt-1 text-lg font-bold text-white">
            {snap.capacity.totals.totalOnlineCoolingKw} kW
          </div>
          <div className="text-[11px] text-slate-400">
            {onlineUnits} online · {standbyUnits} standby
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            IT heat load
          </div>
          <div className="mt-1 text-lg font-bold text-white">
            {snap.capacity.totals.totalItKw} kW
          </div>
          <div className="text-[11px] text-slate-400">
            {Math.round(snap.capacity.totals.totalItKw * 3412.14).toLocaleString()} BTU/h
          </div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Thermal headroom
          </div>
          <div className="mt-1 text-lg font-bold text-sky-300">{headroomKw} kW</div>
          <div className="text-[11px] text-slate-400">Available before saturation</div>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Data halls
          </div>
          <div className="mt-1 text-lg font-bold text-white">
            {snap.capacity.roomsCooling.length}
          </div>
          <div className="text-[11px] text-slate-400">
            {snap.capacity.roomsCooling.filter((r) => r.nPlusOneCompliant).length} N+1 compliant
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Room thermal envelopes</h2>
        <div className="grid gap-3 md:grid-cols-2">
          {snap.capacity.roomsCooling.map((room) => (
            <div
              key={room.roomId}
              className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 text-xs space-y-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Link
                    href={`/hierarchy?room=${room.roomId}`}
                    className="font-semibold text-white hover:text-cyan-300"
                  >
                    {room.roomName}
                  </Link>
                  <div className="text-[11px] text-slate-400">
                    {room.siteName} · Redundancy: {room.redundancyMode}
                  </div>
                </div>
                <span
                  className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                    room.nPlusOneCompliant
                      ? "border border-emerald-500/30 bg-emerald-500/15 text-emerald-300"
                      : "border border-rose-500/30 bg-rose-500/15 text-rose-300"
                  }`}
                >
                  {room.nPlusOneCompliant ? "N+1 SAFE" : "DEGRADED"}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-300">
                <span>
                  IT heat: <strong className="text-white">{room.itLoadKw} kW</strong> (
                  {room.itHeatBtuHr.toLocaleString()} BTU/h)
                </span>
                <span className="font-mono text-sky-300">
                  {room.onlineCoolingKw} kW online (+{room.standbyCoolingKw} kW standby)
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full bg-sky-400"
                  style={{ width: `${Math.min(100, room.thermalUtilizationPct)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <SectionCard
        title="Cooling units"
        subtitle={`${units.length} ${units.length === 1 ? "unit" : "units"} across all rooms`}
        actions={
          admin ? (
            <button type="button" onClick={beginCreate} className={btnPrimary}>
              <Plus className="h-3.5 w-3.5" />
              Add cooling unit
            </button>
          ) : undefined
        }
      >
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead className={tableClasses.thead}>
              <tr>
                <SortHeader label="Unit" column="name" sortKey={unitsSort.sortKey} sortDir={unitsSort.sortDir} onSort={unitsSort.toggleSort} />
                <SortHeader label="Type" column="unitType" sortKey={unitsSort.sortKey} sortDir={unitsSort.sortDir} onSort={unitsSort.toggleSort} />
                <SortHeader label="Room" column="roomName" sortKey={unitsSort.sortKey} sortDir={unitsSort.sortDir} onSort={unitsSort.toggleSort} />
                <SortHeader label="Capacity" column="capacityKw" sortKey={unitsSort.sortKey} sortDir={unitsSort.sortDir} onSort={unitsSort.toggleSort} />
                <SortHeader label="Airflow" column="airflowCfm" sortKey={unitsSort.sortKey} sortDir={unitsSort.sortDir} onSort={unitsSort.toggleSort} />
                <SortHeader label="Supply / Return" column="temps" sortKey={unitsSort.sortKey} sortDir={unitsSort.sortDir} onSort={unitsSort.toggleSort} />
                <SortHeader label="Placement" column="location" sortKey={unitsSort.sortKey} sortDir={unitsSort.sortDir} onSort={unitsSort.toggleSort} />
                <SortHeader label="Status" column="status" sortKey={unitsSort.sortKey} sortDir={unitsSort.sortDir} onSort={unitsSort.toggleSort} />
                {admin && <th className={tableClasses.thRight}> </th>}
              </tr>
            </thead>
            <tbody className={tableClasses.tbody}>
              {unitsSort.sorted.map((cu) => (
                <tr key={cu.id} className={tableClasses.tr}>
                  <td className={`${tableClasses.td} font-semibold text-white`}>{cu.name}</td>
                  <td className={tableClasses.td}>{cu.unitType}</td>
                  <td className={tableClasses.td}>
                    <Link
                      href={`/hierarchy?room=${cu.roomId}`}
                      className="text-cyan-300 hover:underline"
                    >
                      {cu.roomName}
                    </Link>
                  </td>
                  <td className={`${tableClasses.td} font-mono`}>{cu.capacityKw} kW</td>
                  <td className={`${tableClasses.td} font-mono`}>
                    {(cu.airflowCfm || 14000).toLocaleString()} CFM
                  </td>
                  <td className={`${tableClasses.td} font-mono`}>
                    {cu.supplyTempC ?? 18.5}°C / {cu.returnTempC ?? 27.0}°C
                  </td>
                  <td className={tableClasses.td}>
                    {cu.posX >= 1 && cu.posY >= 1 ? `Tile ${cu.posX},${cu.posY}` : "Off plan"}
                  </td>
                  <td className={tableClasses.td}>
                    {admin ? (
                      <select
                        aria-label={`Status for ${cu.name}`}
                        value={cu.status}
                        className={compactInputClass}
                        onChange={(e) =>
                          void mutate(
                            {
                              action: "TOGGLE_COOLING_STATUS",
                              id: cu.id,
                              status: e.target.value,
                            },
                            `Updated status for ${cu.name}.`
                          )
                        }
                      >
                        {COOLING_STATUSES.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-slate-400">{cu.status}</span>
                    )}
                  </td>
                  {admin && (
                    <td className={tableClasses.tdRight}>
                      <div className="flex justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => beginEdit(cu)}
                          className="text-cyan-400 hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeUnit(cu)}
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

      {admin && modalOpen && (
        <Modal
          title={editingId ? "Edit cooling unit" : "Add cooling unit"}
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
                  action: editingId ? "UPDATE_COOLING_UNIT" : "CREATE_COOLING_UNIT",
                  id: editingId,
                  roomId: draft.roomId,
                  name: draft.name,
                  unitType: draft.unitType,
                  capacityKw: draft.capacityKw,
                  airflowCfm: draft.airflowCfm,
                  supplyTempC: draft.supplyTempC,
                  returnTempC: draft.returnTempC,
                  powerDrawWatts: draft.powerDrawWatts,
                  status: draft.status,
                },
                editingId ? `Updated ${draft.name}.` : `Added ${draft.name}.`
              );
              if (ok) closeModal();
            }}
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Unit name">
                <input
                  required
                  placeholder="Unit name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Room">
                <select
                  value={draft.roomId}
                  onChange={(e) => setDraft({ ...draft, roomId: e.target.value })}
                  className={inputClass}
                >
                  {snap.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Unit type">
                <select
                  value={draft.unitType}
                  onChange={(e) => setDraft({ ...draft, unitType: e.target.value })}
                  className={inputClass}
                >
                  {COOLING_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="Capacity (kW)">
                <input
                  type="number"
                  step="any"
                  value={draft.capacityKw}
                  onChange={(e) => setDraft({ ...draft, capacityKw: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Airflow (CFM)">
                <input
                  type="number"
                  value={draft.airflowCfm}
                  onChange={(e) => setDraft({ ...draft, airflowCfm: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Status">
                <select
                  value={draft.status}
                  onChange={(e) => setDraft({ ...draft, status: e.target.value })}
                  className={inputClass}
                >
                  {COOLING_STATUSES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Supply temp (°C)">
                <input
                  type="number"
                  step="0.5"
                  value={draft.supplyTempC}
                  onChange={(e) => setDraft({ ...draft, supplyTempC: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Return temp (°C)">
                <input
                  type="number"
                  step="0.5"
                  value={draft.returnTempC}
                  onChange={(e) => setDraft({ ...draft, returnTempC: e.target.value })}
                  className={inputClass}
                />
              </Field>
              <Field label="Electrical draw (W)">
                <input
                  type="number"
                  value={draft.powerDrawWatts}
                  onChange={(e) => setDraft({ ...draft, powerDrawWatts: e.target.value })}
                  className={inputClass}
                />
              </Field>
            </div>
            <ModalFooter
              onCancel={closeModal}
              submitLabel={editingId ? "Save unit" : "Add unit"}
              saving={saving}
            />
          </form>
        </Modal>
      )}
    </div>
  );
}

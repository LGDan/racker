"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  GitBranch,
  Plus,
  ShieldAlert,
} from "lucide-react";
import {
  useInfrastructure,
  type PlanSummary,
} from "@/components/layout/infrastructure-context";
import {
  AlertBanner,
  Field,
  Modal,
  ModalFooter,
  PageHeader,
  SectionCard,
  SortHeader,
  btnDanger,
  btnPrimary,
  btnSecondary,
  compactInputClass,
  inputClass,
  tableClasses,
  useTableSort,
} from "@/components/ui/primitives";

interface PlanAlert {
  severity: "CRITICAL" | "WARNING" | "INFO";
  category: string;
  title: string;
  description: string;
}

interface PlanMetric {
  key: string;
  label: string;
  unit: string;
  opsValue: number;
  planValue: number;
  delta: number;
}

interface PlanChange {
  category: string;
  changeType: "ADDED" | "MODIFIED" | "REMOVED";
  id: string;
  name: string;
  location: string;
  summary: string;
  fieldsChanged: string[];
}

interface PlanComparison {
  plan: PlanSummary;
  summary: {
    totalChanges: number;
    addedCount: number;
    modifiedCount: number;
    removedCount: number;
    newIssuesCount: number;
    resolvedIssuesCount: number;
  };
  metrics: PlanMetric[];
  issues: {
    introduced: PlanAlert[];
    resolved: PlanAlert[];
    remaining: PlanAlert[];
  };
  changes: PlanChange[];
}

const CATEGORIES = [
  "All",
  "Sites & Buildings",
  "Floors & Rooms",
  "Rows & Racks",
  "Appliances",
  "Rack PDUs",
  "Power Chain",
  "Cooling",
  "Catalog",
] as const;

const CHANGE_TYPES = ["All", "ADDED", "MODIFIED", "REMOVED"] as const;

const RISK_KEYS = new Set(["spof", "overloaded", "usedU", "uPct", "itKw", "itWatts", "heatBtu", "usedOutlets"]);
const GAIN_KEYS = new Set(["freeU", "coolingKw", "headroomKw", "freeOutlets", "totalOutlets", "racks"]);

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatMetric(value: number, unit: string) {
  const abs = Math.abs(value);
  const formatted =
    unit === "%" || unit === "kW"
      ? abs.toLocaleString(undefined, { maximumFractionDigits: 2 })
      : Math.round(abs).toLocaleString();
  return unit === "%" ? `${formatted}%` : `${formatted} ${unit}`;
}

function deltaBadge(metric: PlanMetric) {
  if (metric.delta === 0) {
    return <span className="rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-400">No change</span>;
  }
  const worse = RISK_KEYS.has(metric.key) && metric.delta > 0;
  const better = GAIN_KEYS.has(metric.key) && metric.delta > 0;
  const invertedBetter = RISK_KEYS.has(metric.key) && metric.delta < 0;
  const invertedWorse = GAIN_KEYS.has(metric.key) && metric.delta < 0;
  const positive = better || invertedBetter;
  const negative = worse || invertedWorse;
  const cls = positive
    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-200"
    : negative
      ? "border-rose-500/40 bg-rose-500/15 text-rose-200"
      : "border-amber-500/40 bg-amber-500/15 text-amber-200";
  const sign = metric.delta > 0 ? "+" : "−";
  return (
    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {sign}
      {formatMetric(metric.delta, metric.unit)}
    </span>
  );
}

function statusBadge(status: string) {
  if (status === "DRAFT") {
    return (
      <span className="rounded border border-violet-500/40 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-200">
        Draft
      </span>
    );
  }
  if (status === "APPLIED") {
    return (
      <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-200">
        Applied
      </span>
    );
  }
  return (
    <span className="rounded border border-slate-600 bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-300">
      {status}
    </span>
  );
}

function changeBadge(type: PlanChange["changeType"]) {
  if (type === "ADDED") {
    return (
      <span className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-200">
        Added
      </span>
    );
  }
  if (type === "REMOVED") {
    return (
      <span className="rounded border border-rose-500/40 bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-bold text-rose-200">
        Removed
      </span>
    );
  }
  return (
    <span className="rounded border border-amber-500/40 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
      Modified
    </span>
  );
}

async function postPlan(body: Record<string, unknown>) {
  const res = await fetch("/api/plans", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Plan action failed");
  return data;
}

export default function PlansPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-slate-400">Loading plans…</div>}>
      <PlansWorkspace />
    </Suspense>
  );
}

function PlansWorkspace() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { accountRole, activePlan, plans, refresh } = useInfrastructure();
  const compareId = searchParams.get("compare") || "";
  const wantNew = searchParams.get("new") === "1";
  const isAdmin = accountRole === "ADMIN";

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [createOpen, setCreateOpen] = useState(wantNew);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [activateOnCreate, setActivateOnCreate] = useState(true);
  const [confirm, setConfirm] = useState<
    | { action: "DELETE" | "REBASE" | "APPLY"; plan: PlanSummary }
    | null
  >(null);
  const [comparison, setComparison] = useState<PlanComparison | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [changeType, setChangeType] = useState<(typeof CHANGE_TYPES)[number]>("All");
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("All");

  useEffect(() => {
    setCreateOpen(wantNew);
  }, [wantNew]);

  const loadCompare = useCallback(async (planId: string) => {
    setCompareLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${planId}/compare`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not compare plan");
      setComparison(data.comparison);
    } catch (err) {
      setComparison(null);
      setError(err instanceof Error ? err.message : "Could not compare plan");
    } finally {
      setCompareLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!compareId) {
      setComparison(null);
      return;
    }
    loadCompare(compareId);
  }, [compareId, loadCompare]);

  const filteredChanges = useMemo(() => {
    const rows = comparison?.changes || [];
    return rows.filter((row) => {
      if (changeType !== "All" && row.changeType !== changeType) return false;
      if (category !== "All" && row.category !== category) return false;
      return true;
    });
  }, [comparison, changeType, category]);

  const changeSort = useTableSort(
    filteredChanges,
    {
      changeType: (row) => row.changeType,
      category: (row) => row.category,
      name: (row) => row.name,
      location: (row) => row.location,
      summary: (row) => row.summary,
    },
    "changeType"
  );

  const planSort = useTableSort(
    plans,
    {
      name: (plan) => plan.name,
      status: (plan) => plan.status,
      author: (plan) => plan.createdByName,
      updated: (plan) => plan.updatedAt,
      created: (plan) => plan.createdAt || plan.baseExportedAt,
    },
    "updated",
    "desc"
  );

  async function afterChange() {
    await refresh();
    router.refresh();
  }

  async function createPlan(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await postPlan({
        action: "CREATE",
        name,
        description,
        activate: activateOnCreate,
      });
      setCreateOpen(false);
      setName("");
      setDescription("");
      setNotice(`Created plan “${name.trim()}”.`);
      router.replace("/plans");
      await afterChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create plan");
    } finally {
      setSaving(false);
    }
  }

  async function activate(planId: string | null) {
    setSaving(true);
    setError(null);
    try {
      await postPlan(planId ? { action: "ACTIVATE", planId } : { action: "EXIT_PLAN" });
      setNotice(planId ? "Plan Mode activated." : "Returned to Ops Mode.");
      await afterChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch mode");
    } finally {
      setSaving(false);
    }
  }

  async function runConfirm() {
    if (!confirm) return;
    setSaving(true);
    setError(null);
    try {
      if (confirm.action === "DELETE") {
        await postPlan({ action: "DELETE", planId: confirm.plan.id });
        setNotice(`Deleted plan “${confirm.plan.name}”.`);
        if (compareId === confirm.plan.id) router.replace("/plans");
      } else if (confirm.action === "REBASE") {
        await postPlan({ action: "REBASE", planId: confirm.plan.id });
        setNotice(`Synced “${confirm.plan.name}” from live Ops.`);
        if (compareId === confirm.plan.id) await loadCompare(confirm.plan.id);
      } else {
        await postPlan({ action: "APPLY", planId: confirm.plan.id });
        setNotice(`Applied “${confirm.plan.name}” to Ops production.`);
        router.replace("/plans");
      }
      setConfirm(null);
      await afterChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Plan action failed");
    } finally {
      setSaving(false);
    }
  }

  const comparePlan = plans.find((plan) => plan.id === compareId) || comparison?.plan;

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <PageHeader
        kicker="What-if Planning"
        icon={<GitBranch className="h-3.5 w-3.5" />}
        title={compareId ? `Compare ${comparePlan?.name || "plan"} with Ops` : "Infrastructure plans"}
        subtitle={
          compareId
            ? "Capacity deltas, warnings introduced or resolved, and a field-level ledger of additions, modifications, and removals against live Ops."
            : "Clone live Ops into an isolated plan, activate it to edit a private copy, then compare and apply the result back to production."
        }
        actions={
          compareId ? (
            <Link href="/plans" className={btnSecondary}>
              Back to plans
            </Link>
          ) : (
            <button type="button" className={btnPrimary} onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              New Plan
            </button>
          )
        }
      />

      <AlertBanner error={error} notice={notice} />

      {compareId ? (
        compareLoading || !comparison ? (
          <div className="text-sm text-slate-400">
            {compareLoading ? "Comparing plan against live Ops…" : "No comparison available."}
          </div>
        ) : (
          <CompareView
            comparison={comparison}
            changeType={changeType}
            category={category}
            onChangeType={setChangeType}
            onCategory={setCategory}
            sortedChanges={changeSort.sorted}
            sortKey={changeSort.sortKey}
            sortDir={changeSort.sortDir}
            onSort={changeSort.toggleSort}
          />
        )
      ) : (
        <SectionCard
          title="Plans directory"
          subtitle={`${plans.length} plan${plans.length === 1 ? "" : "s"} · ${
            activePlan ? `active: ${activePlan.name}` : "Ops Mode"
          }`}
        >
          <div className={tableClasses.wrapper}>
            <table className={tableClasses.table}>
              <thead className={tableClasses.thead}>
                <tr>
                  <SortHeader label="Plan" column="name" sortKey={planSort.sortKey} sortDir={planSort.sortDir} onSort={planSort.toggleSort} />
                  <SortHeader label="Status" column="status" sortKey={planSort.sortKey} sortDir={planSort.sortDir} onSort={planSort.toggleSort} />
                  <SortHeader label="Author" column="author" sortKey={planSort.sortKey} sortDir={planSort.sortDir} onSort={planSort.toggleSort} />
                  <SortHeader label="Updated" column="updated" sortKey={planSort.sortKey} sortDir={planSort.sortDir} onSort={planSort.toggleSort} />
                  <th className={tableClasses.th}>Active</th>
                  <th className={tableClasses.th}>Actions</th>
                </tr>
              </thead>
              <tbody className={tableClasses.tbody}>
                {planSort.sorted.length === 0 && (
                  <tr>
                    <td className={tableClasses.td} colSpan={6}>
                      No plans yet. Create one to clone the current Ops facility into an isolated workspace.
                    </td>
                  </tr>
                )}
                {planSort.sorted.map((plan) => {
                  const isActive = activePlan?.id === plan.id;
                  const draft = plan.status === "DRAFT";
                  return (
                    <tr key={plan.id} className={tableClasses.tr}>
                      <td className={tableClasses.td}>
                        <div className="font-semibold text-white">{plan.name}</div>
                        {plan.description && (
                          <div className="mt-0.5 max-w-md text-[11px] text-slate-500">{plan.description}</div>
                        )}
                      </td>
                      <td className={tableClasses.td}>{statusBadge(plan.status)}</td>
                      <td className={tableClasses.td}>
                        <div>{plan.createdByName}</div>
                        <div className="text-[11px] text-slate-500">{formatWhen(plan.createdAt || plan.baseExportedAt)}</div>
                      </td>
                      <td className={tableClasses.td}>{formatWhen(plan.updatedAt)}</td>
                      <td className={tableClasses.td}>
                        {isActive ? (
                          <span className="rounded border border-violet-500/40 bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-bold text-violet-200">
                            This session
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className={tableClasses.td}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {draft && (
                            <button
                              type="button"
                              className={btnSecondary}
                              disabled={saving || isActive}
                              onClick={() => activate(plan.id)}
                            >
                              {isActive ? "Active" : "Activate in Plan Mode"}
                            </button>
                          )}
                          {isActive && (
                            <button
                              type="button"
                              className={btnSecondary}
                              disabled={saving}
                              onClick={() => activate(null)}
                            >
                              Exit to Ops
                            </button>
                          )}
                          <Link href={`/plans?compare=${plan.id}`} className={btnSecondary}>
                            Compare with Ops
                          </Link>
                          {draft && (
                            <button
                              type="button"
                              className={btnSecondary}
                              disabled={saving}
                              onClick={() => setConfirm({ action: "REBASE", plan })}
                            >
                              Sync from Ops
                            </button>
                          )}
                          {draft && isAdmin && (
                            <button
                              type="button"
                              className={btnPrimary}
                              disabled={saving}
                              onClick={() => setConfirm({ action: "APPLY", plan })}
                            >
                              Apply to Ops
                            </button>
                          )}
                          <button
                            type="button"
                            className={btnDanger}
                            disabled={saving}
                            onClick={() => setConfirm({ action: "DELETE", plan })}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </SectionCard>
      )}

      {createOpen && (
        <Modal title="Create infrastructure plan" onClose={() => setCreateOpen(false)}>
          <form onSubmit={createPlan} className="space-y-4">
            <Field label="Plan name">
              <input
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Hall 2 expansion Q3"
                required
              />
            </Field>
            <Field label="Description" hint="Optional context for other operators who activate this plan.">
              <textarea
                className={inputClass}
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Add racks in row 3 and restack the GPU cluster."
              />
            </Field>
            <label className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={activateOnCreate}
                onChange={(event) => setActivateOnCreate(event.target.checked)}
              />
              Activate this plan immediately after cloning Ops
            </label>
            <ModalFooter
              onCancel={() => setCreateOpen(false)}
              submitLabel={saving ? "Cloning Ops…" : "Create plan"}
              saving={saving}
              hint="Clones the live production facility into an isolated schema."
            />
          </form>
        </Modal>
      )}

      {confirm && (
        <Modal
          title={
            confirm.action === "APPLY"
              ? "Apply plan to Ops"
              : confirm.action === "REBASE"
                ? "Sync plan from Ops"
                : "Delete plan"
          }
          onClose={() => setConfirm(null)}
        >
          <p className="text-xs text-slate-300">
            {confirm.action === "APPLY" &&
              `This replaces live Ops infrastructure with “${confirm.plan.name}”. Users, media, and plan records stay in place. You will be returned to Ops Mode.`}
            {confirm.action === "REBASE" &&
              `This discards every change in “${confirm.plan.name}” and re-clones the current Ops production state.`}
            {confirm.action === "DELETE" &&
              `This permanently drops the isolated schema for “${confirm.plan.name}”. Live Ops is not changed.`}
          </p>
          <div className="flex justify-end gap-2 border-t border-slate-800 pt-3">
            <button type="button" className={btnSecondary} onClick={() => setConfirm(null)}>
              Cancel
            </button>
            <button
              type="button"
              className={confirm.action === "APPLY" ? btnPrimary : btnDanger}
              disabled={saving}
              onClick={runConfirm}
            >
              {saving
                ? "Working…"
                : confirm.action === "APPLY"
                  ? "Apply to Ops"
                  : confirm.action === "REBASE"
                    ? "Sync from Ops"
                    : "Delete plan"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function CompareView({
  comparison,
  changeType,
  category,
  onChangeType,
  onCategory,
  sortedChanges,
  sortKey,
  sortDir,
  onSort,
}: {
  comparison: PlanComparison;
  changeType: (typeof CHANGE_TYPES)[number];
  category: (typeof CATEGORIES)[number];
  onChangeType: (value: (typeof CHANGE_TYPES)[number]) => void;
  onCategory: (value: (typeof CATEGORIES)[number]) => void;
  sortedChanges: PlanChange[];
  sortKey: string | null;
  sortDir: "asc" | "desc";
  onSort: (column: string) => void;
}) {
  const { summary, metrics, issues } = comparison;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryStat label="Total changes" value={summary.totalChanges} />
        <SummaryStat label="Added" value={summary.addedCount} tone="emerald" />
        <SummaryStat label="Modified" value={summary.modifiedCount} tone="amber" />
        <SummaryStat label="Removed" value={summary.removedCount} tone="rose" />
      </div>

      <SectionCard title="Capacity deltas" subtitle="Ops (before) versus this plan (after)">
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div
              key={metric.key}
              className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
            >
              <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                {metric.label}
              </div>
              <div className="mt-2 flex items-end justify-between gap-2">
                <div>
                  <div className="text-lg font-bold text-white">
                    {formatMetric(metric.planValue, metric.unit)}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Ops {formatMetric(metric.opsValue, metric.unit)}
                  </div>
                </div>
                {deltaBadge(metric)}
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Warnings & advisories impact"
        subtitle={`${issues.introduced.length} introduced · ${issues.resolved.length} resolved · ${issues.remaining.length} remaining`}
      >
        <div className="grid gap-4 p-4 lg:grid-cols-3">
          <IssueColumn
            title="Introduced by plan"
            icon={<ShieldAlert className="h-3.5 w-3.5 text-rose-300" />}
            empty="This plan does not add new warnings."
            items={issues.introduced}
            tone="rose"
          />
          <IssueColumn
            title="Resolved vs Ops"
            icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />}
            empty="No existing Ops warnings are cleared."
            items={issues.resolved}
            tone="emerald"
          />
          <IssueColumn
            title="Still present"
            icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-300" />}
            empty="No shared warnings remain."
            items={issues.remaining}
            tone="amber"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Changes ledger"
        subtitle="Field-level additions, modifications, and removals"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className={compactInputClass}
              value={changeType}
              onChange={(event) => onChangeType(event.target.value as (typeof CHANGE_TYPES)[number])}
            >
              {CHANGE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type === "All" ? "All changes" : type === "ADDED" ? "Added" : type === "REMOVED" ? "Removed" : "Modified"}
                </option>
              ))}
            </select>
            <select
              className={compactInputClass}
              value={category}
              onChange={(event) => onCategory(event.target.value as (typeof CATEGORIES)[number])}
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item === "All" ? "All categories" : item}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className={tableClasses.wrapper}>
          <table className={tableClasses.table}>
            <thead className={tableClasses.thead}>
              <tr>
                <SortHeader label="Change" column="changeType" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHeader label="Category" column="category" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHeader label="Name" column="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHeader label="Location" column="location" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortHeader label="Summary" column="summary" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody className={tableClasses.tbody}>
              {sortedChanges.length === 0 && (
                <tr>
                  <td className={tableClasses.td} colSpan={5}>
                    No changes match the current filters.
                  </td>
                </tr>
              )}
              {sortedChanges.map((row) => (
                <tr key={`${row.changeType}-${row.category}-${row.id}`} className={tableClasses.tr}>
                  <td className={tableClasses.td}>{changeBadge(row.changeType)}</td>
                  <td className={tableClasses.td}>{row.category}</td>
                  <td className={tableClasses.td}>
                    <div className="font-medium text-white">{row.name}</div>
                  </td>
                  <td className={tableClasses.td}>{row.location}</td>
                  <td className={tableClasses.td}>
                    <div>{row.summary}</div>
                    {row.fieldsChanged.length > 1 && (
                      <div className="mt-1 text-[11px] text-slate-500">
                        {row.fieldsChanged.join(" · ")}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "emerald" | "amber" | "rose";
}) {
  const color =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : tone === "rose"
          ? "text-rose-300"
          : "text-white";
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
      <div className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}

function IssueColumn({
  title,
  icon,
  empty,
  items,
  tone,
}: {
  title: string;
  icon: React.ReactNode;
  empty: string;
  items: PlanAlert[];
  tone: "rose" | "emerald" | "amber";
}) {
  const border =
    tone === "rose"
      ? "border-rose-500/30"
      : tone === "emerald"
        ? "border-emerald-500/30"
        : "border-amber-500/30";
  return (
    <div className={`rounded-xl border bg-slate-950/40 p-3 ${border}`}>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-white">
        {icon}
        {title}
        <span className="ml-auto text-[11px] font-normal text-slate-500">{items.length}</span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-slate-500">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, index) => (
            <li key={`${item.title}-${index}`} className="rounded-lg border border-slate-800 bg-slate-900/80 p-2">
              <div className="text-[11px] font-semibold text-slate-200">{item.title}</div>
              <div className="mt-0.5 text-[11px] text-slate-500">{item.description}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

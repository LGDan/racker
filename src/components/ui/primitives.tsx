import React, { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDir = "asc" | "desc";

export function useTableSort<T>(
  rows: readonly T[],
  getters: Record<string, (row: T) => string | number | boolean | null | undefined>,
  defaultKey?: string,
  defaultDir: SortDir = "asc"
) {
  const [sortKey, setSortKey] = useState<string | null>(defaultKey ?? null);
  const [sortDir, setSortDir] = useState<SortDir>(defaultDir);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = useMemo(() => {
    if (!sortKey || !getters[sortKey]) return [...rows];
    const get = getters[sortKey];
    const dir = sortDir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "number" && typeof vb === "number") {
        return (va - vb) * dir;
      }
      if (typeof va === "boolean" && typeof vb === "boolean") {
        return (Number(va) - Number(vb)) * dir;
      }
      return (
        String(va).localeCompare(String(vb), undefined, {
          numeric: true,
          sensitivity: "base",
        }) * dir
      );
    });
  }, [rows, getters, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggleSort };
}

export function SortHeader({
  label,
  column,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: React.ReactNode;
  column: string;
  sortKey: string | null;
  sortDir: SortDir;
  onSort: (column: string) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === column;
  const Icon = !active ? ArrowUpDown : sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
      className={align === "right" ? tableClasses.thRight : tableClasses.th}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-white ${
          active ? "text-cyan-300" : "text-slate-400"
        } ${align === "right" ? "ml-auto" : ""}`}
      >
        <span>{label}</span>
        <Icon className={`h-3 w-3 shrink-0 ${active ? "text-cyan-400" : "opacity-50"}`} />
      </button>
    </th>
  );
}

export const inputClass =
  "mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white";

export const compactInputClass =
  "rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-1.5 text-xs text-white";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:opacity-50";

export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-800 disabled:opacity-50";

export const btnDanger =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-semibold text-rose-200 transition-colors hover:bg-rose-500/25 disabled:opacity-50";

export const tableClasses = {
  wrapper: "overflow-x-auto",
  table: "w-full min-w-[560px] border-collapse text-left text-xs",
  thead:
    "border-b border-slate-800 bg-slate-950/60 text-[11px] font-semibold uppercase tracking-wider text-slate-400",
  th: "px-4 py-2.5 font-semibold",
  thRight: "px-4 py-2.5 text-right font-semibold",
  tbody: "divide-y divide-slate-800/80 text-xs",
  tr: "transition-colors hover:bg-slate-800/40",
  td: "px-4 py-3 text-slate-300",
  tdRight: "px-4 py-3 text-right",
};

export function PageHeader({
  crumbs,
  kicker,
  icon,
  title,
  subtitle,
  actions,
  children,
}: {
  crumbs?: React.ReactNode;
  kicker?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-4 border-b border-slate-800 pb-5">
      {crumbs}
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          {kicker && (
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">
              {icon}
              {kicker}
            </div>
          )}
          <h1 className="mt-1 text-2xl font-bold text-white">{title}</h1>
          {subtitle && <div className="mt-1 max-w-3xl text-xs text-slate-400">{subtitle}</div>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function SectionCard({
  title,
  subtitle,
  actions,
  padded = false,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  padded?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/80">
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-white">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-[11px] text-slate-400">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      {padded ? <div className="p-4">{children}</div> : children}
    </section>
  );
}

export function Modal({
  title,
  onClose,
  wide = false,
  children,
}: {
  title: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={`max-h-[90vh] w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-2xl space-y-4 ${
          wide ? "max-w-2xl" : "max-w-md"
        }`}
      >
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xs text-slate-400 hover:text-white"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ModalFooter({
  onCancel,
  submitLabel,
  saving,
  hint,
}: {
  onCancel: () => void;
  submitLabel: string;
  saving?: boolean;
  hint?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
      <div className="text-[11px] text-slate-500">{hint}</div>
      <div className="flex items-center gap-2 ml-auto">
        <button type="button" onClick={onCancel} className={btnSecondary}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={btnPrimary}>
          {saving ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}

export function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block text-xs font-medium text-slate-300 ${className}`}>
      {label}
      {children}
      {hint && <span className="mt-1 block font-normal text-[11px] text-slate-500">{hint}</span>}
    </label>
  );
}

export function AlertBanner({
  error,
  notice,
}: {
  error?: string | null;
  notice?: string | null;
}) {
  if (!error && !notice) return null;
  return (
    <div className="space-y-2">
      {error && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-200">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-3 py-2 text-xs text-emerald-200">
          {notice}
        </div>
      )}
    </div>
  );
}

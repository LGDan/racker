import type { ReactNode } from "react";
import Link from "next/link";
import type { CapacityRollup, Crumb } from "./model";

export function LocationFrame({
  crumbs,
  kicker,
  title,
  subtitle,
  rollup,
  onEdit,
  children,
}: {
  crumbs: Crumb[];
  kicker: string;
  title: string;
  subtitle?: string;
  rollup: CapacityRollup;
  onEdit?: () => void;
  children: ReactNode;
}) {
  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="space-y-4 border-b border-slate-800 pb-5">
        <LocationCrumbs crumbs={crumbs} />
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest text-cyan-400">
              {kicker}
            </div>
            <h1 className="mt-1 text-2xl font-bold text-white">{title}</h1>
            {subtitle && <p className="mt-1 text-xs text-slate-400">{subtitle}</p>}
          </div>
          {onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              Edit
            </button>
          )}
        </div>
        <CapacityStrip rollup={rollup} />
      </div>
      {children}
    </div>
  );
}

export function LocationCrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Location" className="flex flex-wrap items-center gap-1 text-xs text-slate-400">
      {crumbs.map((crumb, index) => (
        <span key={`${crumb.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && <span className="text-slate-600">/</span>}
          {crumb.href ? (
            <Link href={crumb.href} className="hover:text-cyan-300">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-slate-200">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function CapacityStrip({ rollup }: { rollup: CapacityRollup }) {
  const figures = [
    ["Racks", String(rollup.rackCount)],
    ["Used U", `${rollup.usedU}/${rollup.totalU}`],
    ["IT load", `${rollup.itKw} kW`],
    ["Online cooling", `${rollup.onlineCoolingKw} kW`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {figures.map((figure) => (
        <div key={figure[0]} className="rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {figure[0]}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-white">{figure[1]}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Meter({ used, total }: { used: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${pct}%` }} />
    </div>
  );
}

"use client";

import Link from "next/link";
import { useInfrastructure } from "@/components/layout/infrastructure-context";
import { SectionCard, tableClasses } from "@/components/ui/primitives";
import { LocationFrame, Meter } from "./LocationFrame";
import { LocationMediaGallery } from "./LocationMedia";
import {
  containmentLabel,
  crumbsFor,
  findChain,
  holdsIfOneUnitFails,
  onlineCoolingKwFor,
  orientationLabel,
  rollupRooms,
  roomItKw,
  roomTypeLabel,
  sortRooms,
  supplyTypeLabel,
} from "./model";

function useLocation(kind: "site" | "building" | "floor" | "row", id: string) {
  const infra = useInfrastructure();
  const chain = findChain(infra.sites, kind, id);
  return { ...infra, chain };
}

export function SiteView({ siteId }: { siteId: string }) {
  const { loading, role, sites, rackMetrics, powerSources, openEdit, chain } = useLocation(
    "site",
    siteId
  );
  if (loading && sites.length === 0) {
    return <div className="p-8 text-sm text-slate-400">Loading location…</div>;
  }
  if (!chain?.site) {
    return <div className="p-8 text-sm text-slate-400">That location is not in the tree.</div>;
  }
  const site = chain.site;
  const rooms = site.buildings.flatMap((building) =>
    building.floors.flatMap((floor) => floor.rooms)
  );
  const rollup = rollupRooms(rooms, rackMetrics);
  const place = [site.address, site.city, site.country].filter(Boolean).join(", ");
  const share =
    site.utilityCapacityKw > 0
      ? Math.round((rollup.itKw / site.utilityCapacityKw) * 1000) / 10
      : 0;
  const supplies = powerSources
    .filter((source) => source.siteId === site.id)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <LocationFrame
      crumbs={crumbsFor(chain, "site")}
      kicker="Site"
      title={site.name}
      subtitle={[site.code, place].filter(Boolean).join(" · ")}
      rollup={rollup}
      onEdit={role === "ADMIN" ? () => openEdit("SITE", site.id) : undefined}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <figure className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <figcaption className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            Utility capacity
          </figcaption>
          <p className="mt-1 text-sm font-semibold text-white">{site.utilityCapacityKw} kW</p>
          <p className="mt-1 text-xs text-slate-400">IT load is {share}% of utility capacity.</p>
        </figure>
        <figure className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <figcaption className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            IT load
          </figcaption>
          <p className="mt-1 text-sm font-semibold text-white">{rollup.itKw} kW</p>
        </figure>
        <figure className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3">
          <figcaption className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            PUE target
          </figcaption>
          <p className="mt-1 text-sm font-semibold text-white">{Number(site.pueTarget).toFixed(2)}</p>
        </figure>
      </div>

      <LocationMediaGallery ownerType="SITE" ownerId={site.id} admin={role === "ADMIN"} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Buildings</h2>
        {site.buildings.length === 0 ? (
          <p className="text-sm text-slate-400">This site has no buildings yet.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {site.buildings.map((building) => {
              const buildingRooms = building.floors.flatMap((floor) => floor.rooms);
              const buildingRollup = rollupRooms(buildingRooms, rackMetrics);
              const roomCount = buildingRooms.length;
              return (
                <Link
                  key={building.id}
                  href={`/buildings/${building.id}`}
                  className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 hover:border-cyan-500/40"
                >
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-white">{building.name}</h3>
                    <span className="text-[10px] font-bold text-cyan-300">{building.code}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">
                    {building.floors.length} floors · {roomCount} rooms
                  </p>
                  <p className="mt-1 text-xs text-slate-300">
                    {buildingRollup.itKw} kW · {buildingRollup.usedU}/{buildingRollup.totalU} U
                  </p>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-white">Power sources</h2>
        {supplies.length === 0 ? (
          <p className="text-sm text-slate-400">This site has no power sources yet.</p>
        ) : (
          <SectionCard>
            <div className={tableClasses.wrapper}>
              <table className={tableClasses.table}>
                <thead className={tableClasses.thead}>
                  <tr>
                    <th className={tableClasses.th}>Name</th>
                    <th className={tableClasses.th}>Type</th>
                    <th className={tableClasses.th}>Group</th>
                    <th className={tableClasses.th}>Status</th>
                    <th className={tableClasses.th}>Capacity</th>
                    <th className={tableClasses.th}>Load</th>
                  </tr>
                </thead>
                <tbody className={tableClasses.tbody}>
                  {supplies.map((source) => (
                    <tr key={source.id} className={tableClasses.tr}>
                      <td className={`${tableClasses.td} font-medium text-white`}>{source.name}</td>
                      <td className={tableClasses.td}>{supplyTypeLabel(source.sourceType)}</td>
                      <td className={tableClasses.td}>{source.redundancyGroup}</td>
                      <td className={tableClasses.td}>{source.status}</td>
                      <td className={tableClasses.td}>{source.capacityKw} kW</td>
                      <td className={tableClasses.td}>
                        {source.loadKw} kW ({source.loadPct}%)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        )}
      </section>
    </LocationFrame>
  );
}

export function BuildingView({ buildingId }: { buildingId: string }) {
  const { loading, role, sites, rackMetrics, openEdit, chain } = useLocation(
    "building",
    buildingId
  );
  if (loading && sites.length === 0) {
    return <div className="p-8 text-sm text-slate-400">Loading location…</div>;
  }
  if (!chain?.building) {
    return <div className="p-8 text-sm text-slate-400">That location is not in the tree.</div>;
  }
  const building = chain.building;
  const rooms = building.floors.flatMap((floor) => floor.rooms);
  const floors = building.floors.slice().sort((a, b) => b.levelNumber - a.levelNumber);

  return (
    <LocationFrame
      crumbs={crumbsFor(chain, "building")}
      kicker="Building"
      title={building.name}
      subtitle={building.code}
      rollup={rollupRooms(rooms, rackMetrics)}
      onEdit={role === "ADMIN" ? () => openEdit("BUILDING", building.id) : undefined}
    >
      <LocationMediaGallery ownerType="BUILDING" ownerId={building.id} admin={role === "ADMIN"} />
      {floors.length === 0 ? (
        <p className="text-sm text-slate-400">This building has no floors yet.</p>
      ) : (
        <div className="space-y-3">
          {floors.map((floor) => (
            <section key={floor.id} className="rounded-xl border border-slate-800 bg-slate-900/80 p-4">
              <Link
                href={`/floors/${floor.id}`}
                className="text-sm font-semibold text-white hover:text-cyan-300"
              >
                Level {floor.levelNumber}: {floor.name}
              </Link>
              {floor.rooms.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No rooms on this level.</p>
              ) : (
                <div className="mt-3 flex flex-wrap gap-2">
                  {floor.rooms.map((room) => {
                    const rackCount = room.rows.reduce((count, row) => count + row.racks.length, 0);
                    return (
                      <Link
                        key={room.id}
                        href={`/hierarchy?room=${room.id}`}
                        className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 hover:border-cyan-500/40"
                      >
                        <span className="block text-xs font-semibold text-white">{room.name}</span>
                        <span className="text-[11px] text-slate-400">
                          {roomItKw(room, rackMetrics)} kW · {rackCount} racks
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </LocationFrame>
  );
}

export function FloorView({ floorId }: { floorId: string }) {
  const { loading, role, sites, rackMetrics, openEdit, chain } = useLocation("floor", floorId);
  if (loading && sites.length === 0) {
    return <div className="p-8 text-sm text-slate-400">Loading location…</div>;
  }
  if (!chain?.floor) {
    return <div className="p-8 text-sm text-slate-400">That location is not in the tree.</div>;
  }
  const floor = chain.floor;
  const rooms = sortRooms(floor.rooms);

  return (
    <LocationFrame
      crumbs={crumbsFor(chain, "floor")}
      kicker="Floor"
      title={`Level ${floor.levelNumber}: ${floor.name}`}
      rollup={rollupRooms(floor.rooms, rackMetrics)}
      onEdit={role === "ADMIN" ? () => openEdit("FLOOR", floor.id) : undefined}
    >
      {rooms.length === 0 ? (
        <p className="text-sm text-slate-400">This floor has no rooms yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rooms.map((room) => {
            const rollup = rollupRooms([room], rackMetrics);
            const itKw = roomItKw(room, rackMetrics);
            const cooling = Math.round(onlineCoolingKwFor(room) * 10) / 10;
            const holds = holdsIfOneUnitFails(room, itKw);
            return (
              <Link
                key={room.id}
                href={`/hierarchy?room=${room.id}`}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 hover:border-cyan-500/40"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-300">
                    {roomTypeLabel(room.roomType)}
                  </span>
                  <span className="text-[10px] font-bold text-cyan-300">{room.code}</span>
                </div>
                <h2 className="mt-2 font-semibold text-white">{room.name}</h2>
                <p className="mt-2 text-xs text-slate-400">{rollup.rackCount} racks</p>
                <div className="mt-2 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>
                      {rollup.usedU}/{rollup.totalU} U
                    </span>
                  </div>
                  <Meter used={rollup.usedU} total={rollup.totalU} />
                </div>
                <p className="mt-2 text-xs text-slate-300">
                  {itKw} kW IT · {cooling} kW cooling
                </p>
                <p className={`mt-1 text-xs font-medium ${holds ? "text-emerald-300" : "text-rose-300"}`}>
                  {holds ? "N+1 holds" : "N+1 short"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </LocationFrame>
  );
}

export function RowView({ rowId }: { rowId: string }) {
  const { loading, role, sites, rackMetrics, openEdit, chain } = useLocation("row", rowId);
  if (loading && sites.length === 0) {
    return <div className="p-8 text-sm text-slate-400">Loading location…</div>;
  }
  if (!chain?.row || !chain.room) {
    return <div className="p-8 text-sm text-slate-400">That location is not in the tree.</div>;
  }
  const row = chain.row;
  const racks = row.racks.slice().sort((a, b) => a.posY - b.posY || a.posX - b.posX);

  return (
    <LocationFrame
      crumbs={crumbsFor(chain, "row")}
      kicker="Row"
      title={row.name}
      subtitle={`${containmentLabel(row.aisleContainment)} · ${orientationLabel(row.orientation)} · Anchor tile ${row.gridX},${row.gridY}`}
      rollup={rollupRooms([{ ...chain.room, rows: [row] }], rackMetrics)}
      onEdit={role === "ADMIN" ? () => openEdit("ROW", row.id) : undefined}
    >
      <Link
        href={`/hierarchy?room=${chain.room.id}`}
        className="inline-flex text-xs font-medium text-cyan-300 hover:text-cyan-200"
      >
        Show on floor plan
      </Link>
      {racks.length === 0 ? (
        <p className="text-sm text-slate-400">This row has no racks yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {racks.map((rack) => {
            const metric = rackMetrics[rack.id];
            const used = metric?.usedU || 0;
            const total = metric?.totalU || rack.totalU;
            return (
              <Link
                key={rack.id}
                href={`/racks/${rack.id}`}
                className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 hover:border-cyan-500/40"
              >
                <div className="flex items-baseline gap-2">
                  <span className="font-mono text-sm font-semibold text-cyan-200">{rack.code}</span>
                  <span className="truncate text-xs text-slate-400">{rack.name}</span>
                </div>
                <div className="mt-3 space-y-1">
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>
                      {used}/{total} U
                    </span>
                    <span>{metric ? `${metric.powerUtilizationPct}% power` : "No load yet"}</span>
                  </div>
                  <Meter used={used} total={total} />
                </div>
                <p className="mt-2 text-[11px] text-slate-400">
                  A {metric?.feedAWatts || 0} W · B {metric?.feedBWatts || 0} W · SPOF{" "}
                  {metric?.spofDeviceCount || 0}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </LocationFrame>
  );
}

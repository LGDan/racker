"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Building2, Plus, ShieldAlert } from "lucide-react";
import { FloorPlan } from "@/components/floor/FloorPlan";
import { useInfrastructure } from "@/components/layout/infrastructure-context";
import { CapacityStrip, LocationCrumbs } from "@/components/location/LocationFrame";
import { crumbsFor, findChain, rollupRooms } from "@/components/location/model";

function FloorExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { loading, role, sites, circuits, rackMetrics, openAdd, openEdit, refresh } =
    useInfrastructure();
  const requestedRoomId = searchParams.get("room") || "";

  const allRooms = sites.flatMap((site) =>
    site.buildings.flatMap((building) =>
      building.floors.flatMap((floor) =>
        floor.rooms.map((room) => ({
          ...room,
          siteName: site.name,
          siteCode: site.code,
          buildingName: building.name,
          floorName: floor.name,
        }))
      )
    )
  );
  const activeRoom =
    allRooms.find((room) => room.id === requestedRoomId) || allRooms[0];
  const roomChain = activeRoom ? findChain(sites, "room", activeRoom.id) : null;

  useEffect(() => {
    if (loading || !activeRoom) return;
    if (requestedRoomId === activeRoom.id) return;
    router.replace(`/hierarchy?room=${activeRoom.id}`, { scroll: false });
  }, [loading, activeRoom?.id, requestedRoomId, router]);

  if (loading && sites.length === 0) {
    return (
      <div className="p-8 text-sm text-slate-400">
        Loading spatial hierarchy and 2D floor plans...
      </div>
    );
  }

  const roomCircuits = activeRoom
    ? circuits.filter((circuit) => circuit.roomId === activeRoom.id)
    : [];

  return (
    <div className="space-y-6 p-6 lg:p-8">
      <div className="flex flex-col justify-between gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-center">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-cyan-400">
            <Building2 className="h-3.5 w-3.5" />
            Spatial Infrastructure Hierarchy & Room Floor Plan
          </div>
          <h1 className="mt-1 text-2xl font-bold text-white">
            Sites, Buildings, Floors, Data Halls, Rows & Racks
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Navigate the physical hierarchy and inspect interactive 2D room floor
            plans with thermal zones, floor power whips, and rack capacity
            heatmaps.
          </p>
        </div>

        {role === "ADMIN" ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openAdd("SITE")}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              <Plus className="h-3.5 w-3.5 text-cyan-400" />
              New Site
            </button>
            {activeRoom && (
              <button
                type="button"
                onClick={() => openAdd("ROW", activeRoom.id)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
              >
                <Plus className="h-3.5 w-3.5 text-emerald-400" />
                Add Row in {activeRoom.code}
              </button>
            )}
            {activeRoom?.rows?.[0] && (
              <button
                type="button"
                onClick={() => openAdd("RACK", activeRoom.rows[0].id)}
                className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
              >
                <Plus className="h-3.5 w-3.5" />
                Provision Rack
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/90 px-3 py-2 text-xs text-slate-400">
            <ShieldAlert className="h-4 w-4 text-emerald-400" />
            <span>
              Standard Mode: Full hierarchy read access. Click any rack to edit
              devices & cabling.
            </span>
          </div>
        )}
      </div>

      {activeRoom ? (
        <div className="space-y-5 rounded-xl border border-slate-800 bg-slate-900/90 p-5">
          <div className="space-y-3 border-b border-slate-800 pb-4">
            {roomChain && <LocationCrumbs crumbs={crumbsFor(roomChain, "room")} />}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-cyan-500/20 px-2 py-0.5 text-xs font-bold text-cyan-300">
                  {activeRoom.code}
                </span>
                <h2 className="text-lg font-bold text-white">
                  {activeRoom.name} — Raised-Floor Plan
                </h2>
              </div>
              {role === "ADMIN" && (
                <button
                  type="button"
                  onClick={() => openEdit("ROOM", activeRoom.id)}
                  className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
                >
                  Edit
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {activeRoom.siteName} → {activeRoom.buildingName} → {activeRoom.floorName}{" "}
              • Cooling:{" "}
              <strong className="text-sky-300">
                {activeRoom.coolingCapacityKw} kW ({activeRoom.coolingRedundancy})
              </strong>{" "}
              • Target Temp: {activeRoom.ambientTempTargetC}°C
            </p>
            <CapacityStrip rollup={rollupRooms([activeRoom], rackMetrics)} />
          </div>
          <FloorPlan
            room={activeRoom}
            sockets={roomCircuits.map((circuit) => ({
              id: circuit.id,
              floorSocketLabel: circuit.floorSocketLabel,
              phaseAllocation: circuit.phaseAllocation,
              ratedAmps: circuit.ratedAmps,
              posX: circuit.posX,
              posY: circuit.posY,
              elevation: circuit.elevation || "UNDERFLOOR",
            }))}
            metrics={rackMetrics}
            admin={role === "ADMIN"}
            onChanged={refresh}
          />
        </div>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400">
          Select a room from the location tree to view its floor plan.
        </div>
      )}
    </div>
  );
}

export default function HierarchyExplorerPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-slate-400">
          Loading spatial hierarchy and 2D floor plans...
        </div>
      }
    >
      <FloorExplorer />
    </Suspense>
  );
}

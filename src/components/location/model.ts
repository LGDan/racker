import type {
  RackMetric,
  TreeBuilding,
  TreeFloor,
  TreeRoom,
  TreeRow,
  TreeSite,
} from "@/components/layout/infrastructure-context";

export type LocationKind = "site" | "building" | "floor" | "room" | "row" | "rack";

export interface LocationChain {
  site: TreeSite;
  building?: TreeBuilding;
  floor?: TreeFloor;
  room?: TreeRoom;
  row?: TreeRow;
}

export interface CapacityRollup {
  rackCount: number;
  usedU: number;
  totalU: number;
  itKw: number;
  onlineCoolingKw: number;
}

export interface Crumb {
  href?: string;
  label: string;
}

export function findChain(sites: TreeSite[], kind: LocationKind, id: string): LocationChain | null {
  for (const site of sites) {
    if (kind === "site" && site.id === id) return { site };
    for (const building of site.buildings) {
      if (kind === "building" && building.id === id) return { site, building };
      for (const floor of building.floors) {
        if (kind === "floor" && floor.id === id) return { site, building, floor };
        for (const room of floor.rooms) {
          if (kind === "room" && room.id === id) return { site, building, floor, room };
          for (const row of room.rows) {
            if (kind === "row" && row.id === id) return { site, building, floor, room, row };
            if (kind === "rack" && row.racks.some((rack) => rack.id === id)) {
              return { site, building, floor, room, row };
            }
          }
        }
      }
    }
  }
  return null;
}

export function crumbsFor(chain: LocationChain, leaf: LocationKind): Crumb[] {
  const crumbs: Crumb[] = [{ href: `/sites/${chain.site.id}`, label: chain.site.name }];
  if (chain.building && leaf !== "site") {
    crumbs.push({
      href: `/buildings/${chain.building.id}`,
      label: chain.building.name,
    });
  }
  if (chain.floor && (leaf === "floor" || leaf === "room" || leaf === "row" || leaf === "rack")) {
    crumbs.push({
      href: `/floors/${chain.floor.id}`,
      label: `Level ${chain.floor.levelNumber}: ${chain.floor.name}`,
    });
  }
  if (chain.room && (leaf === "room" || leaf === "row" || leaf === "rack")) {
    crumbs.push({
      href: `/hierarchy?room=${chain.room.id}`,
      label: chain.room.name,
    });
  }
  if (chain.row && (leaf === "row" || leaf === "rack")) {
    crumbs.push({ href: `/rows/${chain.row.id}`, label: chain.row.name });
  }
  const last = crumbs[crumbs.length - 1];
  if (last && leaf !== "rack") last.href = undefined;
  return crumbs;
}

export function rollupRooms(
  rooms: TreeRoom[],
  metrics: Record<string, RackMetric>
): CapacityRollup {
  let rackCount = 0;
  let usedU = 0;
  let totalU = 0;
  let watts = 0;
  let onlineCoolingKw = 0;
  for (const room of rooms) {
    onlineCoolingKw += onlineCoolingKwFor(room);
    for (const row of room.rows) {
      for (const rack of row.racks) {
        rackCount += 1;
        const metric = metrics[rack.id];
        usedU += metric?.usedU || 0;
        totalU += metric?.totalU || rack.totalU;
        watts += metric?.currentPowerWatts || 0;
      }
    }
  }
  return {
    rackCount,
    usedU,
    totalU,
    itKw: Math.round((watts / 1000) * 10) / 10,
    onlineCoolingKw: Math.round(onlineCoolingKw * 10) / 10,
  };
}

export function onlineCoolingKwFor(room: TreeRoom) {
  return room.coolingUnits.reduce(
    (sum, unit) => (unit.status === "ONLINE" ? sum + unit.capacityKw : sum),
    0
  );
}

export function roomItKw(room: TreeRoom, metrics: Record<string, RackMetric>) {
  let watts = 0;
  for (const row of room.rows) {
    for (const rack of row.racks) watts += metrics[rack.id]?.currentPowerWatts || 0;
  }
  return Math.round((watts / 1000) * 10) / 10;
}

export function holdsIfOneUnitFails(room: TreeRoom, itKw: number) {
  let online = 0;
  let standby = 0;
  let largest = 0;
  for (const unit of room.coolingUnits) {
    if (unit.status === "ONLINE") {
      online += unit.capacityKw;
      if (unit.capacityKw > largest) largest = unit.capacityKw;
    } else if (unit.status === "STANDBY") {
      standby += unit.capacityKw;
    }
  }
  return online + standby - largest >= itKw;
}

export function roomTypeLabel(value: string) {
  if (value === "POWER_ROOM") return "Power room";
  if (value === "COOLING_PLANT") return "Cooling plant";
  if (value === "MEET_ME") return "Meet-me";
  return "Data hall";
}

export function containmentLabel(value: string) {
  if (value === "HOT_AISLE") return "Hot aisle";
  if (value === "COLD_AISLE") return "Cold aisle";
  return "None";
}

export function orientationLabel(value: string) {
  return value === "VERTICAL" ? "Vertical" : "Horizontal";
}

export function supplyTypeLabel(value: string) {
  if (value === "UTILITY") return "Utility";
  if (value === "GENERATOR") return "Generator";
  if (value === "TRANSFORMER") return "Transformer";
  return value;
}

export function sortRooms(rooms: TreeRoom[]) {
  return rooms.slice().sort((a, b) => {
    const rank = (room: TreeRoom) => (room.roomType === "DATA_HALL" ? 0 : 1);
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
}

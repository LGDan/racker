import {
  disconnectPlanSchema,
  getPrismaForSchema,
  publicPrisma,
} from "./db";
import { getFullInfrastructureSnapshot, type SystemCapacitySnapshot } from "./capacity-engine";
import { exportSnapshot, replaceWithSnapshot } from "./system-data";

const COPY_DATA_TABLES = [
  "Site",
  "Building",
  "Floor",
  "Room",
  "FloorTile",
  "FloorObstruction",
  "CoolingUnit",
  "Row",
  "Rack",
  "PowerSource",
  "PowerPanel",
  "PowerCircuit",
  "PduTemplate",
  "RackPdu",
  "PduOutlet",
  "DeviceTemplate",
  "RackDevice",
  "DevicePsu",
  "NetworkPort",
  "NetworkCable",
] as const;

export interface PlanDeltaMetric {
  key: string;
  label: string;
  unit: string;
  opsValue: number;
  planValue: number;
  delta: number;
}

export interface PlanEntityChange {
  category:
    | "Sites & Buildings"
    | "Floors & Rooms"
    | "Rows & Racks"
    | "Appliances"
    | "Rack PDUs"
    | "Power Chain"
    | "Cooling"
    | "Catalog";
  changeType: "ADDED" | "MODIFIED" | "REMOVED";
  id: string;
  name: string;
  location: string;
  summary: string;
  fieldsChanged: string[];
}

export interface PlanComparisonResult {
  plan: {
    id: string;
    name: string;
    description: string;
    status: string;
    schemaName: string;
    createdByName: string;
    baseExportedAt: string;
    updatedAt: string;
  };
  summary: {
    totalChanges: number;
    addedCount: number;
    modifiedCount: number;
    removedCount: number;
    newIssuesCount: number;
    resolvedIssuesCount: number;
  };
  metrics: PlanDeltaMetric[];
  issues: {
    introduced: SystemCapacitySnapshot["alerts"];
    resolved: SystemCapacitySnapshot["alerts"];
    remaining: SystemCapacitySnapshot["alerts"];
  };
  changes: PlanEntityChange[];
}

function assertValidSchema(schemaName: string) {
  if (!/^plan_[a-z0-9_]+$/i.test(schemaName)) {
    throw new Error(`Invalid plan schema name: ${schemaName}`);
  }
}

export async function provisionPlanSchemaFromOps(schemaName: string) {
  assertValidSchema(schemaName);
  await publicPrisma.$executeRawUnsafe(
    `DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`
  );
  await publicPrisma.$executeRawUnsafe(`CREATE SCHEMA "${schemaName}"`);

  for (const table of COPY_DATA_TABLES) {
    await publicPrisma.$executeRawUnsafe(
      `CREATE TABLE "${schemaName}"."${table}" (LIKE public."${table}" INCLUDING ALL)`
    );
  }

  for (const table of COPY_DATA_TABLES) {
    await publicPrisma.$executeRawUnsafe(
      `INSERT INTO "${schemaName}"."${table}" SELECT * FROM public."${table}"`
    );
  }

  await recreatePlanForeignKeys(schemaName);
}

async function recreatePlanForeignKeys(schemaName: string) {
  const tableList = COPY_DATA_TABLES.map((table) => `'${table}'`).join(", ");
  const constraints = await publicPrisma.$queryRawUnsafe<
    { conname: string; table_name: string; def: string }[]
  >(
    `SELECT c.conname, rel.relname AS table_name, pg_get_constraintdef(c.oid) AS def
     FROM pg_constraint c
     JOIN pg_class rel ON rel.oid = c.conrelid
     JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
     WHERE nsp.nspname = 'public'
       AND c.contype = 'f'
       AND rel.relname IN (${tableList})
     ORDER BY c.oid`
  );

  const allowed = new Set<string>(COPY_DATA_TABLES);
  for (const constraint of constraints) {
    if (!allowed.has(constraint.table_name)) continue;
    const referenced = constraint.def.match(/REFERENCES\s+(?:public\.)?"?([A-Za-z0-9_]+)"?/);
    if (referenced && !allowed.has(referenced[1])) continue;
    const qualified = constraint.def.replace(
      /REFERENCES\s+(?:public\.)?/g,
      `REFERENCES "${schemaName}".`
    );
    await publicPrisma.$executeRawUnsafe(
      `ALTER TABLE "${schemaName}"."${constraint.table_name}" ADD CONSTRAINT "${constraint.conname}" ${qualified}`
    );
  }
}

export async function createInfrastructurePlan(input: {
  name: string;
  description?: string;
  userId?: string;
  userName?: string;
}) {
  const name = String(input.name || "").trim();
  if (!name) throw new Error("Plan name is required");
  const description = String(input.description || "").trim();

  const tempId = `plan_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const created = await publicPrisma.infrastructurePlan.create({
    data: {
      name,
      description,
      status: "DRAFT",
      schemaName: tempId,
      createdById: input.userId || null,
      createdByName: input.userName || "Operator",
    },
  });

  const schemaName = `plan_${created.id.replace(/[^a-z0-9]/gi, "").toLowerCase()}`;
  const updated = await publicPrisma.infrastructurePlan.update({
    where: { id: created.id },
    data: { schemaName, baseExportedAt: new Date() },
  });

  try {
    await provisionPlanSchemaFromOps(schemaName);
  } catch (error) {
    await publicPrisma.infrastructurePlan.delete({ where: { id: created.id } }).catch(() => {});
    throw error;
  }
  return updated;
}

export async function rebasePlanFromOps(planId: string) {
  const plan = await publicPrisma.infrastructurePlan.findUnique({
    where: { id: planId },
  });
  if (!plan) throw new Error("Plan not found");
  await disconnectPlanSchema(plan.schemaName);
  await provisionPlanSchemaFromOps(plan.schemaName);
  return publicPrisma.infrastructurePlan.update({
    where: { id: plan.id },
    data: { baseExportedAt: new Date(), status: "DRAFT" },
  });
}

export async function deleteInfrastructurePlan(planId: string) {
  const plan = await publicPrisma.infrastructurePlan.findUnique({
    where: { id: planId },
  });
  if (!plan) throw new Error("Plan not found");
  await disconnectPlanSchema(plan.schemaName);
  assertValidSchema(plan.schemaName);
  await publicPrisma.$executeRawUnsafe(
    `DROP SCHEMA IF EXISTS "${plan.schemaName}" CASCADE`
  );
  await publicPrisma.infrastructurePlan.delete({ where: { id: plan.id } });
}

export async function applyPlanToOps(planId: string) {
  const plan = await publicPrisma.infrastructurePlan.findUnique({
    where: { id: planId },
  });
  if (!plan) throw new Error("Plan not found");
  if (plan.status !== "DRAFT") {
    throw new Error("Only DRAFT plans can be applied to Ops");
  }
  const planDb = getPrismaForSchema(plan.schemaName);
  const media = await publicPrisma.locationMedia.findMany();
  const snapshot = await exportSnapshot(planDb);
  await replaceWithSnapshot(snapshot, publicPrisma);

  const [sites, buildings] = await Promise.all([
    publicPrisma.site.findMany({ select: { id: true } }),
    publicPrisma.building.findMany({ select: { id: true } }),
  ]);
  const siteIds = new Set(sites.map((site) => site.id));
  const buildingIds = new Set(buildings.map((building) => building.id));
  const keep = media.filter(
    (item) =>
      (!item.siteId || siteIds.has(item.siteId)) &&
      (!item.buildingId || buildingIds.has(item.buildingId))
  );
  if (keep.length) {
    await publicPrisma.locationMedia.createMany({ data: keep });
  }

  return publicPrisma.infrastructurePlan.update({
    where: { id: plan.id },
    data: { status: "APPLIED", appliedAt: new Date() },
  });
}

export async function comparePlanWithOps(
  planId: string
): Promise<PlanComparisonResult> {
  const plan = await publicPrisma.infrastructurePlan.findUnique({
    where: { id: planId },
  });
  if (!plan) throw new Error("Plan not found");

  const planDb = getPrismaForSchema(plan.schemaName);
  const [opsSnap, planSnap] = await Promise.all([
    getFullInfrastructureSnapshot(publicPrisma),
    getFullInfrastructureSnapshot(planDb),
  ]);

  const opsTotals = opsSnap.capacity.totals;
  const planTotals = planSnap.capacity.totals;

  const opsHeadroom = Math.max(
    0,
    Math.round((opsTotals.totalOnlineCoolingKw - opsTotals.totalItKw) * 10) / 10
  );
  const planHeadroom = Math.max(
    0,
    Math.round((planTotals.totalOnlineCoolingKw - planTotals.totalItKw) * 10) / 10
  );

  const opsUPct =
    opsTotals.totalU > 0
      ? Math.round((opsTotals.usedU / opsTotals.totalU) * 1000) / 10
      : 0;
  const planUPct =
    planTotals.totalU > 0
      ? Math.round((planTotals.usedU / planTotals.totalU) * 1000) / 10
      : 0;
  const opsHeatBtu = Math.round(opsTotals.totalItWatts * 3.41214);
  const planHeatBtu = Math.round(planTotals.totalItWatts * 3.41214);

  const metrics: PlanDeltaMetric[] = [
    {
      key: "racks",
      label: "Total Racks",
      unit: "racks",
      opsValue: opsTotals.rackCount,
      planValue: planTotals.rackCount,
      delta: planTotals.rackCount - opsTotals.rackCount,
    },
    {
      key: "usedU",
      label: "Occupied Rack Space",
      unit: "U",
      opsValue: opsTotals.usedU,
      planValue: planTotals.usedU,
      delta: planTotals.usedU - opsTotals.usedU,
    },
    {
      key: "freeU",
      label: "Available Rack Space",
      unit: "U",
      opsValue: opsTotals.freeU,
      planValue: planTotals.freeU,
      delta: planTotals.freeU - opsTotals.freeU,
    },
    {
      key: "uPct",
      label: "U Utilization",
      unit: "%",
      opsValue: opsUPct,
      planValue: planUPct,
      delta: Math.round((planUPct - opsUPct) * 10) / 10,
    },
    {
      key: "itKw",
      label: "Active IT Power",
      unit: "kW",
      opsValue: opsTotals.totalItKw,
      planValue: planTotals.totalItKw,
      delta: Math.round((planTotals.totalItKw - opsTotals.totalItKw) * 100) / 100,
    },
    {
      key: "itWatts",
      label: "Active IT Power",
      unit: "W",
      opsValue: opsTotals.totalItWatts,
      planValue: planTotals.totalItWatts,
      delta: planTotals.totalItWatts - opsTotals.totalItWatts,
    },
    {
      key: "heatBtu",
      label: "IT Heat Rejection",
      unit: "BTU/h",
      opsValue: opsHeatBtu,
      planValue: planHeatBtu,
      delta: planHeatBtu - opsHeatBtu,
    },
    {
      key: "coolingKw",
      label: "Online Cooling",
      unit: "kW",
      opsValue: opsTotals.totalOnlineCoolingKw,
      planValue: planTotals.totalOnlineCoolingKw,
      delta:
        Math.round(
          (planTotals.totalOnlineCoolingKw - opsTotals.totalOnlineCoolingKw) * 10
        ) / 10,
    },
    {
      key: "headroomKw",
      label: "Thermal Headroom",
      unit: "kW",
      opsValue: opsHeadroom,
      planValue: planHeadroom,
      delta: Math.round((planHeadroom - opsHeadroom) * 10) / 10,
    },
    {
      key: "totalOutlets",
      label: "Total PDU Outlets",
      unit: "sockets",
      opsValue: opsTotals.totalPduOutlets,
      planValue: planTotals.totalPduOutlets,
      delta: planTotals.totalPduOutlets - opsTotals.totalPduOutlets,
    },
    {
      key: "usedOutlets",
      label: "Used PDU Outlets",
      unit: "sockets",
      opsValue: opsTotals.usedPduOutlets,
      planValue: planTotals.usedPduOutlets,
      delta: planTotals.usedPduOutlets - opsTotals.usedPduOutlets,
    },
    {
      key: "freeOutlets",
      label: "Free PDU Outlets",
      unit: "sockets",
      opsValue: opsTotals.freePduOutlets,
      planValue: planTotals.freePduOutlets,
      delta: planTotals.freePduOutlets - opsTotals.freePduOutlets,
    },
    {
      key: "spof",
      label: "Single-Corded / SPOF Devices",
      unit: "devices",
      opsValue: opsTotals.spofDevicesCount,
      planValue: planTotals.spofDevicesCount,
      delta: planTotals.spofDevicesCount - opsTotals.spofDevicesCount,
    },
    {
      key: "overloaded",
      label: "Overloaded Circuits",
      unit: "circuits",
      opsValue: opsTotals.overloadedCircuitsCount,
      planValue: planTotals.overloadedCircuitsCount,
      delta: planTotals.overloadedCircuitsCount - opsTotals.overloadedCircuitsCount,
    },
  ];

  const alertKey = (a: SystemCapacitySnapshot["alerts"][number]) =>
    `${a.category}:${a.title}`;
  const opsAlertsByKey = new Map(
    opsSnap.capacity.alerts.map((a) => [alertKey(a), a])
  );
  const planAlertsByKey = new Map(
    planSnap.capacity.alerts.map((a) => [alertKey(a), a])
  );

  const introduced = planSnap.capacity.alerts.filter(
    (a) => !opsAlertsByKey.has(alertKey(a))
  );
  const resolved = opsSnap.capacity.alerts.filter(
    (a) => !planAlertsByKey.has(alertKey(a))
  );
  const remaining = planSnap.capacity.alerts.filter((a) =>
    opsAlertsByKey.has(alertKey(a))
  );

  const changes: PlanEntityChange[] = [];

  // 1. Sites & Buildings
  diffEntities(
    opsSnap.sites,
    planSnap.sites,
    "Sites & Buildings",
    (s) => s.name,
    (s) => `${s.city}, ${s.country}`,
    (s) => `Site ${s.code} (${s.utilityCapacityKw} kW utility)`,
    [
      ["name", "Name", (s) => s.name],
      ["code", "Code", (s) => s.code],
      ["utilityCapacityKw", "Utility kW", (s) => `${s.utilityCapacityKw} kW`],
      ["pueTarget", "PUE target", (s) => s.pueTarget],
    ],
    changes
  );

  const opsBuildings = opsSnap.sites.flatMap((s) =>
    s.buildings.map((b) => ({ ...b, siteName: s.name }))
  );
  const planBuildings = planSnap.sites.flatMap((s) =>
    s.buildings.map((b) => ({ ...b, siteName: s.name }))
  );
  diffEntities(
    opsBuildings,
    planBuildings,
    "Sites & Buildings",
    (b) => b.name,
    (b) => b.siteName,
    (b) => `Building ${b.code}`,
    [
      ["name", "Name", (b) => b.name],
      ["code", "Code", (b) => b.code],
    ],
    changes
  );

  // 2. Floors & Rooms
  const opsFloors = opsBuildings.flatMap((b) =>
    b.floors.map((f) => ({ ...f, buildingName: b.name }))
  );
  const planFloors = planBuildings.flatMap((b) =>
    b.floors.map((f) => ({ ...f, buildingName: b.name }))
  );
  diffEntities(
    opsFloors,
    planFloors,
    "Floors & Rooms",
    (f) => f.name,
    (f) => f.buildingName,
    (f) => `Level ${f.levelNumber}`,
    [
      ["name", "Name", (f) => f.name],
      ["levelNumber", "Level", (f) => f.levelNumber],
    ],
    changes
  );

  const opsRooms = opsFloors.flatMap((f) =>
    f.rooms.map((r) => ({ ...r, floorName: f.name }))
  );
  const planRooms = planFloors.flatMap((f) =>
    f.rooms.map((r) => ({ ...r, floorName: f.name }))
  );
  diffEntities(
    opsRooms,
    planRooms,
    "Floors & Rooms",
    (r) => r.name,
    (r) => r.floorName,
    (r) =>
      `Room ${r.code} (${r.gridCols}×${r.gridRows} tiles, ${r.coolingCapacityKw} kW cooling)`,
    [
      ["name", "Name", (r) => r.name],
      ["code", "Code", (r) => r.code],
      ["grid", "Grid", (r) => `${r.gridCols}×${r.gridRows}`],
      ["coolingCapacityKw", "Cooling kW", (r) => `${r.coolingCapacityKw} kW`],
      ["coolingRedundancy", "Redundancy", (r) => r.coolingRedundancy],
      [
        "grills",
        "Airflow grills",
        (r) => (r.floorTiles || []).filter((t) => t.surface === "GRILL").length,
      ],
      [
        "obstructions",
        "Obstructed tiles",
        (r) => (r.obstructions || []).length,
      ],
    ],
    changes
  );

  // 3. Rows & Racks
  const opsRows = opsRooms.flatMap((r) =>
    r.rows.map((rw) => ({ ...rw, roomName: r.name }))
  );
  const planRows = planRooms.flatMap((r) =>
    r.rows.map((rw) => ({ ...rw, roomName: r.name }))
  );
  diffEntities(
    opsRows,
    planRows,
    "Rows & Racks",
    (rw) => rw.name,
    (rw) => rw.roomName,
    (rw) => `Row (${rw.orientation}, ${rw.aisleContainment})`,
    [
      ["name", "Name", (rw) => rw.name],
      ["orientation", "Orientation", (rw) => rw.orientation],
      ["aisleContainment", "Containment", (rw) => rw.aisleContainment],
      ["tile", "Anchor tile", (rw) => `${rw.gridX},${rw.gridY}`],
    ],
    changes
  );

  diffEntities(
    opsSnap.racks,
    planSnap.racks,
    "Rows & Racks",
    (rk) => `${rk.code} (${rk.name})`,
    (rk) => `${rk.row.room.name} · ${rk.row.name}`,
    (rk) => `Rack ${rk.totalU}U at tile ${rk.posX},${rk.posY}`,
    [
      ["code", "Code", (rk) => rk.code],
      ["name", "Name", (rk) => rk.name],
      ["totalU", "Height", (rk) => `${rk.totalU}U`],
      ["tile", "Tile", (rk) => `${rk.posX},${rk.posY}`],
      ["maxWeightKg", "Max weight", (rk) => `${rk.maxWeightKg} kg`],
    ],
    changes
  );

  // 4. Installed Appliances (RackDevice)
  diffEntities(
    opsSnap.devices,
    planSnap.devices,
    "Appliances",
    (d) => d.name,
    (d) => `Rack ${d.rack.code} · U${d.startU}`,
    (d) =>
      `${d.deviceType} (${d.manufacturer} ${d.model}, ${d.uHeight}U, ${d.nominalWatts}W)`,
    [
      ["name", "Name", (d) => d.name],
      ["hostname", "Short code", (d) => d.hostname || ""],
      ["rack", "Rack", (d) => d.rack.code],
      ["startU", "Start U", (d) => `U${d.startU}`],
      ["uHeight", "Height", (d) => `${d.uHeight}U`],
      ["nominalWatts", "Watts", (d) => `${d.nominalWatts}W`],
      ["status", "Status", (d) => d.status],
      [
        "psus",
        "Corded PSUs",
        (d) =>
          d.psus
            .map((p) =>
              p.connectedOutlet
                ? `${p.name}->${p.connectedOutlet.pdu.name}#${p.connectedOutlet.outletNumber}`
                : `${p.name}:unplugged`
            )
            .join(", "),
      ],
    ],
    changes
  );

  // 5. Rack PDUs
  diffEntities(
    opsSnap.pdus,
    planSnap.pdus,
    "Rack PDUs",
    (p) => p.name,
    (p) => `Rack ${p.rack.code} (Feed ${p.feedSide})`,
    (p) =>
      `${p.model} (${p.maxAmps}A ${p.voltageV}V, ${p.outlets.length} outlets)`,
    [
      ["name", "Name", (p) => p.name],
      ["feedSide", "Feed", (p) => p.feedSide],
      ["mounting", "Mounting", (p) => p.mounting],
      ["maxWatts", "Rating", (p) => `${p.maxWatts}W`],
      ["whip", "Floor whip", (p) => p.circuit?.floorSocketLabel || "unplugged"],
      ["outlets", "Outlets", (p) => p.outlets.length],
    ],
    changes
  );

  // 6. Power Chain (Sources, Panels, Floor Sockets)
  diffEntities(
    opsSnap.powerSources,
    planSnap.powerSources,
    "Power Chain",
    (s) => s.name,
    (s) => `Bus ${s.redundancyGroup}`,
    (s) => `${s.sourceType} (${s.capacityKw} kW, ${s.status})`,
    [
      ["name", "Name", (s) => s.name],
      ["sourceType", "Type", (s) => s.sourceType],
      ["redundancyGroup", "Bus", (s) => s.redundancyGroup],
      ["capacityKw", "Capacity", (s) => `${s.capacityKw} kW`],
      ["status", "Status", (s) => s.status],
    ],
    changes
  );

  diffEntities(
    opsSnap.powerPanels,
    planSnap.powerPanels,
    "Power Chain",
    (p) => p.name,
    (p) => `${p.room.name} (Feed ${p.feedSide})`,
    (p) =>
      `Panel from ${p.upstreamSource.name} (${p.maxAmpsPerPhase}A/phase)`,
    [
      ["name", "Name", (p) => p.name],
      ["feedSide", "Feed", (p) => p.feedSide],
      ["upstream", "Upstream", (p) => p.upstreamSource.name],
      ["maxAmpsPerPhase", "Amps/phase", (p) => `${p.maxAmpsPerPhase}A`],
      ["status", "Status", (p) => p.status],
    ],
    changes
  );

  diffEntities(
    opsSnap.powerCircuits,
    planSnap.powerCircuits,
    "Power Chain",
    (c) => `${c.floorSocketLabel} (${c.name})`,
    (c) => `${c.room.name} · ${c.panel.name}`,
    (c) => `Phase ${c.phaseAllocation} · ${c.ratedAmps}A ${c.socketType}`,
    [
      ["floorSocketLabel", "Label", (c) => c.floorSocketLabel],
      ["panel", "Panel", (c) => c.panel.name],
      ["phaseAllocation", "Phase", (c) => c.phaseAllocation],
      ["ratedAmps", "Amps", (c) => `${c.ratedAmps}A`],
      ["socketType", "Connector", (c) => c.socketType],
      ["rack", "Rack", (c) => c.rack?.code || "Any"],
      ["tile", "Tile", (c) => `${c.posX},${c.posY} (${c.elevation})`],
    ],
    changes
  );

  // 7. Cooling Units
  const opsCooling = opsRooms.flatMap((r) =>
    r.coolingUnits.map((cu) => ({ ...cu, roomName: r.name }))
  );
  const planCooling = planRooms.flatMap((r) =>
    r.coolingUnits.map((cu) => ({ ...cu, roomName: r.name }))
  );
  diffEntities(
    opsCooling,
    planCooling,
    "Cooling",
    (c) => c.name,
    (c) => c.roomName,
    (c) => `${c.unitType} (${c.capacityKw} kW, ${c.status})`,
    [
      ["name", "Name", (c) => c.name],
      ["unitType", "Type", (c) => c.unitType],
      ["capacityKw", "Capacity", (c) => `${c.capacityKw} kW`],
      ["status", "Status", (c) => c.status],
      [
        "tile",
        "Placement",
        (c) => (c.posX >= 1 && c.posY >= 1 ? `${c.posX},${c.posY}` : "Off plan"),
      ],
    ],
    changes
  );

  // 8. Catalog Templates
  diffEntities(
    opsSnap.templates,
    planSnap.templates,
    "Catalog",
    (t) => t.name || `${t.manufacturer} ${t.model}`,
    (t) => t.deviceType,
    (t) => `${t.uHeight}U · ${t.defaultWatts}W`,
    [
      ["name", "Name", (t) => t.name],
      ["uHeight", "Height", (t) => `${t.uHeight}U`],
      ["defaultWatts", "Watts", (t) => `${t.defaultWatts}W`],
      ["psuCount", "PSUs", (t) => `${t.psuCount}× ${t.psuPlugType}`],
      ["portCount", "Ports", (t) => `${t.portCount} ${t.portType}`],
    ],
    changes
  );

  diffEntities(
    opsSnap.pduTemplates,
    planSnap.pduTemplates,
    "Catalog",
    (t) => t.name || `${t.manufacturer} ${t.model}`,
    () => "PDU Template",
    (t) => `${t.phaseMode} · ${t.maxAmps}A · ${t.outletSpecs}`,
    [
      ["name", "Name", (t) => t.name],
      ["phaseMode", "Phase", (t) => t.phaseMode],
      ["maxAmps", "Amps", (t) => `${t.maxAmps}A`],
      ["outletSpecs", "Outlets", (t) => t.outletSpecs],
    ],
    changes
  );

  const addedCount = changes.filter((c) => c.changeType === "ADDED").length;
  const modifiedCount = changes.filter((c) => c.changeType === "MODIFIED").length;
  const removedCount = changes.filter((c) => c.changeType === "REMOVED").length;

  return {
    plan: {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      status: plan.status,
      schemaName: plan.schemaName,
      createdByName: plan.createdByName,
      baseExportedAt: plan.baseExportedAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    },
    summary: {
      totalChanges: changes.length,
      addedCount,
      modifiedCount,
      removedCount,
      newIssuesCount: introduced.length,
      resolvedIssuesCount: resolved.length,
    },
    metrics,
    issues: {
      introduced,
      resolved,
      remaining,
    },
    changes,
  };
}

function diffEntities<T extends { id: string }>(
  opsItems: readonly T[],
  planItems: readonly T[],
  category: PlanEntityChange["category"],
  getName: (item: T) => string,
  getLocation: (item: T) => string,
  getSummary: (item: T) => string,
  fields: [string, string, (item: T) => string | number][],
  out: PlanEntityChange[]
) {
  const opsMap = new Map(opsItems.map((item) => [item.id, item]));
  const planMap = new Map(planItems.map((item) => [item.id, item]));

  for (const item of planItems) {
    const before = opsMap.get(item.id);
    if (!before) {
      out.push({
        category,
        changeType: "ADDED",
        id: item.id,
        name: getName(item),
        location: getLocation(item),
        summary: `Added: ${getSummary(item)}`,
        fieldsChanged: ["New entity"],
      });
      continue;
    }

    const diffs: string[] = [];
    for (const [, label, getter] of fields) {
      const vBefore = String(getter(before));
      const vAfter = String(getter(item));
      if (vBefore !== vAfter) {
        diffs.push(`${label}: ${vBefore} -> ${vAfter}`);
      }
    }
    if (diffs.length > 0) {
      out.push({
        category,
        changeType: "MODIFIED",
        id: item.id,
        name: getName(item),
        location: getLocation(item),
        summary: diffs.join(" · "),
        fieldsChanged: diffs,
      });
    }
  }

  for (const item of opsItems) {
    if (!planMap.has(item.id)) {
      out.push({
        category,
        changeType: "REMOVED",
        id: item.id,
        name: getName(item),
        location: getLocation(item),
        summary: `Removed: ${getSummary(item)}`,
        fieldsChanged: ["Removed"],
      });
    }
  }
}

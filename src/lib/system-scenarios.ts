import type { Db } from "@/lib/system-data";
import { wipeInfrastructure } from "@/lib/system-data";
import { prisma } from "@/lib/db";

export const SCENARIOS = [
  {
    id: "huge-datacenter",
    name: "Huge datacenter",
    summary:
      "Two halls, 64 racks, A/B utility and UPS, perimeter CRAHs, aisle grills, and a pair of column obstructions.",
  },
  {
    id: "isp-pop",
    name: "ISP point of presence",
    summary:
      "A meet-me room and a core room with routers, switches, and patch panels on a single UPS feed.",
  },
  {
    id: "server-room",
    name: "Server room",
    summary:
      "One room, six racks, in-row cooling, a cold-aisle grill, and a local UPS.",
  },
  {
    id: "network-closet",
    name: "Network closet",
    summary:
      "A 24U hub rack, a switch, a patch panel, and column tiles that cannot take equipment.",
  },
] as const;

export type ScenarioId = (typeof SCENARIOS)[number]["id"];

export function isScenario(value: string): value is ScenarioId {
  return SCENARIOS.some((scenario) => scenario.id === value);
}

export async function provisionScenario(id: ScenarioId) {
  await prisma.$transaction(
    async (tx) => {
      await wipeInfrastructure(tx);
      const templates = await ensureTemplates(tx);
      if (id === "huge-datacenter") await buildHuge(tx, templates);
      else if (id === "isp-pop") await buildIsp(tx, templates);
      else if (id === "server-room") await buildServerRoom(tx, templates);
      else await buildCloset(tx, templates);
    },
    { timeout: 120000, maxWait: 10000 }
  );
}

interface Templates {
  server: string;
  switch: string;
  router: string;
  firewall: string;
  patch: string;
  storage: string;
}

async function ensureTemplates(db: Db): Promise<Templates> {
  const rows = [
    ["Dell", "PowerEdge R760", "SERVER", 2, 650, 1000, 28, 2, "C14", 2, "SFP28_25G"],
    ["Arista", "7050X3", "SWITCH", 1, 280, 420, 9, 2, "C14", 4, "SFP28_25G"],
    ["Cisco", "ASR 9901", "ROUTER", 2, 420, 650, 16, 2, "C14", 4, "SFP28_25G"],
    ["Palo Alto", "PA-3410", "FIREWALL", 1, 220, 360, 8, 2, "C14", 4, "SFP28_25G"],
    ["Corning", "EDGE8", "PATCH_PANEL", 1, 0, 0, 4, 0, "C14", 4, "FIBER_LC"],
    ["Dell", "PowerStore 500T", "STORAGE", 2, 700, 1100, 32, 2, "C20", 2, "SFP28_25G"],
  ] as const;
  const created = [];
  for (const row of rows) {
    const item = await db.deviceTemplate.create({
      data: {
        name: `${row[0]} ${row[1]}`,
        manufacturer: row[0],
        model: row[1],
        deviceType: row[2],
        uHeight: row[3],
        defaultWatts: row[4],
        peakWatts: row[5],
        btuPerHour: Math.round(row[4] * 3.412),
        weightKg: row[6],
        psuCount: row[7],
        psuPlugType: row[8],
        portCount: row[9],
        portType: row[10],
      },
    });
    created.push(item.id);
  }
  return {
    server: created[0],
    switch: created[1],
    router: created[2],
    firewall: created[3],
    patch: created[4],
    storage: created[5],
  };
}

async function siteBundle(
  db: Db,
  site: { name: string; code: string; city: string; country: string; kw: number },
  building: { name: string; code: string },
  floor: { name: string; level: number }
) {
  const createdSite = await db.site.create({
    data: {
      name: site.name,
      code: site.code,
      address: `${site.city} campus`,
      city: site.city,
      country: site.country,
      utilityCapacityKw: site.kw,
      pueTarget: 1.3,
    },
  });
  const createdBuilding = await db.building.create({
    data: { siteId: createdSite.id, name: building.name, code: building.code },
  });
  const createdFloor = await db.floor.create({
    data: {
      buildingId: createdBuilding.id,
      name: floor.name,
      levelNumber: floor.level,
    },
  });
  return { site: createdSite, floor: createdFloor };
}

async function makeRoom(
  db: Db,
  floorId: string,
  spec: {
    name: string;
    code: string;
    roomType?: string;
    cols: number;
    rows: number;
    coolingKw?: number;
  }
) {
  return db.room.create({
    data: {
      floorId,
      name: spec.name,
      code: spec.code,
      roomType: spec.roomType || "DATA_HALL",
      gridCols: spec.cols,
      gridRows: spec.rows,
      coolingCapacityKw: spec.coolingKw ?? 80,
      widthMm: spec.cols * 600,
      depthMm: spec.rows * 600,
    },
  });
}

async function placeRow(
  db: Db,
  roomId: string,
  spec: { name: string; y: number; xs: number[]; prefix: string; totalU?: number; watts?: number }
) {
  const row = await db.row.create({
    data: {
      roomId,
      name: spec.name,
      orientation: "HORIZONTAL",
      aisleContainment: "COLD_AISLE",
      gridX: spec.xs[0],
      gridY: spec.y,
    },
  });
  await db.rack.createMany({
    data: spec.xs.map((x, index) => ({
      rowId: row.id,
      name: `${spec.prefix} ${index + 1}`,
      code: `${spec.prefix}-${String(index + 1).padStart(2, "0")}`,
      totalU: spec.totalU ?? 42,
      maxPowerWatts: spec.watts ?? 12000,
      posX: x,
      posY: spec.y,
    })),
  });
  return db.rack.findMany({ where: { rowId: row.id }, orderBy: { posX: "asc" } });
}

async function feed(
  db: Db,
  siteId: string,
  roomId: string,
  name: string,
  side: "A" | "B",
  kw: number
) {
  const utility = await db.powerSource.create({
    data: {
      siteId,
      roomId,
      name: `${name} utility ${side}`,
      sourceType: "UTILITY",
      redundancyGroup: side,
      capacityKw: kw,
      voltageV: 400,
      maxAmps: 1600,
    },
  });
  const generator = await db.powerSource.create({
    data: {
      siteId,
      roomId,
      name: `${name} generator ${side}`,
      sourceType: "GENERATOR",
      redundancyGroup: side,
      capacityKw: kw,
      voltageV: 400,
      maxAmps: 1400,
      fuelRuntimeHours: 24,
    },
  });
  const ats = await db.powerSource.create({
    data: {
      siteId,
      roomId,
      name: `${name} ATS ${side}`,
      sourceType: "ATS",
      redundancyGroup: side,
      capacityKw: kw,
      upstreamSourceAId: utility.id,
      upstreamSourceBId: generator.id,
    },
  });
  const ups = await db.powerSource.create({
    data: {
      siteId,
      roomId,
      name: `${name} UPS ${side}`,
      sourceType: "UPS",
      redundancyGroup: side,
      capacityKw: Math.round(kw * 0.4),
      batteryRuntimeMins: 10,
      upstreamSourceAId: ats.id,
    },
  });
  return db.powerPanel.create({
    data: {
      roomId,
      upstreamSourceId: ups.id,
      name: `${name} panel ${side}`,
      feedSide: side,
      maxAmpsPerPhase: 400,
    },
  });
}

async function whip(
  db: Db,
  panelId: string,
  roomId: string,
  rack: { id: string; code: string; posX: number; posY: number },
  breaker: number,
  elevation: "UNDERFLOOR" | "OVERHEAD"
) {
  const phase = (["L1", "L2", "L3"] as const)[(breaker - 1) % 3];
  return db.powerCircuit.create({
    data: {
      panelId,
      roomId,
      rackId: rack.id,
      name: `${rack.code} ${elevation === "OVERHEAD" ? "busway" : "whip"}`,
      floorSocketLabel: `${rack.code}-${elevation === "OVERHEAD" ? "OH" : phase}`,
      breakerNumber: breaker,
      phaseAllocation: phase,
      ratedAmps: 32,
      elevation,
      posX: rack.posX,
      posY: rack.posY,
    },
  });
}

async function addPdu(
  db: Db,
  rackId: string,
  circuitId: string,
  name: string,
  feedSide: "A" | "B"
) {
  const pdu = await db.rackPdu.create({
    data: {
      rackId,
      circuitId,
      name,
      feedSide,
      mounting: feedSide === "A" ? "ZERO_U_LEFT" : "ZERO_U_RIGHT",
    },
  });
  await db.pduOutlet.createMany({
    data: Array.from({ length: 8 }, (_, index) => ({
      pduId: pdu.id,
      outletNumber: index + 1,
      label: `#${index + 1}`,
      bankPhase: ["L1", "L2", "L3"][index % 3],
      socketType: "C13",
      maxAmps: 10,
    })),
  });
  return db.pduOutlet.findMany({
    where: { pduId: pdu.id },
    orderBy: { outletNumber: "asc" },
  });
}

async function addGear(
  db: Db,
  rackId: string,
  templateId: string,
  spec: {
    name: string;
    type: string;
    startU: number;
    uHeight: number;
    watts: number;
    outlets?: string[];
    ports?: number;
  }
) {
  const device = await db.rackDevice.create({
    data: {
      rackId,
      templateId,
      name: spec.name,
      hostname: spec.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      deviceType: spec.type,
      manufacturer: "Catalog",
      model: spec.type,
      startU: spec.startU,
      uHeight: spec.uHeight,
      nominalWatts: spec.watts,
      peakWatts: Math.round(spec.watts * 1.4),
      weightKg: 8 + spec.uHeight * 6,
    },
  });
  const plugCount = spec.outlets?.length ? Math.min(2, spec.outlets.length) : spec.type === "PATCH_PANEL" ? 0 : 2;
  for (let index = 0; index < plugCount; index++) {
    await db.devicePsu.create({
      data: {
        deviceId: device.id,
        name: `PSU ${index + 1}`,
        maxWatts: Math.max(200, spec.watts),
        plugType: spec.watts > 1500 ? "C20" : "C14",
        connectedOutletId: spec.outlets?.[index] || null,
        cableColor: index === 0 ? "#38bdf8" : "#f59e0b",
        cableLabel: `${spec.name} PSU ${index + 1}`,
      },
    });
  }
  const portCount = spec.ports ?? (spec.type === "PATCH_PANEL" ? 4 : 2);
  const ports = [];
  for (let index = 1; index <= portCount; index++) {
    ports.push(
      await db.networkPort.create({
        data: {
          deviceId: device.id,
          name: spec.type === "PATCH_PANEL" ? `P${index}` : `eth${index}`,
          portNumber: index,
          portType: spec.type === "PATCH_PANEL" ? "FIBER_LC" : "SFP28_25G",
          speedGbps: spec.type === "PATCH_PANEL" ? 100 : 25,
          isManagement: index === 1 && spec.type === "SERVER",
        },
      })
    );
  }
  return ports;
}

async function buildHuge(db: Db, templates: Templates) {
  const { site, floor } = await siteBundle(
    db,
    { name: "Northstar Campus", code: "NSC", city: "Ashburn", country: "United States", kw: 12000 },
    { name: "Data Center 1", code: "DC1" },
    { name: "Level 1", level: 1 }
  );
  const powerRoom = await makeRoom(db, floor.id, {
    name: "Power Room A",
    code: "NSC-PWR",
    roomType: "POWER_ROOM",
    cols: 8,
    rows: 5,
    coolingKw: 40,
  });
  const hall = await makeRoom(db, floor.id, {
    name: "Hall A",
    code: "NSC-H1",
    cols: 24,
    rows: 16,
    coolingKw: 2400,
  });
  const floor2 = await db.floor.create({
    data: { buildingId: floor.buildingId, name: "Level 2", levelNumber: 2 },
  });
  const hallB = await makeRoom(db, floor2.id, {
    name: "Hall B",
    code: "NSC-H2",
    cols: 18,
    rows: 12,
    coolingKw: 1600,
  });
  const panelA = await feed(db, site.id, powerRoom.id, "Northstar", "A", 6000);
  const panelB = await feed(db, site.id, powerRoom.id, "Northstar", "B", 6000);
  const xs = [3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
  const ys = [3, 6, 9, 12];
  const rowsA = [];
  for (let index = 0; index < ys.length; index++) {
    const y = ys[index];
    rowsA.push(
      await placeRow(db, hall.id, { name: `Row ${index + 1}`, y, xs, prefix: `H1-R${index + 1}` })
    );
  }
  const ysB = [3, 6, 9];
  for (let index = 0; index < ysB.length; index++) {
    await placeRow(db, hallB.id, {
      name: `Row ${index + 1}`,
      y: ysB[index],
      xs: [3, 5, 7, 9, 11, 13, 15, 17],
      prefix: `H2-R${index + 1}`,
    });
  }
  await db.coolingUnit.createMany({
    data: [
      { roomId: hall.id, name: "CRAH-H1-N", unitType: "CRAH", capacityKw: 400, posX: 1, posY: 1 },
      { roomId: hall.id, name: "CRAH-H1-E", unitType: "CRAH", capacityKw: 400, posX: 24, posY: 1 },
      { roomId: hall.id, name: "CRAH-H1-W", unitType: "CRAH", capacityKw: 400, posX: 1, posY: 16 },
      { roomId: hall.id, name: "CRAH-H1-S", unitType: "CRAH", capacityKw: 400, posX: 24, posY: 16 },
      { roomId: hallB.id, name: "CRAH-H2-N", unitType: "CRAH", capacityKw: 350, posX: 1, posY: 1 },
      { roomId: hallB.id, name: "CRAH-H2-S", unitType: "CRAH", capacityKw: 350, posX: 18, posY: 12 },
    ],
  });
  await db.floorTile.createMany({
    data: xs.map((x) => ({ roomId: hall.id, posX: x, posY: 4, surface: "GRILL" })),
  });
  await db.floorObstruction.createMany({
    data: [
      { roomId: hall.id, posX: 12, posY: 8, label: "Column" },
      { roomId: hall.id, posX: 13, posY: 8, label: "Column" },
    ],
  });
  let breaker = 1;
  for (const rack of rowsA[0]) {
    const circuit = await whip(db, panelA.id, hall.id, rack, breaker, "UNDERFLOOR");
    await whip(db, panelB.id, hall.id, rack, breaker, "OVERHEAD");
    if (breaker <= 3) {
      const outlets = await addPdu(db, rack.id, circuit.id, `${rack.code} PDU A`, "A");
      const ports = await addGear(db, rack.id, templates.patch, {
        name: `${rack.code} patch`,
        type: "PATCH_PANEL",
        startU: 42,
        uHeight: 1,
        watts: 0,
        ports: 4,
      });
      const sw = await addGear(db, rack.id, templates.switch, {
        name: `${rack.code} switch`,
        type: "SWITCH",
        startU: 40,
        uHeight: 1,
        watts: 280,
        outlets: [outlets[0].id, outlets[1].id],
      });
      await addGear(db, rack.id, templates.server, {
        name: `${rack.code} compute`,
        type: "SERVER",
        startU: 36,
        uHeight: 2,
        watts: 650,
        outlets: [outlets[2].id, outlets[3].id],
      });
      if (ports[0] && sw[0]) {
        await db.networkCable.create({
          data: {
            portAId: ports[0].id,
            portBId: sw[0].id,
            label: `${rack.code} patch-switch`,
            cableType: "MMF_OM4",
          },
        });
      }
    }
    breaker += 1;
  }
}

async function buildIsp(db: Db, templates: Templates) {
  const { site, floor } = await siteBundle(
    db,
    { name: "Metro Exchange", code: "MEX", city: "London", country: "United Kingdom", kw: 800 },
    { name: "POP 1", code: "POP1" },
    { name: "Ground", level: 1 }
  );
  const mmr = await makeRoom(db, floor.id, {
    name: "Meet-me Room",
    code: "MEX-MMR",
    roomType: "MEET_ME",
    cols: 10,
    rows: 6,
    coolingKw: 60,
  });
  const core = await makeRoom(db, floor.id, {
    name: "Core Room",
    code: "MEX-CORE",
    cols: 12,
    rows: 8,
    coolingKw: 180,
  });
  const panel = await feed(db, site.id, core.id, "Metro", "A", 800);
  const meet = await placeRow(db, mmr.id, {
    name: "Meet-me",
    y: 3,
    xs: [3, 6],
    prefix: "MMR",
  });
  const coreRow = await placeRow(db, core.id, {
    name: "Core",
    y: 4,
    xs: [3, 5, 7, 9],
    prefix: "CORE",
  });
  await db.coolingUnit.create({
    data: { roomId: core.id, name: "CRAC-CORE", unitType: "CRAC", capacityKw: 90, posX: 12, posY: 1 },
  });
  let breaker = 1;
  for (const rack of [...meet, ...coreRow]) {
    const circuit = await whip(db, panel.id, rack.posY === 3 ? mmr.id : core.id, rack, breaker, "UNDERFLOOR");
    const outlets = await addPdu(db, rack.id, circuit.id, `${rack.code} PDU`, "A");
    await addGear(db, rack.id, templates.patch, {
      name: `${rack.code} patch`,
      type: "PATCH_PANEL",
      startU: 42,
      uHeight: 1,
      watts: 0,
    });
    await addGear(db, rack.id, rack.code.startsWith("MMR") ? templates.router : templates.switch, {
      name: `${rack.code} ${rack.code.startsWith("MMR") ? "router" : "switch"}`,
      type: rack.code.startsWith("MMR") ? "ROUTER" : "SWITCH",
      startU: 38,
      uHeight: 2,
      watts: 420,
      outlets: [outlets[0].id, outlets[1].id],
    });
    breaker += 1;
  }
}

async function buildServerRoom(db: Db, templates: Templates) {
  const { site, floor } = await siteBundle(
    db,
    { name: "Headquarters", code: "HQ", city: "Manchester", country: "United Kingdom", kw: 200 },
    { name: "Office Block", code: "HQ1" },
    { name: "Level 2", level: 2 }
  );
  const room = await makeRoom(db, floor.id, {
    name: "Server Room",
    code: "HQ-SR",
    cols: 10,
    rows: 7,
    coolingKw: 80,
  });
  const panel = await feed(db, site.id, room.id, "HQ", "A", 200);
  const north = await placeRow(db, room.id, { name: "North", y: 3, xs: [3, 5, 7], prefix: "SR-N" });
  const south = await placeRow(db, room.id, { name: "South", y: 6, xs: [3, 5, 7], prefix: "SR-S" });
  await db.coolingUnit.create({
    data: { roomId: room.id, name: "INROW-1", unitType: "IN_ROW", capacityKw: 40, posX: 9, posY: 4 },
  });
  await db.floorTile.createMany({
    data: [3, 5, 7].flatMap((x) =>
      [4, 5].map((y) => ({ roomId: room.id, posX: x, posY: y, surface: "GRILL" }))
    ),
  });
  let breaker = 1;
  for (const rack of [...north, ...south]) {
    const circuit = await whip(db, panel.id, room.id, rack, breaker, "UNDERFLOOR");
    const outlets = await addPdu(db, rack.id, circuit.id, `${rack.code} PDU`, "A");
    await addGear(db, rack.id, templates.switch, {
      name: `${rack.code} switch`,
      type: "SWITCH",
      startU: 40,
      uHeight: 1,
      watts: 280,
      outlets: [outlets[0].id, outlets[1].id],
    });
    await addGear(db, rack.id, templates.server, {
      name: `${rack.code} server`,
      type: "SERVER",
      startU: 36,
      uHeight: 2,
      watts: 650,
      outlets: [outlets[2].id, outlets[3].id],
    });
    if (breaker === 1) {
      await addGear(db, rack.id, templates.storage, {
        name: `${rack.code} storage`,
        type: "STORAGE",
        startU: 32,
        uHeight: 2,
        watts: 700,
        outlets: [outlets[4].id, outlets[5].id],
      });
    }
    breaker += 1;
  }
}

async function buildCloset(db: Db, templates: Templates) {
  const { site, floor } = await siteBundle(
    db,
    { name: "Branch Office", code: "BR1", city: "Bristol", country: "United Kingdom", kw: 20 },
    { name: "High Street", code: "BR-BLDG" },
    { name: "Ground", level: 0 }
  );
  const room = await makeRoom(db, floor.id, {
    name: "Hub Room",
    code: "BR-IDF",
    roomType: "MEET_ME",
    cols: 5,
    rows: 4,
    coolingKw: 5,
  });
  const ups = await db.powerSource.create({
    data: {
      siteId: site.id,
      roomId: room.id,
      name: "Closet UPS",
      sourceType: "UPS",
      redundancyGroup: "A",
      capacityKw: 6,
      voltageV: 230,
      maxAmps: 32,
      batteryRuntimeMins: 20,
    },
  });
  const panel = await db.powerPanel.create({
    data: {
      roomId: room.id,
      upstreamSourceId: ups.id,
      name: "IDF panel",
      feedSide: "A",
      voltageLToL: 230,
      maxAmpsPerPhase: 32,
    },
  });
  const racks = await placeRow(db, room.id, {
    name: "Hub",
    y: 2,
    xs: [3],
    prefix: "IDF",
    totalU: 24,
    watts: 3000,
  });
  await db.floorObstruction.createMany({
    data: [
      { roomId: room.id, posX: 1, posY: 1, label: "Column" },
      { roomId: room.id, posX: 1, posY: 2, label: "Column" },
      { roomId: room.id, posX: 1, posY: 3, label: "Column" },
      { roomId: room.id, posX: 5, posY: 2, label: "Riser" },
    ],
  });
  const rack = racks[0];
  const circuit = await whip(db, panel.id, room.id, rack, 1, "UNDERFLOOR");
  const outlets = await addPdu(db, rack.id, circuit.id, "IDF PDU", "A");
  await addGear(db, rack.id, templates.patch, {
    name: "IDF patch",
    type: "PATCH_PANEL",
    startU: 24,
    uHeight: 1,
    watts: 0,
  });
  await addGear(db, rack.id, templates.switch, {
    name: "IDF switch",
    type: "SWITCH",
    startU: 22,
    uHeight: 1,
    watts: 180,
    outlets: [outlets[0].id, outlets[1].id],
  });
  await addGear(db, rack.id, templates.firewall, {
    name: "IDF firewall",
    type: "FIREWALL",
    startU: 20,
    uHeight: 1,
    watts: 220,
    outlets: [outlets[2].id, outlets[3].id],
  });
}

import { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";

export type Db = Prisma.TransactionClient;

type FieldType = "string" | "int" | "float" | "bool" | "datetime";

interface FieldSpec {
  name: string;
  type: FieldType;
  required?: boolean;
  optional?: boolean;
}

export interface CsvEntity {
  key: string;
  label: string;
  fields: FieldSpec[];
}

const id: FieldSpec = { name: "id", type: "string", optional: true };
const createdAt: FieldSpec = { name: "createdAt", type: "datetime", optional: true };

export const CSV_ENTITIES: CsvEntity[] = [
  {
    key: "sites",
    label: "Sites",
    fields: [
      id,
      { name: "name", type: "string", required: true },
      { name: "code", type: "string", required: true },
      { name: "address", type: "string", required: true },
      { name: "city", type: "string", required: true },
      { name: "country", type: "string", required: true },
      { name: "utilityCapacityKw", type: "float" },
      { name: "pueTarget", type: "float" },
      createdAt,
    ],
  },
  {
    key: "buildings",
    label: "Buildings",
    fields: [
      id,
      { name: "siteId", type: "string", required: true },
      { name: "name", type: "string", required: true },
      { name: "code", type: "string", required: true },
      createdAt,
    ],
  },
  {
    key: "floors",
    label: "Floors",
    fields: [
      id,
      { name: "buildingId", type: "string", required: true },
      { name: "name", type: "string", required: true },
      { name: "levelNumber", type: "int", required: true },
      createdAt,
    ],
  },
  {
    key: "rooms",
    label: "Rooms",
    fields: [
      id,
      { name: "floorId", type: "string", required: true },
      { name: "name", type: "string", required: true },
      { name: "code", type: "string", required: true },
      { name: "roomType", type: "string" },
      { name: "coolingCapacityKw", type: "float" },
      { name: "coolingRedundancy", type: "string" },
      { name: "ambientTempTargetC", type: "float" },
      { name: "humidityTargetPct", type: "float" },
      { name: "widthMm", type: "int" },
      { name: "depthMm", type: "int" },
      { name: "gridCols", type: "int" },
      { name: "gridRows", type: "int" },
      createdAt,
    ],
  },
  {
    key: "rows",
    label: "Rows",
    fields: [
      id,
      { name: "roomId", type: "string", required: true },
      { name: "name", type: "string", required: true },
      { name: "orientation", type: "string" },
      { name: "aisleContainment", type: "string" },
      { name: "gridX", type: "int" },
      { name: "gridY", type: "int" },
      createdAt,
    ],
  },
  {
    key: "racks",
    label: "Racks",
    fields: [
      id,
      { name: "rowId", type: "string", required: true },
      { name: "name", type: "string", required: true },
      { name: "code", type: "string", required: true },
      { name: "totalU", type: "int" },
      { name: "maxWeightKg", type: "float" },
      { name: "maxPowerWatts", type: "float" },
      { name: "widthMm", type: "int" },
      { name: "depthMm", type: "int" },
      { name: "posX", type: "int" },
      { name: "posY", type: "int" },
      createdAt,
    ],
  },
  {
    key: "coolingUnits",
    label: "Cooling units",
    fields: [
      id,
      { name: "roomId", type: "string", required: true },
      { name: "name", type: "string", required: true },
      { name: "unitType", type: "string" },
      { name: "capacityKw", type: "float" },
      { name: "airflowCfm", type: "int" },
      { name: "supplyTempC", type: "float" },
      { name: "returnTempC", type: "float" },
      { name: "status", type: "string" },
      { name: "powerDrawWatts", type: "float" },
      { name: "posX", type: "int" },
      { name: "posY", type: "int" },
      createdAt,
    ],
  },
  {
    key: "floorTiles",
    label: "Floor tiles",
    fields: [
      id,
      { name: "roomId", type: "string", required: true },
      { name: "posX", type: "int", required: true },
      { name: "posY", type: "int", required: true },
      { name: "surface", type: "string" },
    ],
  },
  {
    key: "obstructions",
    label: "Obstructions",
    fields: [
      id,
      { name: "roomId", type: "string", required: true },
      { name: "posX", type: "int", required: true },
      { name: "posY", type: "int", required: true },
      { name: "label", type: "string" },
    ],
  },
  {
    key: "powerSources",
    label: "Power sources",
    fields: [
      id,
      { name: "siteId", type: "string", required: true },
      { name: "roomId", type: "string", optional: true },
      { name: "name", type: "string", required: true },
      { name: "sourceType", type: "string", required: true },
      { name: "redundancyGroup", type: "string" },
      { name: "capacityKw", type: "float" },
      { name: "voltageV", type: "int" },
      { name: "maxAmps", type: "float" },
      { name: "status", type: "string" },
      { name: "batteryRuntimeMins", type: "int", optional: true },
      { name: "fuelRuntimeHours", type: "float", optional: true },
      { name: "upstreamSourceAId", type: "string", optional: true },
      { name: "upstreamSourceBId", type: "string", optional: true },
      createdAt,
    ],
  },
  {
    key: "powerPanels",
    label: "Power panels",
    fields: [
      id,
      { name: "roomId", type: "string", required: true },
      { name: "upstreamSourceId", type: "string", required: true },
      { name: "name", type: "string", required: true },
      { name: "feedSide", type: "string" },
      { name: "voltageLToN", type: "int" },
      { name: "voltageLToL", type: "int" },
      { name: "maxAmpsPerPhase", type: "float" },
      { name: "totalBreakerSlots", type: "int" },
      { name: "status", type: "string" },
      createdAt,
    ],
  },
  {
    key: "powerCircuits",
    label: "Floor sockets",
    fields: [
      id,
      { name: "panelId", type: "string", required: true },
      { name: "roomId", type: "string", required: true },
      { name: "rackId", type: "string", optional: true },
      { name: "name", type: "string", required: true },
      { name: "floorSocketLabel", type: "string", required: true },
      { name: "breakerNumber", type: "int", required: true },
      { name: "phaseAllocation", type: "string" },
      { name: "ratedAmps", type: "float" },
      { name: "voltageV", type: "int" },
      { name: "socketType", type: "string" },
      { name: "status", type: "string" },
      { name: "elevation", type: "string" },
      { name: "posX", type: "int" },
      { name: "posY", type: "int" },
      createdAt,
    ],
  },
  {
    key: "rackPdus",
    label: "Rack PDUs",
    fields: [
      id,
      { name: "rackId", type: "string", required: true },
      { name: "circuitId", type: "string", optional: true },
      { name: "name", type: "string", required: true },
      { name: "model", type: "string" },
      { name: "mounting", type: "string" },
      { name: "startU", type: "int", optional: true },
      { name: "uHeight", type: "int" },
      { name: "feedSide", type: "string" },
      { name: "phaseMode", type: "string" },
      { name: "maxAmps", type: "float" },
      { name: "voltageV", type: "int" },
      { name: "maxWatts", type: "float" },
      { name: "inputPlugType", type: "string" },
      { name: "status", type: "string" },
      createdAt,
    ],
  },
  {
    key: "pduOutlets",
    label: "PDU outlets",
    fields: [
      id,
      { name: "pduId", type: "string", required: true },
      { name: "outletNumber", type: "int", required: true },
      { name: "label", type: "string", required: true },
      { name: "bankPhase", type: "string" },
      { name: "socketType", type: "string" },
      { name: "maxAmps", type: "float" },
    ],
  },
  {
    key: "deviceTemplates",
    label: "Device templates",
    fields: [
      id,
      { name: "manufacturer", type: "string", required: true },
      { name: "model", type: "string", required: true },
      { name: "deviceType", type: "string", required: true },
      { name: "uHeight", type: "int" },
      { name: "defaultWatts", type: "float" },
      { name: "peakWatts", type: "float" },
      { name: "weightKg", type: "float" },
      { name: "psuCount", type: "int" },
      { name: "psuPlugType", type: "string" },
      { name: "portCount", type: "int" },
      { name: "portType", type: "string" },
    ],
  },
  {
    key: "rackDevices",
    label: "Rack devices",
    fields: [
      id,
      { name: "rackId", type: "string", required: true },
      { name: "templateId", type: "string", optional: true },
      { name: "name", type: "string", required: true },
      { name: "hostname", type: "string", optional: true },
      { name: "assetTag", type: "string", optional: true },
      { name: "serialNumber", type: "string", optional: true },
      { name: "deviceType", type: "string" },
      { name: "manufacturer", type: "string" },
      { name: "model", type: "string" },
      { name: "startU", type: "int", required: true },
      { name: "uHeight", type: "int" },
      { name: "face", type: "string" },
      { name: "status", type: "string" },
      { name: "nominalWatts", type: "float" },
      { name: "peakWatts", type: "float" },
      { name: "weightKg", type: "float" },
      createdAt,
    ],
  },
  {
    key: "devicePsus",
    label: "Device PSUs",
    fields: [
      id,
      { name: "deviceId", type: "string", required: true },
      { name: "name", type: "string", required: true },
      { name: "maxWatts", type: "float" },
      { name: "plugType", type: "string" },
      { name: "connectedOutletId", type: "string", optional: true },
      { name: "cableColor", type: "string" },
      { name: "cableLabel", type: "string", optional: true },
    ],
  },
  {
    key: "networkPorts",
    label: "Network ports",
    fields: [
      id,
      { name: "deviceId", type: "string", required: true },
      { name: "name", type: "string", required: true },
      { name: "portNumber", type: "int" },
      { name: "portType", type: "string" },
      { name: "speedGbps", type: "int" },
      { name: "macAddress", type: "string", optional: true },
      { name: "ipAddress", type: "string", optional: true },
      { name: "vlanTag", type: "int", optional: true },
      { name: "isManagement", type: "bool" },
    ],
  },
  {
    key: "networkCables",
    label: "Network cables",
    fields: [
      id,
      { name: "portAId", type: "string", required: true },
      { name: "portBId", type: "string", required: true },
      { name: "cableType", type: "string" },
      { name: "color", type: "string" },
      { name: "label", type: "string", required: true },
      { name: "lengthMeters", type: "float" },
      createdAt,
    ],
  },
];

const SNAPSHOT_ORDER = CSV_ENTITIES.map((entity) => entity.key);

function delegate(db: Db | PrismaClient, key: string): {
  findMany: () => Promise<Record<string, unknown>[]>;
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>;
  upsert: (args: {
    where: { id: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }) => Promise<unknown>;
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
} {
  const map = db as unknown as Record<string, {
    findMany: () => Promise<Record<string, unknown>[]>;
    createMany: (args: { data: Record<string, unknown>[] }) => Promise<unknown>;
    upsert: (args: {
      where: { id: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<unknown>;
    create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
  }>;
  const names: Record<string, string> = {
    sites: "site",
    buildings: "building",
    floors: "floor",
    rooms: "room",
    rows: "row",
    racks: "rack",
    coolingUnits: "coolingUnit",
    floorTiles: "floorTile",
    obstructions: "floorObstruction",
    powerSources: "powerSource",
    powerPanels: "powerPanel",
    powerCircuits: "powerCircuit",
    rackPdus: "rackPdu",
    pduOutlets: "pduOutlet",
    deviceTemplates: "deviceTemplate",
    rackDevices: "rackDevice",
    devicePsus: "devicePsu",
    networkPorts: "networkPort",
    networkCables: "networkCable",
  };
  const model = map[names[key]];
  if (!model) throw new Error(`Unknown entity ${key}`);
  return model;
}

export function entityByKey(key: string) {
  return CSV_ENTITIES.find((entity) => entity.key === key) || null;
}

export async function infrastructureCounts() {
  const [sites, rooms, racks, devices, users] = await Promise.all([
    prisma.site.count(),
    prisma.room.count(),
    prisma.rack.count(),
    prisma.rackDevice.count(),
    prisma.user.count(),
  ]);
  return { sites, rooms, racks, devices, users };
}

export async function exportSnapshot() {
  const tables: Record<string, unknown[]> = {};
  for (const key of SNAPSHOT_ORDER) {
    tables[key] = await delegate(prisma, key).findMany();
  }
  return {
    format: "racker-snapshot",
    version: 1,
    exportedAt: new Date().toISOString(),
    tables,
  };
}

export async function exportEntityCsv(key: string) {
  const entity = entityByKey(key);
  if (!entity) throw new Error("Unknown entity");
  const rows = (await delegate(prisma, key).findMany()) as Record<string, unknown>[];
  const headers = entity.fields.map((field) => field.name);
  return { filename: `racker-${key}.csv`, csv: toCsv(headers, rows) };
}

export async function wipeInfrastructure(db: Db | PrismaClient = prisma) {
  await db.networkCable.deleteMany();
  await db.devicePsu.deleteMany();
  await db.networkPort.deleteMany();
  await db.pduOutlet.deleteMany();
  await db.rackPdu.deleteMany();
  await db.rackDevice.deleteMany();
  await db.powerCircuit.deleteMany();
  await db.powerPanel.deleteMany();
  await db.powerSource.updateMany({
    data: { upstreamSourceAId: null, upstreamSourceBId: null },
  });
  await db.powerSource.deleteMany();
  await db.floorObstruction.deleteMany();
  await db.floorTile.deleteMany();
  await db.coolingUnit.deleteMany();
  await db.rack.deleteMany();
  await db.row.deleteMany();
  await db.room.deleteMany();
  await db.floor.deleteMany();
  await db.locationMedia.deleteMany();
  await db.building.deleteMany();
  await db.site.deleteMany();
  await db.deviceTemplate.deleteMany();
}

export async function replaceWithSnapshot(snapshot: unknown) {
  const parsed = parseSnapshot(snapshot);
  await prisma.$transaction(
    async (tx) => {
      await wipeInfrastructure(tx);
      await insertTables(tx, parsed.tables);
    },
    { timeout: 120000, maxWait: 10000 }
  );
}

export async function importEntityCsv(key: string, csv: string) {
  const entity = entityByKey(key);
  if (!entity) throw new Error("Unknown entity");
  const matrix = parseCsv(csv);
  if (matrix.length < 2) throw new Error("CSV needs a header row and at least one record");
  const headers = matrix[0].map((cell) => cell.trim());
  const known = new Set(entity.fields.map((field) => field.name));
  for (const header of headers) {
    if (header && !known.has(header)) {
      throw new Error(`Unknown column ${header}`);
    }
  }
  let written = 0;
  await prisma.$transaction(
    async (tx) => {
      for (let index = 1; index < matrix.length; index++) {
        const record: Record<string, string> = {};
        headers.forEach((header, column) => {
          if (header) record[header] = matrix[index][column] ?? "";
        });
        const data = rowToData(entity, record, index + 1);
        const rowId = typeof data.id === "string" ? data.id : "";
        delete data.id;
        const model = delegate(tx, key);
        if (rowId) {
          await model.upsert({
            where: { id: rowId },
            create: { ...data, id: rowId },
            update: data,
          });
        } else {
          await model.create({ data });
        }
        written += 1;
      }
    },
    { timeout: 120000, maxWait: 10000 }
  );
  return written;
}

async function insertTables(db: Db, tables: Record<string, Record<string, unknown>[]>) {
  for (const key of SNAPSHOT_ORDER) {
    const rows = tables[key] || [];
    if (!rows.length) continue;
    if (key === "powerSources") {
      await db.powerSource.createMany({
        data: rows.map((row) => ({
          ...row,
          upstreamSourceAId: null,
          upstreamSourceBId: null,
        })) as Prisma.PowerSourceCreateManyInput[],
      });
      for (const row of rows) {
        if (row.upstreamSourceAId || row.upstreamSourceBId) {
          await db.powerSource.update({
            where: { id: String(row.id) },
            data: {
              upstreamSourceAId: (row.upstreamSourceAId as string) || null,
              upstreamSourceBId: (row.upstreamSourceBId as string) || null,
            },
          });
        }
      }
      continue;
    }
    await delegate(db, key).createMany({ data: rows });
  }
}

function parseSnapshot(snapshot: unknown): {
  tables: Record<string, Record<string, unknown>[]>;
} {
  if (!snapshot || typeof snapshot !== "object") {
    throw new Error("Snapshot must be a JSON object");
  }
  const body = snapshot as { format?: string; version?: number; tables?: unknown };
  if (body.format !== "racker-snapshot" || body.version !== 1) {
    throw new Error("File is not a Racker snapshot version 1");
  }
  if (!body.tables || typeof body.tables !== "object") {
    throw new Error("Snapshot is missing tables");
  }
  const tables: Record<string, Record<string, unknown>[]> = {};
  for (const key of SNAPSHOT_ORDER) {
    const rows = (body.tables as Record<string, unknown>)[key];
    if (rows == null) {
      tables[key] = [];
      continue;
    }
    if (!Array.isArray(rows)) throw new Error(`Table ${key} must be an array`);
    tables[key] = rows as Record<string, unknown>[];
  }
  return { tables };
}

function rowToData(entity: CsvEntity, record: Record<string, string>, line: number) {
  const data: Record<string, unknown> = {};
  for (const field of entity.fields) {
    if (!(field.name in record)) {
      if (field.required) throw new Error(`Line ${line}: missing ${field.name}`);
      continue;
    }
    const raw = record[field.name].trim();
    if (raw === "") {
      if (field.name === "id" || field.name === "createdAt") continue;
      if (field.optional) data[field.name] = null;
      else if (field.required) throw new Error(`Line ${line}: missing ${field.name}`);
      continue;
    }
    data[field.name] = coerce(field, raw, line);
  }
  return data;
}

function coerce(field: FieldSpec, raw: string, line: number) {
  if (field.type === "int") {
    const value = Number.parseInt(raw, 10);
    if (!Number.isFinite(value)) throw new Error(`Line ${line}: ${field.name} is not an integer`);
    return value;
  }
  if (field.type === "float") {
    const value = Number(raw);
    if (!Number.isFinite(value)) throw new Error(`Line ${line}: ${field.name} is not a number`);
    return value;
  }
  if (field.type === "bool") return raw === "true" || raw === "1";
  if (field.type === "datetime") {
    const value = new Date(raw);
    if (Number.isNaN(value.getTime())) throw new Error(`Line ${line}: ${field.name} is not a date`);
    return value;
  }
  return raw;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      cell = "";
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
    } else cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    if (row.some((value) => value.length > 0)) rows.push(row);
  }
  return rows;
}

function toCsv(headers: string[], records: Record<string, unknown>[]) {
  const lines = [headers.join(",")];
  for (const record of records) {
    lines.push(headers.map((header) => csvEscape(record[header])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

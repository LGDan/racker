import { parseCsv } from "@/lib/system-data";
import {
  CatalogError,
  btuFromWatts,
  readAppliance,
  readPduTemplate,
} from "@/lib/appliance-catalog";

export const CATALOG_CSV_COLUMNS = [
  "id",
  "name",
  "manufacturer",
  "model",
  "deviceType",
  "uHeight",
  "defaultWatts",
  "peakWatts",
  "btuPerHour",
  "weightKg",
  "psuCount",
  "psuPlugType",
  "portCount",
  "portType",
] as const;

export const PDU_CATALOG_CSV_COLUMNS = [
  "id",
  "name",
  "manufacturer",
  "model",
  "mounting",
  "uHeight",
  "phaseMode",
  "maxAmps",
  "voltageV",
  "inputPlugType",
  "outletSpecs",
] as const;

const REQUIRED_COLUMNS = CATALOG_CSV_COLUMNS.filter(
  (column) => column !== "id" && column !== "btuPerHour"
);

const REQUIRED_PDU_COLUMNS = PDU_CATALOG_CSV_COLUMNS.filter(
  (column) => column !== "id" && column !== "uHeight"
);

export function catalogToCsv(rows: Record<string, unknown>[]) {
  const lines = [CATALOG_CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(CATALOG_CSV_COLUMNS.map((column) => csvEscape(row[column])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function pduCatalogToCsv(rows: Record<string, unknown>[]) {
  const lines = [PDU_CATALOG_CSV_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(PDU_CATALOG_CSV_COLUMNS.map((column) => csvEscape(row[column])).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function appliancesFromCsv(csv: string) {
  if (csv.length > 2_000_000) throw new CatalogError("CSV is too large");
  const matrix = parseCsv(csv);
  if (matrix.length < 1) throw new CatalogError("CSV needs a header row");
  const headers = matrix[0].map((cell) => cell.trim());
  const known = new Set<string>(CATALOG_CSV_COLUMNS);
  for (const header of headers) {
    if (header && !known.has(header)) throw new CatalogError(`Unknown column ${header}`);
  }
  for (const column of REQUIRED_COLUMNS) {
    if (!headers.includes(column)) throw new CatalogError(`Missing column ${column}`);
  }

  const seen = new Set<string>();
  const rows: { id: string; data: ReturnType<typeof readAppliance> }[] = [];
  for (let index = 1; index < matrix.length; index++) {
    const record: Record<string, string> = {};
    headers.forEach((header, column) => {
      if (header) record[header] = matrix[index][column] ?? "";
    });
    if (Object.values(record).every((value) => !value.trim())) continue;
    const line = index + 1;
    const id = (record.id || "").trim();
    if (id) {
      if (seen.has(id)) throw new CatalogError(`Line ${line}: duplicate id ${id}`);
      seen.add(id);
    }
    if (!String(record.btuPerHour ?? "").trim()) {
      record.btuPerHour = String(btuFromWatts(Number(record.defaultWatts)));
    }
    try {
      rows.push({ id, data: readAppliance(record) });
    } catch (err) {
      if (err instanceof CatalogError) throw new CatalogError(`Line ${line}: ${err.message}`);
      throw err;
    }
  }
  return rows;
}

export function pdusFromCsv(csv: string) {
  if (csv.length > 2_000_000) throw new CatalogError("CSV is too large");
  const matrix = parseCsv(csv);
  if (matrix.length < 1) throw new CatalogError("CSV needs a header row");
  const headers = matrix[0].map((cell) => cell.trim());
  const known = new Set<string>(PDU_CATALOG_CSV_COLUMNS);
  for (const header of headers) {
    if (header && !known.has(header)) throw new CatalogError(`Unknown column ${header}`);
  }
  for (const column of REQUIRED_PDU_COLUMNS) {
    if (!headers.includes(column)) throw new CatalogError(`Missing column ${column}`);
  }

  const seen = new Set<string>();
  const rows: { id: string; data: ReturnType<typeof readPduTemplate> }[] = [];
  for (let index = 1; index < matrix.length; index++) {
    const record: Record<string, string> = {};
    headers.forEach((header, column) => {
      if (header) record[header] = matrix[index][column] ?? "";
    });
    if (Object.values(record).every((value) => !value.trim())) continue;
    const line = index + 1;
    const id = (record.id || "").trim();
    if (id) {
      if (seen.has(id)) throw new CatalogError(`Line ${line}: duplicate id ${id}`);
      seen.add(id);
    }
    if (!String(record.uHeight ?? "").trim()) {
      record.uHeight = record.mounting === "RACKMOUNT" ? "1" : "0";
    }
    try {
      rows.push({ id, data: readPduTemplate(record) });
    } catch (err) {
      if (err instanceof CatalogError) throw new CatalogError(`Line ${line}: ${err.message}`);
      throw err;
    }
  }
  return rows;
}

function csvEscape(value: unknown) {
  if (value == null) return "";
  const text = String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export const APPLIANCE_TYPES = [
  "SERVER",
  "SWITCH",
  "ROUTER",
  "FIREWALL",
  "STORAGE",
  "PATCH_PANEL",
  "UPS_RACK",
] as const;

export const PLUG_TYPES = [
  "C14",
  "C20",
  "UK_BS1363",
  "SCHUKO",
  "NEMA_5_15P",
  "NEMA_L6_30P",
] as const;

export const PDU_SOCKET_TYPES = [
  "C13",
  "C19",
  "UK_BS1363",
  "SCHUKO",
  "NEMA_5_15R",
  "NEMA_L6_30R",
] as const;

export type PduSocketType = (typeof PDU_SOCKET_TYPES)[number];

export const PDU_MOUNTING_TYPES = [
  "ZERO_U_LEFT",
  "ZERO_U_RIGHT",
  "RACKMOUNT",
] as const;

export const PDU_PHASE_MODES = ["SINGLE_PHASE", "THREE_PHASE"] as const;

export const PDU_INPUT_PLUG_TYPES = [
  "IEC_60309_32A_1P",
  "IEC_60309_32A_3P",
  "IEC_60309_63A_3P",
  "NEMA_L6_30P",
] as const;

export const PORT_TYPES = [
  "SFP28_25G",
  "SFP_10G",
  "QSFP28_100G",
  "RJ45_1G",
  "RJ45_10G",
  "FIBER_LC",
] as const;

export interface OutletBankSpec {
  socketType: PduSocketType;
  count: number;
}

export function socketMaxAmps(socketType: string): number {
  switch (socketType) {
    case "C19":
    case "SCHUKO":
      return 16;
    case "UK_BS1363":
      return 13;
    case "NEMA_5_15R":
      return 15;
    case "NEMA_L6_30R":
      return 30;
    default:
      return 10;
  }
}

export function plugFitsSocket(
  plug: string,
  socket: string
): { ok: boolean; warning?: string } {
  if (plug === "C14" && socket === "C13") return { ok: true };
  if (plug === "C14" && socket === "C19") {
    return { ok: true, warning: "C14 fits a C19 via adapter, though C13 is standard." };
  }
  if (plug === "C20" && socket === "C19") return { ok: true };
  if (plug === "C20" && socket === "C13") {
    return { ok: false, warning: "A C20 plug cannot mate with a C13 outlet. Use a C19." };
  }
  if (plug === "UK_BS1363" && socket === "UK_BS1363") return { ok: true };
  if (plug === "SCHUKO" && socket === "SCHUKO") return { ok: true };
  if (plug === "NEMA_5_15P" && socket === "NEMA_5_15R") return { ok: true };
  if (plug === "NEMA_L6_30P" && socket === "NEMA_L6_30R") return { ok: true };
  return {
    ok: false,
    warning: `A ${plug} plug cannot mate with a ${socket} outlet.`,
  };
}

export function parseOutletSpecs(spec: string | null | undefined): OutletBankSpec[] {
  const raw = String(spec || "").trim();
  if (!raw) {
    return [
      { socketType: "C13", count: 12 },
      { socketType: "C19", count: 4 },
    ];
  }
  const allowed = new Set<string>(PDU_SOCKET_TYPES);
  const banks: OutletBankSpec[] = [];
  for (const part of raw.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const [rawType, rawCount] = token.split(":").map((s) => s.trim());
    const count = Number.parseInt(rawCount || "0", 10);
    if (allowed.has(rawType) && Number.isInteger(count) && count > 0) {
      const existing = banks.find((b) => b.socketType === rawType);
      if (existing) existing.count += count;
      else banks.push({ socketType: rawType as PduSocketType, count });
    }
  }
  return banks.length > 0
    ? banks
    : [
        { socketType: "C13", count: 12 },
        { socketType: "C19", count: 4 },
      ];
}

export function formatOutletSpecs(banks: readonly OutletBankSpec[]): string {
  return banks
    .filter((b) => b.count > 0)
    .map((b) => `${b.socketType}:${b.count}`)
    .join(",");
}

export function describeOutletSpecs(spec: string | null | undefined): string {
  const banks = parseOutletSpecs(spec);
  const total = banks.reduce((sum, b) => sum + b.count, 0);
  const breakdown = banks.map((b) => `${b.count}× ${b.socketType}`).join(" + ");
  return `${total} total (${breakdown})`;
}

export function pduMaxWatts(phaseMode: string, maxAmps: number, voltageV: number): number {
  if (phaseMode === "THREE_PHASE") {
    return Math.round(maxAmps * 230 * 3);
  }
  return Math.round(maxAmps * voltageV);
}

export function btuFromWatts(watts: number) {
  if (!Number.isFinite(watts) || watts <= 0) return 0;
  return Math.round(watts * 3.412);
}

export function applianceLabel(item: {
  name?: string | null;
  manufacturer?: string | null;
  model?: string | null;
}) {
  const name = item.name?.trim();
  if (name) return name;
  return `${item.manufacturer || ""} ${item.model || ""}`.trim() || "Appliance";
}

export function heatBtu(item: { btuPerHour?: number | null; defaultWatts?: number | null }) {
  const stored = Number(item.btuPerHour || 0);
  if (stored > 0) return stored;
  return btuFromWatts(Number(item.defaultWatts || 0));
}

export class CatalogError extends Error {}

export function readAppliance(body: Record<string, unknown>) {
  const name = text(body.name, "Name");
  const manufacturer = text(body.manufacturer, "Manufacturer");
  const model = text(body.model, "Model");
  const deviceType = oneOf(body.deviceType, APPLIANCE_TYPES, "Type");
  const uHeight = whole(body.uHeight, "Height");
  if (uHeight < 1 || uHeight > 58) throw new CatalogError("Height must be between 1U and 58U");
  const defaultWatts = number(body.defaultWatts, "Watts");
  const peakWatts = number(body.peakWatts, "Peak watts");
  if (defaultWatts < 0 || peakWatts < 0) throw new CatalogError("Watts must be zero or more");
  const btuPerHour = number(body.btuPerHour, "BTU");
  if (btuPerHour < 0) throw new CatalogError("BTU must be zero or more");
  const weightKg = number(body.weightKg, "Weight");
  if (weightKg < 0) throw new CatalogError("Weight must be zero or more");
  const psuCount = whole(body.psuCount, "PSUs");
  if (psuCount < 0 || psuCount > 8) throw new CatalogError("PSUs must be between 0 and 8");
  const psuPlugType = oneOf(body.psuPlugType, PLUG_TYPES, "Plug");
  const portCount = whole(body.portCount, "Ports");
  if (portCount < 0 || portCount > 256) throw new CatalogError("Ports must be between 0 and 256");
  const portType = oneOf(body.portType, PORT_TYPES, "Port type");
  return {
    name,
    manufacturer,
    model,
    deviceType,
    uHeight,
    defaultWatts,
    peakWatts,
    btuPerHour,
    weightKg,
    psuCount,
    psuPlugType,
    portCount,
    portType,
  };
}

export function readPduTemplate(body: Record<string, unknown>) {
  const name = text(body.name, "Name");
  const manufacturer = text(body.manufacturer, "Manufacturer");
  const model = text(body.model, "Model");
  const mounting = oneOf(body.mounting, PDU_MOUNTING_TYPES, "Mounting");
  const uHeight = mounting === "RACKMOUNT" ? whole(body.uHeight ?? 1, "Height") : 0;
  if (mounting === "RACKMOUNT" && (uHeight < 1 || uHeight > 4)) {
    throw new CatalogError("Rackmount PDU height must be between 1U and 4U");
  }
  const phaseMode = oneOf(body.phaseMode, PDU_PHASE_MODES, "Phase mode");
  const maxAmps = number(body.maxAmps, "Max amps");
  if (maxAmps <= 0 || maxAmps > 125) {
    throw new CatalogError("Max amps must be between 1 and 125");
  }
  const voltageV = whole(body.voltageV, "Voltage");
  if (voltageV < 100 || voltageV > 480) {
    throw new CatalogError("Voltage must be between 100V and 480V");
  }
  const inputPlugType = oneOf(body.inputPlugType, PDU_INPUT_PLUG_TYPES, "Input plug");
  const rawSpecs = String(body.outletSpecs ?? "").trim();
  if (!rawSpecs) throw new CatalogError("At least one socket bank is required");
  const allowed = new Set<string>(PDU_SOCKET_TYPES);
  const banks: OutletBankSpec[] = [];
  for (const part of rawSpecs.split(",")) {
    const token = part.trim();
    if (!token) continue;
    const [rawType, rawCount] = token.split(":").map((s) => s.trim());
    if (!allowed.has(rawType)) {
      throw new CatalogError(`Socket type ${rawType || "(blank)"} is not valid`);
    }
    const count = Number(rawCount);
    if (!Number.isInteger(count) || count < 1 || count > 64) {
      throw new CatalogError(`Socket count for ${rawType} must be between 1 and 64`);
    }
    const existing = banks.find((b) => b.socketType === rawType);
    if (existing) existing.count += count;
    else banks.push({ socketType: rawType as PduSocketType, count });
  }
  const totalOutlets = banks.reduce((sum, b) => sum + b.count, 0);
  if (totalOutlets < 1 || totalOutlets > 64) {
    throw new CatalogError("Total PDU sockets must be between 1 and 64");
  }
  return {
    name,
    manufacturer,
    model,
    mounting,
    uHeight,
    phaseMode,
    maxAmps,
    voltageV,
    inputPlugType,
    outletSpecs: formatOutletSpecs(banks),
  };
}

function text(value: unknown, label: string) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) throw new CatalogError(`${label} is required`);
  return trimmed;
}

function number(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new CatalogError(`${label} must be a number`);
  return parsed;
}

function whole(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw new CatalogError(`${label} must be a whole number`);
  return parsed;
}

function oneOf(value: unknown, allowed: readonly string[], label: string) {
  const textValue = String(value ?? "");
  if (!allowed.includes(textValue)) throw new CatalogError(`${label} is not valid`);
  return textValue;
}

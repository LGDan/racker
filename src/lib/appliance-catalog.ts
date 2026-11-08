export const APPLIANCE_TYPES = [
  "SERVER",
  "SWITCH",
  "ROUTER",
  "FIREWALL",
  "STORAGE",
  "PATCH_PANEL",
  "UPS_RACK",
] as const;

export const PLUG_TYPES = ["C14", "C20"] as const;

export const PORT_TYPES = [
  "SFP28_25G",
  "SFP_10G",
  "QSFP28_100G",
  "RJ45_1G",
  "RJ45_10G",
  "FIBER_LC",
] as const;

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

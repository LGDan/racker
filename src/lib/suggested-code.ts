export type SuggestKind =
  | "SITE"
  | "BUILDING"
  | "FLOOR"
  | "ROOM"
  | "ROW"
  | "RACK"
  | "SERVER"
  | "SWITCH"
  | "ROUTER"
  | "FIREWALL"
  | "STORAGE"
  | "PATCH_PANEL"
  | "UPS_RACK";

const LOCAL_PREFIX: Record<SuggestKind, string> = {
  SITE: "",
  BUILDING: "b",
  FLOOR: "f",
  ROOM: "cs",
  ROW: "row",
  RACK: "r",
  SERVER: "s",
  SWITCH: "sw",
  ROUTER: "rt",
  FIREWALL: "fw",
  STORAGE: "st",
  PATCH_PANEL: "pp",
  UPS_RACK: "ups",
};

const DEVICE_KINDS = new Set<SuggestKind>([
  "SERVER",
  "SWITCH",
  "ROUTER",
  "FIREWALL",
  "STORAGE",
  "PATCH_PANEL",
  "UPS_RACK",
]);

const INDEXED_KINDS = new Set<SuggestKind>([
  "ROOM",
  "ROW",
  "RACK",
  "SERVER",
  "SWITCH",
  "ROUTER",
  "FIREWALL",
  "STORAGE",
  "PATCH_PANEL",
  "UPS_RACK",
]);

interface Ident {
  code?: string | null;
  name: string;
}

interface CodeRack extends Ident {
  id: string;
  devices?: { name: string; hostname?: string | null; deviceType?: string }[];
}

interface CodeNode extends Ident {
  id: string;
  buildings?: CodeNode[];
  floors?: CodeNode[];
  rooms?: CodeNode[];
  rows?: CodeNode[];
  racks?: CodeRack[];
}

interface Step {
  kind: SuggestKind;
  node: Ident;
  index: number;
}

export function slugToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The part of a stored code or name that this level adds, after its parent path. */
export function localSegment(raw: string, parentPath: string): string {
  let token = slugToken(raw);
  if (!token) return "";
  const parent = parentPath.trim().toLowerCase();
  if (!parent) return token;
  if (token === parent) return "";
  if (token.startsWith(`${parent}.`)) return token.slice(parent.length + 1);
  const flatParent = parent.replace(/\./g, "-");
  if (token.startsWith(`${flatParent}-`)) return token.slice(flatParent.length + 1);
  const tail = parent.split(".").pop() || "";
  if (tail && token.startsWith(`${tail}-`)) return token.slice(tail.length + 1);
  return token;
}

export function appendSegment(parentPath: string, local: string): string {
  const part = slugToken(local);
  if (!part) return parentPath;
  if (!parentPath) return part;
  if (part === parentPath || part.startsWith(`${parentPath}.`)) return part;
  if (parentPath === part || parentPath.endsWith(`.${part}`)) return parentPath;
  return `${parentPath}.${part}`;
}

function dottedLocal(code: string | null | undefined, parentPath: string): string {
  const text = (code || "").trim();
  if (!text.includes(".")) return "";
  return localSegment(text, parentPath);
}

function stepSegment(step: Step, parentPath: string): string {
  const chosen = dottedLocal(step.node.code, parentPath);
  if (chosen) return chosen;
  if (INDEXED_KINDS.has(step.kind)) return `${LOCAL_PREFIX[step.kind]}${step.index}`;
  return localSegment((step.node.code && step.node.code.trim()) || step.node.name, parentPath);
}

function pathFromSteps(steps: Step[]): string {
  let path = "";
  for (const step of steps) path = appendSegment(path, stepSegment(step, path));
  return path;
}

function nextLocal(kind: SuggestKind, siblings: Ident[], parentPath: string): string {
  const prefix = LOCAL_PREFIX[kind];
  if (!prefix) return "";
  const pattern = new RegExp(`^${prefix}(\\d+)$`);
  let max = 0;
  for (const sibling of siblings) {
    const local = dottedLocal(sibling.code, parentPath);
    const match = local.match(pattern);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${max + 1}`;
}

export function suggestedCode(
  sites: CodeNode[],
  kind: SuggestKind,
  parentId: string,
  name: string
): string {
  const { steps, siblings } = collect(sites, kind, parentId);
  const parentPath = pathFromSteps(steps);
  // Sites, buildings, and floors take their token from the name. Rooms, rows,
  // racks, and devices keep a numbered suggestion until someone edits it.
  const fromName = INDEXED_KINDS.has(kind) ? "" : slugToken(name);
  const local = fromName || nextLocal(kind, siblings, parentPath);
  return appendSegment(parentPath, local);
}

/** Recommended id for an entity that already exists, including its own segment. */
export function placedCode(sites: CodeNode[], kind: SuggestKind, id: string, name = ""): string {
  const found = findSelf(sites, kind, id);
  if (!found) return slugToken(name);
  const parentPath = pathFromSteps(found.steps);
  const chosen = dottedLocal(found.node.code, parentPath);
  if (chosen) return appendSegment(parentPath, chosen);
  if (!INDEXED_KINDS.has(kind)) {
    return appendSegment(
      parentPath,
      slugToken(name) || localSegment((found.node.code && found.node.code.trim()) || found.node.name, parentPath)
    );
  }
  return appendSegment(parentPath, `${LOCAL_PREFIX[kind]}${found.index}`);
}

export function deviceKind(deviceType: string): SuggestKind {
  const kind = deviceType as SuggestKind;
  return DEVICE_KINDS.has(kind) ? kind : "SERVER";
}

function collect(
  sites: CodeNode[],
  kind: SuggestKind,
  parentId: string
): { steps: Step[]; siblings: Ident[] } {
  if (kind === "SITE") return { steps: [], siblings: sites.map(ident) };
  for (const site of sites) {
    const siteStep = step("SITE", site, 1);
    if (kind === "BUILDING" && site.id === parentId) {
      return { steps: [siteStep], siblings: (site.buildings || []).map(ident) };
    }
    for (const [buildingIndex, building] of entries(site.buildings)) {
      const buildingStep = step("BUILDING", building, buildingIndex + 1);
      if (kind === "FLOOR" && building.id === parentId) {
        return { steps: [siteStep, buildingStep], siblings: (building.floors || []).map(ident) };
      }
      for (const [floorIndex, floor] of entries(building.floors)) {
        const floorStep = step("FLOOR", floor, floorIndex + 1);
        if (kind === "ROOM" && floor.id === parentId) {
          return {
            steps: [siteStep, buildingStep, floorStep],
            siblings: (floor.rooms || []).map(ident),
          };
        }
        for (const [roomIndex, room] of entries(floor.rooms)) {
          const roomStep = step("ROOM", room, roomIndex + 1);
          if (kind === "ROW" && room.id === parentId) {
            return {
              steps: [siteStep, buildingStep, floorStep, roomStep],
              siblings: (room.rows || []).map(ident),
            };
          }
          for (const [rowIndex, row] of entries(room.rows)) {
            const rowStep = step("ROW", row, rowIndex + 1);
            if (kind === "RACK" && row.id === parentId) {
              return {
                steps: [siteStep, buildingStep, floorStep, roomStep, rowStep],
                siblings: (row.racks || []).map(ident),
              };
            }
            for (const [rackIndex, rack] of entries(row.racks)) {
              if (!DEVICE_KINDS.has(kind) || rack.id !== parentId) continue;
              return {
                steps: [
                  siteStep,
                  buildingStep,
                  floorStep,
                  roomStep,
                  rowStep,
                  step("RACK", rack, rackIndex + 1),
                ],
                siblings: (rack.devices || []).map((device) => ({
                  name: device.name,
                  code: device.hostname,
                })),
              };
            }
          }
        }
      }
    }
  }
  return { steps: [], siblings: [] };
}

function findSelf(
  sites: CodeNode[],
  kind: SuggestKind,
  id: string
): { steps: Step[]; node: Ident; index: number } | null {
  for (const [siteIndex, site] of entries(sites)) {
    if (kind === "SITE" && site.id === id) return { steps: [], node: ident(site), index: siteIndex + 1 };
    for (const [buildingIndex, building] of entries(site.buildings)) {
      if (kind === "BUILDING" && building.id === id) {
        return { steps: [step("SITE", site, 1)], node: ident(building), index: buildingIndex + 1 };
      }
      for (const [floorIndex, floor] of entries(building.floors)) {
        const floorSteps = [step("SITE", site, 1), step("BUILDING", building, buildingIndex + 1)];
        if (kind === "FLOOR" && floor.id === id) {
          return { steps: floorSteps, node: ident(floor), index: floorIndex + 1 };
        }
        for (const [roomIndex, room] of entries(floor.rooms)) {
          const roomSteps = [...floorSteps, step("FLOOR", floor, floorIndex + 1)];
          if (kind === "ROOM" && room.id === id) {
            return { steps: roomSteps, node: ident(room), index: roomIndex + 1 };
          }
          for (const [rowIndex, row] of entries(room.rows)) {
            const rowSteps = [...roomSteps, step("ROOM", room, roomIndex + 1)];
            if (kind === "ROW" && row.id === id) {
              return { steps: rowSteps, node: ident(row), index: rowIndex + 1 };
            }
            for (const [rackIndex, rack] of entries(row.racks)) {
              if (kind === "RACK" && rack.id === id) {
                return {
                  steps: [...rowSteps, step("ROW", row, rowIndex + 1)],
                  node: ident(rack),
                  index: rackIndex + 1,
                };
              }
            }
          }
        }
      }
    }
  }
  return null;
}

function step(kind: SuggestKind, node: Ident, index: number): Step {
  return { kind, node: ident(node), index };
}

function ident(node: Ident): Ident {
  return { code: node.code, name: node.name };
}

function entries<T>(items: T[] | undefined): [number, T][] {
  return (items || []).map((item, index) => [index, item]);
}

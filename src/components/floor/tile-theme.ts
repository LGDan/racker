import type { ThemeName } from "@/components/layout/ThemeToggle";

export interface FloorTilePaint {
  blank: string;
  blankFocus: string;
  grill: string;
  grillFocus: string;
  obstruct: string;
  obstructFocus: string;
  legendObstruct: string;
  legendGrill: string;
  scene: string;
  slab: string;
  grillPlate: string;
  grillBar: string;
}

export function floorTilePaint(theme: ThemeName): FloorTilePaint {
  if (theme === "light") {
    return {
      blank: "#e2e8f0",
      blankFocus: "#cbd5e1",
      grill: "repeating-linear-gradient(90deg, rgba(8,145,178,0.55) 0 2px, #e2e8f0 2px 8px)",
      grillFocus:
        "repeating-linear-gradient(90deg, rgba(8,145,178,0.9) 0 3px, #ecfeff 3px 10px)",
      obstruct:
        "repeating-linear-gradient(-45deg, rgba(71,85,105,0.55) 0 2px, transparent 2px 7px)",
      obstructFocus:
        "repeating-linear-gradient(-45deg, rgba(71,85,105,0.85) 0 3px, #f8fafc 3px 8px)",
      legendObstruct: "repeating-linear-gradient(-45deg, #64748b 0 1px, #e2e8f0 1px 3px)",
      legendGrill: "repeating-linear-gradient(90deg, #0891b2 0 1px, #e2e8f0 1px 3px)",
      scene: "#f8fafc",
      slab: "#d5dee8",
      grillPlate: "#e0f2fe",
      grillBar: "#0891b2",
    };
  }
  return {
    blank: "#020617",
    blankFocus: "#0f172a",
    grill: "repeating-linear-gradient(90deg, rgba(34,211,238,0.28) 0 2px, rgba(15,23,42,0.95) 2px 8px)",
    grillFocus:
      "repeating-linear-gradient(90deg, rgba(34,211,238,0.85) 0 3px, rgba(8,47,73,0.95) 3px 10px)",
    obstruct:
      "repeating-linear-gradient(-45deg, rgba(148,163,184,0.45) 0 2px, transparent 2px 7px)",
    obstructFocus:
      "repeating-linear-gradient(-45deg, rgba(148,163,184,0.95) 0 3px, rgba(30,41,59,0.96) 3px 8px)",
    legendObstruct: "repeating-linear-gradient(-45deg, #94a3b8 0 1px, #334155 1px 3px)",
    legendGrill: "repeating-linear-gradient(90deg, #22d3ee 0 1px, transparent 1px 3px)",
    scene: "#020617",
    slab: "#1e293b",
    grillPlate: "#0f172a",
    grillBar: "#22d3ee",
  };
}

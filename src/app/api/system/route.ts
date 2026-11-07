import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-guards";
import { prisma } from "@/lib/db";
import {
  CSV_ENTITIES,
  exportEntityCsv,
  exportSnapshot,
  importEntityCsv,
  infrastructureCounts,
  replaceWithSnapshot,
  wipeInfrastructure,
} from "@/lib/system-data";
import { SCENARIOS, isScenario, provisionScenario } from "@/lib/system-scenarios";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  const format = req.nextUrl.searchParams.get("format");
  if (format === "json") {
    const snapshot = await exportSnapshot();
    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="racker-snapshot.json"`,
      },
    });
  }
  if (format === "csv") {
    const entity = req.nextUrl.searchParams.get("entity") || "";
    try {
      const file = await exportEntityCsv(entity);
      return new NextResponse(file.csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${file.filename}"`,
        },
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Export failed" },
        { status: 400 }
      );
    }
  }
  const counts = await infrastructureCounts();
  return NextResponse.json({
    counts,
    entities: CSV_ENTITIES.map((entity) => ({ key: entity.key, label: entity.label })),
    scenarios: SCENARIOS,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;
  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "IMPORT_SNAPSHOT") {
      await replaceWithSnapshot(body.snapshot);
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "IMPORT_SNAPSHOT",
          entityType: "SYSTEM",
          details: "Replaced infrastructure from a JSON snapshot. User accounts were kept.",
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "IMPORT_CSV") {
      const written = await importEntityCsv(String(body.entity || ""), String(body.csv || ""));
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "IMPORT_CSV",
          entityType: String(body.entity || "CSV"),
          details: `Upserted ${written} ${body.entity} rows from CSV`,
        },
      });
      return NextResponse.json({ ok: true, written });
    }

    if (action === "WIPE") {
      if (body.confirm !== "WIPE") {
        return NextResponse.json(
          { error: "Type WIPE to confirm. Accounts are kept." },
          { status: 400 }
        );
      }
      await prisma.$transaction(async (tx) => {
        await wipeInfrastructure(tx);
        await tx.auditLog.create({
          data: {
            userId: auth.user.id,
            action: "WIPE_INFRASTRUCTURE",
            entityType: "SYSTEM",
            details: "Removed sites, rooms, racks, power, and devices. User accounts were kept.",
          },
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "PROVISION") {
      const scenario = String(body.scenario || "");
      if (!isScenario(scenario)) {
        return NextResponse.json({ error: "Unknown scenario" }, { status: 400 });
      }
      if (body.confirm !== "REPLACE") {
        return NextResponse.json(
          { error: "Confirm REPLACE. This removes the current infrastructure." },
          { status: 400 }
        );
      }
      await provisionScenario(scenario);
      const chosen = SCENARIOS.find((item) => item.id === scenario);
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "PROVISION_SCENARIO",
          entityType: "SYSTEM",
          details: `Provisioned ${chosen?.name || scenario}. User accounts were kept.`,
        },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    console.error("System management error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "System action failed" },
      { status: 400 }
    );
  }
}

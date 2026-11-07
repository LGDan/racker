import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth-guards";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const sites = await prisma.site.findMany({
    include: {
      buildings: {
        include: {
          floors: {
            orderBy: { levelNumber: "asc" },
            include: {
              rooms: {
                include: {
                  coolingUnits: true,
                  rows: {
                    include: {
                      racks: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ sites });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { entityType } = body;

    if (entityType === "SITE") {
      const created = await prisma.site.create({
        data: {
          name: body.name,
          code: String(body.code).toUpperCase().trim(),
          address: body.address || "Datacenter Campus",
          city: body.city || "London",
          country: body.country || "United Kingdom",
          utilityCapacityKw: Number(body.utilityCapacityKw || 2500),
          pueTarget: Number(body.pueTarget || 1.25),
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "CREATE_SITE",
          entityType: "SITE",
          entityId: created.id,
          details: `Created site ${created.name} (${created.code})`,
        },
      });
      return NextResponse.json({ item: created });
    }

    if (entityType === "BUILDING") {
      const created = await prisma.building.create({
        data: {
          siteId: body.siteId,
          name: body.name,
          code: String(body.code || "BLDG").toUpperCase(),
        },
      });
      return NextResponse.json({ item: created });
    }

    if (entityType === "FLOOR") {
      const created = await prisma.floor.create({
        data: {
          buildingId: body.buildingId,
          name: body.name,
          levelNumber: Number(body.levelNumber ?? 1),
        },
      });
      return NextResponse.json({ item: created });
    }

    if (entityType === "ROOM") {
      const created = await prisma.room.create({
        data: {
          floorId: body.floorId,
          name: body.name,
          code: String(body.code || "DH-NEW").toUpperCase(),
          roomType: body.roomType || "DATA_HALL",
          coolingCapacityKw: Number(body.coolingCapacityKw || 150),
          coolingRedundancy: body.coolingRedundancy || "N_PLUS_1",
          ambientTempTargetC: Number(body.ambientTempTargetC || 21.5),
          gridCols: Number(body.gridCols || 12),
          gridRows: Number(body.gridRows || 9),
        },
      });
      return NextResponse.json({ item: created });
    }

    if (entityType === "ROW") {
      const created = await prisma.row.create({
        data: {
          roomId: body.roomId,
          name: body.name,
          orientation: body.orientation || "HORIZONTAL",
          aisleContainment: body.aisleContainment || "COLD_AISLE",
          gridX: Number(body.gridX || 2),
          gridY: Number(body.gridY || 3),
        },
      });
      return NextResponse.json({ item: created });
    }

    if (entityType === "RACK") {
      const created = await prisma.rack.create({
        data: {
          rowId: body.rowId,
          name: body.name,
          code: String(body.code || "R-NEW").toUpperCase(),
          totalU: Number(body.totalU || 42),
          maxPowerWatts: Number(body.maxPowerWatts || 12000),
          maxWeightKg: Number(body.maxWeightKg || 1200),
          posX: Number(body.posX || 2),
          posY: Number(body.posY || 3),
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "CREATE_RACK",
          entityType: "RACK",
          entityId: created.id,
          details: `Created rack ${created.code} (${created.totalU}U, ${created.maxPowerWatts}W)`,
        },
      });
      return NextResponse.json({ item: created });
    }

    if (entityType === "DELETE") {
      const { targetType, id } = body;
      if (targetType === "SITE") await prisma.site.delete({ where: { id } });
      else if (targetType === "BUILDING")
        await prisma.building.delete({ where: { id } });
      else if (targetType === "FLOOR")
        await prisma.floor.delete({ where: { id } });
      else if (targetType === "ROOM")
        await prisma.room.delete({ where: { id } });
      else if (targetType === "ROW") await prisma.row.delete({ where: { id } });
      else if (targetType === "RACK")
        await prisma.rack.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Unsupported entityType" },
      { status: 400 }
    );
  } catch (err: unknown) {
    console.error("Hierarchy mutation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to mutate hierarchy",
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth-guards";
import { CatalogError, readAppliance } from "@/lib/appliance-catalog";
import { appliancesFromCsv, catalogToCsv } from "@/lib/catalog-csv";

const catalogOrder = [{ name: "asc" as const }, { manufacturer: "asc" as const }, { model: "asc" as const }];

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;
  if (req.nextUrl.searchParams.get("format") === "csv") {
    const rows = await prisma.deviceTemplate.findMany({ orderBy: catalogOrder });
    return new NextResponse(catalogToCsv(rows), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="racker-catalog.csv"',
      },
    });
  }
  const appliances = await prisma.deviceTemplate.findMany({
    orderBy: catalogOrder,
    include: { _count: { select: { devices: true } } },
  });
  return NextResponse.json({
    appliances: appliances.map(({ _count, ...item }) => ({
      ...item,
      installedCount: _count.devices,
    })),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const action = String(body.action || "CREATE");

    if (action === "DELETE") {
      const id = String(body.id || "");
      const current = await prisma.deviceTemplate.findUnique({ where: { id } });
      if (!current) {
        return NextResponse.json({ error: "Appliance not found" }, { status: 404 });
      }
      await prisma.deviceTemplate.delete({ where: { id } });
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "DELETE_APPLIANCE",
          entityType: "DEVICE_TEMPLATE",
          entityId: id,
          details: `Removed catalog appliance ${current.manufacturer} ${current.model}`,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === "IMPORT_CSV") {
      const rows = appliancesFromCsv(String(body.csv || ""));
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          if (row.id) {
            await tx.deviceTemplate.upsert({
              where: { id: row.id },
              create: { id: row.id, ...row.data },
              update: row.data,
            });
          } else {
            await tx.deviceTemplate.create({ data: row.data });
          }
        }
      });
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "IMPORT_CATALOG",
          entityType: "DEVICE_TEMPLATE",
          details: `Imported ${rows.length} catalog appliances from CSV`,
        },
      });
      return NextResponse.json({ ok: true, written: rows.length });
    }

    const data = readAppliance(body);
    if (action === "UPDATE") {
      const id = String(body.id || "");
      const current = await prisma.deviceTemplate.findUnique({ where: { id } });
      if (!current) {
        return NextResponse.json({ error: "Appliance not found" }, { status: 404 });
      }
      const item = await prisma.deviceTemplate.update({ where: { id }, data });
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "UPDATE_APPLIANCE",
          entityType: "DEVICE_TEMPLATE",
          entityId: id,
          details: `Updated catalog appliance ${item.name || item.model}`,
        },
      });
      return NextResponse.json({ item });
    }

    const item = await prisma.deviceTemplate.create({ data });
    await prisma.auditLog.create({
      data: {
        userId: auth.user.id,
        action: "CREATE_APPLIANCE",
        entityType: "DEVICE_TEMPLATE",
        entityId: item.id,
        details: `Added catalog appliance ${item.name || item.model}`,
      },
    });
    return NextResponse.json({ item });
  } catch (err: unknown) {
    if (err instanceof CatalogError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    const message = err instanceof Error ? err.message : "Could not save the appliance";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


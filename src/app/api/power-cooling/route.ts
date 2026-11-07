import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth-guards";

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "CREATE_POWER_SOURCE") {
      const created = await prisma.powerSource.create({
        data: {
          siteId: body.siteId,
          roomId: body.roomId || null,
          name: body.name,
          sourceType: body.sourceType || "UPS",
          redundancyGroup: body.redundancyGroup || "A",
          capacityKw: Number(body.capacityKw || 500),
          voltageV: Number(body.voltageV || 400),
          maxAmps: Number(body.maxAmps || 720),
          status: body.status || "ONLINE",
          batteryRuntimeMins: body.batteryRuntimeMins
            ? Number(body.batteryRuntimeMins)
            : null,
          fuelRuntimeHours: body.fuelRuntimeHours
            ? Number(body.fuelRuntimeHours)
            : null,
          upstreamSourceAId: body.upstreamSourceAId || null,
          upstreamSourceBId: body.upstreamSourceBId || null,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "CREATE_POWER_SOURCE",
          entityType: "POWER_SOURCE",
          entityId: created.id,
          details: `Created ${created.sourceType} ${created.name} (${created.capacityKw} kW)`,
        },
      });
      return NextResponse.json({ item: created });
    }

    if (action === "CREATE_POWER_PANEL") {
      const created = await prisma.powerPanel.create({
        data: {
          roomId: body.roomId,
          upstreamSourceId: body.upstreamSourceId,
          name: body.name,
          feedSide: body.feedSide || "A",
          voltageLToN: Number(body.voltageLToN || 230),
          voltageLToL: Number(body.voltageLToL || 400),
          maxAmpsPerPhase: Number(body.maxAmpsPerPhase || 125),
          totalBreakerSlots: Number(body.totalBreakerSlots || 24),
          status: "ONLINE",
        },
      });
      return NextResponse.json({ item: created });
    }

    if (action === "CREATE_POWER_CIRCUIT") {
      const created = await prisma.powerCircuit.create({
        data: {
          panelId: body.panelId,
          roomId: body.roomId,
          rackId: body.rackId || null,
          name: body.name,
          floorSocketLabel: body.floorSocketLabel,
          breakerNumber: Number(body.breakerNumber || 1),
          phaseAllocation: body.phaseAllocation || "L1",
          ratedAmps: Number(body.ratedAmps || 32),
          voltageV: Number(body.voltageV || 230),
          socketType: body.socketType || "IEC_60309_32A_1P",
          posX: Number(body.posX || 2),
          posY: Number(body.posY || 2),
        },
      });
      return NextResponse.json({ item: created });
    }

    if (action === "UPDATE_CIRCUIT_PHASE") {
      const updated = await prisma.powerCircuit.update({
        where: { id: body.circuitId },
        data: {
          phaseAllocation: body.phaseAllocation,
          rackId: body.rackId === undefined ? undefined : body.rackId || null,
        },
      });
      return NextResponse.json({ item: updated });
    }

    if (action === "CREATE_COOLING_UNIT") {
      const created = await prisma.coolingUnit.create({
        data: {
          roomId: body.roomId,
          name: body.name,
          unitType: body.unitType || "CRAH",
          capacityKw: Number(body.capacityKw || 50),
          airflowCfm: Number(body.airflowCfm || 14000),
          supplyTempC: Number(body.supplyTempC || 18.5),
          returnTempC: Number(body.returnTempC || 27.0),
          status: body.status || "ONLINE",
          powerDrawWatts: Number(body.powerDrawWatts || 6000),
          posX: Number(body.posX || 1),
          posY: Number(body.posY || 1),
        },
      });
      return NextResponse.json({ item: created });
    }

    if (action === "TOGGLE_COOLING_STATUS") {
      const updated = await prisma.coolingUnit.update({
        where: { id: body.id },
        data: { status: body.status },
      });
      return NextResponse.json({ item: updated });
    }

    if (action === "DELETE_ITEM") {
      const { targetType, id } = body;
      if (targetType === "POWER_SOURCE")
        await prisma.powerSource.delete({ where: { id } });
      else if (targetType === "POWER_PANEL")
        await prisma.powerPanel.delete({ where: { id } });
      else if (targetType === "POWER_CIRCUIT")
        await prisma.powerCircuit.delete({ where: { id } });
      else if (targetType === "COOLING_UNIT")
        await prisma.coolingUnit.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Power/Cooling API error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "Failed to update power/cooling infrastructure",
      },
      { status: 500 }
    );
  }
}

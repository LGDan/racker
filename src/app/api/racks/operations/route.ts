import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guards";
import { parseOutletSpecs, pduMaxWatts, socketMaxAmps } from "@/lib/appliance-catalog";

// Standard AND Admin users are allowed to edit what's inside racks:
// - Add / move / edit / remove RackDevices
// - Add / edit / remove RackPDUs
// - Connect / disconnect DevicePSUs to PduOutlets
// - Connect / disconnect RackPDUs to Room FloorSockets (PowerCircuits)
// - Connect / disconnect NetworkPorts with NetworkCables
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "ADD_DEVICE") {
      const {
        rackId,
        name,
        hostname,
        assetTag,
        deviceType,
        manufacturer,
        model,
        startU,
        uHeight,
        nominalWatts,
        peakWatts,
        weightKg,
        psuCount,
        psuPlugType,
        portCount,
        portType,
        templateId,
      } = body;

      const rack = await prisma.rack.findUnique({
        where: { id: rackId },
        include: { devices: true },
      });
      if (!rack) {
        return NextResponse.json({ error: "Rack not found" }, { status: 404 });
      }

      const sU = Number(startU);
      const uH = Number(uHeight || 1);
      const endU = sU + uH - 1;

      if (sU < 1 || endU > rack.totalU) {
        return NextResponse.json(
          {
            error: `Device U range (U${sU}-U${endU}) exceeds rack bounds (1..${rack.totalU}U).`,
          },
          { status: 400 }
        );
      }

      for (const existing of rack.devices) {
        const exStart = existing.startU;
        const exEnd = existing.startU + existing.uHeight - 1;
        if (sU <= exEnd && endU >= exStart) {
          return NextResponse.json(
            {
              error: `U-Slot collision: U${sU}-U${endU} overlaps with ${existing.name} at U${exStart}-U${exEnd}.`,
            },
            { status: 400 }
          );
        }
      }

      const dev = await prisma.rackDevice.create({
        data: {
          rackId,
          templateId: templateId || null,
          name,
          hostname:
            hostname ||
            `${String(name)
              .toLowerCase()
              .replace(/[^a-z0-9]/g, "-")}.racker`,
          assetTag: assetTag || `AST-${Math.floor(1000 + Math.random() * 9000)}`,
          serialNumber: `SN-${Date.now().toString().slice(-6)}`,
          deviceType: deviceType || "SERVER",
          manufacturer: manufacturer || "Dell",
          model: model || "PowerEdge R760",
          startU: sU,
          uHeight: uH,
          nominalWatts: Number(nominalWatts ?? 500),
          peakWatts: Number(peakWatts ?? 800),
          weightKg: Number(weightKg ?? 22),
        },
      });

      const numPsus = Number(psuCount ?? 2);
      for (let i = 1; i <= numPsus; i++) {
        await prisma.devicePsu.create({
          data: {
            deviceId: dev.id,
            name: `PSU ${i}`,
            maxWatts: Number(peakWatts ?? 800),
            plugType: psuPlugType || "C14",
            cableColor: i % 2 === 1 ? "#3b82f6" : "#f59e0b",
            cableLabel: `${dev.name}-PSU${i}`,
          },
        });
      }

      const numPorts = Number(portCount ?? 4);
      const prefix =
        deviceType === "SWITCH"
          ? "Et"
          : deviceType === "PATCH_PANEL"
          ? "P"
          : "eth";
      for (let p = 1; p <= numPorts; p++) {
        await prisma.networkPort.create({
          data: {
            deviceId: dev.id,
            name: `${prefix}${p}`,
            portNumber: p,
            portType: portType || "SFP28_25G",
            speedGbps:
              portType === "QSFP28_100G"
                ? 100
                : portType === "RJ45_1G"
                ? 1
                : 25,
            vlanTag: 100,
            isManagement: p === 1 && deviceType === "SERVER",
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "INSTALL_RACK_DEVICE",
          entityType: "RACK_DEVICE",
          entityId: dev.id,
          details: `Installed ${dev.name} (${dev.uHeight}U, ${dev.nominalWatts}W) at U${dev.startU} in rack ${rack.code}`,
        },
      });

      return NextResponse.json({ item: dev });
    }

    if (action === "MOVE_DEVICE") {
      const { deviceId, newStartU } = body;
      const dev = await prisma.rackDevice.findUnique({
        where: { id: deviceId },
        include: {
          rack: { include: { devices: true } },
        },
      });
      if (!dev) {
        return NextResponse.json(
          { error: "Device not found" },
          { status: 404 }
        );
      }

      const sU = Number(newStartU);
      const endU = sU + dev.uHeight - 1;
      if (sU < 1 || endU > dev.rack.totalU) {
        return NextResponse.json(
          {
            error: `Target U${sU}-U${endU} exceeds rack height (${dev.rack.totalU}U).`,
          },
          { status: 400 }
        );
      }

      for (const other of dev.rack.devices) {
        if (other.id === dev.id) continue;
        const oStart = other.startU;
        const oEnd = other.startU + other.uHeight - 1;
        if (sU <= oEnd && endU >= oStart) {
          return NextResponse.json(
            {
              error: `Cannot move to U${sU}: overlaps with ${other.name} (U${oStart}-U${oEnd}).`,
            },
            { status: 400 }
          );
        }
      }

      const updated = await prisma.rackDevice.update({
        where: { id: dev.id },
        data: { startU: sU },
      });
      return NextResponse.json({ item: updated });
    }

    if (action === "DELETE_DEVICE") {
      const { deviceId } = body;
      await prisma.rackDevice.delete({ where: { id: deviceId } });
      return NextResponse.json({ ok: true });
    }

    if (action === "CONNECT_PSU_TO_OUTLET") {
      const { psuId, outletId, cableColor } = body;
      const psu = await prisma.devicePsu.findUnique({
        where: { id: psuId },
        include: { device: true },
      });
      if (!psu) {
        return NextResponse.json({ error: "PSU not found" }, { status: 404 });
      }

      if (!outletId) {
        const updated = await prisma.devicePsu.update({
          where: { id: psuId },
          data: { connectedOutletId: null },
        });
        return NextResponse.json({ item: updated });
      }

      const outlet = await prisma.pduOutlet.findUnique({
        where: { id: outletId },
        include: { pdu: true, connectedPsu: true },
      });
      if (!outlet) {
        return NextResponse.json(
          { error: "PDU Outlet not found" },
          { status: 404 }
        );
      }
      if (outlet.connectedPsu && outlet.connectedPsu.id !== psuId) {
        return NextResponse.json(
          {
            error: `Outlet #${outlet.outletNumber} on ${outlet.pdu.name} is already occupied.`,
          },
          { status: 400 }
        );
      }

      const autoColor =
        cableColor || (outlet.pdu.feedSide === "A" ? "#3b82f6" : "#f59e0b");

      const updated = await prisma.devicePsu.update({
        where: { id: psuId },
        data: {
          connectedOutletId: outletId,
          cableColor: autoColor,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "PATCH_PSU_OUTLET",
          entityType: "DEVICE_PSU",
          entityId: psu.id,
          details: `Connected ${psu.device.name} (${psu.name}) to ${outlet.pdu.name} Outlet #${outlet.outletNumber}`,
        },
      });

      return NextResponse.json({ item: updated });
    }

    if (action === "CONNECT_PDU_TO_FLOOR_SOCKET") {
      const { pduId, circuitId } = body;
      const updated = await prisma.rackPdu.update({
        where: { id: pduId },
        data: {
          circuitId: circuitId || null,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "PATCH_PDU_FLOOR_SOCKET",
          entityType: "RACK_PDU",
          entityId: pduId,
          details: circuitId
            ? `Connected PDU ${updated.name} to floor circuit ${circuitId}`
            : `Disconnected PDU ${updated.name} from floor socket`,
        },
      });
      return NextResponse.json({ item: updated });
    }

    if (action === "ADD_RACK_PDU") {
      const {
        rackId,
        templateId,
        circuitId,
        name,
        model,
        mounting,
        uHeight,
        feedSide,
        phaseMode,
        maxAmps,
        voltageV,
        inputPlugType,
        outletSpecs,
      } = body;

      const resolvedPhase = phaseMode || "SINGLE_PHASE";
      const amps = Number(maxAmps || 32);
      const volts = Number(
        voltageV || (resolvedPhase === "THREE_PHASE" ? 400 : 230)
      );
      const maxWatts = pduMaxWatts(resolvedPhase, amps, volts);
      const banks = parseOutletSpecs(outletSpecs);

      const pdu = await prisma.rackPdu.create({
        data: {
          rackId,
          templateId: templateId || null,
          circuitId: circuitId || null,
          name,
          model:
            model ||
            (resolvedPhase === "THREE_PHASE"
              ? "Raritan PX3 3-Phase Zero-U"
              : "APC AP8853 Zero-U 32A"),
          mounting: mounting || "ZERO_U_LEFT",
          uHeight: mounting === "RACKMOUNT" ? Number(uHeight || 1) : 0,
          feedSide: feedSide || "A",
          phaseMode: resolvedPhase,
          maxAmps: amps,
          voltageV: volts,
          maxWatts,
          inputPlugType:
            inputPlugType ||
            (resolvedPhase === "THREE_PHASE"
              ? "IEC_60309_32A_3P"
              : "IEC_60309_32A_1P"),
        },
      });

      const phases = ["L1", "L2", "L3"];
      let outletNumber = 1;
      for (const bank of banks) {
        for (let c = 0; c < bank.count; c++) {
          const socketType = bank.socketType;
          await prisma.pduOutlet.create({
            data: {
              pduId: pdu.id,
              outletNumber,
              label: `Outlet #${outletNumber} (${socketType})`,
              bankPhase:
                resolvedPhase === "THREE_PHASE"
                  ? phases[(outletNumber - 1) % 3]
                  : "L1",
              socketType,
              maxAmps: socketMaxAmps(socketType),
            },
          });
          outletNumber++;
        }
      }

      await syncRackPowerCapacity(rackId);

      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "ADD_RACK_PDU",
          entityType: "RACK_PDU",
          entityId: pdu.id,
          details: `Added PDU ${pdu.name} (${outletNumber - 1} outlets, ${maxWatts}W) to rack`,
        },
      });

      return NextResponse.json({ item: pdu });
    }

    if (action === "DELETE_RACK_PDU") {
      const existing = await prisma.rackPdu.findUnique({
        where: { id: body.pduId },
      });
      await prisma.rackPdu.delete({ where: { id: body.pduId } });
      if (existing) {
        await syncRackPowerCapacity(existing.rackId);
      }
      return NextResponse.json({ ok: true });
    }

    if (action === "CONNECT_NETWORK_PORTS") {
      const { portAId, portBId, cableType, color, label, lengthMeters } = body;
      if (!portAId || !portBId || portAId === portBId) {
        return NextResponse.json(
          { error: "Select two distinct network ports to patch." },
          { status: 400 }
        );
      }

      // Remove any existing cable on either port first
      await prisma.networkCable.deleteMany({
        where: {
          OR: [
            { portAId: { in: [portAId, portBId] } },
            { portBId: { in: [portAId, portBId] } },
          ],
        },
      });

      const cable = await prisma.networkCable.create({
        data: {
          portAId,
          portBId,
          cableType: cableType || "DAC",
          color: color || "#06b6d4",
          label: label || `NET-${Date.now().toString().slice(-4)}`,
          lengthMeters: Number(lengthMeters || 2.0),
        },
      });
      return NextResponse.json({ item: cable });
    }

    if (action === "DISCONNECT_NETWORK_CABLE") {
      const { cableId } = body;
      await prisma.networkCable.delete({ where: { id: cableId } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid rack action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("Rack operation error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to perform rack update",
      },
      { status: 500 }
    );
  }
}

async function syncRackPowerCapacity(rackId: string) {
  const pdus = await prisma.rackPdu.findMany({
    where: { rackId, status: { not: "OFFLINE" } },
    select: { maxWatts: true },
  });
  const total = Math.round(pdus.reduce((sum, p) => sum + (p.maxWatts || 0), 0));
  await prisma.rack.update({
    where: { id: rackId },
    data: { maxPowerWatts: total },
  });
}

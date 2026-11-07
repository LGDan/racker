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
                  floorTiles: true,
                  obstructions: true,
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

    if (entityType === "MOVE_ON_FLOOR") {
      const kind = String(body.kind || "");
      const id = String(body.id || "");
      const posX = Number(body.posX);
      const posY = Number(body.posY);
      const moved = await moveOnFloor(kind, id, posX, posY, body.elevation);
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "MOVE_ON_FLOOR",
          entityType: kind,
          entityId: id,
          details: `Moved ${kind} to tile ${posX},${posY}${
            body.elevation ? ` (${body.elevation})` : ""
          }`,
        },
      });
      return NextResponse.json({ item: moved });
    }

    if (entityType === "SET_FLOOR_TILE") {
      const roomId = String(body.roomId || "");
      const posX = Number(body.posX);
      const posY = Number(body.posY);
      const surface = String(body.surface || "");
      const tile = await setFloorTile(roomId, posX, posY, surface);
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "SET_FLOOR_TILE",
          entityType: "FLOOR_TILE",
          entityId: roomId,
          details: `Set tile ${posX},${posY} to ${surface}`,
        },
      });
      return NextResponse.json({ item: tile });
    }

    if (entityType === "SET_OBSTRUCTION") {
      const roomId = String(body.roomId || "");
      const posX = Number(body.posX);
      const posY = Number(body.posY);
      const obstructed = body.obstructed === true || body.obstructed === "true";
      const clear = body.obstructed === false || body.obstructed === "false";
      if (!obstructed && !clear) {
        throw new FloorError("obstructed must be true or false");
      }
      const tile = await setObstruction(roomId, posX, posY, obstructed);
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "SET_OBSTRUCTION",
          entityType: "FLOOR_OBSTRUCTION",
          entityId: roomId,
          details: `${obstructed ? "Marked" : "Cleared"} tile ${posX},${posY} as obstructed`,
        },
      });
      return NextResponse.json({ item: tile });
    }

    if (entityType === "RESIZE_ROOM") {
      const roomId = String(body.roomId || "");
      const gridCols = Number(body.gridCols);
      const gridRows = Number(body.gridRows);
      const room = await resizeRoom(roomId, gridCols, gridRows);
      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "RESIZE_ROOM",
          entityType: "ROOM",
          entityId: roomId,
          details: `Resized room grid to ${gridCols}×${gridRows}`,
        },
      });
      return NextResponse.json({ item: room });
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
    const status = err instanceof FloorError ? err.status : 500;
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to mutate hierarchy",
      },
      { status }
    );
  }
}

class FloorError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function assertInGrid(
  room: { gridCols: number; gridRows: number },
  x: number,
  y: number
) {
  if (
    !Number.isInteger(x) ||
    !Number.isInteger(y) ||
    x < 1 ||
    y < 1 ||
    x > room.gridCols ||
    y > room.gridRows
  ) {
    throw new FloorError(
      `Tile ${x},${y} is outside the ${room.gridCols}×${room.gridRows} room`
    );
  }
}

async function loadRoomLayout(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      floorTiles: true,
      obstructions: true,
      coolingUnits: true,
      powerCircuits: true,
      rows: { include: { racks: true } },
    },
  });
  if (!room) throw new FloorError("Room not found", 404);
  return room;
}

function rackPlaneOccupied(
  room: Awaited<ReturnType<typeof loadRoomLayout>>,
  posX: number,
  posY: number,
  ignoreRackIds: Set<string>,
  ignoreCoolingId?: string
) {
  const rackHit = room.rows.some((row) =>
    row.racks.some(
      (rack) =>
        !ignoreRackIds.has(rack.id) &&
        rack.posX === posX &&
        rack.posY === posY
    )
  );
  const coolingHit = room.coolingUnits.some(
    (unit) =>
      unit.id !== ignoreCoolingId &&
      unit.posX === posX &&
      unit.posY === posY
  );
  const blocked = room.obstructions.some(
    (tile) => tile.posX === posX && tile.posY === posY
  );
  return rackHit || coolingHit || blocked;
}

async function moveOnFloor(
  kind: string,
  id: string,
  posX: number,
  posY: number,
  elevation?: unknown
) {
  if (kind === "RACK") {
    const rack = await prisma.rack.findUnique({
      where: { id },
      include: { row: true },
    });
    if (!rack) throw new FloorError("Rack not found", 404);
    const room = await loadRoomLayout(rack.row.roomId);
    assertInGrid(room, posX, posY);
    if (rackPlaneOccupied(room, posX, posY, new Set([id]))) {
      throw new FloorError(
        "That tile is obstructed or already holds a rack or cooling unit"
      );
    }
    return prisma.rack.update({ where: { id }, data: { posX, posY } });
  }

  if (kind === "COOLING_UNIT") {
    const unit = await prisma.coolingUnit.findUnique({ where: { id } });
    if (!unit) throw new FloorError("Cooling unit not found", 404);
    const room = await loadRoomLayout(unit.roomId);
    assertInGrid(room, posX, posY);
    if (rackPlaneOccupied(room, posX, posY, new Set(), id)) {
      throw new FloorError(
        "That tile is obstructed or already holds a rack or cooling unit"
      );
    }
    return prisma.coolingUnit.update({
      where: { id },
      data: { posX, posY },
    });
  }

  if (kind === "FLOOR_SOCKET") {
    const circuit = await prisma.powerCircuit.findUnique({ where: { id } });
    if (!circuit) throw new FloorError("Floor socket not found", 404);
    const room = await loadRoomLayout(circuit.roomId);
    assertInGrid(room, posX, posY);
    const nextElevation =
      elevation == null || elevation === ""
        ? circuit.elevation
        : String(elevation);
    if (nextElevation !== "UNDERFLOOR" && nextElevation !== "OVERHEAD") {
      throw new FloorError("Elevation must be UNDERFLOOR or OVERHEAD");
    }
    const occupied = room.powerCircuits.some(
      (other) =>
        other.id !== id &&
        other.posX === posX &&
        other.posY === posY &&
        other.elevation === nextElevation
    );
    if (occupied) {
      throw new FloorError(
        "That tile already holds a socket at the same elevation"
      );
    }
    return prisma.powerCircuit.update({
      where: { id },
      data: { posX, posY, elevation: nextElevation },
    });
  }

  if (kind === "ROW") {
    const row = await prisma.row.findUnique({
      where: { id },
      include: { racks: true },
    });
    if (!row) throw new FloorError("Row not found", 404);
    const room = await loadRoomLayout(row.roomId);
    assertInGrid(room, posX, posY);
    const dx = posX - row.gridX;
    const dy = posY - row.gridY;
    const memberIds = new Set(row.racks.map((rack) => rack.id));
    const next = row.racks.map((rack) => ({
      id: rack.id,
      x: rack.posX + dx,
      y: rack.posY + dy,
    }));
    const seen = new Set<string>();
    for (const target of next) {
      assertInGrid(room, target.x, target.y);
      const key = `${target.x},${target.y}`;
      if (seen.has(key)) {
        throw new FloorError("Racks in this row would overlap each other");
      }
      seen.add(key);
      if (rackPlaneOccupied(room, target.x, target.y, memberIds)) {
        throw new FloorError(
          "A rack in this row would land on an obstructed tile, a rack, or a cooling unit"
        );
      }
    }
    await prisma.$transaction([
      prisma.row.update({
        where: { id },
        data: { gridX: posX, gridY: posY },
      }),
      ...next.map((target) =>
        prisma.rack.update({
          where: { id: target.id },
          data: { posX: target.x, posY: target.y },
        })
      ),
    ]);
    return prisma.row.findUnique({ where: { id }, include: { racks: true } });
  }

  throw new FloorError("Unknown floor move");
}

async function setFloorTile(
  roomId: string,
  posX: number,
  posY: number,
  surface: string
) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new FloorError("Room not found", 404);
  assertInGrid(room, posX, posY);
  if (surface === "SOLID") {
    await prisma.floorTile.deleteMany({ where: { roomId, posX, posY } });
    return { roomId, posX, posY, surface: "SOLID" };
  }
  if (surface !== "GRILL") {
    throw new FloorError("Surface must be SOLID or GRILL");
  }
  return prisma.floorTile.upsert({
    where: { roomId_posX_posY: { roomId, posX, posY } },
    create: { roomId, posX, posY, surface: "GRILL" },
    update: { surface: "GRILL" },
  });
}

async function setObstruction(
  roomId: string,
  posX: number,
  posY: number,
  obstructed: boolean
) {
  const room = await loadRoomLayout(roomId);
  assertInGrid(room, posX, posY);
  if (!obstructed) {
    await prisma.floorObstruction.deleteMany({ where: { roomId, posX, posY } });
    return { roomId, posX, posY, obstructed: false };
  }
  const occupied =
    room.rows.some((row) =>
      row.racks.some((rack) => rack.posX === posX && rack.posY === posY)
    ) ||
    room.coolingUnits.some((unit) => unit.posX === posX && unit.posY === posY);
  if (occupied) {
    throw new FloorError(
      "Move the rack or cooling unit before marking this tile obstructed"
    );
  }
  return prisma.floorObstruction.upsert({
    where: { roomId_posX_posY: { roomId, posX, posY } },
    create: { roomId, posX, posY, label: "Obstructed" },
    update: { label: "Obstructed" },
  });
}

async function resizeRoom(roomId: string, gridCols: number, gridRows: number) {
  if (
    !Number.isInteger(gridCols) ||
    !Number.isInteger(gridRows) ||
    gridCols < 1 ||
    gridRows < 1 ||
    gridCols > 40 ||
    gridRows > 40
  ) {
    throw new FloorError("Room size must be between 1 and 40 tiles");
  }
  const room = await loadRoomLayout(roomId);
  const placed: Array<[number, number, string]> = [];
  for (const row of room.rows) {
    if (row.gridX >= 1 && row.gridY >= 1) {
      placed.push([row.gridX, row.gridY, `row ${row.name}`]);
    }
    for (const rack of row.racks) {
      if (rack.posX >= 1 && rack.posY >= 1) {
        placed.push([rack.posX, rack.posY, `rack ${rack.code}`]);
      }
    }
  }
  for (const unit of room.coolingUnits) {
    if (unit.posX >= 1 && unit.posY >= 1) {
      placed.push([unit.posX, unit.posY, unit.name]);
    }
  }
  for (const socket of room.powerCircuits) {
    if (socket.posX >= 1 && socket.posY >= 1) {
      placed.push([socket.posX, socket.posY, socket.floorSocketLabel]);
    }
  }
  for (const tile of room.floorTiles) {
    if (tile.posX >= 1 && tile.posY >= 1) {
      placed.push([tile.posX, tile.posY, `grill ${tile.posX},${tile.posY}`]);
    }
  }
  for (const block of room.obstructions) {
    if (block.posX >= 1 && block.posY >= 1) {
      placed.push([
        block.posX,
        block.posY,
        `obstruction ${block.posX},${block.posY}`,
      ]);
    }
  }
  const clipped = placed.find(
    ([x, y]) => x > gridCols || y > gridRows || x < 1 || y < 1
  );
  if (clipped) {
    throw new FloorError(
      `New size would clip ${clipped[2]} at ${clipped[0]},${clipped[1]}`
    );
  }
  return prisma.room.update({
    where: { id: roomId },
    data: { gridCols, gridRows },
  });
}

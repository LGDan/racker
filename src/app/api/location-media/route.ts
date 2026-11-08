import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth-guards";

const KINDS = ["PHOTO", "MAP", "FLOORPLAN"] as const;
const MAX_BYTES = 8 * 1024 * 1024;
const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const ownerType = req.nextUrl.searchParams.get("ownerType") || "";
  const ownerId = req.nextUrl.searchParams.get("ownerId") || "";
  const where = ownerWhere(ownerType, ownerId);
  if (!where) {
    return NextResponse.json({ error: "Unknown location" }, { status: 400 });
  }

  const items = await prisma.locationMedia.findMany({
    where,
    select: { id: true, kind: true, fileName: true, mimeType: true, updatedAt: true },
    orderBy: { updatedAt: "desc" },
  });
  const latest = new Map<string, (typeof items)[number]>();
  for (const item of items) {
    if (!latest.has(item.kind)) latest.set(item.kind, item);
  }
  return NextResponse.json({ items: Array.from(latest.values()) });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const form = await req.formData();
  const ownerType = String(form.get("ownerType") || "");
  const ownerId = String(form.get("ownerId") || "");
  const kind = String(form.get("kind") || "");
  const file = form.get("file");
  const where = ownerWhere(ownerType, ownerId);
  if (!where) {
    return NextResponse.json({ error: "Unknown location" }, { status: 400 });
  }
  if (!KINDS.includes(kind as (typeof KINDS)[number])) {
    return NextResponse.json({ error: "Unknown media kind" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload" }, { status: 400 });
  }

  const mimeType = resolveMime(file);
  if (!mimeType) {
    return NextResponse.json(
      { error: "Use a JPEG, PNG, WebP, GIF, or PDF." },
      { status: 400 }
    );
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) {
    return NextResponse.json({ error: "That file is empty" }, { status: 400 });
  }
  if (bytes.length > MAX_BYTES) {
    return NextResponse.json({ error: "Files must be 8 MB or smaller" }, { status: 400 });
  }

  const owner = await findOwner(ownerType, ownerId);
  if (!owner) {
    return NextResponse.json({ error: "Location not found" }, { status: 404 });
  }

  const fileName = file.name.trim().slice(0, 180) || "upload";
  const existing = await prisma.locationMedia.findFirst({
    where: { ...where, kind },
    select: { id: true },
  });
  const saved = existing
    ? await prisma.locationMedia.update({
        where: { id: existing.id },
        data: { fileName, mimeType, bytes },
      })
    : await prisma.locationMedia.create({
        data: { ...where, kind, fileName, mimeType, bytes },
      });

  await prisma.auditLog.create({
    data: {
      userId: auth.user.id,
      action: "UPLOAD_LOCATION_MEDIA",
      entityType: ownerType,
      entityId: ownerId,
      details: `Uploaded ${kind.toLowerCase()} “${fileName}” for ${owner.name}`,
    },
  });

  return NextResponse.json({
    item: {
      id: saved.id,
      kind: saved.kind,
      fileName: saved.fileName,
      mimeType: saved.mimeType,
      updatedAt: saved.updatedAt,
    },
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  const id = req.nextUrl.searchParams.get("id") || "";
  const current = await prisma.locationMedia.findUnique({ where: { id } });
  if (!current) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
  await prisma.locationMedia.delete({ where: { id } });
  await prisma.auditLog.create({
    data: {
      userId: auth.user.id,
      action: "DELETE_LOCATION_MEDIA",
      entityType: current.siteId ? "SITE" : "BUILDING",
      entityId: current.siteId || current.buildingId,
      details: `Removed ${current.kind.toLowerCase()} “${current.fileName}”`,
    },
  });
  return NextResponse.json({ ok: true });
}

function ownerWhere(ownerType: string, ownerId: string) {
  if (!ownerId) return null;
  if (ownerType === "SITE") return { siteId: ownerId, buildingId: null };
  if (ownerType === "BUILDING") return { buildingId: ownerId, siteId: null };
  return null;
}

async function findOwner(ownerType: string, ownerId: string) {
  if (ownerType === "SITE") return prisma.site.findUnique({ where: { id: ownerId } });
  if (ownerType === "BUILDING") return prisma.building.findUnique({ where: { id: ownerId } });
  return null;
}

function resolveMime(file: File) {
  const declared = file.type.toLowerCase();
  if (Object.values(MIME_BY_EXT).includes(declared)) return declared;
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  return MIME_BY_EXT[ext] || "";
}

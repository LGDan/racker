import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth-guards";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const media = await prisma.locationMedia.findUnique({ where: { id: params.id } });
  if (!media) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const fileName = media.fileName.replace(/[\r\n"]/g, "") || "file";
  return new NextResponse(new Uint8Array(media.bytes), {
    headers: {
      "Content-Type": media.mimeType,
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

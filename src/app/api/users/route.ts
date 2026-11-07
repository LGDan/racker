import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { requireAdmin, requireAuth } from "@/lib/auth-guards";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      active: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const auditLogs = await prisma.auditLog.findMany({
    take: 40,
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { name: true, email: true, role: true },
      },
    },
  });

  return NextResponse.json({ users, auditLogs });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "CREATE_USER") {
      const { email, name, password, role } = body;
      if (!email || !name || !password) {
        return NextResponse.json(
          { error: "Name, email, and password are required." },
          { status: 400 }
        );
      }

      const normalizedEmail = String(email).toLowerCase().trim();
      const existing = await prisma.user.findUnique({
        where: { email: normalizedEmail },
      });
      if (existing) {
        return NextResponse.json(
          { error: "A user with that email already exists." },
          { status: 400 }
        );
      }

      const passwordHash = await bcrypt.hash(String(password), 10);
      const created = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: String(name).trim(),
          passwordHash,
          role: role === "ADMIN" ? "ADMIN" : "STANDARD",
          active: true,
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          createdAt: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "CREATE_USER",
          entityType: "USER",
          entityId: created.id,
          details: `Created user ${created.email} with role ${created.role}`,
        },
      });

      return NextResponse.json({ user: created });
    }

    if (action === "UPDATE_USER") {
      const { userId, role, active, newPassword } = body;
      const updateData: Record<string, unknown> = {};
      if (role !== undefined) {
        updateData.role = role === "ADMIN" ? "ADMIN" : "STANDARD";
      }
      if (active !== undefined) {
        updateData.active = Boolean(active);
      }
      if (newPassword && String(newPassword).trim().length >= 4) {
        updateData.passwordHash = await bcrypt.hash(
          String(newPassword).trim(),
          10
        );
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          active: true,
          createdAt: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "UPDATE_USER",
          entityType: "USER",
          entityId: updated.id,
          details: `Updated user ${updated.email} (role=${updated.role}, active=${updated.active})`,
        },
      });

      return NextResponse.json({ user: updated });
    }

    return NextResponse.json({ error: "Invalid user action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("User management error:", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to update user",
      },
      { status: 500 }
    );
  }
}

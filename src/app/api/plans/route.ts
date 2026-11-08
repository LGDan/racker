import { NextRequest, NextResponse } from "next/server";
import {
  getActivePlanRecord,
  requireAuth,
  requireStrictAdmin,
} from "@/lib/auth-guards";
import { ACTIVE_PLAN_COOKIE, publicPrisma } from "@/lib/db";
import {
  applyPlanToOps,
  comparePlanWithOps,
  createInfrastructurePlan,
  deleteInfrastructurePlan,
  rebasePlanFromOps,
} from "@/lib/plan-engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const compareId = req.nextUrl.searchParams.get("compare") || "";
  if (compareId) {
    try {
      const comparison = await comparePlanWithOps(compareId);
      return NextResponse.json({ comparison });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Could not compare plan" },
        { status: 400 }
      );
    }
  }

  const [plans, activePlan] = await Promise.all([
    publicPrisma.infrastructurePlan.findMany({
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
    }),
    getActivePlanRecord(),
  ]);

  return NextResponse.json({
    plans,
    activePlan:
      activePlan && activePlan.status === "DRAFT" ? activePlan : null,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const action = String(body.action || "");

    if (action === "CREATE") {
      const plan = await createInfrastructurePlan({
        name: body.name,
        description: body.description,
        userId: auth.user.id,
        userName: auth.user.name,
      });
      await publicPrisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "CREATE_PLAN",
          entityType: "INFRASTRUCTURE_PLAN",
          entityId: plan.id,
          details: `Created infrastructure plan "${plan.name}"`,
        },
      });
      const activate = body.activate !== false;
      const res = NextResponse.json({ plan, activePlan: activate ? plan : null });
      if (activate) {
        res.cookies.set(ACTIVE_PLAN_COOKIE, plan.id, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }
      return res;
    }

    if (action === "ACTIVATE") {
      const planId = String(body.planId || "").trim();
      if (!planId) {
        const res = NextResponse.json({ ok: true, activePlan: null });
        res.cookies.set(ACTIVE_PLAN_COOKIE, "", {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
        return res;
      }
      const plan = await publicPrisma.infrastructurePlan.findUnique({
        where: { id: planId },
      });
      if (!plan) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }
      if (plan.status !== "DRAFT") {
        return NextResponse.json(
          { error: "Only DRAFT plans can be activated for editing." },
          { status: 400 }
        );
      }
      const res = NextResponse.json({ ok: true, activePlan: plan });
      res.cookies.set(ACTIVE_PLAN_COOKIE, plan.id, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    if (action === "EXIT_PLAN") {
      const res = NextResponse.json({ ok: true, activePlan: null });
      res.cookies.set(ACTIVE_PLAN_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return res;
    }

    if (action === "REBASE") {
      const planId = String(body.planId || "");
      const plan = await rebasePlanFromOps(planId);
      await publicPrisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "REBASE_PLAN",
          entityType: "INFRASTRUCTURE_PLAN",
          entityId: plan.id,
          details: `Synced plan "${plan.name}" from live Ops state`,
        },
      });
      return NextResponse.json({ ok: true, plan });
    }

    if (action === "APPLY") {
      const adminAuth = await requireStrictAdmin();
      if (adminAuth.error) return adminAuth.error;
      const planId = String(body.planId || "");
      const plan = await applyPlanToOps(planId);
      await publicPrisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "APPLY_PLAN",
          entityType: "INFRASTRUCTURE_PLAN",
          entityId: plan.id,
          details: `Applied plan "${plan.name}" to Ops production state`,
        },
      });
      const res = NextResponse.json({ ok: true, plan, activePlan: null });
      res.cookies.set(ACTIVE_PLAN_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
      return res;
    }

    if (action === "DELETE") {
      const planId = String(body.planId || "");
      const currentActive = await getActivePlanRecord();
      const target = await publicPrisma.infrastructurePlan.findUnique({
        where: { id: planId },
      });
      if (!target) {
        return NextResponse.json({ error: "Plan not found" }, { status: 404 });
      }
      await deleteInfrastructurePlan(planId);
      await publicPrisma.auditLog.create({
        data: {
          userId: auth.user.id,
          action: "DELETE_PLAN",
          entityType: "INFRASTRUCTURE_PLAN",
          entityId: planId,
          details: `Deleted plan "${target.name}"`,
        },
      });
      const res = NextResponse.json({ ok: true });
      if (currentActive && currentActive.id === planId) {
        res.cookies.set(ACTIVE_PLAN_COOKIE, "", {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 0,
        });
      }
      return res;
    }

    return NextResponse.json({ error: "Invalid plan action" }, { status: 400 });
  } catch (err) {
    console.error("Plan API error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Plan action failed" },
      { status: 500 }
    );
  }
}

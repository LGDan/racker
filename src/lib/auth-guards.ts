import { NextResponse } from "next/server";
import { getSessionUser, SessionUser } from "./auth";
import {
  getActivePlanIdFromCookie,
  getActivePlanSchemaFromCookie,
  publicPrisma,
} from "./db";

export async function requireAuth(): Promise<
  { user: SessionUser; error: null } | { user: null; error: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      ),
    };
  }
  return { user, error: null };
}

export async function getActivePlanRecord() {
  const planId = getActivePlanIdFromCookie();
  const schemaName = getActivePlanSchemaFromCookie();
  if (!planId && !schemaName) return null;
  try {
    if (planId) {
      const byId = await publicPrisma.infrastructurePlan.findUnique({
        where: { id: planId },
      });
      if (byId) return byId;
    }
    if (schemaName) {
      return await publicPrisma.infrastructurePlan.findUnique({
        where: { schemaName },
      });
    }
    return null;
  } catch {
    return null;
  }
}

export async function requireAdminOrPlan(): Promise<
  { user: SessionUser; error: null } | { user: null; error: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      ),
    };
  }
  if (user.role === "ADMIN") {
    return { user, error: null };
  }
  const activePlan = await getActivePlanRecord();
  if (activePlan && activePlan.status === "DRAFT") {
    return { user, error: null };
  }
  return {
    user: null,
    error: NextResponse.json(
      {
        error:
          "Administrator privileges required in Ops Mode. Switch to Plan Mode or sign in as an Administrator.",
      },
      { status: 403 }
    ),
  };
}

export const requireAdmin = requireAdminOrPlan;

export async function requireStrictAdmin(): Promise<
  { user: SessionUser; error: null } | { user: null; error: NextResponse }
> {
  const user = await getSessionUser();
  if (!user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Authentication required. Please sign in." },
        { status: 401 }
      ),
    };
  }
  if (user.role !== "ADMIN") {
    return {
      user: null,
      error: NextResponse.json(
        { error: "Administrator privileges required." },
        { status: 403 }
      ),
    };
  }
  return { user, error: null };
}

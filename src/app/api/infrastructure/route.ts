import { NextResponse } from "next/server";
import { getActivePlanRecord, requireAuth } from "@/lib/auth-guards";
import { getFullInfrastructureSnapshot } from "@/lib/capacity-engine";
import { getPrismaForSchema, publicPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const [activePlan, plans] = await Promise.all([
    getActivePlanRecord(),
    publicPrisma.infrastructurePlan
      .findMany({
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          schemaName: true,
          createdByName: true,
          createdAt: true,
          baseExportedAt: true,
          appliedAt: true,
          updatedAt: true,
        },
      })
      .catch(() => []),
  ]);

  const inPlanMode = Boolean(activePlan && activePlan.status === "DRAFT");
  const snapshot = await getFullInfrastructureSnapshot(
    inPlanMode ? getPrismaForSchema(activePlan!.schemaName) : publicPrisma
  );

  const effectiveUser = {
    ...auth.user,
    accountRole: auth.user.role,
    role: (inPlanMode ? "ADMIN" : auth.user.role) as "ADMIN" | "STANDARD",
  };

  return NextResponse.json({
    currentUser: effectiveUser,
    activePlan: inPlanMode ? activePlan : null,
    plans,
    ...snapshot,
  });
}

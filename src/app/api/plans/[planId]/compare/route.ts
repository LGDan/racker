import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guards";
import { comparePlanWithOps } from "@/lib/plan-engine";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { planId: string } }
) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const comparison = await comparePlanWithOps(params.planId);
    return NextResponse.json({ comparison });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not compare plan" },
      { status: 400 }
    );
  }
}

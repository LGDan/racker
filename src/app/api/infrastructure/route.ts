import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guards";
import { getFullInfrastructureSnapshot } from "@/lib/capacity-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const snapshot = await getFullInfrastructureSnapshot();
  return NextResponse.json({
    currentUser: auth.user,
    ...snapshot,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { getOidcConfig, getRequestOrigin } from "@/lib/oidc";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const cfg = getOidcConfig(getRequestOrigin(req));
  return NextResponse.json({
    enabled: cfg.enabled,
    providerName: cfg.providerName,
    issuerUrl: cfg.issuerUrl || null,
  });
}

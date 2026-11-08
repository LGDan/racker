import { NextRequest, NextResponse } from "next/server";
import {
  OIDC_TX_COOKIE,
  createPkceChallenge,
  discoverOidcEndpoints,
  getOidcConfig,
  getRequestOrigin,
  signOidcTransaction,
} from "@/lib/oidc";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = getRequestOrigin(req);
  const cfg = getOidcConfig(origin);
  if (!cfg.enabled) {
    return NextResponse.redirect(
      new URL("/login?error=OIDC+is+not+configured", origin)
    );
  }

  try {
    const endpoints = await discoverOidcEndpoints(cfg);
    const { tx, codeChallenge } = createPkceChallenge(cfg.redirectUri);
    const txToken = await signOidcTransaction(tx);

    const authUrl = new URL(endpoints.authorization_endpoint);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("client_id", cfg.clientId);
    authUrl.searchParams.set("redirect_uri", cfg.redirectUri);
    authUrl.searchParams.set("scope", cfg.scopes);
    authUrl.searchParams.set("state", tx.state);
    authUrl.searchParams.set("nonce", tx.nonce);
    authUrl.searchParams.set("code_challenge", codeChallenge);
    authUrl.searchParams.set("code_challenge_method", "S256");

    const res = NextResponse.redirect(authUrl.toString());
    res.cookies.set(OIDC_TX_COOKIE, txToken, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
    return res;
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not initiate OIDC sign-in";
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(msg)}`, origin)
    );
  }
}

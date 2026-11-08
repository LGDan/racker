import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { SESSION_COOKIE_NAME, signSessionToken } from "@/lib/auth";
import {
  OIDC_TX_COOKIE,
  exchangeCodeForProfile,
  getOidcConfig,
  getRequestOrigin,
  verifyOidcTransaction,
} from "@/lib/oidc";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = getRequestOrigin(req);
  const cfg = getOidcConfig(origin);

  const errorParam = req.nextUrl.searchParams.get("error");
  if (errorParam) {
    const desc = req.nextUrl.searchParams.get("error_description") || errorParam;
    return redirectWithError(origin, `OIDC error: ${desc}`);
  }

  const code = req.nextUrl.searchParams.get("code") || "";
  const state = req.nextUrl.searchParams.get("state") || "";
  const txCookie = req.cookies.get(OIDC_TX_COOKIE)?.value || "";

  if (!code || !state || !txCookie) {
    return redirectWithError(origin, "Missing OIDC authorization code or state.");
  }

  const tx = await verifyOidcTransaction(txCookie);
  if (!tx || tx.state !== state) {
    return redirectWithError(origin, "Invalid or expired OIDC state.");
  }

  try {
    const profile = await exchangeCodeForProfile(cfg, code, tx);
    const existing = await prisma.user.findUnique({
      where: { email: profile.email },
    });

    if (existing && !existing.active) {
      return redirectWithError(origin, "This operator account has been disabled.");
    }

    let user = existing;
    if (!user) {
      const placeholderHash = await bcrypt.hash(
        randomBytes(32).toString("hex"),
        10
      );
      user = await prisma.user.create({
        data: {
          email: profile.email,
          name: profile.name,
          passwordHash: placeholderHash,
          role: profile.role || cfg.defaultRole,
          active: true,
        },
      });
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "OIDC_PROVISION_USER",
          entityType: "USER",
          entityId: user.id,
          details: `Provisioned ${user.email} (${user.role}) via ${cfg.providerName}`,
        },
      });
    } else {
      const nextRole = profile.role || (user.role === "ADMIN" ? "ADMIN" : "STANDARD");
      if (user.name !== profile.name || (profile.role && user.role !== nextRole)) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: profile.name,
            ...(profile.role ? { role: nextRole } : {}),
          },
        });
      }
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "OIDC_LOGIN",
          entityType: "USER",
          entityId: user.id,
          details: `Signed in ${user.email} via ${cfg.providerName}`,
        },
      });
    }

    const sessionUser = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: (user.role === "ADMIN" ? "ADMIN" : "STANDARD") as "ADMIN" | "STANDARD",
    };

    const token = await signSessionToken(sessionUser);
    const res = NextResponse.redirect(new URL("/", origin));
    res.cookies.set(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });
    res.cookies.set(OIDC_TX_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return res;
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "OIDC authentication failed";
    return redirectWithError(origin, msg);
  }
}

function redirectWithError(origin: string, message: string) {
  const res = NextResponse.redirect(
    new URL(`/login?error=${encodeURIComponent(message)}`, origin)
  );
  res.cookies.set(OIDC_TX_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}

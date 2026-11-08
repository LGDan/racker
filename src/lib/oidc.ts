import { createHash, randomBytes } from "crypto";
import { createRemoteJWKSet, decodeJwt, jwtVerify, SignJWT } from "jose";

export const OIDC_TX_COOKIE = "racker_oidc_tx";

export interface OidcConfig {
  enabled: boolean;
  providerName: string;
  issuerUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  roleClaim: string;
  adminGroup: string;
  defaultRole: "ADMIN" | "STANDARD";
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userinfoEndpoint?: string;
  jwksUri?: string;
}

export interface DiscoveryMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint?: string;
  jwks_uri?: string;
}

export interface OidcTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  redirectUri: string;
}

export interface OidcProfile {
  sub: string;
  email: string;
  name: string;
  role: "ADMIN" | "STANDARD" | null;
}

const TX_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "racker-dcim-super-secret-jwt-key-2026"
);

export function getRequestOrigin(req: {
  headers: { get: (name: string) => string | null };
  nextUrl: { origin: string; protocol: string };
}): string {
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    req.nextUrl.protocol.replace(":", "") ||
    "http";
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0].trim() ||
    req.headers.get("host")?.trim();
  if (host) return `${proto}://${host}`;
  return req.nextUrl.origin;
}

export function getOidcConfig(origin?: string): OidcConfig {
  const issuerUrl = (process.env.OIDC_ISSUER_URL || "").trim().replace(/\/+$/, "");
  const clientId = (process.env.OIDC_CLIENT_ID || "").trim();
  const clientSecret = (process.env.OIDC_CLIENT_SECRET || "").trim();
  const authorizationEndpoint = (process.env.OIDC_AUTHORIZATION_ENDPOINT || "").trim() || undefined;
  const tokenEndpoint = (process.env.OIDC_TOKEN_ENDPOINT || "").trim() || undefined;
  const userinfoEndpoint = (process.env.OIDC_USERINFO_ENDPOINT || "").trim() || undefined;
  const jwksUri = (process.env.OIDC_JWKS_URI || "").trim() || undefined;

  const enabled = Boolean(
    clientId && (issuerUrl || (authorizationEndpoint && tokenEndpoint))
  );

  const configuredRedirect = (process.env.OIDC_REDIRECT_URI || "").trim();
  const baseOrigin = origin ? origin.replace(/\/+$/, "") : "http://localhost:3000";

  return {
    enabled,
    providerName: (process.env.OIDC_PROVIDER_NAME || "Single Sign-On").trim() || "Single Sign-On",
    issuerUrl,
    clientId,
    clientSecret,
    redirectUri: configuredRedirect || `${baseOrigin}/api/auth/oidc/callback`,
    scopes: (process.env.OIDC_SCOPES || "openid profile email").trim() || "openid profile email",
    roleClaim: (process.env.OIDC_ROLE_CLAIM || "groups").trim() || "groups",
    adminGroup: (process.env.OIDC_ADMIN_GROUP || "racker-admins").trim(),
    defaultRole:
      (process.env.OIDC_DEFAULT_ROLE || "STANDARD").trim().toUpperCase() === "ADMIN"
        ? "ADMIN"
        : "STANDARD",
    authorizationEndpoint,
    tokenEndpoint,
    userinfoEndpoint,
    jwksUri,
  };
}

export async function discoverOidcEndpoints(cfg: OidcConfig): Promise<DiscoveryMetadata> {
  if (cfg.authorizationEndpoint && cfg.tokenEndpoint) {
    return {
      issuer: cfg.issuerUrl,
      authorization_endpoint: cfg.authorizationEndpoint,
      token_endpoint: cfg.tokenEndpoint,
      userinfo_endpoint: cfg.userinfoEndpoint,
      jwks_uri: cfg.jwksUri,
    };
  }
  if (!cfg.issuerUrl) {
    throw new Error("OIDC_ISSUER_URL is not configured");
  }
  const wellKnown = cfg.issuerUrl.endsWith("/.well-known/openid-configuration")
    ? cfg.issuerUrl
    : `${cfg.issuerUrl}/.well-known/openid-configuration`;
  const res = await fetch(wellKnown, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`OIDC discovery failed (${res.status}) at ${wellKnown}`);
  }
  const doc = (await res.json()) as Partial<DiscoveryMetadata>;
  const authorization_endpoint = cfg.authorizationEndpoint || doc.authorization_endpoint;
  const token_endpoint = cfg.tokenEndpoint || doc.token_endpoint;
  if (!authorization_endpoint || !token_endpoint) {
    throw new Error("OIDC discovery document is missing authorization_endpoint or token_endpoint");
  }
  return {
    issuer: doc.issuer || cfg.issuerUrl,
    authorization_endpoint,
    token_endpoint,
    userinfo_endpoint: cfg.userinfoEndpoint || doc.userinfo_endpoint,
    jwks_uri: cfg.jwksUri || doc.jwks_uri,
  };
}

export function createPkceChallenge(redirectUri: string): {
  tx: OidcTransaction;
  codeChallenge: string;
} {
  const state = randomBytes(24).toString("base64url");
  const nonce = randomBytes(24).toString("base64url");
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return {
    tx: { state, nonce, codeVerifier, redirectUri },
    codeChallenge,
  };
}

export async function signOidcTransaction(tx: OidcTransaction): Promise<string> {
  return new SignJWT({ ...tx })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(TX_SECRET);
}

export async function verifyOidcTransaction(token: string): Promise<OidcTransaction | null> {
  try {
    const { payload } = await jwtVerify(token, TX_SECRET);
    if (!payload.state || !payload.nonce || !payload.codeVerifier || !payload.redirectUri) {
      return null;
    }
    return {
      state: String(payload.state),
      nonce: String(payload.nonce),
      codeVerifier: String(payload.codeVerifier),
      redirectUri: String(payload.redirectUri),
    };
  } catch {
    return null;
  }
}

export async function exchangeCodeForProfile(
  cfg: OidcConfig,
  code: string,
  tx: OidcTransaction
): Promise<OidcProfile> {
  const endpoints = await discoverOidcEndpoints(cfg);

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: tx.redirectUri,
    client_id: cfg.clientId,
    code_verifier: tx.codeVerifier,
  });
  if (cfg.clientSecret) {
    params.set("client_secret", cfg.clientSecret);
  }

  const tokenRes = await fetch(endpoints.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: params.toString(),
    cache: "no-store",
  });

  const tokenData = (await tokenRes.json().catch(() => ({}))) as {
    id_token?: string;
    access_token?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok) {
    throw new Error(
      tokenData.error_description || tokenData.error || `Token exchange failed (${tokenRes.status})`
    );
  }

  let claims: Record<string, unknown> = {};

  if (tokenData.id_token) {
    if (endpoints.jwks_uri) {
      const JWKS = createRemoteJWKSet(new URL(endpoints.jwks_uri));
      const { payload } = await jwtVerify(tokenData.id_token, JWKS, {
        audience: cfg.clientId,
      });
      claims = { ...payload };
    } else {
      claims = { ...decodeJwt(tokenData.id_token) };
    }
    if (claims.nonce && String(claims.nonce) !== tx.nonce) {
      throw new Error("OIDC nonce mismatch");
    }
  }

  if (
    endpoints.userinfo_endpoint &&
    tokenData.access_token &&
    (!claims.email || !claims.name)
  ) {
    const infoRes = await fetch(endpoints.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
      cache: "no-store",
    });
    if (infoRes.ok) {
      const info = (await infoRes.json().catch(() => ({}))) as Record<string, unknown>;
      claims = { ...info, ...claims, email: claims.email || info.email, name: claims.name || info.name };
    }
  }

  const sub = String(claims.sub || "").trim();
  const rawEmail = String(
    claims.email || claims.preferred_username || claims.upn || (sub ? `${sub}@oidc.local` : "")
  )
    .toLowerCase()
    .trim();

  if (!rawEmail) {
    throw new Error("OIDC provider did not return an email or subject identifier");
  }

  const email = rawEmail.includes("@") ? rawEmail : `${rawEmail}@oidc.local`;
  const name =
    String(
      claims.name ||
        [claims.given_name, claims.family_name].filter(Boolean).join(" ") ||
        claims.preferred_username ||
        email.split("@")[0]
    ).trim() || email;

  const role = resolveRoleFromClaims(claims, cfg);

  return { sub: sub || email, email, name, role };
}

function resolveRoleFromClaims(
  claims: Record<string, unknown>,
  cfg: OidcConfig
): "ADMIN" | "STANDARD" | null {
  if (!cfg.roleClaim || !cfg.adminGroup) return null;
  const raw = readClaimPath(claims, cfg.roleClaim);
  if (raw == null) return null;
  const values = Array.isArray(raw)
    ? raw.map((item) => String(item).trim().toLowerCase())
    : String(raw)
        .split(/[,\s]+/)
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean);
  const adminTargets = cfg.adminGroup
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (values.some((val) => adminTargets.includes(val) || val === "admin")) {
    return "ADMIN";
  }
  return "STANDARD";
}

function readClaimPath(claims: Record<string, unknown>, path: string): unknown {
  if (path in claims) return claims[path];
  const parts = path.split(".");
  let cursor: unknown = claims;
  for (const part of parts) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

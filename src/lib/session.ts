import { SignJWT, jwtVerify } from "jose";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "STANDARD";
}

const JWT_SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || "racker-dcim-super-secret-jwt-key-2026"
);

export const SESSION_COOKIE_NAME = "racker_session";

export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function verifySessionToken(
  token: string
): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if (!payload.id || !payload.email || !payload.role) return null;
    return {
      id: String(payload.id),
      email: String(payload.email),
      name: String(payload.name || payload.email),
      role: payload.role === "ADMIN" ? "ADMIN" : "STANDARD",
    };
  } catch {
    return null;
  }
}

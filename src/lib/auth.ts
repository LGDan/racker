import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SessionUser,
  signSessionToken,
  verifySessionToken,
} from "./session";

export type { SessionUser };
export { SESSION_COOKIE_NAME, signSessionToken, verifySessionToken };

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

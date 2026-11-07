import { NextResponse } from "next/server";
import { getSessionUser, SessionUser } from "./auth";

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

export async function requireAdmin(): Promise<
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
        {
          error:
            "Administrator privileges required. Standard users can view all infrastructure and edit rack contents, but cannot modify facility structure, upstream power/cooling, or users.",
        },
        { status: 403 }
      ),
    };
  }
  return { user, error: null };
}

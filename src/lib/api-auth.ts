import { NextRequest, NextResponse } from "next/server";
import { authCookieName, verifyAuthToken } from "@/lib/auth";
import { findUserById } from "@/lib/db";

export async function requireUser(request: NextRequest) {
  const token = request.cookies.get(authCookieName())?.value;
  if (!token) {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  try {
    const payload = await verifyAuthToken(token);

    if (
      payload.sub === "builtin-admin" &&
      payload.email === "admin@ege.local" &&
      payload.role === "admin"
    ) {
      return {
        user: {
          id: "builtin-admin",
          email: "admin@ege.local",
          role: "admin" as const,
        },
        error: null,
      };
    }

    const user = await findUserById(payload.sub);
    if (!user) {
      return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
    }

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      error: null,
    };
  } catch {
    return { user: null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
}

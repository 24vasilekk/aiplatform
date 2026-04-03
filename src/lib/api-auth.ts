import { NextRequest, NextResponse } from "next/server";
import { verifyAuthToken } from "@/lib/auth";
import { authCookieName } from "@/lib/auth-constants";
import { ensureLocalRoleUser, findUserById, type UserRole } from "@/lib/db";
import {
  createSchemaMaintenanceApiResponse,
  getSchemaReadinessSnapshot,
  shouldServeMaintenance,
} from "@/lib/schema-readiness";

export async function requireUser(request: NextRequest) {
  const snapshot = await getSchemaReadinessSnapshot();
  if (shouldServeMaintenance(snapshot, request.nextUrl.pathname)) {
    return { user: null, error: createSchemaMaintenanceApiResponse(snapshot) };
  }

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
      const ensured = await ensureLocalRoleUser({ email: "admin@ege.local", role: "admin" }).catch(() => null);
      return {
        user: {
          id: ensured?.id ?? "builtin-admin",
          email: "admin@ege.local",
          role: "admin" as const,
        },
        error: null,
      };
    }

    if (
      payload.sub === "builtin-tutor" &&
      payload.email === "tutor@ege.local" &&
      payload.role === "tutor"
    ) {
      const ensured = await ensureLocalRoleUser({ email: "tutor@ege.local", role: "tutor" }).catch(() => null);
      return {
        user: {
          id: ensured?.id ?? "builtin-tutor",
          email: "tutor@ege.local",
          role: "tutor" as const,
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

export function hasAnyRole(userRole: UserRole, allowedRoles: UserRole[]) {
  return allowedRoles.includes(userRole);
}

export async function requireRoles(request: NextRequest, allowedRoles: UserRole[]) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) return auth;
  if (!hasAnyRole(auth.user.role, allowedRoles)) {
    return {
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return auth;
}

export async function requireAdmin(request: NextRequest) {
  return requireRoles(request, ["admin"]);
}

export async function requireTutorOrAdmin(request: NextRequest) {
  return requireRoles(request, ["tutor", "admin"]);
}

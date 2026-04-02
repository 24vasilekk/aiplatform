import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { authCookieName } from "./src/lib/auth-constants";
import { ensureTraceHeaders } from "./src/lib/request-trace";

type MiddlewareRole = "student" | "tutor" | "admin";

function getSecret() {
  const value = process.env.AUTH_JWT_SECRET ?? "mvp-temporary-secret-change-me";
  return new TextEncoder().encode(value);
}

function isAdminArea(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

function isAdminApi(pathname: string) {
  return pathname.startsWith("/api/admin/");
}

function isTutorCapableAdminApi(pathname: string) {
  return pathname === "/api/admin/tutors" || pathname.startsWith("/api/admin/tutors/");
}

function isTutorArea(pathname: string) {
  return pathname === "/tutor" || pathname.startsWith("/tutor/");
}

function isTutorLmsApi(pathname: string) {
  return pathname === "/api/tutor/lms" || pathname.startsWith("/api/tutor/lms/");
}

function isTruthy(raw: string | undefined) {
  if (!raw) return false;
  const value = raw.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

function isMaintenanceExempt(pathname: string) {
  return (
    pathname === "/maintenance" ||
    pathname === "/api/health" ||
    pathname === "/api/readiness" ||
    pathname === "/health" ||
    pathname === "/readiness"
  );
}

async function resolveRoleFromToken(token: string | undefined): Promise<MiddlewareRole | null> {
  if (!token) return null;
  try {
    const payload = (await jwtVerify(token, getSecret())).payload as {
      role?: string;
      sub?: string;
      email?: string;
    };
    if (payload.role === "admin") return "admin";
    if (payload.role === "tutor") return "tutor";
    if (payload.role === "student") return "student";
    return null;
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  const ids = ensureTraceHeaders(requestHeaders);
  const pathname = request.nextUrl.pathname;
  const maintenanceMode = isTruthy(process.env.APP_MAINTENANCE_MODE);

  if (maintenanceMode && !isMaintenanceExempt(pathname)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          error: "Service temporarily unavailable due to maintenance mode.",
          code: "MAINTENANCE_MODE",
        },
        { status: 503, headers: { "retry-after": "30" } },
      );
    }
    return NextResponse.redirect(new URL("/maintenance", request.url));
  }

  const requiresAdmin =
    (isAdminArea(pathname) || isAdminApi(pathname)) && !isTutorCapableAdminApi(pathname);
  const requiresTutorOrAdmin = isTutorCapableAdminApi(pathname);
  const requiresTutor = isTutorArea(pathname) || isTutorLmsApi(pathname);

  if (requiresAdmin || requiresTutorOrAdmin || requiresTutor) {
    const token = request.cookies.get(authCookieName())?.value;
    const role = await resolveRoleFromToken(token);

    if (!role) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      return NextResponse.redirect(new URL("/login", request.url));
    }

    if (requiresAdmin && role !== "admin") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    if (requiresTutorOrAdmin && role !== "admin" && role !== "tutor") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (requiresTutor && role !== "tutor") {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set("x-request-id", ids.requestId);
  response.headers.set("x-correlation-id", ids.correlationId);
  response.headers.set("trace-id", ids.traceId);

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

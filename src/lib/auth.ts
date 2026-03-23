import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { findUserById, type UserRole } from "@/lib/db";

const AUTH_COOKIE = "ege_auth";

type AuthPayload = {
  sub: string;
  email: string;
  role: UserRole;
};

function getSecret() {
  // Temporary fallback to keep MVP working on deployments where env is not set yet.
  const value = process.env.AUTH_JWT_SECRET ?? "mvp-temporary-secret-change-me";
  return new TextEncoder().encode(value);
}

export async function signAuthToken(payload: AuthPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

export async function verifyAuthToken(token: string) {
  const result = await jwtVerify<AuthPayload>(token, getSecret());
  return result.payload;
}

export function authCookieName() {
  return AUTH_COOKIE;
}

export const DEMO_PAID_COOKIE = "ege_paid_all";
export const DEMO_PAID_COURSES_COOKIE = "ege_paid_courses";

export type DemoPaidAccessSnapshot = {
  all: boolean;
  courseIds: string[];
};

export async function getDemoPaidAccessSnapshot(): Promise<DemoPaidAccessSnapshot> {
  const cookieStore = await cookies();
  const all = cookieStore.get(DEMO_PAID_COOKIE)?.value === "1";
  const rawCourseIds = cookieStore.get(DEMO_PAID_COURSES_COOKIE)?.value ?? "";
  const courseIds = rawCourseIds
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return { all, courseIds };
}

export async function hasDemoPaidAccess(courseId?: string) {
  const snapshot = await getDemoPaidAccessSnapshot();
  if (snapshot.all) return true;
  if (!courseId) return false;
  return snapshot.courseIds.includes(courseId);
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;

  try {
    const payload = await verifyAuthToken(token);

    // Temporary fallback admin account for environments without persistent DB.
    if (
      payload.sub === "builtin-admin" &&
      payload.email === "admin@ege.local" &&
      payload.role === "admin"
    ) {
      return {
        id: "builtin-admin",
        email: "admin@ege.local",
        role: "admin" as const,
      };
    }

    const user = await findUserById(payload.sub);
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role,
    };
  } catch {
    return null;
  }
}

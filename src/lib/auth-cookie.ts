import { NextResponse } from "next/server";
import { authCookieName } from "@/lib/auth";

const AUTH_COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 7;

function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    priority: "high" as const,
    maxAge,
  };
}

export function setAuthSessionCookie(response: NextResponse, token: string) {
  response.cookies.set(authCookieName(), token, authCookieOptions(AUTH_COOKIE_MAX_AGE_SEC));
}

export function clearAuthSessionCookie(response: NextResponse) {
  response.cookies.set(authCookieName(), "", authCookieOptions(0));
}

import { NextRequest, NextResponse } from "next/server";
import {
  GOOGLE_OAUTH_RETURN_TO_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  createGoogleCodeChallenge,
  createGoogleCodeVerifier,
  createGoogleOAuthState,
  getGoogleAuthUrl,
  getGoogleRedirectUri,
} from "@/lib/google-oauth";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  createRateLimitResponse,
  getClientIpFromHeaders,
  sanitizeRedirectPath,
} from "@/lib/security";

function oauthCookieConfig(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: maxAgeSeconds,
  };
}

export async function GET(request: NextRequest) {
  const ip = getClientIpFromHeaders(request.headers);
  const rateLimit = consumeRateLimit({
    namespace: "auth-google-login",
    key: ip,
    limit: 20,
    windowMs: 5 * 60 * 1_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много OAuth-запросов. Попробуйте позже.");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();

  if (!clientId) {
    const response = NextResponse.redirect(
      new URL("/login?oauth_error=google_not_configured", request.nextUrl.origin),
    );
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const state = createGoogleOAuthState();
  const codeVerifier = createGoogleCodeVerifier();
  const codeChallenge = createGoogleCodeChallenge(codeVerifier);
  const redirectUri = getGoogleRedirectUri(request);

  const authUrl = getGoogleAuthUrl({
    clientId,
    redirectUri,
    state,
    codeChallenge,
  });

  const response = NextResponse.redirect(authUrl);
  const returnTo = sanitizeRedirectPath(request.nextUrl.searchParams.get("next"));
  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, state, oauthCookieConfig(60 * 10));
  response.cookies.set(GOOGLE_OAUTH_VERIFIER_COOKIE, codeVerifier, oauthCookieConfig(60 * 10));
  if (returnTo) {
    response.cookies.set(GOOGLE_OAUTH_RETURN_TO_COOKIE, returnTo, oauthCookieConfig(60 * 10));
  } else {
    response.cookies.set(GOOGLE_OAUTH_RETURN_TO_COOKIE, "", oauthCookieConfig(0));
  }
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

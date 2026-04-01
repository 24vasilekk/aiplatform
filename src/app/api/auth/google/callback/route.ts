import { NextRequest, NextResponse } from "next/server";
import { signAuthToken } from "@/lib/auth";
import { setAuthSessionCookie } from "@/lib/auth-cookie";
import { createAnalyticsEvent, findOrCreateOAuthUser } from "@/lib/db";
import {
  GOOGLE_OAUTH_RETURN_TO_COOKIE,
  GOOGLE_OAUTH_STATE_COOKIE,
  GOOGLE_OAUTH_VERIFIER_COOKIE,
  exchangeGoogleCodeForToken,
  fetchGoogleUserInfo,
  getGoogleRedirectUri,
  isValidGoogleOAuthState,
} from "@/lib/google-oauth";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  createRateLimitResponse,
  getClientIpFromHeaders,
  safeEqual,
  sanitizeRedirectPath,
} from "@/lib/security";

function clearGoogleOauthCookies(response: NextResponse) {
  const config = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/google",
    maxAge: 0,
  };

  response.cookies.set(GOOGLE_OAUTH_STATE_COOKIE, "", config);
  response.cookies.set(GOOGLE_OAUTH_VERIFIER_COOKIE, "", config);
  response.cookies.set(GOOGLE_OAUTH_RETURN_TO_COOKIE, "", config);
}

function redirectToLoginWithError(request: NextRequest, errorCode: string) {
  const url = new URL("/login", request.nextUrl.origin);
  url.searchParams.set("oauth_error", errorCode);
  const response = NextResponse.redirect(url);
  clearGoogleOauthCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const ip = getClientIpFromHeaders(request.headers);
  const rateLimit = consumeRateLimit({
    namespace: "auth-google-callback",
    key: ip,
    limit: 20,
    windowMs: 5 * 60 * 1_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много OAuth-запросов. Попробуйте позже.");
  }

  async function trackFailed(reason: string) {
    await createAnalyticsEvent({
      eventName: "login_failed",
      path,
      payload: { method: "google", reason },
    });
  }

  const code = request.nextUrl.searchParams.get("code")?.trim();
  const state = request.nextUrl.searchParams.get("state")?.trim();

  if (
    !code ||
    !state ||
    !/^[A-Za-z0-9._~-]{8,500}$/.test(code) ||
    !isValidGoogleOAuthState(state)
  ) {
    await trackFailed("missing_code_or_state");
    const response = redirectToLoginWithError(request, "missing_code");
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const stateCookie = request.cookies.get(GOOGLE_OAUTH_STATE_COOKIE)?.value;
  const codeVerifier = request.cookies.get(GOOGLE_OAUTH_VERIFIER_COOKIE)?.value;

  if (
    !stateCookie ||
    !codeVerifier ||
    !isValidGoogleOAuthState(stateCookie) ||
    !safeEqual(stateCookie, state)
  ) {
    await trackFailed("state_mismatch");
    const response = redirectToLoginWithError(request, "state_mismatch");
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  try {
    const redirectUri = getGoogleRedirectUri(request);
    const tokenPayload = await exchangeGoogleCodeForToken({
      code,
      codeVerifier,
      redirectUri,
    });

    const profile = await fetchGoogleUserInfo(tokenPayload.access_token);
    const email = profile.email?.toLowerCase().trim();

    if (!profile.sub || !email || !profile.email_verified) {
      await trackFailed("invalid_profile");
      const response = redirectToLoginWithError(request, "invalid_profile");
      applyRateLimitHeaders(response, rateLimit);
      return response;
    }

    const user = await findOrCreateOAuthUser({
      provider: "google",
      providerAccountId: profile.sub,
      email,
    });

    const jwt = await signAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const returnToCookie = request.cookies.get(GOOGLE_OAUTH_RETURN_TO_COOKIE)?.value;
    const safeReturnTo = sanitizeRedirectPath(returnToCookie) ?? "/dashboard";
    const response = NextResponse.redirect(new URL(safeReturnTo, request.nextUrl.origin));
    clearGoogleOauthCookies(response);
    setAuthSessionCookie(response, jwt);

    await createAnalyticsEvent({
      eventName: "login_success",
      userId: user.id,
      path,
      payload: { method: "google" },
    });

    applyRateLimitHeaders(response, rateLimit);
    return response;
  } catch {
    await trackFailed("oauth_flow_failed");
    const response = redirectToLoginWithError(request, "google_failed");
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }
}

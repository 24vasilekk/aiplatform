import { createHash, randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";

export const GOOGLE_OAUTH_STATE_COOKIE = "ege_google_oauth_state";
export const GOOGLE_OAUTH_VERIFIER_COOKIE = "ege_google_oauth_verifier";
export const GOOGLE_OAUTH_RETURN_TO_COOKIE = "ege_google_oauth_return_to";

type GoogleTokenResponse = {
  access_token: string;
  id_token?: string;
  expires_in: number;
  token_type: "Bearer";
  scope?: string;
};

type GoogleUserInfo = {
  sub: string;
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
};

function toBase64Url(input: Buffer) {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export function createGoogleOAuthState() {
  return toBase64Url(randomBytes(24));
}

export function isValidGoogleOAuthState(state: string) {
  return /^[A-Za-z0-9_-]{20,200}$/.test(state);
}

export function createGoogleCodeVerifier() {
  return toBase64Url(randomBytes(48));
}

export function createGoogleCodeChallenge(verifier: string) {
  const digest = createHash("sha256").update(verifier).digest();
  return toBase64Url(digest);
}

function getAppUrl(request: NextRequest) {
  return process.env.APP_URL?.trim() || request.nextUrl.origin;
}

export function getGoogleRedirectUri(request: NextRequest) {
  const explicit = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  return `${getAppUrl(request)}/api/auth/google/callback`;
}

export function getGoogleAuthUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
}) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", input.clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", input.state);
  url.searchParams.set("code_challenge", input.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url;
}

export async function exchangeGoogleCodeForToken(input: {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  const payload = new URLSearchParams({
    code: input.code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: input.redirectUri,
    grant_type: "authorization_code",
    code_verifier: input.codeVerifier,
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: payload.toString(),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Google token exchange failed");
  }

  return (await response.json()) as GoogleTokenResponse;
}

export async function fetchGoogleUserInfo(accessToken: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error("Google userinfo request failed");
  }

  return (await response.json()) as GoogleUserInfo;
}

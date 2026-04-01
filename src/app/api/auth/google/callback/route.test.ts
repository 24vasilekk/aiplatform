import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signAuthTokenMock: vi.fn(),
  setAuthSessionCookieMock: vi.fn(),
  createAnalyticsEventMock: vi.fn(),
  findOrCreateOAuthUserMock: vi.fn(),
  exchangeGoogleCodeForTokenMock: vi.fn(),
  fetchGoogleUserInfoMock: vi.fn(),
  getGoogleRedirectUriMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  signAuthToken: mocks.signAuthTokenMock,
}));

vi.mock("@/lib/auth-cookie", () => ({
  setAuthSessionCookie: mocks.setAuthSessionCookieMock,
}));

vi.mock("@/lib/db", () => ({
  createAnalyticsEvent: mocks.createAnalyticsEventMock,
  findOrCreateOAuthUser: mocks.findOrCreateOAuthUserMock,
}));

vi.mock("@/lib/google-oauth", () => ({
  GOOGLE_OAUTH_RETURN_TO_COOKIE: "ege_google_oauth_return_to",
  GOOGLE_OAUTH_STATE_COOKIE: "ege_google_oauth_state",
  GOOGLE_OAUTH_VERIFIER_COOKIE: "ege_google_oauth_verifier",
  exchangeGoogleCodeForToken: mocks.exchangeGoogleCodeForTokenMock,
  fetchGoogleUserInfo: mocks.fetchGoogleUserInfoMock,
  getGoogleRedirectUri: mocks.getGoogleRedirectUriMock,
  isValidGoogleOAuthState: (value: string) => /^[A-Za-z0-9_-]{20,200}$/.test(value),
}));

import { GET } from "@/app/api/auth/google/callback/route";

describe("GET /api/auth/google/callback", () => {
  const validState = "ABCDEFGHIJKLMNOPQRSTUVWXYZ123456";

  beforeEach(() => {
    mocks.signAuthTokenMock.mockResolvedValue("jwt-google");
    mocks.setAuthSessionCookieMock.mockImplementation(() => undefined);
    mocks.createAnalyticsEventMock.mockResolvedValue(null);
    mocks.getGoogleRedirectUriMock.mockReturnValue("http://localhost/api/auth/google/callback");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("redirects with missing_code error when params are absent", async () => {
    const request = new NextRequest("http://localhost/api/auth/google/callback");

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?oauth_error=missing_code");
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "login_failed",
        payload: { method: "google", reason: "missing_code_or_state" },
      }),
    );
  });

  it("redirects with state_mismatch when state cookie is invalid", async () => {
    const request = new NextRequest(
      `http://localhost/api/auth/google/callback?code=abc123456&state=${validState}`,
      {
      headers: {
          cookie: `ege_google_oauth_state=WRONGWRONGWRONGWRONGWRONGWRONGWR; ege_google_oauth_verifier=verifier`,
      },
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/login?oauth_error=state_mismatch");
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "login_failed",
        payload: { method: "google", reason: "state_mismatch" },
      }),
    );
  });

  it("creates session for verified google profile", async () => {
    mocks.exchangeGoogleCodeForTokenMock.mockResolvedValue({ access_token: "token" });
    mocks.fetchGoogleUserInfoMock.mockResolvedValue({
      sub: "google-123",
      email: "student@example.com",
      email_verified: true,
    });
    mocks.findOrCreateOAuthUserMock.mockResolvedValue({
      id: "u-google",
      email: "student@example.com",
      role: "student",
    });

    const request = new NextRequest(
      `http://localhost/api/auth/google/callback?code=abc123456&state=${validState}`,
      {
      headers: {
          cookie: `ege_google_oauth_state=${validState}; ege_google_oauth_verifier=verifier`,
      },
      },
    );

    const response = await GET(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/dashboard");
    expect(mocks.findOrCreateOAuthUserMock).toHaveBeenCalledWith({
      provider: "google",
      providerAccountId: "google-123",
      email: "student@example.com",
    });
    expect(mocks.setAuthSessionCookieMock).toHaveBeenCalledWith(
      expect.any(Object),
      "jwt-google",
    );
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "login_success",
        userId: "u-google",
        payload: { method: "google" },
      }),
    );
  });
});

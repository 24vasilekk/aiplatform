import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  compareMock: vi.fn(),
  signAuthTokenMock: vi.fn(),
  setAuthSessionCookieMock: vi.fn(),
  findUserByEmailMock: vi.fn(),
  createAnalyticsEventMock: vi.fn(),
}));

vi.mock("bcryptjs", () => ({
  default: {
    compare: mocks.compareMock,
  },
}));

vi.mock("@/lib/auth", () => ({
  signAuthToken: mocks.signAuthTokenMock,
}));

vi.mock("@/lib/auth-cookie", () => ({
  setAuthSessionCookie: mocks.setAuthSessionCookieMock,
}));

vi.mock("@/lib/db", () => ({
  findUserByEmail: mocks.findUserByEmailMock,
  createAnalyticsEvent: mocks.createAnalyticsEventMock,
}));

import { POST } from "@/app/api/auth/login/route";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    mocks.signAuthTokenMock.mockResolvedValue("jwt-token");
    mocks.setAuthSessionCookieMock.mockImplementation(() => undefined);
    mocks.createAnalyticsEventMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid payload and tracks failed login", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "broken" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Некорректные данные");
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "login_failed",
        path: "/api/auth/login",
        payload: { method: "password", reason: "invalid_payload" },
      }),
    );
  });

  it("returns 401 for oauth-only account", async () => {
    mocks.findUserByEmailMock.mockResolvedValue({
      id: "u1",
      email: "test@example.com",
      passwordHash: null,
      role: "student",
    });

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "secret" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Google или Telegram");
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "login_failed",
        payload: { method: "password", reason: "oauth_only_account" },
      }),
    );
  });

  it("creates session for valid credentials", async () => {
    mocks.findUserByEmailMock.mockResolvedValue({
      id: "u1",
      email: "test@example.com",
      passwordHash: "hash",
      role: "student",
    });
    mocks.compareMock.mockResolvedValue(true);

    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "test@example.com", password: "secret" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toEqual({ id: "u1", email: "test@example.com", role: "student" });
    expect(mocks.signAuthTokenMock).toHaveBeenCalledWith({
      sub: "u1",
      email: "test@example.com",
      role: "student",
    });
    expect(mocks.setAuthSessionCookieMock).toHaveBeenCalledWith(
      expect.any(Object),
      "jwt-token",
    );
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "login_success",
        userId: "u1",
        payload: { method: "password" },
      }),
    );
  });

  it("supports builtin tutor login", async () => {
    const request = new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "tutor@ege.local", password: "wwwwww" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.user).toEqual({ id: "builtin-tutor", email: "tutor@ege.local", role: "tutor" });
    expect(mocks.signAuthTokenMock).toHaveBeenCalledWith({
      sub: "builtin-tutor",
      email: "tutor@ege.local",
      role: "tutor",
    });
  });
});

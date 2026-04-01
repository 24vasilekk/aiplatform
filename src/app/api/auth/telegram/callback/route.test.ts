import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signAuthTokenMock: vi.fn(),
  setAuthSessionCookieMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  createAnalyticsEventMock: vi.fn(),
  findOrLinkTelegramUserMock: vi.fn(),
  validateTelegramAuthPayloadMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  signAuthToken: mocks.signAuthTokenMock,
  getCurrentUser: mocks.getCurrentUserMock,
}));

vi.mock("@/lib/auth-cookie", () => ({
  setAuthSessionCookie: mocks.setAuthSessionCookieMock,
}));

vi.mock("@/lib/db", () => ({
  createAnalyticsEvent: mocks.createAnalyticsEventMock,
  findOrLinkTelegramUser: mocks.findOrLinkTelegramUserMock,
}));

vi.mock("@/lib/telegram-auth", () => ({
  validateTelegramAuthPayload: mocks.validateTelegramAuthPayloadMock,
}));

import { POST } from "@/app/api/auth/telegram/callback/route";

describe("POST /api/auth/telegram/callback", () => {
  const validHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

  beforeEach(() => {
    mocks.signAuthTokenMock.mockResolvedValue("jwt-telegram");
    mocks.setAuthSessionCookieMock.mockImplementation(() => undefined);
    mocks.createAnalyticsEventMock.mockResolvedValue(null);
    mocks.getCurrentUserMock.mockResolvedValue(null);
    mocks.validateTelegramAuthPayloadMock.mockReturnValue({ ok: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid payload", async () => {
    const request = new NextRequest("http://localhost/api/auth/telegram/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: "1" }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe("Некорректные данные Telegram");
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "login_failed",
        payload: { method: "telegram", reason: "invalid_payload" },
      }),
    );
  });

  it("returns 401 for invalid telegram signature", async () => {
    mocks.validateTelegramAuthPayloadMock.mockReturnValue({ ok: false, error: "invalid_signature" });

    const request = new NextRequest("http://localhost/api/auth/telegram/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "100",
        auth_date: String(Math.floor(Date.now() / 1000)),
        hash: validHash,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Не удалось проверить Telegram-подпись");
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "login_failed",
        payload: { method: "telegram", reason: "invalid_signature" },
      }),
    );
  });

  it("returns 409 when telegram already linked to another account", async () => {
    mocks.findOrLinkTelegramUserMock.mockRejectedValue(new Error("TELEGRAM_ALREADY_LINKED"));

    const request = new NextRequest("http://localhost/api/auth/telegram/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "100",
        auth_date: String(Math.floor(Date.now() / 1000)),
        hash: validHash,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.code).toBe("account_exists");
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "login_failed",
        payload: { method: "telegram", reason: "telegram_already_linked" },
      }),
    );
  });

  it("creates session when telegram payload is valid", async () => {
    mocks.getCurrentUserMock.mockResolvedValue({ id: "current-user" });
    mocks.findOrLinkTelegramUserMock.mockResolvedValue({
      id: "u-telegram",
      email: "tg_100@telegram.local",
      role: "student",
    });

    const request = new NextRequest("http://localhost/api/auth/telegram/callback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        id: "100",
        first_name: "Test",
        auth_date: String(Math.floor(Date.now() / 1000)),
        hash: validHash,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mocks.setAuthSessionCookieMock).toHaveBeenCalledWith(
      expect.any(Object),
      "jwt-telegram",
    );
    expect(mocks.findOrLinkTelegramUserMock).toHaveBeenCalledWith({
      telegramId: "100",
      currentUserId: "current-user",
    });
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "login_success",
        userId: "u-telegram",
        payload: { method: "telegram" },
      }),
    );
  });
});

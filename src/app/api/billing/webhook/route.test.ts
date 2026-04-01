import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  applyYooKassaWebhookMock: vi.fn(),
  verifyWebhookSignatureMock: vi.fn(),
  createAnalyticsEventMock: vi.fn(),
  observeRequestMock: vi.fn(),
  rateLimitByRequestMock: vi.fn(),
}));

vi.mock("@/lib/billing", () => ({
  applyYooKassaWebhook: mocks.applyYooKassaWebhookMock,
  verifyWebhookSignature: mocks.verifyWebhookSignatureMock,
}));

vi.mock("@/lib/db", () => ({
  createAnalyticsEvent: mocks.createAnalyticsEventMock,
}));

vi.mock("@/lib/observability", () => ({
  observeRequest: mocks.observeRequestMock,
}));

vi.mock("@/lib/security", () => ({
  applyRateLimitHeaders: vi.fn(),
  createRateLimitResponse: vi.fn((result: { retryAfterSec: number }, message: string) =>
    Response.json({ error: message, retryAfterSec: result.retryAfterSec }, { status: 429 })),
  rateLimitByRequest: mocks.rateLimitByRequestMock,
}));

import { POST } from "@/app/api/billing/webhook/route";

describe("POST /api/billing/webhook", () => {
  beforeEach(() => {
    mocks.observeRequestMock.mockImplementation(async (input: { handler: () => Promise<unknown> }) => input.handler());
    mocks.rateLimitByRequestMock.mockReturnValue({
      ok: true,
      limit: 180,
      remaining: 179,
      resetAt: Date.now() + 60_000,
      retryAfterSec: 60,
    });
    mocks.verifyWebhookSignatureMock.mockReturnValue(true);
    mocks.createAnalyticsEventMock.mockResolvedValue(null);
    vi.stubEnv("BILLING_WEBHOOK_SECRET", "test_secret");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("returns 401 for invalid signature", async () => {
    mocks.verifyWebhookSignatureMock.mockReturnValue(false);

    const response = await POST(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: { "x-billing-signature": "broken" },
        body: JSON.stringify({ event: "payment.succeeded" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toContain("Invalid webhook signature");
  });

  it("records analytics event for successful payment webhook", async () => {
    mocks.applyYooKassaWebhookMock.mockResolvedValue({
      ok: true,
      deduplicated: false,
      payment: {
        id: "p1",
        userId: "u1",
        planId: "all_access",
        provider: "yookassa",
        amountCents: 1490000,
        status: "succeeded",
      },
    });

    const response = await POST(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        headers: { "x-billing-signature": "ok" },
        body: JSON.stringify({ event: "payment.succeeded" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "payment_succeeded",
        userId: "u1",
      }),
    );
  });
});


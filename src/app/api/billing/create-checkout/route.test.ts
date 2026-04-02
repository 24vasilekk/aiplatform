import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  createCheckoutMock: vi.fn(),
  resolvePlanCourseIdsMock: vi.fn(),
  createAnalyticsEventMock: vi.fn(),
  observeRequestMock: vi.fn(),
  rateLimitByRequestMock: vi.fn(),
  hasJsonContentTypeMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/billing", () => ({
  createCheckout: mocks.createCheckoutMock,
  resolvePlanCourseIds: mocks.resolvePlanCourseIdsMock,
  getBillingProvider: () => "mock",
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
  hasJsonContentType: mocks.hasJsonContentTypeMock,
  rateLimitByRequest: mocks.rateLimitByRequestMock,
}));

import { POST } from "@/app/api/billing/create-checkout/route";

describe("POST /api/billing/create-checkout", () => {
  beforeEach(() => {
    mocks.observeRequestMock.mockImplementation(async ({ handler }) => handler());
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "u1", email: "student@example.com", role: "student" },
      error: null,
    });
    mocks.rateLimitByRequestMock.mockReturnValue({
      ok: true,
      limit: 20,
      remaining: 19,
      resetAt: Date.now() + 60_000,
      retryAfterSec: 60,
    });
    mocks.hasJsonContentTypeMock.mockReturnValue(true);
    mocks.createAnalyticsEventMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 415 when content type is not JSON", async () => {
    mocks.hasJsonContentTypeMock.mockReturnValue(false);

    const response = await POST(new Request("http://localhost/api/billing/create-checkout", { method: "POST" }) as never);
    const data = await response.json();

    expect(response.status).toBe(415);
    expect(data.error).toContain("JSON");
  });

  it("returns admin fallback when provider fails for admin user", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "builtin-admin", email: "admin@ege.local", role: "admin" },
      error: null,
    });
    mocks.createCheckoutMock.mockRejectedValue(new Error("provider unavailable"));
    mocks.resolvePlanCourseIdsMock.mockResolvedValue(["math-ege-2026"]);

    const response = await POST(
      new Request("http://localhost/api/billing/create-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: "math_only" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.payment.fallback).toBe(true);
  });

  it("returns payment payload and tracks analytics on success", async () => {
    mocks.createCheckoutMock.mockResolvedValue({
      payment: {
        id: "p1",
        checkoutToken: "tok_1",
        amountCents: 490000,
        currency: "RUB",
        provider: "mock",
        providerPaymentId: "provider_1",
        idempotencyKey: "idem_1",
      },
      finalStatus: "succeeded",
      provider: "mock",
      checkoutUrl: null,
      fallbackUsed: false,
      planCourseIds: ["math-ege-2026"],
      loyalty: {
        applied: true,
        discountCents: 5000,
        pointsSpent: 5000,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/billing/create-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: "math_only" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.payment.status).toBe("succeeded");
    expect(data.loyalty.discountCents).toBe(5000);
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "checkout_created" }),
    );
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ eventName: "payment_succeeded" }),
    );
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  createPaymentIntentMock: vi.fn(),
  debitWalletForPurchaseMock: vi.fn(),
  isInsufficientFundsErrorMock: vi.fn(),
  markPaymentFailedMock: vi.fn(),
  getWalletByUserIdMock: vi.fn(),
  markPaymentSucceededMock: vi.fn(),
  grantCourseAccessMock: vi.fn(),
  createPaymentEventMock: vi.fn(),
  createAnalyticsEventMock: vi.fn(),
  observeRequestMock: vi.fn(),
  rateLimitByRequestMock: vi.fn(),
  hasJsonContentTypeMock: vi.fn(),
  resolvePlanCourseIdsMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/db", () => ({
  createPaymentIntent: mocks.createPaymentIntentMock,
  debitWalletForPurchase: mocks.debitWalletForPurchaseMock,
  isInsufficientFundsError: mocks.isInsufficientFundsErrorMock,
  markPaymentFailed: mocks.markPaymentFailedMock,
  getWalletByUserId: mocks.getWalletByUserIdMock,
  markPaymentSucceeded: mocks.markPaymentSucceededMock,
  grantCourseAccess: mocks.grantCourseAccessMock,
  createPaymentEvent: mocks.createPaymentEventMock,
  createAnalyticsEvent: mocks.createAnalyticsEventMock,
}));

vi.mock("@/lib/billing", () => ({
  PLAN_PRICES: {
    math_only: 490000,
    bundle_2: 890000,
    all_access: 1490000,
  },
  resolvePlanCourseIds: mocks.resolvePlanCourseIdsMock,
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

import { POST } from "@/app/api/billing/pay-with-wallet/route";

describe("POST /api/billing/pay-with-wallet", () => {
  beforeEach(() => {
    mocks.observeRequestMock.mockImplementation(async (input: { handler: () => Promise<unknown> }) => input.handler());
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
    mocks.resolvePlanCourseIdsMock.mockResolvedValue(["math-ege-2026"]);
    mocks.createPaymentIntentMock.mockResolvedValue({
      id: "pi_1",
      checkoutToken: "ct_1",
      status: "created",
      amountCents: 490000,
      currency: "RUB",
      provider: "wallet",
    });
    mocks.createPaymentEventMock.mockResolvedValue(null);
    mocks.createAnalyticsEventMock.mockResolvedValue(null);
    mocks.grantCourseAccessMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 402 when wallet balance is insufficient", async () => {
    const err = new Error("INSUFFICIENT_FUNDS");
    mocks.debitWalletForPurchaseMock.mockRejectedValue(err);
    mocks.isInsufficientFundsErrorMock.mockReturnValue(true);
    mocks.markPaymentFailedMock.mockResolvedValue({
      id: "pi_1",
      checkoutToken: "ct_1",
      status: "failed",
      amountCents: 490000,
      currency: "RUB",
    });
    mocks.getWalletByUserIdMock.mockResolvedValue({
      userId: "u1",
      balanceCents: 1000,
      currency: "RUB",
    });

    const response = await POST(
      new Request("http://localhost/api/billing/pay-with-wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: "math_only" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(402);
    expect(data.error).toContain("Недостаточно");
    expect(mocks.markPaymentFailedMock).toHaveBeenCalledWith("ct_1", "INSUFFICIENT_FUNDS");
  });

  it("completes purchase and grants course access", async () => {
    mocks.debitWalletForPurchaseMock.mockResolvedValue({ ok: true });
    mocks.markPaymentSucceededMock.mockResolvedValue({
      id: "pi_1",
      checkoutToken: "ct_1",
      status: "succeeded",
      amountCents: 490000,
      currency: "RUB",
      provider: "wallet",
      idempotencyKey: "idem_1",
    });

    const response = await POST(
      new Request("http://localhost/api/billing/pay-with-wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: "math_only", idempotencyKey: "idem_key_0001" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mocks.grantCourseAccessMock).toHaveBeenCalledWith("u1", "math-ege-2026", "subscription");
    expect(mocks.createPaymentEventMock).toHaveBeenCalled();
  });
});

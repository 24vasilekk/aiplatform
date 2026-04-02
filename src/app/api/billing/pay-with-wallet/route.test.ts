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
  getLoyaltyDiscountQuoteMock: vi.fn(),
  redeemLoyaltyDiscountMock: vi.fn(),
  rollbackLoyaltyRedemptionMock: vi.fn(),
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

vi.mock("@/lib/loyalty", () => ({
  getLoyaltyDiscountQuote: mocks.getLoyaltyDiscountQuoteMock,
  redeemLoyaltyDiscount: mocks.redeemLoyaltyDiscountMock,
  rollbackLoyaltyRedemption: mocks.rollbackLoyaltyRedemptionMock,
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
    mocks.getLoyaltyDiscountQuoteMock.mockResolvedValue({
      orderAmountCents: 490000,
      availablePoints: 0,
      maxDiscountCents: 0,
      discountCents: 0,
      pointsToSpend: 0,
      finalAmountCents: 490000,
      reason: "NO_POINTS_AVAILABLE",
      requestedPoints: null,
      rules: {},
    });
    mocks.redeemLoyaltyDiscountMock.mockResolvedValue(null);
    mocks.rollbackLoyaltyRedemptionMock.mockResolvedValue(null);
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

  it("applies loyalty discount when requested", async () => {
    mocks.getLoyaltyDiscountQuoteMock.mockResolvedValue({
      orderAmountCents: 490000,
      availablePoints: 20000,
      maxDiscountCents: 147000,
      discountCents: 10000,
      pointsToSpend: 10000,
      finalAmountCents: 480000,
      reason: null,
      requestedPoints: 10000,
      rules: {},
    });
    mocks.redeemLoyaltyDiscountMock.mockResolvedValue({
      transactionId: "ltx_1",
      pointsSpent: 10000,
      discountCents: 10000,
      balanceAfter: 10000,
      deduplicated: false,
    });
    mocks.debitWalletForPurchaseMock.mockResolvedValue({ ok: true });
    mocks.markPaymentSucceededMock.mockResolvedValue({
      id: "pi_1",
      checkoutToken: "ct_1",
      status: "succeeded",
      amountCents: 480000,
      currency: "RUB",
      provider: "wallet",
      idempotencyKey: "idem_1",
    });

    const response = await POST(
      new Request("http://localhost/api/billing/pay-with-wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: "math_only", applyLoyaltyDiscount: true, requestedLoyaltyPoints: 10000 }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.loyalty.applied).toBe(true);
    expect(mocks.redeemLoyaltyDiscountMock).toHaveBeenCalled();
  });
});

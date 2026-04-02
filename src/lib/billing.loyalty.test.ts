import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createPaymentEventMock: vi.fn(),
  createPaymentIntentMock: vi.fn(),
  findPaymentByCheckoutTokenMock: vi.fn(),
  findPaymentByProviderPaymentIdMock: vi.fn(),
  grantCourseAccessMock: vi.fn(),
  markPaymentCanceledMock: vi.fn(),
  markPaymentFailedMock: vi.fn(),
  markPaymentProcessingMock: vi.fn(),
  markPaymentSucceededMock: vi.fn(),
  updatePaymentMetadataMock: vi.fn(),
  updatePaymentProviderReferenceMock: vi.fn(),
  listAllCoursesMock: vi.fn(),
  getLoyaltyDiscountQuoteMock: vi.fn(),
  redeemLoyaltyDiscountMock: vi.fn(),
  rollbackLoyaltyRedemptionMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  createPaymentEvent: mocks.createPaymentEventMock,
  createPaymentIntent: mocks.createPaymentIntentMock,
  findPaymentByCheckoutToken: mocks.findPaymentByCheckoutTokenMock,
  findPaymentByProviderPaymentId: mocks.findPaymentByProviderPaymentIdMock,
  grantCourseAccess: mocks.grantCourseAccessMock,
  markPaymentCanceled: mocks.markPaymentCanceledMock,
  markPaymentFailed: mocks.markPaymentFailedMock,
  markPaymentProcessing: mocks.markPaymentProcessingMock,
  markPaymentSucceeded: mocks.markPaymentSucceededMock,
  updatePaymentMetadata: mocks.updatePaymentMetadataMock,
  updatePaymentProviderReference: mocks.updatePaymentProviderReferenceMock,
}));

vi.mock("@/lib/course-catalog", () => ({
  listAllCourses: mocks.listAllCoursesMock,
}));

vi.mock("@/lib/loyalty", () => ({
  getLoyaltyDiscountQuote: mocks.getLoyaltyDiscountQuoteMock,
  redeemLoyaltyDiscount: mocks.redeemLoyaltyDiscountMock,
  rollbackLoyaltyRedemption: mocks.rollbackLoyaltyRedemptionMock,
}));

import { applyYooKassaWebhook, createCheckout } from "@/lib/billing";

describe("billing loyalty flows", () => {
  beforeEach(() => {
    vi.stubEnv("MOCK_BILLING_AUTOCONFIRM", "0");
    mocks.listAllCoursesMock.mockResolvedValue([
      { id: "math-base" },
      { id: "physics-base" },
      { id: "russian-base" },
    ]);
    mocks.grantCourseAccessMock.mockResolvedValue(null);
    mocks.markPaymentProcessingMock.mockImplementation(async (token: string) => ({
      id: "pi_1",
      userId: "u1",
      planId: "math_only",
      amountCents: 95000,
      currency: "RUB",
      status: "processing",
      provider: "mock",
      providerPaymentId: null,
      idempotencyKey: "idem_1",
      checkoutToken: token,
      metadata: null,
      failureReason: null,
      failedAt: null,
      canceledAt: null,
      paidAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    mocks.getLoyaltyDiscountQuoteMock.mockResolvedValue({
      orderAmountCents: 99000,
      requestedPoints: 4000,
      availablePoints: 10000,
      maxDiscountCents: 29700,
      discountCents: 4000,
      pointsToSpend: 4000,
      finalAmountCents: 95000,
      reason: null,
      rules: {},
    });
    mocks.redeemLoyaltyDiscountMock.mockResolvedValue({
      transactionId: "ltx_redeem_1",
      pointsSpent: 4000,
      discountCents: 4000,
      balanceAfter: 6000,
      deduplicated: false,
    });
    mocks.updatePaymentMetadataMock.mockResolvedValue(null);
    mocks.createPaymentEventMock.mockResolvedValue({ deduplicated: false });
    mocks.markPaymentCanceledMock.mockImplementation(async (token: string) => ({
      id: "pi_yk",
      userId: "u1",
      planId: "math_only",
      amountCents: 95000,
      currency: "RUB",
      status: "canceled",
      provider: "yookassa",
      providerPaymentId: "yk_1",
      idempotencyKey: "idem_yk",
      checkoutToken: token,
      metadata: JSON.stringify({
        baseAmountCents: 99000,
        loyalty: {
          applied: true,
          discountCents: 4000,
          pointsSpent: 4000,
          redemptionTransactionId: "ltx_redeem_1",
          rollbackTransactionId: null,
        },
      }),
      failureReason: null,
      failedAt: null,
      canceledAt: new Date().toISOString(),
      paidAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    mocks.rollbackLoyaltyRedemptionMock.mockResolvedValue({
      transactionId: "ltx_rollback_1",
      pointsRestored: 4000,
      deduplicated: false,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("redeems loyalty once for repeated createCheckout requests with same idempotency", async () => {
    mocks.createPaymentIntentMock
      .mockResolvedValueOnce({
        id: "pi_1",
        userId: "u1",
        planId: "math_only",
        amountCents: 95000,
        currency: "RUB",
        status: "created",
        provider: "mock",
        providerPaymentId: null,
        idempotencyKey: "idem_1",
        checkoutToken: "ct_1",
        metadata: JSON.stringify({
          baseAmountCents: 99000,
          loyalty: {
            applied: true,
            discountCents: 4000,
            pointsSpent: 4000,
            requestedPoints: 4000,
            redemptionTransactionId: null,
            rollbackTransactionId: null,
          },
        }),
        failureReason: null,
        failedAt: null,
        canceledAt: null,
        paidAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .mockResolvedValueOnce({
        id: "pi_1",
        userId: "u1",
        planId: "math_only",
        amountCents: 95000,
        currency: "RUB",
        status: "processing",
        provider: "mock",
        providerPaymentId: null,
        idempotencyKey: "idem_1",
        checkoutToken: "ct_1",
        metadata: JSON.stringify({
          checkoutUrl: "http://localhost:3000/pricing?mockPayment=ct_1",
          baseAmountCents: 99000,
          loyalty: {
            applied: true,
            discountCents: 4000,
            pointsSpent: 4000,
            requestedPoints: 4000,
            redemptionTransactionId: "ltx_redeem_1",
            rollbackTransactionId: null,
          },
        }),
        failureReason: null,
        failedAt: null,
        canceledAt: null,
        paidAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

    await createCheckout({
      userId: "u1",
      planId: "math_only",
      idempotencyKey: "idem_1",
      preferredProvider: "mock",
      applyLoyaltyDiscount: true,
      requestedLoyaltyPoints: 4000,
    });
    await createCheckout({
      userId: "u1",
      planId: "math_only",
      idempotencyKey: "idem_1",
      preferredProvider: "mock",
      applyLoyaltyDiscount: true,
      requestedLoyaltyPoints: 4000,
    });

    expect(mocks.redeemLoyaltyDiscountMock).toHaveBeenCalledTimes(1);
    expect(mocks.updatePaymentMetadataMock).toHaveBeenCalledTimes(1);
  });

  it("rolls back loyalty only once for duplicated canceled webhook", async () => {
    mocks.findPaymentByCheckoutTokenMock.mockResolvedValue({
      id: "pi_yk",
      userId: "u1",
      planId: "math_only",
      amountCents: 95000,
      currency: "RUB",
      status: "processing",
      provider: "yookassa",
      providerPaymentId: "yk_1",
      idempotencyKey: "idem_yk",
      checkoutToken: "ct_yk_1",
      metadata: JSON.stringify({
        baseAmountCents: 99000,
        loyalty: {
          applied: true,
          discountCents: 4000,
          pointsSpent: 4000,
          requestedPoints: 4000,
          redemptionTransactionId: "ltx_redeem_1",
          rollbackTransactionId: null,
        },
      }),
      failureReason: null,
      failedAt: null,
      canceledAt: null,
      paidAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    mocks.createPaymentEventMock
      .mockResolvedValueOnce({ deduplicated: false })
      .mockResolvedValueOnce({ deduplicated: true });

    const payload = {
      event: "payment.canceled",
      object: {
        id: "yk_1",
        status: "canceled",
        metadata: {
          checkoutToken: "ct_yk_1",
        },
      },
    };

    const first = await applyYooKassaWebhook(payload);
    const second = await applyYooKassaWebhook(payload);

    expect(first.ok).toBe(true);
    expect(first.deduplicated).toBe(false);
    expect(second.ok).toBe(true);
    expect(second.deduplicated).toBe(true);
    expect(mocks.rollbackLoyaltyRedemptionMock).toHaveBeenCalledTimes(1);
  });
});

import crypto from "node:crypto";
import {
  createPaymentEvent,
  createPaymentIntent,
  findPaymentByCheckoutToken,
  findPaymentByProviderPaymentId,
  grantCourseAccess,
  markPaymentCanceled,
  markPaymentFailed,
  markPaymentProcessing,
  markPaymentSucceeded,
  updatePaymentMetadata,
  updatePaymentProviderReference,
  type PaymentIntentRecord,
} from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";
import {
  getLoyaltyDiscountQuote,
  redeemLoyaltyDiscount,
  rollbackLoyaltyRedemption,
} from "@/lib/loyalty";

export type PlanId = "math_only" | "bundle_2" | "all_access";
export type BillingProvider = "mock" | "yookassa";

export const PLAN_PRICES: Record<PlanId, number> = {
  math_only: 99000,
  bundle_2: 158400,
  all_access: 149000,
};

type CheckoutResult = {
  payment: PaymentIntentRecord;
  planCourseIds: string[];
  finalStatus: PaymentIntentRecord["status"];
  provider: BillingProvider;
  checkoutUrl: string | null;
  fallbackUsed: boolean;
  loyalty: {
    applied: boolean;
    discountCents: number;
    pointsSpent: number;
  };
};

type YooKassaCreatePaymentResponse = {
  id: string;
  status: "pending" | "waiting_for_capture" | "succeeded" | "canceled";
  cancellation_details?: { reason?: string } | null;
  confirmation?: {
    type?: string;
    confirmation_url?: string;
  } | null;
};

type WebhookResult = {
  ok: boolean;
  deduplicated: boolean;
  payment: PaymentIntentRecord | null;
};

type PaymentLoyaltyMetadata = {
  applied: boolean;
  discountCents: number;
  pointsSpent: number;
  requestedPoints: number | null;
  redemptionTransactionId: string | null;
  rollbackTransactionId: string | null;
};

function getAppUrl() {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function isYooKassaConfigured() {
  return Boolean(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
}

function normalizeProviderHint(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === "yookassa" || normalized === "mock") return normalized;
  return null;
}

export function getBillingProvider(preferred?: string | null): BillingProvider {
  const envPreferred = normalizeProviderHint(process.env.BILLING_PROVIDER);
  const requested = normalizeProviderHint(preferred);
  const candidate = requested ?? envPreferred ?? "yookassa";
  if (candidate === "yookassa" && isYooKassaConfigured()) {
    return "yookassa";
  }
  return "mock";
}

export async function resolvePlanCourseIds(planId: PlanId) {
  const allCourses = await listAllCourses();
  return planId === "math_only"
    ? ["math-base"]
    : planId === "bundle_2"
      ? ["math-base", "physics-base"]
      : allCourses.map((course) => course.id);
}

function mapYooKassaStatus(status: YooKassaCreatePaymentResponse["status"]): PaymentIntentRecord["status"] {
  if (status === "succeeded") return "succeeded";
  if (status === "canceled") return "canceled";
  if (status === "waiting_for_capture") return "processing";
  return "requires_action";
}

function parsePaymentMetadata(metadata: string | null): Record<string, unknown> {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // ignore malformed metadata
  }
  return {};
}

function buildPaymentMetadata(input: {
  previous?: string | null;
  checkoutUrl?: string | null;
  email?: string;
  providerPayload?: unknown;
  loyalty?: Partial<PaymentLoyaltyMetadata> | null;
  baseAmountCents?: number;
}) {
  const current = parsePaymentMetadata(input.previous ?? null);
  if (input.email) current.email = input.email;
  if (typeof input.checkoutUrl === "string") current.checkoutUrl = input.checkoutUrl;
  if (input.providerPayload !== undefined) current.providerPayload = input.providerPayload;
  if (typeof input.baseAmountCents === "number") current.baseAmountCents = Math.max(0, Math.floor(input.baseAmountCents));
  if (input.loyalty) {
    const existing = getPaymentLoyaltyMetadata(input.previous ?? null);
    current.loyalty = {
      ...existing,
      ...input.loyalty,
    } satisfies PaymentLoyaltyMetadata;
  }
  return JSON.stringify(current);
}

function getPaymentLoyaltyMetadata(metadata: string | null): PaymentLoyaltyMetadata {
  const parsed = parsePaymentMetadata(metadata);
  if (!parsed.loyalty || typeof parsed.loyalty !== "object" || Array.isArray(parsed.loyalty)) {
    return {
      applied: false,
      discountCents: 0,
      pointsSpent: 0,
      requestedPoints: null,
      redemptionTransactionId: null,
      rollbackTransactionId: null,
    };
  }

  const loyalty = parsed.loyalty as Record<string, unknown>;
  return {
    applied: Boolean(loyalty.applied),
    discountCents: Math.max(0, Math.floor(Number(loyalty.discountCents) || 0)),
    pointsSpent: Math.max(0, Math.floor(Number(loyalty.pointsSpent) || 0)),
    requestedPoints:
      loyalty.requestedPoints === null || loyalty.requestedPoints === undefined
        ? null
        : Math.max(0, Math.floor(Number(loyalty.requestedPoints) || 0)),
    redemptionTransactionId: typeof loyalty.redemptionTransactionId === "string" ? loyalty.redemptionTransactionId : null,
    rollbackTransactionId: typeof loyalty.rollbackTransactionId === "string" ? loyalty.rollbackTransactionId : null,
  };
}

function getBaseAmountFromMetadata(payment: PaymentIntentRecord) {
  const parsed = parsePaymentMetadata(payment.metadata);
  if (typeof parsed.baseAmountCents === "number" && Number.isFinite(parsed.baseAmountCents)) {
    return Math.max(0, Math.floor(parsed.baseAmountCents));
  }
  return payment.amountCents;
}

async function maybeRollbackLoyaltyRedemption(input: {
  payment: PaymentIntentRecord;
  status: PaymentIntentRecord["status"];
  reason: string;
}) {
  const loyalty = getPaymentLoyaltyMetadata(input.payment.metadata);
  if (!loyalty.applied || !loyalty.redemptionTransactionId || loyalty.rollbackTransactionId) {
    return null;
  }

  const rollback = await rollbackLoyaltyRedemption({
    userId: input.payment.userId,
    redemptionTransactionId: loyalty.redemptionTransactionId,
    idempotencyKey: `checkout_loyalty_rollback:${input.payment.checkoutToken}`,
    reason: `${input.status}:${input.reason}`,
  });

  if (!rollback?.transactionId) return rollback;

  const metadata = buildPaymentMetadata({
    previous: input.payment.metadata,
    loyalty: {
      rollbackTransactionId: rollback.transactionId,
    },
  });
  await updatePaymentMetadata({
    checkoutToken: input.payment.checkoutToken,
    metadata,
  });
  return rollback;
}

async function createYooKassaPayment(input: {
  payment: PaymentIntentRecord;
  planId: PlanId;
  email?: string;
  idempotencyKey: string;
}) {
  const shopId = process.env.YOOKASSA_SHOP_ID!;
  const secretKey = process.env.YOOKASSA_SECRET_KEY!;
  const amountValue = (input.payment.amountCents / 100).toFixed(2);
  const auth = Buffer.from(`${shopId}:${secretKey}`).toString("base64");

  const response = await fetch("https://api.yookassa.ru/v3/payments", {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/json",
      "Idempotence-Key": input.idempotencyKey,
    },
    body: JSON.stringify({
      amount: {
        value: amountValue,
        currency: input.payment.currency,
      },
      capture: true,
      confirmation: {
        type: "redirect",
        return_url: `${getAppUrl()}/pricing?payment=return`,
      },
      description: `EGE MVP: ${input.planId}`,
      metadata: {
        checkoutToken: input.payment.checkoutToken,
        paymentId: input.payment.id,
        userId: input.payment.userId,
        planId: input.planId,
        email: input.email ?? null,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`YooKassa create payment failed: ${response.status} ${text.slice(0, 300)}`);
  }

  return (await response.json()) as YooKassaCreatePaymentResponse;
}

async function applySuccessAccess(userId: string, planId: PlanId) {
  const courseIds = await resolvePlanCourseIds(planId);
  await Promise.all(courseIds.map((courseId) => grantCourseAccess(userId, courseId, "subscription")));
  return courseIds;
}

export async function createCheckout(input: {
  userId: string;
  planId: PlanId;
  email?: string;
  idempotencyKey?: string | null;
  preferredProvider?: string | null;
  applyLoyaltyDiscount?: boolean;
  requestedLoyaltyPoints?: number | null;
}): Promise<CheckoutResult> {
  const provider = getBillingProvider(input.preferredProvider);
  const planCourseIds = await resolvePlanCourseIds(input.planId);
  const normalizedIdempotencyKey = input.idempotencyKey?.trim() || null;
  const baseAmountCents = PLAN_PRICES[input.planId];
  const loyaltyQuote = input.applyLoyaltyDiscount
    ? await getLoyaltyDiscountQuote({
        userId: input.userId,
        orderAmountCents: baseAmountCents,
        requestedPoints: input.requestedLoyaltyPoints ?? null,
      })
    : null;
  const loyaltyApplied = Boolean(loyaltyQuote && loyaltyQuote.discountCents > 0 && loyaltyQuote.pointsToSpend > 0);
  const chargeAmountCents = loyaltyApplied ? loyaltyQuote!.finalAmountCents : baseAmountCents;

  const payment = await createPaymentIntent({
    userId: input.userId,
    planId: input.planId,
    amountCents: chargeAmountCents,
    currency: "RUB",
    provider,
    idempotencyKey: normalizedIdempotencyKey,
    metadata: buildPaymentMetadata({
      email: input.email,
      baseAmountCents,
      loyalty: {
        applied: loyaltyApplied,
        discountCents: loyaltyQuote?.discountCents ?? 0,
        pointsSpent: loyaltyQuote?.pointsToSpend ?? 0,
        requestedPoints: loyaltyQuote?.requestedPoints ?? null,
      },
    }),
    status: provider === "mock" ? "created" : "requires_action",
  });

  const cachedMetadata = parsePaymentMetadata(payment.metadata);
  const paymentLoyalty = getPaymentLoyaltyMetadata(payment.metadata);
  let loyaltyState = paymentLoyalty;
  if (
    paymentLoyalty.applied &&
    !paymentLoyalty.redemptionTransactionId &&
    paymentLoyalty.pointsSpent > 0 &&
    payment.status !== "succeeded" &&
    payment.status !== "failed" &&
    payment.status !== "canceled"
  ) {
    const redemption = await redeemLoyaltyDiscount({
      userId: payment.userId,
      orderAmountCents: getBaseAmountFromMetadata(payment),
      requestedPoints: paymentLoyalty.requestedPoints,
      paymentIntentId: payment.id,
      planId: payment.planId as PlanId,
      idempotencyKey: `checkout_loyalty_redeem:${payment.checkoutToken}`,
    });
    if (redemption) {
      const updatedMetadata = buildPaymentMetadata({
        previous: payment.metadata,
        loyalty: {
          applied: true,
          discountCents: redemption.discountCents,
          pointsSpent: redemption.pointsSpent,
          redemptionTransactionId: redemption.transactionId,
        },
      });
      await updatePaymentMetadata({
        checkoutToken: payment.checkoutToken,
        metadata: updatedMetadata,
      });
      loyaltyState = {
        ...paymentLoyalty,
        applied: true,
        discountCents: redemption.discountCents,
        pointsSpent: redemption.pointsSpent,
        redemptionTransactionId: redemption.transactionId,
      };
    }
  }

  if (
    normalizedIdempotencyKey &&
    payment.idempotencyKey === normalizedIdempotencyKey &&
    (payment.status === "requires_action" || payment.status === "processing") &&
    typeof cachedMetadata.checkoutUrl === "string"
  ) {
    return {
      payment,
      planCourseIds,
      finalStatus: payment.status,
      provider: payment.provider === "yookassa" ? "yookassa" : "mock",
      checkoutUrl: cachedMetadata.checkoutUrl,
      fallbackUsed: payment.provider !== provider,
      loyalty: {
        applied: loyaltyState.applied,
        discountCents: loyaltyState.discountCents,
        pointsSpent: loyaltyState.pointsSpent,
      },
    };
  }

  if (provider === "mock") {
    const autoConfirm = process.env.MOCK_BILLING_AUTOCONFIRM !== "0";
    if (autoConfirm) {
      const updated = await markPaymentSucceeded(payment.checkoutToken);
      await applySuccessAccess(updated.userId, input.planId);
      return {
        payment: updated,
        planCourseIds,
        finalStatus: "succeeded",
        provider: "mock",
        checkoutUrl: `${getAppUrl()}/pricing?mockPayment=${updated.checkoutToken}`,
        fallbackUsed: false,
        loyalty: {
          applied: loyaltyState.applied,
          discountCents: loyaltyState.discountCents,
          pointsSpent: loyaltyState.pointsSpent,
        },
      };
    }

    const pending = await markPaymentProcessing(payment.checkoutToken);
    return {
      payment: pending,
      planCourseIds,
      finalStatus: pending.status,
      provider: "mock",
      checkoutUrl: `${getAppUrl()}/pricing?mockPayment=${pending.checkoutToken}`,
      fallbackUsed: false,
      loyalty: {
        applied: loyaltyState.applied,
        discountCents: loyaltyState.discountCents,
        pointsSpent: loyaltyState.pointsSpent,
      },
    };
  }

  try {
    const yookassa = await createYooKassaPayment({
      payment,
      planId: input.planId,
      email: input.email,
      idempotencyKey: normalizedIdempotencyKey ?? payment.checkoutToken,
    });
    const mappedStatus = mapYooKassaStatus(yookassa.status);
    const checkoutUrl = yookassa.confirmation?.confirmation_url ?? null;
    const metadata = buildPaymentMetadata({
      previous: payment.metadata,
      checkoutUrl,
      providerPayload: {
        status: yookassa.status,
      },
    });

    let updated = await updatePaymentProviderReference({
      checkoutToken: payment.checkoutToken,
      provider: "yookassa",
      providerPaymentId: yookassa.id,
      metadata,
    });

    if (mappedStatus === "succeeded") {
      updated = await markPaymentSucceeded(payment.checkoutToken);
      await applySuccessAccess(payment.userId, input.planId);
    } else if (mappedStatus === "canceled") {
      updated = await markPaymentCanceled(payment.checkoutToken, yookassa.cancellation_details?.reason);
      await maybeRollbackLoyaltyRedemption({
        payment: updated,
        status: "canceled",
        reason: yookassa.cancellation_details?.reason ?? "create_payment_canceled",
      });
    } else if (mappedStatus === "processing") {
      updated = await markPaymentProcessing(payment.checkoutToken);
    }

    return {
      payment: updated,
      planCourseIds,
      finalStatus: updated.status,
      provider: "yookassa",
      checkoutUrl,
      fallbackUsed: false,
      loyalty: {
        applied: loyaltyState.applied,
        discountCents: loyaltyState.discountCents,
        pointsSpent: loyaltyState.pointsSpent,
      },
    };
  } catch {
    await updatePaymentProviderReference({
      checkoutToken: payment.checkoutToken,
      provider: "mock",
      providerPaymentId: `fallback-${payment.checkoutToken}`,
      metadata: buildPaymentMetadata({
        previous: payment.metadata,
        checkoutUrl: `${getAppUrl()}/pricing?mockPayment=${payment.checkoutToken}`,
      }),
    });

    const autoConfirm = process.env.MOCK_BILLING_AUTOCONFIRM !== "0";
    if (autoConfirm) {
      const paid = await markPaymentSucceeded(payment.checkoutToken);
      await applySuccessAccess(paid.userId, input.planId);
      return {
        payment: paid,
        planCourseIds,
        finalStatus: "succeeded",
        provider: "mock",
        checkoutUrl: `${getAppUrl()}/pricing?mockPayment=${payment.checkoutToken}`,
        fallbackUsed: true,
        loyalty: {
          applied: loyaltyState.applied,
          discountCents: loyaltyState.discountCents,
          pointsSpent: loyaltyState.pointsSpent,
        },
      };
    }

    const processing = await markPaymentProcessing(payment.checkoutToken);
    return {
      payment: processing,
      planCourseIds,
      finalStatus: processing.status,
      provider: "mock",
      checkoutUrl: `${getAppUrl()}/pricing?mockPayment=${payment.checkoutToken}`,
      fallbackUsed: true,
      loyalty: {
        applied: loyaltyState.applied,
        discountCents: loyaltyState.discountCents,
        pointsSpent: loyaltyState.pointsSpent,
      },
    };
  }
}

export function verifyWebhookSignature(input: {
  payload: string;
  signature: string | null;
  secret: string | null;
  toleranceMs?: number;
  allowLegacySecretComparison?: boolean;
}) {
  const secret = input.secret?.trim();
  if (!secret) return true;
  const signature = input.signature?.trim();
  if (!signature) return false;

  if (input.allowLegacySecretComparison && signature === secret) return true;

  const match = signature.match(/^t=(\d+),v1=([a-fA-F0-9]{64})$/);
  if (!match) return false;
  const timestampMs = Number.parseInt(match[1], 10) * 1000;
  if (!Number.isFinite(timestampMs)) return false;

  const tolerance = input.toleranceMs ?? 5 * 60 * 1000;
  if (Math.abs(Date.now() - timestampMs) > tolerance) return false;

  const expected = crypto.createHmac("sha256", secret).update(`${match[1]}.${input.payload}`).digest("hex");
  const received = match[2].toLowerCase();
  const left = Buffer.from(expected);
  const right = Buffer.from(received);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function mapWebhookStatus(input: {
  event: string;
  objectStatus: string | null;
}): PaymentIntentRecord["status"] | null {
  const event = input.event.toLowerCase();
  const status = (input.objectStatus ?? "").toLowerCase();

  if (event === "payment.succeeded" || status === "succeeded") return "succeeded";
  if (event === "payment.canceled" || status === "canceled") return "canceled";
  if (event === "payment.waiting_for_capture" || status === "waiting_for_capture") return "processing";
  if (status === "pending") return "requires_action";
  if (status === "failed") return "failed";
  return null;
}

export async function applyYooKassaWebhook(payload: unknown): Promise<WebhookResult> {
  if (!payload || typeof payload !== "object") {
    return { ok: false, deduplicated: false, payment: null };
  }

  const event = typeof (payload as { event?: unknown }).event === "string" ? (payload as { event: string }).event : "";
  const objectRaw = (payload as { object?: unknown }).object;
  if (!objectRaw || typeof objectRaw !== "object") {
    return { ok: false, deduplicated: false, payment: null };
  }

  const object = objectRaw as {
    id?: string;
    status?: string;
    metadata?: Record<string, unknown>;
    canceled_at?: string;
    cancellation_details?: { reason?: string };
  };

  const providerPaymentId = typeof object.id === "string" ? object.id : "";
  if (!providerPaymentId) {
    return { ok: false, deduplicated: false, payment: null };
  }

  const mappedStatus = mapWebhookStatus({
    event,
    objectStatus: typeof object.status === "string" ? object.status : null,
  });
  if (!mappedStatus) {
    return { ok: false, deduplicated: false, payment: null };
  }

  const checkoutTokenFromMetadata =
    object.metadata && typeof object.metadata.checkoutToken === "string" ? object.metadata.checkoutToken : null;

  const payment =
    (checkoutTokenFromMetadata ? await findPaymentByCheckoutToken(checkoutTokenFromMetadata) : null) ??
    (await findPaymentByProviderPaymentId("yookassa", providerPaymentId));

  if (!payment) {
    return { ok: false, deduplicated: false, payment: null };
  }

  const providerEventId = `yookassa:${event || object.status || "unknown"}:${providerPaymentId}`;
  const eventRecord = await createPaymentEvent({
    paymentId: payment.id,
    userId: payment.userId,
    provider: "yookassa",
    providerEventId,
    status: mappedStatus,
    payload: payload as Record<string, unknown>,
  });

  if (eventRecord.deduplicated) {
    return { ok: true, deduplicated: true, payment };
  }

  let updated = payment;
  if (mappedStatus === "succeeded") {
    updated = await markPaymentSucceeded(payment.checkoutToken);
    await applySuccessAccess(updated.userId, updated.planId as PlanId);
  } else if (mappedStatus === "processing" || mappedStatus === "requires_action") {
    updated = await markPaymentProcessing(payment.checkoutToken);
  } else if (mappedStatus === "canceled") {
    updated = await markPaymentCanceled(
      payment.checkoutToken,
      object.cancellation_details?.reason ?? object.canceled_at ?? "canceled_by_provider",
    );
    await maybeRollbackLoyaltyRedemption({
      payment: updated,
      status: "canceled",
      reason: object.cancellation_details?.reason ?? "canceled_by_provider",
    });
  } else {
    updated = await markPaymentFailed(payment.checkoutToken, "failed_by_provider");
    await maybeRollbackLoyaltyRedemption({
      payment: updated,
      status: "failed",
      reason: "failed_by_provider",
    });
  }

  return { ok: true, deduplicated: false, payment: updated };
}

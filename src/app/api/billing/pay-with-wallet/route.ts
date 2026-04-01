import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { DEMO_PAID_COOKIE, DEMO_PAID_COURSES_COOKIE } from "@/lib/auth";
import { PLAN_PRICES, resolvePlanCourseIds, type PlanId } from "@/lib/billing";
import {
  createAnalyticsEvent,
  createPaymentEvent,
  createPaymentIntent,
  debitWalletForPurchase,
  getWalletByUserId,
  grantCourseAccess,
  isInsufficientFundsError,
  markPaymentFailed,
  markPaymentSucceeded,
} from "@/lib/db";
import { observeRequest } from "@/lib/observability";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  planId: z.enum(["math_only", "bundle_2", "all_access"]).default("all_access"),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

function setPaidCookies(response: NextResponse, planId: PlanId, courseIds: string[]) {
  if (planId === "all_access") {
    response.cookies.set(DEMO_PAID_COOKIE, "1", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
      priority: "high",
    });
    response.cookies.set(DEMO_PAID_COURSES_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
      priority: "high",
    });
    return;
  }

  response.cookies.set(DEMO_PAID_COOKIE, "0", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    priority: "high",
  });
  response.cookies.set(DEMO_PAID_COURSES_COOKIE, courseIds.join(","), {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    priority: "high",
  });
}

export async function POST(request: NextRequest) {
  return observeRequest({
    request,
    operation: "billing.pay_with_wallet",
    handler: async () => {
      const auth = await requireUser(request);
      if (auth.error || !auth.user) {
        return auth.error;
      }

      const rateLimit = rateLimitByRequest({
        request,
        namespace: "billing-wallet-pay",
        keySuffix: auth.user.id,
        limit: 20,
        windowMs: 10 * 60 * 1_000,
      });
      if (!rateLimit.ok) {
        return createRateLimitResponse(rateLimit, "Слишком много попыток оплаты. Попробуйте позже.");
      }

      if (!hasJsonContentType(request)) {
        const response = NextResponse.json({ error: "Ожидается JSON-запрос" }, { status: 415 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const parsed = schema.safeParse(await request.json().catch(() => ({})));
      if (!parsed.success) {
        const response = NextResponse.json({ error: "Неверные данные оплаты" }, { status: 400 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const { planId } = parsed.data;
      const requestPath = new URL(request.url).pathname;
      const headerIdempotencyKey = request.headers.get("x-idempotency-key")?.trim() ?? "";
      const resolvedIdempotencyKey =
        parsed.data.idempotencyKey ??
        (headerIdempotencyKey || `wallet_purchase_${auth.user.id}_${crypto.randomUUID()}`);

      const payment = await createPaymentIntent({
    userId: auth.user.id,
    planId,
    amountCents: PLAN_PRICES[planId],
    currency: "RUB",
    provider: "wallet",
    status: "created",
    idempotencyKey: resolvedIdempotencyKey,
    metadata: JSON.stringify({ source: "wallet_purchase", planId }),
  });

      if (payment.status === "succeeded") {
        const planCourseIds = await resolvePlanCourseIds(planId);
        const response = NextResponse.json({
      ok: true,
      message: "Покупка уже подтверждена ранее.",
      payment: {
        id: payment.id,
        checkoutToken: payment.checkoutToken,
        status: payment.status,
        amountCents: payment.amountCents,
        currency: payment.currency,
        provider: payment.provider,
      },
        });
        setPaidCookies(response, planId, planCourseIds);
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const planCourseIds = await resolvePlanCourseIds(planId);

      try {
        await debitWalletForPurchase({
      userId: auth.user.id,
      amountCents: payment.amountCents,
      paymentIntentId: payment.id,
      idempotencyKey: `wallet_debit_${resolvedIdempotencyKey}`,
      metadata: {
        planId,
        paymentId: payment.id,
      },
    });
      } catch (error) {
        if (isInsufficientFundsError(error)) {
          const failed = await markPaymentFailed(payment.checkoutToken, "INSUFFICIENT_FUNDS");
          const wallet = await getWalletByUserId(auth.user.id);
          const response = NextResponse.json(
            {
              error: "Недостаточно средств на балансе.",
              payment: {
                id: failed.id,
                checkoutToken: failed.checkoutToken,
                status: failed.status,
                amountCents: failed.amountCents,
                currency: failed.currency,
              },
              wallet,
            },
            { status: 402 },
          );
          applyRateLimitHeaders(response, rateLimit);
          return response;
        }
        throw error;
      }

      const succeeded = await markPaymentSucceeded(payment.checkoutToken);
      await Promise.all(planCourseIds.map((courseId) => grantCourseAccess(auth.user.id, courseId, "subscription")));
      await createPaymentEvent({
        paymentId: succeeded.id,
        userId: auth.user.id,
        provider: "wallet",
        providerEventId: `wallet:${resolvedIdempotencyKey}`,
        status: "succeeded",
        payload: {
          planId,
          amountCents: succeeded.amountCents,
        },
      });

      await createAnalyticsEvent({
        eventName: "checkout_created",
        userId: auth.user.id,
        path: requestPath,
        payload: {
          planId,
          provider: "wallet",
          amountCents: succeeded.amountCents,
          status: "succeeded",
        },
      });
      await createAnalyticsEvent({
        eventName: "payment_succeeded",
        userId: auth.user.id,
        path: requestPath,
        payload: {
          planId,
          provider: "wallet",
          amountCents: succeeded.amountCents,
        },
      });

      const response = NextResponse.json({
        ok: true,
        message: "Покупка с баланса успешно завершена.",
        payment: {
          id: succeeded.id,
          checkoutToken: succeeded.checkoutToken,
          status: succeeded.status,
          amountCents: succeeded.amountCents,
          currency: succeeded.currency,
          provider: succeeded.provider,
          idempotencyKey: succeeded.idempotencyKey,
        },
      });
      setPaidCookies(response, planId, planCourseIds);
      applyRateLimitHeaders(response, rateLimit);
      return response;
    },
  });
}

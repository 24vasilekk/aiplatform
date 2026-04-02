import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { DEMO_PAID_COOKIE, DEMO_PAID_COURSES_COOKIE } from "@/lib/auth";
import { createCheckout, getBillingProvider, resolvePlanCourseIds, type PlanId } from "@/lib/billing";
import { createAnalyticsEvent } from "@/lib/db";
import { observeRequest } from "@/lib/observability";
import {
  applyRateLimitHeaders,
  createRateLimitResponse,
  hasJsonContentType,
  rateLimitByRequest,
} from "@/lib/security";

const schema = z.object({
  planId: z.enum(["math_only", "bundle_2", "all_access"]).default("all_access"),
  email: z.email().optional(),
  provider: z.enum(["yookassa", "mock"]).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
  applyLoyaltyDiscount: z.boolean().optional().default(false),
  requestedLoyaltyPoints: z.number().int().positive().optional(),
});

export async function POST(request: NextRequest) {
  return observeRequest({
    request,
    operation: "billing.create_checkout",
    handler: async () => {
      const auth = await requireUser(request);
      if (auth.error || !auth.user) {
        return auth.error;
      }

      const rateLimit = rateLimitByRequest({
        request,
        namespace: "billing-create-checkout",
        keySuffix: auth.user.id,
        limit: 20,
        windowMs: 10 * 60 * 1000,
      });
      if (!rateLimit.ok) {
        return createRateLimitResponse(rateLimit, "Слишком много попыток создания оплаты. Попробуйте позже.");
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

      const { planId, email, provider, idempotencyKey, applyLoyaltyDiscount, requestedLoyaltyPoints } = parsed.data;
      const requestPath = new URL(request.url).pathname;
      const headerIdempotencyKey = request.headers.get("x-idempotency-key")?.trim() ?? "";
      const resolvedIdempotencyKey = idempotencyKey ?? (headerIdempotencyKey || null);
      let checkout: Awaited<ReturnType<typeof createCheckout>> | null = null;

      try {
        checkout = await createCheckout({
          userId: auth.user.id,
          planId: planId as PlanId,
          email,
          idempotencyKey: resolvedIdempotencyKey,
          preferredProvider: provider ?? null,
          applyLoyaltyDiscount,
          requestedLoyaltyPoints: requestedLoyaltyPoints ?? null,
        });
      } catch {
        checkout = null;
      }

      if (!checkout) {
        if (auth.user.role !== "admin") {
          const response = NextResponse.json({ error: "Ошибка оплаты" }, { status: 500 });
          applyRateLimitHeaders(response, rateLimit);
          return response;
        }

    // Fallback for builtin admin sessions that may not have a DB user row.
    const planCourseIds = await resolvePlanCourseIds(planId as PlanId);
    const response = NextResponse.json({
      ok: true,
      message: "Демо-оплата подтверждена через fallback-режим (admin).",
      payment: {
        id: `fallback-${Date.now()}`,
        checkoutToken: "fallback",
        status: "succeeded",
        amountCents: 0,
        currency: "RUB",
        fallback: true,
      },
    });

    if (planId === "all_access") {
      response.cookies.set(DEMO_PAID_COOKIE, "1", {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      response.cookies.set(DEMO_PAID_COURSES_COOKIE, "", {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
    } else {
      response.cookies.set(DEMO_PAID_COOKIE, "0", {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      response.cookies.set(DEMO_PAID_COURSES_COOKIE, planCourseIds.join(","), {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const planLabel =
    planId === "math_only"
      ? "Курс по математике"
      : planId === "bundle_2"
        ? "Пакет 1+1 (математика + физика)"
        : "Доступ ко всем курсам";

      const response = NextResponse.json({
    ok: true,
    message:
      checkout.finalStatus === "succeeded"
        ? `Оплата подтверждена: ${planLabel}. Доступ открыт.`
        : checkout.checkoutUrl
          ? `Счет создан: ${planLabel}. Перенаправляем на оплату (${checkout.provider}).`
          : `Счет создан: ${planLabel}. Провайдер: ${checkout.provider || getBillingProvider()}. Ожидаем подтверждение оплаты.`,
    payment: {
      id: checkout.payment.id,
      checkoutToken: checkout.payment.checkoutToken,
      status: checkout.finalStatus,
      amountCents: checkout.payment.amountCents,
      currency: checkout.payment.currency,
      provider: checkout.provider,
      providerPaymentId: checkout.payment.providerPaymentId,
      checkoutUrl: checkout.checkoutUrl,
      fallbackUsed: checkout.fallbackUsed,
      idempotencyKey: checkout.payment.idempotencyKey,
    },
    loyalty: checkout.loyalty,
  });

      await createAnalyticsEvent({
    eventName: "checkout_created",
    userId: auth.user.id,
    path: requestPath,
    payload: {
      planId,
      provider: checkout.provider,
      amountCents: checkout.payment.amountCents,
      status: checkout.finalStatus,
      fallbackUsed: checkout.fallbackUsed,
      loyaltyDiscountCents: checkout.loyalty.discountCents,
      loyaltyPointsSpent: checkout.loyalty.pointsSpent,
    },
  });
      if (checkout.finalStatus === "succeeded") {
    await createAnalyticsEvent({
      eventName: "payment_succeeded",
      userId: auth.user.id,
      path: requestPath,
      payload: {
        planId,
        provider: checkout.provider,
        amountCents: checkout.payment.amountCents,
        loyaltyDiscountCents: checkout.loyalty.discountCents,
        loyaltyPointsSpent: checkout.loyalty.pointsSpent,
      },
    });
      } else if (checkout.finalStatus === "failed") {
    await createAnalyticsEvent({
      eventName: "payment_failed",
      userId: auth.user.id,
      path: requestPath,
      payload: { planId, provider: checkout.provider },
    });
      } else if (checkout.finalStatus === "canceled") {
    await createAnalyticsEvent({
      eventName: "payment_canceled",
      userId: auth.user.id,
      path: requestPath,
      payload: { planId, provider: checkout.provider },
    });
  }

      if (checkout.finalStatus === "succeeded" && planId === "all_access") {
    response.cookies.set(DEMO_PAID_COOKIE, "1", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set(DEMO_PAID_COURSES_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
      } else if (checkout.finalStatus === "succeeded") {
    response.cookies.set(DEMO_PAID_COOKIE, "0", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set(DEMO_PAID_COURSES_COOKIE, checkout.planCourseIds.join(","), {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
      } else {
    response.cookies.set(DEMO_PAID_COOKIE, "0", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set(DEMO_PAID_COURSES_COOKIE, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

      applyRateLimitHeaders(response, rateLimit);
      return response;
    },
  });
}

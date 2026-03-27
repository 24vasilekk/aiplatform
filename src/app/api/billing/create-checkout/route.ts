import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { DEMO_PAID_COOKIE, DEMO_PAID_COURSES_COOKIE } from "@/lib/auth";
import { createCheckout, getBillingProvider, resolvePlanCourseIds, type PlanId } from "@/lib/billing";

const schema = z.object({
  planId: z.enum(["math_only", "bundle_2", "all_access"]).default("all_access"),
  email: z.email().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (auth.error || !auth.user) {
    return auth.error;
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Неверные данные оплаты" }, { status: 400 });
  }

  const { planId, email } = parsed.data;
  let checkout: Awaited<ReturnType<typeof createCheckout>> | null = null;
  let checkoutFailed = false;

  try {
    checkout = await createCheckout({
      userId: auth.user.id,
      planId: planId as PlanId,
      email,
    });
  } catch {
    checkoutFailed = true;
  }

  if (!checkout) {
    if (auth.user.role !== "admin") {
      return NextResponse.json({ error: "Ошибка оплаты" }, { status: 500 });
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
        fallback: checkoutFailed,
      },
    });

    if (planId === "all_access") {
      response.cookies.set(DEMO_PAID_COOKIE, "1", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      response.cookies.set(DEMO_PAID_COURSES_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
    } else {
      response.cookies.set(DEMO_PAID_COOKIE, "0", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      response.cookies.set(DEMO_PAID_COURSES_COOKIE, planCourseIds.join(","), {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
    }

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
    message: checkout.finalStatus === "succeeded"
      ? `Оплата подтверждена: ${planLabel}. Доступ открыт.`
      : `Счет создан: ${planLabel}. Провайдер: ${getBillingProvider()}. Ожидаем подтверждение оплаты.`,
    payment: {
      id: checkout.payment.id,
      checkoutToken: checkout.payment.checkoutToken,
      status: checkout.finalStatus,
      amountCents: checkout.payment.amountCents,
      currency: checkout.payment.currency,
    },
  });

  if (checkout.finalStatus === "succeeded" && planId === "all_access") {
    response.cookies.set(DEMO_PAID_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set(DEMO_PAID_COURSES_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  } else if (checkout.finalStatus === "succeeded") {
    response.cookies.set(DEMO_PAID_COOKIE, "0", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set(DEMO_PAID_COURSES_COOKIE, checkout.planCourseIds.join(","), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
  } else {
    response.cookies.set(DEMO_PAID_COOKIE, "0", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    response.cookies.set(DEMO_PAID_COURSES_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}

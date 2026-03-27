import { createPaymentIntent, grantCourseAccess, markPaymentFailed, markPaymentSucceeded } from "@/lib/db";
import { listAllCourses } from "@/lib/course-catalog";

export type PlanId = "math_only" | "bundle_2" | "all_access";

export type BillingProvider = "mock" | "yookassa" | "stripe";

export function getBillingProvider(): BillingProvider {
  const provider = (process.env.BILLING_PROVIDER ?? "mock").toLowerCase();
  if (provider === "yookassa" || provider === "stripe") {
    return provider;
  }
  return "mock";
}

export const PLAN_PRICES: Record<PlanId, number> = {
  math_only: 99000,
  bundle_2: 158400,
  all_access: 149000,
};

export async function resolvePlanCourseIds(planId: PlanId) {
  const allCourses = await listAllCourses();
  return planId === "math_only"
    ? ["math-base"]
    : planId === "bundle_2"
      ? ["math-base", "physics-base"]
      : allCourses.map((course) => course.id);
}

export async function createCheckout(input: {
  userId: string;
  planId: PlanId;
  email?: string;
}) {
  const provider = getBillingProvider();
  const planCourseIds = await resolvePlanCourseIds(input.planId);

  const payment = await createPaymentIntent({
    userId: input.userId,
    planId: input.planId,
    amountCents: PLAN_PRICES[input.planId],
    currency: "RUB",
    provider,
    metadata: input.email ? JSON.stringify({ email: input.email }) : null,
  });

  if (provider === "mock" && process.env.MOCK_BILLING_AUTOCONFIRM !== "0") {
    await markPaymentSucceeded(payment.checkoutToken);
    await Promise.all(
      planCourseIds.map((courseId) => grantCourseAccess(input.userId, courseId, "subscription")),
    );
    return {
      payment,
      planCourseIds,
      finalStatus: "succeeded" as const,
    };
  }

  return {
    payment,
    planCourseIds,
    finalStatus: payment.status,
  };
}

export async function applyWebhookResult(input: {
  checkoutToken: string;
  userId: string;
  planId: string;
  status: "succeeded" | "failed";
}) {
  if (input.status === "failed") {
    await markPaymentFailed(input.checkoutToken);
    return;
  }

  await markPaymentSucceeded(input.checkoutToken);
  const courseIds = await resolvePlanCourseIds(input.planId as PlanId);
  await Promise.all(courseIds.map((courseId) => grantCourseAccess(input.userId, courseId, "subscription")));
}

export function verifyWebhookSignature(payload: string, signature: string | null) {
  const secret = process.env.BILLING_WEBHOOK_SECRET;
  if (!secret) {
    return true;
  }

  return signature === `${secret}:${payload.length}`;
}

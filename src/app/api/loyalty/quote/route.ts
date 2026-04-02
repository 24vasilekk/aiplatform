import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { PLAN_PRICES, type PlanId } from "@/lib/billing";
import { getLoyaltyDiscountQuote } from "@/lib/loyalty";
import { observeRequest } from "@/lib/observability";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z
  .object({
    planId: z.enum(["math_only", "bundle_2", "all_access"]).optional(),
    orderAmountCents: z.number().int().positive().optional(),
    requestedPoints: z.number().int().positive().optional(),
  })
  .refine((value) => Boolean(value.planId) || Boolean(value.orderAmountCents), {
    message: "Нужно передать planId или orderAmountCents",
  });

function resolveOrderAmount(body: { planId?: PlanId; orderAmountCents?: number }) {
  if (body.planId) {
    return PLAN_PRICES[body.planId];
  }
  return body.orderAmountCents ?? 0;
}

export async function POST(request: NextRequest) {
  return observeRequest({
    request,
    operation: "loyalty.quote",
    handler: async () => {
      const auth = await requireUser(request);
      if (auth.error || !auth.user) {
        return auth.error;
      }
      const rateLimit = rateLimitByRequest({
        request,
        namespace: "loyalty_quote_post",
        keySuffix: auth.user.id,
        limit: 180,
        windowMs: 60_000,
      });
      if (!rateLimit.ok) {
        return createRateLimitResponse(rateLimit, "Слишком много запросов расчета скидки. Попробуйте позже.");
      }
      if (!hasJsonContentType(request)) {
        const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const parsed = schema.safeParse(await request.json().catch(() => ({})));
      if (!parsed.success) {
        const response = NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Некорректный запрос" }, { status: 400 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const orderAmountCents = resolveOrderAmount(parsed.data);
      const quote = await getLoyaltyDiscountQuote({
        userId: auth.user.id,
        orderAmountCents,
        requestedPoints: parsed.data.requestedPoints ?? null,
      });

      const response = NextResponse.json({
        ok: true,
        quote,
      });
      applyRateLimitHeaders(response, rateLimit);
      return response;
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { applyYooKassaWebhook, verifyWebhookSignature } from "@/lib/billing";
import { createAnalyticsEvent } from "@/lib/db";
import { observeRequest } from "@/lib/observability";
import { applyRateLimitHeaders, createRateLimitResponse, rateLimitByRequest } from "@/lib/security";

export async function POST(request: NextRequest) {
  return observeRequest({
    request,
    operation: "billing.webhook",
    handler: async () => {
      const requestPath = new URL(request.url).pathname;
      const payloadText = await request.text();
      const signature = request.headers.get("x-billing-signature");
      const configuredSecret = process.env.BILLING_WEBHOOK_SECRET?.trim() ?? null;
      const rateLimit = rateLimitByRequest({
        request,
        namespace: "billing-webhook",
        limit: 180,
        windowMs: 60 * 1000,
      });
      if (!rateLimit.ok) {
        return createRateLimitResponse(rateLimit, "Too many webhook requests");
      }

      if (configuredSecret) {
        const providedSignature = signature?.trim() || null;
        if (
          !verifyWebhookSignature({
            payload: payloadText,
            signature: providedSignature,
            secret: configuredSecret,
            allowLegacySecretComparison: process.env.NODE_ENV !== "production",
          })
        ) {
          const response = NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
          applyRateLimitHeaders(response, rateLimit);
          return response;
        }
      }

      let payload: unknown;
      try {
        payload = JSON.parse(payloadText || "{}");
      } catch {
        const response = NextResponse.json({ error: "Bad webhook payload" }, { status: 400 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const result = await applyYooKassaWebhook(payload);
      if (!result.ok) {
        const response = NextResponse.json({ error: "Webhook payload not recognized" }, { status: 400 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      if (!result.deduplicated && result.payment) {
        const eventName =
          result.payment.status === "succeeded"
            ? "payment_succeeded"
            : result.payment.status === "failed"
              ? "payment_failed"
              : result.payment.status === "canceled"
                ? "payment_canceled"
                : null;
        if (eventName) {
          await createAnalyticsEvent({
            eventName,
            userId: result.payment.userId,
            path: requestPath,
            payload: {
              planId: result.payment.planId,
              provider: result.payment.provider,
              amountCents: result.payment.amountCents,
              paymentId: result.payment.id,
            },
          });
        }
      }

      const response = NextResponse.json({
        ok: true,
        deduplicated: result.deduplicated,
        paymentStatus: result.payment?.status ?? null,
      });
      applyRateLimitHeaders(response, rateLimit);
      return response;
    },
  });
}

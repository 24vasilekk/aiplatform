import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findPaymentByCheckoutToken } from "@/lib/db";
import { applyWebhookResult, verifyWebhookSignature } from "@/lib/billing";

const schema = z.object({
  checkoutToken: z.string().trim().min(10),
  status: z.enum(["succeeded", "failed"]),
});

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get("x-billing-signature");

  if (!verifyWebhookSignature(payload, signature)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  const parsed = schema.safeParse(JSON.parse(payload || "{}"));
  if (!parsed.success) {
    return NextResponse.json({ error: "Bad webhook payload" }, { status: 400 });
  }

  const payment = await findPaymentByCheckoutToken(parsed.data.checkoutToken);
  if (!payment) {
    return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  }

  await applyWebhookResult({
    checkoutToken: parsed.data.checkoutToken,
    userId: payment.userId,
    planId: payment.planId,
    status: parsed.data.status,
  });

  return NextResponse.json({ ok: true });
}

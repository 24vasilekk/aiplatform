import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import { getWalletSnapshot, topupWallet } from "@/lib/db";
import { observeRequest } from "@/lib/observability";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  amountRub: z.number().positive().max(500_000),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

function toCents(amountRub: number) {
  return Math.max(1, Math.round(amountRub * 100));
}

export async function POST(request: NextRequest) {
  return observeRequest({
    request,
    operation: "wallet.topup",
    handler: async () => {
      const auth = await requireUser(request);
      if (auth.error || !auth.user) {
        return auth.error;
      }

      const rateLimit = rateLimitByRequest({
        request,
        namespace: "wallet-topup",
        keySuffix: auth.user.id,
        limit: 12,
        windowMs: 10 * 60 * 1_000,
      });
      if (!rateLimit.ok) {
        return createRateLimitResponse(rateLimit, "Слишком много попыток пополнения. Попробуйте позже.");
      }

      if (!hasJsonContentType(request)) {
        const response = NextResponse.json({ error: "Ожидается JSON-запрос" }, { status: 415 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const parsed = schema.safeParse(await request.json().catch(() => ({})));
      if (!parsed.success) {
        const response = NextResponse.json({ error: "Неверные данные пополнения" }, { status: 400 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const bodyKey = parsed.data.idempotencyKey?.trim() || null;
      const headerKey = request.headers.get("x-idempotency-key")?.trim() || null;
      const idempotencyKey = bodyKey ?? headerKey;

      await topupWallet({
        userId: auth.user.id,
        amountCents: toCents(parsed.data.amountRub),
        idempotencyKey,
        metadata: {
          source: "user_topup_api",
          amountRub: parsed.data.amountRub,
        },
      });

      const snapshot = await getWalletSnapshot(auth.user.id, 30);
      const response = NextResponse.json({
        ok: true,
        wallet: snapshot.wallet,
        transactions: snapshot.transactions,
        totalTransactions: snapshot.totalTransactions,
      });
      applyRateLimitHeaders(response, rateLimit);
      return response;
    },
  });
}

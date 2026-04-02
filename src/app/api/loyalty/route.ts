import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/api-auth";
import { applyPrivateCache } from "@/lib/http-cache";
import { getLoyaltySnapshot } from "@/lib/loyalty";
import { observeRequest } from "@/lib/observability";
import { applyRateLimitHeaders, createRateLimitResponse, rateLimitByRequest } from "@/lib/security";

function parseTake(value: string | null) {
  if (!value) return 30;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(1, Math.min(parsed, 200));
}

export async function GET(request: NextRequest) {
  return observeRequest({
    request,
    operation: "loyalty.get",
    handler: async () => {
      const auth = await requireUser(request);
      if (auth.error || !auth.user) {
        return auth.error;
      }
      const rateLimit = rateLimitByRequest({
        request,
        namespace: "loyalty_get",
        keySuffix: auth.user.id,
        limit: 300,
        windowMs: 60_000,
      });
      if (!rateLimit.ok) {
        return createRateLimitResponse(rateLimit, "Слишком много запросов лояльности. Попробуйте позже.");
      }

      const take = parseTake(new URL(request.url).searchParams.get("take"));
      const snapshot = await getLoyaltySnapshot(auth.user.id, take);
      const response = NextResponse.json(snapshot);
      applyPrivateCache(response, { maxAgeSec: 15, staleWhileRevalidateSec: 45 });
      applyRateLimitHeaders(response, rateLimit);
      return response;
    },
  });
}

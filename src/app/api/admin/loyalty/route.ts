import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import {
  createAdminAuditLog,
  listAdminAuditLogs,
  listAdminLoyaltyAccounts,
  listAdminLoyaltyTransactions,
} from "@/lib/db";
import {
  LOYALTY_RULES,
  adjustLoyaltyPointsByAdmin,
  getLoyaltySnapshot,
  isInsufficientLoyaltyPointsError,
} from "@/lib/loyalty";
import { observeRequest } from "@/lib/observability";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const adjustmentSchema = z.object({
  userId: z.string().trim().min(3),
  direction: z.enum(["credit", "debit"]),
  points: z.number().int().positive().max(1_000_000),
  reason: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
});

function parseTake(value: string | null, fallback = 100, max = 500) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(1, Math.min(parsed, max));
}

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return undefined;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return undefined;
  if (!endOfDay) return date;
  date.setUTCHours(23, 59, 59, 999);
  return date;
}

export async function GET(request: NextRequest) {
  return observeRequest({
    request,
    operation: "admin.loyalty.get",
    handler: async () => {
      const auth = await requireUser(request);
      if (auth.error || !auth.user) return auth.error;
      if (auth.user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const rateLimit = rateLimitByRequest({
        request,
        namespace: "admin_loyalty_get",
        keySuffix: auth.user.id,
        limit: 300,
        windowMs: 60_000,
      });
      if (!rateLimit.ok) {
        return createRateLimitResponse(rateLimit, "Слишком много запросов loyalty admin. Попробуйте позже.");
      }

      const params = new URL(request.url).searchParams;
      const q = params.get("q")?.trim() || "";
      const userId = params.get("userId")?.trim() || undefined;
      const direction = params.get("direction") === "credit" || params.get("direction") === "debit"
        ? (params.get("direction") as "credit" | "debit")
        : undefined;
      const reason =
        params.get("reason") === "course_completion" ||
        params.get("reason") === "discount_redeem" ||
        params.get("reason") === "discount_rollback" ||
        params.get("reason") === "expiration" ||
        params.get("reason") === "manual_adjustment"
          ? (params.get("reason") as "course_completion" | "discount_redeem" | "discount_rollback" | "expiration" | "manual_adjustment")
          : undefined;

      const take = parseTake(params.get("take"), 100, 500);
      const from = parseDate(params.get("from"), false);
      const to = parseDate(params.get("to"), true);

      const [accounts, transactions, auditLogs] = await Promise.all([
        listAdminLoyaltyAccounts({
          userId,
          userEmail: q || undefined,
          take,
          skip: 0,
        }),
        listAdminLoyaltyTransactions({
          userId,
          userEmail: q || undefined,
          direction,
          reason,
          from,
          to,
          take,
          skip: 0,
        }),
        listAdminAuditLogs({
          entityType: "loyalty",
          entityId: userId,
          from,
          to,
          take,
          skip: 0,
        }),
      ]);

      const response = NextResponse.json({
        rules: LOYALTY_RULES,
        accounts: accounts.rows,
        accountsTotal: accounts.total,
        transactions: transactions.rows,
        transactionsTotal: transactions.total,
        auditLogs: auditLogs.rows,
        auditLogsTotal: auditLogs.total,
      });
      applyRateLimitHeaders(response, rateLimit);
      return response;
    },
  });
}

export async function POST(request: NextRequest) {
  return observeRequest({
    request,
    operation: "admin.loyalty.adjust",
    handler: async () => {
      const auth = await requireUser(request);
      if (auth.error || !auth.user) return auth.error;
      if (auth.user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      const rateLimit = rateLimitByRequest({
        request,
        namespace: "admin_loyalty_post",
        keySuffix: auth.user.id,
        limit: 120,
        windowMs: 60_000,
      });
      if (!rateLimit.ok) {
        return createRateLimitResponse(rateLimit, "Слишком много операций loyalty. Попробуйте позже.");
      }
      if (!hasJsonContentType(request)) {
        const response = NextResponse.json({ error: "Expected application/json" }, { status: 415 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const parsed = adjustmentSchema.safeParse(await request.json().catch(() => ({})));
      if (!parsed.success) {
        const response = NextResponse.json({ error: "Неверные данные операции" }, { status: 400 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const idempotencyKey =
        parsed.data.idempotencyKey ??
        request.headers.get("x-idempotency-key")?.trim() ??
        `admin_loyalty_adjust_${auth.user.id}_${crypto.randomUUID()}`;

      let adjustment;
      try {
        adjustment = await adjustLoyaltyPointsByAdmin({
          userId: parsed.data.userId,
          direction: parsed.data.direction,
          points: parsed.data.points,
          idempotencyKey,
          adminUserId: auth.user.id,
          reason: parsed.data.reason ?? null,
        });
      } catch (error) {
        if (isInsufficientLoyaltyPointsError(error)) {
          const response = NextResponse.json({ error: "Недостаточно баллов для списания" }, { status: 400 });
          applyRateLimitHeaders(response, rateLimit);
          return response;
        }
        throw error;
      }

      await createAdminAuditLog({
        adminUserId: auth.user.id,
        action: "adjust_loyalty_points",
        entityType: "loyalty",
        entityId: parsed.data.userId,
        metadata: {
          direction: parsed.data.direction,
          points: parsed.data.points,
          reason: parsed.data.reason ?? null,
          idempotencyKey,
          transactionId: adjustment.transactionId,
          deduplicated: adjustment.deduplicated,
        },
      });

      const snapshot = await getLoyaltySnapshot(parsed.data.userId, 30);
      const response = NextResponse.json({
        ok: true,
        adjustment,
        snapshot,
      });
      applyRateLimitHeaders(response, rateLimit);
      return response;
    },
  });
}

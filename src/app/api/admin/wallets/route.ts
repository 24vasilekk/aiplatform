import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/api-auth";
import {
  adjustWalletBalance,
  createAdminAuditLog,
  findUserByEmail,
  getWalletSnapshot,
  isInsufficientFundsError,
  listAdminWallets,
  listAdminWalletTransactions,
  listUsersPaged,
} from "@/lib/db";
import { observeRequest } from "@/lib/observability";

const adjustmentSchema = z.object({
  userId: z.string().trim().min(3).optional(),
  userEmail: z.email().trim().max(254).optional(),
  direction: z.enum(["credit", "debit"]),
  amountRub: z.number().positive().max(500_000),
  reason: z.string().trim().max(300).optional(),
  idempotencyKey: z.string().trim().min(8).max(120).optional(),
}).refine((value) => Boolean(value.userId?.trim() || value.userEmail?.trim()), {
  message: "Укажите userId или userEmail",
  path: ["userId"],
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

function toCents(amountRub: number) {
  return Math.max(1, Math.round(amountRub * 100));
}

export async function GET(request: NextRequest) {
  return observeRequest({
    request,
    operation: "admin.wallets.get",
    handler: async () => {
      const auth = await requireUser(request);
      if (auth.error || !auth.user) return auth.error;
      if (auth.user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const params = request.nextUrl.searchParams;
      const q = params.get("q")?.trim() || "";
      const userId = params.get("userId")?.trim() || undefined;
      const direction = params.get("direction") === "credit" || params.get("direction") === "debit"
        ? (params.get("direction") as "credit" | "debit")
        : undefined;
      const operationType =
        params.get("operationType") === "topup" ||
        params.get("operationType") === "purchase" ||
        params.get("operationType") === "refund" ||
        params.get("operationType") === "manual_adjustment"
          ? (params.get("operationType") as "topup" | "purchase" | "refund" | "manual_adjustment")
          : undefined;

      const take = parseTake(params.get("take"), 100, 500);
      const wallets = await listAdminWallets({
        userId,
        userEmail: q || undefined,
        take,
        skip: 0,
      });
      const users = await listUsersPaged({
        query: q || undefined,
        take: Math.min(100, take),
        skip: 0,
      });

      const transactions = await listAdminWalletTransactions({
        userId,
        userEmail: q || undefined,
        direction,
        operationType,
        from: parseDate(params.get("from"), false),
        to: parseDate(params.get("to"), true),
        take,
        skip: 0,
      });

      return NextResponse.json({
        users: users.rows.map((user) => ({
          id: user.id,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt,
        })),
        usersTotal: users.total,
        wallets: wallets.rows,
        walletsTotal: wallets.total,
        transactions: transactions.rows,
        transactionsTotal: transactions.total,
      });
    },
  });
}

export async function POST(request: NextRequest) {
  return observeRequest({
    request,
    operation: "admin.wallets.adjust",
    handler: async () => {
      const auth = await requireUser(request);
      if (auth.error || !auth.user) return auth.error;
      if (auth.user.role !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const parsed = adjustmentSchema.safeParse(await request.json().catch(() => ({})));
      if (!parsed.success) {
        return NextResponse.json({ error: "Неверные данные операции" }, { status: 400 });
      }

      let targetUserId = parsed.data.userId?.trim() ?? "";
      if (!targetUserId && parsed.data.userEmail) {
        const userByEmail = await findUserByEmail(parsed.data.userEmail);
        if (!userByEmail) {
          return NextResponse.json({ error: "Пользователь с таким email не найден" }, { status: 404 });
        }
        targetUserId = userByEmail.id;
      }
      if (!targetUserId) {
        return NextResponse.json({ error: "Укажите получателя операции" }, { status: 400 });
      }

      const idempotencyKey =
        parsed.data.idempotencyKey ??
        request.headers.get("x-idempotency-key")?.trim() ??
        `admin_wallet_adjust_${auth.user.id}_${crypto.randomUUID()}`;

      try {
        await adjustWalletBalance({
          userId: targetUserId,
          direction: parsed.data.direction,
          amountCents: toCents(parsed.data.amountRub),
          idempotencyKey,
          metadata: {
            reason: parsed.data.reason ?? null,
            adminUserId: auth.user.id,
            userEmail: parsed.data.userEmail ?? null,
          },
        });
      } catch (error) {
        if (isInsufficientFundsError(error)) {
          return NextResponse.json({ error: "Недостаточно средств для списания" }, { status: 400 });
        }
        throw error;
      }
      await createAdminAuditLog({
        adminUserId: auth.user.id,
        action: "adjust_wallet_balance",
        entityType: "wallet",
        entityId: targetUserId,
        metadata: {
          direction: parsed.data.direction,
          amountRub: parsed.data.amountRub,
          reason: parsed.data.reason ?? null,
          idempotencyKey,
          userEmail: parsed.data.userEmail ?? null,
        },
      });

      const snapshot = await getWalletSnapshot(targetUserId, 30);
      return NextResponse.json({
        ok: true,
        wallet: snapshot.wallet,
        transactions: snapshot.transactions,
        totalTransactions: snapshot.totalTransactions,
      });
    },
  });
}

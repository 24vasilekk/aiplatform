import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, signAuthToken } from "@/lib/auth";
import { setAuthSessionCookie } from "@/lib/auth-cookie";
import { createAnalyticsEvent, findOrLinkTelegramUser } from "@/lib/db";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  createRateLimitResponse,
  getClientIpFromHeaders,
  hasJsonContentType,
} from "@/lib/security";
import { validateTelegramAuthPayload } from "@/lib/telegram-auth";

const telegramSchema = z.object({
  id: z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => /^[0-9]{1,32}$/.test(value), { message: "invalid_telegram_id" }),
  first_name: z.string().trim().max(128).optional(),
  last_name: z.string().trim().max(128).optional(),
  username: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_]{5,32}$/)
    .optional(),
  photo_url: z.string().url().optional(),
  auth_date: z
    .union([z.string(), z.number()])
    .transform((value) => String(value).trim())
    .refine((value) => /^[0-9]{1,20}$/.test(value), { message: "invalid_auth_date" }),
  hash: z.string().trim().length(64).regex(/^[a-fA-F0-9]{64}$/),
});

export async function POST(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const ip = getClientIpFromHeaders(request.headers);
  const rateLimit = consumeRateLimit({
    namespace: "auth-telegram",
    key: ip,
    limit: 20,
    windowMs: 5 * 60 * 1_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много попыток входа через Telegram.");
  }

  async function trackFailed(reason: string) {
    await createAnalyticsEvent({
      eventName: "login_failed",
      path,
      payload: { method: "telegram", reason },
    });
  }

  if (!hasJsonContentType(request)) {
    await trackFailed("invalid_content_type");
    const response = NextResponse.json({ error: "Ожидается JSON-запрос" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const json = await request.json().catch(() => null);
  const parsed = telegramSchema.safeParse(json);

  if (!parsed.success) {
    await trackFailed("invalid_payload");
    const response = NextResponse.json({ error: "Некорректные данные Telegram" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const validation = validateTelegramAuthPayload(parsed.data);
  if (!validation.ok) {
    await trackFailed(validation.error);
    const response = NextResponse.json({ error: "Не удалось проверить Telegram-подпись" }, { status: 401 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  try {
    const currentUser = await getCurrentUser();
    const user = await findOrLinkTelegramUser({
      telegramId: parsed.data.id,
      currentUserId: currentUser?.id,
    });

    const jwt = await signAuthToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    const response = NextResponse.json({
      ok: true,
      user: { id: user.id, email: user.email, role: user.role },
    });

    setAuthSessionCookie(response, jwt);

    await createAnalyticsEvent({
      eventName: "login_success",
      userId: user.id,
      path,
      payload: { method: "telegram" },
    });

    applyRateLimitHeaders(response, rateLimit);
    return response;
  } catch (error) {
    if (error instanceof Error && error.message === "TELEGRAM_ALREADY_LINKED") {
      await trackFailed("telegram_already_linked");
      const response = NextResponse.json(
        {
          error: "Этот Telegram уже привязан к другому аккаунту.",
          code: "account_exists",
        },
        { status: 409 },
      );
      applyRateLimitHeaders(response, rateLimit);
      return response;
    }

    await trackFailed("telegram_flow_failed");
    const response = NextResponse.json(
      { error: "Не удалось завершить вход через Telegram", code: "telegram_failed" },
      { status: 500 },
    );
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }
}

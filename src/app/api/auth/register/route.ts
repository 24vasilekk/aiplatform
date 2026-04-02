import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signAuthToken } from "@/lib/auth";
import { setAuthSessionCookie } from "@/lib/auth-cookie";
import { createAnalyticsEvent, createUser, findUserByEmail } from "@/lib/db";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  createRateLimitResponse,
  getClientIpFromHeaders,
  hasJsonContentType,
} from "@/lib/security";

const schema = z.object({
  email: z.email().trim().max(254),
  password: z.string().trim().min(8).max(128),
});

export async function POST(request: Request) {
  const ip = getClientIpFromHeaders(request.headers);
  const rateLimit = consumeRateLimit({
    namespace: "auth-register",
    key: ip,
    limit: 8,
    windowMs: 15 * 60 * 1_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много попыток регистрации. Попробуйте позже.");
  }

  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Ожидается JSON-запрос" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Неверный email или пароль короче 8 символов" },
      { status: 400 },
    );
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const exists = await findUserByEmail(email);

  if (exists) {
    const response = NextResponse.json(
      {
        error:
          "Аккаунт с таким email уже существует. Войдите в аккаунт или используйте вход через Google/Telegram.",
        code: "account_exists",
      },
      { status: 409 },
    );
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const role = email === "admin@ege.local" ? "admin" : email.endsWith("@tutor.local") ? "tutor" : "student";
  const user = await createUser({ email, passwordHash, role });
  await createAnalyticsEvent({
    eventName: "registration_success",
    userId: user.id,
    path: new URL(request.url).pathname,
    payload: {
      method: "email_password",
      role: user.role,
    },
  });
  const token = await signAuthToken({ sub: user.id, email: user.email, role: user.role });

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role },
  });

  setAuthSessionCookie(response, token);

  applyRateLimitHeaders(response, rateLimit);
  return response;
}

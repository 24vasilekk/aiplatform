import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { signAuthToken } from "@/lib/auth";
import { setAuthSessionCookie } from "@/lib/auth-cookie";
import { createAnalyticsEvent, findUserByEmail } from "@/lib/db";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
  createRateLimitResponse,
  getClientIpFromHeaders,
  hasJsonContentType,
} from "@/lib/security";
import { observeRequest } from "@/lib/observability";

const schema = z.object({
  email: z.email().trim().max(254),
  password: z.string().trim().min(1).max(128),
});

export async function POST(request: Request) {
  return observeRequest({
    request,
    operation: "auth.login",
    handler: async () => {
      const path = new URL(request.url).pathname;
      const ip = getClientIpFromHeaders(request.headers);

      const rateLimit = consumeRateLimit({
        namespace: "auth-login",
        key: ip,
        limit: 12,
        windowMs: 5 * 60 * 1_000,
      });
      if (!rateLimit.ok) {
        await createAnalyticsEvent({
          eventName: "login_failed",
          path,
          payload: { method: "password", reason: "rate_limited" },
        });
        return createRateLimitResponse(rateLimit, "Слишком много попыток входа. Попробуйте позже.");
      }

      async function track(eventName: "login_success" | "login_failed", payload?: Record<string, string>) {
        await createAnalyticsEvent({
          eventName,
          path,
          payload: payload ?? null,
        });
      }

      if (!hasJsonContentType(request)) {
        await track("login_failed", { method: "password", reason: "invalid_content_type" });
        const response = NextResponse.json({ error: "Ожидается JSON-запрос" }, { status: 415 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const json = await request.json().catch(() => null);
      const parsed = schema.safeParse(json);

      if (!parsed.success) {
        await track("login_failed", { method: "password", reason: "invalid_payload" });
        const response = NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const email = parsed.data.email.toLowerCase().trim();

  // Temporary hardcoded admin login for environments without persistent DB.
      if (email === "admin@ege.local" && parsed.data.password === "wwwwww") {
        const token = await signAuthToken({
          sub: "builtin-admin",
          email: "admin@ege.local",
          role: "admin",
        });
        const response = NextResponse.json({
          user: { id: "builtin-admin", email: "admin@ege.local", role: "admin" },
        });

        setAuthSessionCookie(response, token);

        await track("login_success", { method: "password", reason: "builtin_admin" });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const user = await findUserByEmail(email);

      if (!user) {
        await track("login_failed", { method: "password", reason: "user_not_found" });
        const response = NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      if (!user.passwordHash) {
        await track("login_failed", { method: "password", reason: "oauth_only_account" });
        const response = NextResponse.json(
          { error: "Для этого аккаунта используйте вход через Google или Telegram" },
          { status: 401 },
        );
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const isValidPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!isValidPassword) {
        await track("login_failed", { method: "password", reason: "wrong_password" });
        const response = NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
        applyRateLimitHeaders(response, rateLimit);
        return response;
      }

      const token = await signAuthToken({ sub: user.id, email: user.email, role: user.role });
      const response = NextResponse.json({ user: { id: user.id, email: user.email, role: user.role } });

      setAuthSessionCookie(response, token);

      await createAnalyticsEvent({
        eventName: "login_success",
        userId: user.id,
        path,
        payload: { method: "password" },
      });

      applyRateLimitHeaders(response, rateLimit);
      return response;
    },
  });
}

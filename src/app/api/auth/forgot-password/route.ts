import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordResetToken, findUserByEmail, invalidateUserPasswordResetTokens } from "@/lib/db";
import { isSmtpConfigured, sendPasswordResetEmail } from "@/lib/mailer";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  email: z.email().trim().max(254),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "auth-forgot-password",
    limit: 6,
    windowMs: 15 * 60 * 1_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много запросов на восстановление. Попробуйте позже.");
  }

  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Ожидается JSON-запрос" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const response = NextResponse.json({ error: "Некорректный email" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await findUserByEmail(email);

  // Do not leak whether the email exists.
  if (!user) {
    const response = NextResponse.json({
      ok: true,
      message: "Если аккаунт существует, отправили ссылку на восстановление.",
    });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30);

  await invalidateUserPasswordResetTokens(user.id);
  await createPasswordResetToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const appUrl = process.env.APP_URL?.trim() || request.nextUrl.origin;
  const resetUrl = `${appUrl}/reset-password?token=${rawToken}`;
  const smtpConfigured = isSmtpConfigured();
  let emailSent = false;

  if (smtpConfigured) {
    try {
      await sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        expiresAtIso: expiresAt.toISOString(),
      });
      emailSent = true;
    } catch {
      emailSent = false;
    }
  }

  const response = NextResponse.json({
    ok: true,
    message: smtpConfigured && emailSent
      ? "Если аккаунт существует, отправили письмо со ссылкой на восстановление."
      : "Ссылка для восстановления создана (SMTP не настроен).",
    // Fallback for local/dev and temporary setups without SMTP.
    resetUrl: smtpConfigured && emailSent ? undefined : resetUrl,
    expiresAt: expiresAt.toISOString(),
  });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

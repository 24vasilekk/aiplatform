import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  findValidPasswordResetToken,
  invalidateUserPasswordResetTokens,
  markPasswordResetTokenUsed,
  updateUserPassword,
} from "@/lib/db";
import { applyRateLimitHeaders, createRateLimitResponse, hasJsonContentType, rateLimitByRequest } from "@/lib/security";

const schema = z.object({
  token: z.string().trim().min(20).max(512),
  password: z.string().min(8).max(128),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const rateLimit = rateLimitByRequest({
    request,
    namespace: "auth-reset-password",
    limit: 8,
    windowMs: 15 * 60 * 1_000,
  });
  if (!rateLimit.ok) {
    return createRateLimitResponse(rateLimit, "Слишком много попыток смены пароля. Попробуйте позже.");
  }

  if (!hasJsonContentType(request)) {
    const response = NextResponse.json({ error: "Ожидается JSON-запрос" }, { status: 415 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    const response = NextResponse.json(
      { error: "Неверный токен или слишком короткий пароль" },
      { status: 400 },
    );
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const tokenHash = hashToken(parsed.data.token);
  const resetToken = await findValidPasswordResetToken(tokenHash);

  if (!resetToken) {
    const response = NextResponse.json({ error: "Токен недействителен или истек" }, { status: 400 });
    applyRateLimitHeaders(response, rateLimit);
    return response;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await updateUserPassword(resetToken.userId, passwordHash);
  await markPasswordResetTokenUsed(resetToken.id);
  await invalidateUserPasswordResetTokens(resetToken.userId);

  const response = NextResponse.json({
    ok: true,
    message: "Пароль успешно обновлен. Теперь войдите с новым паролем.",
  });
  applyRateLimitHeaders(response, rateLimit);
  return response;
}

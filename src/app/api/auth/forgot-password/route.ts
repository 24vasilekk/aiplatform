import { createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createPasswordResetToken, findUserByEmail, invalidateUserPasswordResetTokens } from "@/lib/db";
import { isSmtpConfigured, sendPasswordResetEmail } from "@/lib/mailer";

const schema = z.object({
  email: z.email(),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const user = await findUserByEmail(email);

  // Do not leak whether the email exists.
  if (!user) {
    return NextResponse.json({
      ok: true,
      message: "Если аккаунт существует, отправили ссылку на восстановление.",
    });
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

  return NextResponse.json({
    ok: true,
    message: smtpConfigured && emailSent
      ? "Если аккаунт существует, отправили письмо со ссылкой на восстановление."
      : "Ссылка для восстановления создана (SMTP не настроен).",
    // Fallback for local/dev and temporary setups without SMTP.
    resetUrl: smtpConfigured && emailSent ? undefined : resetUrl,
    expiresAt: expiresAt.toISOString(),
  });
}

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

const schema = z.object({
  token: z.string().trim().min(20),
  password: z.string().min(6),
});

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Неверный токен или слишком короткий пароль" }, { status: 400 });
  }

  const tokenHash = hashToken(parsed.data.token);
  const resetToken = await findValidPasswordResetToken(tokenHash);

  if (!resetToken) {
    return NextResponse.json({ error: "Токен недействителен или истек" }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);

  await updateUserPassword(resetToken.userId, passwordHash);
  await markPasswordResetTokenUsed(resetToken.id);
  await invalidateUserPasswordResetTokens(resetToken.userId);

  return NextResponse.json({
    ok: true,
    message: "Пароль успешно обновлен. Теперь войдите с новым паролем.",
  });
}

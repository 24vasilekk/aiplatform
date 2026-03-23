import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authCookieName, signAuthToken } from "@/lib/auth";
import { createUser, findUserByEmail } from "@/lib/db";

const schema = z.object({
  email: z.email(),
  password: z.string().min(6),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Неверный email или пароль короче 6 символов" }, { status: 400 });
  }

  const email = parsed.data.email.toLowerCase().trim();
  const exists = await findUserByEmail(email);

  if (exists) {
    return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const role = email === "admin@ege.local" ? "admin" : "student";
  const user = await createUser({ email, passwordHash, role });
  const token = await signAuthToken({ sub: user.id, email: user.email, role: user.role });

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role },
  });

  response.cookies.set(authCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authCookieName, signAuthToken } from "@/lib/auth";
import { findUserByEmail } from "@/lib/db";

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "Некорректные данные" }, { status: 400 });
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

    response.cookies.set(authCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  }

  const user = await findUserByEmail(email);

  if (!user) {
    return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
  }

  const isValidPassword = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!isValidPassword) {
    return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
  }

  const token = await signAuthToken({ sub: user.id, email: user.email, role: user.role });
  const response = NextResponse.json({ user: { id: user.id, email: user.email, role: user.role } });

  response.cookies.set(authCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}

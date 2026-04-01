"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { TelegramLoginWidget } from "@/components/telegram-login-widget";

type Mode = "login" | "register";
type AuthErrorResponse = { error?: string; code?: string };

export function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      let data: AuthErrorResponse = {};
      try {
        data = (await response.json()) as AuthErrorResponse;
      } catch {
        data = {};
      }

      if (!response.ok) {
        if (data.code === "account_exists") {
          setError(
            mode === "register"
              ? "Аккаунт уже существует. Войдите через email/пароль, Google или Telegram."
              : "Аккаунт уже существует. Попробуйте другой способ входа.",
          );
          return;
        }
        setError(data.error ?? "Ошибка авторизации");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Сетевая ошибка. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={onSubmit}>
      <div className="grid gap-3">
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Email</span>
          <input
            type="email"
            placeholder="you@example.com"
            className="w-full"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-[0.08em] text-slate-500">Пароль</span>
          <input
            type="password"
            placeholder={mode === "register" ? "Минимум 8 символов" : "Введите пароль"}
            className="w-full"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
      </div>
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      <button type="submit" className="w-full" disabled={loading}>
        {loading ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}
      </button>
      {mode === "login" ? (
        <div className="space-y-3 border-t border-slate-200 pt-3">
          <p className="text-center text-xs font-medium uppercase tracking-[0.08em] text-slate-500">или войдите через соцсеть</p>
          <Link href="/api/auth/google/login" className="btn-ghost w-full text-center">
            Продолжить через Google
          </Link>
          <TelegramLoginWidget />
        </div>
      ) : null}
    </form>
  );
}

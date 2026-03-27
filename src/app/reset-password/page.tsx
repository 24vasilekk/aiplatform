"use client";

import { FormEvent, useMemo, useState } from "react";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const tokenFromUrl = searchParams.get("token") ?? "";

  const [token, setToken] = useState(tokenFromUrl);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const disabled = useMemo(() => {
    return loading || !token.trim() || password.length < 6 || password !== confirm;
  }, [confirm, loading, password, token]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password }),
      });

      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      setMessage(data.message ?? data.error ?? "Готово");
    } catch {
      setMessage("Сетевая ошибка. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="mb-4 text-2xl font-semibold">Новый пароль</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          type="text"
          placeholder="Токен восстановления"
          className="w-full"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Новый пароль (минимум 6 символов)"
          className="w-full"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={6}
          required
        />
        <input
          type="password"
          placeholder="Повторите пароль"
          className="w-full"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          minLength={6}
          required
        />
        <button type="submit" className="w-full" disabled={disabled}>
          {loading ? "Обновляем..." : "Сохранить пароль"}
        </button>
      </form>
      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6">Загрузка...</section>}>
      <ResetPasswordForm />
    </Suspense>
  );
}

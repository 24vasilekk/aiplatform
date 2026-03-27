"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });

    const data = (await response.json()) as { message?: string; resetUrl?: string };
    setMessage(data.message ?? "Запрос отправлен");
    setResetUrl(data.resetUrl ?? null);
  }

  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="mb-4 text-2xl font-semibold">Восстановление пароля</h1>
      <form className="space-y-3" onSubmit={onSubmit}>
        <input
          type="email"
          placeholder="Email"
          className="w-full"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
        <button type="submit" className="w-full">
          Отправить ссылку
        </button>
      </form>
      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}
      {resetUrl ? (
        <p className="mt-2 text-xs text-slate-500">
          Dev-ссылка:{" "}
          <Link href={resetUrl} className="underline">
            Открыть форму сброса
          </Link>
        </p>
      ) : null}
    </section>
  );
}

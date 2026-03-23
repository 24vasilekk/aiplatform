"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";

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

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = (await response.json()) as { error?: string };

    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? "Ошибка авторизации");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form className="space-y-3" onSubmit={onSubmit}>
      <input
        type="email"
        placeholder="Email"
        className="w-full"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <input
        type="password"
        placeholder="Пароль"
        className="w-full"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
      <button type="submit" className="w-full" disabled={loading}>
        {loading ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}
      </button>
    </form>
  );
}

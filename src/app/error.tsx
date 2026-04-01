"use client";

import { useEffect } from "react";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/errors/client", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        digest: error.digest,
        stack: error.stack,
        path: typeof window !== "undefined" ? window.location.pathname : "/",
        source: "app-error-boundary",
      }),
    }).catch(() => null);
  }, [error]);

  return (
    <section className="mx-auto max-w-2xl space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
      <h2 className="text-xl font-semibold">Произошла ошибка</h2>
      <p className="text-sm">Мы уже записали инцидент. Попробуйте перезагрузить блок страницы.</p>
      <div className="flex gap-2">
        <button type="button" className="btn-primary" onClick={() => reset()}>
          Попробовать снова
        </button>
        <button type="button" className="btn-ghost" onClick={() => (window.location.href = "/")}>
          На главную
        </button>
      </div>
    </section>
  );
}

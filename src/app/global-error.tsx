"use client";

import { useEffect } from "react";

export default function GlobalError({
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
        source: "global-error-boundary",
      }),
    }).catch(() => null);
  }, [error]);

  return (
    <html lang="ru">
      <body className="bg-slate-100 p-4">
        <section className="mx-auto max-w-2xl space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
          <h2 className="text-xl font-semibold">Критичная ошибка приложения</h2>
          <p className="text-sm">Инцидент зафиксирован. Попробуйте перезагрузить приложение.</p>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={() => reset()}>
              Перезагрузить
            </button>
            <button type="button" className="btn-ghost" onClick={() => (window.location.href = "/")}>
              На главную
            </button>
          </div>
        </section>
      </body>
    </html>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";

type ErrorLevel = "debug" | "info" | "warn" | "error" | "fatal";

type ServiceErrorItem = {
  id: string;
  requestId: string | null;
  route: string | null;
  level: ErrorLevel;
  message: string;
  details: unknown;
  stack: string | null;
  occurredAt: string;
  userId: string | null;
};

function levelBadge(level: ErrorLevel) {
  if (level === "fatal") return "bg-rose-200 text-rose-900";
  if (level === "error") return "bg-rose-100 text-rose-800";
  if (level === "warn") return "bg-amber-100 text-amber-800";
  if (level === "info") return "bg-sky-100 text-sky-800";
  return "bg-slate-100 text-slate-700";
}

export function AdminErrorMonitor() {
  const [items, setItems] = useState<ServiceErrorItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<"all" | ErrorLevel>("all");
  const [routeFilter, setRouteFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams();
    params.set("take", "100");
    if (level !== "all") params.set("level", level);
    if (routeFilter.trim()) params.set("route", routeFilter.trim());

    try {
      const response = await fetch(`/api/admin/errors?${params.toString()}`, {
        cache: "no-store",
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        items?: ServiceErrorItem[];
        total?: number;
      };

      if (!response.ok) {
        setError(data.error ?? "Не удалось загрузить ошибки.");
        return;
      }

      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } finally {
      setLoading(false);
    }
  }, [level, routeFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="panel-accent space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Последние ошибки сервиса</h2>
        <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
          {loading ? "Загрузка..." : "Обновить"}
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        <select
          className="w-full"
          value={level}
          onChange={(event) => setLevel(event.target.value as "all" | ErrorLevel)}
        >
          <option value="all">Все уровни</option>
          <option value="fatal">fatal</option>
          <option value="error">error</option>
          <option value="warn">warn</option>
          <option value="info">info</option>
          <option value="debug">debug</option>
        </select>
        <input
          type="text"
          className="w-full"
          placeholder="Фильтр по route"
          value={routeFilter}
          onChange={(event) => setRouteFilter(event.target.value)}
        />
        <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
          Применить
        </button>
      </div>

      <p className="text-xs text-slate-600">Найдено: {total}</p>
      {error ? <p className="text-sm text-rose-700">{error}</p> : null}

      {items.length === 0 ? (
        <p className="text-sm text-slate-500">Ошибки не найдены.</p>
      ) : (
        <ul className="space-y-2 text-xs">
          {items.map((item) => (
            <li key={item.id} className="rounded border border-slate-200 bg-white p-3">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className={`rounded px-2 py-1 text-[11px] font-semibold uppercase ${levelBadge(item.level)}`}>
                  {item.level}
                </span>
                <span className="text-slate-500">{new Date(item.occurredAt).toLocaleString()}</span>
              </div>
              <p className="font-medium text-slate-900">{item.message}</p>
              <p className="text-slate-600">
                route: <code>{item.route ?? "—"}</code> · requestId: <code>{item.requestId ?? "—"}</code>
              </p>
              <p className="text-slate-600">userId: <code>{item.userId ?? "—"}</code></p>
              {item.stack ? (
                <details className="mt-1">
                  <summary className="cursor-pointer text-slate-700">Stack trace</summary>
                  <pre className="mt-1 overflow-x-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px]">
                    {item.stack}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

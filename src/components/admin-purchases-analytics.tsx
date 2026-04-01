"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CourseOption = {
  id: string;
  title: string;
};

type PurchaseItem = {
  id: string;
  userId: string;
  userEmail: string;
  planId: string;
  planLabel: string;
  amountCents: number;
  currency: string;
  status: "created" | "requires_action" | "processing" | "succeeded" | "failed" | "canceled";
  provider: string;
  providerPaymentId: string | null;
  createdAt: string;
  paidAt: string | null;
  failedAt: string | null;
  canceledAt: string | null;
  courseIds: string[];
  courseTitles: string[];
};

type SortBy = "createdAt" | "amountCents" | "status" | "paidAt";
type SortDir = "asc" | "desc";

export function AdminPurchasesAnalytics({ courseOptions }: { courseOptions: CourseOption[] }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [courseId, setCourseId] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("createdAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("take", "100");
    params.set("sortBy", sortBy);
    params.set("sortDir", sortDir);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (userEmail.trim()) params.set("userEmail", userEmail.trim());
    if (courseId) params.set("courseId", courseId);
    if (status) params.set("status", status);
    return params.toString();
  }, [courseId, from, sortBy, sortDir, status, to, userEmail]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/analytics/purchases?${queryString}`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as {
        items?: PurchaseItem[];
        total?: number;
        error?: string;
      };
      if (!response.ok) {
        setError(data.error ?? "Не удалось загрузить покупки");
        return;
      }
      setItems(data.items ?? []);
      setTotal(data.total ?? 0);
    } catch {
      setError("Сетевая ошибка");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    const url = `/api/admin/analytics/purchases?${queryString}&format=csv`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <section className="panel-accent space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[140px]">
          <label className="mb-1 block text-xs text-slate-600">С даты</label>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} className="w-full" />
        </div>
        <div className="min-w-[140px]">
          <label className="mb-1 block text-xs text-slate-600">По дату</label>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} className="w-full" />
        </div>
        <div className="min-w-[220px]">
          <label className="mb-1 block text-xs text-slate-600">Пользователь (email)</label>
          <input
            type="text"
            value={userEmail}
            onChange={(event) => setUserEmail(event.target.value)}
            placeholder="student@example.com"
            className="w-full"
          />
        </div>
        <div className="min-w-[170px]">
          <label className="mb-1 block text-xs text-slate-600">Курс</label>
          <select value={courseId} onChange={(event) => setCourseId(event.target.value)} className="w-full">
            <option value="">Все курсы</option>
            {courseOptions.map((course) => (
              <option key={course.id} value={course.id}>
                {course.title}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs text-slate-600">Статус</label>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="w-full">
            <option value="">Все</option>
            <option value="succeeded">succeeded</option>
            <option value="processing">processing</option>
            <option value="requires_action">requires_action</option>
            <option value="failed">failed</option>
            <option value="canceled">canceled</option>
            <option value="created">created</option>
          </select>
        </div>
        <div className="min-w-[150px]">
          <label className="mb-1 block text-xs text-slate-600">Сортировка</label>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as SortBy)} className="w-full">
            <option value="createdAt">Дата создания</option>
            <option value="paidAt">Дата оплаты</option>
            <option value="amountCents">Сумма</option>
            <option value="status">Статус</option>
          </select>
        </div>
        <div className="min-w-[120px]">
          <label className="mb-1 block text-xs text-slate-600">Направление</label>
          <select value={sortDir} onChange={(event) => setSortDir(event.target.value as SortDir)} className="w-full">
            <option value="desc">desc</option>
            <option value="asc">asc</option>
          </select>
        </div>
        <button type="button" className="btn-ghost" onClick={exportCsv}>
          Выгрузить CSV
        </button>
      </div>

      <p className="text-sm text-slate-700">Найдено записей: {total}</p>
      {loading ? <p className="text-sm text-slate-700">Загрузка...</p> : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-700">
            <tr>
              <th className="px-3 py-2 font-medium">Кто</th>
              <th className="px-3 py-2 font-medium">Что купил</th>
              <th className="px-3 py-2 font-medium">Сумма</th>
              <th className="px-3 py-2 font-medium">Дата</th>
              <th className="px-3 py-2 font-medium">Статус</th>
              <th className="px-3 py-2 font-medium">Провайдер</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t border-slate-100 text-slate-700">
                <td className="px-3 py-2">{item.userEmail}</td>
                <td className="px-3 py-2">
                  <div>{item.planLabel}</div>
                  <div className="text-xs text-slate-500">{item.courseTitles.join(", ") || "—"}</div>
                </td>
                <td className="px-3 py-2">
                  {(item.amountCents / 100).toFixed(2)} {item.currency}
                </td>
                <td className="px-3 py-2">
                  <div>{item.createdAt.slice(0, 10)}</div>
                  <div className="text-xs text-slate-500">{(item.paidAt ?? item.failedAt ?? item.canceledAt ?? "—").slice(0, 19).replace("T", " ")}</div>
                </td>
                <td className="px-3 py-2">{item.status}</td>
                <td className="px-3 py-2">{item.provider}</td>
              </tr>
            ))}
            {items.length === 0 ? (
              <tr>
                <td className="px-3 py-3 text-slate-600" colSpan={6}>
                  Данных нет
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

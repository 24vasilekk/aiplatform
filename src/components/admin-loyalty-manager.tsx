"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type LoyaltyRules = {
  pointsPerCourseCompletion: number;
  pointsLifetimeDays: number;
  discountValuePerPointCents: number;
  maxDiscountPercent: number;
  minOrderAmountCents: number;
  minPayableAmountCents: number;
  maxPointsPerOrder: number;
};

type AdminLoyaltyAccount = {
  id: string;
  userId: string;
  userEmail: string;
  pointsBalance: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
  updatedAt: string;
};

type AdminLoyaltyTransaction = {
  id: string;
  userId: string;
  userEmail: string;
  direction: "credit" | "debit";
  reason: "course_completion" | "discount_redeem" | "discount_rollback" | "expiration" | "manual_adjustment";
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  createdAt: string;
};

type AdminAuditLog = {
  id: string;
  adminUserId: string;
  adminUserEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: unknown;
  createdAt: string;
};

type LoyaltyApiResponse = {
  rules: LoyaltyRules;
  accounts: AdminLoyaltyAccount[];
  transactions: AdminLoyaltyTransaction[];
  auditLogs: AdminAuditLog[];
};

function makeIdempotencyKey(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

function reasonLabel(reason: AdminLoyaltyTransaction["reason"]) {
  if (reason === "course_completion") return "завершение курса";
  if (reason === "discount_redeem") return "скидка";
  if (reason === "discount_rollback") return "откат скидки";
  if (reason === "expiration") return "истечение";
  return "manual_adjustment";
}

export function AdminLoyaltyManager() {
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [directionFilter, setDirectionFilter] = useState<"all" | "credit" | "debit">("all");

  const [adjustUserId, setAdjustUserId] = useState("");
  const [adjustPoints, setAdjustPoints] = useState("100");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustDirection, setAdjustDirection] = useState<"credit" | "debit">("credit");

  const [rules, setRules] = useState<LoyaltyRules | null>(null);
  const [accounts, setAccounts] = useState<AdminLoyaltyAccount[]>([]);
  const [transactions, setTransactions] = useState<AdminLoyaltyTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const hasFilters = useMemo(
    () => Boolean(query.trim() || userId.trim() || from || to || directionFilter !== "all"),
    [directionFilter, from, query, to, userId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    const params = new URLSearchParams();
    params.set("take", "100");
    if (query.trim()) params.set("q", query.trim());
    if (userId.trim()) params.set("userId", userId.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (directionFilter !== "all") params.set("direction", directionFilter);

    try {
      const response = await fetch(`/api/admin/loyalty?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as Partial<LoyaltyApiResponse> & { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Не удалось загрузить лояльность.");
        return;
      }
      setRules(data.rules ?? null);
      setAccounts(data.accounts ?? []);
      setTransactions(data.transactions ?? []);
      setAuditLogs(data.auditLogs ?? []);
    } catch {
      setStatus("Сетевая ошибка загрузки лояльности.");
    } finally {
      setLoading(false);
    }
  }, [directionFilter, from, query, to, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyAdjustment() {
    const points = Number(adjustPoints);
    if (!adjustUserId.trim()) {
      setStatus("Укажите userId для корректировки.");
      return;
    }
    if (!Number.isFinite(points) || points <= 0) {
      setStatus("Укажите корректное число баллов.");
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/loyalty", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": makeIdempotencyKey("admin_loyalty"),
        },
        body: JSON.stringify({
          userId: adjustUserId.trim(),
          direction: adjustDirection,
          points,
          reason: adjustReason.trim() || undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Не удалось выполнить корректировку.");
        return;
      }

      setStatus("Корректировка лояльности выполнена.");
      await load();
    } catch {
      setStatus("Сетевая ошибка при корректировке лояльности.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-accent space-y-3">
      <h2 className="text-lg font-semibold">Админ: программа лояльности</h2>

      {rules ? (
        <div className="rounded-md border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p className="font-medium">Текущие правила</p>
          <p>Баллы за завершение курса: {rules.pointsPerCourseCompletion}</p>
          <p>Срок жизни баллов: {rules.pointsLifetimeDays} дней</p>
          <p>Максимальная скидка: {rules.maxDiscountPercent}%</p>
          <p>Минимальная сумма заказа: {(rules.minOrderAmountCents / 100).toFixed(0)} ₽</p>
          <p>Минимум к оплате после скидки: {(rules.minPayableAmountCents / 100).toFixed(0)} ₽</p>
          <p>Максимум баллов на заказ: {rules.maxPointsPerOrder}</p>
        </div>
      ) : null}

      <div className="grid gap-2 md:grid-cols-6">
        <input type="text" className="w-full" placeholder="Поиск по email" value={query} onChange={(e) => setQuery(e.target.value)} />
        <input type="text" className="w-full" placeholder="userId" value={userId} onChange={(e) => setUserId(e.target.value)} />
        <input type="date" className="w-full" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="w-full" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="w-full" value={directionFilter} onChange={(e) => setDirectionFilter(e.target.value as "all" | "credit" | "debit")}>
          <option value="all">Все направления</option>
          <option value="credit">Только credit</option>
          <option value="debit">Только debit</option>
        </select>
        <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
          {loading ? "Загрузка..." : hasFilters ? "Применить фильтры" : "Обновить"}
        </button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="text-sm font-medium">Ручная корректировка баллов</p>
        <div className="mt-2 grid gap-2 md:grid-cols-4">
          <input type="text" className="w-full" placeholder="userId" value={adjustUserId} onChange={(e) => setAdjustUserId(e.target.value)} />
          <input type="number" min="1" step="1" className="w-full" placeholder="Баллы" value={adjustPoints} onChange={(e) => setAdjustPoints(e.target.value)} />
          <select className="w-full" value={adjustDirection} onChange={(e) => setAdjustDirection(e.target.value as "credit" | "debit")}>
            <option value="credit">Начислить (credit)</option>
            <option value="debit">Списать (debit)</option>
          </select>
          <button type="button" className="btn-primary" onClick={() => void applyAdjustment()} disabled={saving}>
            {saving ? "Обработка..." : "Применить"}
          </button>
        </div>
        <input
          type="text"
          className="mt-2 w-full"
          placeholder="Причина для аудита (опционально)"
          value={adjustReason}
          onChange={(e) => setAdjustReason(e.target.value)}
        />
      </div>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div>
        <p className="text-sm font-medium">Аккаунты лояльности</p>
        {accounts.length === 0 ? (
          <p className="text-sm text-slate-500">Записей нет по выбранным фильтрам.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {accounts.map((item) => (
              <li key={item.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <p className="font-medium">{item.userEmail}</p>
                <p className="text-slate-600">
                  userId: <code>{item.userId}</code>
                </p>
                <p className="text-slate-600">
                  Баллы: {item.pointsBalance} · начислено: {item.lifetimeEarnedPoints} · списано: {item.lifetimeRedeemedPoints}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-sm font-medium">Журнал операций лояльности</p>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">Операций нет по выбранным фильтрам.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {transactions.map((item) => (
              <li key={item.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <p className="font-medium">
                  {item.userEmail} · {item.direction} · {reasonLabel(item.reason)} · {item.points} баллов
                </p>
                <p className="text-slate-600">
                  balance: {item.balanceBefore} → {item.balanceAfter}
                </p>
                <p className="text-slate-600">{new Date(item.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-sm font-medium">Аудит действий админа</p>
        {auditLogs.length === 0 ? (
          <p className="text-sm text-slate-500">Записей аудита нет по выбранным фильтрам.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {auditLogs.map((item) => (
              <li key={item.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <p className="font-medium">
                  {item.adminUserEmail} · {item.action} · {item.entityType}
                </p>
                <p className="text-slate-600">
                  entityId: <code>{item.entityId ?? "-"}</code>
                </p>
                <p className="text-slate-600">{new Date(item.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

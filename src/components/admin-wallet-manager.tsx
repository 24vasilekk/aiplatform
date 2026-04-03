"use client";

import { useCallback, useEffect, useState } from "react";

type AdminWallet = {
  id: string;
  userId: string;
  userEmail: string;
  balanceCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

type AdminWalletTransaction = {
  id: string;
  walletId: string;
  userId: string;
  userEmail: string;
  direction: "credit" | "debit";
  operationType: "topup" | "purchase" | "refund" | "manual_adjustment";
  amountCents: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentIntentId: string | null;
  idempotencyKey: string | null;
  createdAt: string;
};

type AdminUserOption = {
  id: string;
  email: string;
  role: "student" | "tutor" | "admin";
  createdAt: string;
};

function toRub(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat("ru-RU", {
      style: "currency",
      currency: currency.toUpperCase(),
      maximumFractionDigits: 2,
    }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function makeIdempotencyKey(prefix: string) {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefix}_${Date.now()}_${rand}`;
}

export function AdminWalletManager() {
  const [query, setQuery] = useState("");
  const [userId, setUserId] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [amountRub, setAmountRub] = useState("500");
  const [reason, setReason] = useState("");
  const [direction, setDirection] = useState<"credit" | "debit">("credit");
  const [users, setUsers] = useState<AdminUserOption[]>([]);
  const [wallets, setWallets] = useState<AdminWallet[]>([]);
  const [transactions, setTransactions] = useState<AdminWalletTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);

    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    params.set("take", "100");

    try {
      const response = await fetch(`/api/admin/wallets?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json().catch(() => ({}))) as {
        users?: AdminUserOption[];
        wallets?: AdminWallet[];
        transactions?: AdminWalletTransaction[];
      };

      if (!response.ok) {
        setStatus("Не удалось загрузить кошельки.");
        return;
      }

      setUsers(data.users ?? []);
      setWallets(data.wallets ?? []);
      setTransactions(data.transactions ?? []);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  async function applyAdjustment() {
    const amount = Number(amountRub);
    const targetUserId = userId.trim();
    const targetUserEmail = userEmail.trim().toLowerCase();
    if (!targetUserId && !targetUserEmail) {
      setStatus("Укажите userId или userEmail получателя.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus("Укажите корректную сумму.");
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/wallets", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": makeIdempotencyKey("admin_wallet"),
        },
        body: JSON.stringify({
          userId: targetUserId || undefined,
          userEmail: targetUserEmail || undefined,
          direction,
          amountRub: amount,
          reason: reason.trim() || undefined,
        }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Операция не выполнена.");
        return;
      }

      setStatus("Операция проведена.");
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-accent space-y-3">
      <h2 className="text-lg font-semibold">Админ: баланс-кошельки</h2>

      <div className="grid gap-2 md:grid-cols-[1fr_auto]">
        <input
          type="text"
          className="w-full"
          placeholder="Поиск по email"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
          {loading ? "Загрузка..." : "Найти"}
        </button>
      </div>

      <div className="rounded-md border border-slate-200 bg-white p-3">
        <p className="text-sm font-medium">Ручная операция</p>
        <div className="mt-2 grid gap-2 md:grid-cols-5">
          <input
            type="text"
            className="w-full"
            placeholder="userId (опционально)"
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
          />
          <input
            type="email"
            className="w-full"
            placeholder="userEmail (опционально)"
            value={userEmail}
            onChange={(event) => setUserEmail(event.target.value)}
          />
          <input
            type="number"
            min="1"
            step="1"
            className="w-full"
            placeholder="Сумма в ₽"
            value={amountRub}
            onChange={(event) => setAmountRub(event.target.value)}
          />
          <select
            className="w-full"
            value={direction}
            onChange={(event) => setDirection(event.target.value as "credit" | "debit")}
          >
            <option value="credit">Пополнение (credit)</option>
            <option value="debit">Списание (debit)</option>
          </select>
          <button type="button" className="btn-primary" onClick={() => void applyAdjustment()} disabled={saving}>
            {saving ? "Обработка..." : "Применить"}
          </button>
        </div>
        <input
          type="text"
          className="mt-2 w-full"
          placeholder="Причина (опционально)"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
        />
      </div>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div>
        <p className="text-sm font-medium">Пользователи</p>
        {users.length === 0 ? (
          <p className="text-sm text-slate-500">Пользователи не найдены. Используйте поиск по email выше.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {users.map((user) => (
              <li key={user.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">
                      {user.email} · {user.role}
                    </p>
                    <p className="text-slate-600">
                      userId: <code>{user.id}</code>
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost px-3 py-1.5 text-xs"
                    onClick={() => {
                      setUserId(user.id);
                      setUserEmail(user.email);
                      setStatus(`Выбран пользователь ${user.email}`);
                    }}
                  >
                    Выбрать
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-sm font-medium">Кошельки</p>
        {wallets.length === 0 ? (
          <p className="text-sm text-slate-500">Записей нет.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {wallets.map((wallet) => (
              <li key={wallet.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <p className="font-medium">{wallet.userEmail}</p>
                <p className="text-slate-600">
                  userId: <code>{wallet.userId}</code>
                </p>
                <p className="text-slate-600">Баланс: {toRub(wallet.balanceCents, wallet.currency)}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="text-sm font-medium">Журнал операций</p>
        {transactions.length === 0 ? (
          <p className="text-sm text-slate-500">Операций нет.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {transactions.map((item) => (
              <li key={item.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <p className="font-medium">
                  {item.userEmail} · {item.direction} · {item.operationType} · {toRub(item.amountCents, "RUB")}
                </p>
                <p className="text-slate-600">
                  balance: {toRub(item.balanceBefore, "RUB")} → {toRub(item.balanceAfter, "RUB")}
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

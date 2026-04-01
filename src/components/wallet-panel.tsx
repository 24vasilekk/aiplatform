"use client";

import { useState } from "react";

type WalletRecord = {
  id: string;
  userId: string;
  balanceCents: number;
  currency: string;
  createdAt: string;
  updatedAt: string;
};

type WalletTransaction = {
  id: string;
  walletId: string;
  userId: string;
  direction: "credit" | "debit";
  operationType: "topup" | "purchase" | "refund" | "manual_adjustment";
  amountCents: number;
  balanceBefore: number;
  balanceAfter: number;
  paymentIntentId: string | null;
  idempotencyKey: string | null;
  metadata: unknown;
  createdAt: string;
};

type WalletSnapshot = {
  wallet: WalletRecord;
  transactions: WalletTransaction[];
  totalTransactions: number;
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

export function WalletPanel({ initialSnapshot }: { initialSnapshot: WalletSnapshot }) {
  const [snapshot, setSnapshot] = useState<WalletSnapshot>(initialSnapshot);
  const [amountRub, setAmountRub] = useState("500");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  async function refreshSnapshot() {
    const response = await fetch("/api/wallet?take=30", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as WalletSnapshot;
    setSnapshot(data);
  }

  async function topup() {
    const amount = Number(amountRub);
    if (!Number.isFinite(amount) || amount <= 0) {
      setStatus("Введите корректную сумму пополнения.");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": makeIdempotencyKey("wallet_topup"),
        },
        body: JSON.stringify({ amountRub: amount }),
      });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        wallet?: WalletRecord;
        transactions?: WalletTransaction[];
        totalTransactions?: number;
      };

      if (!response.ok) {
        setStatus(data.error ?? "Не удалось пополнить баланс.");
        return;
      }

      setSnapshot((current) => ({
        wallet: data.wallet ?? current.wallet,
        transactions: data.transactions ?? current.transactions,
        totalTransactions: data.totalTransactions ?? current.totalTransactions,
      }));
      setStatus("Баланс пополнен.");
    } catch {
      setStatus("Сетевая ошибка. Попробуйте снова.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel-accent space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Баланс-кошелек</h2>
          <p className="text-xs text-slate-600">Доступно: {toRub(snapshot.wallet.balanceCents, snapshot.wallet.currency)}</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void refreshSnapshot()}>
          Обновить
        </button>
      </div>

      <div className="grid gap-2 md:grid-cols-[180px_1fr]">
        <input
          type="number"
          min="1"
          step="1"
          className="w-full"
          value={amountRub}
          onChange={(event) => setAmountRub(event.target.value)}
          placeholder="Сумма в ₽"
        />
        <button type="button" className="btn-primary" disabled={loading} onClick={() => void topup()}>
          {loading ? "Обработка..." : "Пополнить баланс"}
        </button>
      </div>
      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div>
        <p className="text-sm font-medium">Журнал операций</p>
        {snapshot.transactions.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">Операций пока нет.</p>
        ) : (
          <ul className="mt-2 space-y-2 text-xs">
            {snapshot.transactions.map((item) => (
              <li key={item.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <p className="font-medium">
                  {item.direction === "credit" ? "+" : "-"}
                  {toRub(item.amountCents, snapshot.wallet.currency)} · {item.operationType}
                </p>
                <p className="text-slate-600">
                  Баланс: {toRub(item.balanceBefore, snapshot.wallet.currency)} → {" "}
                  {toRub(item.balanceAfter, snapshot.wallet.currency)}
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

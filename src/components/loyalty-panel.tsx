"use client";

import { useRef, useState } from "react";

type PlanId = "math_only" | "bundle_2" | "all_access";

type LoyaltyTransaction = {
  id: string;
  direction: "credit" | "debit";
  reason: "course_completion" | "discount_redeem" | "discount_rollback" | "expiration" | "manual_adjustment";
  points: number;
  balanceBefore: number;
  balanceAfter: number;
  courseId: string | null;
  paymentIntentId: string | null;
  idempotencyKey: string | null;
  expiresAt: string | null;
  createdAt: string;
  metadata: unknown;
};

type LoyaltySnapshot = {
  userId: string;
  pointsBalance: number;
  lifetimeEarnedPoints: number;
  lifetimeRedeemedPoints: number;
  nextPointsExpirationAt: string | null;
  nextExpiringPoints: number;
  rules: {
    pointsPerCourseCompletion: number;
    pointsLifetimeDays: number;
    discountValuePerPointCents: number;
    maxDiscountPercent: number;
    minOrderAmountCents: number;
    minPayableAmountCents: number;
    maxPointsPerOrder: number;
  };
  transactions: LoyaltyTransaction[];
};

type LoyaltyQuote = {
  orderAmountCents: number;
  requestedPoints: number | null;
  availablePoints: number;
  maxDiscountCents: number;
  discountCents: number;
  pointsToSpend: number;
  finalAmountCents: number;
  reason: string | null;
  rules: LoyaltySnapshot["rules"];
};

type LoyaltyPanelProps = {
  initialSnapshot: LoyaltySnapshot;
  initialQuotes: Record<PlanId, LoyaltyQuote>;
};

const plans: Array<{ id: PlanId; label: string }> = [
  { id: "math_only", label: "Математика (990 ₽)" },
  { id: "bundle_2", label: "Пакет 1+1 (1584 ₽)" },
  { id: "all_access", label: "Все курсы (1490 ₽)" },
];

const PLAN_PRICE_CENTS: Record<PlanId, number> = {
  math_only: 99_000,
  bundle_2: 158_400,
  all_access: 149_000,
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toRub(cents: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function reasonLabel(reason: LoyaltyTransaction["reason"]) {
  if (reason === "course_completion") return "Начисление за завершение курса";
  if (reason === "discount_redeem") return "Списание на скидку";
  if (reason === "discount_rollback") return "Возврат баллов";
  if (reason === "expiration") return "Списание по сроку действия";
  return "Ручная корректировка";
}

function quoteReasonLabel(reason: string | null) {
  if (!reason) return null;
  if (reason === "ORDER_BELOW_MIN_AMOUNT") return "Сумма заказа ниже минимальной для скидки.";
  if (reason === "NO_POINTS_AVAILABLE") return "Нет доступных баллов для применения.";
  if (reason === "DISCOUNT_LIMIT_REACHED") return "Лимит скидки достигнут правилами программы.";
  return "Скидка сейчас недоступна.";
}

function getHttpErrorMessage(
  responseStatus: number,
  payload: unknown,
  fallback: string,
) {
  if (
    payload &&
    typeof payload === "object" &&
    "error" in payload &&
    typeof (payload as { error?: unknown }).error === "string"
  ) {
    return (payload as { error: string }).error;
  }
  if (responseStatus === 401) return "Сессия истекла. Войдите снова.";
  if (responseStatus === 429) return "Слишком много запросов. Подождите немного и повторите.";
  if (responseStatus >= 500) return "Сервис временно недоступен. Попробуйте еще раз.";
  return fallback;
}

async function requestJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options?: { retries?: number; timeoutMs?: number; fallbackMessage?: string },
) {
  const retries = Math.max(0, options?.retries ?? 0);
  const timeoutMs = Math.max(1_000, options?.timeoutMs ?? 12_000);
  const fallbackMessage = options?.fallbackMessage ?? "Не удалось выполнить запрос.";

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = (await Promise.race([
        fetch(input, init),
        new Promise<Response>((_, reject) => {
          setTimeout(() => reject(new DOMException("Timeout", "AbortError")), timeoutMs);
        }),
      ])) as Response;
      const payload = (await response.json().catch(() => ({}))) as unknown;
      if (!response.ok) {
        const message = getHttpErrorMessage(response.status, payload, fallbackMessage);
        if (response.status >= 500 && attempt < retries) {
          await sleep(250 * (attempt + 1));
          continue;
        }
        throw new Error(message);
      }
      return payload as T;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (attempt < retries) {
          await sleep(250 * (attempt + 1));
          continue;
        }
        throw new Error("Сервер отвечает слишком долго. Повторите попытку.");
      }
      if (attempt < retries) {
        await sleep(250 * (attempt + 1));
        continue;
      }
      if (error instanceof Error) throw error;
      throw new Error(fallbackMessage);
    }
  }

  throw new Error(fallbackMessage);
}

export function LoyaltyPanel({ initialSnapshot, initialQuotes }: LoyaltyPanelProps) {
  const [snapshot, setSnapshot] = useState<LoyaltySnapshot>(initialSnapshot);
  const [quotes, setQuotes] = useState<Record<PlanId, LoyaltyQuote>>(initialQuotes);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("all_access");
  const [refreshing, setRefreshing] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState<PlanId | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<null | (() => void)>(null);
  const actionSeqRef = useRef(0);

  const activeQuote =
    quotes[selectedPlan] ??
    ({
      orderAmountCents: PLAN_PRICE_CENTS[selectedPlan],
      requestedPoints: null,
      availablePoints: snapshot.pointsBalance,
      maxDiscountCents: 0,
      discountCents: 0,
      pointsToSpend: 0,
      finalAmountCents: PLAN_PRICE_CENTS[selectedPlan],
      reason: "NO_POINTS_AVAILABLE",
      rules: snapshot.rules,
    } satisfies LoyaltyQuote);

  async function refreshSnapshot() {
    const actionId = ++actionSeqRef.current;
    setRefreshing(true);
    setStatus(null);
    setRetryAction(null);
    try {
      const [snapshotData, quoteData] = await Promise.all([
        requestJson<LoyaltySnapshot>("/api/loyalty?take=30", { cache: "no-store" }, { retries: 1 }),
        requestJson<{ quote: LoyaltyQuote }>(
          "/api/loyalty/quote",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ planId: selectedPlan }),
          },
          { retries: 1, fallbackMessage: "Не удалось рассчитать прогноз скидки." },
        ),
      ]);
      if (actionId !== actionSeqRef.current) {
        return;
      }
      setSnapshot(snapshotData);
      setQuotes((current) => ({
        ...current,
        [selectedPlan]: quoteData.quote,
      }));
      setStatus("Данные лояльности обновлены.");
    } catch (error) {
      if (actionId !== actionSeqRef.current) return;
      setStatus(error instanceof Error ? error.message : "Сетевая ошибка при обновлении лояльности.");
      setRetryAction(() => () => void refreshSnapshot());
    } finally {
      if (actionId === actionSeqRef.current) {
        setRefreshing(false);
      }
    }
  }

  async function updateQuote(planId: PlanId) {
    const actionId = ++actionSeqRef.current;
    setSelectedPlan(planId);
    if (quotes[planId]) return;

    setQuoteLoading(planId);
    setStatus(null);
    setRetryAction(null);
    try {
      const payload = await requestJson<{ quote: LoyaltyQuote }>(
        "/api/loyalty/quote",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planId }),
        },
        { retries: 1, fallbackMessage: "Не удалось рассчитать прогноз скидки." },
      );
      if (actionId !== actionSeqRef.current) {
        return;
      }
      setQuotes((current) => ({
        ...current,
        [planId]: payload.quote,
      }));
    } catch (error) {
      if (actionId !== actionSeqRef.current) return;
      setStatus(error instanceof Error ? error.message : "Сетевая ошибка при расчете скидки.");
      setRetryAction(() => () => void updateQuote(planId));
    } finally {
      if (actionId === actionSeqRef.current) {
        setQuoteLoading(null);
      }
    }
  }

  return (
    <section className="panel-accent space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Лояльность</h2>
          <p className="text-xs text-slate-600">
            Текущие баллы: <span className="font-semibold text-slate-900">{snapshot.pointsBalance}</span>
          </p>
          <p className="text-xs text-slate-600">
            Начислено за все время: {snapshot.lifetimeEarnedPoints} · Списано: {snapshot.lifetimeRedeemedPoints}
          </p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={refreshing || quoteLoading !== null}
          onClick={() => void refreshSnapshot()}
        >
          {refreshing ? "Обновление..." : "Обновить"}
        </button>
      </div>

      {snapshot.nextPointsExpirationAt ? (
        <p className="text-sm text-slate-700">
          Ближайшее истечение: {snapshot.nextExpiringPoints} баллов до{" "}
          {new Date(snapshot.nextPointsExpirationAt).toLocaleDateString()}.
        </p>
      ) : (
        <p className="text-sm text-slate-500">Активных баллов с ограничением срока действия пока нет.</p>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">История начислений и списаний</p>
        {snapshot.transactions.length === 0 ? (
          <p className="text-sm text-slate-500">Операций лояльности пока нет. Завершите курс, чтобы получить баллы.</p>
        ) : (
          <ul className="space-y-2 text-xs">
            {snapshot.transactions.map((tx) => (
              <li key={tx.id} className="rounded border border-slate-200 bg-slate-50 p-2">
                <p className="font-medium">
                  {tx.direction === "credit" ? "+" : "-"}
                  {tx.points} баллов · {reasonLabel(tx.reason)}
                </p>
                <p className="text-slate-600">
                  Баланс: {tx.balanceBefore} → {tx.balanceAfter}
                </p>
                <p className="text-slate-600">{new Date(tx.createdAt).toLocaleString()}</p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Прогноз скидки на следующий платеж</p>
        <select
          className="w-full md:w-auto"
          value={selectedPlan}
          disabled={refreshing || quoteLoading !== null}
          onChange={(event) => void updateQuote(event.target.value as PlanId)}
        >
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.label}
            </option>
          ))}
        </select>

        <div className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-700">
          <p>Сумма тарифа: {toRub(activeQuote.orderAmountCents)}</p>
          <p>Прогноз скидки: {toRub(activeQuote.discountCents)}</p>
          <p>К оплате после скидки: {toRub(activeQuote.finalAmountCents)}</p>
          <p>Будет списано баллов: {activeQuote.pointsToSpend}</p>
          {quoteReasonLabel(activeQuote.reason) ? (
            <p className="mt-1 text-amber-700">{quoteReasonLabel(activeQuote.reason)}</p>
          ) : null}
        </div>
      </div>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
      {retryAction ? (
        <button type="button" className="btn-ghost" onClick={retryAction}>
          Повторить
        </button>
      ) : null}
      {quoteLoading ? <p className="text-xs text-slate-500">Пересчитываем прогноз скидки...</p> : null}
    </section>
  );
}

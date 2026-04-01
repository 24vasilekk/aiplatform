"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type PlanId = "math_only" | "bundle_2" | "all_access";

type Plan = {
  id: PlanId;
  title: string;
  subtitle: string;
  price: string;
  badge?: string;
  features: string[];
};

const plans: Plan[] = [
  {
    id: "math_only",
    title: "Курс: Математика",
    subtitle: "Точечная покупка одного курса",
    price: "990 ₽",
    features: ["Доступ к курсу по математике", "Уроки, тесты, AI-чат в рамках курса"],
  },
  {
    id: "bundle_2",
    title: "Пакет 1+1",
    subtitle: "Математика + физика",
    price: "1584 ₽",
    badge: "Скидка 20%",
    features: ["Оба базовых курса", "Экономия относительно покупки по отдельности"],
  },
  {
    id: "all_access",
    title: "Все курсы",
    subtitle: "Максимальный доступ",
    price: "1490 ₽ / месяц",
    badge: "Лучший выбор",
    features: ["Доступ ко всем текущим курсам", "Новые курсы в рамках подписки"],
  },
];

export function PricingPlans({ userEmail }: { userEmail: string }) {
  const [activePlan, setActivePlan] = useState<Plan | null>(null);
  const [email, setEmail] = useState(userEmail);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const router = useRouter();

  const planTitle = useMemo(() => activePlan?.title ?? "", [activePlan]);

  async function pay() {
    if (!activePlan) return;
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setStatus("Введите email для оплаты.");
      return;
    }

    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: activePlan.id, email: cleanEmail }),
      });

      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };

      if (!response.ok) {
        setStatus(data.error ?? "Ошибка оплаты");
        return;
      }

      setStatus(data.message ?? "Оплата выполнена");
      const checkoutUrl =
        (data as { payment?: { checkoutUrl?: string | null } }).payment?.checkoutUrl?.trim() ?? "";
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      router.refresh();
      setTimeout(() => setActivePlan(null), 700);
    } catch {
      setStatus("Сетевая ошибка. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  }

  async function payWithWallet() {
    if (!activePlan) return;
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/billing/pay-with-wallet", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: activePlan.id }),
      });

      const data = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Не удалось оплатить с баланса.");
        return;
      }

      setStatus(data.message ?? "Покупка с баланса выполнена.");
      router.refresh();
      setTimeout(() => setActivePlan(null), 700);
    } catch {
      setStatus("Сетевая ошибка. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {plans.map((plan, index) => (
          <article
            key={plan.id}
            className="card-soft card-soft-hover flex h-full flex-col p-6"
            style={{ animationDelay: `${index * 80}ms` }}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <h2>{plan.title}</h2>
                <p className="text-sm text-slate-700">{plan.subtitle}</p>
              </div>
              {plan.badge ? (
                <span className="rounded-full border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                  {plan.badge}
                </span>
              ) : null}
            </div>

            <p className="mt-4 text-3xl font-semibold tracking-[-0.01em]">{plan.price}</p>

            <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-800">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>

            <button type="button" className="btn-primary mt-auto w-fit" onClick={() => setActivePlan(plan)}>
              Оплатить
            </button>
          </article>
        ))}
      </div>

      {activePlan ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/35 p-3">
          <div className="w-full max-w-md rounded-xl border border-sky-300 bg-white p-4 shadow-[0_18px_48px_rgba(2,6,23,0.28)] sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-2">
              <div>
                <h3>Оплата тарифа</h3>
                <p className="text-sm text-slate-700">{planTitle}</p>
              </div>
              <button type="button" className="btn-ghost" onClick={() => setActivePlan(null)}>
                Закрыть
              </button>
            </div>

            <div className="form-stack">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Ваш email"
                className="w-full"
                required
              />
              <p className="form-helper">
                Демо-режим: сейчас оплата эмулируется. Далее подключим ЮKassa, СБП и другие способы.
              </p>
              <button type="button" className="btn-primary w-full" onClick={pay} disabled={loading}>
                {loading ? "Обработка..." : "Подтвердить оплату"}
              </button>
              <button type="button" className="btn-ghost w-full" onClick={payWithWallet} disabled={loading}>
                {loading ? "Обработка..." : "Оплатить с баланса"}
              </button>
              {status ? <p className="text-sm text-slate-700">{status}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

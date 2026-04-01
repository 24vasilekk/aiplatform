"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function PricingAction() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function pay() {
    setLoading(true);
    setStatus(null);

    try {
      const response = await fetch("/api/billing/create-checkout", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ planId: "all_access" }),
      });

      let data: { message?: string; error?: string; payment?: { checkoutUrl?: string | null } } = {};
      try {
        data = (await response.json()) as { message?: string; error?: string };
      } catch {
        data = {};
      }

      if (!response.ok) {
        setStatus(data.error ?? "Ошибка оплаты");
        return;
      }

      setStatus(data.message ?? "Оплата выполнена");
      if (data.payment?.checkoutUrl) {
        window.location.href = data.payment.checkoutUrl;
        return;
      }
      router.refresh();
    } catch {
      setStatus("Сетевая ошибка. Попробуйте еще раз.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <button type="button" className="btn-primary" onClick={pay} disabled={loading}>
        {loading ? "Обработка..." : "Оплатить"}
      </button>
      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </div>
  );
}

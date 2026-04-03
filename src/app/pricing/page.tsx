import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PricingPlans } from "@/components/pricing-plans";

export default async function PricingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <section className="space-y-5">
      <article className="panel-accent">
        <h1 className="mb-2">Оплата и доступ</h1>
        <p className="text-slate-700">
          Выберите формат обучения: один курс, пакет 1+1 или полный доступ ко всем курсам.
        </p>
      </article>

      <PricingPlans userEmail={user.email} />

      <article className="panel-accent">
        <h2 className="mb-2">Логика доступа</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-800">
          <li>Без оплаты уроки закрыты</li>
          <li>После оплаты доступ открывается автоматически</li>
          <li>Проверка доступа выполняется на backend</li>
          <li>Платежи проходят через подключенный платежный сценарий</li>
        </ul>
      </article>
    </section>
  );
}

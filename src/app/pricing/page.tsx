import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { PricingAction } from "@/components/pricing-action";

export default async function PricingPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <section className="grid gap-4 md:grid-cols-2">
      <article className="panel-accent">
        <h1 className="mb-2 text-2xl font-semibold">Подписка MVP</h1>
        <p className="mb-4 text-slate-600">Доступ ко всем урокам и AI-чату.</p>
        <p className="mb-4 text-3xl font-bold">1490 ₽ / месяц</p>
        <PricingAction />
      </article>
      <article className="panel-accent">
        <h2 className="mb-2 text-lg font-semibold">Логика доступа</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
          <li>Без оплаты уроки закрыты</li>
          <li>После оплаты доступ открывается автоматически</li>
          <li>Проверка доступа выполняется на backend</li>
        </ul>
      </article>
    </section>
  );
}

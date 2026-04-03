import Link from "next/link";
import { Card } from "@/components/ui";

export default function Home() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="Платформа подготовки к ЕГЭ">
        <p className="mb-3">Регистрация, курсы, уроки с видео, задачи, чат с помощником и оплата доступа.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/register" className="btn-primary">
            Начать обучение
          </Link>
          <Link href="/login" className="btn-ghost">
            Уже есть аккаунт
          </Link>
        </div>
      </Card>

      <Card title="Как начать">
        <ul className="list-disc space-y-1 pl-5">
          <li>После регистрации открывается пробный доступ к математике</li>
          <li>На странице оплаты можно открыть доступ ко всем курсам</li>
          <li>Для администрирования используйте аккаунт администратора</li>
        </ul>
      </Card>
    </div>
  );
}

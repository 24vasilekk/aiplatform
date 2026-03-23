import Link from "next/link";
import { Card } from "@/components/ui";

export default function Home() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card title="MVP платформы ЕГЭ">
        <p className="mb-3">Рабочий MVP: регистрация, курсы, уроки с видео, задачи, AI-чат и демо-оплата.</p>
        <div className="flex flex-wrap gap-2">
          <Link href="/register" className="btn-primary">
            Начать обучение
          </Link>
          <Link href="/login" className="btn-ghost">
            Уже есть аккаунт
          </Link>
        </div>
      </Card>

      <Card title="Демо-сценарий">
        <ul className="list-disc space-y-1 pl-5">
          <li>Регистрация пользователя открывает пробный доступ к математике</li>
          <li>Оплата на странице `/pricing` открывает все курсы</li>
          <li>Роль admin: зарегистрируйте `admin@ege.local`</li>
        </ul>
      </Card>
    </div>
  );
}

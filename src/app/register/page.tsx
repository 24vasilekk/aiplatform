import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)] sm:p-5">
      <div className="grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h1 className="mb-1">Регистрация</h1>
          <p className="mb-4 text-sm text-slate-600">Создайте аккаунт и получите пробный доступ к курсу математики.</p>
          <AuthForm mode="register" />
        </article>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="mb-2 text-lg">Перед стартом</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Используйте рабочий email для восстановления пароля</li>
            <li>После входа откроется личный кабинет с курсами</li>
            <li>В любой момент можно перейти на соцлогин</li>
          </ul>
          <p className="mt-4 text-sm text-slate-700">
            Для роли admin в демо используйте email: <code>admin@ege.local</code>
          </p>
        </aside>
      </div>
    </section>
  );
}

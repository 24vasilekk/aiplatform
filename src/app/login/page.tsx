import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

const oauthErrorMap: Record<string, string> = {
  google_not_configured: "Google OAuth не настроен на сервере.",
  missing_code: "Google не вернул код авторизации. Попробуйте еще раз.",
  state_mismatch: "Сессия входа устарела или недействительна. Попробуйте еще раз.",
  invalid_profile: "Google-аккаунт должен иметь подтвержденный email.",
  google_failed: "Не удалось завершить вход через Google. Попробуйте позже.",
  account_exists: "Аккаунт уже существует. Войдите тем способом, который использовали при регистрации.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ oauth_error?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const oauthErrorCode = resolvedSearchParams?.oauth_error;
  const oauthError = oauthErrorCode ? oauthErrorMap[oauthErrorCode] : null;

  return (
    <section className="mx-auto w-full max-w-5xl rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-3 shadow-[0_14px_30px_rgba(15,23,42,0.06)] sm:p-5">
      <div className="grid gap-3 md:grid-cols-[1.05fr_0.95fr]">
        <article className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h1 className="mb-1">Вход</h1>
          <p className="mb-4 text-sm text-slate-600">Продолжите обучение с того места, где остановились.</p>
          {oauthError ? <p className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-sm text-rose-700">{oauthError}</p> : null}
          <AuthForm mode="login" />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-700">
            <Link href="/forgot-password" className="underline decoration-slate-300 underline-offset-4 hover:text-sky-700">
              Забыли пароль?
            </Link>
            <Link href="/register" className="underline decoration-slate-300 underline-offset-4 hover:text-sky-700">
              Нет аккаунта?
            </Link>
          </div>
        </article>

        <aside className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
          <h2 className="mb-2 text-lg">Что внутри платформы</h2>
          <ul className="list-disc space-y-2 pl-5 text-sm text-slate-700">
            <li>Курсы с уроками и задачами по ЕГЭ</li>
            <li>AI-помощник для разбора решений</li>
            <li>Личный кабинет с прогрессом</li>
          </ul>
          <p className="form-helper mt-4">
            Временный админ-вход: <code>admin@ege.local</code> / <code>wwwwww</code>
          </p>
        </aside>
      </div>
    </section>
  );
}

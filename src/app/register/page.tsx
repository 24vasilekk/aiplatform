import { AuthForm } from "@/components/auth-form";

export default function RegisterPage() {
  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h1 className="mb-4">Регистрация</h1>
      <AuthForm mode="register" />
      <p className="mt-3 text-sm text-slate-700">
        Для роли admin в демо используйте email: <code>admin@ege.local</code>
      </p>
    </section>
  );
}

import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-4 sm:p-6">
      <h1 className="mb-4">Вход</h1>
      <AuthForm mode="login" />
      <p className="form-helper mt-3">
        Временный админ-вход: <code>admin@ege.local</code> / <code>wwwwww</code>
      </p>
      <div className="mt-4 text-sm text-slate-700">
        <Link href="/forgot-password" className="underline">
          Забыли пароль?
        </Link>
      </div>
    </section>
  );
}

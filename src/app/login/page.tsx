import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export default function LoginPage() {
  return (
    <section className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6">
      <h1 className="mb-4 text-2xl font-semibold">Вход</h1>
      <AuthForm mode="login" />
      <div className="mt-4 text-sm text-slate-600">
        <Link href="/forgot-password" className="underline">
          Забыли пароль?
        </Link>
      </div>
    </section>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  email: string;
  role: "student" | "admin";
};

export function AuthControls({ mobile = false }: { mobile?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const response = await fetch("/api/me", { cache: "no-store" });
      const data = (await response.json()) as { user: User | null };
      setUser(data.user);
      setLoading(false);
    }

    void load();
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return <span className="text-xs text-slate-500">Загрузка...</span>;
  }

  if (!user) {
    return (
      <div className={mobile ? "grid gap-2" : "flex flex-wrap items-center gap-2 md:flex-nowrap"}>
        <Link href="/login" className={mobile ? "btn-ghost w-full px-3 py-2 text-center" : "btn-ghost px-3 py-1.5 md:px-3 md:py-2"}>
          Войти
        </Link>
        <Link
          href="/register"
          className={mobile ? "btn-primary w-full px-3 py-2 text-center" : "btn-primary px-3 py-1.5 md:px-3 md:py-2"}
        >
          Регистрация
        </Link>
      </div>
    );
  }

  return (
    <div className={mobile ? "grid gap-2" : "flex flex-wrap items-center gap-2 md:flex-nowrap"}>
      <span className={mobile ? "text-xs text-slate-500" : "max-w-[180px] truncate text-xs text-slate-500"}>{user.email}</span>
      <button type="button" onClick={logout} className="btn-ghost px-2 py-1 text-xs">
        Выйти
      </button>
    </div>
  );
}

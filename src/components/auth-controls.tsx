"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: string;
  email: string;
  role: "student" | "admin";
};

export function AuthControls() {
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
      <div className="flex items-center gap-2">
        <Link href="/login" className="btn-ghost">
          Войти
        </Link>
        <Link href="/register" className="btn-primary">
          Регистрация
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">{user.email}</span>
      <button type="button" onClick={logout} className="btn-ghost px-2 py-1 text-xs">
        Выйти
      </button>
    </div>
  );
}

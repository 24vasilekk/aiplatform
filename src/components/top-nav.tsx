import Link from "next/link";
import { AuthControls } from "@/components/auth-controls";

const links = [
  { href: "/dashboard", label: "Кабинет" },
  { href: "/chat", label: "Общий AI-чат" },
  { href: "/pricing", label: "Оплата" },
  { href: "/admin", label: "Админка" },
];

export function TopNav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="font-semibold text-black">
          EGE AI Platform
        </Link>
        <nav className="flex items-center gap-4 text-sm text-slate-600">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-md px-2 py-1 transition hover:bg-sky-50 hover:text-sky-700"
            >
              {link.label}
            </Link>
          ))}
          <AuthControls />
        </nav>
      </div>
    </header>
  );
}

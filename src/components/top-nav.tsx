"use client";

import Link from "next/link";
import { useState } from "react";
import { AuthControls } from "@/components/auth-controls";

const links = [
  { href: "/blog", label: "Блог" },
  { href: "/dashboard", label: "Кабинет" },
  { href: "/tutors", label: "Репетиторы" },
  { href: "/chat", label: "Общий AI-чат" },
  { href: "/pricing", label: "Оплата" },
  { href: "/admin", label: "Админка" },
];

export function TopNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-6xl px-3 py-3 sm:px-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="text-base font-medium tracking-[-0.01em] text-black">
            EGE AI Platform
          </Link>

          <div className="md:hidden">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm text-slate-700"
              onClick={() => setOpen((current) => !current)}
              aria-expanded={open}
              aria-controls="mobile-nav"
            >
              {open ? "Закрыть" : "Меню"}
            </button>
          </div>

          <nav className="hidden items-center gap-2 text-sm text-slate-700 md:flex">
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

        {open ? (
          <div id="mobile-nav" className="mt-3 space-y-2 border-t border-slate-200 pt-3 md:hidden">
            <nav className="grid gap-1 text-sm text-slate-700">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-2 py-2 transition hover:bg-sky-50 hover:text-sky-700"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <AuthControls mobile />
          </div>
        ) : null}
      </div>
    </header>
  );
}

import { ReactNode } from "react";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-sky-200 bg-white p-4 shadow-[0_2px_10px_rgba(14,165,233,0.08)]">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">{title}</h2>
      <div className="text-sm text-slate-700">{children}</div>
    </section>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-sky-50 px-2 py-1 text-xs text-sky-700">
      {children}
    </span>
  );
}

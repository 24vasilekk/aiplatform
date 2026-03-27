import { ReactNode } from "react";

export function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card-soft p-6">
      <h2 className="mb-3 text-slate-900">{title}</h2>
      <div className="text-sm leading-relaxed text-slate-700">{children}</div>
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

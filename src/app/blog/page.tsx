import type { Metadata } from "next";
import Link from "next/link";
import { listPublishedPosts } from "@/lib/db";

export const dynamic = "force-dynamic";

function buildAbsoluteUrl(path: string) {
  const base = process.env.APP_URL?.trim();
  if (!base) return undefined;
  return new URL(path, base).toString();
}

export const metadata: Metadata = {
  title: "Блог | EGE AI Platform",
  description: "Разборы задач, стратегии подготовки и полезные материалы для ЕГЭ.",
  alternates: {
    canonical: buildAbsoluteUrl("/blog"),
  },
  openGraph: {
    title: "Блог | EGE AI Platform",
    description: "Разборы задач, стратегии подготовки и полезные материалы для ЕГЭ.",
    type: "website",
    url: buildAbsoluteUrl("/blog"),
  },
  twitter: {
    card: "summary",
    title: "Блог | EGE AI Platform",
    description: "Разборы задач, стратегии подготовки и полезные материалы для ЕГЭ.",
  },
};

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export default async function BlogPage() {
  const posts = await listPublishedPosts();

  return (
    <section className="mx-auto w-full max-w-5xl space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sky-700">Блог</p>
        <h1 className="mt-2">Материалы по подготовке к ЕГЭ</h1>
        <p className="mt-3 max-w-3xl text-slate-700">
          Публикуем краткие разборы тем, стратегии решения и практические советы для части 1 и части 2.
        </p>
      </header>

      {posts.length === 0 ? (
        <article className="card-soft p-6 text-sm text-slate-700">Пока нет опубликованных постов.</article>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {posts.map((post) => {
            const publishedAtLabel = post.publishedAt
              ? dateFormat.format(new Date(post.publishedAt))
              : "Без даты публикации";

            return (
              <article key={post.id} className="card-soft card-soft-hover overflow-hidden">
                {post.coverImage ? (
                  <div className="max-h-52 overflow-hidden border-b border-slate-200">
                    <img
                      src={post.coverImage}
                      alt={post.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                <div className="p-5 sm:p-6">
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    {publishedAtLabel}
                  </p>
                  <h2 className="mb-3 text-xl font-semibold leading-tight tracking-[-0.015em] text-slate-900 sm:text-2xl">
                    <Link href={`/blog/${post.slug}`} className="transition hover:text-sky-700">
                      {post.title}
                    </Link>
                  </h2>
                  <p className="text-slate-700">{post.excerpt}</p>
                  <div className="mt-5">
                    <Link href={`/blog/${post.slug}`} className="btn-ghost">
                      Читать статью
                    </Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

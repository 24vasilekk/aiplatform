import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { getCurrentUser } from "@/lib/auth";
import { BlogShareButton } from "@/components/blog-share-button";
import { createAnalyticsEvent, findPublishedPostBySlug } from "@/lib/db";

export const dynamic = "force-dynamic";

type BlogPostPageProps = {
  params: Promise<{ slug: string }>;
};

function buildAbsoluteUrl(path: string) {
  const base = process.env.APP_URL?.trim();
  if (base === undefined || base === "") return undefined;
  return new URL(path, base).toString();
}

function normalizeImageUrl(url: string | null) {
  if (!url) return undefined;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const base = process.env.APP_URL?.trim();
  if (!base) return undefined;
  return new URL(url, base).toString();
}

const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "long",
  year: "numeric",
});

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = await findPublishedPostBySlug(slug);

  if (!post) {
    return {
      title: "Статья не найдена | Репетитор Бутакова",
      description: "Запрошенная статья не найдена или еще не опубликована.",
    };
  }

  const canonical = buildAbsoluteUrl(`/blog/${post.slug}`);
  const image = normalizeImageUrl(post.coverImage);

  return {
    title: `${post.title} | Блог Репетитор Бутакова`,
    description: post.excerpt,
    alternates: {
      canonical,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      url: canonical,
      images: image ? [{ url: image }] : undefined,
      publishedTime: post.publishedAt ?? undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title: post.title,
      description: post.excerpt,
      images: image ? [image] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = await findPublishedPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const publishedAtLabel = post.publishedAt
    ? dateFormat.format(new Date(post.publishedAt))
    : "Без даты публикации";
  const path = `/blog/${post.slug}`;
  const articleUrl = buildAbsoluteUrl(`/blog/${post.slug}`);
  const image = normalizeImageUrl(post.coverImage);
  const user = await getCurrentUser();
  await createAnalyticsEvent({
    eventName: "blog_post_view",
    userId: user?.id,
    path,
    payload: {
      slug: post.slug,
      title: post.title,
      hasCoverImage: Boolean(post.coverImage),
    },
  });
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt ?? post.createdAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: articleUrl,
    image: image ? [image] : undefined,
    author: {
      "@type": "Organization",
      name: "Репетитор Бутакова",
    },
    publisher: {
      "@type": "Organization",
      name: "Репетитор Бутакова",
    },
  };

  return (
    <article className="mx-auto w-full max-w-4xl space-y-5">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <nav className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href="/blog" className="text-sm font-medium text-sky-700 underline-offset-4 hover:underline">
            Все статьи
          </Link>
          <BlogShareButton slug={post.slug} title={post.title} />
        </div>
      </nav>

      <header className="rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:p-7">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">{publishedAtLabel}</p>
        <h1 className="mt-2 text-3xl font-semibold leading-tight tracking-[-0.02em] text-slate-900 md:text-4xl">
          {post.title}
        </h1>
        <p className="mt-3 text-lg leading-relaxed text-slate-700">{post.excerpt}</p>
      </header>

      {post.coverImage ? (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_8px_20px_rgba(15,23,42,0.06)]">
          <img
            src={post.coverImage}
            alt={post.title}
            className="h-auto w-full object-cover"
            loading="eager"
          />
        </div>
      ) : null}

      <div className="blog-prose card-soft p-5 sm:p-8 md:p-10">
        <ReactMarkdown>{post.content}</ReactMarkdown>
      </div>
    </article>
  );
}

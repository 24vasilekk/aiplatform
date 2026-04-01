"use client";

import { useMemo, useState } from "react";

type BlogShareButtonProps = {
  slug: string;
  title: string;
};

export function BlogShareButton({ slug, title }: BlogShareButtonProps) {
  const [status, setStatus] = useState<string | null>(null);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return `/blog/${slug}`;
    return new URL(`/blog/${slug}`, window.location.origin).toString();
  }, [slug]);

  async function trackShare(method: "native" | "clipboard") {
    await fetch("/api/analytics/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        eventName: "blog_post_share",
        path: `/blog/${slug}`,
        payload: {
          slug,
          method,
        },
      }),
    }).catch(() => null);
  }

  async function onShare() {
    setStatus(null);

    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title,
          url: shareUrl,
        });
        await trackShare("native");
        setStatus("Ссылка отправлена.");
        return;
      } catch {
        // Fallback to clipboard below.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      await trackShare("clipboard");
      setStatus("Ссылка скопирована.");
    } catch {
      setStatus("Не удалось поделиться ссылкой.");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button type="button" className="btn-ghost" onClick={() => void onShare()}>
        Поделиться
      </button>
      {status ? <span className="text-xs text-slate-600">{status}</span> : null}
    </div>
  );
}

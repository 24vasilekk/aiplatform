"use client";

import { FormEvent, useMemo, useState } from "react";

type BlogPost = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  content: string;
  coverImage: string | null;
  publishedAt: string | null;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
};

type BlogFilter = "all" | "draft" | "published";

type BlogFormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  publishedAt: string;
  isPublished: boolean;
};

const cyrillicMap: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "",
  ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function slugify(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .split("")
    .map((char) => cyrillicMap[char] ?? char)
    .join("")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return normalized;
}

function toInputDateTime(iso: string | null) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function emptyForm(): BlogFormState {
  return {
    title: "",
    slug: "",
    excerpt: "",
    content: "",
    coverImage: "",
    publishedAt: "",
    isPublished: false,
  };
}

export function AdminBlogManager({ initialPosts }: { initialPosts: BlogPost[] }) {
  const [posts, setPosts] = useState<BlogPost[]>(initialPosts);
  const [filter, setFilter] = useState<BlogFilter>("all");
  const [createForm, setCreateForm] = useState<BlogFormState>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<BlogFormState>(emptyForm);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const filteredPosts = useMemo(() => {
    const sorted = [...posts].sort((a, b) => {
      const aTs = new Date(a.publishedAt ?? a.createdAt).getTime();
      const bTs = new Date(b.publishedAt ?? b.createdAt).getTime();
      return bTs - aTs;
    });

    if (filter === "draft") return sorted.filter((item) => !item.isPublished);
    if (filter === "published") return sorted.filter((item) => item.isPublished);
    return sorted;
  }, [posts, filter]);

  const createSlugPreview = createForm.slug.trim() || slugify(createForm.title);
  const editSlugPreview = editForm.slug.trim() || slugify(editForm.title);

  async function loadPosts() {
    const response = await fetch("/api/admin/posts", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as BlogPost[];
    setPosts(data);
  }

  async function createPost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      const slug = createForm.slug.trim() || slugify(createForm.title);
      const response = await fetch("/api/admin/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: createForm.title,
          slug,
          excerpt: createForm.excerpt,
          content: createForm.content,
          coverImage: createForm.coverImage,
          publishedAt: toIsoOrNull(createForm.publishedAt),
          isPublished: createForm.isPublished,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Не удалось создать пост");
        return;
      }

      setCreateForm(emptyForm());
      setStatus("Пост создан.");
      await loadPosts();
    } finally {
      setLoading(false);
    }
  }

  function startEdit(post: BlogPost) {
    setEditId(post.id);
    setEditForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt,
      content: post.content,
      coverImage: post.coverImage ?? "",
      publishedAt: toInputDateTime(post.publishedAt),
      isPublished: post.isPublished,
    });
    setStatus(null);
  }

  async function saveEdit(postId: string) {
    setLoading(true);
    setStatus(null);

    try {
      const slug = editForm.slug.trim() || slugify(editForm.title);
      const response = await fetch(`/api/admin/posts/${postId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: editForm.title,
          slug,
          excerpt: editForm.excerpt,
          content: editForm.content,
          coverImage: editForm.coverImage,
          publishedAt: toIsoOrNull(editForm.publishedAt),
          isPublished: editForm.isPublished,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Не удалось обновить пост");
        return;
      }

      setEditId(null);
      setStatus("Изменения сохранены.");
      await loadPosts();
    } finally {
      setLoading(false);
    }
  }

  async function togglePublished(post: BlogPost) {
    setLoading(true);
    setStatus(null);

    try {
      const nextPublished = !post.isPublished;
      const response = await fetch(`/api/admin/posts/${post.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          isPublished: nextPublished,
          publishedAt: nextPublished ? (post.publishedAt ?? new Date().toISOString()) : post.publishedAt,
        }),
      });

      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus(data.error ?? "Не удалось изменить статус публикации");
        return;
      }

      await loadPosts();
      setStatus(nextPublished ? "Пост опубликован." : "Пост снят с публикации.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel-accent space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2>Блог</h2>
          <p className="text-xs text-slate-600">Всего постов: {posts.length}</p>
        </div>
        <div className="choice-group">
          <button
            type="button"
            className={filter === "all" ? "choice-chip choice-chip-active" : "choice-chip"}
            onClick={() => setFilter("all")}
          >
            Все
          </button>
          <button
            type="button"
            className={filter === "draft" ? "choice-chip choice-chip-active" : "choice-chip"}
            onClick={() => setFilter("draft")}
          >
            Draft
          </button>
          <button
            type="button"
            className={filter === "published" ? "choice-chip choice-chip-active" : "choice-chip"}
            onClick={() => setFilter("published")}
          >
            Published
          </button>
        </div>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2" onSubmit={createPost}>
        <h3 className="sm:col-span-2">Новый пост</h3>
        <input
          type="text"
          placeholder="Заголовок"
          value={createForm.title}
          onChange={(event) =>
            setCreateForm((current) => ({ ...current, title: event.target.value }))
          }
          required
          className="sm:col-span-2"
        />
        <input
          type="text"
          placeholder="Slug (опционально, сгенерируется автоматически)"
          value={createForm.slug}
          onChange={(event) =>
            setCreateForm((current) => ({ ...current, slug: event.target.value }))
          }
        />
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Превью URL: <code>/blog/{createSlugPreview || "your-slug"}</code>
        </div>
        <textarea
          placeholder="Краткое описание (excerpt)"
          value={createForm.excerpt}
          onChange={(event) =>
            setCreateForm((current) => ({ ...current, excerpt: event.target.value }))
          }
          required
          className="sm:col-span-2"
        />
        <textarea
          placeholder="Контент (Markdown)"
          value={createForm.content}
          onChange={(event) =>
            setCreateForm((current) => ({ ...current, content: event.target.value }))
          }
          required
          className="min-h-[180px] sm:col-span-2"
        />
        <input
          type="url"
          placeholder="Обложка (URL, опционально)"
          value={createForm.coverImage}
          onChange={(event) =>
            setCreateForm((current) => ({ ...current, coverImage: event.target.value }))
          }
        />
        <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-700">
            <span>Дата публикации (опционально)</span>
            <input
              type="datetime-local"
              value={createForm.publishedAt}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, publishedAt: event.target.value }))
              }
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={createForm.isPublished}
              onChange={(event) =>
                setCreateForm((current) => ({ ...current, isPublished: event.target.checked }))
              }
            />
            Опубликовать сразу
          </label>
        </div>

        <button type="submit" className="btn-primary sm:col-span-2" disabled={loading}>
          {loading ? "Сохраняем..." : "Создать пост"}
        </button>
      </form>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      {filteredPosts.length === 0 ? (
        <p className="text-sm text-slate-600">Постов по текущему фильтру пока нет.</p>
      ) : (
        <div className="space-y-3">
          {filteredPosts.map((post) => {
            const isEditing = editId === post.id;
            return (
              <article key={post.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-[0_4px_16px_rgba(15,23,42,0.04)]">
                {!isEditing ? (
                  <>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <h3 className="text-lg font-semibold text-slate-900">{post.title}</h3>
                        <p className="text-xs text-slate-500">
                          <code>/blog/{post.slug}</code>
                        </p>
                        <p className="text-sm text-slate-700">{post.excerpt}</p>
                      </div>
                      <span className={post.isPublished ? "choice-chip choice-chip-active" : "choice-chip"}>
                        {post.isPublished ? "Published" : "Draft"}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" className="btn-ghost" onClick={() => startEdit(post)}>
                        Редактировать
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => void togglePublished(post)} disabled={loading}>
                        {post.isPublished ? "Снять с публикации" : "Опубликовать"}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <h3>Редактирование поста</h3>
                    <input
                      type="text"
                      value={editForm.title}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, title: event.target.value }))
                      }
                    />
                    <input
                      type="text"
                      value={editForm.slug}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, slug: event.target.value }))
                      }
                    />
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Превью URL: <code>/blog/{editSlugPreview || "your-slug"}</code>
                    </div>
                    <textarea
                      value={editForm.excerpt}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, excerpt: event.target.value }))
                      }
                    />
                    <textarea
                      value={editForm.content}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, content: event.target.value }))
                      }
                      className="min-h-[180px]"
                    />
                    <input
                      type="url"
                      value={editForm.coverImage}
                      onChange={(event) =>
                        setEditForm((current) => ({ ...current, coverImage: event.target.value }))
                      }
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="space-y-1 text-sm text-slate-700">
                        <span>Дата публикации</span>
                        <input
                          type="datetime-local"
                          value={editForm.publishedAt}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, publishedAt: event.target.value }))
                          }
                        />
                      </label>
                      <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm text-slate-700">
                        <input
                          type="checkbox"
                          checked={editForm.isPublished}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, isPublished: event.target.checked }))
                          }
                        />
                        Опубликован
                      </label>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-primary" onClick={() => void saveEdit(post.id)} disabled={loading}>
                        {loading ? "Сохраняем..." : "Сохранить"}
                      </button>
                      <button type="button" className="btn-ghost" onClick={() => setEditId(null)}>
                        Отмена
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

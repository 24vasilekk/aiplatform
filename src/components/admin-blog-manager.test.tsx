import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminBlogManager } from "@/components/admin-blog-manager";

const initialPosts = [
  {
    id: "draft-1",
    slug: "draft-post",
    title: "Черновик",
    excerpt: "Краткое описание черновика для теста.",
    content: "Контент черновика для теста.",
    coverImage: null,
    publishedAt: null,
    isPublished: false,
    createdAt: "2026-03-30T10:00:00.000Z",
    updatedAt: "2026-03-30T10:00:00.000Z",
  },
  {
    id: "pub-1",
    slug: "published-post",
    title: "Публикация",
    excerpt: "Краткое описание публикации для теста.",
    content: "Контент публикации для теста.",
    coverImage: null,
    publishedAt: "2026-03-31T10:00:00.000Z",
    isPublished: true,
    createdAt: "2026-03-31T10:00:00.000Z",
    updatedAt: "2026-03-31T10:00:00.000Z",
  },
];

describe("AdminBlogManager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows slug preview generated from title", async () => {
    const user = userEvent.setup();
    render(<AdminBlogManager initialPosts={initialPosts} />);

    await user.type(screen.getByPlaceholderText("Заголовок"), "Тестовый пост");

    expect(screen.getByText(/\/blog\/testovyy-post/i)).toBeInTheDocument();
  });

  it("filters posts by status", async () => {
    const user = userEvent.setup();
    render(<AdminBlogManager initialPosts={initialPosts} />);

    await user.click(screen.getByRole("button", { name: "Draft" }));
    expect(screen.getByText("Черновик")).toBeInTheDocument();
    expect(screen.queryByText("Публикация")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Published" }));
    expect(screen.getByText("Публикация")).toBeInTheDocument();
    expect(screen.queryByText("Черновик")).not.toBeInTheDocument();
  });

  it("creates post with generated slug", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(global, "fetch");

    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 201,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(initialPosts), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      );

    render(<AdminBlogManager initialPosts={initialPosts} />);

    await user.type(screen.getByPlaceholderText("Заголовок"), "Новый пост");
    await user.type(screen.getByPlaceholderText("Краткое описание (excerpt)"), "Краткое описание нового поста для теста.");
    await user.type(screen.getByPlaceholderText("Контент (Markdown)"), "Контент нового поста больше двадцати символов.");
    await user.click(screen.getByRole("button", { name: "Создать пост" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/posts",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"slug":"novyy-post"'),
        }),
      );
    });
  });
});

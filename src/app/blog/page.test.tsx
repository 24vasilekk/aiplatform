import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPublishedPostsMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  listPublishedPosts: mocks.listPublishedPostsMock,
}));

import BlogPage from "@/app/blog/page";

describe("/blog page", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders empty state when there are no published posts", async () => {
    mocks.listPublishedPostsMock.mockResolvedValue([]);

    const jsx = await BlogPage();
    render(jsx);

    expect(screen.getByText("Пока нет опубликованных постов.")).toBeInTheDocument();
  });

  it("renders published post cards", async () => {
    mocks.listPublishedPostsMock.mockResolvedValue([
      {
        id: "p1",
        slug: "first-post",
        title: "Первый пост",
        excerpt: "Краткое описание первого поста.",
        coverImage: null,
        publishedAt: "2026-03-31T10:00:00.000Z",
      },
    ]);

    const jsx = await BlogPage();
    render(jsx);

    expect(screen.getByText("Первый пост")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Читать статью" })).toHaveAttribute("href", "/blog/first-post");
  });
});

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notFoundMock: vi.fn(),
  findPublishedPostBySlugMock: vi.fn(),
  createAnalyticsEventMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    notFound: mocks.notFoundMock,
  };
});

vi.mock("@/components/blog-share-button", () => ({
  BlogShareButton: ({ slug }: { slug: string }) => <div data-testid="share">share-{slug}</div>,
}));

vi.mock("@/lib/auth", () => ({
  getCurrentUser: mocks.getCurrentUserMock,
}));

vi.mock("@/lib/db", () => ({
  findPublishedPostBySlug: mocks.findPublishedPostBySlugMock,
  createAnalyticsEvent: mocks.createAnalyticsEventMock,
}));

import BlogPostPage, { generateMetadata } from "@/app/blog/[slug]/page";

describe("/blog/[slug] page", () => {
  beforeEach(() => {
    mocks.notFoundMock.mockImplementation(() => {
      throw new Error("NOT_FOUND");
    });
    mocks.createAnalyticsEventMock.mockResolvedValue(null);
    mocks.getCurrentUserMock.mockResolvedValue({ id: "u1" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns fallback metadata for missing post", async () => {
    mocks.findPublishedPostBySlugMock.mockResolvedValue(null);

    const metadata = await generateMetadata({ params: Promise.resolve({ slug: "missing" }) });

    expect(metadata.title).toContain("не найдена");
  });

  it("calls notFound for non-published slug", async () => {
    mocks.findPublishedPostBySlugMock.mockResolvedValue(null);

    await expect(BlogPostPage({ params: Promise.resolve({ slug: "draft-post" }) })).rejects.toThrow("NOT_FOUND");
  });

  it("renders published post and tracks blog_post_view", async () => {
    mocks.findPublishedPostBySlugMock.mockResolvedValue({
      id: "p1",
      slug: "published-post",
      title: "Опубликованный пост",
      excerpt: "Краткое описание опубликованного поста.",
      content: "# Контент\n\nТекст статьи.",
      coverImage: null,
      publishedAt: "2026-03-31T10:00:00.000Z",
      createdAt: "2026-03-31T10:00:00.000Z",
      updatedAt: "2026-03-31T10:00:00.000Z",
      isPublished: true,
    });

    const jsx = await BlogPostPage({ params: Promise.resolve({ slug: "published-post" }) });
    render(jsx);

    expect(screen.getByText("Опубликованный пост")).toBeInTheDocument();
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "blog_post_view",
        path: "/blog/published-post",
        payload: expect.objectContaining({ slug: "published-post" }),
      }),
    );
  });
});

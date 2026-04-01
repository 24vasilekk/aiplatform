import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  findPostBySlugMock: vi.fn(),
  updatePostMock: vi.fn(),
  deletePostMock: vi.fn(),
  createAdminAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/db", () => ({
  findPostBySlug: mocks.findPostBySlugMock,
  updatePost: mocks.updatePostMock,
  deletePost: mocks.deletePostMock,
  createAdminAuditLog: mocks.createAdminAuditLogMock,
}));

import { DELETE, PATCH } from "@/app/api/admin/posts/[postId]/route";

describe("/api/admin/posts/[postId]", () => {
  beforeEach(() => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "admin", email: "admin@ege.local", role: "admin" },
      error: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("PATCH returns 409 when slug belongs to another post", async () => {
    mocks.findPostBySlugMock.mockResolvedValue({ id: "other-post", slug: "same" });

    const request = new NextRequest("http://localhost/api/admin/posts/post-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "same",
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ postId: "post-1" }) });

    expect(response.status).toBe(409);
  });

  it("PATCH updates publication fields", async () => {
    mocks.findPostBySlugMock.mockResolvedValue(null);
    mocks.updatePostMock.mockResolvedValue({ id: "post-1", isPublished: true });

    const request = new NextRequest("http://localhost/api/admin/posts/post-1", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Новый заголовок",
        slug: "new-slug",
        excerpt: "Это достаточно длинный текст для краткого описания.",
        content: "Контент статьи длиной больше двадцати символов.",
        coverImage: "",
        isPublished: true,
        publishedAt: "2026-03-31T10:00:00.000Z",
      }),
    });

    const response = await PATCH(request, { params: Promise.resolve({ postId: "post-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mocks.updatePostMock).toHaveBeenCalledWith(
      "post-1",
      expect.objectContaining({
        slug: "new-slug",
        coverImage: null,
        isPublished: true,
      }),
    );
    expect(mocks.updatePostMock.mock.calls[0][1].publishedAt).toBeInstanceOf(Date);
  });

  it("DELETE returns 404 when post does not exist", async () => {
    mocks.deletePostMock.mockResolvedValue(false);

    const request = new NextRequest("http://localhost/api/admin/posts/post-404", {
      method: "DELETE",
    });

    const response = await DELETE(request, { params: Promise.resolve({ postId: "post-404" }) });

    expect(response.status).toBe(404);
  });
});

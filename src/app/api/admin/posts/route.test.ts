import { NextRequest, NextResponse } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  listPostsMock: vi.fn(),
  findPostBySlugMock: vi.fn(),
  createPostMock: vi.fn(),
  createAdminAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/db", () => ({
  listPosts: mocks.listPostsMock,
  findPostBySlug: mocks.findPostBySlugMock,
  createPost: mocks.createPostMock,
  createAdminAuditLog: mocks.createAdminAuditLogMock,
}));

import { GET, POST } from "@/app/api/admin/posts/route";

describe("/api/admin/posts", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET returns 403 for non-admin", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "u1", email: "student@example.com", role: "student" },
      error: null,
    });

    const response = await GET(new NextRequest("http://localhost/api/admin/posts"));

    expect(response.status).toBe(403);
  });

  it("GET returns posts for admin", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "admin", email: "admin@ege.local", role: "admin" },
      error: null,
    });
    mocks.listPostsMock.mockResolvedValue([{ id: "p1", slug: "one" }]);

    const response = await GET(new NextRequest("http://localhost/api/admin/posts"));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual([{ id: "p1", slug: "one" }]);
  });

  it("POST returns 409 for duplicate slug", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "admin", email: "admin@ege.local", role: "admin" },
      error: null,
    });
    mocks.findPostBySlugMock.mockResolvedValue({ id: "existing", slug: "same-slug" });

    const request = new NextRequest("http://localhost/api/admin/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "same-slug",
        title: "Тестовый заголовок",
        excerpt: "Это достаточно длинный текст для краткого описания.",
        content: "Контент статьи длиной больше двадцати символов.",
        isPublished: false,
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toContain("slug");
    expect(mocks.createPostMock).not.toHaveBeenCalled();
  });

  it("POST creates post for valid payload", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "admin", email: "admin@ege.local", role: "admin" },
      error: null,
    });
    mocks.findPostBySlugMock.mockResolvedValue(null);
    mocks.createPostMock.mockResolvedValue({ id: "post-1", slug: "new-post" });

    const request = new NextRequest("http://localhost/api/admin/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        slug: "new-post",
        title: "Тестовый заголовок",
        excerpt: "Это достаточно длинный текст для краткого описания.",
        content: "Контент статьи длиной больше двадцати символов.",
        coverImage: "",
        isPublished: true,
        publishedAt: "2026-03-31T10:00:00.000Z",
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(mocks.createPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "new-post",
        coverImage: null,
        isPublished: true,
      }),
    );
    expect(mocks.createPostMock.mock.calls[0][0].publishedAt).toBeInstanceOf(Date);
  });

  it("POST returns 400 for invalid payload", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "admin", email: "admin@ege.local", role: "admin" },
      error: null,
    });

    const request = new NextRequest("http://localhost/api/admin/posts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "A" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
  });

  it("returns auth error when requireUser fails", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(new NextRequest("http://localhost/api/admin/posts"));

    expect(response.status).toBe(401);
  });
});

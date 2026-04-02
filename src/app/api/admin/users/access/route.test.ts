import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  findAdminAuditLogByIdempotencyKeyMock: vi.fn(),
  findUserByIdMock: vi.fn(),
  grantCourseAccessMock: vi.fn(),
  createAdminAuditLogMock: vi.fn(),
  listCourseAccessMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: mocks.requireAdminMock,
}));

vi.mock("@/lib/db", () => ({
  findAdminAuditLogByIdempotencyKey: mocks.findAdminAuditLogByIdempotencyKeyMock,
  findUserById: mocks.findUserByIdMock,
  grantCourseAccess: mocks.grantCourseAccessMock,
  createAdminAuditLog: mocks.createAdminAuditLogMock,
  listCourseAccess: mocks.listCourseAccessMock,
}));

import { POST } from "@/app/api/admin/users/access/route";

describe("POST /api/admin/users/access", () => {
  beforeEach(() => {
    (globalThis as { __egeRateLimitStore?: Map<string, unknown> }).__egeRateLimitStore?.clear();
    mocks.requireAdminMock.mockResolvedValue({
      user: { id: "admin_1", email: "admin@ege.local", role: "admin" },
      error: null,
    });
    mocks.findAdminAuditLogByIdempotencyKeyMock.mockResolvedValue(null);
    mocks.findUserByIdMock.mockResolvedValue({
      id: "user_1",
      email: "student@example.com",
      role: "student",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    mocks.grantCourseAccessMock.mockResolvedValue({
      id: "access_1",
      userId: "user_1",
      courseId: "course_math",
      accessType: "subscription",
      expiresAt: null,
    });
    mocks.createAdminAuditLogMock.mockResolvedValue({ id: "audit_1" });
    mocks.listCourseAccessMock.mockResolvedValue([
      {
        id: "access_1",
        userId: "user_1",
        courseId: "course_math",
        accessType: "subscription",
        expiresAt: null,
      },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("grants access and writes admin audit log", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "grant_access_001" },
        body: JSON.stringify({
          userId: "user_1",
          courseId: "course_math",
          accessType: "subscription",
          idempotencyKey: "grant_access_001",
        }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.deduplicated).toBe(false);
    expect(mocks.grantCourseAccessMock).toHaveBeenCalledWith("user_1", "course_math", "subscription", null);
    expect(mocks.createAdminAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "admin_1",
        action: "grant_course_access",
        entityType: "course_access",
        entityId: "user_1:course_math",
      }),
    );
  });

  it("returns deduplicated response for repeated idempotency key", async () => {
    mocks.findAdminAuditLogByIdempotencyKeyMock.mockResolvedValue({
      id: "audit_existing",
      adminUserId: "admin_1",
      adminUserEmail: "admin@ege.local",
      action: "grant_course_access",
      entityType: "course_access",
      entityId: "user_1:course_math",
      metadata: { idempotencyKey: "grant_access_002" },
      createdAt: "2026-04-01T00:01:00.000Z",
    });

    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: "user_1",
          courseId: "course_math",
          accessType: "subscription",
          idempotencyKey: "grant_access_002",
        }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.deduplicated).toBe(true);
    expect(mocks.grantCourseAccessMock).not.toHaveBeenCalled();
    expect(mocks.createAdminAuditLogMock).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "u1", courseId: "", accessType: "subscription" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Неверные данные");
  });

  it("returns 404 when user does not exist", async () => {
    mocks.findUserByIdMock.mockResolvedValue(null);

    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "user_missing", courseId: "course_math", accessType: "trial" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toContain("не найден");
  });

  it("returns 415 for non-json content type", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ userId: "user_1", courseId: "course_math", accessType: "subscription" }),
      }) as never,
    );

    expect(response.status).toBe(415);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    for (let index = 0; index < 120; index += 1) {
      const response = await POST(
        new Request("http://localhost/api/admin/users/access", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-idempotency-key": `grant_access_rl_${index}`,
          },
          body: JSON.stringify({
            userId: "user_1",
            courseId: "course_math",
            accessType: "subscription",
            idempotencyKey: `grant_access_rl_${index}`,
          }),
        }) as never,
      );
      expect(response.status).toBe(200);
    }

    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "grant_access_rl_limit",
        },
        body: JSON.stringify({
          userId: "user_1",
          courseId: "course_math",
          accessType: "subscription",
          idempotencyKey: "grant_access_rl_limit",
        }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.code).toBe("rate_limited");
  });

  it("returns auth error as-is", async () => {
    mocks.requireAdminMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(
      new Request("http://localhost/api/admin/users/access", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "user_1", courseId: "course_math", accessType: "subscription" }),
      }) as never,
    );

    expect(response.status).toBe(401);
  });
});

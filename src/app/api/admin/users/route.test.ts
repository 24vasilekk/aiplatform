import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  listUsersPagedMock: vi.fn(),
  findUserByIdMock: vi.fn(),
  updateUserRoleMock: vi.fn(),
  createAdminAuditLogMock: vi.fn(),
  findAdminAuditLogByIdempotencyKeyMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: mocks.requireAdminMock,
}));

vi.mock("@/lib/db", () => ({
  listUsersPaged: mocks.listUsersPagedMock,
  findUserById: mocks.findUserByIdMock,
  updateUserRole: mocks.updateUserRoleMock,
  createAdminAuditLog: mocks.createAdminAuditLogMock,
  findAdminAuditLogByIdempotencyKey: mocks.findAdminAuditLogByIdempotencyKeyMock,
}));

import { GET, PATCH } from "@/app/api/admin/users/route";

describe("/api/admin/users", () => {
  beforeEach(() => {
    mocks.requireAdminMock.mockResolvedValue({
      user: { id: "admin_1", email: "admin@ege.local", role: "admin" },
      error: null,
    });
    mocks.listUsersPagedMock.mockResolvedValue({
      rows: [{ id: "user_1", email: "student@example.com", role: "student", createdAt: "2026-04-01T00:00:00.000Z" }],
      total: 1,
      take: 100,
      skip: 0,
    });
    mocks.findAdminAuditLogByIdempotencyKeyMock.mockResolvedValue(null);
    mocks.findUserByIdMock.mockResolvedValue({
      id: "user_1",
      email: "student@example.com",
      role: "student",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    mocks.updateUserRoleMock.mockResolvedValue({
      id: "user_1",
      email: "student@example.com",
      role: "tutor",
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    mocks.createAdminAuditLogMock.mockResolvedValue({ id: "audit_1" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns paged users", async () => {
    const response = await GET(new Request("http://localhost/api/admin/users?q=student&take=50&skip=10") as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.listUsersPagedMock).toHaveBeenCalledWith({
      role: undefined,
      query: "student",
      take: 50,
      skip: 10,
    });
    expect(data.items).toHaveLength(1);
  });

  it("updates user role to tutor and writes admin audit", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "role_change_0001",
        },
        body: JSON.stringify({ userId: "user_1", role: "tutor" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.deduplicated).toBe(false);
    expect(mocks.updateUserRoleMock).toHaveBeenCalledWith("user_1", "tutor");
    expect(mocks.createAdminAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        adminUserId: "admin_1",
        action: "set_user_role",
        entityType: "user_role",
        entityId: "user_1",
        metadata: expect.objectContaining({
          previousRole: "student",
          newRole: "tutor",
          idempotencyKey: "role_change_0001",
          deduplicatedByState: false,
        }),
      }),
    );
  });

  it("returns deduplicated result for repeated idempotency key", async () => {
    mocks.findAdminAuditLogByIdempotencyKeyMock.mockResolvedValue({
      id: "audit_existing",
      action: "set_user_role",
      entityType: "user_role",
      entityId: "user_1",
      metadata: { idempotencyKey: "role_change_0002" },
      createdAt: "2026-04-01T00:10:00.000Z",
      adminUserId: "admin_1",
      adminUserEmail: "admin@ege.local",
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "user_1", role: "tutor", idempotencyKey: "role_change_0002" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(data.deduplicated).toBe(true);
    expect(mocks.updateUserRoleMock).not.toHaveBeenCalled();
    expect(mocks.createAdminAuditLogMock).not.toHaveBeenCalled();
  });

  it("keeps idempotent state when role is already set", async () => {
    mocks.findUserByIdMock.mockResolvedValue({
      id: "user_1",
      email: "tutor@example.com",
      role: "tutor",
      createdAt: "2026-04-01T00:00:00.000Z",
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "user_1", role: "tutor", idempotencyKey: "role_change_0003" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.deduplicated).toBe(true);
    expect(mocks.updateUserRoleMock).not.toHaveBeenCalled();
    expect(mocks.createAdminAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          deduplicatedByState: true,
          previousRole: "tutor",
          newRole: "tutor",
        }),
      }),
    );
  });

  it("rejects role changes for admins", async () => {
    mocks.findUserByIdMock.mockResolvedValue({
      id: "admin_target",
      email: "admin2@ege.local",
      role: "admin",
      createdAt: "2026-04-01T00:00:00.000Z",
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/users", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: "admin_target", role: "tutor", idempotencyKey: "role_change_0004" }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("администратора");
    expect(mocks.updateUserRoleMock).not.toHaveBeenCalled();
  });

  it("returns auth error as-is", async () => {
    mocks.requireAdminMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(new Request("http://localhost/api/admin/users") as never);
    expect(response.status).toBe(401);
  });
});

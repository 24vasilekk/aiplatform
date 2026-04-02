import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRolesMock: vi.fn(),
  listTutorCustomCoursesPagedMock: vi.fn(),
  createTutorCustomCourseMock: vi.fn(),
  createAdminAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireRoles: mocks.requireRolesMock,
}));

vi.mock("@/lib/db", () => ({
  listTutorCustomCoursesPaged: mocks.listTutorCustomCoursesPagedMock,
  createTutorCustomCourse: mocks.createTutorCustomCourseMock,
  createAdminAuditLog: mocks.createAdminAuditLogMock,
}));

import { GET, POST } from "@/app/api/tutor/lms/courses/route";

describe("/api/tutor/lms/courses", () => {
  beforeEach(() => {
    (globalThis as { __egeRateLimitStore?: Map<string, unknown> }).__egeRateLimitStore?.clear();
    mocks.requireRolesMock.mockResolvedValue({
      user: { id: "tutor_1", email: "tutor@ege.local", role: "tutor" },
      error: null,
    });
    mocks.listTutorCustomCoursesPagedMock.mockResolvedValue({
      rows: [
        {
          id: "course_1",
          ownerId: "tutor_1",
          title: "Курс",
          description: "Описание курса для ЕГЭ",
          subject: "math",
          createdAt: "2026-04-02T00:00:00.000Z",
        },
      ],
      total: 1,
      take: 200,
      skip: 0,
    });
    mocks.createTutorCustomCourseMock.mockResolvedValue({
      id: "course_2",
      ownerId: "tutor_1",
      title: "Новый курс",
      description: "Описание нового курса для ЕГЭ",
      subject: "physics",
      createdAt: "2026-04-02T01:00:00.000Z",
    });
    mocks.createAdminAuditLogMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns only tutor-owned courses", async () => {
    const response = await GET(new Request("http://localhost/api/tutor/lms/courses") as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.listTutorCustomCoursesPagedMock).toHaveBeenCalledWith("tutor_1", { take: 200, skip: 0 });
    expect(data.items).toHaveLength(1);
  });

  it("creates tutor-owned course and writes audit", async () => {
    const response = await POST(
      new Request("http://localhost/api/tutor/lms/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Новый курс",
          description: "Описание нового курса для ЕГЭ",
          subject: "physics",
        }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.ok).toBe(true);
    expect(mocks.createTutorCustomCourseMock).toHaveBeenCalledWith(
      "tutor_1",
      expect.objectContaining({ subject: "physics" }),
    );
    expect(mocks.createAdminAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "tutor_lms_create_course",
        entityType: "tutor_course",
      }),
    );
  });

  it("returns 415 when creating course without json content type", async () => {
    const response = await POST(
      new Request("http://localhost/api/tutor/lms/courses", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({
          title: "Новый курс",
          description: "Описание нового курса для ЕГЭ",
          subject: "physics",
        }),
      }) as never,
    );

    expect(response.status).toBe(415);
  });

  it("returns auth error as-is", async () => {
    mocks.requireRolesMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });
    const response = await GET(new Request("http://localhost/api/tutor/lms/courses") as never);
    expect(response.status).toBe(403);
  });
});

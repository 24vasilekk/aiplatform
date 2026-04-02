import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRolesMock: vi.fn(),
  updateTutorCustomTaskMock: vi.fn(),
  deleteTutorCustomTaskMock: vi.fn(),
  createAdminAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireRoles: mocks.requireRolesMock,
}));

vi.mock("@/lib/db", () => ({
  updateTutorCustomTask: mocks.updateTutorCustomTaskMock,
  deleteTutorCustomTask: mocks.deleteTutorCustomTaskMock,
  createAdminAuditLog: mocks.createAdminAuditLogMock,
}));

import { PATCH } from "@/app/api/tutor/lms/tasks/[taskId]/route";

describe("/api/tutor/lms/tasks/[taskId]", () => {
  beforeEach(() => {
    (globalThis as { __egeRateLimitStore?: Map<string, unknown> }).__egeRateLimitStore?.clear();
    mocks.requireRolesMock.mockResolvedValue({
      user: { id: "tutor_1", email: "tutor@ege.local", role: "tutor" },
      error: null,
    });
    mocks.updateTutorCustomTaskMock.mockResolvedValue({
      id: "task_1",
      lessonId: "lesson_1",
      type: "choice",
      status: "published",
      question: "q",
      options: ["a", "b"],
      answer: "a",
      solution: "s",
      difficulty: 2,
      topicTags: [],
      exemplarSolution: null,
      evaluationCriteria: [],
      createdAt: "2026-04-01T00:00:00.000Z",
    });
    mocks.createAdminAuditLogMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects changing task type to choice without options", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/tutor/lms/tasks/task_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "choice" }),
      }) as never,
      { params: Promise.resolve({ taskId: "task_1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain("Неверные данные");
    expect(mocks.updateTutorCustomTaskMock).not.toHaveBeenCalled();
  });

  it("allows changing task type to choice with valid options", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/tutor/lms/tasks/task_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "choice", options: ["A", "B"], answer: "A" }),
      }) as never,
      { params: Promise.resolve({ taskId: "task_1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updateTutorCustomTaskMock).toHaveBeenCalledWith(
      "tutor_1",
      "task_1",
      expect.objectContaining({
        type: "choice",
        options: ["A", "B"],
      }),
    );
  });

  it("returns 415 for non-json content type", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/tutor/lms/tasks/task_1", {
        method: "PATCH",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ type: "choice", options: ["A", "B"] }),
      }) as never,
      { params: Promise.resolve({ taskId: "task_1" }) },
    );

    expect(response.status).toBe(415);
  });

  it("returns auth error as-is", async () => {
    mocks.requireRolesMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    });

    const response = await PATCH(
      new Request("http://localhost/api/tutor/lms/tasks/task_1", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: "choice", options: ["A", "B"] }),
      }) as never,
      { params: Promise.resolve({ taskId: "task_1" }) },
    );

    expect(response.status).toBe(403);
  });
});

import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  saveLessonProgressMock: vi.fn(),
  createAnalyticsEventMock: vi.fn(),
  syncCompletedCourseLoyaltyMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/db", () => ({
  saveLessonProgress: mocks.saveLessonProgressMock,
  createAnalyticsEvent: mocks.createAnalyticsEventMock,
}));

vi.mock("@/lib/loyalty", () => ({
  syncCompletedCourseLoyalty: mocks.syncCompletedCourseLoyaltyMock,
}));

import { POST } from "@/app/api/lessons/[lessonId]/progress/route";

describe("POST /api/lessons/[lessonId]/progress", () => {
  beforeEach(() => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "u1", email: "student@example.com", role: "student" },
      error: null,
    });
    mocks.saveLessonProgressMock.mockResolvedValue(null);
    mocks.createAnalyticsEventMock.mockResolvedValue(null);
    mocks.syncCompletedCourseLoyaltyMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid payload", async () => {
    const response = await POST(
      new Request("http://localhost/api/lessons/lesson-1/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "oops" }),
      }) as never,
      { params: Promise.resolve({ lessonId: "lesson-1" }) },
    );
    expect(response.status).toBe(400);
  });

  it("saves progress and emits analytics event", async () => {
    const response = await POST(
      new Request("http://localhost/api/lessons/lesson-1/progress", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "completed", lastPositionSec: 245 }),
      }) as never,
      { params: Promise.resolve({ lessonId: "lesson-1" }) },
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mocks.saveLessonProgressMock).toHaveBeenCalledWith({
      userId: "u1",
      lessonId: "lesson-1",
      status: "completed",
      lastPositionSec: 245,
    });
    expect(mocks.createAnalyticsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "lesson_progress_updated",
        userId: "u1",
      }),
    );
    expect(mocks.syncCompletedCourseLoyaltyMock).toHaveBeenCalledWith("u1");
  });

  it("returns auth error response as-is", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await POST(
      new Request("http://localhost/api/lessons/lesson-1/progress", { method: "POST" }) as never,
      { params: Promise.resolve({ lessonId: "lesson-1" }) },
    );
    expect(response.status).toBe(401);
  });
});

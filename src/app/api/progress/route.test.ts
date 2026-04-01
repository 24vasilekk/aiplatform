import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  buildUserProgressSnapshotMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/progress", () => ({
  buildUserProgressSnapshot: mocks.buildUserProgressSnapshotMock,
}));

import { GET } from "@/app/api/progress/route";

describe("GET /api/progress", () => {
  beforeEach(() => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "u1", email: "student@example.com", role: "student" },
      error: null,
    });
    mocks.buildUserProgressSnapshotMock.mockResolvedValue({
      userId: "u1",
      summary: { percent: 40 },
      courses: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns student progress snapshot", async () => {
    const response = await GET(new Request("http://localhost/api/progress") as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.userId).toBe("u1");
    expect(mocks.buildUserProgressSnapshotMock).toHaveBeenCalledWith("u1");
  });

  it("returns auth error when unauthorized", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await GET(new Request("http://localhost/api/progress") as never);
    expect(response.status).toBe(401);
  });
});


import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getLoyaltySnapshotMock: vi.fn(),
  observeRequestMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/loyalty", () => ({
  getLoyaltySnapshot: mocks.getLoyaltySnapshotMock,
}));

vi.mock("@/lib/observability", () => ({
  observeRequest: mocks.observeRequestMock,
}));

import { GET } from "@/app/api/loyalty/route";

describe("GET /api/loyalty", () => {
  beforeEach(() => {
    mocks.observeRequestMock.mockImplementation(async (input: { handler: () => Promise<unknown> }) => input.handler());
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "u1", email: "student@example.com", role: "student" },
      error: null,
    });
    mocks.getLoyaltySnapshotMock.mockResolvedValue({
      userId: "u1",
      pointsBalance: 1200,
      transactions: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns loyalty snapshot", async () => {
    const response = await GET(new Request("http://localhost/api/loyalty?take=10") as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.userId).toBe("u1");
    expect(mocks.getLoyaltySnapshotMock).toHaveBeenCalledWith("u1", 10);
  });

  it("returns auth error as-is", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(new Request("http://localhost/api/loyalty") as never);
    expect(response.status).toBe(401);
  });
});

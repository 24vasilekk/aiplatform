import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdminMock: vi.fn(),
  listUsersPagedMock: vi.fn(),
  findUserByIdMock: vi.fn(),
  listAllCoursesMock: vi.fn(),
  buildUserProgressSnapshotMock: vi.fn(),
  listAdminPaymentsMock: vi.fn(),
  listCourseAccessPagedMock: vi.fn(),
  listAiSolutionAnalysesPagedMock: vi.fn(),
  listAnalyticsEventsMock: vi.fn(),
  getWalletByUserIdMock: vi.fn(),
  listWalletTransactionsMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireAdmin: mocks.requireAdminMock,
}));

vi.mock("@/lib/course-catalog", () => ({
  listAllCourses: mocks.listAllCoursesMock,
}));

vi.mock("@/lib/progress", () => ({
  buildUserProgressSnapshot: mocks.buildUserProgressSnapshotMock,
}));

vi.mock("@/lib/db", () => ({
  listUsersPaged: mocks.listUsersPagedMock,
  findUserById: mocks.findUserByIdMock,
  listAdminPayments: mocks.listAdminPaymentsMock,
  listCourseAccessPaged: mocks.listCourseAccessPagedMock,
  listAiSolutionAnalysesPaged: mocks.listAiSolutionAnalysesPagedMock,
  listAnalyticsEvents: mocks.listAnalyticsEventsMock,
  getWalletByUserId: mocks.getWalletByUserIdMock,
  listWalletTransactions: mocks.listWalletTransactionsMock,
}));

import { GET } from "@/app/api/admin/users/360/route";

describe("GET /api/admin/users/360", () => {
  beforeEach(() => {
    (globalThis as { __egeRateLimitStore?: Map<string, unknown> }).__egeRateLimitStore?.clear();
    mocks.requireAdminMock.mockResolvedValue({
      user: { id: "admin_1", email: "admin@ege.local", role: "admin" },
      error: null,
    });
    mocks.listUsersPagedMock.mockResolvedValue({
      rows: [{ id: "user_1", email: "student@example.com", role: "student", createdAt: "2026-04-02T00:00:00.000Z" }],
      total: 1,
      take: 100,
      skip: 0,
    });
    mocks.findUserByIdMock.mockResolvedValue({
      id: "user_1",
      email: "student@example.com",
      role: "student",
      createdAt: "2026-04-02T00:00:00.000Z",
    });
    mocks.listAllCoursesMock.mockResolvedValue([{ id: "math-base", title: "Math Base" }]);
    mocks.buildUserProgressSnapshotMock.mockResolvedValue({
      userId: "user_1",
      generatedAt: "2026-04-02T01:00:00.000Z",
      summary: {
        percent: 10,
        status: "in_progress",
        completedCourses: 0,
        totalCourses: 1,
        completedLessons: 1,
        totalLessons: 10,
        completedTasks: 2,
        totalTasks: 20,
        startedAt: null,
        completedAt: null,
        lastActivityAt: null,
      },
      courses: [],
    });
    mocks.listAdminPaymentsMock.mockResolvedValue({ rows: [], total: 0 });
    mocks.listCourseAccessPagedMock.mockResolvedValue({ rows: [], total: 0, take: 30, skip: 0 });
    mocks.listAiSolutionAnalysesPagedMock.mockResolvedValue({ rows: [], total: 0, take: 30, skip: 0 });
    mocks.listAnalyticsEventsMock.mockResolvedValue({ rows: [], total: 0 });
    mocks.getWalletByUserIdMock.mockResolvedValue({
      id: "wallet_1",
      userId: "user_1",
      balanceCents: 1200,
      currency: "RUB",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-02T00:00:00.000Z",
    });
    mocks.listWalletTransactionsMock.mockResolvedValue({ rows: [], total: 0 });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns selector without sections when user is not selected", async () => {
    mocks.listUsersPagedMock.mockResolvedValue({ rows: [], total: 0, take: 100, skip: 0 });

    const response = await GET(new Request("http://localhost/api/admin/users/360") as never);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sections).toBeNull();
    expect(data.selector.selectedUserId).toBeNull();
  });

  it("returns 360 sections with paginated data", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/admin/users/360?userId=user_1&from=2026-04-01&to=2026-04-02&eventTypes=login_success,payment_failed&paymentsSortBy=paidAt&paymentsSortDir=asc&eventsSortDir=asc",
      ) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sections.profile.email).toBe("student@example.com");
    expect(data.sections.wallet.wallet.id).toBe("wallet_1");
    expect(mocks.listAdminPaymentsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        sortBy: "paidAt",
        sortDir: "asc",
      }),
    );
    expect(mocks.listAnalyticsEventsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventNames: ["login_success", "payment_failed"],
        sortDir: "asc",
      }),
    );
    expect(response.headers.get("x-ratelimit-limit")).toBeTruthy();
  });

  it("loads only requested section subset for performance", async () => {
    const response = await GET(
      new Request("http://localhost/api/admin/users/360?userId=user_1&sections=payments&profile=1") as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.meta?.timingsMs).toBeTruthy();
    expect(mocks.listAdminPaymentsMock).toHaveBeenCalled();
    expect(mocks.listCourseAccessPagedMock).not.toHaveBeenCalled();
    expect(mocks.listAiSolutionAnalysesPagedMock).not.toHaveBeenCalled();
    expect(mocks.listAnalyticsEventsMock).not.toHaveBeenCalled();
    expect(mocks.listWalletTransactionsMock).not.toHaveBeenCalled();
    expect(mocks.buildUserProgressSnapshotMock).not.toHaveBeenCalled();
    expect(response.headers.get("server-timing")).toBeTruthy();
  });

  it("returns auth error as-is", async () => {
    mocks.requireAdminMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await GET(new Request("http://localhost/api/admin/users/360") as never);
    expect(response.status).toBe(401);
  });
});

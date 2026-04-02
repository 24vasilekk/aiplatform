import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  observeRequestMock: vi.fn(),
  listAdminLoyaltyAccountsMock: vi.fn(),
  listAdminLoyaltyTransactionsMock: vi.fn(),
  listAdminAuditLogsMock: vi.fn(),
  createAdminAuditLogMock: vi.fn(),
  adjustLoyaltyPointsByAdminMock: vi.fn(),
  getLoyaltySnapshotMock: vi.fn(),
  isInsufficientLoyaltyPointsErrorMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/observability", () => ({
  observeRequest: mocks.observeRequestMock,
}));

vi.mock("@/lib/db", () => ({
  listAdminLoyaltyAccounts: mocks.listAdminLoyaltyAccountsMock,
  listAdminLoyaltyTransactions: mocks.listAdminLoyaltyTransactionsMock,
  listAdminAuditLogs: mocks.listAdminAuditLogsMock,
  createAdminAuditLog: mocks.createAdminAuditLogMock,
}));

vi.mock("@/lib/loyalty", () => ({
  LOYALTY_RULES: {
    pointsPerCourseCompletion: 1200,
    pointsLifetimeDays: 180,
    discountValuePerPointCents: 1,
    maxDiscountPercent: 30,
    minOrderAmountCents: 50000,
    minPayableAmountCents: 10000,
    maxPointsPerOrder: 70000,
  },
  adjustLoyaltyPointsByAdmin: mocks.adjustLoyaltyPointsByAdminMock,
  getLoyaltySnapshot: mocks.getLoyaltySnapshotMock,
  isInsufficientLoyaltyPointsError: mocks.isInsufficientLoyaltyPointsErrorMock,
}));

import { GET, POST } from "@/app/api/admin/loyalty/route";

describe("admin loyalty API", () => {
  beforeEach(() => {
    mocks.observeRequestMock.mockImplementation(async ({ handler }) => handler());
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "admin_1", email: "admin@ege.local", role: "admin" },
      error: null,
    });
    mocks.listAdminLoyaltyAccountsMock.mockResolvedValue({ rows: [], total: 0 });
    mocks.listAdminLoyaltyTransactionsMock.mockResolvedValue({ rows: [], total: 0 });
    mocks.listAdminAuditLogsMock.mockResolvedValue({ rows: [], total: 0 });
    mocks.createAdminAuditLogMock.mockResolvedValue(null);
    mocks.adjustLoyaltyPointsByAdminMock.mockResolvedValue({
      transactionId: "tx_1",
      direction: "credit",
      points: 100,
      balanceAfter: 100,
      deduplicated: false,
    });
    mocks.getLoyaltySnapshotMock.mockResolvedValue({
      userId: "u1",
      pointsBalance: 100,
      transactions: [],
    });
    mocks.isInsufficientLoyaltyPointsErrorMock.mockReturnValue(false);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads loyalty data with filters", async () => {
    const response = await GET(
      new Request(
        "http://localhost/api/admin/loyalty?q=student%40mail.com&direction=debit&from=2026-04-01&to=2026-04-02",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(mocks.listAdminLoyaltyTransactionsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: "student@mail.com",
        direction: "debit",
      }),
    );
  });

  it("applies manual adjustment and writes admin audit", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/loyalty", {
        method: "POST",
        headers: { "content-type": "application/json", "x-idempotency-key": "idem_admin_loyalty_1" },
        body: JSON.stringify({
          userId: "user_1",
          direction: "credit",
          points: 100,
          reason: "bonus",
        }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mocks.adjustLoyaltyPointsByAdminMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_1",
        points: 100,
        direction: "credit",
      }),
    );
    expect(mocks.createAdminAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "adjust_loyalty_points",
        entityType: "loyalty",
        entityId: "user_1",
      }),
    );
  });

  it("returns 400 on insufficient points for debit", async () => {
    const err = new Error("INSUFFICIENT_LOYALTY_POINTS");
    mocks.adjustLoyaltyPointsByAdminMock.mockRejectedValue(err);
    mocks.isInsufficientLoyaltyPointsErrorMock.mockReturnValue(true);

    const response = await POST(
      new Request("http://localhost/api/admin/loyalty", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          userId: "user_1",
          direction: "debit",
          points: 1000,
        }),
      }) as never,
    );
    expect(response.status).toBe(400);
  });

  it("returns 403 for non-admin user", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "u1", email: "user@example.com", role: "student" },
      error: null,
    });
    const response = await GET(new Request("http://localhost/api/admin/loyalty") as never);
    expect(response.status).toBe(403);
  });

  it("returns auth error as-is", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await GET(new Request("http://localhost/api/admin/loyalty") as never);
    expect(response.status).toBe(401);
  });
});

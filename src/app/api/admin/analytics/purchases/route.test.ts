import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  listAdminPaymentsMock: vi.fn(),
  resolvePlanCourseIdsMock: vi.fn(),
  listAllCoursesMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/db", () => ({
  listAdminPayments: mocks.listAdminPaymentsMock,
}));

vi.mock("@/lib/billing", () => ({
  resolvePlanCourseIds: mocks.resolvePlanCourseIdsMock,
}));

vi.mock("@/lib/course-catalog", () => ({
  listAllCourses: mocks.listAllCoursesMock,
}));

import { GET } from "@/app/api/admin/analytics/purchases/route";

describe("GET /api/admin/analytics/purchases", () => {
  beforeEach(() => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "admin", email: "admin@ege.local", role: "admin" },
      error: null,
    });
    mocks.listAllCoursesMock.mockResolvedValue([
      { id: "math-ege-2026", title: "Математика ЕГЭ", description: "", subject: "math", sectionIds: [], progress: 0 },
    ]);
    mocks.resolvePlanCourseIdsMock.mockResolvedValue(["math-ege-2026"]);
    mocks.listAdminPaymentsMock.mockResolvedValue({
      rows: [
        {
          id: "p1",
          userId: "u1",
          userEmail: "student@example.com",
          planId: "math_only",
          amountCents: 490000,
          currency: "RUB",
          status: "succeeded",
          provider: "mock",
          providerPaymentId: "provider_1",
          idempotencyKey: "idem_1",
          createdAt: "2026-04-01T10:00:00.000Z",
          updatedAt: "2026-04-01T10:00:00.000Z",
          paidAt: "2026-04-01T10:01:00.000Z",
          failedAt: null,
          canceledAt: null,
          failureReason: null,
        },
      ],
      total: 1,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns forbidden for non-admin", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "u1", email: "student@example.com", role: "student" },
      error: null,
    });
    const response = await GET(new Request("http://localhost/api/admin/analytics/purchases") as never);
    expect(response.status).toBe(403);
  });

  it("returns JSON list with pagination metadata", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/analytics/purchases?take=20&skip=0&sortBy=createdAt&sortDir=desc"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.items).toHaveLength(1);
    expect(data.total).toBe(1);
    expect(data.items[0].courseTitles).toEqual(["Математика ЕГЭ"]);
  });

  it("returns CSV export", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/analytics/purchases?format=csv"),
    );
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(text).toContain("student@example.com");
    expect(text).toContain("math_only");
  });
});

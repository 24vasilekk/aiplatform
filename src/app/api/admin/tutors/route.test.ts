import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireTutorOrAdminMock: vi.fn(),
  listTutorListingsMock: vi.fn(),
  createTutorListingMock: vi.fn(),
  createAdminAuditLogMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireTutorOrAdmin: mocks.requireTutorOrAdminMock,
}));

vi.mock("@/lib/tutor-market", () => ({
  listTutorListings: mocks.listTutorListingsMock,
  createTutorListing: mocks.createTutorListingMock,
}));

vi.mock("@/lib/db", () => ({
  createAdminAuditLog: mocks.createAdminAuditLogMock,
}));

import { GET, POST } from "@/app/api/admin/tutors/route";

describe("admin tutors route role guards", () => {
  beforeEach(() => {
    (globalThis as { __egeRateLimitStore?: Map<string, unknown> }).__egeRateLimitStore?.clear();
    mocks.requireTutorOrAdminMock.mockResolvedValue({
      user: { id: "tutor_1", email: "tutor@ege.local", role: "tutor" },
      error: null,
    });
    mocks.listTutorListingsMock.mockResolvedValue([]);
    mocks.createTutorListingMock.mockResolvedValue({
      id: "t_1",
      name: "Tutor",
      subject: "math",
      pricePerHour: 1500,
      rating: 4.9,
      about: "Опытный преподаватель по ЕГЭ и олимпиадам",
      city: "Moscow",
      experienceYears: 7,
    });
    mocks.createAdminAuditLogMock.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("allows tutor to list tutors", async () => {
    const response = await GET(new Request("http://localhost/api/admin/tutors") as never);
    expect(response.status).toBe(200);
    expect(mocks.listTutorListingsMock).toHaveBeenCalled();
  });

  it("allows tutor to create tutor listing and writes audit", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/tutors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: "Tutor",
          subject: "math",
          pricePerHour: 1500,
          rating: 4.8,
          about: "Подготовка к ЕГЭ и вузовским экзаменам",
          city: "Moscow",
          experienceYears: 6,
        }),
      }) as never,
    );
    expect(response.status).toBe(201);
    expect(mocks.createAdminAuditLogMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "create_tutor_listing_by_tutor",
      }),
    );
  });

  it("returns 415 for non-json payload in POST", async () => {
    const response = await POST(
      new Request("http://localhost/api/admin/tutors", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({
          name: "Tutor",
          subject: "math",
          pricePerHour: 1500,
          rating: 4.8,
          about: "Подготовка к ЕГЭ и вузовским экзаменам",
          city: "Moscow",
          experienceYears: 6,
        }),
      }) as never,
    );

    expect(response.status).toBe(415);
  });

  it("returns auth error as-is", async () => {
    mocks.requireTutorOrAdminMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });
    const response = await GET(new Request("http://localhost/api/admin/tutors") as never);
    expect(response.status).toBe(401);
  });
});

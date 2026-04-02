import { NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  getLoyaltyDiscountQuoteMock: vi.fn(),
  observeRequestMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/loyalty", () => ({
  getLoyaltyDiscountQuote: mocks.getLoyaltyDiscountQuoteMock,
}));

vi.mock("@/lib/observability", () => ({
  observeRequest: mocks.observeRequestMock,
}));

import { POST } from "@/app/api/loyalty/quote/route";

describe("POST /api/loyalty/quote", () => {
  beforeEach(() => {
    (globalThis as { __egeRateLimitStore?: Map<string, unknown> }).__egeRateLimitStore?.clear();
    mocks.observeRequestMock.mockImplementation(async (input: { handler: () => Promise<unknown> }) => input.handler());
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "u1", email: "student@example.com", role: "student" },
      error: null,
    });
    mocks.getLoyaltyDiscountQuoteMock.mockResolvedValue({
      orderAmountCents: 490000,
      discountCents: 10000,
      pointsToSpend: 10000,
      finalAmountCents: 480000,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("calculates discount quote by plan", async () => {
    const response = await POST(
      new Request("http://localhost/api/loyalty/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: "math_only", requestedPoints: 10000 }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mocks.getLoyaltyDiscountQuoteMock).toHaveBeenCalledWith({
      userId: "u1",
      orderAmountCents: 99000,
      requestedPoints: 10000,
    });
  });

  it("returns 400 when payload is invalid", async () => {
    const response = await POST(
      new Request("http://localhost/api/loyalty/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ requestedPoints: 500 }),
      }) as never,
    );
    expect(response.status).toBe(400);
  });

  it("returns 415 when content-type is not json", async () => {
    const response = await POST(
      new Request("http://localhost/api/loyalty/quote", {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: JSON.stringify({ planId: "math_only" }),
      }) as never,
    );

    expect(response.status).toBe(415);
  });

  it("returns auth error as-is", async () => {
    mocks.requireUserMock.mockResolvedValue({
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(
      new Request("http://localhost/api/loyalty/quote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ planId: "math_only" }),
      }) as never,
    );
    expect(response.status).toBe(401);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireUserMock: vi.fn(),
  topupWalletMock: vi.fn(),
  getWalletSnapshotMock: vi.fn(),
  observeRequestMock: vi.fn(),
  rateLimitByRequestMock: vi.fn(),
  hasJsonContentTypeMock: vi.fn(),
}));

vi.mock("@/lib/api-auth", () => ({
  requireUser: mocks.requireUserMock,
}));

vi.mock("@/lib/db", () => ({
  topupWallet: mocks.topupWalletMock,
  getWalletSnapshot: mocks.getWalletSnapshotMock,
}));

vi.mock("@/lib/observability", () => ({
  observeRequest: mocks.observeRequestMock,
}));

vi.mock("@/lib/security", () => ({
  applyRateLimitHeaders: vi.fn(),
  createRateLimitResponse: vi.fn((result: { retryAfterSec: number }, message: string) =>
    Response.json({ error: message, retryAfterSec: result.retryAfterSec }, { status: 429 })),
  hasJsonContentType: mocks.hasJsonContentTypeMock,
  rateLimitByRequest: mocks.rateLimitByRequestMock,
}));

import { POST } from "@/app/api/wallet/topup/route";

describe("POST /api/wallet/topup", () => {
  beforeEach(() => {
    mocks.observeRequestMock.mockImplementation(async (input: { handler: () => Promise<unknown> }) => input.handler());
    mocks.requireUserMock.mockResolvedValue({
      user: { id: "u1", email: "student@example.com", role: "student" },
      error: null,
    });
    mocks.rateLimitByRequestMock.mockReturnValue({
      ok: true,
      limit: 12,
      remaining: 11,
      resetAt: Date.now() + 60_000,
      retryAfterSec: 60,
    });
    mocks.hasJsonContentTypeMock.mockReturnValue(true);
    mocks.topupWalletMock.mockResolvedValue(null);
    mocks.getWalletSnapshotMock.mockResolvedValue({
      wallet: { id: "w1", userId: "u1", balanceCents: 150000, currency: "RUB" },
      transactions: [],
      totalTransactions: 0,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns 415 when request is not JSON", async () => {
    mocks.hasJsonContentTypeMock.mockReturnValue(false);

    const response = await POST(new Request("http://localhost/api/wallet/topup", { method: "POST" }) as never);
    expect(response.status).toBe(415);
  });

  it("tops up wallet and respects header idempotency key", async () => {
    const response = await POST(
      new Request("http://localhost/api/wallet/topup", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-idempotency-key": "idem_topup_1",
        },
        body: JSON.stringify({ amountRub: 1500 }),
      }) as never,
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.ok).toBe(true);
    expect(mocks.topupWalletMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        amountCents: 150000,
        idempotencyKey: "idem_topup_1",
      }),
    );
  });
});


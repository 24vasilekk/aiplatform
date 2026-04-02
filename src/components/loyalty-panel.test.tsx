import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoyaltyPanel } from "@/components/loyalty-panel";

describe("LoyaltyPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows empty states when there are no loyalty operations", () => {
    render(
      <LoyaltyPanel
        initialSnapshot={{
          userId: "u1",
          pointsBalance: 0,
          lifetimeEarnedPoints: 0,
          lifetimeRedeemedPoints: 0,
          nextPointsExpirationAt: null,
          nextExpiringPoints: 0,
          rules: {
            pointsPerCourseCompletion: 1200,
            pointsLifetimeDays: 180,
            discountValuePerPointCents: 1,
            maxDiscountPercent: 30,
            minOrderAmountCents: 50000,
            minPayableAmountCents: 10000,
            maxPointsPerOrder: 70000,
          },
          transactions: [],
        }}
        initialQuotes={{
          math_only: {
            orderAmountCents: 99000,
            requestedPoints: null,
            availablePoints: 0,
            maxDiscountCents: 0,
            discountCents: 0,
            pointsToSpend: 0,
            finalAmountCents: 99000,
            reason: "NO_POINTS_AVAILABLE",
            rules: {
              pointsPerCourseCompletion: 1200,
              pointsLifetimeDays: 180,
              discountValuePerPointCents: 1,
              maxDiscountPercent: 30,
              minOrderAmountCents: 50000,
              minPayableAmountCents: 10000,
              maxPointsPerOrder: 70000,
            },
          },
          bundle_2: {
            orderAmountCents: 158400,
            requestedPoints: null,
            availablePoints: 0,
            maxDiscountCents: 0,
            discountCents: 0,
            pointsToSpend: 0,
            finalAmountCents: 158400,
            reason: "NO_POINTS_AVAILABLE",
            rules: {
              pointsPerCourseCompletion: 1200,
              pointsLifetimeDays: 180,
              discountValuePerPointCents: 1,
              maxDiscountPercent: 30,
              minOrderAmountCents: 50000,
              minPayableAmountCents: 10000,
              maxPointsPerOrder: 70000,
            },
          },
          all_access: {
            orderAmountCents: 149000,
            requestedPoints: null,
            availablePoints: 0,
            maxDiscountCents: 0,
            discountCents: 0,
            pointsToSpend: 0,
            finalAmountCents: 149000,
            reason: "NO_POINTS_AVAILABLE",
            rules: {
              pointsPerCourseCompletion: 1200,
              pointsLifetimeDays: 180,
              discountValuePerPointCents: 1,
              maxDiscountPercent: 30,
              minOrderAmountCents: 50000,
              minPayableAmountCents: 10000,
              maxPointsPerOrder: 70000,
            },
          },
        }}
      />,
    );

    expect(screen.getByText("Операций лояльности пока нет. Завершите курс, чтобы получить баллы.")).toBeInTheDocument();
    expect(screen.getByText("Активных баллов с ограничением срока действия пока нет.")).toBeInTheDocument();
  });

  it("refreshes snapshot and forecast from API", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            userId: "u1",
            pointsBalance: 1200,
            lifetimeEarnedPoints: 1200,
            lifetimeRedeemedPoints: 0,
            nextPointsExpirationAt: "2026-10-01T00:00:00.000Z",
            nextExpiringPoints: 1200,
            rules: {
              pointsPerCourseCompletion: 1200,
              pointsLifetimeDays: 180,
              discountValuePerPointCents: 1,
              maxDiscountPercent: 30,
              minOrderAmountCents: 50000,
              minPayableAmountCents: 10000,
              maxPointsPerOrder: 70000,
            },
            transactions: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            quote: {
              orderAmountCents: 149000,
              requestedPoints: null,
              availablePoints: 1200,
              maxDiscountCents: 1200,
              discountCents: 1200,
              pointsToSpend: 1200,
              finalAmountCents: 147800,
              reason: null,
              rules: {
                pointsPerCourseCompletion: 1200,
                pointsLifetimeDays: 180,
                discountValuePerPointCents: 1,
                maxDiscountPercent: 30,
                minOrderAmountCents: 50000,
                minPayableAmountCents: 10000,
                maxPointsPerOrder: 70000,
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    render(
      <LoyaltyPanel
        initialSnapshot={{
          userId: "u1",
          pointsBalance: 0,
          lifetimeEarnedPoints: 0,
          lifetimeRedeemedPoints: 0,
          nextPointsExpirationAt: null,
          nextExpiringPoints: 0,
          rules: {
            pointsPerCourseCompletion: 1200,
            pointsLifetimeDays: 180,
            discountValuePerPointCents: 1,
            maxDiscountPercent: 30,
            minOrderAmountCents: 50000,
            minPayableAmountCents: 10000,
            maxPointsPerOrder: 70000,
          },
          transactions: [],
        }}
        initialQuotes={{
          math_only: {
            orderAmountCents: 99000,
            requestedPoints: null,
            availablePoints: 0,
            maxDiscountCents: 0,
            discountCents: 0,
            pointsToSpend: 0,
            finalAmountCents: 99000,
            reason: "NO_POINTS_AVAILABLE",
            rules: {
              pointsPerCourseCompletion: 1200,
              pointsLifetimeDays: 180,
              discountValuePerPointCents: 1,
              maxDiscountPercent: 30,
              minOrderAmountCents: 50000,
              minPayableAmountCents: 10000,
              maxPointsPerOrder: 70000,
            },
          },
          bundle_2: {
            orderAmountCents: 158400,
            requestedPoints: null,
            availablePoints: 0,
            maxDiscountCents: 0,
            discountCents: 0,
            pointsToSpend: 0,
            finalAmountCents: 158400,
            reason: "NO_POINTS_AVAILABLE",
            rules: {
              pointsPerCourseCompletion: 1200,
              pointsLifetimeDays: 180,
              discountValuePerPointCents: 1,
              maxDiscountPercent: 30,
              minOrderAmountCents: 50000,
              minPayableAmountCents: 10000,
              maxPointsPerOrder: 70000,
            },
          },
          all_access: {
            orderAmountCents: 149000,
            requestedPoints: null,
            availablePoints: 0,
            maxDiscountCents: 0,
            discountCents: 0,
            pointsToSpend: 0,
            finalAmountCents: 149000,
            reason: "NO_POINTS_AVAILABLE",
            rules: {
              pointsPerCourseCompletion: 1200,
              pointsLifetimeDays: 180,
              discountValuePerPointCents: 1,
              maxDiscountPercent: 30,
              minOrderAmountCents: 50000,
              minPayableAmountCents: 10000,
              maxPointsPerOrder: 70000,
            },
          },
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Обновить" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/loyalty?take=30", { cache: "no-store" });
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "/api/loyalty/quote",
        expect.objectContaining({
          method: "POST",
          headers: { "content-type": "application/json" },
        }),
      );
    });

    expect(await screen.findByText("Данные лояльности обновлены.")).toBeInTheDocument();
    expect(screen.getByText("1200")).toBeInTheDocument();
  });
});

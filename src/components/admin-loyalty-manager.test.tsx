import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminLoyaltyManager } from "@/components/admin-loyalty-manager";

describe("AdminLoyaltyManager", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads rules and shows empty states", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          rules: {
            pointsPerCourseCompletion: 1200,
            pointsLifetimeDays: 180,
            discountValuePerPointCents: 1,
            maxDiscountPercent: 30,
            minOrderAmountCents: 50000,
            minPayableAmountCents: 10000,
            maxPointsPerOrder: 70000,
          },
          accounts: [],
          transactions: [],
          auditLogs: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<AdminLoyaltyManager />);

    expect(await screen.findByText("Текущие правила")).toBeInTheDocument();
    expect(screen.getByText("Записей нет по выбранным фильтрам.")).toBeInTheDocument();
  });

  it("sends manual adjustment", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            rules: {
              pointsPerCourseCompletion: 1200,
              pointsLifetimeDays: 180,
              discountValuePerPointCents: 1,
              maxDiscountPercent: 30,
              minOrderAmountCents: 50000,
              minPayableAmountCents: 10000,
              maxPointsPerOrder: 70000,
            },
            accounts: [],
            transactions: [],
            auditLogs: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            rules: {
              pointsPerCourseCompletion: 1200,
              pointsLifetimeDays: 180,
              discountValuePerPointCents: 1,
              maxDiscountPercent: 30,
              minOrderAmountCents: 50000,
              minPayableAmountCents: 10000,
              maxPointsPerOrder: 70000,
            },
            accounts: [],
            transactions: [],
            auditLogs: [],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    render(<AdminLoyaltyManager />);
    await screen.findByText("Текущие правила");

    const userIdInputs = screen.getAllByPlaceholderText("userId");
    await user.type(userIdInputs[1], "u1");
    await user.clear(screen.getByPlaceholderText("Баллы"));
    await user.type(screen.getByPlaceholderText("Баллы"), "250");
    await user.click(screen.getByRole("button", { name: "Применить" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/admin/loyalty",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "content-type": "application/json",
            "x-idempotency-key": expect.stringContaining("admin_loyalty_"),
          }),
        }),
      );
    });
  });
});

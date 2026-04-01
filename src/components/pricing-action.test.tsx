import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  useRouterMock: vi.fn(),
}));

vi.mock("next/navigation", async () => {
  const actual = await vi.importActual<typeof import("next/navigation")>("next/navigation");
  return {
    ...actual,
    useRouter: mocks.useRouterMock,
  };
});

import { PricingAction } from "@/components/pricing-action";

describe("PricingAction", () => {
  beforeEach(() => {
    mocks.refreshMock.mockReset();
    mocks.useRouterMock.mockReturnValue({
      refresh: mocks.refreshMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends JSON checkout request and refreshes page on success", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Счет создан",
          payment: { checkoutUrl: null },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    );

    render(<PricingAction />);
    await user.click(screen.getByRole("button", { name: "Оплатить" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/billing/create-checkout",
        expect.objectContaining({
          method: "POST",
          headers: { "content-type": "application/json" },
        }),
      );
      expect(mocks.refreshMock).toHaveBeenCalled();
    });
  });

  it("shows payment error message", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "Ошибка оплаты",
        }),
        { status: 500, headers: { "content-type": "application/json" } },
      ),
    );

    render(<PricingAction />);
    await user.click(screen.getByRole("button", { name: "Оплатить" }));

    expect(await screen.findByText("Ошибка оплаты")).toBeInTheDocument();
  });
});


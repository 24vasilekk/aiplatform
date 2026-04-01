import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WalletPanel } from "@/components/wallet-panel";

describe("WalletPanel", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows validation error for invalid topup amount", async () => {
    const user = userEvent.setup();
    render(
      <WalletPanel
        initialSnapshot={{
          wallet: {
            id: "w1",
            userId: "u1",
            balanceCents: 0,
            currency: "RUB",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          transactions: [],
          totalTransactions: 0,
        }}
      />,
    );

    await user.clear(screen.getByPlaceholderText("Сумма в ₽"));
    await user.type(screen.getByPlaceholderText("Сумма в ₽"), "0");
    await user.click(screen.getByRole("button", { name: "Пополнить баланс" }));

    expect(await screen.findByText("Введите корректную сумму пополнения.")).toBeInTheDocument();
  });

  it("submits topup and updates status", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            wallet: {
              id: "w1",
              userId: "u1",
              balanceCents: 50000,
              currency: "RUB",
              createdAt: "2026-04-01T00:00:00.000Z",
              updatedAt: "2026-04-01T00:00:00.000Z",
            },
            transactions: [],
            totalTransactions: 0,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    render(
      <WalletPanel
        initialSnapshot={{
          wallet: {
            id: "w1",
            userId: "u1",
            balanceCents: 0,
            currency: "RUB",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
          },
          transactions: [],
          totalTransactions: 0,
        }}
      />,
    );

    await user.clear(screen.getByPlaceholderText("Сумма в ₽"));
    await user.type(screen.getByPlaceholderText("Сумма в ₽"), "500");
    await user.click(screen.getByRole("button", { name: "Пополнить баланс" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/wallet/topup",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "content-type": "application/json",
            "x-idempotency-key": expect.stringContaining("wallet_topup_"),
          }),
        }),
      );
    });
    expect(await screen.findByText("Баланс пополнен.")).toBeInTheDocument();
  });
});


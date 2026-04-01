import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pushMock: vi.fn(),
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

vi.mock("@/components/telegram-login-widget", () => ({
  TelegramLoginWidget: () => <div data-testid="telegram-widget" />,
}));

import { AuthForm } from "@/components/auth-form";

describe("AuthForm", () => {
  beforeEach(() => {
    mocks.pushMock.mockReset();
    mocks.refreshMock.mockReset();
    mocks.useRouterMock.mockReturnValue({
      push: mocks.pushMock,
      refresh: mocks.refreshMock,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("redirects to dashboard after successful login", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ user: { id: "u1" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    render(<AuthForm mode="login" />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "student@example.com");
    await user.type(screen.getByPlaceholderText("Введите пароль"), "secret123");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    await waitFor(() => {
      expect(mocks.pushMock).toHaveBeenCalledWith("/dashboard");
      expect(mocks.refreshMock).toHaveBeenCalled();
    });
  });

  it("shows account exists message for register flow", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ code: "account_exists" }), {
        status: 409,
        headers: { "content-type": "application/json" },
      }),
    );

    render(<AuthForm mode="register" />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "student@example.com");
    await user.type(screen.getByPlaceholderText("Минимум 8 символов"), "secret123");
    await user.click(screen.getByRole("button", { name: "Создать аккаунт" }));

    expect(await screen.findByText(/Аккаунт уже существует\. Войдите через email\/пароль/i)).toBeInTheDocument();
  });

  it("shows network error message", async () => {
    const user = userEvent.setup();
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network"));

    render(<AuthForm mode="login" />);

    await user.type(screen.getByPlaceholderText("you@example.com"), "student@example.com");
    await user.type(screen.getByPlaceholderText("Введите пароль"), "secret123");
    await user.click(screen.getByRole("button", { name: "Войти" }));

    expect(await screen.findByText("Сетевая ошибка. Попробуйте еще раз.")).toBeInTheDocument();
  });
});

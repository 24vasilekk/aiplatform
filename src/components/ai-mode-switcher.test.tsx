import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AiModeSwitcher } from "@/components/ai-mode-switcher";

describe("AiModeSwitcher", () => {
  it("switches mode on click", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();

    render(<AiModeSwitcher mode="default" onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: /похожая задача/i }));

    expect(onChange).toHaveBeenCalledWith("similar_task");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { InputBar } from "./InputBar";

describe("InputBar", () => {
  it("uses a compact icon-only send button inside the composer", () => {
    render(
      <InputBar
        disabled={false}
        draft="Hello"
        onDraftChange={() => undefined}
        onSend={vi.fn()}
      />
    );

    const composer = screen.getByTestId("message-composer");
    const sendButton = screen.getByRole("button", { name: "Send message" });

    expect(composer).toContainElement(screen.getByTestId("input-message"));
    expect(composer).toContainElement(sendButton);
    expect(sendButton).toHaveClass("size-10");
    expect(sendButton).toHaveTextContent("");
  });

  it("keeps the composer footer row at the shared 72px height", () => {
    render(
      <InputBar
        disabled={false}
        draft=""
        onDraftChange={() => undefined}
        onSend={vi.fn()}
      />
    );

    expect(screen.getByTestId("message-composer-row")).toHaveClass("h-[72px]");
  });
});

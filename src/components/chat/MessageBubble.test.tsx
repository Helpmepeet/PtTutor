import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MessageBubble } from "./MessageBubble";
import type { RoleplayMessage } from "@/lib/types";

function renderBubble(message: RoleplayMessage, rewriteOpen = false) {
  return render(
    <MessageBubble
      activeMarker={null}
      actorLabel="Barista"
      message={message}
      rewriteOpen={rewriteOpen}
      onAskTeacher={() => undefined}
      onMarkerClick={() => undefined}
      onRetry={vi.fn()}
      onRewriteToggle={() => undefined}
      onSkipActor={vi.fn()}
    />
  );
}

describe("MessageBubble", () => {
  it("uses the current scenario actor label for actor messages", () => {
    const message: RoleplayMessage = {
      id: "actor-1",
      session_id: "session-1",
      role: "actor",
      content: "Hi there. How can I help you today?",
      created_at: "2026-05-26T00:00:00.000Z"
    };

    render(
      <MessageBubble
        activeMarker={null}
        actorLabel="Bank Staff"
        message={message}
        rewriteOpen={false}
        onAskTeacher={() => undefined}
        onMarkerClick={() => undefined}
        onRetry={vi.fn()}
        onRewriteToggle={() => undefined}
        onSkipActor={vi.fn()}
      />
    );

    expect(screen.getByText("Bank Staff")).toBeInTheDocument();
    expect(screen.queryByText("Barista")).not.toBeInTheDocument();
  });

  it("hides rewrite UI when the clean rewrite matches the user message", () => {
    const message: RoleplayMessage = {
      id: "user-1",
      session_id: "session-1",
      role: "user",
      content: "Can I get a latte?",
      created_at: "2026-05-26T00:00:00.000Z",
      reviewer_output: {
        markers: [],
        native_rewrite: "Can I get a latte?"
      },
      reviewer_status: "succeeded"
    };

    renderBubble(message);

    expect(screen.queryByTestId("btn-rewrite-user-1")).not.toBeInTheDocument();
    expect(screen.queryByText("Sounds natural")).not.toBeInTheDocument();
  });

  it("keeps the rewrite button when the reviewer suggests a different native sentence", () => {
    const message: RoleplayMessage = {
      id: "user-2",
      session_id: "session-1",
      role: "user",
      content: "I want order coffee",
      created_at: "2026-05-26T00:00:00.000Z",
      reviewer_output: {
        markers: [],
        native_rewrite: "I'd like to order a coffee."
      },
      reviewer_status: "succeeded"
    };

    renderBubble(message, true);

    expect(screen.getByTestId("btn-rewrite-user-2")).toBeInTheDocument();
    expect(screen.getByTestId("card-rewrite-user-2")).toHaveTextContent(
      "I'd like to order a coffee."
    );
    expect(screen.queryByText("Sounds natural")).not.toBeInTheDocument();
  });
});

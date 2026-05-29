import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "./Sidebar";
import type { RoleplaySession, Scenario } from "@/lib/types";

const scenario: Scenario = {
  id: "ordering_coffee",
  name: "Ordering Coffee",
  description: "Practice ordering at a cafe",
  category: "daily",
  icon: "☕",
  feedback_mode: "standard",
  source: "built_in",
  starter: "actor",
  actor_role: "A barista",
  actor_setting: "A cafe",
  actor_personality: "Friendly",
  scenario_context: "Order coffee.",
  user_role: "A customer",
  starter_instruction: "Greet the customer."
};

const session: RoleplaySession = {
  id: "session-1",
  user_id: "user-1",
  scenario_id: "ordering_coffee",
  title: "Coffee chat",
  started_at: "2026-05-26T00:00:00.000Z",
  last_message_at: "2026-05-26T00:00:01.000Z",
  created_at: "2026-05-26T00:00:00.000Z",
  actor_level: "standard",
  reviewer_feedback_mode: "standard",
  latest_user_message: "Can I get a latte?"
};

describe("Sidebar", () => {
  it("shows the latest user message under the session title", () => {
    render(
      <Sidebar
        activeSessionId="session-1"
        busy={false}
        draftTitle="Coffee chat"
        scenarios={[scenario]}
        sessions={[session]}
        user={{ label: "Local demo", name: "Local Demo" }}
        onDeleteSession={() => undefined}
        onNewChat={() => undefined}
        onRenameSession={() => undefined}
        onSelectSession={() => undefined}
        onSignOut={() => undefined}
        onTitleChange={() => undefined}
      />
    );

    expect(screen.getByText("Can I get a latte?")).toBeInTheDocument();
  });

  it("opens session actions from the active row burger", async () => {
    const user = userEvent.setup();
    const onDeleteSession = vi.fn();
    render(
      <Sidebar
        activeSessionId="session-1"
        busy={false}
        draftTitle="Coffee chat"
        scenarios={[scenario]}
        sessions={[session]}
        user={{ label: "Local demo", name: "Local Demo" }}
        onDeleteSession={onDeleteSession}
        onNewChat={() => undefined}
        onRenameSession={() => undefined}
        onSelectSession={() => undefined}
        onSignOut={() => undefined}
        onTitleChange={() => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: /session actions/i }));

    expect(screen.getByLabelText(/chat title/i)).toHaveValue("Coffee chat");
    await user.click(screen.getByRole("button", { name: /delete chat/i }));
    expect(onDeleteSession).toHaveBeenCalled();
  });

  it("uses an overflow icon for active session actions", () => {
    render(
      <Sidebar
        activeSessionId="session-1"
        busy={false}
        draftTitle="Coffee chat"
        scenarios={[scenario]}
        sessions={[session]}
        user={{ label: "Local demo", name: "Local Demo" }}
        onDeleteSession={() => undefined}
        onNewChat={() => undefined}
        onRenameSession={() => undefined}
        onSelectSession={() => undefined}
        onSignOut={() => undefined}
        onTitleChange={() => undefined}
      />
    );

    const actions = screen.getByRole("button", { name: /session actions/i });

    expect(actions.querySelector(".lucide-ellipsis")).toBeTruthy();
    expect(actions.querySelector(".lucide-menu")).toBeNull();
  });

  it("closes session actions when clicking outside the menu", async () => {
    const user = userEvent.setup();
    render(
      <Sidebar
        activeSessionId="session-1"
        busy={false}
        draftTitle="Coffee chat"
        scenarios={[scenario]}
        sessions={[session]}
        user={{ label: "Local demo", name: "Local Demo" }}
        onDeleteSession={() => undefined}
        onNewChat={() => undefined}
        onRenameSession={() => undefined}
        onSelectSession={() => undefined}
        onSignOut={() => undefined}
        onTitleChange={() => undefined}
      />
    );

    await user.click(screen.getByRole("button", { name: /session actions/i }));
    expect(screen.getByLabelText(/chat title/i)).toBeInTheDocument();

    fireEvent.pointerDown(document.body);

    expect(screen.queryByLabelText(/chat title/i)).not.toBeInTheDocument();
  });

  it("uses the same footer height as the chat composer row", () => {
    render(
      <Sidebar
        activeSessionId="session-1"
        busy={false}
        draftTitle="Coffee chat"
        scenarios={[scenario]}
        sessions={[session]}
        user={{ label: "Local demo", name: "Local Demo" }}
        onDeleteSession={() => undefined}
        onNewChat={() => undefined}
        onRenameSession={() => undefined}
        onSelectSession={() => undefined}
        onSignOut={() => undefined}
        onTitleChange={() => undefined}
      />
    );

    expect(screen.getByRole("button", { name: /sign out/i })).toHaveClass(
      "h-[72px]"
    );
  });
});

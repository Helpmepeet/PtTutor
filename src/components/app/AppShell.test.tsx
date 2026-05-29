import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { Scenario, SessionDetail } from "@/lib/types";
import { AppShell } from "./AppShell";

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

const session: SessionDetail = {
  id: "session-1",
  user_id: "user-1",
  scenario_id: "ordering_coffee",
  title: "Coffee chat",
  started_at: "2026-05-26T00:00:00.000Z",
  last_message_at: "2026-05-26T00:00:01.000Z",
  created_at: "2026-05-26T00:00:00.000Z",
  actor_level: "standard",
  reviewer_feedback_mode: "standard",
  messages: [
    {
      id: "actor-1",
      session_id: "session-1",
      role: "actor",
      content: "Hi there. What can I get for you?",
      created_at: "2026-05-26T00:00:00.000Z"
    }
  ],
  teacher_messages: []
};

beforeAll(() => {
  HTMLElement.prototype.scrollTo = vi.fn();
});

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

function rect({
  bottom,
  height,
  left,
  right,
  top,
  width
}: {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}): DOMRect {
  return {
    bottom,
    height,
    left,
    right,
    top,
    width,
    x: left,
    y: top,
    toJSON: () => ({})
  } as DOMRect;
}

function renderShell() {
  render(
    <AppShell
      activeScenario={scenario}
      activeSession={session}
      busy={false}
      deleteConfirmOpen={false}
      draftTitle="Coffee chat"
      error=""
      messageDraft=""
      mode="chat"
      scenarios={[scenario]}
      sessions={[session]}
      streamingActorContent={null}
      streamingNarrations={[]}
      streamingTeacherContent={null}
      teacherDraft=""
      teacherOpen={false}
      user={{ label: "Local demo", name: "Local Demo" }}
      onCancelDelete={() => undefined}
      onCancelScenarioCreate={() => undefined}
      onChangeReviewerMode={() => undefined}
      onConfirmDelete={() => undefined}
      onCreateCustomScenario={() => undefined}
      onCreateSession={() => undefined}
      onDeleteRequest={() => undefined}
      onDraftScenario={vi.fn()}
      onMessageDraftChange={() => undefined}
      onNewChat={() => undefined}
      onRename={() => undefined}
      onRetry={() => undefined}
      onSelectSession={() => undefined}
      onAskTeacher={() => undefined}
      onSendMessage={() => undefined}
      onSendStarter={() => undefined}
      onSignOut={() => undefined}
      onSkipActor={() => undefined}
      onStartScenarioCreate={() => undefined}
      onTeacherDraftChange={() => undefined}
      onTeacherOpenChange={() => undefined}
      onTeacherSend={() => undefined}
      onTitleChange={() => undefined}
    />
  );
}

describe("AppShell", () => {
  it("uses the message log as the teacher launcher drag boundary", () => {
    renderShell();

    expect(document.querySelector("[data-teacher-launcher-bounds]")).toBe(
      screen.getByRole("log")
    );
  });

  it("clamps a stored teacher launcher position after the message log mounts", async () => {
    window.localStorage.setItem(
      "pttutor.teacherLauncherPosition",
      JSON.stringify({ x: 16, y: 0 })
    );
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function getBoundingClientRect(this: HTMLElement) {
        if (this.hasAttribute("data-teacher-launcher-bounds")) {
          return rect({
            bottom: 791,
            height: 735,
            left: 240,
            right: 859,
            top: 56,
            width: 619
          });
        }

        return rect({
          bottom: 0,
          height: 0,
          left: 0,
          right: 0,
          top: 0,
          width: 0
        });
      }
    );

    renderShell();

    await waitFor(() =>
      expect(screen.getByTestId("btn-teacher")).toHaveStyle({
        left: "256px",
        top: "72px"
      })
    );
  });
});

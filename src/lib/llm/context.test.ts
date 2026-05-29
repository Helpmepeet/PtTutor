import { describe, expect, it } from "vitest";
import { getScenarioById } from "@/lib/scenarios";
import type { RoleplayMessage, TeacherMessage } from "@/lib/types";
import {
  buildActorInput,
  buildReviewerInput,
  buildTeacherInput
} from "./context";
import { reviewerSystemPrompt } from "./prompts";

const scenario = getScenarioById("ordering_coffee")!;

const messages: RoleplayMessage[] = [
  {
    id: "actor-1",
    session_id: "session-1",
    role: "actor",
    content: "Hi there! What can I get for you?",
    created_at: "2026-05-26T00:00:00.000Z"
  },
  {
    id: "user-1",
    session_id: "session-1",
    role: "user",
    content: "I want order coffee",
    created_at: "2026-05-26T00:00:01.000Z",
    reviewer_output: {
      markers: [
        {
          id: "m1",
          span_text: "want order",
          category: "grammar",
          severity: "major",
          wrong: "want order",
          fix: "would like to order",
          why: "Use a polite request form.",
          alternatives: ["Can I get a coffee?"]
        }
      ],
      native_rewrite: "I'd like to order coffee."
    }
  }
];

const teacherMessages: TeacherMessage[] = [
  {
    id: "teacher-user-1",
    session_id: "session-1",
    role: "user",
    content: "Why was this marked?",
    created_at: "2026-05-26T00:00:02.000Z"
  }
];

describe("role context isolation", () => {
  it("keeps reviewer output and teacher chat out of Actor context", () => {
    const input = buildActorInput(scenario, messages);

    expect(input).toContain("I want order coffee");
    expect(input).not.toContain("Use a polite request form");
    expect(input).not.toContain("Why was this marked?");
  });

  it("reviews only the latest user message while using roleplay context", () => {
    const input = buildReviewerInput(scenario, messages, messages[1]);

    expect(input).toContain("Roleplay conversation so far");
    expect(input).toContain("Current user message to review: I want order coffee");
    expect(input).not.toContain("Why was this marked?");
    expect(input).not.toContain("Use a polite request form");
  });

  it("carries scenario feedback strictness into the reviewer instructions", () => {
    const prompt = reviewerSystemPrompt(scenario, "strict");

    expect(prompt).toContain("Strict feedback");
    expect(prompt).toContain("1-3");
  });

  it("gives Teacher roleplay, reviewer outputs, and prior teacher chat", () => {
    const input = buildTeacherInput({
      scenario,
      messages,
      teacherMessages,
      question: "Can you explain in Thai?"
    });

    expect(input).toContain("I want order coffee");
    expect(input).toContain("Use a polite request form");
    expect(input).toContain("Why was this marked?");
    expect(input).toContain("Can you explain in Thai?");
  });
});

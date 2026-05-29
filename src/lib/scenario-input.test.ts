import { describe, expect, it } from "vitest";
import { parseCreateScenarioInput } from "./scenario-input";

describe("custom scenario input", () => {
  it("normalizes user-created scenarios with safe defaults", () => {
    const input = parseCreateScenarioInput({
      name: "  Pharmacy visit  ",
      category: "daily",
      user_role: "A customer buying cold medicine",
      actor_role: "A pharmacist",
      actor_setting: "A neighborhood pharmacy",
      scenario_context: "The customer needs medicine for a sore throat.",
      starter: "actor"
    });

    expect(input).toMatchObject({
      name: "Pharmacy visit",
      description: "Practice Pharmacy visit",
      category: "daily",
      icon: "💬",
      feedback_mode: "standard",
      starter: "actor",
      actor_personality: "Natural, helpful, and realistic",
      starter_instruction:
        "Start the scenario naturally and invite the user to respond."
    });
  });

  it("rejects missing required scenario context", () => {
    expect(() =>
      parseCreateScenarioInput({
        name: "Pharmacy visit",
        category: "daily",
        user_role: "A customer"
      })
    ).toThrow("actor_role is required");
  });

  it("accepts the learner's feedback strictness preference", () => {
    const input = parseCreateScenarioInput({
      name: "Pharmacy visit",
      category: "daily",
      feedback_mode: "strict",
      user_role: "A customer buying cold medicine",
      actor_role: "A pharmacist",
      actor_setting: "A neighborhood pharmacy",
      scenario_context: "The customer needs medicine for a sore throat.",
      starter: "actor"
    });

    expect(input.feedback_mode).toBe("strict");
  });
});

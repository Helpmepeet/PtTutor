import { describe, expect, it } from "vitest";
import { getScenarioById, listScenarios } from "./scenarios";

describe("scenario catalog", () => {
  it("starts the MVP with a useful starter catalog", () => {
    const scenarios = listScenarios();

    expect(scenarios.length).toBeGreaterThanOrEqual(6);
    expect(scenarios.map((scenario) => scenario.id)).toEqual(
      expect.arrayContaining([
        "ordering_coffee",
        "hotel_check_in",
        "team_meeting_update",
        "small_talk_neighbor"
      ])
    );
    expect(scenarios.every((scenario) => scenario.source === "built_in")).toBe(
      true
    );
  });

  it("exposes the scenario context needed by all LLM roles", () => {
    const scenario = getScenarioById("ordering_coffee");

    expect(scenario?.actor_role).toContain("barista");
    expect(scenario?.actor_setting).toContain("The Daily Grind");
    expect(scenario?.scenario_context).toContain("latte");
    expect(scenario?.starter_instruction).toContain("Greet");
  });
});

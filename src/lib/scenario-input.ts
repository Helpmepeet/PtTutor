import { z, ZodError } from "zod";
import type { Scenario } from "./types";

export type CreateScenarioInput = Pick<
  Scenario,
  | "name"
  | "category"
  | "starter"
  | "actor_role"
  | "actor_setting"
  | "scenario_context"
  | "user_role"
> &
  Partial<
    Pick<
      Scenario,
      | "description"
      | "icon"
      | "feedback_mode"
      | "actor_personality"
      | "starter_instruction"
    >
  >;

export type NormalizedScenarioInput = Omit<
  Scenario,
  "id" | "source" | "user_id" | "created_at"
>;

export type DraftScenarioInput = {
  prompt: string;
};

export type DraftScenarioResponse = {
  scenario: NormalizedScenarioInput;
};

const createScenarioSchema = z.object({
  name: z.string().trim().min(1, "name is required").max(80),
  description: z.string().trim().max(160).optional(),
  category: z.enum(["daily", "work", "social"]),
  icon: z.string().trim().max(8).optional(),
  feedback_mode: z.enum(["light", "standard", "strict"]).default("standard"),
  starter: z.enum(["actor", "user"]).default("actor"),
  actor_role: z.string().trim().min(1, "actor_role is required").max(180),
  actor_setting: z.string().trim().min(1, "actor_setting is required").max(220),
  actor_personality: z.string().trim().max(180).optional(),
  scenario_context: z
    .string()
    .trim()
    .min(1, "scenario_context is required")
    .max(800),
  user_role: z.string().trim().min(1, "user_role is required").max(180),
  starter_instruction: z.string().trim().max(240).optional()
});

export function parseCreateScenarioInput(raw: unknown): NormalizedScenarioInput {
  let parsed: z.infer<typeof createScenarioSchema>;
  try {
    parsed = createScenarioSchema.parse(raw);
  } catch (error) {
    if (error instanceof ZodError) {
      const firstIssue = error.issues[0];
      const field = firstIssue?.path.join(".");
      if (field && firstIssue?.code === "invalid_type") {
        throw new Error(`${field} is required`);
      }
    }
    throw error;
  }

  return {
    name: parsed.name,
    description: parsed.description || `Practice ${parsed.name}`,
    category: parsed.category,
    icon: parsed.icon || "💬",
    feedback_mode: parsed.feedback_mode,
    starter: parsed.starter,
    actor_role: parsed.actor_role,
    actor_setting: parsed.actor_setting,
    actor_personality:
      parsed.actor_personality || "Natural, helpful, and realistic",
    scenario_context: parsed.scenario_context,
    user_role: parsed.user_role,
    starter_instruction:
      parsed.starter_instruction ||
      (parsed.starter === "actor"
        ? "Start the scenario naturally and invite the user to respond."
        : "Wait for the user to begin, then respond naturally in character.")
  };
}

import { parseCreateScenarioInput, type NormalizedScenarioInput } from "@/lib/scenario-input";
import { buildActorInput, buildReviewerInput, buildTeacherInput } from "@/lib/llm/context";
import {
  actorSystemPrompt,
  reviewerSystemPrompt,
  scenarioDraftSystemPrompt,
  teacherSystemPrompt
} from "@/lib/llm/prompts";
import { resolveReviewerOutput, reviewerJsonSchema } from "@/lib/reviewer";
import type {
  ActorLevel,
  RoleplayMessage,
  Scenario,
  ScenarioFeedbackMode,
  TeacherMessage
} from "@/lib/types";
import { codexStructured, codexText, codexTextStream, codexTextStreamWithTools } from "./codex/client";
import { ACTOR_TOOLS, executeNarrateCall, extractInlineNarrations } from "./actor-tools";
import { serverEnv } from "./env";

const scenarioDraftJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "description",
    "category",
    "icon",
    "starter",
    "actor_role",
    "actor_setting",
    "actor_personality",
    "scenario_context",
    "user_role",
    "starter_instruction"
  ],
  properties: {
    name: { type: "string" },
    description: { type: "string" },
    category: { type: "string", enum: ["daily", "work", "social"] },
    icon: { type: "string" },
    starter: { type: "string", enum: ["actor", "user"] },
    actor_role: { type: "string" },
    actor_setting: { type: "string" },
    actor_personality: { type: "string" },
    scenario_context: { type: "string" },
    user_role: { type: "string" },
    starter_instruction: { type: "string" }
  }
} as const;

export async function generateScenarioDraft(
  userId: string,
  prompt: string
): Promise<NormalizedScenarioInput> {
  const raw = await codexStructured({
    userId,
    model: serverEnv.TEACHER_MODEL,
    system: scenarioDraftSystemPrompt(),
    input: prompt,
    textFormat: {
      type: "json_schema",
      name: "scenario_draft",
      strict: true,
      schema: scenarioDraftJsonSchema as unknown as Record<string, unknown>
    }
  });

  return parseCreateScenarioInput(JSON.parse(raw));
}

export async function generateActorStarter(
  userId: string,
  scenario: Scenario,
  actorLevel: ActorLevel = "standard"
): Promise<string> {
  return codexText({
    userId,
    model: serverEnv.ACTOR_MODEL,
    system: actorSystemPrompt(scenario, actorLevel),
    input: `Start the scenario now. ${scenario.starter_instruction}`
  });
}

export async function generateReviewerOutput(
  userId: string,
  scenario: Scenario,
  messages: RoleplayMessage[],
  latestUserMessage: RoleplayMessage,
  feedbackMode: ScenarioFeedbackMode = "standard"
) {
  const raw = await codexStructured({
    userId,
    model: serverEnv.REVIEWER_MODEL,
    system: reviewerSystemPrompt(scenario, feedbackMode),
    input: buildReviewerInput(scenario, messages, latestUserMessage),
    textFormat: {
      type: "json_schema",
      name: "reviewer_output",
      strict: true,
      schema: reviewerJsonSchema as unknown as Record<string, unknown>
    }
  });

  return resolveReviewerOutput(latestUserMessage.content, JSON.parse(raw));
}

export function generateTeacherReply({
  userId,
  scenario,
  messages,
  teacherMessages,
  question
}: {
  userId: string;
  scenario: Scenario;
  messages: RoleplayMessage[];
  teacherMessages: TeacherMessage[];
  question: string;
}): Promise<string> {
  return codexText({
    userId,
    model: serverEnv.TEACHER_MODEL,
    system: teacherSystemPrompt(),
    input: buildTeacherInput({ scenario, messages, teacherMessages, question })
  });
}

export async function generateActorReply(
  userId: string,
  scenario: Scenario,
  messages: RoleplayMessage[],
  actorLevel: ActorLevel = "standard"
): Promise<{ content: string; narrations: string[] }> {
  let content = "";
  const narrations: string[] = [];
  for await (const event of generateActorReplyStream(userId, scenario, messages, actorLevel)) {
    if (event.type === "narration") narrations.push(event.text);
    else content += event.text;
  }
  return { content, narrations };
}

// Yields { type: "narration", text } then { type: "delta", text } tokens.
export type ActorStreamEvent =
  | { type: "narration"; text: string }
  | { type: "delta"; text: string };

export async function* generateActorReplyStream(
  userId: string,
  scenario: Scenario,
  messages: RoleplayMessage[],
  actorLevel: ActorLevel = "standard"
): AsyncGenerator<ActorStreamEvent> {
  const events = codexTextStreamWithTools({
    userId,
    model: serverEnv.ACTOR_MODEL,
    system: actorSystemPrompt(scenario, actorLevel),
    input: buildActorInput(scenario, messages),
    tools: ACTOR_TOOLS,
    onToolCall: (name, args) => {
      if (name === "narrate") return executeNarrateCall(args);
      return "";
    }
  });

  // Buffer spoken text so we can strip inline *...* stage directions (which the
  // model sometimes writes instead of calling the narrate tool) before emitting.
  // Tool-call narrations still stream live. Actor replies are short, so holding
  // the dialogue until the stream completes is fine.
  let buffered = "";
  for await (const event of events) {
    if (event.type === "tool_call" && event.name === "narrate") {
      const text = typeof event.args.text === "string" ? event.args.text.trim() : "";
      if (text) yield { type: "narration", text };
    } else if (event.type === "delta") {
      buffered += event.text;
    }
  }

  const { content, narrations } = extractInlineNarrations(buffered);
  for (const text of narrations) {
    yield { type: "narration", text };
  }
  if (content) yield { type: "delta", text: content };
}

export function generateTeacherReplyStream({
  userId,
  scenario,
  messages,
  teacherMessages,
  question
}: {
  userId: string;
  scenario: Scenario;
  messages: RoleplayMessage[];
  teacherMessages: TeacherMessage[];
  question: string;
}): AsyncGenerator<string> {
  return codexTextStream({
    userId,
    model: serverEnv.TEACHER_MODEL,
    system: teacherSystemPrompt(),
    input: buildTeacherInput({ scenario, messages, teacherMessages, question })
  });
}


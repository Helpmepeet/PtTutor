import type {
  RoleplayMessage,
  Scenario,
  TeacherMessage
} from "@/lib/types";

function roleplayTranscript(messages: RoleplayMessage[]): string {
  return messages
    .map((message) => {
      const label = message.role === "actor" ? "Actor" : "User";
      const narrationLines = (message.narrations ?? [])
        .map(n => `[Scene]: ${n}`)
        .join("\n");
      const dialogueLine = `[${label}]: ${message.content}`;
      return narrationLines ? `${narrationLines}\n${dialogueLine}` : dialogueLine;
    })
    .join("\n");
}

function reviewerTranscript(messages: RoleplayMessage[]): string {
  return messages
    .filter((message) => message.role === "user" && message.reviewer_output)
    .map((message) => {
      const output = message.reviewer_output!;
      const markers = output.markers
        .map(
          (marker) =>
            `- Issue: "${marker.wrong}" -> "${marker.fix}"\n  Category: ${marker.category} (${marker.severity})\n  Why: ${marker.why}\n  Alternatives: ${marker.alternatives.join(", ")}`
        )
        .join("\n");
      return `Message "${message.content}":\n${markers}\n- Native rewrite: ${output.native_rewrite}`;
    })
    .join("\n\n");
}

function teacherTranscript(messages: TeacherMessage[]): string {
  return messages
    .map((message) => {
      const label = message.role === "teacher" ? "Teacher" : "User";
      return `[${label}]: ${message.content}`;
    })
    .join("\n");
}

export function buildActorInput(
  scenario: Scenario,
  messages: RoleplayMessage[]
): string {
  return `Scenario: ${scenario.name}
Role: ${scenario.actor_role}
Setting: ${scenario.actor_setting}
Personality: ${scenario.actor_personality}
Context: ${scenario.scenario_context}

Roleplay conversation so far:
${roleplayTranscript(messages)}

Continue naturally in character as the Actor.`;
}

export function buildReviewerInput(
  scenario: Scenario,
  messages: RoleplayMessage[],
  latestUserMessage: RoleplayMessage
): string {
  return `Scenario: ${scenario.name}
Setting: ${scenario.actor_setting}
User's role: ${scenario.user_role}
Scenario context: ${scenario.scenario_context}

Roleplay conversation so far:
${roleplayTranscript(messages)}

Current user message to review: ${latestUserMessage.content}`;
}

export function buildTeacherInput({
  scenario,
  messages,
  teacherMessages,
  question
}: {
  scenario: Scenario;
  messages: RoleplayMessage[];
  teacherMessages: TeacherMessage[];
  question: string;
}): string {
  return `Scenario: ${scenario.name}

<roleplay_conversation>
${roleplayTranscript(messages)}
</roleplay_conversation>

<reviewer_outputs>
${reviewerTranscript(messages) || "No reviewer outputs yet."}
</reviewer_outputs>

<prior_teacher_chat>
${teacherTranscript(teacherMessages) || "No prior teacher chat yet."}
</prior_teacher_chat>

<new_question>
${question}
</new_question>`;
}

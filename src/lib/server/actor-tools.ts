// The narrate tool lets the Actor inject world-event narration beats
// (stage directions) separate from dialogue. The model calls this to describe
// something that happens in the scene — a sound, an action, an environmental
// change — before or after speaking. The server collects the calls and stores
// them on the actor message so the UI can render them as italic stage directions.

export const ACTOR_TOOLS = [
  {
    type: "function" as const,
    name: "narrate",
    description:
      "Introduce a STORY EVENT that changes the situation and that the user (or you) must now react to: something becomes unavailable, someone arrives or interrupts, a problem or time pressure appears, a request can't be met as asked. This is NOT for decorative scene flavor: do NOT narrate ambient sounds, smells, or idle physical movements that change nothing. If it has no consequence, do not narrate it. Use it RARELY, only when the scene genuinely calls for a twist (most replies have none), and at most once per reply. Call it BEFORE your spoken reply, never after, and then have your dialogue react to the event you introduced. Write in third person, present tense, stage-direction style. Good: 'The barista checks the fridge and frowns: they are out of oat milk.' Bad (decorative, no consequence): 'The coffee machine hisses softly behind the counter.' Do NOT use this for your own spoken dialogue.",
    parameters: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The narration text. One or two sentences max. Present tense, third person."
        }
      },
      required: ["text"],
      additionalProperties: false
    },
    strict: true
  }
];

export function executeNarrateCall(args: Record<string, unknown>): string {
  const text = typeof args.text === "string" ? args.text.trim() : "";
  return text || "...";
}

// The model sometimes ignores the narrate tool and instead writes stage
// directions as Markdown-italic spans (*like this*) inline with its dialogue.
// Those render as literal asterisks glued to the reply. This pulls each *...*
// span out as a narration beat and returns the remaining spoken dialogue,
// so inline narration is treated the same as a narrate tool call.
export function extractInlineNarrations(content: string): {
  content: string;
  narrations: string[];
} {
  const narrations: string[] = [];
  // Collapse bold (**word**) to plain text first so it is never mistaken for a
  // narration span. Then pull each remaining single-asterisk *...* span out.
  const dialogue = content
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, (_match, inner: string) => {
      const beat = inner.trim();
      if (beat) narrations.push(beat);
      return " ";
    });
  return {
    // Insert a missing space when one sentence runs straight into the next
    // (e.g. an inline narration glued to dialogue: "...sold out.Sure thing").
    content: dialogue
      .replace(/([.!?])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim(),
    narrations
  };
}

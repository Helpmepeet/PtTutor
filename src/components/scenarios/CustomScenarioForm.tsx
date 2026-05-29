"use client";

import { MessageSquare, X } from "lucide-react";
import { useState } from "react";
import type { CreateScenarioInput } from "@/lib/scenario-input";
import type { ScenarioCategory, ScenarioFeedbackMode } from "@/lib/types";

type CustomScenarioFormProps = {
  busy: boolean;
  onCancel: () => void;
  onDraftScenario: (prompt: string) => Promise<CreateScenarioInput>;
  onSubmit: (
    input: CreateScenarioInput,
    options: { startChat: boolean }
  ) => void;
};

type DraftState = {
  name: string;
  description: string;
  category: ScenarioCategory;
  icon: string;
  starter: "actor" | "user";
  actorRole: string;
  actorSetting: string;
  personality: string;
  scenarioContext: string;
  userRole: string;
  firstLine: string;
};

const examples = [
  "Calling my landlord about a leaking sink",
  "Returning a broken hair dryer",
  "A job interview for a marketing role"
];

const feedbackModes: Array<{
  value: ScenarioFeedbackMode;
  label: string;
  description: string;
}> = [
  {
    value: "light",
    label: "Light",
    description: "Major issues only"
  },
  {
    value: "standard",
    label: "Balanced",
    description: "Useful corrections"
  },
  {
    value: "strict",
    label: "Strict",
    description: "More detail"
  }
];

const emptyDraft = (prompt = ""): DraftState => ({
  name: "Custom practice",
  description: "Practice your own situation",
  category: "daily",
  icon: "💬",
  starter: "actor",
  actorRole: "A realistic conversation partner",
  actorSetting: "A realistic setting for this situation",
  personality: "Natural, helpful, and realistic",
  scenarioContext: prompt,
  userRole: "A person practicing this situation",
  firstLine: "Start naturally and invite the user to explain what they need."
});

function toDraftState(input: CreateScenarioInput): DraftState {
  return {
    name: input.name,
    description: input.description || `Practice ${input.name}`,
    category: input.category,
    icon: input.icon || "💬",
    starter: input.starter,
    actorRole: input.actor_role,
    actorSetting: input.actor_setting,
    personality: input.actor_personality || "Natural, helpful, and realistic",
    scenarioContext: input.scenario_context,
    userRole: input.user_role,
    firstLine: input.starter_instruction || ""
  };
}

export function CustomScenarioForm({
  busy,
  onCancel,
  onDraftScenario,
  onSubmit
}: CustomScenarioFormProps) {
  const [step, setStep] = useState<"describe" | "review">("describe");
  const [prompt, setPrompt] = useState("");
  const [feedbackMode, setFeedbackMode] =
    useState<ScenarioFeedbackMode>("standard");
  const [draft, setDraft] = useState<DraftState>(() => emptyDraft());
  const [drafting, setDrafting] = useState(false);
  const [notice, setNotice] = useState("");

  const canDraft = prompt.trim().length >= 5;
  const missing = [
    !draft.userRole.trim() ? "You play" : "",
    !draft.actorRole.trim() ? "They are" : "",
    !draft.scenarioContext.trim() ? "Practice details" : ""
  ].filter(Boolean);
  const canSubmit = missing.length === 0;

  async function draftScenario() {
    if (!canDraft || drafting) return;
    setDrafting(true);
    setNotice("");
    try {
      const result = await onDraftScenario(prompt.trim());
      setDraft(toDraftState(result));
      setStep("review");
    } catch {
      setDraft(emptyDraft(prompt.trim()));
      setNotice("Couldn't draft this one. Review the basics before starting.");
      setStep("review");
    } finally {
      setDrafting(false);
    }
  }

  function payload(): CreateScenarioInput {
    const name = draft.name.trim() || "Custom practice";
    return {
      name,
      description: draft.description.trim() || `Practice ${name}`,
      category: draft.category,
      icon: draft.icon.trim() || "💬",
      feedback_mode: feedbackMode,
      starter: draft.starter,
      actor_role:
        draft.actorRole.trim() || "A realistic conversation partner",
      actor_setting:
        draft.actorSetting.trim() || "A realistic setting for this situation",
      actor_personality:
        draft.personality.trim() || "Natural, helpful, and realistic",
      scenario_context: draft.scenarioContext.trim(),
      user_role: draft.userRole.trim(),
      starter_instruction:
        draft.firstLine.trim() ||
        (draft.starter === "actor"
          ? "Start the scenario naturally and invite the user to respond."
          : "Wait for the user to begin, then respond naturally in character.")
    };
  }

  function submit(startChat: boolean) {
    if (!canSubmit) return;
    onSubmit(payload(), { startChat });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-canvas">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-surface px-6">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">Create a scenario</h1>
          <p className="text-xs text-text-secondary">
            Describe the situation, then review the practice basics.
          </p>
        </div>
        <button
          aria-label="Cancel scenario creation"
          className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
          onClick={onCancel}
        >
          <X size={18} />
        </button>
      </header>

      {step === "describe" ? (
        <div className="flex min-h-0 flex-1 items-start justify-center overflow-y-auto px-8 py-12">
          <section className="w-full max-w-2xl">
            <label className="block">
              <span className="text-xl font-semibold">
                What do you want to practice?
              </span>
              <textarea
                className="mt-4 min-h-28 w-full resize-none rounded-lg border border-border-subtle bg-surface px-4 py-3 text-base leading-7 outline-none transition-colors placeholder:text-text-muted focus:border-brand focus:ring-1 focus:ring-brand/20"
                placeholder="e.g. Calling my landlord about a leaking sink"
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
              />
            </label>

            <FeedbackModePicker
              value={feedbackMode}
              onChange={setFeedbackMode}
            />

            <div className="mt-4 flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  className="rounded-full border border-border-subtle bg-surface px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
                  type="button"
                  onClick={() => setPrompt(example)}
                >
                  {example}
                </button>
              ))}
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <button
                className="text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
                type="button"
                onClick={() => {
                  setDraft(emptyDraft(prompt.trim()));
                  setNotice("");
                  setStep("review");
                }}
              >
                Review manually
              </button>
              <button
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-hover disabled:opacity-40"
                disabled={busy || drafting || !canDraft}
                type="button"
                onClick={draftScenario}
              >
                {drafting ? "Drafting..." : "Draft scenario"}
              </button>
            </div>
          </section>
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-8 pb-28 pt-8">
            <section className="mx-auto w-full max-w-2xl rounded-lg border border-border-subtle bg-surface p-6 shadow-sm">
              {notice ? (
                <div className="mb-5 rounded-lg border border-error/20 bg-error-bg px-3 py-2 text-sm text-error">
                  {notice}
                </div>
              ) : null}

              <div className="flex items-start gap-3">
                <div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-surface-alt text-xl">
                  {draft.icon}
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold">
                    {draft.name}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    {draft.description}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <InlineInput
                  label="You play"
                  value={draft.userRole}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, userRole: value }))
                  }
                />
                <InlineInput
                  label="They are"
                  value={draft.actorRole}
                  onChange={(value) =>
                    setDraft((current) => ({ ...current, actorRole: value }))
                  }
                />
                <InlineTextArea
                  label="Practice details"
                  value={draft.scenarioContext}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      scenarioContext: value
                    }))
                  }
                />
                <FeedbackModePicker
                  value={feedbackMode}
                  onChange={setFeedbackMode}
                />
              </div>
            </section>
          </div>

          <footer className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface px-6 py-3">
            <p className="text-sm text-text-secondary">
              {missing.length > 0
                ? `Still needed: ${missing.join(", ")}.`
                : "Ready to start."}
            </p>
            <div className="flex items-center gap-2">
              <button
                className="h-10 rounded-lg border border-border-subtle px-4 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-alt hover:text-text-primary"
                type="button"
                onClick={onCancel}
              >
                Cancel
              </button>
              <button
                className="h-10 rounded-lg border border-border-subtle px-4 text-sm font-medium text-text-primary transition-colors hover:bg-surface-alt disabled:opacity-40"
                disabled={busy || !canSubmit}
                type="button"
                onClick={() => submit(false)}
              >
                Save for later
              </button>
              <button
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-hover disabled:opacity-40"
                disabled={busy || !canSubmit}
                type="button"
                onClick={() => submit(true)}
              >
                <MessageSquare size={16} /> Start chat
              </button>
            </div>
          </footer>
        </>
      )}
    </div>
  );
}

function FeedbackModePicker({
  value,
  onChange
}: {
  value: ScenarioFeedbackMode;
  onChange: (value: ScenarioFeedbackMode) => void;
}) {
  return (
    <div className="mt-5">
      <p className="text-sm font-medium">Feedback</p>
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
        {feedbackModes.map((mode) => {
          const active = value === mode.value;
          return (
            <button
              key={mode.value}
              className={`rounded-lg border px-3 py-2 text-left transition-colors ${
                active
                  ? "border-brand bg-brand-subtle text-brand"
                  : "border-border-subtle bg-surface text-text-secondary hover:bg-surface-alt hover:text-text-primary"
              }`}
              type="button"
              onClick={() => onChange(mode.value)}
            >
              <span className="block text-sm font-semibold">{mode.label}</span>
              <span className="mt-0.5 block text-xs">{mode.description}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function InlineInput({
  label,
  value,
  onChange
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <input
        className="mt-1.5 w-full rounded-lg border border-transparent bg-surface-alt px-3 py-2 text-sm outline-none transition-colors focus:border-brand focus:bg-surface focus:ring-1 focus:ring-brand/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function InlineTextArea({
  label,
  rows = 4,
  value,
  onChange
}: {
  label: string;
  rows?: number;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      <textarea
        className="mt-1.5 w-full resize-none rounded-lg border border-transparent bg-surface-alt px-3 py-2 text-sm leading-6 outline-none transition-colors focus:border-brand focus:bg-surface focus:ring-1 focus:ring-brand/20"
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

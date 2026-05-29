"use client";

import { useState } from "react";
import type { ActorLevel, Scenario } from "@/lib/types";

type StartSessionModalProps = {
  scenario: Scenario;
  busy: boolean;
  onStart: (actorLevel: ActorLevel) => void;
  onCancel: () => void;
};

const LEVELS: { value: ActorLevel; label: string; description: string }[] = [
  {
    value: "easy",
    label: "Easy",
    description: "Short sentences, simple words. Good for building confidence."
  },
  {
    value: "standard",
    label: "Standard",
    description: "Everyday vocabulary at a natural pace."
  },
  {
    value: "challenging",
    label: "Challenging",
    description: "Faster pace, real-world complications, and the occasional idiom."
  }
];

export function StartSessionModal({ scenario, busy, onStart, onCancel }: StartSessionModalProps) {
  const [selected, setSelected] = useState<ActorLevel>("standard");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-surface p-6 shadow-xl">
        <div className="mb-1 text-2xl">{scenario.icon}</div>
        <h2 className="text-lg font-semibold">{scenario.name}</h2>
        <p className="mt-1 text-sm text-text-secondary">{scenario.description}</p>

        <p className="mt-5 text-sm font-medium">Conversation level</p>
        <div className="mt-2 flex flex-col gap-2">
          {LEVELS.map((level) => (
            <button
              key={level.value}
              className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                selected === level.value
                  ? "border-brand bg-brand-subtle"
                  : "border-border-subtle bg-surface hover:border-brand/40"
              }`}
              onClick={() => setSelected(level.value)}
            >
              <span className={`text-sm font-semibold ${selected === level.value ? "text-brand" : "text-text-primary"}`}>
                {level.label}
              </span>
              <span className="ml-2 text-sm text-text-secondary">{level.description}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            className="rounded-lg px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface-alt"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
            disabled={busy}
            onClick={() => onStart(selected)}
          >
            {busy ? "Starting…" : "Start"}
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Coffee, Settings } from "lucide-react";
import type { ScenarioFeedbackMode, Scenario, RoleplaySession } from "@/lib/types";

type TopBarProps = {
  scenario?: Scenario;
  session?: RoleplaySession | null;
  onChangeReviewerMode?: (mode: ScenarioFeedbackMode) => void;
};

const FEEDBACK_MODES: { value: ScenarioFeedbackMode; label: string; description: string }[] = [
  { value: "light", label: "Light", description: "Major issues only" },
  { value: "standard", label: "Standard", description: "Balanced feedback" },
  { value: "strict", label: "Strict", description: "Flag more issues" }
];

export function TopBar({ scenario, session, onChangeReviewerMode }: TopBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  const currentMode = session?.reviewer_feedback_mode ?? "standard";

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-surface px-5">
      <div className="flex min-w-0 items-center gap-3">
        {scenario ? (
          <span aria-hidden className="text-lg">
            {scenario.icon}
          </span>
        ) : (
          <Coffee size={18} className="text-text-secondary" />
        )}
        <span className="truncate text-base font-semibold">
          {scenario?.name ?? "Roleplay"}
        </span>
      </div>

      {session && onChangeReviewerMode ? (
        <div ref={menuRef} className="relative">
          <button
            aria-label="Session settings"
            className="flex size-8 items-center justify-center rounded-lg text-text-secondary hover:bg-surface-alt hover:text-text-primary"
            onClick={() => setMenuOpen((v) => !v)}
          >
            <Settings size={16} />
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-10 z-40 w-56 rounded-xl border border-border-subtle bg-surface p-3 shadow-lg">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
                Feedback level
              </p>
              {FEEDBACK_MODES.map((mode) => (
                <button
                  key={mode.value}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    currentMode === mode.value
                      ? "bg-brand-subtle text-brand"
                      : "text-text-primary hover:bg-surface-alt"
                  }`}
                  onClick={() => {
                    onChangeReviewerMode(mode.value);
                    setMenuOpen(false);
                  }}
                >
                  <span className="font-medium">{mode.label}</span>
                  <span className="text-xs text-text-secondary">{mode.description}</span>
                </button>
              ))}

              <p className="mt-3 px-1 text-[10px] text-text-muted">
                Applies to new messages only.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </header>
  );
}

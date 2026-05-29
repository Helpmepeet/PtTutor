import { useState } from "react";
import { Plus } from "lucide-react";
import type { ActorLevel, Scenario } from "@/lib/types";
import { StartSessionModal } from "./StartSessionModal";

type ScenarioPickerProps = {
  busy: boolean;
  savedScenarioId?: string | null;
  scenarios: Scenario[];
  onCreate: (scenarioId: string, actorLevel: ActorLevel) => void;
  onNewScenario: () => void;
};

export function ScenarioPicker({
  busy,
  savedScenarioId,
  scenarios,
  onCreate,
  onNewScenario
}: ScenarioPickerProps) {
  const [pendingScenario, setPendingScenario] = useState<Scenario | null>(null);
  const savedScenario = scenarios.find(
    (scenario) => scenario.id === savedScenarioId
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-tight">
            Hi, pick a scenario
          </h1>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Choose a ready-made roleplay or create one for your own situation.
          </p>
        </div>
        {savedScenario ? (
          <div className="rounded-full border border-brand/20 bg-brand-subtle px-3 py-1.5 text-sm font-medium text-brand">
            {savedScenario.name} saved. Start a chat anytime.
          </div>
        ) : null}
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        <button
          className="min-h-[178px] rounded-lg border border-dashed border-brand/40 bg-surface p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
          data-testid="card-new-scenario"
          disabled={busy}
          onClick={onNewScenario}
        >
          <div className="flex size-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
            <Plus size={20} />
          </div>
          <h2 className="mt-4 text-base font-semibold leading-snug">
            New scenario
          </h2>
          <p className="mt-1.5 text-sm leading-6 text-text-secondary">
            Practice your own situation
          </p>
          <span className="mt-4 inline-block rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold uppercase text-text-secondary">
            custom
          </span>
        </button>

        {scenarios.map((scenario) => (
          <button
            key={scenario.id}
            className="rounded-lg border border-border-subtle bg-surface p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
            data-testid={`card-scenario-${scenario.id}`}
            disabled={busy}
            onClick={() => setPendingScenario(scenario)}
          >
            <div className="text-3xl">{scenario.icon}</div>
            <h2 className="mt-4 text-base font-semibold leading-snug">
              {scenario.name}
            </h2>
            <p className="mt-1.5 truncate text-sm leading-6 text-text-secondary">
              {scenario.description}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-block rounded-full bg-surface-alt px-2.5 py-1 text-[11px] font-semibold uppercase text-text-secondary">
                {scenario.category}
              </span>
              {scenario.source === "custom" ? (
                <span className="inline-block rounded-full bg-brand-subtle px-2.5 py-1 text-[11px] font-semibold uppercase text-brand">
                  custom
                </span>
              ) : null}
            </div>
          </button>
        ))}
      </div>

      {pendingScenario ? (
        <StartSessionModal
          busy={busy}
          scenario={pendingScenario}
          onCancel={() => setPendingScenario(null)}
          onStart={(actorLevel) => {
            setPendingScenario(null);
            onCreate(pendingScenario.id, actorLevel);
          }}
        />
      ) : null}
    </div>
  );
}

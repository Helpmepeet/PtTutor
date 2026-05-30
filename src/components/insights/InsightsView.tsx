"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { apiGet, type ApiState } from "@/lib/client/api";
import {
  createBrowserSupabase,
  supabaseBrowserConfigured
} from "@/lib/supabase/client";
import type { InsightFlashcard, InsightsSummary, MarkerCategory } from "@/lib/types";

const demoUser = {
  id: "local-demo-user",
  email: "demo@local.test",
  name: "Local Demo"
};

const CATEGORY_STYLE: Record<MarkerCategory, { dot: string; label: string }> = {
  grammar: { dot: "bg-marker-grammar", label: "Grammar" },
  word_choice: { dot: "bg-marker-word-choice", label: "Word choice" },
  preposition: { dot: "bg-marker-preposition", label: "Preposition" },
  tone: { dot: "bg-marker-tone", label: "Tone" },
  style: { dot: "bg-marker-style", label: "Style" }
};

const CATEGORY_ORDER: MarkerCategory[] = [
  "grammar",
  "word_choice",
  "preposition",
  "tone",
  "style"
];

function OverviewCard({ label, value, sublabel }: { label: string; value: number; sublabel: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-text-primary">{label}</h2>
        <span className="text-2xl font-semibold tabular-nums text-text-primary">
          {value}
        </span>
      </div>
      <p className="mt-1 text-xs text-text-muted">{sublabel}</p>
    </div>
  );
}

function HighlightedSentence({ card }: { card: InsightFlashcard }) {
  const start = card.sentence.indexOf(card.span_text);
  if (start < 0) return <>{card.sentence}</>;

  const before = card.sentence.slice(0, start);
  const after = card.sentence.slice(start + card.span_text.length);
  return (
    <>
      {before}
      <mark className="rounded bg-surface-alt px-1 font-medium text-text-primary underline decoration-brand/50 underline-offset-2">
        {card.span_text}
      </mark>
      {after}
    </>
  );
}

function FlashcardDeck({ cards }: { cards: InsightFlashcard[] }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const card = cards[index];

  if (!card) {
    return (
      <p className="rounded-2xl border border-border-subtle bg-surface p-6 text-sm text-text-secondary">
        Flashcards appear after marked text can be matched to your original messages.
      </p>
    );
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold text-text-primary">Flashcards</h2>
        <span className="text-xs text-text-muted">
          Card {index + 1} of {cards.length}
        </span>
      </div>

      <div className="mt-4 min-h-[180px] rounded-xl bg-surface-alt p-5">
        <div className="flex items-center gap-2 text-xs text-text-muted">
          <span className={`size-2 rounded-full ${CATEGORY_STYLE[card.category].dot}`} />
          <span>{CATEGORY_STYLE[card.category].label}</span>
          <span>·</span>
          <span>{card.scenario_name}</span>
        </div>
        {revealed ? (
          <div className="mt-4">
            <p className="text-lg font-semibold text-text-primary">{card.fix}</p>
            <p className="mt-3 text-sm leading-6 text-text-secondary">{card.why}</p>
          </div>
        ) : (
          <p className="mt-4 text-lg leading-8 text-text-primary">
            <HighlightedSentence card={card} />
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
          disabled={index === 0}
          onClick={() => {
            setRevealed(false);
            setIndex((current) => Math.max(0, current - 1));
          }}
        >
          ‹
        </button>
        <button
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-brand-hover"
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? "Show sentence" : "Show fix"}
        </button>
        <button
          className="rounded-lg border border-border-subtle px-3 py-2 text-sm text-text-secondary transition-colors hover:text-text-primary disabled:opacity-40"
          disabled={index === cards.length - 1}
          onClick={() => {
            setRevealed(false);
            setIndex((current) => Math.min(cards.length - 1, current + 1));
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
}

function InsightsBody({ insights }: { insights: InsightsSummary }) {
  if (insights.messages_reviewed === 0) {
    return (
      <div className="mt-8 rounded-2xl border border-border-subtle bg-surface p-6">
        <p className="text-sm leading-6 text-text-secondary">
          Your patterns appear here after the reviewer marks a few of your messages.
          Start a chat and send a few lines.
        </p>
        <Link className="mt-4 inline-block text-sm text-brand hover:underline" href="/">
          Back to practice
        </Link>
      </div>
    );
  }

  const maxCategoryCount = Math.max(...CATEGORY_ORDER.map((category) => insights.by_category[category]), 1);
  const visibleCategories = CATEGORY_ORDER.filter(
    (category) => insights.by_category[category] > 0
  );

  return (
    <>
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <OverviewCard
          label="Messages reviewed"
          value={insights.messages_reviewed}
          sublabel={`${insights.clean_count} had no marks`}
        />
        <OverviewCard
          label="Total marks"
          value={insights.total_markers}
          sublabel="Across reviewer-marked messages"
        />
      </div>

      <section className="mt-4 rounded-2xl border border-border-subtle bg-surface p-6">
        <h2 className="text-sm font-semibold text-text-primary">By category</h2>
        {visibleCategories.length > 0 ? (
          <div className="mt-4 space-y-3">
            {visibleCategories.map((category) => {
              const count = insights.by_category[category];
              return (
                <div key={category}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-2 text-text-secondary">
                      <span className={`size-2 rounded-full ${CATEGORY_STYLE[category].dot}`} />
                      <span>{CATEGORY_STYLE[category].label}</span>
                    </div>
                    <span className="tabular-nums text-text-primary">{count}</span>
                  </div>
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-alt">
                    <div
                      className={`h-full rounded-full ${CATEGORY_STYLE[category].dot}`}
                      style={{ width: `${(count / maxCategoryCount) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">No category marks yet.</p>
        )}
      </section>

      <section className="mt-4 rounded-2xl border border-border-subtle bg-surface p-6">
        <h2 className="text-sm font-semibold text-text-primary">Most-repeated fixes</h2>
        {insights.top_fixes.length > 0 ? (
          <div className="mt-4 space-y-3">
            {insights.top_fixes.map((fix) => (
              <div
                className="rounded-xl border border-border-subtle bg-surface-alt p-4"
                key={`${fix.wrong}-${fix.fix}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 text-sm">
                    <span className="text-text-muted line-through">{fix.wrong}</span>
                    <span className="mx-2 text-text-muted">→</span>
                    <span className="font-medium text-text-primary">{fix.fix}</span>
                  </div>
                  <span className="shrink-0 rounded-full bg-surface px-2 py-1 text-xs tabular-nums text-text-secondary">
                    {fix.count}×
                  </span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-text-muted">
                  <span className={`size-2 rounded-full ${CATEGORY_STYLE[fix.category].dot}`} />
                  <span>{CATEGORY_STYLE[fix.category].label}</span>
                  <span>·</span>
                  <span>{fix.scenario_name}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-text-secondary">No repeated fixes yet.</p>
        )}
      </section>

      <section className="mt-4">
        <FlashcardDeck cards={insights.flashcards} />
      </section>
    </>
  );
}

export function InsightsView() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [insights, setInsights] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let apiState: ApiState = { session: null, demoUser: null };
        if (supabase) {
          const { data } = await supabase.auth.getSession();
          if (cancelled) return;
          setSession(data.session);
          apiState = { session: data.session, demoUser: null };
        } else {
          apiState = { session: null, demoUser };
        }
        const response = await apiGet<{ insights: InsightsSummary }>(
          "/api/insights",
          apiState
        );
        if (!cancelled) setInsights(response.insights);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load insights");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const signedIn = !supabaseBrowserConfigured() || Boolean(session);

  return (
    <main className="min-h-screen bg-canvas px-8 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Your patterns</h1>
          <Link className="text-sm text-brand hover:underline" href="/">
            ← Back to practice
          </Link>
        </div>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          What the reviewer has marked across all your chats. This is a summary of
          your own messages, not a score.
        </p>

        {loading ? (
          <p className="mt-8 text-sm text-text-secondary">Loading patterns…</p>
        ) : !signedIn ? (
          <p className="mt-8 text-sm text-text-secondary">
            Sign in to see your patterns.
          </p>
        ) : error ? (
          <p className="mt-8 text-sm text-error">{error}</p>
        ) : insights ? (
          <InsightsBody insights={insights} />
        ) : null}
      </div>
    </main>
  );
}

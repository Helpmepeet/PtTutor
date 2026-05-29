"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { apiGet, type ApiState } from "@/lib/client/api";
import {
  createBrowserSupabase,
  supabaseBrowserConfigured
} from "@/lib/supabase/client";
import type { RateLimitWindow, UsageSnapshot } from "@/lib/types";

const demoUser = {
  id: "local-demo-user",
  email: "demo@local.test",
  name: "Local Demo"
};

function formatReset(resetsAt: number | null): string {
  if (resetsAt === null) return "—";
  const ms = resetsAt - Date.now();
  if (ms <= 0) return "now";
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (hours < 24) return rem ? `in ${hours}h ${rem}m` : `in ${hours}h`;
  const days = Math.floor(hours / 24);
  return `in ${days}d ${hours % 24}h`;
}

function barColor(used: number): string {
  if (used >= 90) return "bg-error";
  if (used >= 70) return "bg-marker-preposition";
  return "bg-brand";
}

function WindowCard({
  label,
  sublabel,
  window
}: {
  label: string;
  sublabel: string;
  window: RateLimitWindow | null;
}) {
  const hasData = window !== null;
  const used = hasData ? Math.max(0, Math.min(100, window.used_percent)) : 0;
  return (
    <div className="rounded-2xl border border-border-subtle bg-surface p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold text-text-primary">{label}</h2>
        <span className="text-2xl font-semibold tabular-nums text-text-primary">
          {hasData ? `${used.toFixed(0)}%` : "—"}
        </span>
      </div>
      <p className="mt-1 text-xs text-text-muted">{sublabel}</p>
      <div className="mt-4 h-2.5 w-full overflow-hidden rounded-full bg-surface-alt">
        <div
          className={`h-full rounded-full transition-all ${barColor(used)}`}
          style={{ width: `${used}%` }}
        />
      </div>
      <p className="mt-3 text-xs text-text-secondary">
        {hasData ? `Resets ${formatReset(window.resets_at)}` : "Waiting for first message"}
      </p>
    </div>
  );
}

export function UsageView() {
  const supabase = useMemo(() => createBrowserSupabase(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
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
        const response = await apiGet<{ usage: UsageSnapshot | null }>(
          "/api/codex/usage",
          apiState
        );
        if (!cancelled) setUsage(response.usage);
      } catch (caught) {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Failed to load usage");
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
          <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Usage</h1>
          <Link className="text-sm text-brand hover:underline" href="/">
            ← Back to practice
          </Link>
        </div>
        <p className="mt-2 text-sm leading-6 text-text-secondary">
          Your ChatGPT subscription limits, as reported by OpenAI. These cover
          your whole subscription, not just this app, and update after each
          message you send.
        </p>

        {loading ? (
          <p className="mt-8 text-sm text-text-secondary">Loading usage…</p>
        ) : !signedIn ? (
          <p className="mt-8 text-sm text-text-secondary">
            Sign in to see your usage.
          </p>
        ) : error ? (
          <p className="mt-8 text-sm text-error">{error}</p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <WindowCard
                label="5-hour limit"
                sublabel="Rolling 5-hour window"
                window={usage?.primary ?? null}
              />
              <WindowCard
                label="Weekly limit"
                sublabel="Rolling 7-day window"
                window={usage?.secondary ?? null}
              />
            </div>
            {usage ? (
              <p className="mt-4 text-xs text-text-muted">
                Last updated{" "}
                {new Date(usage.captured_at).toLocaleString(undefined, {
                  hour: "numeric",
                  minute: "2-digit",
                  month: "short",
                  day: "numeric"
                })}
                .
              </p>
            ) : (
              <p className="mt-4 text-xs text-text-muted">
                No data yet — your limits appear after you send your first message.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}

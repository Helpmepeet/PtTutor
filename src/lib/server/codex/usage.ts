// Rate-limit / usage snapshot for a user's ChatGPT/Codex subscription.
//
// The Codex backend returns rate-limit state as HTTP response headers on each
// codex/responses call (same shape the Codex CLI parses):
//   x-codex-primary-used-percent / -window-minutes / -reset-at      (≈5-hour window)
//   x-codex-secondary-used-percent / -window-minutes / -reset-at    (≈weekly window)
// We read those off responses we already make — no extra polling call.

import type { RateLimitWindow, UsageSnapshot } from "@/lib/types";

export type { RateLimitWindow, UsageSnapshot };

function num(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseWindow(
  headers: Headers,
  prefix: "primary" | "secondary",
  now: number
): RateLimitWindow | null {
  const used = num(headers.get(`x-codex-${prefix}-used-percent`));
  if (used === null) return null;

  const windowMinutes = num(headers.get(`x-codex-${prefix}-window-minutes`));
  // reset-at is reported as seconds-from-now by the backend; convert to an
  // absolute timestamp so it stays meaningful after we store it.
  const resetSeconds = num(headers.get(`x-codex-${prefix}-reset-at`));

  return {
    used_percent: used,
    window_minutes: windowMinutes,
    resets_at:
      resetSeconds === null
        ? null
        : resetSeconds > 1_000_000_000
        ? resetSeconds * 1000
        : now + resetSeconds * 1000
  };
}

/**
 * Parse a usage snapshot from Codex response headers. Returns null when the
 * backend sent no rate-limit headers (e.g. an error response). Pure; `now`
 * is injectable for tests.
 */
export function parseUsageSnapshot(
  headers: Headers,
  now: number = Date.now()
): UsageSnapshot | null {
  const primary = parseWindow(headers, "primary", now);
  const secondary = parseWindow(headers, "secondary", now);
  if (!primary && !secondary) return null;
  return { primary, secondary, captured_at: now };
}

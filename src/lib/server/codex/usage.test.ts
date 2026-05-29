import { describe, expect, it } from "vitest";
import { parseUsageSnapshot } from "./usage";

const NOW = 1_700_000_000_000;

function headers(entries: Record<string, string>): Headers {
  return new Headers(entries);
}

describe("parseUsageSnapshot", () => {
  it("parses both primary (5h) and secondary (weekly) windows", () => {
    const snapshot = parseUsageSnapshot(
      headers({
        "x-codex-primary-used-percent": "42.5",
        "x-codex-primary-window-minutes": "300",
        "x-codex-primary-reset-at": "1800",
        "x-codex-secondary-used-percent": "10",
        "x-codex-secondary-window-minutes": "10080",
        "x-codex-secondary-reset-at": "86400"
      }),
      NOW
    );

    expect(snapshot).not.toBeNull();
    expect(snapshot!.primary).toEqual({
      used_percent: 42.5,
      window_minutes: 300,
      resets_at: NOW + 1800 * 1000
    });
    expect(snapshot!.secondary).toEqual({
      used_percent: 10,
      window_minutes: 10080,
      resets_at: NOW + 86400 * 1000
    });
  });

  it("parses absolute Unix timestamps for reset-at correctly", () => {
    const ABSOLUTE_RESET = 1779999999; // absolute epoch seconds
    const snapshot = parseUsageSnapshot(
      headers({
        "x-codex-primary-used-percent": "42.5",
        "x-codex-primary-window-minutes": "300",
        "x-codex-primary-reset-at": ABSOLUTE_RESET.toString()
      }),
      NOW
    );

    expect(snapshot).not.toBeNull();
    expect(snapshot!.primary!.resets_at).toBe(ABSOLUTE_RESET * 1000);
  });

  it("returns null when no rate-limit headers are present", () => {
    expect(parseUsageSnapshot(headers({ "content-type": "text/plain" }), NOW)).toBeNull();
  });

  it("keeps a window with a used-percent even when window/reset are missing", () => {
    const snapshot = parseUsageSnapshot(
      headers({ "x-codex-primary-used-percent": "5" }),
      NOW
    );
    expect(snapshot!.primary).toEqual({
      used_percent: 5,
      window_minutes: null,
      resets_at: null
    });
    expect(snapshot!.secondary).toBeNull();
  });

  it("ignores malformed numeric values", () => {
    const snapshot = parseUsageSnapshot(
      headers({
        "x-codex-primary-used-percent": "not-a-number",
        "x-codex-secondary-used-percent": "88"
      }),
      NOW
    );
    expect(snapshot!.primary).toBeNull();
    expect(snapshot!.secondary?.used_percent).toBe(88);
  });
});

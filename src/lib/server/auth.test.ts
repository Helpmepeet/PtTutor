import { describe, expect, it } from "vitest";
import { isEmailAllowed, parseAllowedEmails } from "./auth";

describe("email allowlist", () => {
  it("normalizes comma-separated emails", () => {
    expect(parseAllowedEmails("  Pat@example.com,friend@example.com ,, ")).toEqual([
      "pat@example.com",
      "friend@example.com"
    ]);
  });

  it("allows every email only when the allowlist is empty", () => {
    expect(isEmailAllowed("anyone@example.com", "")).toBe(true);
    expect(isEmailAllowed("pat@example.com", "friend@example.com")).toBe(false);
    expect(isEmailAllowed("PAT@example.com", "pat@example.com")).toBe(true);
  });
});

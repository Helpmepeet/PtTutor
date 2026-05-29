import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the OAuth network calls and the persistence backend so we can exercise
// per-user caching, single-flight refresh, and the identity guard in isolation.
const refreshTokens = vi.fn();
const saveTokens = vi.fn();
const store = new Map<string, unknown>();

vi.mock("./oauth", async () => {
  const actual = await vi.importActual<typeof import("./oauth")>("./oauth");
  return {
    ...actual,
    refreshTokens: (token: string) => refreshTokens(token)
  };
});

vi.mock("./persistence", () => ({
  loadTokens: async (userId: string) => store.get(userId) ?? null,
  saveTokens: async (userId: string, t: unknown) => {
    store.set(userId, t);
    saveTokens(userId, t);
  }
}));

import { extractAccountId } from "./oauth";
import { __resetTokenCacheForTests, getValidTokens } from "./token-store";

const USER = "user-1";

function jwtWithAccount(accountId: string): string {
  const body = Buffer.from(
    JSON.stringify({ "https://api.openai.com/auth": { chatgpt_account_id: accountId } })
  ).toString("base64url");
  return `h.${body}.s`;
}

beforeEach(() => {
  __resetTokenCacheForTests();
  refreshTokens.mockReset();
  saveTokens.mockReset();
  store.clear();
});

afterEach(() => {
  __resetTokenCacheForTests();
});

describe("getValidTokens", () => {
  it("throws a connect hint when the user has no linked account", async () => {
    await expect(getValidTokens(USER)).rejects.toThrow(/not connected/i);
  });

  it("returns cached tokens without refreshing when still fresh", async () => {
    store.set(USER, {
      access_token: "a",
      refresh_token: "r",
      account_id: "acct_1",
      expires_at: Date.now() + 600_000
    });
    const tokens = await getValidTokens(USER);
    expect(tokens.access_token).toBe("a");
    expect(refreshTokens).not.toHaveBeenCalled();
  });

  it("refreshes once for concurrent callers when near expiry (single-flight)", async () => {
    store.set(USER, {
      access_token: "old",
      refresh_token: "r",
      account_id: "acct_1",
      expires_at: Date.now() + 1_000 // within the 60s skew → stale
    });
    refreshTokens.mockResolvedValue({
      access_token: jwtWithAccount("acct_1"),
      refresh_token: "r2",
      expires_in: 3600
    });

    const [a, b] = await Promise.all([getValidTokens(USER), getValidTokens(USER)]);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(a.access_token).toBe(b.access_token);
    expect(saveTokens).toHaveBeenCalledTimes(1);
  });

  it("throws when a refresh returns a different account identity", async () => {
    store.set(USER, {
      access_token: "old",
      refresh_token: "r",
      account_id: "acct_1",
      expires_at: Date.now() - 1
    });
    refreshTokens.mockResolvedValue({
      access_token: jwtWithAccount("acct_2"),
      refresh_token: "r2",
      expires_in: 3600
    });

    await expect(getValidTokens(USER)).rejects.toThrow(/different account identity/i);
    expect(extractAccountId(jwtWithAccount("acct_2"))).toBe("acct_2");
  });

  it("isolates tokens per user", async () => {
    store.set("user-a", {
      access_token: "token-a",
      refresh_token: "r",
      account_id: "acct_a",
      expires_at: Date.now() + 600_000
    });
    store.set("user-b", {
      access_token: "token-b",
      refresh_token: "r",
      account_id: "acct_b",
      expires_at: Date.now() + 600_000
    });
    expect((await getValidTokens("user-a")).access_token).toBe("token-a");
    expect((await getValidTokens("user-b")).access_token).toBe("token-b");
  });
});

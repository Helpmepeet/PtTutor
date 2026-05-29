import {
  exchangeCode,
  extractAccountId,
  refreshTokens,
  type TokenResponse
} from "./oauth";
import { loadTokens, saveTokens, type PersistedTokens } from "./persistence";

// Per-user Codex OAuth credentials. Each app user links their own OpenAI
// account; tokens are cached and refreshed per user. Never logged. Refreshes
// are serialized per user so a slow refresh cannot overwrite a newer token,
// and an account-identity change is surfaced rather than silently accepted.

export type StoredTokens = PersistedTokens;

// Refresh this many ms before the real expiry to avoid edge-of-expiry races.
const REFRESH_SKEW_MS = 60_000;

// Per-user in-process cache + single-flight refresh lock. The DB is the source
// of truth; concurrent refreshes for the same user within one instance must
// not race.
const cache = new Map<string, StoredTokens>();
const refreshInFlight = new Map<string, Promise<StoredTokens>>();

function expiresAtFrom(response: TokenResponse): number {
  const seconds = response.expires_in ?? 3600;
  return Date.now() + seconds * 1000;
}

async function persist(userId: string, tokens: StoredTokens): Promise<void> {
  await saveTokens(userId, tokens);
  cache.set(userId, tokens);
}

/**
 * Persist the result of a fresh login (authorization_code exchange) for a user.
 * The account id is authoritative here because the login token carries it.
 */
export async function saveLoginTokens(
  userId: string,
  response: TokenResponse
): Promise<StoredTokens> {
  if (!response.refresh_token) {
    throw new Error("Codex login did not return a refresh token");
  }
  const accountId =
    extractAccountId(response.access_token) ??
    extractAccountId(response.id_token) ??
    null;

  const tokens: StoredTokens = {
    access_token: response.access_token,
    refresh_token: response.refresh_token,
    account_id: accountId,
    expires_at: expiresAtFrom(response)
  };
  await persist(userId, tokens);
  return tokens;
}

export async function completeLogin({
  userId,
  code,
  verifier
}: {
  userId: string;
  code: string;
  verifier: string;
}): Promise<StoredTokens> {
  const response = await exchangeCode({ code, verifier });
  return saveLoginTokens(userId, response);
}

async function doRefresh(userId: string, current: StoredTokens): Promise<StoredTokens> {
  const response = await refreshTokens(current.refresh_token);

  // Refresh tokens frequently omit the account-id claim; fall back to the
  // previously known id. If a NEW, different id appears, do not silently
  // overwrite the account — that indicates an identity switch.
  const refreshedId =
    extractAccountId(response.access_token) ?? extractAccountId(response.id_token);
  if (refreshedId && current.account_id && refreshedId !== current.account_id) {
    throw new Error(
      "Codex refresh returned a different account identity; re-authentication required"
    );
  }

  const next: StoredTokens = {
    access_token: response.access_token,
    refresh_token: response.refresh_token ?? current.refresh_token,
    account_id: refreshedId ?? current.account_id,
    expires_at: expiresAtFrom(response)
  };
  await persist(userId, next);
  return next;
}

function isFresh(tokens: StoredTokens): boolean {
  return tokens.expires_at - REFRESH_SKEW_MS > Date.now();
}

async function readCached(userId: string): Promise<StoredTokens | null> {
  const inMemory = cache.get(userId);
  if (inMemory) return inMemory;
  const loaded = await loadTokens(userId);
  if (loaded) cache.set(userId, loaded);
  return loaded;
}

/**
 * Return a valid access token + account context for a user, refreshing if near
 * expiry. Concurrent callers for the same user share a single in-flight
 * refresh. Throws a re-auth hint if the user has not linked an account.
 */
export async function getValidTokens(userId: string): Promise<StoredTokens> {
  const current = await readCached(userId);
  if (!current) {
    throw new Error(
      "Your OpenAI account is not connected. Connect it to start practicing."
    );
  }
  if (isFresh(current)) {
    return current;
  }

  let inFlight = refreshInFlight.get(userId);
  if (!inFlight) {
    inFlight = doRefresh(userId, current).finally(() => {
      refreshInFlight.delete(userId);
    });
    refreshInFlight.set(userId, inFlight);
  }
  return inFlight;
}

export async function getAuthStatus(userId: string): Promise<{
  authenticated: boolean;
  account_id: string | null;
  expires_at: number | null;
}> {
  const current = await readCached(userId);
  return {
    authenticated: Boolean(current),
    account_id: current?.account_id ?? null,
    expires_at: current?.expires_at ?? null
  };
}

// Test-only reset hook.
export function __resetTokenCacheForTests(): void {
  cache.clear();
  refreshInFlight.clear();
}

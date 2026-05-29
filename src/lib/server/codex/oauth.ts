import { createHash, randomBytes } from "node:crypto";
import { serverEnv } from "../env";

// PKCE + OAuth helpers for the ChatGPT/Codex subscription backend.
//
// This is the subscription auth path (OAuth login -> Codex backend), NOT the
// OpenAI Platform API-key path. Tokens minted here are scoped to the Codex
// client and only work against chatgpt.com/backend-api/codex.

export const CODEX_SCOPES = ["openid", "profile", "email", "offline_access"];

export type PkcePair = {
  verifier: string;
  challenge: string;
};

function base64url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function createPkcePair(): PkcePair {
  const verifier = base64url(randomBytes(64));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export function createState(): string {
  return base64url(randomBytes(32));
}

export function buildAuthorizeUrl({
  challenge,
  state
}: {
  challenge: string;
  state: string;
}): string {
  const url = new URL("/oauth/authorize", serverEnv.CODEX_ISSUER);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", serverEnv.CODEX_CLIENT_ID);
  url.searchParams.set("redirect_uri", serverEnv.CODEX_REDIRECT_URI);
  url.searchParams.set("scope", CODEX_SCOPES.join(" "));
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("state", state);
  // Codex backend access is requested via the id_token audience, not an
  // api.openai.com scope (that scope is rejected by the auth server).
  url.searchParams.set("id_token_add_organizations", "true");
  url.searchParams.set("codex_cli_simplified_flow", "true");
  // Match the Codex CLI client identity (also sent as the originator header on
  // backend calls).
  url.searchParams.set("originator", "codex_cli_rs");
  return url.toString();
}

export type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  expires_in?: number;
  token_type?: string;
};

async function postToken(body: Record<string, string>): Promise<TokenResponse> {
  const response = await fetch(new URL("/oauth/token", serverEnv.CODEX_ISSUER), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(
      `Codex token request failed (${response.status}): ${text.slice(0, 500)}`
    );
  }
  return JSON.parse(text) as TokenResponse;
}

export function exchangeCode({
  code,
  verifier
}: {
  code: string;
  verifier: string;
}): Promise<TokenResponse> {
  return postToken({
    grant_type: "authorization_code",
    client_id: serverEnv.CODEX_CLIENT_ID,
    code,
    redirect_uri: serverEnv.CODEX_REDIRECT_URI,
    code_verifier: verifier
  });
}

export function refreshTokens(refreshToken: string): Promise<TokenResponse> {
  return postToken({
    grant_type: "refresh_token",
    client_id: serverEnv.CODEX_CLIENT_ID,
    refresh_token: refreshToken,
    scope: CODEX_SCOPES.join(" ")
  });
}

type AuthClaims = {
  chatgpt_account_id?: string;
  organization_id?: string;
};

/**
 * The stable ChatGPT account id is carried as a JWT claim inside the access
 * token (and id_token), under `https://api.openai.com/auth`. It is NOT a
 * top-level token-response field, and refresh-cycle tokens often omit it — so
 * we extract it whenever present and the caller persists the last known value.
 */
export function extractAccountId(jwt: string | undefined): string | null {
  if (!jwt) return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1], "base64url").toString("utf8")
    ) as Record<string, unknown>;
    const auth = payload["https://api.openai.com/auth"] as AuthClaims | undefined;
    return auth?.chatgpt_account_id ?? null;
  } catch {
    return null;
  }
}

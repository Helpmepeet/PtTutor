export const serverEnv = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  ALLOWED_EMAILS: process.env.ALLOWED_EMAILS ?? "",

  // ChatGPT/Codex subscription backend (OAuth, not OPENAI_API_KEY).
  // Each user links their own account; requests route to
  // chatgpt.com/backend-api/codex/responses with that user's subscription
  // OAuth token. Per-user tokens live in Supabase. See src/lib/server/codex/.
  CODEX_CLIENT_ID: process.env.CODEX_CLIENT_ID || "app_EMoamEEZ73f0CkXaXp7hrann",
  CODEX_ISSUER: process.env.CODEX_ISSUER || "https://auth.openai.com",
  CODEX_BACKEND_URL:
    process.env.CODEX_BACKEND_URL || "https://chatgpt.com/backend-api/codex",
  // The Codex public OAuth client only allows this exact redirect URI
  // (localhost:1455/auth/callback). Run the app on port 1455 so it matches.
  CODEX_REDIRECT_URI:
    process.env.CODEX_REDIRECT_URI || "http://localhost:1455/auth/callback",
  // Local-dev fallback token store used only when Supabase is NOT configured.
  // When Supabase is set, per-user tokens live in the codex_credentials table.
  CODEX_TOKEN_FILE: process.env.CODEX_TOKEN_FILE || ".codex-tokens.json",

  ACTOR_MODEL: process.env.ACTOR_MODEL || "gpt-5.4-mini",
  REVIEWER_MODEL: process.env.REVIEWER_MODEL || "gpt-5.4-mini",
  TEACHER_MODEL: process.env.TEACHER_MODEL || "gpt-5.4-mini"
};

export function supabaseServerConfigured(): boolean {
  return Boolean(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL &&
      serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY &&
      serverEnv.SUPABASE_SERVICE_ROLE_KEY
  );
}

export function supabaseClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

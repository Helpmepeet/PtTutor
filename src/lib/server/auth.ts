import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest } from "next/server";
import { serverEnv, supabaseServerConfigured } from "./env";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
};

export function parseAllowedEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string, rawAllowlist = serverEnv.ALLOWED_EMAILS): boolean {
  const allowlist = parseAllowedEmails(rawAllowlist);
  return allowlist.length === 0 || allowlist.includes(email.trim().toLowerCase());
}

export async function getAuthenticatedUser(request: Request): Promise<AuthenticatedUser> {
  const demoUser = request.headers.get("x-demo-user");
  if (!supabaseServerConfigured()) {
    return {
      id: demoUser || "local-demo-user",
      email: "demo@local.test",
      name: "Local Demo",
      avatar_url: null
    };
  }

  const authHeader = request.headers.get("authorization");
  const token = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

  if (!token) {
    throw new Response("Missing bearer token", { status: 401 });
  }

  const supabase = createClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data.user?.email) {
    throw new Response("Invalid session", { status: 401 });
  }

  if (!isEmailAllowed(data.user.email)) {
    throw new Response("Email is not allowed", { status: 403 });
  }

  return {
    id: data.user.id,
    email: data.user.email,
    name:
      data.user.user_metadata?.name ||
      data.user.email.split("@")[0] ||
      "Learner",
    avatar_url: data.user.user_metadata?.avatar_url ?? null
  };
}

/**
 * Resolve the authenticated user from the Supabase session cookie. Used by the
 * Codex OAuth login (a top-level browser navigation that cannot carry a bearer
 * header). Returns null when unauthenticated or Supabase is not configured.
 */
export async function getUserFromCookies(
  request: NextRequest
): Promise<AuthenticatedUser | null> {
  if (!supabaseServerConfigured()) {
    return null;
  }

  const supabase = createServerClient(
    serverEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll() {
          // Read-only: token refresh is not persisted from this path.
        }
      }
    }
  );

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email || !isEmailAllowed(data.user.email)) {
    return null;
  }

  return {
    id: data.user.id,
    email: data.user.email,
    name:
      data.user.user_metadata?.name ||
      data.user.email.split("@")[0] ||
      "Learner",
    avatar_url: data.user.user_metadata?.avatar_url ?? null
  };
}

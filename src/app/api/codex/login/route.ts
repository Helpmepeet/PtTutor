import { NextResponse, type NextRequest } from "next/server";
import { getUserFromCookies } from "@/lib/server/auth";
import { supabaseServerConfigured } from "@/lib/server/env";
import { buildAuthorizeUrl, createPkcePair, createState } from "@/lib/server/codex/oauth";

const TEN_MINUTES = 60 * 10;
const DEMO_USER_ID = "local-demo-user";

// Starts the ChatGPT/Codex subscription OAuth (PKCE) flow for the currently
// signed-in app user, so the linked OpenAI account is bound to *that* user.
// The user is resolved from the Supabase session cookie (this is a top-level
// browser navigation with no bearer header). The verifier, CSRF state, and the
// user id are stashed in short-lived httpOnly cookies and used by the callback.
//
// In local demo mode (no Supabase) there is a single user, so we bind the flow
// to the demo user without requiring a Supabase session.
export async function GET(request: NextRequest) {
  let userId: string;
  if (supabaseServerConfigured()) {
    const user = await getUserFromCookies(request);
    if (!user) {
      return NextResponse.redirect(new URL("/?codex_error=login_required", request.url));
    }
    userId = user.id;
  } else {
    userId = DEMO_USER_ID;
  }

  const { verifier, challenge } = createPkcePair();
  const state = createState();
  const authorizeUrl = buildAuthorizeUrl({ challenge, state });

  const response = NextResponse.redirect(authorizeUrl);
  const secure = request.nextUrl.protocol === "https:";
  // Path "/" so the cookies are readable at the OAuth callback (/auth/callback,
  // the redirect URI the Codex client requires) as well as during cleanup.
  const cookieOptions = {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: TEN_MINUTES
  };
  response.cookies.set("codex_pkce_verifier", verifier, cookieOptions);
  response.cookies.set("codex_oauth_state", state, cookieOptions);
  response.cookies.set("codex_login_user", userId, cookieOptions);
  return response;
}

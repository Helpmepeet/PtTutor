import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { completeLogin } from "@/lib/server/codex/token-store";

// Shared OAuth callback. Two flows land here:
//   - Codex/ChatGPT subscription login (identified by our codex_oauth_state
//     cookie). The Codex public client only allows the redirect
//     http://localhost:1455/auth/callback, so this path is fixed.
//   - Supabase magic-link login (no codex_oauth_state cookie).
export async function GET(request: NextRequest) {
  const isCodexFlow = Boolean(request.cookies.get("codex_oauth_state")?.value);
  if (isCodexFlow) {
    return handleCodexCallback(request);
  }

  // Supabase magic-link exchange.
  const code = request.nextUrl.searchParams.get("code");
  const response = NextResponse.redirect(new URL("/", request.url));
  if (
    code &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          }
        }
      }
    );
    await supabase.auth.exchangeCodeForSession(code);
  }
  return response;
}

async function handleCodexCallback(request: NextRequest): Promise<NextResponse> {
  const url = request.nextUrl;
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const clear = (res: NextResponse) => {
    // Cookies were set with path "/" (see the login route), so clear them there.
    res.cookies.delete({ name: "codex_pkce_verifier", path: "/" });
    res.cookies.delete({ name: "codex_oauth_state", path: "/" });
    res.cookies.delete({ name: "codex_login_user", path: "/" });
    return res;
  };

  if (oauthError) {
    return clear(
      NextResponse.redirect(
        new URL(`/?codex_error=${encodeURIComponent(oauthError)}`, request.url)
      )
    );
  }

  const verifier = request.cookies.get("codex_pkce_verifier")?.value;
  const expectedState = request.cookies.get("codex_oauth_state")?.value;
  const userId = request.cookies.get("codex_login_user")?.value;

  if (!code || !state || !verifier || !expectedState || !userId) {
    return clear(
      NextResponse.redirect(new URL("/?codex_error=missing_oauth_params", request.url))
    );
  }
  if (state !== expectedState) {
    return clear(
      NextResponse.redirect(new URL("/?codex_error=state_mismatch", request.url))
    );
  }

  try {
    await completeLogin({ userId, code, verifier });
  } catch (error) {
    const message = error instanceof Error ? error.message : "login_failed";
    return clear(
      NextResponse.redirect(
        new URL(`/?codex_error=${encodeURIComponent(message)}`, request.url)
      )
    );
  }

  return clear(NextResponse.redirect(new URL("/?codex=connected", request.url)));
}

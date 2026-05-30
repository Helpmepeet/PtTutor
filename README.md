# English Roleplay Coach

Local MVP for the English Roleplay Coach described in `SPEC.md`.

<img width="1394" height="1008" alt="image" src="https://github.com/user-attachments/assets/4212cebd-ec90-4f2a-8c85-5006305d6a97" />

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Fill in Supabase credentials.
3. Set `ALLOWED_EMAILS` to a comma-separated list for private beta magic-link login.
4. Run:

```bash
npm install
npm run dev
```

### Connecting the LLM backend (ChatGPT/Codex subscription)

LLM calls (Actor, Reviewer, Teacher) run through each user's **own**
ChatGPT/Codex **subscription** via OAuth — not an `OPENAI_API_KEY`. Requests are
routed to `chatgpt.com/backend-api/codex/responses` using model `gpt-5.4-mini`,
and each user's calls bill to their own account.

This is **per-user** and requires Supabase auth (tokens are keyed by user). To
use the app:

1. Sign in with your magic-link account.
2. You'll land on a **Connect your OpenAI account** screen. Click it (or visit
   [`/api/codex/login`](http://localhost:1455/api/codex/login)) and complete
   the ChatGPT login.
3. You'll be redirected back with `?codex=connected` and can start roleplaying.
   Tokens are stored per user in the Supabase `codex_credentials` table and
   auto-refresh on use.

Each user's link state is at
[`/api/codex/status`](http://localhost:1455/api/codex/status), and their
subscription usage (5-hour and weekly limit windows) is at
[`/usage`](http://localhost:1455/usage) — also linked from the sidebar. Usage
is captured from the Codex backend's rate-limit response headers on each call,
so it populates after the first message.

Roleplay is gated behind connecting an account: a signed-in user who hasn't
linked OpenAI sees the connect screen and cannot send messages until they do.

**Local testing without Supabase:** if Supabase is not configured, the app runs
in single-user demo mode — no database, no Docker. Chats are kept in memory
(reset on restart) and the one demo user links an OpenAI account via the same
Connect screen; tokens + usage persist to a gitignored `.codex-tokens.json`
(`CODEX_TOKEN_FILE`). Just run `npm run dev`, open the app, click **Connect with
OpenAI**, and practice. With Supabase configured, everything is per-user instead.

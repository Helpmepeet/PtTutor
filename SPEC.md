# English Roleplay Coach — Product Specification

**Version:** v1 (MVP)
**Platform:** Web (desktop only)
**Status:** Design spec, ready for build

---

## 1. Overview

### 1.1 Product summary
A web app where Thai speakers practice English by roleplaying everyday and work scenarios with an AI character that behaves like a real person, while a silent background AI reviewer marks mistakes on their messages for review without breaking the conversation.

### 1.2 Users
- You + a small circle of friends and family
- Individual accounts with separate chat history
- Level-agnostic — no CEFR levels, no placement test
- Typical user: working adult, intermediate-ish English, wants to sound natural in daily life and at work

### 1.3 Goal
Help users sound natural in real English conversations — at cafes, hotels, in meetings, with coworkers. Naturalness is the target, not grammar correctness in isolation.

### 1.4 Non-goals (v1)
- No mobile design
- No speaking, TTS, or voice
- No CEFR or skill leveling
- No streaks, points, gamification
- No progress dashboard
- No social features
- No memory across sessions for the Reviewer
- No public release (private group only)

---

## 2. Architecture

### 2.1 Three-LLM design

The product uses three distinct LLM roles. They must be separate calls with separate system prompts.

**The Actor** (per user message, parallel with Reviewer)
- Plays the human character in the scenario
- Speaks at the user's level (simple words for simple input)
- Stays in character — never mentions grammar or breaks the fourth wall
- Behaves like a real human:
  - Usually understands and responds, even with broken English (~80% of the time)
  - Asks clarifying questions when meaning is genuinely ambiguous
  - Sometimes mirrors the correct form back naturally
  - Rarely shows confusion — only for truly broken sentences
- No memory across separate roleplay sessions

**The Reviewer** (per user message, parallel with Actor)
- Runs silently on every user message
- Never appears in the chat
- Returns structured JSON for the UI to render as markers
- No memory across separate roleplay sessions in v1
- Reviews each user message independently, using the full roleplay conversation so far only as context for meaning, tense, references, tone, and register

**The Teacher** (on-demand, persistent context)
- Triggered by the user clicking a floating chat bubble
- Has full context of:
  - The entire roleplay conversation (all user + Actor messages)
  - All Reviewer outputs (markers, fixes, rewrites)
  - All previous Teacher conversation within this session
- Answers free-form questions like a real teacher watching the roleplay
- Persists across visits to the same roleplay session
- Examples of questions it can answer:
  - "Why did you mark this as wrong?"
  - "Explain 'would like to' in Thai"
  - "Give me 5 more examples of this mistake"
  - "Would what I said sound rude?"

### 2.2 Per-turn flow (roleplay)
1. User sends a message
2. Two LLM calls fire in parallel:
   - Actor uses its role instructions + roleplay conversation, returns plain text reply
   - Reviewer uses its review instructions + scenario context + full roleplay conversation so far, but evaluates only the latest user message and returns JSON
3. UI renders:
   - Actor's reply as a new AI message bubble
   - Reviewer's markers as inline underlines on the user's just-sent message
4. User can click markers, click native rewrite, open Teacher, or continue chatting

### 2.3 Teacher flow (on demand)
1. User clicks floating Teacher bubble at any time
2. Teacher widget expands into a compact floating chat
3. User asks a question (free text)
4. Teacher LLM receives:
   - Teacher instructions
   - Full roleplay conversation up to this point (user + Actor messages)
   - All Reviewer JSON outputs so far
   - Full prior Teacher chat history for this session
   - The new user question
5. Teacher returns a free-form text response
6. Conversation persists in DB tied to the roleplay session

### 2.4 Prompt context and persistence contract

Each LLM role may use its own provider-managed conversation, thread, or session. Provider state must be isolated by role and by roleplay session: Actor, Reviewer, and Teacher never share the same provider thread. The database remains the source of truth; provider state is a convenience for context continuity and prompt reuse, not the only place where product memory lives.

If the selected LLM provider does not support durable role-specific threads, the backend can fall back to stateless calls by sending the relevant system prompt and context on every request. Both modes must preserve the same role boundaries and saved DB records.

**Actor call context**
- Uses Actor instructions, either configured in the Actor provider thread or sent with the call
- Has access to scenario config fields needed for the character and setting
- Has access to the roleplay conversation so far for this session (user + Actor messages), including the latest user message
- Does NOT receive Reviewer outputs or Teacher chat history in its provider thread or call context
- Returns one plain-text Actor reply, saved as an Actor message linked to the triggering user message

**Reviewer call context**
- Uses Reviewer instructions, either configured in the Reviewer provider thread/assistant or sent with the call
- Has access to scenario context needed for tone/register calibration
- Has access to the full roleplay conversation so far for this session
- Has access to the latest user message as the only message it should evaluate; every marker must refer to text from this message only
- Does NOT receive prior Reviewer outputs or Teacher chat history in v1
- Returns structured JSON (`markers` + `native_rewrite`), saved on the triggering user message as `reviewer_output`

**Teacher call context**
- Uses Teacher instructions, either configured in the Teacher provider thread or sent with the call
- Has access to the full roleplay conversation for this session
- Has access to all Reviewer outputs saved so far
- Has access to prior Teacher chat history for this session
- Has access to the new Teacher question
- Returns one free-form Teacher answer, saved in `teacher_messages`

**Caching / persistence**
- Actor replies, Reviewer JSON, and Teacher messages are persisted in the database and reused for rendering
- Refreshing the page, reopening a session, clicking a marker, or opening native rewrite must not trigger a new LLM call when saved output already exists
- Retries reuse the original user message and idempotency key; they update the existing records instead of creating duplicates
- Provider thread IDs are stored in the database and may be reused across visits to the same roleplay session
- Provider-side thread state or prompt caching should be used when available to avoid repeatedly paying for stable Reviewer instructions and scenario context
- Long sessions may eventually need a rolling summary or recent-window strategy for Reviewer context, but v1 starts with the full roleplay conversation for correctness
- No semantic cache, cross-user cache, or long-term Reviewer memory across roleplay sessions is part of v1

### 2.5 Tech stack
- Frontend: Next.js App Router + TypeScript
- Styling: Tailwind CSS
- Auth + DB: Supabase (Postgres + Supabase Auth magic links)
- LLM API: ChatGPT/Codex subscription backend (Responses API shape) via OAuth — `chatgpt.com/backend-api/codex/responses`, model `gpt-5.4-mini`. Not an `OPENAI_API_KEY` integration.
- Hosting: Vercel

### 2.6 Runtime configuration

Environment variables:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `ALLOWED_EMAILS` (comma-separated allowlist for private beta signup/login)
- `CODEX_CLIENT_ID` (server only; OAuth client for the Codex subscription backend)
- `CODEX_ISSUER` (default: `https://auth.openai.com`)
- `CODEX_BACKEND_URL` (default: `https://chatgpt.com/backend-api/codex`)
- `CODEX_REDIRECT_URI` (default: `http://localhost:1455/auth/callback` — the only redirect the Codex public client allows; the app runs on port 1455)
- `ACTOR_MODEL` (default: `gpt-5.4-mini`)
- `REVIEWER_MODEL` (default: `gpt-5.4-mini`)
- `TEACHER_MODEL` (default: `gpt-5.4-mini`)

The LLM backend uses the ChatGPT/Codex **subscription** path, **per user**:
each user completes an OAuth (PKCE) login at `/api/codex/login`, which links
their own OpenAI account. That user's tokens are stored server-side in the
Supabase `codex_credentials` table (keyed by `user_id`) and auto-refreshed, and
all of that user's LLM calls bill to their own subscription. Roleplay is gated
behind connecting an account. There is no `OPENAI_API_KEY`. Because tokens are
per-user, Supabase auth is required (the in-memory demo mode cannot link
accounts).

---

## 3. User flows

### 3.1 First-time use
1. User signs up / logs in
2. Lands on home view: scenario picker grid + empty History sidebar
3. Picks a scenario → new chat is created → enters chat view
4. Either Actor speaks first or user speaks first, depending on scenario
5. Conversation continues

### 3.2 During a chat
- User types in input box, sends
- User's message appears immediately
- Within a few seconds, markers appear on user's message and Actor's reply appears
- User can:
  - Click a marker to see the popover
  - Click the ✨ button on their bubble to see native rewrite
  - Open the Teacher widget any time
  - Continue typing the next message
  - Switch to a different chat via the History sidebar (current chat is saved automatically)
  - Click "New Chat" to start fresh (picks scenario again)

### 3.3 Sessions and continuity

The mental model is **ChatGPT / Claude**: sessions never "end." A session is just an ongoing chat that you can return to anytime.

- Every chat persists indefinitely
- User can switch between past chats freely (History sidebar)
- User can resume any past chat by clicking it
- No "End Session" button. No "done" command. No forced transitions.
- Closing the tab is fine — chat is saved, resume later
- User can have multiple chats per scenario (e.g. five different "Ordering Coffee" chats over time)

### 3.4 No review page

There is no separate review page. The chat itself IS the review:
- Markers are inline on every user message (Reviewer output preserved per message)
- ✨ Native rewrite button on every user bubble
- Teacher widget is always available — user can ask anything about any past message
- User scrolls up to see past mistakes and feedback

Everything that would have lived on a review page is already accessible in the chat view.

---

## 4. Frontend specification

This is the detailed UI specification.

### 4.1 Global layout (desktop, 1280px+ recommended)

```
┌─────────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────────────────────────────────────────┐   │
│ │          │ │  Top bar: Scenario name                [⚙]  │   │
│ │ Sidebar  │ ├──────────────────────────────────────────────┤   │
│ │          │ │                                              │   │
│ │          │ │           Chat area (scrollable)             │   │
│ │  240px   │ │                                              │   │
│ │  fixed   │ │                                              │   │
│ │          │ │                                              │   │
│ │          │ ├──────────────────────────────────────────────┤   │
│ │          │ │  Input bar                          [Send]   │   │
│ └──────────┘ └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

**Sidebar (left, 240px fixed width)**
- User profile block at top (avatar + name)
- "New Chat" button (primary action) — opens scenario picker
- Chat list below (this is the History): every chat user has ever created
  - Each item: scenario icon, chat title (defaults to scenario name + date, user can rename), relative date
  - Click to open and continue that chat
  - Newest first; long lists scroll
  - Right-click or hover menu: Rename, Delete
- Collapsible to icon-only at narrower widths

**Top bar (~56px height)**
- Left: scenario icon + scenario name (e.g. "☕ Ordering Coffee")
- Right: settings gear (chat options like rename, delete)
- No "End Session" button — sessions never end

**Chat area**
- Scrollable, takes all available vertical space
- AI (Actor) messages on the left, user messages on the right
- Auto-scrolls to bottom on new message
- Messages appear with a subtle fade-in animation (~200ms)

**Input bar (~80px height, fixed at bottom)**
- Single-line text input that expands up to 4 lines as user types
- Send button (primary color, disabled when input is empty)
- Enter to send, Shift+Enter for new line

### 4.2 Message bubbles

**Actor message (left-aligned)**
- Small character label above bubble (e.g. "BARISTA") in uppercase, small, muted
- Optional character avatar (32px circle) to the left
- Bubble: rounded corners, light neutral background (e.g. #F4F4F6)
- Text: dark gray, body font, 15–16px
- Max width: ~560px or 70% of chat area, whichever is smaller

**User message (right-aligned)**
- "YOU" label above bubble (or skip it for cleaner look)
- Bubble: primary brand color background (e.g. dark indigo), white text
- Same rounding, same max width
- Below the bubble (or in a small action row): ✨ Native rewrite button

### 4.3 Markers (underlines on user messages)

Markers appear as underlines beneath the affected text span on user messages.

**Visual specification**

| Category | Underline color | Purpose |
|---|---|---|
| Grammar | Red (#EF4444) | Tense, agreement, articles, plurals |
| Word choice | Amber (#F59E0B) | Wrong word, Tinglish, collocations |
| Preposition | Orange (#FB923C) | in/on/at/to/for issues |
| Tone | Blue (#3B82F6) | Too blunt, too formal, wrong register |
| Style | Gray (#94A3B8) | Unnatural but technically correct |

**Severity** affects underline weight, not color:
- **Major** — solid underline, 2px (breaks meaning or clearly wrong)
- **Minor** — solid underline, 1.5px (wrong but understandable)
- **Suggestion** — dotted underline, 1.5px (natural-sounding improvement only)

Note: `style` is a CATEGORY (unnatural but technically correct), not a severity. Don't confuse them.

**Hover state**: span gets a subtle background tint matching the category color at ~10% opacity, cursor becomes pointer.

**Active state** (popover open for this marker): solid background fill at ~20% opacity matching category color.

**No marker means no underline.** A perfect message has zero underlines and no visual indicators of perfection (no green check). The absence is the positive feedback.

### 4.4 Marker popover

Triggered when user clicks an underlined span.

**Anchoring**
- Anchors to the clicked span with a small triangular pointer
- Positions itself to avoid covering the source message — algorithm:
  1. Prefer below the message bubble
  2. If no space below, try above
  3. If still no space, try right of bubble
  4. Never overlap the bubble itself
- Stays in viewport (auto-adjusts horizontal position to fit)

**Dimensions**
- Width: 320px (fixed)
- Height: sized to content, max 480px (scrolls internally if longer)
- Z-index: above messages, below modals

**Appearance**
- Background: white (#FFFFFF) with subtle border (#E5E7EB, 1px)
- Border radius: 12px
- Shadow: soft drop shadow, e.g. `0 8px 24px rgba(0,0,0,0.08)`
- Pointer triangle: 8px, matches background + border

**Structure** (top to bottom)

```
┌──────────────────────────────────────┐
│ ● grammar · major          1/3   ✕  │  ← header
├──────────────────────────────────────┤
│                                      │
│  I want order                        │  ← diff section
│       ↓                              │
│  I would like to order               │
│                                      │
├──────────────────────────────────────┤
│  Why                                 │  ← why section
│  "Want" is direct; in service        │
│  contexts "would like to" is the     │
│  natural polite form. "To" is        │
│  required before the verb.           │
├──────────────────────────────────────┤
│  Other ways to say it                │  ← alternatives
│  · Can I order a coffee?             │
│  · I'll have a coffee.               │
├──────────────────────────────────────┤
│            ←  1 of 3  →              │  ← navigation
└──────────────────────────────────────┘
```

**Header row**
- Left: small colored dot matching category + category name + ` · ` + severity (e.g. `● grammar · major`)
- Right: marker position indicator `1/3` (if multiple markers on this message) + close X
- All text in muted gray (#6B7280), small (12–13px), uppercase tracking

**Diff section**
- "Wrong" text shown with strikethrough, colored faintly (e.g. red tint background)
- Arrow or "→" between them
- "Fix" text shown bold, full opacity
- Both at body size (15–16px)

**Why section**
- Section label "Why" in small caps, muted
- Explanation in 1–3 sentences
- **Tone: factual and adult, not cheerleader.** Avoid "magic phrase!", "super polite!", "great job!". Treat the user as a working adult.
- Plain English, no jargon (don't say "modal auxiliary verb"; say "polite request form" if needed)

**Alternatives section**
- Section label "Other ways to say it" in small caps, muted
- 1–3 bulleted alternatives
- Each is a natural, native phrasing — not corrections, but variations
- Optional context tag per alternative (e.g. "(casual)", "(formal)")

**Navigation row**
- Only appears if the message has more than 1 marker
- Left arrow ← / position text `1 of 3` / right arrow →
- Arrows are disabled at the ends (can't go before 1 or past N)
- Clicking arrow switches popover content to the next marker AND highlights the corresponding underline in the message (active state)

**Dismissal**
- Click X
- Click outside the popover
- Press Escape

**Animation**
- Fade + slight scale-in (200ms ease-out)
- Fade out on dismiss (150ms)

### 4.5 Native rewrite (per message)

Triggered by a ✨ button on user message bubbles.

**Button placement**
- Small icon button (~28px square) attached below the bubble, right-aligned
- Subtle, mostly transparent until hover
- Tooltip on hover: "Show native version"

**Behavior**
- Click → button transitions to "loading" state if rewrite isn't cached yet (it should be, since Reviewer generates it with the markers)
- An inline card slides down below the bubble showing the rewrite
- Card is dismissible via a small X in its corner or by clicking the ✨ again
- If Reviewer output is pending, the button stays in loading state until `native_rewrite` arrives
- If Reviewer output failed, the button follows the same "Review unavailable" retry behavior as markers; retrying Reviewer fills both markers and native rewrite

**Inline rewrite card**

```
                                     ┌─────────────────────────────┐
                                     │ Hi, I want order a coffee.  │  ← original
                                     └─────────────────────────────┘  ✨
                                     ┌─────────────────────────────┐
                                     │ NATIVE                    ✕ │
                                     │                             │
                                     │ Hi, can I get a coffee      │  ← rewrite
                                     │ please?                     │
                                     └─────────────────────────────┘
```

**Card appearance**
- Right-aligned, same max-width as the message bubble
- Background: very pale tint of brand color (e.g. indigo at 5% opacity) or off-white
- Border: 1px subtle
- Border radius: 12px
- Label "NATIVE" in small caps, muted, with sparkle icon
- Text: 15–16px, regular weight

**Important**
- Works on ANY user message, even messages with zero markers
- Reason: a grammatically perfect message can still have a more natural alternative
- One rewrite per message, no variations (alternatives live inside marker popovers)

### 4.6 Teacher floating widget

A persistent floating chat bubble in the bottom-right of the screen, available throughout the roleplay chat.

**Collapsed state (default)**
- Circular button, 56px diameter
- Fixed position: bottom-right, 24px from edges
- Icon: graduation cap, owl, lightbulb, or similar "teacher" symbol
- Subtle hover effect (slight scale up + shadow deepen)
- Optional unread indicator dot if the user previously had a Teacher conversation here
- Always visible, sits above all chat content (z-index above chat, below modals/popovers)

**Expanded state**
- Click the bubble → widget expands into a floating chat panel
- Dimensions: 380px wide × 560px tall
- Position: anchored to bottom-right, 24px from edges
- Background: white with strong shadow, distinct from the main chat
- Visually clearly separate from the roleplay (different background, border treatment)
- Does NOT block the roleplay — user can still see chat messages behind/beside the widget
- The roleplay chat continues to function while Teacher is open

**Widget header (~56px)**
- Left: small icon + "Teacher" label
- Right: minimize button (collapse back to bubble) + close button (collapse panel; history remains saved)
- Background: slightly tinted from white for visual separation

**Widget body**
- Scrollable chat area
- Teacher messages on the left (compact bubbles)
- User questions on the right
- Plain text rendering with basic markdown support (bold, italics, lists)
- Auto-scrolls to bottom on new message
- Empty state: short prompt like "Ask me anything about the conversation."

**Widget input (~56px at bottom)**
- Single-line input that expands up to 3 lines
- Send button or Enter to send
- Stays enabled while Teacher is generating; submitted questions queue behind the active response

**Behavior**
- Teacher chat persists per roleplay session — closing the widget doesn't lose history
- Reopening the widget shows full previous conversation
- If user returns to this session from History, the Teacher chat is still there
- Each roleplay session has its own separate Teacher chat (not shared across sessions)

**During an active Teacher response**
- Typing indicator (3 animated dots) in a Teacher bubble while waiting
- User can still type their next question; it queues

**Mobile note**: Not applicable in v1 (desktop only), but if mobile is added: widget becomes full-screen overlay when expanded.

### 4.7 (Removed — there is no session review page; see §3.4)

### 4.8 Home / scenario picker

Where users land after login.

**Structure**
- Top: "Hi, [name]" greeting
- Section: "Pick a scenario"
- Grid of scenario cards (3–4 columns on desktop)

**Scenario card**
- Icon (emoji or simple illustration)
- Title (e.g. "Ordering Coffee")
- One-line description ("Practice ordering at a cafe")
- Category tag (Daily / Work / Social)
- Hover state: slight lift + shadow

**Initial implementation scenario**
- Ordering Coffee (Daily)

**Additional v1 scenarios** (add during polish after the core loop works)
- Hotel Check-in (Daily)
- Restaurant Reservation (Daily)
- Doctor's Appointment (Daily)
- Job Interview (Work)
- Client Meeting Intro (Work)
- Stand-up Update (Work)
- Email Reply Practice (Work)
- Catching Up with a Friend (Social)
- Small Talk at a Party (Social)

### 4.9 History (chat list in sidebar)

There's no separate "History view" — the sidebar IS the history. Every chat ever created lives there.

- Default sort: newest activity first
- Each item: scenario icon, chat title (auto-generated as "Ordering Coffee · Nov 25" by default), relative date
- Click → open that chat in the main view, continue from where it left off
- Hover/right-click actions: Rename chat, Delete chat
- Delete is permanent and shows a confirmation
- Very long histories scroll inside the sidebar

### 4.10 Typography & color system

**Font choices** (suggestions, pick one direction)
- Display / headers: distinctive sans-serif (e.g. Söhne, GT America, Geist)
- Body: clean sans-serif (avoid Inter, Roboto — too generic)
- Mono (for occasional code-like elements): JetBrains Mono or similar

**Color palette**

```
Primary brand:    #4F46E5 (indigo)        — user bubble, buttons
Background:       #FAFAFA                 — page background
Surface:          #FFFFFF                 — cards, popovers
Surface alt:      #F4F4F6                 — Actor bubbles
Border subtle:    #E5E7EB                 — dividers
Text primary:     #1F2937                 — body text
Text secondary:   #6B7280                 — labels, hints
Text muted:       #9CA3AF                 — meta text

Category colors:
Grammar:          #EF4444 (red)
Word choice:      #F59E0B (amber)
Preposition:      #FB923C (orange)
Tone:             #3B82F6 (blue)
Style:            #94A3B8 (gray)
```

### 4.11 Empty / loading / error states

**Empty chat** (just entered scenario)
- If Actor speaks first: small loading indicator while waiting for first message
- If user speaks first: small placeholder text in input "Start the conversation..."

**Loading after user sends**
- User message appears immediately (optimistic)
- Small typing indicator on Actor side (3 animated dots)
- Markers appear when Reviewer response arrives (typically before Actor's, but UI shouldn't block on order)

### 4.12 Partial LLM failure handling

Since Actor and Reviewer run in parallel, four cases can occur. Each has a defined behavior:

**Case 1: Both succeed (normal case)**
- User message saved with reviewer_output
- Actor reply appears as new bubble
- Markers render on user message

**Case 2: Actor fails, Reviewer succeeds**
- User message saved with reviewer_output (markers appear)
- Where Actor reply would be: error bubble with "Couldn't reply. Retry" button
- Input bar is DISABLED until Actor either retries successfully or user clicks small "Skip" link
- Reasoning: continuing without Actor's reply breaks the conversation flow
- Retry calls only the Actor (Reviewer output is already saved)

**Case 3: Actor succeeds, Reviewer fails**
- User message saved without reviewer_output (no markers)
- Actor reply appears normally
- Small "Review unavailable" badge attached to user message with retry icon
- Input bar stays ENABLED — user continues chatting
- Reasoning: Reviewer is supplementary, shouldn't block conversation
- Retry calls only the Reviewer; markers appear retroactively on success

**Case 4: Both fail**
- User message saved (just text, no reviewer_output)
- Single error indicator at bottom of message: "Couldn't get a reply. Click to retry."
- Input bar DISABLED until retry succeeds
- Retry attempts both Actor and Reviewer again

**Late-arriving Reviewer output** (when Reviewer succeeds slowly, after user has already sent another message)
- Markers appear retroactively on the earlier message
- No special UI animation; just render when data arrives

**Network error (no response at all)**
- Toast at bottom: "Connection lost. Click to retry."
- User's typed message is preserved in the input bar so it can be re-sent
- No duplicate sends — retry uses the same client-side message ID

**Retry rules**
- All retries use the original user message text — not editable
- Maximum 3 automatic retries on transient errors before manual retry button appears
- Retries are idempotent (use same message ID) to prevent duplicate Actor replies

---

## 5. Reviewer output format

The Reviewer LLM returns JSON. The frontend renders from this directly.

Implementation requirement: use OpenAI Structured Outputs with a strict JSON schema for Reviewer responses. Do not rely on loose "return valid JSON" prompting alone. Validate that each `span_text` appears in the latest user message before rendering.

### 5.1 Schema

```json
{
  "markers": [
    {
      "id": "m1",
      "span_text": "want order",
      "category": "grammar",
      "severity": "major",
      "wrong": "I want order",
      "fix": "I would like to order",
      "why": "In service contexts, 'would like to' is the natural polite form. 'To' is required before the verb 'order.'",
      "alternatives": [
        "Can I order a coffee?",
        "I'll have a coffee."
      ]
    }
  ],
  "native_rewrite": "Hi, can I get a coffee please?"
}
```

### 5.2 Field definitions

- `id`: unique marker ID within this message (used for UI keying)
- `span_text`: the EXACT substring of the user's message that should be underlined. Frontend will search the user's message for this string to compute character offsets for rendering. If span_text does not appear in the message exactly, the marker is silently dropped (logged for debugging).
- `category`: one of `grammar | word_choice | preposition | tone | style`
- `severity`: one of `major | minor | suggestion` (NOT `style` — that's a category)
- `wrong`: the wrong fragment as user wrote it (used for display in the diff)
- `fix`: the corrected fragment (used for display in the diff)
- `why`: short explanation, adult tone, 1–3 sentences
- `alternatives`: 1–3 natural alternative phrasings (optional, can be empty array)
- `native_rewrite`: a polished version of the entire user message (always present, even if no markers)

### 5.3 Offset resolution

The frontend computes underline positions by searching `span_text` in the user's message:
- First occurrence wins if span_text appears multiple times
- Case-sensitive match
- If no match: drop the marker, log warning, do not display
- If overlapping markers detected: keep the more severe one, drop the others, log warning

This avoids the LLM-generates-character-offsets bug entirely. Tradeoff: if the same wrong phrase appears twice in a message and only one instance is wrong, we'll mark the first. Acceptable for v1.

### 5.4 Edge cases

- Empty markers array → message had no issues, but native_rewrite is still useful
- Multiple issues in same span → one marker, multiple issues described in why (rare)
- Overlapping markers from LLM → frontend keeps more severe, drops others (see 5.3)
- span_text not found in message → marker silently dropped (see 5.3)

---

## 6. Actor behavior specification

### 6.1 In-character rules

The Actor:
- Always responds in character. Never mentions grammar, English learning, or that this is practice.
- Speaks at the user's apparent level. If user writes short simple sentences, Actor responds with short simple sentences. If user writes longer fluent sentences, Actor matches.
- Uses natural conversational English, not textbook English.

### 6.2 Handling user mistakes

When user makes mistakes, Actor behaves like a real human (in priority order):

1. **Understand and proceed** (~80% of cases). If meaning is clear despite errors, just respond as if it were correct.
2. **Mirror back correct form** (~10%). Occasionally rephrase user's content using correct English in the reply. E.g. user: "I go there yesterday." Actor: "Oh, you went there yesterday? How was it?"
3. **Ask clarifying question** (~7%). When meaning is genuinely ambiguous, ask a natural clarifying question. E.g. "Do you mean today or tomorrow?"
4. **Express confusion** (~3%). Only for truly broken sentences. E.g. "Sorry, I didn't quite catch that?"

Actor never:
- Says "Did you mean X?" as a correction
- Mentions grammar
- Praises the user
- Breaks character

### 6.3 Scenario start

Each scenario has a starter rule:
- Some begin with Actor speaking first (e.g. cafe — barista greets)
- Some begin with user speaking first (e.g. friend chat — user initiates)
- Defined in scenario config

### 6.4 No scenario end behavior

Sessions don't end. Actor doesn't need wrap-up logic. If user stops responding, the chat just sits there until user returns or starts something new.

---

## 7. Data model

### 7.1 Tables

**users**
- id, email, name, avatar_url, created_at

**sessions**
- id, user_id, scenario_id, title (default auto-generated, user can rename), started_at, last_message_at, created_at
- actor_provider_thread_id, reviewer_provider_thread_id, teacher_provider_thread_id (nullable; used when the selected LLM provider supports role-specific durable threads/sessions)

Note: there is no `status` field. Sessions don't have states — they're just chats that exist and can always be resumed.

**messages**
- id, session_id, role (user | actor), content, created_at
- client_message_id (for user messages; unique within the session; used as the idempotency key for sends and retries)
- parent_user_message_id (for actor messages; links the Actor reply to the user message that triggered it)
- For user messages: reviewer_output (JSON, the full Reviewer response)
- For user messages: actor_status (`pending | succeeded | failed | skipped`), reviewer_status (`pending | succeeded | failed`)
- For user messages: actor_error, reviewer_error, actor_retry_count, reviewer_retry_count

**teacher_messages**
- id, session_id, role (user | teacher), content, created_at
- Tied to the roleplay session, persists forever for that session

**codex_credentials** (per-user ChatGPT/Codex subscription OAuth tokens)
- user_id (PK, FK → users), access_token, refresh_token, account_id, expires_at, updated_at
- usage_snapshot (jsonb), usage_captured_at — latest rate-limit usage (5h primary + weekly secondary windows), parsed from Codex `x-codex-*` response headers on each call
- One row per user; written/read only by the server (service-role); RLS enabled with no policies so it is never client-readable
- Holds the user's linked OpenAI account so their LLM calls bill to their own subscription

A per-user **Usage page** (`/usage`, `GET /api/codex/usage`) shows the latest
5-hour and weekly limit windows (used percent + reset time) for the signed-in
user. This is read-only; it does not change the §1.4 "no progress dashboard"
non-goal (it reports subscription rate-limit state, not learning progress).

**scenarios** (static config, NOT in database — stored as JSON file in codebase)
```
{
  "id": "ordering_coffee",
  "name": "Ordering Coffee",
  "description": "Practice ordering at a cafe",
  "category": "daily",
  "icon": "☕",
  "starter": "actor",
  "actor_role": "A friendly barista at a busy cafe",
  "actor_setting": "The Daily Grind cafe, mid-morning, moderately busy",
  "actor_personality": "Warm but efficient, asks questions to be helpful",
  "scenario_context": "Menu has espresso, latte, cappuccino, drip coffee, pastries. Prices not important. Cash or card both fine.",
  "user_role": "A customer ordering coffee",
  "starter_instruction": "Greet the customer warmly and ask what they'd like to order."
}
```

Stored in codebase as `scenarios.json` or similar. Easy to version control and edit. Each scenario provides all the variables that the Actor and Reviewer prompts need.

### 7.2 Privacy
- User chats are private to each user
- No sharing, no public visibility
- Email-based authentication; only emails on an allowlist (env var) can sign up
- Magic-link login (no passwords) — handled by Supabase Auth or similar

### 7.3 API contract

The backend exposes these operations:

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/sessions` | Create new session for a scenario (returns session_id) |
| GET | `/sessions/:id` | Fetch full session: messages, reviewer outputs, teacher chat |
| PATCH | `/sessions/:id` | Update session metadata (rename) |
| DELETE | `/sessions/:id` | Delete session permanently |
| POST | `/sessions/:id/messages` | Send user message with a client_message_id; triggers Actor + Reviewer in parallel; returns the saved user message, per-call statuses, and any completed Actor reply / Reviewer output |
| POST | `/messages/:id/retry` | Retry the failed call(s) for a user message (actor, reviewer, or both) |
| GET | `/sessions/:id/teacher` | Fetch teacher chat history for this session |
| POST | `/sessions/:id/teacher` | Send teacher question; returns teacher reply |
| GET | `/sessions` | List user's chats (the History sidebar data) |
| GET | `/scenarios` | List available scenarios |

Notes:
- All endpoints require authenticated user
- `/sessions/:id/messages` is the hot path — runs two LLM calls in parallel, may take 2-5 seconds
- `/sessions/:id/messages` treats `client_message_id` as an idempotency key so connection retries do not create duplicate user messages or Actor replies
- If the backend returns before both Actor and Reviewer calls settle, late results must update the same user message by ID via session refetch, polling, realtime, or another chosen transport
- Retry endpoint identifies which sub-call failed and retries only that one
- The `:id` in `/messages/:id/retry` is the original user message ID, not the Actor reply ID
- No "end session" endpoint exists — sessions don't end

---

## 8. Build sequence (recommended)

Suggested phasing if vibe-coding solo. Note: data schema includes everything from day 1, even fields used in later phases. Avoids painful migrations.

**Phase 1: Foundation**
- Auth (magic link via Supabase, email allowlist)
- Database schema for all tables (users, sessions, messages, teacher_messages)
- Scenarios JSON in codebase, starting with Ordering Coffee
- Basic layout: sidebar + chat view + input

**Phase 2: Core chat loop (Actor only, no Reviewer)**
- Scenario picker on home page
- Working chat with Actor LLM
- Save user and Actor messages to DB
- History sidebar showing past sessions
- Active session resume flow

**Phase 3: Reviewer + markers**
- Add parallel Reviewer LLM call to message-send endpoint
- Render markers on user messages (subtle underline, single color first)
- Save reviewer output to DB
- Partial failure handling (Case 2, 3, 4 from §4.12)

**Phase 4: Marker popover**
- Click marker → popover with full content
- Navigation between markers (arrows)
- Category color coding

**Phase 5: Native rewrite**
- ✨ button on user messages
- Inline rewrite card display

**Phase 6: Teacher widget**
- Floating bubble UI
- Expand to chat panel
- Teacher LLM with full conversation + Reviewer context
- Persistent teacher chat per session

**Phase 7: Polish**
- Add more scenarios (10+)
- Chat rename and delete
- Animations and micro-interactions
- Comprehensive error states
- Empty states across all views

---

## 9. Prompts

Prompts are the heart of this product. Both LLMs need careful prompting to behave correctly. Expect significant iteration here — the prompts below are starting points, not final.

### 9.1 Actor system prompt

```
You are playing a character in a roleplay conversation with someone practicing
English. Your job is to make the conversation feel like a real human interaction.

## YOUR CHARACTER

Scenario: {{scenario_name}}
Your role: {{actor_role}}
Setting: {{actor_setting}}
Your personality: {{actor_personality}}

## CORE RULES

1. Stay in character at all times. You are NOT an English teacher. You are a real
   person in this scenario. Never mention English, grammar, learning, practice,
   AI, or that this is a roleplay.

2. Match the user's English level. If they write short simple sentences, you
   write short simple sentences. If they write longer fluent sentences, you can
   too. Never use words much harder than what the user is using.

3. Speak like a real person, not a textbook. Use contractions (I'm, you're,
   don't). Use natural casual phrases ("sure thing", "no worries", "got it").
   Avoid overly formal or perfect English unless your character would speak
   that way.

4. Keep responses short. 1-3 sentences is usually right. Real people don't give
   speeches in conversation.

## HANDLING USER MISTAKES

The user will make English mistakes. Do NOT correct them. Behave like a real
human meeting someone whose English is imperfect:

- DEFAULT (most of the time): Just understand what they meant and respond
  naturally as if they said it correctly. Real people fill in gaps constantly.

- SOMETIMES: Naturally use the correct form in your reply, without making a
  point of it. Example:
    User: "I go there yesterday"
    You: "Oh, you went there yesterday? How was it?"
  Notice: you don't say "you mean 'went'". You just use it naturally.

- WHEN MEANING IS GENUINELY UNCLEAR: Ask a clarifying question like a real
  person would. Use specific guesses, not vague "what?". Example:
    User: "I want one not too hot"
    You: "Sure, do you mean an iced one, or just warm not hot?"

- RARELY (only for truly broken sentences): Show confusion naturally.
  Example: "Sorry, I didn't quite catch that — could you say it another way?"

Never:
- Say "Did you mean X?" as a way to correct
- Praise the user's English
- Break character to teach
- Use "I" statements about being an AI

## SCENARIO CONTEXT

{{scenario_context}}

## STARTING THE CONVERSATION

Use this only when generating the first Actor message in a new session. For all
later Actor replies, continue naturally from the conversation history instead.

{{starter_instruction}}
```

**Scenario variables** (per scenario in config):

| Variable | Example for "Ordering Coffee" |
|---|---|
| scenario_name | Ordering Coffee |
| actor_role | A friendly barista at a busy cafe |
| actor_setting | The Daily Grind cafe, mid-morning, moderately busy |
| actor_personality | Warm but efficient, asks questions to be helpful |
| scenario_context | Menu has espresso, latte, cappuccino, drip coffee, pastries. Prices not important. Cash or card both fine. |
| starter_instruction | You speak first. Greet the customer and ask what they'd like to order. |

### 9.2 Reviewer system prompt

```
You are a silent English reviewer analyzing a message a Thai speaker just wrote in
an English roleplay practice conversation. You are NOT visible to the user —
you only return structured data that a UI will render.

## YOUR JOB

Analyze the user's message for issues that prevent it from sounding natural to
a native English speaker. Return a JSON object describing each issue and a
fully natural rewrite of the whole message.

## WHAT TO FLAG

Flag issues in these categories:

1. grammar — articles (a/an/the), verb tenses, subject-verb agreement,
   plurals, modals
2. word_choice — wrong word, Thai-English direct translation, awkward
   collocations (e.g. "open the light" → "turn on the light")
3. preposition — wrong or missing prepositions (in/on/at/to/for)
4. tone — too blunt, too formal, wrong register for the scenario
5. style — technically correct but unnatural phrasing

## SEVERITY LEVELS

- major — breaks meaning OR is clearly wrong English (must fix)
- minor — wrong but understandable (should fix)
- suggestion — natural-sounding improvement only (nice to fix)

Calibrate carefully. Most messages should have 0-2 markers. If you find
yourself flagging 5+ things in a short message, you're over-flagging — keep
only the most important ones.

## TONE OF FEEDBACK

The user is a working adult. Write the "why" field like you would explain to
an intelligent colleague:

- Factual and brief (1-3 sentences max)
- No exclamation points, no "great job", no "magic phrase"
- No grammar jargon ("modal auxiliary verb"). Use plain language.
- Don't apologize, don't soften unnecessarily
- Direct and useful, like Strunk & White, not like a sticker reward chart

## OUTPUT FORMAT

Return ONLY valid JSON in this exact shape, no other text:

{
  "markers": [
    {
      "id": "m1",
      "span_text": "<exact substring from user message>",
      "category": "grammar" | "word_choice" | "preposition" | "tone" | "style",
      "severity": "major" | "minor" | "suggestion",
      "wrong": "<the wrong fragment with minimal context>",
      "fix": "<the corrected fragment>",
      "why": "<short adult-tone explanation>",
      "alternatives": ["<alt 1>", "<alt 2>"]
    }
  ],
  "native_rewrite": "<fully natural rewrite of the entire user message>"
}

## CRITICAL FORMATTING RULES

- span_text MUST be a substring that appears EXACTLY in the user's message
  (case-sensitive). The frontend will search for this string to underline it.
- Do NOT include character offsets — the frontend computes them.
- If no issues found, return markers: [] but still include native_rewrite.
- native_rewrite is ALWAYS present, even when message is already perfect (in
  that case, native_rewrite can equal the original message OR offer a slight
  natural variation).
- alternatives can be empty array if no good alternatives exist.
- severity values are: major (breaks meaning), minor (wrong but
  understandable), suggestion (natural improvement only). Note: "style" is
  a CATEGORY, not a severity.
- Do NOT include markdown, code fences, comments, or any text outside the
  JSON object.

## SCENARIO CONTEXT (for tone calibration)

Scenario: {{scenario_name}}
Setting: {{actor_setting}}
User's role: {{user_role}}

Use this to judge tone/register. A casual chat with a friend has different
expectations than a job interview.

## ROLEPLAY CONTEXT

Roleplay conversation so far:
{{roleplay_conversation}}

Current user message to review: {{user_message}}

Use the roleplay conversation only to understand what the current user message
means and what tense, references, tone, and register fit. Do NOT mark or
rewrite Actor messages. Do NOT mark earlier user messages. Every marker must
refer only to exact text from the current user message.
```

### 9.3 Worked example — Actor

**Input:**
- Scenario: Ordering Coffee
- Conversation so far:
  - Actor: "Hi there! Welcome to The Daily Grind. What can I get for you?"
  - User: "Hello, I want one coffee hot please"

**Expected Actor output:**

> "Sure! Would you like that as a latte, drip, or something else?"

Notes on what makes this good:
- Treats "I want one coffee hot" as understood (no clarification needed for meaning)
- Asks a natural clarifying question about *what kind* of coffee, which is what a real barista would do
- Doesn't correct "one coffee hot please"
- Short, casual, matches user's simple register

**Bad Actor outputs to avoid:**
- ❌ "Did you mean 'a hot coffee'?" (corrects, breaks character)
- ❌ "Certainly! May I inquire as to your preference of bean varietal?" (over-formal, doesn't match user level)
- ❌ "Great job ordering in English!" (praises, breaks character)
- ❌ "I'd be happy to prepare a hot coffee for you. We have several options including but not limited to..." (too long)

### 9.4 Worked example — Reviewer

**Input:**
- Scenario context: Ordering Coffee, casual register
- Roleplay conversation so far:
  - Actor: `"Hi there! Welcome to The Daily Grind. What can I get for you?"`
  - User: `"Hello, I want one coffee hot please"`
- Current user message: `"Hello, I want one coffee hot please"`

**Expected Reviewer output:**

```json
{
  "markers": [
    {
      "id": "m1",
      "span_text": "I want one coffee hot",
      "category": "grammar",
      "severity": "major",
      "wrong": "I want one coffee hot",
      "fix": "I'd like a hot coffee",
      "why": "Three issues: in service contexts 'I'd like' is more natural than 'I want', in English adjectives come before the noun ('hot coffee' not 'coffee hot'), and use 'a' not 'one' for ordering.",
      "alternatives": [
        "Can I get a hot coffee?",
        "I'll have a hot coffee, please."
      ]
    }
  ],
  "native_rewrite": "Hi, can I get a hot coffee please?"
}
```

Notes on what makes this good:
- One marker covering multiple related issues (rather than 3 separate tiny markers)
- "Why" explains in plain language, factual tone
- Alternatives are natural variations a native would actually say
- Native rewrite is conversational, not formal
- Tone respects the user as an adult

**Bad Reviewer outputs to avoid:**
- ❌ Three separate markers for "want", "one coffee", "coffee hot" — over-fragmented
- ❌ "Why: Great effort! Remember that in English we typically use adjective-noun order! 🌟" — cheerleader
- ❌ Why uses "predicative adjective" or other jargon
- ❌ Returns markdown code fences around the JSON
- ❌ Forgets `native_rewrite` field

### 9.5 Teacher system prompt

```
You are a friendly, knowledgeable English teacher helping a Thai speaker who is
practicing English through a roleplay conversation. The user has been
practicing with an AI character in a specific scenario, and a separate AI
reviewer has been marking their mistakes silently. The user can now ask you
anything about the conversation.

## WHAT YOU CAN SEE

You have full context of:
1. The entire roleplay conversation (every message from the user and the
   character they're talking to)
2. Every mistake the reviewer flagged on the user's messages, including the fix,
   the explanation, and the native rewrite
3. All previous questions the user has asked you in this session, and your
   previous answers

You should refer to specific moments in the conversation when relevant.

## HOW TO RESPOND

- Answer the user's actual question, directly. Don't pad.
- Use concrete examples from the roleplay whenever possible — say "in your
  message 'I want order a coffee', the issue was..." instead of speaking in
  abstractions.
- Be conversational, like a friend who happens to be a teacher. Not a textbook.
- Keep responses appropriately short. 2-5 sentences for simple questions.
  Longer only when the question genuinely needs it.
- It's fine to use Thai words or short phrases if the user writes in Thai or
  asks for Thai explanations. Match the language the user is comfortable with.
- Use simple English unless the user is clearly fluent.
- Use plain language — no grammar jargon ("predicative adjective"). Say
  "describing word" if you must.

## TONE

You are NOT the Reviewer. You don't return JSON. You don't mark mistakes. You
have a normal conversation.

You ARE a patient, encouraging teacher. Treat the user as an intelligent adult
who is learning. Don't be condescending. Don't be a cheerleader either. Just
be useful.

## QUESTIONS YOU MIGHT GET

- "Why was this wrong?" → Explain the rule using their specific example.
- "How would a British person say this?" → Give the regional variation.
- "Explain in Thai." → Switch to Thai for the explanation.
- "Give me more examples." → Provide 3-5 examples in different contexts.
- "Would this sound rude?" → Honest assessment of register and tone.
- "What's the difference between X and Y?" → Clear comparison with examples.
- "Did I do well?" → Honest, specific feedback. Not "great job!" — point to
  actual strengths and weaknesses.

## WHAT NOT TO DO

- Don't break character of the Actor when discussing it. Don't say "the AI
  pretending to be a barista". Say "the barista" or "your conversation
  partner".
- Don't repeat what the Reviewer already said. If the user asks "why is this
  wrong" and the Reviewer's "why" field already explains it, build on that
  rather than restating.
- Don't generate fake mistakes or fake conversation parts. Only refer to
  things that actually happened.
- Don't moralize, don't lecture about language learning generally. Stay
  focused on the user's actual question.

## CONTEXT BELOW

The roleplay conversation, reviewer outputs, and prior teacher chat are provided
below in structured form. Reference them as needed.
```

**Input structure** (what you pass to the Teacher on each request):

```
<roleplay_conversation>
[Actor]: Hi there! Welcome to The Daily Grind. What can I get for you?
[User]: Hello, I want one coffee hot please
[Actor]: Sure! Would you like that as a latte, drip, or something else?
[User]: Drip please
...
</roleplay_conversation>

<reviewer_outputs>
Message 2 ("Hello, I want one coffee hot please"):
- Issue: "I want one coffee hot" → "I'd like a hot coffee"
  Category: grammar (major)
  Why: Three issues: 'I'd like' is more natural than 'I want' in service
  contexts, adjectives come before nouns in English, and use 'a' not 'one'
  for ordering.
  Alternatives: "Can I get a hot coffee?", "I'll have a hot coffee, please."
- Native rewrite: "Hi, can I get a hot coffee please?"
</reviewer_outputs>

<prior_teacher_chat>
[User]: why did you mark 'want' as wrong?
[Teacher]: Saying "I want" isn't grammatically wrong, but in a cafe or shop
it can sound a bit direct. Most native speakers say "I'd like" or "Can I
get" to sound more polite. It's a register choice, not a grammar error.
</prior_teacher_chat>

<new_question>
What's the difference between "I'd like" and "I would like to"?
</new_question>
```

### 9.6 Worked example — Teacher

**User question**: "What's the difference between 'I'd like' and 'I would like to'?"

**Expected Teacher output:**

> They're actually almost the same — "I'd like" is just the contracted (shortened) form of "I would like". You'll hear both.
>
> The "to" part only matters when a verb comes next:
> - "I'd like **a coffee**." (noun, no 'to')
> - "I'd like **to order** a coffee." ('to' before the verb)
>
> So in your message earlier, "I'd like to order a coffee" needs the 'to' because 'order' is a verb. If you just say "I'd like a coffee" without ordering specifically, no 'to'.
>
> Both contracted ("I'd") and full ("I would") work fine — contracted is more casual, full is slightly more formal. In a cafe, contracted is more natural.

Notes on what makes this good:
- Answers the actual question directly
- Refers to the user's own message
- Concrete examples in bullets
- Adult tone, no praise, no jargon
- Brief but complete

### 9.7 Iteration notes (Teacher)

Things to watch for:

- *Teacher restating Reviewer feedback verbatim.* If the user asks "why is this wrong" right after the Reviewer flagged it, Teacher should build on the Reviewer's "why" field, not repeat it. Add stronger prompt guidance if you see repetition.
- *Teacher breaking the fourth wall.* If user asks about the barista, Teacher might say "well, the AI playing the barista..." which is jarring. Prompt should reinforce treating Actor as the character, not the AI.
- *Generic textbook answers.* Teacher should ground answers in the user's actual messages. If it gives generic answers without referring to the roleplay, push the prompt harder on "use concrete examples from the conversation".
- *Cost.* Teacher passes the entire roleplay + Reviewer outputs + prior Teacher chat on every call. Long sessions = expensive prompts. Consider truncating older Reviewer details if context gets large, or summarizing them.
- *Language switching.* Teacher should naturally use Thai when the user does. If it always responds in English, prompt may need clearer guidance.

### 9.8 Iteration notes (Actor and Reviewer)

**Actor issues to watch for:**
- *Always understanding perfectly.* Default LLM behavior is to be too smart. If Actor never asks clarifying questions, push the prompt harder on "sometimes meaning is unclear, ask a specific question." Add more examples of clarifying responses.
- *Drifting into teaching mode.* If Actor starts correcting users, add stronger negative examples in the prompt.
- *Being too long-winded.* Add explicit word count guidance like "responses should typically be 5-20 words."
- *Not matching user level.* If Actor uses vocabulary far above the user, add a rule like "use only words simpler or equal to the most complex word the user has used."

**Reviewer issues to watch for:**
- *Invalid structured output.* Use OpenAI Structured Outputs with a strict schema. Validate output server-side anyway; retry once if the provider returns an invalid or refused response.
- *span_text doesn't appear in message.* The LLM may slightly paraphrase the span. Validate that span_text is a substring of the user message; if not, drop the marker. Watch logs for frequent drops — may need stronger prompting.
- *Over-flagging.* Add explicit "if you find more than 3 issues in a short message, you're being too picky" in the prompt. Watch real outputs and tighten.
- *Cheerleader tone leakage.* Strip emojis and exclamation points from `why` fields in post-processing if needed.
- *Suggestion-severity issues marked as major.* Add examples in the prompt of correctly-calibrated severity.

**Cost considerations:**
- Actor and Reviewer run on every user message; Reviewer uses Structured Outputs and full roleplay context, so stored `reviewer_output` and provider-side cached input are important
- Teacher passes large context per question (full conversation + Reviewer outputs + prior teacher chat) → expensive but rarely called
- Actor is cheap (just conversation history)
- Default all roles to `gpt-5.4-mini`; upgrade Teacher first if explanation quality is not good enough
- Cache all LLM outputs per message/turn in DB so re-rendering doesn't re-query

---

## 10. Open questions for later

These are decisions deferred from v1:
- Should the Reviewer eventually have memory (pattern detection across sessions)?
- Should there be a "session difficulty" setting (Actor speaks more casually / formally)?
- Should we add user-created custom scenarios?
- Mobile experience (separate spec if pursued)
- Sharing a session review with someone else (e.g. teacher)
- Export session as PDF for offline study

---

## 11. Summary of key design decisions

| Decision | Choice | Reason |
|---|---|---|
| Architecture | Three-LLM (Actor + Reviewer + Teacher) | Each has distinct, focused job |
| Actor | In-character, parallel with Reviewer | Immersive roleplay |
| Reviewer | Silent, per-message, JSON output | Marker rendering |
| Teacher | On-demand floating widget, full context | Free-form Q&A about the conversation |
| Teacher persistence | Saved forever per session | User can return to ask more later |
| Memory (Reviewer) | Stateless v1 | Simpler; revisit if needed |
| Session model | ChatGPT-style — sessions never end | No forced review or graduation feel |
| Review page | Doesn't exist — chat is the review | Markers + native rewrite + Teacher inline |
| History | The sidebar IS the history | Single navigation surface |
| Correction style | Silent markers on user messages | Preserves roleplay immersion |
| Popover | One at a time, anchored to word | Direct spatial connection, simple |
| Multi-marker UX | Arrows inside popover | Faster than open/close cycle |
| Native rewrite | Per-message ✨ button | Available any time, on any message |
| Marker colors | Color-coded by category | Glanceable categorization |
| Severity values | major, minor, suggestion (NOT style) | Avoids name collision with category |
| Reviewer offsets | span_text only, frontend computes positions | Eliminates LLM character-counting bug |
| Reviewer tone | Adult, factual | Users are working adults, not kids |
| Partial failure | Actor-fail blocks, Reviewer-fail allows continue | Reviewer is supplementary |
| Auth | Magic-link + email allowlist (env var) | Simple, secure, no signup form |
| Platform | Desktop web only | Scoped, simpler |

# Implementation Spec: "Your Patterns" — `/insights`

**Status:** Ready to build. Plan-only; no code written yet.
**Goal:** A read-only page that harvests every Reviewer marker already stored in
`messages.reviewer_output` and turns it into (1) a **pattern summary** and (2)
**flashcards built from the user's real past mistakes**. No new LLM calls.
Mirrors the existing `/usage` feature end-to-end.

This document is self-contained: a fresh session should be able to implement it
without re-reading the codebase first. File/line references are anchors, not
guarantees — verify before editing.

---

## 0. Why / guardrails (don't violate these)

- **Read-only over existing data.** The Reviewer stays stateless (SPEC §2.1).
  We only analyze its *saved* `reviewer_output`. This is the read-side of the
  §10 open question "Should the Reviewer eventually have memory (pattern
  detection across sessions)?" — without giving the live Reviewer memory.
- **Pattern surface, NOT a progress dashboard.** SPEC §1.4 is a hard non-goal:
  "no progress dashboard, no streaks, points, gamification." Frame everything
  factually/adult (same Reviewer tone rules in `prompts.ts`). The `/usage` page
  is the precedent for "a read-only stats page that doesn't count as a progress
  dashboard." Concretely this means: **no** points, streaks, levels, badges,
  XP, green checks, "great job", emojis, or exclamation points. The clean-rate
  is stated as a plain fact ("12 of 40 messages had no marks"), not celebrated.
- **One pure, tested aggregator.** All reduce logic lives in a single pure
  function with a `.test.ts`, matching how `reviewer.ts` / `marker-rendering.ts`
  are pure + tested. Store backends only fetch rows and hand them to it. Do not
  put aggregation logic in the stores or the route.
- **Keep changes minimal.** No refactors. No schema migration (none needed —
  `reviewer_output` jsonb already exists on `public.messages`).

---

## 1. Data already available (the whole premise)

`public.messages.reviewer_output` is `jsonb`, populated on every user message the
Reviewer succeeds on, RLS-scoped per user, indexed by session
(`supabase/migrations/202605260001_initial_schema.sql:40-56`,
`:72-73`). Shape is `ReviewerOutput` (`src/lib/types.ts:48-51`):

```ts
type ReviewerOutput = { markers: ReviewMarker[]; native_rewrite: string };
type ReviewMarker = {
  id: string; span_text: string;
  category: "grammar" | "word_choice" | "preposition" | "tone" | "style";
  severity: "major" | "minor" | "suggestion";
  wrong: string; fix: string; why: string; alternatives: string[];
};
```

So this feature is essentially a **read** over data already persisted. The only
new "cost" is a single SELECT per page load.

---

## 2. Reference implementation to mirror: `/usage`

Build `/insights` as a near-copy of the `/usage` stack. Open these and follow
the same shapes:

| Layer | `/usage` (existing) | `/insights` (new) |
|---|---|---|
| Aggregation source | `loadUsageSnapshot(userId)` (`src/lib/server/codex/persistence.ts`) | **new** `store.getInsightRows(userId)` + pure `aggregateInsights()` |
| API route | `GET /api/codex/usage` (`src/app/api/codex/usage/route.ts`) | `GET /api/insights` |
| Page (server) | `src/app/usage/page.tsx` (1-line wrapper) | `src/app/insights/page.tsx` (1-line wrapper) |
| View (client) | `src/components/usage/UsageView.tsx` | `src/components/insights/InsightsView.tsx` |
| Sidebar entry | `BarChart3` link → `/usage` (`src/components/sidebar/Sidebar.tsx:200-205`) | new icon link → `/insights` |

---

## 3. Types — `src/lib/types.ts` (append at end)

```ts
export type MarkerStat = {
  // A normalized group of identical/near-identical wrong->fix corrections.
  wrong: string;            // representative original text (first seen, un-normalized)
  fix: string;              // representative correction (first seen, un-normalized)
  category: MarkerCategory; // category of the representative marker
  severity: MarkerSeverity; // severity of the representative marker
  count: number;            // how many times this correction recurred
  sample_sentence: string;  // a user message this appeared in (for context)
  scenario_name: string;    // scenario the sample came from
};

export type InsightFlashcard = {
  id: string;               // stable within a load: `${messageIndex}:${marker.id}`
  sentence: string;         // the full user message (front, with span highlighted)
  span_text: string;        // substring to highlight in `sentence`
  fix: string;              // back
  why: string;              // back
  category: MarkerCategory;
  scenario_name: string;
};

export type InsightsSummary = {
  messages_reviewed: number;          // user messages that had a reviewer_output
  clean_count: number;                // of those, how many had zero markers
  total_markers: number;
  by_category: Record<MarkerCategory, number>;
  by_severity: Record<MarkerSeverity, number>;
  top_fixes: MarkerStat[];            // sorted by count desc, then recency; cap 12
  flashcards: InsightFlashcard[];     // one per surviving marker; cap 60
};
```

Notes:
- `by_category` / `by_severity` must include **all** keys with 0 defaults (so the
  view can render every category in a stable order without `undefined`).
- Caps (`top_fixes` 12, `flashcards` 60) keep the payload bounded for heavy users.

---

## 4. Pure aggregator — `src/lib/insights.ts` (NEW)

```ts
import type {
  InsightsSummary, MarkerStat, InsightFlashcard,
  MarkerCategory, MarkerSeverity, ReviewerOutput,
} from "./types";

export type InsightRow = {
  content: string;                  // the user message text
  reviewer_output: ReviewerOutput;  // non-null (caller filters nulls)
  scenario_name: string;
};
```

`export function aggregateInsights(rows: InsightRow[]): InsightsSummary`

Algorithm:
1. Init `by_category` with all 5 keys = 0, `by_severity` with all 3 keys = 0.
   `messages_reviewed = rows.length`. `clean_count = 0`. `total_markers = 0`.
2. Maintain `fixGroups: Map<string, MarkerStat>` and `flashcards: InsightFlashcard[]`.
3. For each row (index `i`):
   - If `reviewer_output.markers.length === 0` → `clean_count++`; continue.
   - For each marker:
     - `by_category[marker.category]++`, `by_severity[marker.severity]++`,
       `total_markers++`.
     - **Group key** = `normalize(marker.wrong) + "→" + normalize(marker.fix)`.
       - `normalize(s)` = `s.toLowerCase().trim().replace(/\s+/g, " ")`.
       - If key exists: `count++`. Else create `MarkerStat` from this marker
         (`wrong`/`fix` kept **un-normalized** as first seen; `sample_sentence =
         row.content`; `scenario_name = row.scenario_name`; `count = 1`).
     - **Flashcard**: only add if `marker.span_text` is found in `row.content`
       (`row.content.includes(marker.span_text)`) — guarantees the front can
       highlight it. id = `` `${i}:${marker.id}` ``.
4. `top_fixes` = `[...fixGroups.values()]` sorted by `count` desc, then keep
   insertion order for ties (Map preserves insertion; do a stable sort or sort
   only by count and rely on stable Array.prototype.sort). Slice to 12.
5. `flashcards`: keep **most recent first** — rows arrive oldest→newest (see §6
   ordering), so reverse the accumulated array, then slice to 60. (Recent
   mistakes are the most useful to review.)
6. Return the `InsightsSummary`.

Keep it pure: no I/O, no Date, no randomness. Deterministic for a given input.

---

## 5. Tests — `src/lib/insights.test.ts` (NEW)

Use the existing vitest idiom (`src/lib/reviewer.test.ts` is the template:
`import { describe, expect, it } from "vitest";`). Cover:

1. **Empty input** → all zeros, empty arrays, every `by_category`/`by_severity`
   key present and 0.
2. **Single message, one marker** → counts = 1, one `top_fixes`, one flashcard.
3. **Repeated fix grouped** → two rows whose markers normalize to the same
   `wrong→fix` (e.g. `"I very like"` and `"I  Very like"` with extra spaces /
   caps) produce **one** `MarkerStat` with `count === 2`, but
   `by_category`/`total_markers` count **both** (2).
4. **Clean-rate math** → 3 rows, one with `markers: []` → `messages_reviewed: 3`,
   `clean_count: 1`.
5. **Flashcard dropped when span not in sentence** → marker whose `span_text`
   isn't a substring of `content` → no flashcard for it (but it still counts in
   tallies and fix groups).
6. **top_fixes sorted by count desc** → the more frequent correction comes first.

Build `ReviewerOutput` fixtures inline like `reviewer.test.ts` does.

---

## 6. Store: fetch rows (no aggregation in stores)

Add ONE method to the `RoleplayStore` interface in `src/lib/server/store.ts`
(near the other signatures, ~`:58-95`):

```ts
getInsightRows(userId: string): Promise<InsightRow[]>;
```

Import `InsightRow` from `@/lib/insights`. Both backends return rows ordered
**oldest → newest** (so the aggregator's "reverse for recent-first" is correct).

### 6a. Memory store — `src/lib/server/memory-store.ts`

Inside the returned object (alongside the other async methods):

```ts
async getInsightRows(userId) {
  const ownedSessionIds = new Set(
    memory.sessions.filter(s => s.user_id === userId).map(s => s.id)
  );
  const scenarioName = (scenarioId: string) =>
    getScenarioForUser(memory, userId, scenarioId)?.name ?? "Practice";
  // session_id -> scenario_id lookup
  const sessionScenario = new Map(
    memory.sessions.filter(s => s.user_id === userId).map(s => [s.id, s.scenario_id])
  );
  return memory.messages
    .filter(m =>
      m.role === "user" &&
      ownedSessionIds.has(m.session_id) &&
      m.reviewer_output != null
    )
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map(m => ({
      content: m.content,
      reviewer_output: m.reviewer_output!,
      scenario_name: scenarioName(sessionScenario.get(m.session_id)!),
    }));
}
```

`getScenarioForUser(memory, userId, scenarioId)` already exists in that file
(`:57-69`).

### 6b. Supabase store — `src/lib/server/supabase-store.ts`

PostgREST has no plain FK join without an embedded resource, and aggregating in
JS over the user's own rows is correct and fine at this scale. Use **two
queries**:

```ts
async getInsightRows(userId) {
  // 1. owned sessions (id + scenario_id), to map message -> scenario name
  const { data: sessions, error: sErr } = await supabase
    .from("sessions")
    .select("id, scenario_id")
    .eq("user_id", userId);
  if (sErr) throw new Response(sErr.message, { status: 500 });
  if (!sessions || sessions.length === 0) return [];

  const sessionScenario = new Map(sessions.map(s => [s.id, s.scenario_id]));

  // 2. reviewed user messages in those sessions
  const { data: messages, error: mErr } = await supabase
    .from("messages")
    .select("session_id, content, reviewer_output, created_at")
    .in("session_id", sessions.map(s => s.id))
    .eq("role", "user")
    .not("reviewer_output", "is", null)
    .order("created_at", { ascending: true });
  if (mErr) throw new Response(mErr.message, { status: 500 });

  // 3. resolve scenario names (built-in via getScenarioById; custom via one query)
  const scenarioIds = [...new Set([...sessionScenario.values()])];
  const nameById = new Map<string, string>();
  const customIds: string[] = [];
  for (const id of scenarioIds) {
    const builtIn = getScenarioById(id);
    if (builtIn) nameById.set(id, builtIn.name);
    else customIds.push(id);
  }
  if (customIds.length) {
    const { data: customs } = await supabase
      .from("custom_scenarios")
      .select("id, name")
      .eq("user_id", userId)
      .in("id", customIds);
    for (const c of customs ?? []) nameById.set(c.id, c.name);
  }

  return (messages ?? []).map(m => ({
    content: m.content as string,
    reviewer_output: m.reviewer_output as ReviewerOutput,
    scenario_name: nameById.get(sessionScenario.get(m.session_id)!) ?? "Practice",
  }));
}
```

`getScenarioById` is already imported at the top of `supabase-store.ts`
(`:2`). Import `ReviewerOutput` type. Note the PostgREST null filter is
`.not("reviewer_output", "is", null)` (NOT `.eq(..., null)`).

---

## 7. API route — `src/app/api/insights/route.ts` (NEW)

Copy `src/app/api/codex/usage/route.ts` shape exactly:

```ts
import { NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/server/auth";
import { getRoleplayStore } from "@/lib/server/get-store";
import { aggregateInsights } from "@/lib/insights";
import { jsonError } from "@/lib/server/http";

export async function GET(request: Request) {
  try {
    const user = await getAuthenticatedUser(request);
    const rows = await getRoleplayStore().getInsightRows(user.id);
    return NextResponse.json({ insights: aggregateInsights(rows) });
  } catch (error) {
    return jsonError(error);
  }
}
```

Response shape: `{ insights: InsightsSummary }`.

---

## 8. View — `src/components/insights/InsightsView.tsx` (NEW)

Start from `src/components/usage/UsageView.tsx` and keep its skeleton: the
`demoUser` const, the `useMemo(createBrowserSupabase)`, the auth/`apiGet` effect
with `cancelled` guard, and the `loading / !signedIn / error / data` branches,
plus the `← Back to practice` link and `min-h-screen bg-canvas` shell. Only the
data type and the rendered body change.

```ts
const response = await apiGet<{ insights: InsightsSummary }>(
  "/api/insights", apiState
);
```

### 8a. Category color mapping — CRITICAL Tailwind gotcha

Tailwind only ships classes it can see as **complete literal strings**
(`tailwind.config.ts:1` scans `./src/**/*.{ts,tsx}`). Do **NOT** build class
names like `` `bg-marker-${category}` `` — `word_choice` would also need to
become `word-choice`. Use an explicit literal lookup (tokens confirmed in
`tailwind.config.ts:21-25`):

```ts
const CATEGORY_STYLE: Record<MarkerCategory, { dot: string; label: string }> = {
  grammar:     { dot: "bg-marker-grammar",     label: "Grammar" },
  word_choice: { dot: "bg-marker-word-choice", label: "Word choice" },
  preposition: { dot: "bg-marker-preposition", label: "Preposition" },
  tone:        { dot: "bg-marker-tone",        label: "Tone" },
  style:       { dot: "bg-marker-style",       label: "Style" },
};
const CATEGORY_ORDER: MarkerCategory[] =
  ["grammar", "word_choice", "preposition", "tone", "style"];
```

(Note the token is `marker-word-choice` with a hyphen, while the category key is
`word_choice` with an underscore. This mismatch is exactly why the literal map
is required.)

### 8b. Layout (top → bottom)

Reuse `UsageView` spacing idioms (`max-w-2xl` container, `rounded-2xl border
border-border-subtle bg-surface p-6` cards). Sections:

1. **Header**: `<h1>Your patterns</h1>` + back link. Subhead, factual:
   "What the reviewer has marked across all your chats. This is a summary of
   your own messages, not a score."
2. **Overview row** (2 cards like `WindowCard`):
   - "Messages reviewed" → `messages_reviewed`, with a muted line
     "`clean_count` had no marks" (NO celebration).
   - "Total marks" → `total_markers`.
3. **By category**: list `CATEGORY_ORDER`, each row = colored dot
   (`CATEGORY_STYLE[c].dot`) + label + count. Skip rows with 0, OR show all
   greyed — pick showing only >0 to keep it honest/quiet. A simple horizontal
   proportion bar per category is optional polish.
4. **Most-repeated fixes** (`top_fixes`): each = `wrong` (strikethrough, muted)
   `→` `fix` (medium weight) + `count`× badge + tiny scenario tag. This is the
   highest-value block — the user's actual recurring slips.
5. **Flashcards** (`flashcards`): a single-card deck with flip + prev/next.
   - State: `const [i, setI] = useState(0); const [revealed, setRevealed] =
     useState(false);` Reset `revealed` to false when `i` changes.
   - **Front**: the `sentence` with `span_text` highlighted. Highlight by
     splitting on the first occurrence: `before + <mark>span</mark> + after`
     (mimic `buildMarkedSegments` in `src/lib/marker-rendering.ts` but inline /
     simpler — just first occurrence). Use a faint category tint via the dot
     color at low opacity, or just `bg-surface-alt` underline. Button: "Show
     fix".
   - **Back**: `fix` (prominent) + `why` (secondary) + scenario tag.
   - Footer: `‹` / `card i+1 of N` / `›` (disable at ends), matching the marker
     popover navigation pattern described in SPEC §4.4.
   - Empty: if `flashcards.length === 0`, show the empty state (see 8c) instead.
6. **Empty state** (when `messages_reviewed === 0`): one muted paragraph —
   "Your patterns appear here after the reviewer marks a few of your messages.
   Start a chat and send a few lines." + a link back to `/`.

Keep tone adult/factual throughout (Reviewer tone rules). No emojis, no
exclamation points, no "great job".

---

## 9. Page — `src/app/insights/page.tsx` (NEW)

One-liner, identical to `src/app/usage/page.tsx`:

```ts
import { InsightsView } from "@/components/insights/InsightsView";
export default function InsightsPage() {
  return <InsightsView />;
}
```

---

## 10. Sidebar entry — `src/components/sidebar/Sidebar.tsx`

Add a link directly above the existing Usage link (`:200-205`). Use a lucide
icon already in the family (e.g. `Sparkles` or `Lightbulb`) — add it to the
import on `:1`. Match the Usage link's classes exactly:

```tsx
<Link
  className="flex h-12 shrink-0 items-center gap-2 border-t border-border-subtle px-4 text-sm text-text-secondary transition-colors hover:text-text-primary"
  href="/insights"
>
  <Lightbulb size={16} /> Your patterns
</Link>
```

(Place it just before the `BarChart3` Usage `<Link>` so order is Patterns →
Usage → Sign out.)

---

## 11. Verification

1. `npm run test` — new `insights.test.ts` passes (and nothing else breaks).
2. `npm run typecheck` — no TS errors (watch the `Record<MarkerCategory,...>`
   exhaustiveness and the `reviewer_output!` non-null in stores).
3. `npm run lint`.
4. Run dev (`npm run dev`, port 1455) in demo mode (no Supabase). Connect
   OpenAI, start a chat, send 4–5 deliberately messy lines (e.g. "I want order
   one coffee hot", "I very like it", "I go there yesterday") to populate
   markers across at least two scenarios. Open `/insights` via the sidebar link.
   Confirm: category tallies, a repeated fix grouped with count, flashcards flip
   and navigate, and the empty state shows on a fresh user. Screenshot for the
   user.

---

## 12. Out of scope (deliberately deferred)

- **No "drill these with the Teacher" button.** That one *would* add an LLM
  call — additive, not needed to ship value. (Natural follow-up: a button on a
  `MarkerStat` that opens the Teacher widget pre-filled with "give me 5 more
  examples like '{wrong}' → '{fix}'".)
- **No SRS scheduling / persistence of card state.** Cards are derived fresh
  each load; no per-card "known/again" memory, no migration.
- **No per-scenario filter.** Patterns are global across all sessions in v1.
- **No schema migration** — `reviewer_output` already exists.

---

## 13. File checklist

- [ ] `src/lib/types.ts` — append `MarkerStat`, `InsightFlashcard`, `InsightsSummary`
- [ ] `src/lib/insights.ts` — NEW: `InsightRow` type + `aggregateInsights()`
- [ ] `src/lib/insights.test.ts` — NEW: 6 cases per §5
- [ ] `src/lib/server/store.ts` — add `getInsightRows` to `RoleplayStore`
- [ ] `src/lib/server/memory-store.ts` — implement `getInsightRows`
- [ ] `src/lib/server/supabase-store.ts` — implement `getInsightRows` (two queries)
- [ ] `src/app/api/insights/route.ts` — NEW: GET handler
- [ ] `src/components/insights/InsightsView.tsx` — NEW: the page UI
- [ ] `src/app/insights/page.tsx` — NEW: wrapper
- [ ] `src/components/sidebar/Sidebar.tsx` — add `/insights` link + icon import

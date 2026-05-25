# Weekly Brief — UX & Product Audit

_Date: 2026-05-12 · Scope: the Weekly Brief feature (`src/pages/WeeklyBrief.jsx`,
`src/hooks/useWeeklyBrief.js`, `src/components/weekly/*`, `src/lib/weeklyRepository.js`,
`src/lib/weeklyBriefEditor.js`, `src/lib/weeklyData.js`)._

Lens: UX strategy + executive coaching + React product engineering.

---

## 1. Weekly Brief UX Assessment

**What the feature is today.** A single page with three editable list cards
(Priority Track, Wins / Momentum, Top Blockers), a free-text "Close-Of-Week
Reflection" textarea, and a three-stat summary band at the top. Items are
edited through small modals. Everything autosaves; data is keyed by ISO week
and persisted to localStorage or Supabase, with offline queueing and stale-row
detection.

**What works well**

- **Persistence is genuinely solid.** Per-week records (`getWeeklyBriefByWeek(weekStart)`),
  versioned local storage, Supabase mirror, optimistic concurrency
  (`expectedUpdatedAt` / `StaleRecordError`), cross-tab sync events, and a
  debounced autosave with a calm status pill. Data loss is well defended.
- **It feeds something.** Priorities, wins, and blockers drive Focus Home's
  next-move recommendations (`pages/Dashboard.jsx`), and each section now tells
  the user that. That cross-feature loop is the right instinct.
- **The error/empty surfaces are honest** — "couldn't load" shows `—` instead
  of a misleading `0`, retry is offered, autosave-paused copy is explicit.

**Where it falls short of the brief**

- It reads like a **form**, not a **ritual**. There is no beginning, middle, or
  end — three list widgets and a textarea sitting in a 2×2 grid. Nothing says
  "you're reviewing last week," "now you're planning," "you're done."
- **The user never sees the output.** `WeeklyBriefSummary` (the "Founder brief"
  artifact with a copy-to-clipboard) was imported into `WeeklyBrief.jsx` but
  never rendered. The whole point — "do I get a useful summary?" — was missing.
  (Fixed in this branch; see §9.)
- **There is no "last week."** The hook hardcodes the current ISO week and
  there is no week navigator, so the user cannot review the previous week —
  which is literally bullet one of the product purpose — even though the data
  layer already stores it.
- **There is no single "what matters next."** "Focus" is _derived_ (first
  In-Progress priority, else first priority). The user never gets to _decide_,
  so the brief doesn't deliver the "decide what matters next" outcome — it
  guesses.
- **Copy and defaults leak the implementation and the wrong audience.** Blocker
  "Severity" is a `<select>` of raw enum strings `warning` / `high`. Priority
  "Owner" defaults to `"Team Member"` / `"Team Lead"`. Win categories are
  `Product / Execution / Engineering`. The seeded demo wins are literal
  changelog lines ("Built a clean side nav + top bar pattern…"). For a solo
  founder this reads like someone else's Jira board.
- **No progress cues, no guided first run.** Empty states are instructional
  ("Add one to define this week's focus") rather than warm or scaffolded, and
  there's no sense of "2 of 4 done."

**Net:** the engineering substrate is strong; the _experience_ is a generic
CRUD form wearing an executive label. It currently risks feeling like homework.

---

## 2. Problems with the Current Flow

| # | Problem | Why it matters | Evidence |
|---|---------|----------------|----------|
| P1 | Output artifact not rendered | User does work, gets no readable brief back | `WeeklyBrief.jsx` imported `WeeklyBriefSummary` but never used it |
| P2 | No "review last week" step / week navigation | Defeats purpose #1 ("review the previous week") and the "repeatable ritual" goal | `useWeeklyBrief` only ever uses `getCurrentWeekStart()` |
| P3 | "Focus" is inferred, not chosen | Purpose #5 ("decide what matters next") is never actually performed by the user | `WeeklyBriefSummary.headline = inMotion[0] || priorities[0]` |
| P4 | Page header & section names are dry/internal | "A weekly planning and review checkpoint to keep momentum explicit." / "Priority Track" / "Next Review Notes" — sounds like a status meeting, not a calm checkpoint | `WeeklyBrief.jsx`, `*Section.jsx` |
| P5 | Prompts are vague or leak internals | "Close-Of-Week Reflection" placeholder is a 40-word run-on; Severity exposes `warning`/`high`; Owner defaults to "Team Member" | `WeeklyBrief.jsx`, `WeeklyEditorModal.jsx`, `weeklyData.js` |
| P6 | Wrong-audience defaults & demo data | Win categories and seeded wins are engineering-team flavored; undermines "executive-level" feel | `data/mockData.js`, `weeklyData.js` |
| P7 | No carry-forward of unfinished priorities | Each week starts cold; the ritual doesn't compound | repository creates fresh per-week records only |
| P8 | Layout is a 2×2 grid with no order | No reflective arc; reflection is last and easy to skip | `weekly.css` `.weekly-grid` |
| P9 | Redundant summary surfaces | `SummaryCards` (3 stat cards) + `WeeklyBriefSummary` metrics show the same counts twice | `WeeklyBrief.jsx` |
| P10 | No progress cues / first-run scaffolding | Nothing signals completeness or guides a first-time user | empty states are bare `helper-text` |
| P11 | Minor a11y nits | "Owner: X \| Status: Y" reads the literal pipe; raw enum in Severity select; heading order should be verified | `WeeklyPriorities.jsx`, `WeeklyEditorModal.jsx` |

---

## 3. Recommended Weekly Brief Structure

Keep it a **single scrollable page**, but give it a deliberate top-to-bottom
arc that mirrors how a founder actually thinks. Five movements:

1. **This week** (header) — week range, a calm one-line intent, and a "Last
   week →" / "← Earlier weeks" navigator. If a brief exists for last week, show
   a small "Pick up where you left off" recap card: last week's priorities with
   their final status, plus a one-tap "carry forward unfinished priorities."

2. **Look back** — _one_ short reflection prompt about what actually happened
   (not a journal; 2–4 sentences). Optionally three tiny structured fields:
   _Went well_ / _Got stuck_ / _Next move_ — but freeform is fine if that's
   lighter.

3. **Wins** — name 1–3. Soft, not mandatory. "Name one thing that went well —
   even a small one."

4. **Blockers & open decisions** — what's in the way, and what each one needs
   (a decision, an owner, a conversation, time). Drop "severity"; replace with
   "needs" (Decision / Owner / Conversation / Time) — it's actionable, not a
   triage label.

5. **Priorities for the week ahead** — 3–5, with a gentle nudge if you exceed 5
   ("Founders ship more by choosing less — want to park one?"). Each priority
   gets an optional "why this" line.

6. **The one thing** — explicit single-select: "If you only move one of these,
   make it ___." This becomes `Focus` on Focus Home and in the artifact. This
   is the decision the whole ritual exists to produce.

7. **Your brief** (output) — the rendered, shareable artifact (already built as
   `WeeklyBriefSummary`): Focus line, priorities, wins, blockers, reflection,
   "Copy brief" + (later) "Email to myself." Mark the brief **complete** here so
   next week's recap can reference a finished record.

**Flow length:** the above is _longer in structure_ but _lighter in friction_ —
each step is one short answer, defaults are sane, nothing is required except
"the one thing." Target: a real founder finishes in 5–8 minutes. The danger to
avoid is the opposite — too short and shapeless, which is the current state.

---

## 4. Improved Prompt Copy

**Page header**

- Title: keep **"Weekly Brief"**.
- Description (replace _"A weekly planning and review checkpoint to keep momentum
  explicit."_) → **"Your Sunday-night reset: see last week clearly, name what
  matters, and start Monday with one decision already made."** (Adjust the day
  if you don't want to assume one.)

**Section headers** (calm, human, in ritual order)

| Now | Suggested |
|-----|-----------|
| Priority Track | **This week's priorities** |
| Wins / Momentum | **Wins worth keeping** |
| Top Blockers | **What's in the way** |
| Next Review Notes / "Close-Of-Week Reflection" | **Look back** / field label: **"What actually happened this week?"** |
| — (new) | **The one thing** |
| Founder brief (summary) | **Your brief** (eyebrow: "Ready to share") |

**Reflection placeholder** (replace the 40-word run-on)

> "Two or three honest sentences: what moved, what stalled, what surprised you.
> No need to make it tidy."

**Priority editor**

- Field "Priority" → keep, placeholder: _"e.g. Close the XPAIRK partnership
  scope"_.
- Field "Owner" → keep the field but **default to empty** (or the workspace
  owner's name from settings), not "Team Member". Placeholder: _"You, unless
  you're delegating it."_ For a solo workspace, consider hiding Owner entirely.
- Field "Status" → keep `Planned / In Progress / Blocked`, but label the option
  set as **"Where it stands"**.
- Add optional "Why this matters" one-liner.

**Win editor**

- Field "Win" placeholder: _"What went well — shipped, decided, learned, or
  survived. Small counts."_
- Replace categories `Product / Execution / Engineering` →
  **`Product / Revenue / Relationships / Team / Personal`** (founder-shaped, not
  team-shaped). Make category optional.

**Blocker editor**

- Field "Blocker" placeholder: _"What's stuck, and (briefly) why."_
- Replace "Severity" (`warning` / `high`) → **"What it needs"**:
  `A decision / An owner / A conversation / Time / Money`. Dots/colors can map
  to this. This turns a triage label into a next action.

**Empty states** (warmer, still useful)

- Priorities: _"Nothing here yet. What are the 3–5 things this week is really
  about?"_
- Wins: _"No wins logged. Start with one — momentum compounds when you write it
  down."_
- Blockers: _"Clear runway. If something's nagging you, name it here so it stops
  taking up headspace."_
- The one thing (no priorities): _"Add a couple of priorities above, then come
  back and pick the one that matters most."_

**Nudges (non-judgmental)**

- >5 priorities: _"That's a lot of 'most important.' Want to move one to next
  week?"_ — never block, never scold.
- Brief complete: _"Brief saved. You'll see this week's recap here next
  Monday."_

**Tone rules for all copy:** second person, present tense, short sentences,
permission to be imperfect, never imply the user is behind. Avoid the words
"should," "make sure you," "don't forget."

---

## 5. Suggested Data Model

The current schema is close. Additive changes only:

**`weekly_briefs`** (one row per user per ISO week)

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | (exists) |
| `user_id` | uuid | (exists) |
| `week_start` | date | ISO Monday (exists) |
| `review_notes` | text | freeform "look back" (exists) — _optional_: split into `went_well` / `got_stuck` / `next_move` text columns if you want structure |
| `headline_priority_id` | uuid → `weekly_brief_items.id` | **new** — "the one thing"; nullable |
| `status` | text enum `draft` \| `complete` | **new** — default `draft`; set to `complete` from the "Your brief" step |
| `completed_at` | timestamptz | **new** — nullable |
| `created_at` / `updated_at` | timestamptz | (exists) |

**`weekly_brief_items`**

| Column | Type | Notes |
|--------|------|-------|
| `id`, `brief_id`, `user_id`, `item_type`, `sort_order`, `updated_at` | — | (exist) |
| `title`, `description`, `owner`, `status`, `category`, `severity` | text | (exist) — repurpose `severity` for blockers as the "needs" value, or add `needs` and deprecate `severity` |
| `why` | text | **new, optional** — "why this matters" for priorities |
| `carried_from_item_id` | uuid → `weekly_brief_items.id` | **new, optional** — set when carried forward, so the recap can show "carried over from last week ×2" |
| `completed` | boolean | **new** — lets a priority be marked done during the week and counted as a win-source |

**Client shape** (`weeklyData.js` / repository) — mirror the above:
`{ headlinePriorityId, status, completedAt }` on the brief;
`{ why, carriedFromItemId, completed }` on items. Keep the descriptor-table
pattern in `weeklyRepository.js` — it's a good abstraction; just add the fields
to each descriptor's `fields` / `fromSupabaseRow` / `toSupabaseFields`.

**Migrations:** all columns nullable / defaulted, so existing rows are valid.
No backfill required.

---

## 6. Suggested UI Improvements

1. **Render the brief artifact** (done in this branch): `WeeklyBriefSummary`
   now appears between the intent line and the editors so the user always sees
   the output as it forms. _Next:_ move it to the **bottom** as the "Your brief"
   step once the page is reordered into the ritual arc, with a sticky "Jump to
   your brief" affordance.
2. **De-duplicate the summary band.** Either drop the 3 `SummaryCards` or fold
   them into `WeeklyBriefSummary`'s metric row. Showing "3 active priorities"
   twice on one screen is noise.
3. **Add a "Last week" recap card** at the top: last brief's priorities + final
   status, wins count, unresolved blockers, and a single button "Carry forward
   N unfinished priorities."
4. **Add a week navigator** (`‹ May 5–11 ›`) so past briefs are reachable. Past
   weeks render read-only (or with an "edit anyway" toggle).
5. **"The one thing" selector** — a radio list of the current priorities right
   above the brief; the chosen one gets a subtle highlight everywhere it appears.
6. **Progress / completeness cue** — a quiet checklist or step counter ("Look
   back · Wins · Blockers · Priorities · Pick one") that fills in as the user
   goes; ends with a calm "Brief complete ✓ — see you next week."
7. **Soft priority cap** — visual nudge at 6+, never a hard block.
8. **Replace the "Severity" select with "What it needs"** chips; map dot colors
   to needs (decision = amber, owner = blue, time = neutral, money = violet).
9. **Reflection convenience** — one-tap chips that prepend a stem to the
   textarea: "What moved…", "What stalled…", "What surprised me…". Optional.
10. **Calm visual treatment** — generous whitespace, one accent color, no dense
    tables; the page should feel like a quiet notebook, not a dashboard.

---

## 7. Mobile Improvements

- The grid already collapses to one column at ≤1100px and list rows stack at
  ≤700px — good. But on a phone the screen is currently: 3 stat cards → intent
  line → (now) summary metrics → 3 long editor cards → big textarea. That's a
  lot of vertical travel before the user does anything. **Fix by de-duplicating
  the summary band (§6.2) and putting the artifact at the bottom.**
- **Sticky mini-progress bar** at the top on mobile (the step chips from §6.6)
  so the user always knows where they are in the ritual.
- **Bigger tap targets:** the "Edit"/"Delete" ghost buttons on each list row are
  small and side-by-side; on mobile, make them full-height row affordances or
  move them into an overflow menu so a thumb doesn't mis-tap.
- **Modal editors:** ensure modals are full-screen sheets on small viewports
  with the primary action reachable without scrolling and the keyboard not
  covering the submit button.
- **"Copy brief" → "Share brief"** on mobile: use the Web Share API when
  available so it can go straight to Messages/Mail/Slack; fall back to clipboard.
- Confirm `font-size: 16px+` on all inputs/textareas so iOS Safari doesn't
  zoom on focus.

---

## 8. Accessibility Considerations

- **Heading hierarchy:** verify the page is `h1` (PageHeader) → `h2`
  (`WeeklyBriefSummary` uses `<h2>`) → `h3` (`SectionCard` titles). The new
  "Your brief"/"Last week" cards must slot in without skipping levels.
- **Don't read punctuation as data:** `WeeklyPriorities.jsx` renders
  `"Owner: {owner} | Status: {status}"` — the literal `|` is announced as
  "vertical bar." Use a real separator structure (two spans, or
  `Owner: X. Status: Y.`) and consider a visually-hidden label.
- **No raw enums in the UI:** the Severity `<select>` currently shows
  `warning` / `high`. Whatever replaces it ("What it needs") must use
  human-readable option text.
- **Status & feedback regions:** the autosave pill and copy confirmation already
  use `aria-live="polite"` / `role="status"` — keep that. Ensure the new
  progress/checklist updates are announced politely too (not assertively — this
  is a calm ritual).
- **Color is never the only signal:** blocker/priority dots already pair with
  text; keep that when dots map to "needs." Check contrast of dot colors and of
  `--text-muted` helper text against both themes (the CSS already retunes the
  autosave dot for light theme — apply the same care to any new chips).
- **Keyboard:** the "the one thing" radio group must be arrow-key navigable with
  a visible focus ring; week navigator buttons need discernible names
  ("Previous week", "Next week"); modals must trap focus and restore it on close
  (verify `Modal` does this).
- **Reduced motion:** the autosave pulse already respects
  `prefers-reduced-motion`; any new transitions (progress fill, highlight) must
  too.
- **Forms:** every input has a `<label>` today — preserve that for new fields;
  give the reflection textarea a description tying the helper text to it via
  `aria-describedby`.
- **`aria-hidden` decorative dots** — already done; keep it.

---

## 9. Implementation Plan

Phased so each step ships independently and the ritual emerges incrementally.

**Phase 0 — Quick fix (in this branch)**
- [x] Render `WeeklyBriefSummary` in `WeeklyBrief.jsx` (it was imported but
  unused, so the user never saw the output artifact). Placed between the intent
  line and the editor grid; wired to current priorities/wins/blockers and the
  live reflection draft. Tests still green.

**Phase 1 — Copy & defaults (low risk, high felt impact)**
- [ ] Rewrite page description, section titles, empty states, placeholders, and
  nudge copy per §4.
- [ ] Change priority `owner` default to empty / workspace owner; consider
  hiding Owner when the workspace is solo.
- [ ] Swap win categories to `Product / Revenue / Relationships / Team /
  Personal`; make optional.
- [ ] Replace blocker "Severity" (`warning`/`high`) with "What it needs"
  (`Decision / Owner / Conversation / Time / Money`); update dot color map.
- [ ] Reseed demo data with founder-flavored examples (not changelog lines).
- [ ] A11y: fix the `Owner: X | Status: Y` pipe; verify heading order.
- Update affected tests (`WeeklyBrief.test.jsx`, `weeklyBriefEditor.test.js`,
  `WeeklyTextList.test.jsx`).

**Phase 2 — Output as the centerpiece**
- [ ] Move `WeeklyBriefSummary` to the bottom as the "Your brief" step; remove
  or merge the redundant `SummaryCards` band.
- [ ] Add "Copy brief" sibling actions: "Email to myself" / Web Share on mobile.
- [ ] Add `status` (`draft`/`complete`) + `completed_at` to `weekly_briefs`
  (migration + repository + hook); a "Mark this week's brief complete" action.

**Phase 3 — The decision**
- [ ] `headline_priority_id` on `weekly_briefs`; "The one thing" radio selector
  above the brief; thread the chosen priority through `WeeklyBriefSummary` and
  Focus Home (`buildMainFocus`) so "Focus" is _chosen_, not derived.

**Phase 4 — The loop (review last week, carry forward, ritual arc)**
- [ ] Week navigator UI + `useWeeklyBrief` accepting an arbitrary `weekStart`
  (the repository already supports it); past weeks read-only.
- [ ] "Last week" recap card; `carried_from_item_id` + "carry forward N
  unfinished priorities" action.
- [ ] Reorder the page into the §3 arc; add the quiet progress/step indicator.
- [ ] `why` and `completed` on items; mark-priority-done flow that can seed a
  win.

**Phase 5 — Polish**
- [ ] Mobile sticky progress bar, bigger row tap targets / overflow menus,
  full-screen modal sheets, 16px inputs.
- [ ] Reflection stem chips; reduced-motion checks on new transitions; contrast
  pass on new chips in both themes.
- [ ] E2E: a full "complete the weekly brief" happy-path test in `e2e/`.

**Risk notes:** all schema changes are additive/nullable — no backfill, local
and Supabase paths stay in sync via the existing descriptor table. The biggest
behavior change is "Focus" becoming user-chosen; ship it behind the existing
"derive if unset" fallback so old briefs and Focus Home keep working.

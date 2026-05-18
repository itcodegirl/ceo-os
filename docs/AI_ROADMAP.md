# AI Roadmap — CodeHerWay CEO OS

> Status: strategy document. This is a plan, not a shipped feature set. It maps
> where AI fits inside CEO OS, what to build first, what to avoid, and how to do
> it without breaking the calm, trustworthy feel of the product.

CEO OS already ships one AI-assisted surface: the **Chief of Staff workspace**
(`src/pages/ChiefOfStaff.jsx`, `server/chiefOfStaffProxyCore.js`,
`shared/chiefActions.js`). It runs through a server-side proxy with token auth,
rate limiting, request timeouts, deterministic fallbacks, loading/error states,
and telemetry. That foundation is the thing this roadmap extends — deliberately,
in small steps — rather than bolting a chatbot onto the app.

---

## 1. AI Product Strategy

**Position AI as a thinking aid, never an authority.** CEO OS is a calm operating
system for a solo/early-stage founder. The user's judgment is the product. AI's
job is to reduce the friction between *scattered input* (notes, half-thoughts,
meeting residue) and *structured output* (priorities, memos, follow-ups, next
actions). It compresses busywork; it does not make decisions.

Principles:

1. **Notes in, structure out.** Every AI action takes text the user already
   wrote and returns something more organized. No open-ended chat surface, no
   "ask me anything" box.
2. **Optional and off the critical path.** The app must be fully usable with AI
   disabled. AI is an accelerator on existing flows (Chief of Staff, Weekly
   Brief, Quick Capture), never a gate.
3. **Bounded actions, not a general agent.** A small, named menu of actions
   ("Turn notes into a plan", "Summarize this week", "Find blockers", "Draft a
   follow-up"). Each one has a known input, a known output shape, and a
   deterministic fallback. The current `CHIEF_ACTIONS` map is the model.
4. **Transparent provenance.** Output is always labeled with where it came from
   (`source: "proxy"` vs `source: "fallback"`) and shown as a *draft the user
   edits and accepts*, never auto-applied. The existing `ChiefOutputPanel` /
   accept-button pattern stays the rule.
5. **Server-side keys, fail-closed.** No model key ever reaches the browser. The
   proxy refuses unauthenticated requests by default (`CHIEF_STAFF_REQUIRE_TOKEN`).
   This is already true and is non-negotiable for any new AI surface.
6. **Degrade, don't break.** Network down, rate limited, key missing, model
   timeout, malformed response — every one of these resolves to a useful local
   fallback plus a calm notice, not a spinner or a stack trace.

**Success metric:** the user says "that saved me ten minutes and I trusted what
it gave me." Not "wow, magic." Not "I don't know where this came from."

---

## 2. Best First AI Feature

**"Turn these notes into a structured plan" inside Chief of Staff — hardened and
made the headline action.**

This already exists as the `plan` action. The "first feature" work is *not* net
new capability; it is making this one action excellent and obviously trustworthy:

- Make `plan` the default, visually dominant action in the Chief of Staff panel.
- Tighten the structured output contract: priorities, opportunities, content
  items, tasks — each item editable inline before "Add to workspace".
- Every output card shows: source badge (AI draft / offline draft), the action
  that produced it, and a one-line "what we sent" disclosure.
- "Add to workspace" is per-item and reversible (writes through the existing
  repository layer with undo/archive).
- Each suggested item can show **which lines of the notes it came from** (even
  crude substring matching is enough): a small "from your notes" affordance that
  highlights the source text. This is the strongest single trust multiplier —
  the user can *see* nothing was invented. See §4 (`sourceSpans`).
- Works offline via the existing deterministic fallback, clearly labeled
  "Offline draft — generated locally from your notes."

Why this first: it's the highest-leverage founder task (scattered → plan), it
reuses infrastructure that's already production-shaped, and it forces us to nail
the editable-draft + provenance pattern that every later feature inherits.

---

## 3. Features to Avoid

Do **not** build these — they break the product's character:

- **A floating chat assistant / "AI" button in the corner.** No open conversation
  surface. It invites scope creep, hallucinated authority, and "chatbot pasted
  into the app" feel.
- **Auto-apply / auto-edit.** AI never silently changes a priority, reschedules a
  task, or rewrites a memo in place. Always a draft the user accepts.
- **Autonomous agents / multi-step "do it for me" workflows.** No background
  agent taking actions across the workspace. The user runs one bounded action at
  a time.
- **Predictive scoring dressed as fact.** "This opportunity is 87% likely to
  close" — no. Opportunity scoring stays rule-based and explainable (it's already
  on the `FINAL_ROADMAP`); AI can *suggest* a rationale draft, not a number.
- **Sentiment/"how are you feeling" coaching.** Out of scope, creepy, not what a
  CEO OS is for.
- **Always-on summarization / proactive notifications.** AI runs when the user
  asks. No "we noticed you have 3 blockers" push.
- **Sending data to the model without telling the user.** No silent enrichment,
  no "we'll use your notes to improve the model" anything.
- **Client-side API keys or a `VITE_OPENAI_API_KEY`.** Ever.
- **Model-picker / temperature sliders in the UI.** That's not user control,
  that's exposing plumbing. Real control = enable/disable, see source, edit
  output, clear history.

---

## 4. Prompt Workflow Design

Each AI action follows the same five-stage pipeline. This mirrors and formalizes
what `chiefOfStaffProxyCore.js` already does.

```
[1] Collect      → user-authored text + chosen action key (plan|summarize|draft|actions|priorities|blockers|followup)
[2] Validate     → trim, enforce MAX_NOTES_LENGTH, reject empty; client + server agree via shared/chiefConfig
[3] Compose      → system prompt (role + bounds + output schema) + action instruction (from CHIEF_ACTIONS) + user text
[4] Call         → server proxy → model Responses API, REQUEST_TIMEOUT_MS, no PII beyond what the user typed
[5] Normalize    → parse to known shape (extractStructuredPayloadIfPresent), clamp item counts/lengths,
                   stamp source/fallbackReason/errorCode; on ANY failure → deterministic fallback
```

**System prompt skeleton (shared across actions):**

```
You are the Chief of Staff inside CodeHerWay CEO OS, an operating system for a
solo founder. Your only job is to reorganize the founder's own notes into the
requested structure. Rules:
- Use only information present in the notes. Do not invent facts, names, dates,
  metrics, or commitments.
- If the notes are too thin to fill a section, return that section empty rather
  than padding it.
- No hype, no "as an AI", no flattery. Plain, calm, operator language.
- Return JSON matching the provided schema. Nothing else.
```

**Per-action instruction** comes from `CHIEF_ACTIONS[key].instruction` (already
the pattern). New actions to add: `blockers` ("extract things that are blocked,
who/what they're waiting on, and the smallest unblocking move") and `followup`
("draft short follow-up messages for each open thread, founder voice, ≤120
words each").

**Output schema is fixed per action** and validated server-side before the
response leaves the proxy. The client never trusts raw model text — it runs it
through `normalizeChiefOutput` and renders only known fields.

**Item-level provenance (`sourceSpans`).** Each structured item may carry an
optional `sourceSpans: [{ start, end }]` array — character offsets into the
submitted notes that the item is derived from. The model is asked to include
them; the server verifies the spans actually exist in the notes and drops any
that don't (never trust offsets blindly). The UI uses them for the "from your
notes" highlight (§2, §7). If absent or unverifiable, the item still renders —
provenance degrades gracefully, it's never a hard requirement.

**Prompt & schema versioning.** Action instructions and output schemas live in
`shared/chiefActions.js` and will change. Version them — `plan@v3`,
`summarize@v1` — and stamp the version onto every generated output (and onto
anything the user accepts into the workspace), so an old accepted draft stays
explainable and prompt changes can be A/B'd and tied to evaluation runs (§12).
A version bump is a deliberate, reviewed change, not an incidental edit.

**Token discipline:** truncate notes to `MAX_NOTES_LENGTH` (12000), cap output
items per section (`MAX_STRUCTURED_ITEMS_PER_SECTION = 12`), per-item text
(`MAX_STRUCTURED_TEXT_LENGTH = 280`), and `max_output_tokens` server-side (§13)
— keep enforcing all of these.

---

## 5. Suggested Output Types

All outputs are **editable drafts** rendered in `ChiefOutputPanel`-style cards,
each with a source badge and per-item accept:

| Output type | Action | Shape | Where it lands |
|---|---|---|---|
| **Structured plan** | `plan` | priorities[], opportunities[], contentItems[], tasks[] | Focus Home / Weekly Brief / Opportunities / Content via repository writes |
| **Executive summary** | `summarize` | 3 short paragraphs: context, updates, risks | Copy out / attach to weekly review |
| **Weekly priorities** | `priorities` | ≤3 ranked items with rationale | Weekly Brief top-3 cap |
| **Blocker list** | `blockers` | items[] { what, waitingOn, smallestNextMove } | Tasks / flagged on Focus Home |
| **Follow-up drafts** | `followup` | messages[] { thread, draft (≤120w) } | Copy to clipboard; never auto-sent |
| **Founder memo** | `draft` (extended) | { title, audience, body (markdown) } | Content workspace as a draft item |
| **Next actions** | `actions` | items[] { owner, outcome, due } | Tasks |

Non-goals for output: no charts, no scores, no calendars, no "AI confidence"
meters. Text and lists, clearly labeled, editable.

---

## 6. Trust and Privacy Considerations

What the user must always be able to see and control:

- **A clear on/off.** Settings → "AI assistance" toggle. Off = the Chief of
  Staff panel shows only manual tools and the offline draft generator; no
  network calls to the proxy.
- **What gets sent, before it's sent.** A short, plain disclosure near the action
  button: *"This sends the notes you typed above to our AI provider to generate a
  draft. Nothing else from your workspace is included."* Plus a "what we send"
  expandable showing the exact payload.
- **Where the output came from.** Every card: `AI draft` vs `Offline draft
  (generated on your device)`. Already implemented via `source` / `fallbackReason`
  — keep it visible, not buried.
- **Retention answer.** A one-paragraph statement in Settings and docs:
  - Notes live in the user's workspace storage (browser/Supabase) as they do
    today.
  - When AI assistance is used, the typed text is sent to the model provider for
    that single request and is **not** stored by CEO OS as training data.
  - AI outputs are saved only when the user clicks "Add to workspace".
  - Operational telemetry (latency, error codes, action name) is recorded for
    reliability — **never** note content. (This matches the existing app-error
    telemetry design, which is content-free.)
- **No surprise persistence.** AI drafts that aren't accepted are ephemeral
  (session-only). Don't quietly write them to storage.
- **A "forget this" path.** The user can clear AI draft history from the current
  session in one click, and Settings states plainly what happens to an output
  that was accepted and then deleted (it's removed from workspace storage like
  any other item; CEO OS holds no separate copy). See §13.
- **Boundedness made visible.** The action menu *is* the boundary. There is no
  free-text "ask anything" — the user can see the full list of what AI can do.
- **A spending ceiling, not just a rate limit.** Per-minute throttling protects
  latency, not cost. A per-workspace daily/monthly action budget protects the
  bill and is itself a trust signal ("AI won't run away with itself"). When the
  budget is reached the user gets a calm "you've used your AI drafts for today —
  here's a local draft" state. See §13.
- **Fail-closed on the server.** `CHIEF_STAFF_REQUIRE_TOKEN` defaults to on;
  rate limit defaults to 10/min/client; 10s request timeout. Document these in
  `docs/CONFIGURATION.md` (already partly there).
- **Honest copy.** No "your AI Chief of Staff". It's "AI-assisted drafting".
  No "magic", no "instantly understands". The `phase 2: trust copy` commit set
  the tone — hold that line.

---

## 7. Frontend Architecture Plan

Build on the existing `src/components/chief/*` + `src/hooks/useChiefOfStaff.js`
structure. No new framework, no global AI context.

```
src/
  features/ai/                    # new home for AI-shared pieces (or keep under components/chief)
    aiActions.js                  # client mirror of action keys + labels + descriptions
    useAiAction.js                # generalization of useChiefOfStaff: {run, isLoading, result, error, source, reset}
    AiDraftPanel.jsx              # generalization of ChiefOutputPanel: renders editable cards + source badge + accept
    AiSourceBadge.jsx             # "AI draft" / "Offline draft" pill
    AiDisclosure.jsx              # "what we send" expandable + privacy line
    AiOfflineFallback.js          # client-side deterministic generators (mirror of shared fallbacks)
  hooks/
    useAiEnabled.js               # reads the Settings toggle; gates network calls
  lib/
    normalizeAiOutput.js          # extends normalizeChiefOutput; one normalizer per output schema
```

Rules:

- **One hook, one action, one panel.** A page (Chief of Staff, Weekly Brief)
  imports `useAiAction("plan")`, renders an `AiDraftPanel`. No cross-page state.
- **Always render four states explicitly:** idle (with disclosure + button),
  loading (calm skeleton — reuse `OutputLoadingState`), result (editable cards),
  error/fallback (notice + offline draft). These already exist for Chief; make
  them the contract for every AI surface.
- **AI disabled = component still renders**, minus the network button: offline
  draft generator + "AI assistance is off — turn it on in Settings".
- **Accept is per-item and goes through the repository layer**, so undo/archive
  and autosave status work exactly as for manual edits.
- **Lazy-load** the heavier AI panels (the codebase already lazy-loads the
  telemetry diagnostics panel — same pattern).
- **No raw model text in the DOM.** Render only fields that survived
  normalization.
- **Telemetry on the client stays content-free** (action name, source, latency,
  error code) — reuse `app-error-telemetry`.
- **Provenance highlight.** When an item has verified `sourceSpans` (§4), render
  a subtle "from your notes" control that highlights the matching range in the
  notes textarea. Quiet by default; never the dominant visual.

**Accessibility & streaming.**

- **Announce state transitions.** The idle → loading → result/fallback change is
  announced to screen readers via a polite live region ("Generating draft…",
  then "Draft ready, N priorities" / "Couldn't reach the AI service — showing a
  local draft"). Don't rely on visual-only spinners.
- **Don't trap or steal focus** during the call. Keep the notes textarea usable;
  move focus to the result panel heading only after the result renders, not
  before.
- **Decide streaming explicitly: don't stream tokens.** Streaming feels faster
  but fights the "render only normalized, schema-validated fields" rule and
  makes provenance/clamping awkward. Show the calm loading skeleton, then render
  the validated object in one step. (Revisit only if a real latency complaint
  shows up — and even then, stream a status, not raw text.)
- **Respect `prefers-reduced-motion`** for the loading skeleton.
- Keyboard: every per-item "Add to workspace" / "from your notes" control is a
  real focusable button with a clear label (the existing accept-button label
  helper is the pattern).

---

## 8. Backend / API Integration Plan

Generalize `server/chiefOfStaffProxyCore.js` into a small AI proxy that all
actions share. Do **not** spread model calls across the app.

- **Single endpoint** `/api/chief-of-staff` (keep the name for now; or
  `/api/ai-action`) → `handleAiProxy({ method, body, headers })`.
- **Request contract:** `{ actionKey: <known key>, notes: <string ≤ MAX_NOTES_LENGTH>, correlationId? }`.
  (The field is named `actionKey` in `server/chiefOfStaffProxyCore.js`; the
  proxy currently falls back to `summarize` if it's missing or unknown — keep
  that behaviour explicit, and reject genuinely unknown keys client-side too.)
  Reject oversized notes, reject empty.
- **Auth:** Bearer token / `X-Chief-Staff-Token`, fail-closed via
  `CHIEF_STAFF_REQUIRE_TOKEN`. Per-client rate limit
  (`CHIEF_STAFF_RATE_LIMIT_PER_MINUTE`, default 10).
- **Model call:** OpenAI Responses API (`OPENAI_API_KEY`, `OPENAI_MODEL`,
  default `gpt-4.1-mini`), `REQUEST_TIMEOUT_MS = 10000`, abort on timeout.
- **Response normalization server-side:** parse to the action's schema, clamp
  counts/lengths, strip anything unexpected, stamp `source`, `fallbackReason`,
  `errorCode`, `correlationId`, and the prompt/schema version (§4). Verify any
  `sourceSpans` against the submitted notes and drop unverifiable ones. The
  browser receives only the normalized object.
- **Deterministic fallback in the proxy** for every action (extend
  `CHIEF_ACTIONS[key].fallback`): if the key is missing, the call fails, times
  out, or returns garbage → return the local fallback with
  `source: "fallback"` and a human `fallbackReason`.
- **Environment handling is a precondition, not a feature:** if `OPENAI_API_KEY`
  is unset, the proxy must return a clean `{ source: "fallback", fallbackReason:
  "AI provider not configured" }` — never 500, never leak which var is missing
  (the `phase 1: trust copy` commit already removed an env-var leak; keep it
  that way).
- **Observability:** structured logs with `requestId` + `correlationId` +
  `action` + outcome + latency. No note content in logs. Reuse the existing
  `appErrorTelemetryIngest` path for client-visible error reporting.
- **Provider abstraction (light):** a thin `callModel({ system, instruction,
  input })` so swapping `gpt-4.1-mini` for another model is a one-file change. No
  heavyweight SDK layer.

**Hard gate before any of this calls a paid API in production:** env-var
handling ✅ (exists), error states ✅ (exist), loading states ✅ (exist), privacy
copy ⬜ (needs the disclosure + retention paragraph from §6), fallback behavior
✅ (exists), an evaluation gate ⬜ (§12), a spend ceiling ⬜ (§13). Ship the
privacy copy and the spend ceiling first; stand up the evaluation gate before
turning on a new model or changing a prompt.

---

## 9. Error and Fallback Strategy

Every failure mode maps to a calm, useful result. No spinners-forever, no raw
errors, no dead ends.

| Failure | What the user sees | Source | Recovery |
|---|---|---|---|
| AI assistance disabled | "AI is off — turn it on in Settings" + offline draft generator | `fallback` | Toggle in Settings |
| `OPENAI_API_KEY` not configured | Offline draft + "AI provider isn't set up — here's a draft generated locally" | `fallback` | (Operator config) |
| Network offline / fetch fails | Offline draft + "Couldn't reach the AI service. Here's a local draft." + Retry | `fallback` | Retry button |
| Rate limited (429) | "You've run a lot of AI actions in the last minute — here's a local draft, try again shortly." | `fallback` | Auto-clears in <60s |
| Model timeout (>10s) | Offline draft + "That took too long, so here's a local draft." + Retry | `fallback` | Retry |
| Malformed / unparseable model output | Offline draft + "The AI response wasn't usable, so here's a local draft." | `fallback` | Retry |
| Auth/token misconfig | Generic "AI service unavailable" (no detail leaked) + offline draft | `fallback` | (Operator) |
| Empty / too-short notes | Inline validation: "Add a few notes above and I'll structure them." (no call made) | n/a | User adds notes |
| Notes over `MAX_NOTES_LENGTH` | Inline: "That's a lot — I'll work from the first ~12,000 characters." | proceeds | User can trim |
| Partial success (some sections empty) | Render what came back; empty sections show "Nothing here yet — add more notes." | `proxy` | Edit / re-run |

Rules:

- **Fallbacks are real value, not placeholders.** The offline `plan` generator
  already produces a usable skeleton from the user's notes — invest there so
  "offline" still feels worth it.
- **Always tell the user the source.** A fallback that pretends to be AI output
  is the trust-killer to avoid.
- **One retry affordance**, idempotent. No auto-retry storms.
- **Errors are logged with correlation IDs**, surfaced to the user only as plain
  language. Diagnostics live behind the existing meta/telemetry panel, not in the
  main flow.

---

## 10. Phase-Based AI Roadmap

### Phase 0 — Trust & boundaries (prereq, do this first)

Acceptance criteria (rough sizing: XS ≈ <½ day, S ≈ ~1 day, M ≈ 2–3 days):

- [ ] **AI on/off toggle** in Settings, persisted via the workspace repository;
  `useAiEnabled` gates all proxy calls; OFF renders offline drafts only with a
  Settings link. — *S*
- [ ] **"What we send" disclosure** component: static one-liner + expandable
  showing the exact `{ action, notes }` payload. — *S*
- [ ] **Privacy/retention paragraph** in Settings and `docs/CONFIGURATION.md`
  (per-request send, not training data, outputs saved only on accept, telemetry
  is content-free). — *XS*
- [ ] **Source badges everywhere**: every output card shows "AI draft" vs
  "Offline draft (generated locally)" + `fallbackReason` when present. — *S*
- [ ] **Copy audit**: remove "your AI Chief of Staff" / "magic" / "automatically"
  phrasing; standardize on "AI-assisted drafting". — *XS* (partly done)
- [ ] **Spend ceiling + kill switch** (§13): per-workspace daily soft cap +
  monthly hard cap, `max_output_tokens` cap, one env var that disables all paid
  calls. — *M*
- [ ] **Evaluation gate** (§12): `npm run eval:ai` with ~10–15 fixtures and the
  heuristic checks; runs the fallback path in CI, the live path when
  `OPENAI_API_KEY` is set; `docs/AI_EVAL.md` records pass rate. — *M*
- [ ] **"Forget this" control** (§6/§13): one-click clear of session AI drafts;
  Settings explains what deletion of an accepted output means. — *XS*
- [ ] **Proxy config documented** in `docs/CONFIGURATION.md` (token fail-closed,
  rate-limit default, 10s timeout, fallback-on-failure). — *XS*
- [ ] **Tests** for the above (toggle gating, disclosure payload, four-state
  rendering, proxy-without-key returns a fallback not a 500). — *S*

**Exit criteria:** every box above is checked and every row in the §8 hard gate
/ Appendix checklist is ✅. *Only then* is a paid model call appropriate in
production. Rough total: ~2 weeks of focused work for one engineer.

### Phase 1 — Best first feature: hardened "notes → structured plan"
- Make `plan` the dominant Chief of Staff action; per-item editable + accept via
  repository layer; offline fallback clearly labeled.
- Generalize `useChiefOfStaff` → `useAiAction`, `ChiefOutputPanel` →
  `AiDraftPanel`.
- Tests: validation, normalization, fallback paths, accept-to-workspace, AI-off
  rendering.
- **Exit criteria:** plan action is reliable, fully degradable, and every output
  shows provenance.

### Phase 2 — Adjacent bounded actions
- Add `summarize` (weekly), `priorities` (top-3), `blockers`, `followup` using
  the same pipeline + schemas + fallbacks.
- Surface `summarize`/`priorities` inside Weekly Brief; `blockers` on Focus Home;
  `followup` near Opportunities.
- **Exit criteria:** ≥4 actions live, all sharing one proxy, one panel, one
  error model.

### Phase 3 — Founder memo drafting
- Extend `draft` into `{ title, audience, body }`; lands in the Content
  workspace as an editable draft item.
- Optional: small set of memo "shapes" (investor update, team update, decision
  memo) — fixed templates, not freeform.
- **Exit criteria:** a founder can go from notes → editable memo draft → saved
  content item without leaving the calm flow.

### Phase 4 — Linking & light suggestion (only if it stays explainable)
- AI suggests *connections* the user confirms: "these 3 notes look related to the
  X opportunity — link them?" Suggestion, never automatic.
- Draft rationales for the existing rule-based opportunity scoring (text, not
  numbers).
- **Exit criteria:** no AI output is auto-applied; every suggestion is a
  one-click accept the user can ignore.

### Explicitly not on the roadmap
Chat UI, autonomous agents, predictive scores presented as fact, proactive
notifications, sentiment coaching, client-side keys, model/temperature sliders.

**If conversational UI is ever revisited** (it isn't planned, and founders *will*
ask): the boundary, decided in advance, is — only ever scoped to a *single
document the user is already looking at* ("ask about this memo"), never
workspace-wide; never agentic (it answers and drafts, it never takes actions);
same provenance, same fallback, same spend ceiling as every other AI surface;
and it ships only after Phases 0–3 are done and trusted. Anything broader is a
different product. This statement exists so the "no" is principled, not just a
current preference.

---

## 11. Codex-Ready Implementation Prompt — "Safe First AI-Ready Version"

> Paste this to an implementation agent (Codex / Claude Code). It builds **Phase
> 0 + the framing for Phase 1** — i.e. it makes the app *AI-ready and trustworthy*
> without turning on any new paid model calls. The existing Chief of Staff proxy
> stays as-is; this work wraps it in user control, disclosure, and clean
> fallbacks.

```
TASK: Make CodeHerWay CEO OS "AI-ready" — add user-facing controls, disclosure,
and consistent fallback behavior around the existing Chief of Staff AI proxy.
Do NOT add new model providers, new paid API calls, or any client-side API key.
Do NOT add a chat UI.

CONTEXT YOU MUST RESPECT:
- Existing AI surface: src/pages/ChiefOfStaff.jsx, src/hooks/useChiefOfStaff.js,
  src/components/chief/*, server/chiefOfStaffProxyCore.js, api/chief-of-staff.js,
  shared/chiefActions.js, shared/chiefConfig.js, shared/chiefStructuredPayload.js.
- The proxy already does: token auth (fail-closed via CHIEF_STAFF_REQUIRE_TOKEN),
  per-client rate limiting, 10s timeout, deterministic fallbacks, source stamping
  (source / fallbackReason / errorCode). Keep all of that.
- The app must remain fully usable with AI disabled.

DELIVERABLES:

1. AI enable/disable control
   - Add an "AI assistance" setting (default: ON) persisted via the existing
     workspace settings/repository layer. Add src/hooks/useAiEnabled.js.
   - When OFF: useChiefOfStaff (or its caller) must NOT call the proxy. The Chief
     of Staff page renders the offline/deterministic draft generator only, with a
     calm notice: "AI assistance is off. Turn it on in Settings to generate AI
     drafts." Include a link/route to Settings.

2. "What we send" disclosure + privacy copy
   - New component src/components/chief/AiDisclosure.jsx (or features/ai/):
     - Always-visible line near the action button:
       "This sends the notes you typed above to our AI provider to generate a
        draft. Nothing else from your workspace is included."
     - Expandable "See what we send" showing the exact request payload
       ({ actionKey, notes }) — read-only, monospace.
   - Add a short retention/privacy paragraph to Settings AND to
     docs/CONFIGURATION.md, stating: typed notes are sent per-request to the
     model provider and not stored by CEO OS as training data; AI outputs are
     saved only when the user clicks "Add to workspace"; telemetry records
     latency/error-code/action name but never note content.

3. Source/provenance on every output card
   - Audit ChiefOutputPanel + its child cards: every rendered AI output must show
     a visible badge — "AI draft" when source === "proxy", "Offline draft
     (generated locally)" when source === "fallback" — plus a human-readable
     fallbackReason when present. Add src/components/chief/AiSourceBadge.jsx if a
     reusable pill doesn't already exist; reuse SourceStatusNotice where it fits.

4. Consistent four-state rendering
   - Ensure the Chief of Staff flow renders exactly: idle (disclosure + action
     buttons), loading (reuse OutputLoadingState — calm skeleton, no raw
     spinner), result (editable cards), error/fallback (notice + offline draft +
     one Retry button). Map every failure in this list to a calm message and a
     fallback result (no thrown errors, no infinite spinner):
       AI disabled • OPENAI_API_KEY unset • network/fetch failure • 429 rate
       limit • model timeout • malformed model output • auth misconfig •
       empty notes (inline validation, no call) • notes over MAX_NOTES_LENGTH
       (proceed on first ~12000 chars with an inline note).
   - The OPENAI_API_KEY-unset path must already (or must now) return
     { source: "fallback", fallbackReason: "AI provider not configured" } from
     the proxy — never a 500, never naming the missing variable. Verify and fix
     in server/chiefOfStaffProxyCore.js if needed.

5. Copy audit
   - Remove any phrasing implying autonomy or magic ("your AI Chief of Staff",
     "instantly understands", "automatically"). Standardize on "AI-assisted
     drafting". AI output is always presented as a draft the user edits and
     accepts.

6. Tests (Vitest + existing patterns)
   - useAiEnabled: ON/OFF behavior; OFF prevents proxy calls.
   - AiDisclosure: renders the static line; expandable shows the { actionKey, notes }
     payload and nothing else.
   - ChiefOfStaff page: renders all four states; AI-OFF state hides the network
     action and shows the Settings link; fallback results show the offline badge
     + reason.
   - Proxy: OPENAI_API_KEY-unset returns a fallback (not 500) and does not leak
     the variable name.
   - Do not break existing tests in api/, server/, shared/, src/components/chief/.

7. Docs
   - Update docs/CONFIGURATION.md with the AI toggle, the privacy/retention
     paragraph, and the proxy guarantees (token fail-closed, rate limit default
     10/min, 10s timeout, fallback-on-failure).
   - Add a short "AI assistance" section to README.md pointing at this roadmap
     (docs/AI_ROADMAP.md) and stating that AI is optional, bounded, and
     server-proxied.

CONSTRAINTS:
- No new dependencies unless strictly required; if you add one, justify it in the
  PR description.
- No client-side secrets; no VITE_*_API_KEY.
- Keep components small, lazy-load heavy panels (match the existing
  ChiefTelemetryDiagnosticsPanel lazy-import pattern).
- Render only normalized fields in the DOM — never raw model text.
- Conventional, descriptive commits. Open a PR as ready for review with a summary
  + test plan.

OUT OF SCOPE (do not do): new AI actions, new model providers, chat UI,
auto-apply of AI output, agents, predictive scoring, proactive notifications.
```

---

## 12. Evaluation & Quality Gate

"Trustworthy" needs a definition you can test. Right now there is none — this is
the single biggest gap before enabling a new model or changing a prompt.

**Fixtures.** Keep ~10–15 realistic "scattered notes" inputs in
`shared/__fixtures__/aiNotes/` (anonymised, hand-written — meeting residue,
half-thoughts, mixed topics). Each fixture has expected *structure*, not
expected *exact text*: e.g. "produces ≥1 priority", "every task references
something present in the notes", "no section is padded past what the notes
support".

**Checks (the things that actually erode trust):**

- **No invented facts.** Every named person, date, metric, or commitment in the
  output appears in (or is trivially derivable from) the input. Approximate via
  substring/entity overlap; flag misses for human review.
- **No padding.** A thin note → mostly-empty sections, not 12 invented bullets.
- **Schema conformance.** Output parses to the action's fixed schema; item
  counts/lengths within `MAX_STRUCTURED_ITEMS_PER_SECTION` /
  `MAX_STRUCTURED_TEXT_LENGTH`.
- **Tone.** No "as an AI", no hype words, no flattery (simple word-list check).
- **Fallback parity.** The offline fallback for each action also passes schema +
  tone checks, so degrading never produces something embarrassing.

**Where it runs:**

- `npm run eval:ai` — runs fixtures against the *fallback* path always (no
  network, runs in CI on every PR) and against the *live model* path only when
  `OPENAI_API_KEY` is present (manual / pre-release).
- A short `docs/AI_EVAL.md` records the current pass rate and any known-weak
  fixtures. Treat a regression here like a failing test.

**Versioned together with prompts** (see §4 / §8): when a prompt or model
changes, re-run the gate; record the result against the new prompt version.

This is cheap to start (a script + fixtures + a couple of heuristics) and is the
thing that lets you say "we have a regression gate" instead of "we hope it's
good".

---

## 13. Cost & Abuse Controls

Rate limiting (`CHIEF_STAFF_RATE_LIMIT_PER_MINUTE`, default 10/min/client)
protects latency. It does **not** protect the bill or bound a single workspace's
spend. Add, server-side:

- **Per-workspace action budget.** A soft daily cap and a hard monthly cap on AI
  actions per workspace (env-configurable, sensible defaults). When the soft cap
  is hit, the proxy returns `{ source: "fallback", fallbackReason: "Daily AI
  limit reached" }` and the UI shows the calm "you've used your AI drafts for
  today — here's a local draft" state. The hard monthly cap behaves the same and
  is logged.
- **Max output size.** Cap model `max_output_tokens` server-side (in addition to
  the existing per-section/per-item clamps) so a single call can't balloon.
- **Idempotent retry only.** The one Retry affordance (§9) must not multiply
  spend — no auto-retry loops, no retry storms.
- **Spend observability.** Log per-request: action, latency, model, approx
  token usage, outcome (`proxy` / `fallback` / error code), workspace id hash.
  No note content. This feeds a simple daily spend rollup.
- **A documented kill switch.** A single env var (or the existing
  `CHIEF_STAFF_REQUIRE_TOKEN` fail-closed behaviour plus an explicit
  `disable` flag) that turns off all paid model calls instantly and falls the
  whole app back to offline drafts — no deploy required.

Budgets are also user-facing trust: "AI is bounded and won't run away with
itself" is part of the calm promise.

---

### Appendix — current-state checklist (what already exists vs. what Phase 0 adds)

| Requirement before paid API calls | Status |
|---|---|
| Server-side env var handling (`OPENAI_API_KEY`, proxy) | ✅ exists |
| Fail-closed auth + rate limiting + request timeout | ✅ exists |
| Loading states | ✅ exists (`OutputLoadingState`) |
| Error states | ✅ exists (`PanelErrorFallback`, `loadError`) |
| Deterministic fallback behavior | ✅ exists (`CHIEF_ACTIONS[*].fallback`) |
| Source/provenance stamping | ✅ exists (`source`, `fallbackReason`, `errorCode`) |
| Content-free telemetry | ✅ exists (`app-error-telemetry`) |
| User-facing AI on/off control | ⬜ Phase 0 |
| "What we send" disclosure | ⬜ Phase 0 |
| Privacy/retention copy | ⬜ Phase 0 |
| Copy audit for magic/autonomy phrasing | ⬜ Phase 0 (partly done) |
| Per-workspace spend ceiling + kill switch (§13) | ⬜ Phase 0 |
| Evaluation gate (`npm run eval:ai`, fixtures) (§12) | ⬜ Phase 0 |
| "Forget this" / clear-drafts control (§6, §13) | ⬜ Phase 0 |

When the ⬜ items are done, paid model calls are appropriate to enable in
production. Until then, the offline fallback is the safe default.

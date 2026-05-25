# Case Study: CodeHerWay CEO OS

## 1) Problem framing

Founders and small operators frequently manage fragmented workflows across opportunities, content, and weekly planning, often with disconnected tools and fragile data sync.

This repository demonstrates a single-screen, browser-first operations dashboard that solves that problem by:

- Keeping domain logic organized by feature and responsibility boundary
- Maintaining local-first resilience by default
- Integrating AI assistance where it adds leverage (executive summaries, prioritization suggestions, content planning support)
- Preserving accessibility and status clarity as first-class UX concerns

## 1.1) Visual evidence map

The following assets are referenced for portfolio review and should be kept current with the app:

- Dashboard proof: `docs/assets/screenshots/dashboard-overview.png`
- Opportunities proof: `docs/assets/screenshots/opportunities-pipeline.png`
- Weekly brief proof: `docs/assets/screenshots/weekly-brief-planning.png`
- Chief of staff proof: `docs/assets/screenshots/chief-of-staff-structured-output.png`
- Settings proof: `docs/assets/screenshots/settings-workspace-profile.png`
- Walkthrough demo: `docs/assets/demo/ceo-os-workflow-walkthrough.webm`
- Capture/update workflow: `docs/assets/CAPTURE_GUIDE.md`

### Visual preview highlights

#### Dashboard overview

![Dashboard visual proof](docs/assets/screenshots/dashboard-overview.png)

#### Chief of Staff structured workflow

![Chief of staff visual proof](docs/assets/screenshots/chief-of-staff-structured-output.png)

## 2) Architecture and decisions

### Decision: route-level thin composition + repository ownership

- **Goal:** minimize churn in pages while keeping behavior testable.
- **Implementation:** route pages primarily compose components and hooks; domain hooks coordinate lifecycle + state; repositories own persistence and API boundaries.
- **Evidence:** dashboard/weekly/chief workflows are split across:
  - `src/pages/*`
  - `src/hooks/*`
  - `src/lib/*`
- **Visual tie-in:** the dashboard and weekly brief screenshots should show unchanged page-level composition while data orchestration remains hook/repository-driven.

### Decision: local-first with Supabase upgrade path

- **Goal:** preserve usability even without backend credentials.
- **Implementation:** repositories first attempt local storage fallback, and prefer Supabase when configured.
- **Evidence:** source-aware flags (`local` / `supabase`) are surfaced to the UI and tests validate fallback behavior.
- **Visual tie-in:** settings and dashboard captures should show `Local only`, `Offline`, or `Synced` source-status cues without implying queued replay.

### Decision: AI through a server proxy

- **Goal:** avoid client-exposed provider secrets and keep response failure handling explicit.
- **Implementation:** route-side proxy endpoints for Vercel and Netlify; `src/lib/openai.js` performs output extraction and structured parsing with fallback handling.
- **Evidence:** parser tests cover direct payloads, fenced JSON, fallback content paths, and tool-output text arrays.
- **Visual tie-in:** chief-of-staff screenshot and walkthrough should show structured output acceptance flow and fallback-safe interaction language.

## 2.1) Product outcome narrative

- Operators can move from weekly priorities to action without leaving one shell.
- Founder content planning stays visible alongside opportunity momentum.
- AI assistance is integrated as an accelerant, not a hidden dependency, because fallback output paths remain explicit.
- Portfolio reviewers can trace each claim to both source code and visual proof assets.

## 3) Hardening focus for production credibility

- Safe normalization for:
  - null/undefined dashboard inputs
  - malformed weekly payloads
  - structured AI outputs
- Explicit user feedback for generation/acceptance outcomes and errors
- Deterministic metadata and shell behavior for route transitions
- Route rendering derived from shared route metadata so navigation, page metadata, and router paths stay aligned
- App-shell error recovery catches layout/sidebar/topbar crashes, not only route-view crashes
- Event-driven refresh strategy to keep screens synchronized after mutations
- Focus Home capture, journal, and reminder subscriptions are centralized in a dedicated hook instead of living inside the route page
- Deterministic route-crash recovery back to Focus Home rather than browser-history-dependent recovery
- Mounted-ref lifecycle guards for CRUD saves/deletes and confirmation flows so async mutations do not update unmounted screens
- Strict-mode-safe hydration guards so local-first state restores reliably during real browser reloads and reviewer demos
- Stale async refresh guards for shared pulse and telemetry hooks so route changes do not overwrite current state with older request results
- Settings persistence rejects failed writes explicitly and prevents duplicate save submissions while a save is already in flight
- Chief workspace and Weekly Brief persistence use required local-write semantics so failed browser storage cannot look like a successful save
- Weekly Brief rejects stale local item mutations before writing or emitting update events
- Weekly Brief Supabase item rows preserve `updated_at` and use expected timestamps for focused update/delete conflict checks
- Capture rejects stale sticky-note update/delete attempts before writing or emitting update events
- Opportunities and Content OS reject stale local update/delete attempts through shared record-mutation guards
- Route-level splitting for Chief telemetry diagnostics so operational detail does not inflate the first Chief of Staff route load
- CI enforcement for lint, build, test, and typecheck on every pull request
- Optional fail-secure proxy auth mode plus bounded in-memory rate-limit tracking for AI traffic
- Central data-schema registry plus a versioned Weekly Brief storage envelope, with legacy local data still readable

## 4) Accessibility and UX posture

- One consistent navigation shell with skip-link + focus restore
- Semantic route composition and consistent form behavior
- Local status indicators for data source and loading/error state
- Source-status and System Pulse cues expose accessible status/labels while staying visually lightweight
- Keyboard-friendly editing and workflow actions
- Compact mobile navigation closes predictably after route clicks, programmatic navigation, and history returns
- Focus Home loading and reminder-helper states expose busy/status/description semantics for assistive technology
- Settings form states expose busy, disabled, and invalid-timezone feedback through accessible control names without duplicate alerts
- Weekly Brief autosave copy changes when persistence is paused so the page does not reassure users incorrectly during failures
- Capture and Journal share autosave health copy so local save failures are visible without adding extra decision load
- Opportunity and Content stale-record errors tell users when refresh/retry is the right recovery path

## 5) Verification set

Run before sharing this case study or merging new work:

```bash
npm run lint
npm run build
npm run test:run
npm run typecheck
npm run check:route-budgets
npm run check:route-budgets:trend
npm run test:e2e
```

## 6) Current boundaries and next-step roadmap

- Additional telemetry around AI fallback reasons and acceptance rates
- More cross-domain event synchronization tests under concurrent multi-screen updates
- Continued refresh of screenshot/demo artifacts as UI polish evolves

## 7) Latest hardening updates (April 23, 2026)

- Dashboard KPI semantics now distinguish warning vs positive context so risk-heavy summaries are not visually framed as success.
- Dashboard snapshot, pipeline, and activity surfaces now use semantic list markup with explicit accessible labels.
- Supabase runtime access was centralized into `src/lib/supabaseRuntime.js`, removing repeated adapter/config boilerplate across repositories.
- Added focused unit coverage for shared runtime behavior and dashboard/activity rendering semantics.

## 8) Latest hardening updates (April 30, 2026)

- Netlify direct-route reloads are protected by an SPA fallback and covered with Playwright direct-route refresh tests.
- Route labels, navigation items, and page metadata now come from centralized route definitions to reduce drift.
- Route-level error boundaries reset on navigation so one failed view does not trap the rest of the app shell.
- Chief of Staff fallback output is explicitly labeled, preserves proxy error metadata, and explains when no structured actions can be saved.
- Chief workspace notes now persist across reloads, reset cleanly, and are covered by Playwright to prove the workflow behaves like a saved workspace.
- Async mount guards were normalized for Strict Mode so dev/test reload behavior matches production expectations more closely.
- Reminder completion now records completion timestamps and feeds a visible Focus Home progress summary.
- Sample-data/source messaging has been rewritten as product-facing local workspace language rather than developer setup copy.
- System Pulse and Chief telemetry refreshes now ignore stale async responses during fast navigation and Strict Mode remounts.
- Dashboard next-move recommendations now clear when they no longer belong to the current execution queue.
- Focus Home next-action logic is extracted to `src/lib/focusHomeLogic.js`, where blocked work, reminders, and journal heaviness are ranked as calm decision-support signals.
- Focus Home support-mode controls now use roving keyboard focus and have Playwright coverage for keyboard switching plus reminder completion.
- Obsolete legacy Chief AI prompt/output components were removed so the product has one maintained Chief of Staff workflow path.
- Chief telemetry diagnostics are lazy-loaded separately from the main Chief of Staff route to keep route budgets green while preserving observability.
- Error-boundary recovery now routes directly to Focus Home, giving users a reliable escape hatch from a failed view.
- App route declarations now derive paths from shared route metadata, reducing future route/navigation drift.
- Completed reminders remain visible and can be toggled back to pending, so progress tracking is reversible.
- Focus Home support-mode radios now support vertical arrow keys as well as horizontal arrows.
- Playwright now verifies reversible reminder completion and route budgets remain within trend limits.
- CRUD save/delete flows now guard duplicate in-flight submits and avoid late state updates after route changes.
- Mounted-ref lifecycle handling is centralized in a shared hook for mutation-heavy hooks.
- Stale reminder toggle/delete attempts are rejected without emitting fake progress events.
- Completed reminder styling now preserves checkbox/control contrast while keeping text-level completion cues.
- Confirmation unmount safety is covered with targeted hook tests, and the full QA gate remains green.
- Settings saves now guard duplicate in-flight submits and reuse the shared mounted-ref lifecycle helper.
- Settings persistence failures now reject explicitly, avoiding false cross-tab update events when local storage fails.
- Settings validation now disables saving with an explanatory accessible name and announces invalid timezone feedback once.
- Settings page tests cover saving state, invalid timezone feedback, changed workspace fields, and save submission.
- Chief workspace local note/output writes now reject when browser storage fails.
- Required localStorage write handling is centralized in `src/lib/utils.js` and reused by local-first repositories.
- Weekly Brief update/delete mutations now reject stale item ids without emitting fake update events.
- Weekly Brief communicates paused autosave state when persistence errors are active.
- Tests cover Chief note-save errors, Weekly stale mutations, failed weekly persistence, and Weekly Brief autosave copy.
- Capture stale edits/deletes now reject without emitting fake sticky-note update events.
- Capture and Journal autosave status now moves to paused copy when local persistence fails.
- Tests cover Capture stale mutations and Capture/Journal local save failure UI.
- Opportunities and Content OS stale edits/deletes now reject without emitting fake update events.
- Shared record-mutation guards in `src/lib/stateUtils.js` reduce duplicated local CRUD failure handling.
- Integration tests cover stale-record recovery guidance in Opportunity and Content workflows.

## 9) Latest hardening updates (May 1, 2026)

- App-shell crash recovery now wraps the full router/Suspense shell, so non-route shell failures return a stable recovery UI instead of a blank app.
- Focus Home decision-support logic moved out of the route page and into tested product logic.
- Next-move recommendations now include blocked priorities, pending reminders, and journal entries that name heaviness without a next action.
- Source-status cues and System Pulse nodes now have accessible status/label semantics and stronger small-screen wrapping behavior.
- Added tests for global app recovery, source-status trust cues, System Pulse labels, and Focus Home decision rules.
- Full local verification passed on May 1, 2026: lint, typecheck, full Vitest, build, route budgets, and Playwright E2E.
- Compact mobile navigation now closes across clicks, programmatic route changes, and browser-history returns.
- Focus Home signal subscriptions now live in `src/hooks/useFocusHomeSignals.js`, keeping the route focused on composition.
- Next-move guidance now prioritizes the oldest pending reminder and avoids awkward punctuation in quoted actions.
- Focus Home reminder input copy now connects helper and progress context through accessible descriptions.
- Playwright coverage now includes a 390px mobile navigation flow through Capture and browser-back behavior.

## 19) CEO OS audit follow-up (May 7, 2026)

A focused cloud-readiness pass that stays inside the current scope boundaries:

- **Weekly Brief Supabase timestamp contract**
- `weekly_brief_items` list/create/update selectors now include `updated_at`, and Supabase rows normalize into positive `updatedAt` values.
- Supabase item updates apply the caller's expected timestamp as an `updated_at` equality filter before returning the updated row.
- Timestamped Weekly Brief deletes now reject stale local and Supabase attempts instead of emitting fake progress after another session changed the item.
- `src/lib/dataSchema.js` now names the primary storage domains and model shapes, and Weekly Brief local storage writes a `{ schemaVersion, domain, model, data }` envelope while reading legacy stores.
- Dashboard CSS now stays inside the static route budget by removing unused/decorative Focus Home styling instead of weakening the route-budget check.

- **Scope preserved**
  - This is mocked repository coverage for the Weekly Brief item contract, not a full authenticated Supabase regression across every mutable table.
  - Account onboarding/recovery, local-to-cloud migration, full offline replay, fuzzy Chief dedup, and export/import backup remain documented next-step work.

### Tests added in this batch

- 5 cases in `weeklyRepositorySupabase.test.js` — Supabase timestamp load/create/update/delete conflict behavior.
- 1 case in `weeklyRepository.test.js` — stale local delete rejection by `expectedUpdatedAt`.
- 3 cases in `weeklyRepository.test.js` — versioned Weekly Brief local storage writes plus legacy/current envelope reads.
- 4 cases in `dataSchema.test.js` — schema registry, envelope creation, legacy reads, and domain mismatch handling.
- 1 case in `useWeeklyBrief.test.js` — delete flows thread `expectedUpdatedAt` from loaded Weekly Brief items.

## 18) Calm-OS audit follow-ups (May 2, 2026, batch eight)

A focused six-phase pass that ships the long-pending offline-write queue
infrastructure plus several smaller correctness wins:

- **Unmount-safe promotion toasts** (`usePromotionAction`)
  - The hook awaited an async run, then called `onShowToast`. If the
    parent unmounted while run was pending, the toast still fired
    through a stale closure. Added `useIsMountedRef` and gated all
    three toast callsites (success, failure, empty-text) on
    `isMountedRef.current`. Two new tests prove no toast fires
    after unmount on either resolve or reject.

- **Capture promotions consolidated** (`useCaptureNotePromotions`)
  - Three near-identical `usePromotionAction` blocks on `Capture.jsx`
    (~45 lines of repeated config) collapsed into one
    `useCaptureNotePromotions({ notes, showToast })` hook returning
    `{ promoteToReminder, promoteToOpportunity, promoteToContentDraft }`.
    Page composition reads as intent. 5 new tests cover the hook end
    to end.

- **Offline write queue** (`offlineWriteQueue`, `useOfflineWriteQueueSize`,
  `SyncStatusPill`)
  - Long-pending audit item. `src/lib/offlineWriteQueue.js` exports
    `enqueueOfflineWrite`, `getOfflineQueue`, `removeOfflineWrite`,
    `clearOfflineQueue`, and `drainOfflineQueue(handlerByKind)`. Backed
    by localStorage, FIFO-trimmed at 200 entries, emits
    `ceo-os:offline-queue-updated`, stops on first failure, bumps
    attempts on the failed entry, leaves unknown-kind entries in place
    for forward compat.
  - `useOfflineWriteQueueSize` subscribes to the event plus the storage
    event so other tabs propagate. The `SyncStatusPill` renders a
    `+N` badge with singular/plural aria-label when the queue is
    non-empty.
  - Repository wiring is deferred until a Supabase staging environment
    is available. The intended contract is locked in by an executable
    integration-shape test (FIFO replay, stop-on-failure preserves
    later entries, multi-kind routing).

- **Storage corruption banner mobile stack**
  - Added a `max-width: 540px` breakpoint that switches the banner to
    a vertical stack with a full-width Dismiss button so the body and
    action don't squeeze each other on small phones.

### Tests added in this batch

- 2 cases in `usePromotionAction.test.js` — unmount during resolve, unmount during reject.
- 5 cases in `useCaptureNotePromotions.test.js` — full hook contract.
- 11 cases in `offlineWriteQueue.test.js` — module behaviors.
- 4 cases in `useOfflineWriteQueue.test.js` — hook subscription.
- 3 cases in `SyncStatusPill.test.jsx` — pending pill rendering.
- 3 cases in `offlineWriteQueue.integration.test.js` — replay order, stop-on-failure preservation, multi-kind routing.

Lint, typecheck, the full Vitest suite (434 tests), production build,
and route-budget checks all pass on this branch.

## 17) Calm-OS audit follow-ups (May 2, 2026, batch seven)

A focused six-phase pass surfacing two real bugs introduced by recent
batches and adding genuine product polish:

- **Silent refresh in `useCrudPage`** (`src/hooks/useCrudPage.js`)
  - Batch six wired `useCrudPage` to listen for the repository's
    `*_UPDATED_EVENT` so cross-tab writes refresh the open list. But
    the load effect always called `setIsLoading(true)`, so every CRUD
    write inside the page also briefly flashed the loading skeleton —
    the repository fires its event synchronously after a successful
    write.
  - Treat `refreshToken === 0` as the cold-load path (toggles
    `isLoading` as before) and any positive value as a refresh that
    should keep existing items on screen. Both stale-record refreshes
    and event-driven refreshes now update the list in place.

- **Shared `readUpdatedAtMs` helper** (`src/lib/staleRecordError.js`)
  - Three repositories had inline parsers for the optimistic-locking
    timestamp:
    `Number(item.updatedAt ?? item.updated_at) → finite ? raw : 0`,
    plus weeklyRepository wrapped its copy in a private function.
    Extracted into one helper next to `assertRecordIsFresh` and
    consumed by all three repos.

- **Composer persistence on Capture** (`src/pages/Capture.jsx`)
  - Replaced the local `useState` for draft text and draft category
    with `usePersistentState` so a long brain-dump survives reloads,
    route changes, and accidental navigation.
  - After a successful save, only the text resets; the category stays
    selected so the user can rapid-fire several stickies in the same
    category without reselecting.
  - Defensive normalization: an invalid stored category value (legacy
    or hand-edited) falls back to the first valid option.

- **Chief notes-limit warning token** (`src/styles/chief-of-staff.css`)
  - `.chief-notes-meta--limit` hardcoded `color: #f8a2b4` (soft pink),
    which fades to nearly invisible against a light-mode warm-paper
    background. Replaced with `var(--danger-text)` so the warning
    carries clear meaning in both themes.

### Tests added in this batch

- 1 case in `useCrudPage.test.js` — event-driven refresh keeps
  `isLoading` false; no skeleton flash.
- 4 cases in `staleRecordError.test.js` — `readUpdatedAtMs` covering
  camelCase, snake_case, mixed-precedence, and missing/non-finite paths.
- 4 cases in `Capture.test.jsx` — composer rehydration on mount,
  invalid-category fallback, persistence across remount, and
  category-stays-after-save behavior.

Lint, typecheck, the full Vitest suite (407 tests), production build,
and route-budget checks all pass on this branch.

## 16) Calm-OS audit follow-ups (May 2, 2026, batch six)

A focused six-phase pass that closes the cross-page promotion roadmap
and adds cross-tab list refresh:

- **Cross-tab list refresh in `useCrudPage`** (`src/hooks/useCrudPage.js`)
  - Cross-page promotion verbs fired createOpportunity / createContentItem
    from outside the CRUD page itself. The repository emitted its
    `*_UPDATED_EVENT` but `useCrudPage` never listened — so an open
    Opportunities or Content OS page (in another tab, or even the same
    tab right after promoting from Capture) showed stale data until reload.
  - Added an optional `updatedEventName` config; the hook subscribes to
    that window event and silently bumps the existing `refreshToken` so
    the list refetches. Cleans up on unmount or event-name change.
  - Wired `OPPORTUNITIES_UPDATED_EVENT` and `CONTENT_ITEMS_UPDATED_EVENT`
    through their respective CRUD pages, plus updated four test mocks
    to expose the new exports.

- **Extracted `StickyNoteCard` component** (`src/components/capture/StickyNoteCard.jsx`)
  - Capture.jsx had grown to 310 lines as the per-note action surface
    accumulated four buttons. The mapped `<article>` block was 70 lines
    on its own.
  - Moved the entire sticky-note DOM (meta header, textarea, controls,
    promotion buttons) into a focused component. Promotion buttons
    render only when their handler is supplied so future verbs can be
    added without touching the markup.
  - Capture.jsx is now composition-only over the sticky list (310 → 253
    lines); same DOM shape, no behavior change.

- **Capture → Content draft promotion** (`Capture.jsx`)
  - Fourth and final cross-page verb. "Draft as content" button on every
    sticky calls `createContentItem` with the note text as the title;
    platform is empty and status is `Drafting` so the user lands on
    Content OS ready to fill in platform and publish status.
  - Toast: *"Drafted on Content OS. Open the Content page to set
    platform and publish status."* The original sticky stays.

- **Mobile sticky controls + journal light polish** (capture.css, journal.css)
  - With four promotion buttons + a category select, a vertical stack
    pushed each sticky to ~360 px tall on mobile. Switched to a CSS
    grid with the select spanning the full row and the four buttons
    in a 2×2 grid below, keeping every action above the fold.
  - Added a `:root[data-theme="light"]` override for
    `.journal-prompts__item`. The default border mixes 24% accent into
    the translucent ink-blue border, which read slightly too saturated
    on a light surface for reflective writing. Dropped to plain
    `var(--border)` and lightened the surface to
    `rgba(255, 255, 255, 0.85)` so the prompts feel like calm paper.

### Tests added in this batch

- 2 cases in `useCrudPage.test.js` — `updatedEventName` triggers
  refetch; missing config means no event subscription (back-compat).
- 5 cases in `StickyNoteCard.test.jsx` — the component contract
  (always-on Delete, opt-in promotion buttons, edit and delete
  forwarding).
- 1 case in `Capture.test.jsx` — Draft-as-content success path.
- 1 case in `Capture.test.jsx` — Draft-as-content double-click guard.

Lint, typecheck, the full Vitest suite (398 tests), production build,
and route-budget checks all pass on this branch.

## 15) Calm-OS audit follow-ups (May 2, 2026, batch five)

A focused six-phase pass on the next set of audit follow-ups, plus
defensive hardening on the cross-page promotion verbs introduced in
batches four:

- **Hardened both promotion handlers** (`Capture`, `Dashboard`)
  - The Capture sticky → Reminder and Reminder → Weekly Priority
    handlers shipped in earlier batches without an in-flight guard or
    a stale-id check. A user could click Promote twice on a slow
    connection and create two priorities from the same reminder.
  - Added a per-record `Set` ref of in-flight ids, plus a membership
    check against the current collection, so promotions for records
    that were deleted in another tab between render and click can no
    longer fire spurious creates.

- **Extracted `usePromotionAction` hook** (`src/hooks/usePromotionAction.js`)
  - Capture and Dashboard shared the same control flow: id guard,
    in-flight Set, async run, success/failure toast, slot release.
    Three verbs ahead — Capture → Reminder, Reminder → Priority,
    Capture → Opportunity — would mean three copies of that flow.
  - Encoded the flow once. Callers supply `onShowToast`,
    `isRecordKnown`, `run`, and optional success/failure/empty-text
    messages; the hook returns a stable callback that handles guard,
    invocation, and feedback. Six unit tests cover happy path,
    missing id, unknown id, empty text, rapid double-click rejection
    with slot release, and failure with retry-after-error.

- **Capture → Opportunity verb** (`Capture.jsx`)
  - Third cross-page promotion verb, mirrors the existing two. A
    "Track opportunity" button on every sticky calls `createOpportunity`
    with the note text as the name; company, priority, stage, and
    next step are seeded with sensible defaults (`Medium`/`New`/empty)
    so the user lands on Opportunities ready to fill in the rest.
  - Toast: *"Tracked as a new opportunity. Open the Opportunities page
    to fill in company and next step."*

- **Light-mode polish + accessible tap targets**
  - Bumped Dashboard inline Promote/Remove link buttons from ~17 px
    tall (`padding: 0`, `font: 0.85rem`) to a 32 px+ tap target with
    a visible `2px outline-offset: 2px` focus ring. Closer to WCAG's
    44 × 44 px touch-target recommendation while keeping the muted
    text-link feel.
  - Added light-theme overrides for the Weekly autosave status-dot
    box-shadow rings (idle, saving, saved, error). The defaults use
    rgba white at 0.04 and brand-cyan at 0.18; both wash out on a
    light-paper surface, so the overrides swap to ink-on-paper halos
    so the pulse animation remains legible in light mode.

### Tests added in this batch

- 6 cases in `usePromotionAction.test.js` — full hook contract.
- 1 case in `Dashboard.test.jsx` — Promote double-click guard.
- 1 case in `Capture.test.jsx` — Track-opportunity success path.
- 1 case in `Capture.test.jsx` — Track-opportunity double-click guard.

### Budget note

Weekly Brief CSS raw budget bumped from 3.0 kB → 3.5 kB to absorb the
light-mode autosave-status-dot ring overrides. Gzip ceiling unchanged
at 1.2 kB (current ship: 0.91 kB).

Lint, typecheck, the full Vitest suite (389 tests), production build,
and route-budget checks all pass on this branch.

## 14) Calm-OS audit follow-ups (May 2, 2026, batch four)

A focused six-phase pass on the next set of audit follow-ups, paired with two
quality additions that fell out of recent work:

- **Stale-write recovery now refreshes the list** (`useCrudPage`)
  - After Phases 9–11 added `StaleRecordError` rejection on save, the form
    modal stayed open with the friendly *"changed in another window"*
    message — but the items list behind it still showed the old snapshot.
  - Added a `refreshToken` state and a `refreshItems` callback. On
    stale-record errors only, `useCrudPage` bumps the token to re-fetch
    the list while keeping the modal open. Non-stale errors do not
    trigger a refetch (covered by an explicit test) so transient network
    failures don't spam the API.

- **Shared `assertRecordIsFresh` helper** (`staleRecordError.js`)
  - Three repositories carried the same shape of optimistic-locking guard
    inside their local update paths. About 30 lines of duplication.
  - Extracted a single `assertRecordIsFresh(persistedRecord,
    expectedUpdatedAt, message)` helper encoding the same back-compat
    semantics: skip when `expectedUpdatedAt` is missing/non-positive,
    skip when persisted has no positive timestamp (legacy data), throw
    on real mismatch. Opportunities, Content OS, and Weekly items all
    consume the helper now.

- **Reminder → Weekly Priority promotion** (`Dashboard`, `RemindersPanel`)
  - Mirrors the Capture sticky → Reminder verb: each pending reminder
    exposes a "Promote" button that calls `createWeeklyItem` with
    `itemType: 'priority'`, refreshes the weekly brief silently, and
    shows a calm toast: *"Added to this week's priorities. The reminder
    stays here."*
  - Original reminder stays so the user can choose whether to keep it
    as a daily nudge or remove it manually.

- **Light-mode polish + empty-state consistency**
  - Toned down the diagonal accent stripe behind the Focus Home grid in
    light mode; reset focus-panel borders so overwhelmed/focused chips
    don't bleed warning colors into a calm-paper surface.
  - Strengthened the storage-corruption banner contrast in light mode.
  - Replaced Capture's inline `<div className="empty-state">` with the
    shared `<EmptyState />` component to match the pattern used by
    Opportunities and Content OS.

### Tests added in this batch

- 1 case in `useCrudPage.test.js` — stale-record error triggers `refreshItems`.
- 1 case in `useCrudPage.test.js` — non-stale errors do NOT trigger a refetch.
- 5 cases in `staleRecordError.test.js` — helper throw/default/exact-match/skip paths.
- 1 case in `Dashboard.test.jsx` — promotion creates a weekly priority, fires `refreshWeeklyBrief({ silent: true })`, shows toast, leaves the reminder visible.

### Budget note

Dashboard CSS raw budget bumped from 4.0 kB → 5.0 kB to absorb the
Reminder → Priority promote button styles and the Focus Home light-theme
overrides. Gzip ceiling unchanged at 1.5 kB (current ship: 1.32 kB).

Lint, typecheck, the full Vitest suite (380 tests), production build, and route-budget checks all pass on this branch.

## 13) Calm-OS audit follow-ups (May 2, 2026, batch three)

Closing the next four items from the audit's remaining-risks list:

- **Weekly Brief stale-write rejection** (`weeklyRepository`, `useWeeklyBrief`)
  - Extended the Phase 9-10 pattern to weekly priorities, wins, and blockers. `createWeeklyItem` stamps `updatedAt`; `updateWeeklyItem` accepts `expectedUpdatedAt` and the local path throws `StaleRecordError` when the persisted timestamp drifts.
  - `useWeeklyBrief.persistCollectionDiff` threads each previous record's `updatedAt` through, and the recovery handler shows a friendly *"changed in another window"* message instead of the generic copy when a stale conflict is detected.

- **Cross-page promotion: Capture → Reminder** (`Capture.jsx`)
  - Each sticky note now has a "Make reminder" action next to Delete. It calls `createReminder({ text })` on the existing reminders repository so the new reminder shows up immediately on Focus Home through the same `REMINDERS_UPDATED_EVENT` path other surfaces listen to.
  - The original sticky stays so the user can decide whether to keep the long-form context or delete it manually.

- **Light-mode visual sweep** (`system.css`, `chief-of-staff.css`)
  - System.css and chief-of-staff.css use raw `rgba()` for the brand-specific glow geometry (radial body backgrounds, card top-shimmer, focus panels, focus chips, signal nodes, sticky notes, fallback warning surfaces). On dark these read fine; on light they either disappear or read as smudges.
  - Added focused `:root[data-theme="light"]` override blocks at the bottom of each file that retune those surfaces for proper contrast and warmth without touching the dark theme.

- **axe-core a11y scaffolding** (`e2e/a11y-sweep.spec.js`)
  - Added `@axe-core/playwright` and a Playwright spec that scans every primary route with `wcag2a`/`wcag2aa`/`best-practice` rules.
  - Test fails only on `serious` or `critical` impacts so the suite stays a reliable guardrail without flaking on cosmetic minor issues; lighter findings are reported via `console.info` for review.

### Tests added in this batch

- 3 new cases in `weeklyRepository.test.js` — stamped on create, stale rejection across two simulated tabs, back-compat without `expectedUpdatedAt`.
- 1 new case in `Capture.test.jsx` — promotion writes a reminder to localStorage and the sticky stays.
- 9 new Playwright cases in `e2e/a11y-sweep.spec.js` — one axe scan per primary route.

Lint, typecheck, the full Vitest suite (372 tests), production build, and route-budget checks all pass on this branch. The Playwright a11y sweep parses cleanly and registers all 9 cases — exercising it requires browsers installed via `npx playwright install`.

## 12) Calm-OS audit follow-ups (May 2, 2026, batch two)

Closing the highest-value items from the audit's "remaining risks" list:

- **Light theme** (`tokens.css`, `useThemePreference`, Settings)
  - Added a `:root[data-theme="light"]` overlay that retunes ~70 semantic tokens (surfaces, borders, shadows, accents, danger/warning, blueprint glows) without removing the dark palette. Token semantics already supported this.
  - `useThemePreference` reads a System / Dark / Light preference from a dedicated localStorage key (no Supabase profile-schema migration needed), reacts to `prefers-color-scheme` changes when "System" is selected, and applies `data-theme` to `<html>`.
  - Settings exposes a three-choice radio group with descriptive helper text. Changes apply immediately.

- **Online/offline awareness** (`useOnlineStatus`, `SyncStatusPill`)
  - `useOnlineStatus` subscribes to `online`/`offline` events and defaults to true in SSR-safe contexts.
  - The sync pill now combines source and online status with a clear priority: **Offline** > **Local only** > **Synced**. The offline state has a calm pulse animation that respects `prefers-reduced-motion`.
  - Descriptor logic moved to `src/lib/syncStatusDescriptors.js` so the component file only exports a component (Vite Fast Refresh) and the helper is independently unit-tested.

- **Optimistic locking for local CRUD** (`opportunitiesRepository`, `contentRepository`, `useCrudPage`, `staleRecordError`)
  - Local writes now stamp `updatedAt` on create/update.
  - `updateOpportunity` and `updateContentItem` accept `options.expectedUpdatedAt`. When the persisted timestamp doesn't match, they throw a `StaleRecordError` *before* writing or emitting an update event — closing the previously-silent "two tabs save the same record" data-loss path on the local-first surface.
  - `useCrudPage` threads the timestamp through for items that have one (the legacy two-arg contract is preserved for repos that don't track timestamps), detects the conflict via `isStaleRecordError`, and shows a friendly form error: *"This record was changed in another window. Reload to see the latest version before saving."*
  - Supabase-backed paths are intentionally unchanged here — server-side optimistic locking would require a schema migration that is out of scope for this branch.

- **Chief of Staff dedup** (no code change needed)
  - Re-reading `useChiefStructuredAcceptance` showed that exact-match dedup against existing rows already runs at every acceptance branch. A *fuzzy*-match upgrade is real product work that risks blocking legitimate distinct items, so it was reframed as a follow-up rather than a fix.

### Tests added in this batch

- `themePreference.test.js` (6 tests) — pure helper validation and applied-theme resolution.
- `useThemePreference.test.js` (5 tests) — initial OS read, attribute application, persistence, invalid-value rejection, OS-change reactivity.
- `useOnlineStatus.test.js` (3 tests) — initial value, online event, offline event.
- Extended `SyncStatusPill.test.jsx` (8 tests total) — covering offline > local > synced priority.
- `staleRecordError.test.js` (3 tests) — code/name/instance detection.
- New `useCrudPage` tests (2) — `expectedUpdatedAt` threading and friendly stale-record form error.
- New `opportunitiesRepository.test.js` cases (3) — stamped timestamps, stale rejection, back-compat without `expectedUpdatedAt`.
- New `contentRepository.test.js` cases (2) — stamped timestamps and stale rejection.

Lint, typecheck, the full Vitest suite (368 tests), production build, and route-budget checks all pass on this branch.

## 11) Calm-OS audit pass (May 2, 2026)

Driven by a structured product/UX audit of the CEO OS. Highlights:

- **Trust signals over silence**
  - `usePersistentState` now preserves any unreadable JSON blob under `${key}__corrupt_<ts>` (capped at three backups per key) and emits `ceo-os:storage-corruption`. The new `StorageCorruptionBanner` renders an inline, dismissible notice so a parse failure can never silently empty a journal or weekly brief.
  - `SyncStatusPill` reads `useWorkspaceSettings().source` and exposes `Synced` / `Local only` directly in the topbar — closing the previously silent Supabase-fallback path.
  - The Weekly Brief close-of-week reflection now debounces autosave to 600ms, surfaces a `Saving / Saved / Couldn’t save` indicator, and routes failures through `useToast` and `appErrorTelemetry`.
- **IA + tonal scope**
  - The sidebar now groups routes into **Today / This week / Workspace / Account**. Account-group links (including Ops Reliability) are visually demoted so daily surfaces lead the eye, without removing the underlying SLO/telemetry infrastructure.
  - `SystemPulse` is hidden on Settings and Ops Reliability so action-mode copy does not pull at users in setup or diagnostic contexts.
- **Architecture**
  - `Dashboard.jsx` is split into `FocusModeChips` and `RemindersPanel` (491 → 379 lines).
  - The `.crm-table` primitives are extracted into a shared `src/styles/crm-table.css` consumed by Opportunities and Content OS, removing duplicated rules.
  - Settings now autosaves on blur and on toggle change while keeping the explicit Save button as a "save now" affordance.
- **Motion**
  - `--duration-fast / --duration-base / --duration-deliberate` and `--easing-standard` added to `tokens.css`. Sidebar links and the new sync pill consume them; further surfaces can converge incrementally.
- **Tests added in this pass**
  - `storageCorruption.test.js` — backup-key shape, event payload, 3-backup cap.
  - `StorageCorruptionBanner.test.jsx` — appears on event, dismisses on click.
  - `SyncStatusPill.test.jsx` — supabase / local / unknown rendering.
  - Extra `WeeklyBrief` tests — `Saved.` indicator, debounced commit on idle.
  - Extra `usePersistentState` test — corrupted load preserves blob and emits event.
  - Extra `routes` tests — `buildNavGroups` ordering and complete coverage.

Lint, typecheck, the full Vitest suite (340 tests), production build, and route-budget checks all pass on this branch. Playwright e2e was not exercised in the sandbox because the browser binaries were not installed; the suites themselves were not modified.

## 10) Latest hardening updates (May 1, 2026, batch two)

- Persisted state now reloads cleanly when a storage key changes, preventing stale shell or settings values from leaking between contexts.
- CRUD list hooks now treat malformed repository payloads as real load failures instead of quietly rendering a false empty state.
- Sidebar branding and topbar timezone metadata now refresh through a shared workspace-settings hook, reducing drift between the Settings page and the app shell.
- Weekly Brief optimistic edits now recover to the persisted record after save failures, which is a more honest product behavior for planning workflows.
- Source-status banners now explain when the interface is showing the latest available snapshot while sync reconnects.
- Browser coverage now includes the settings-to-shell workflow so portfolio demos prove that saved workspace identity updates survive routed navigation.
- Capture empty-submit feedback is now wired directly to the note field and covered by a reload-persistence Playwright flow.
- Route performance static budgets and the tracked baseline were refreshed after the latest Dashboard trust/recovery work, with both static and trend checks passing locally.

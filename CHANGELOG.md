# Changelog

All notable updates are documented here for portfolio and release-review context.

## 2026-08-31 - useWeeklyBrief: persistence out of setState updaters

Branch `claude/useweeklybrief-setstate-sideeffects`. Closes the `useWeeklyBrief`
state-management item deferred from the 2026-05-24 architecture audit (§7).

State management (no behavior change):

- `useWeeklyBrief`'s four editable collections (review notes, priorities, wins,
  blockers) fired their persistence side effects *inside* `setState` updaters.
  Updaters must be pure — React StrictMode double-invokes them in development,
  which could fire duplicate repository writes. Reworked to the ref-based
  pattern `Journal.jsx` already uses: each value's latest committed state is
  mirrored in a ref, so each setter reads the previous value from the ref,
  commits the optimistic next value to state and ref, then diffs and persists
  outside any updater. The load path syncs the same refs.
- The optimistic-locking protocol (`expectedUpdatedAt` threading, stale-record
  recovery via silent reload) is byte-for-byte preserved and still covered by
  the existing hook tests. Adds a StrictMode regression test that fails on the
  old in-updater pattern (double delete) and passes on the fix (single delete),
  plus a test that batched functional setter calls in one tick read the ref.
- Also deduplicated the three near-identical collection setters onto a shared
  `commitCollection` helper.

## 2026-06-26 - Architecture audit deferred-item cleanup

Branch `claude/portfolio-audit-recommendations-ilzpfw`. Closes the three
bounded refactors the 2026-05-24 architecture audit deferred "each its own PR
to keep the change reviewable." No behavior, copy, or DOM changes — each is a
structural dedup covered by existing tests plus new focused unit tests.

Architecture cleanup (no behavior change):

- Consolidated the byte-for-byte-duplicated duplicate-detection validators in
  `OpportunityCrudPage` and `ContentCrudPage` into a single
  `makeDuplicateValidator(buildSignature, message)` factory in
  `recordIdentity.js`. Adds `recordIdentity.test.js` (audit §6).
- Collapsed the four near-identical `Chief*List` components
  (`ChiefOpportunityList`/`ChiefContentList`/`ChiefPriorityList`/`ChiefTaskList`)
  onto a shared `ChiefAcceptList` scaffold; each list is now a thin config
  (section, title, destination note, ready label, key, render props). Rendered
  markup and accept-button aria labels are preserved (audit §6).
- Extracted the backup export/import file-IO from `SettingsWorkspaceDataSection`
  into a `useWorkspaceBackup` hook so the `Blob`/`createObjectURL`/`FileReader`
  paths are unit-testable apart from the markup; the section is ~80 lines
  lighter. Adds `useWorkspaceBackup.test.js` (audit §5).

Still deferred (each genuinely its own PR per the audit): the telemetry/KMS
`experimental/` quarantine (large rename), moving `useWeeklyBrief`'s
persistence calls out of its `setState` updaters (needs a ref-based
current-value tracker + a careful optimistic-locking re-test), and subscribing
the Chief acceptance signature caches to repository update events (bounded
today by the post-generation reset).

## 2026-05-24 - Architecture & code-quality audit follow-up

Branch `improve/ceo-os-architecture-audit-2026-05`. A senior-architect pass
over folder structure, component architecture, state management, data flow,
error/empty states, naming, and scalability. The codebase was already mature
(prior audit cycles closed most gaps), so this pass deliberately targets the
*remaining* real defects and avoids churn. Full write-up:
[docs/audits/ceo-os-architecture-audit-2026-05-24.md](docs/audits/ceo-os-architecture-audit-2026-05-24.md).

Trust & reliability:

- The `StorageQuotaBanner` recovery CTA now deep-links to
  `/settings#workspace-data` (its docstring already promised this) and Settings
  scrolls + focuses the Workspace Data section on that hash — reduced-motion
  aware and guarded for environments without `scrollIntoView`. A storage-full
  user lands directly on the Export-backup / Clear-demo-data controls.

Accessibility & mobile:

- 44px `(pointer: coarse)` touch targets added for the Chief "accept" / "Add
  all" buttons and the storage corruption/quota recovery banner actions,
  matching the existing Focus Home reminder pattern.

Architecture cleanup (no behavior change):

- Removed the orphaned `ChiefRecentOutputs` component, its test, and its
  `chief-recent-*` CSS — superseded by `ChiefHistoryList`, imported nowhere,
  and a source of "which renders Recent outputs?" confusion.
- Hoisted the thrice-duplicated `expectedUpdatedAtToIso` into
  `staleRecordError.js` beside its inverse `readUpdatedAtMs`.
- `PrioritiesSection` now uses the shared `WeeklyTextList` (deleting the
  52-line `WeeklyPriorities` clone the Wins/Blockers sections already avoided).
- Finished the `useSilentRefresh` migration: `useFocusHomeSignals` and
  `useWeeklyBrief` no longer hand-roll the four-listener + coalesce wiring,
  making the existing "all four hooks share it" comment true. ~70 lines of
  duplicated subscription plumbing removed; behavior preserved.
- Tokenized the last hardcoded Chief AI-fallback tint into a per-theme
  `--danger-tint-rgb`; alphas preserved, so no visual change.

## 2026-05-12 - Product-readiness pass

Branch `improve/ceo-os-product-readiness`.

Reliability — green baseline restored:

- `src/hooks/useChiefOfStaff.js` and `src/pages/ChiefOfStaff.test.jsx`
  carried unresolved merge fragments that broke `npm run build`,
  `npm run lint`, and `npm run typecheck` on `main`: a dangling `? :`
  pair after a completed `return` in `getDefaultFeedback()`, and a
  split-apart empty-state assertion that referenced a non-existent
  "Ready to generate" string. Both are repaired; build, lint, typecheck,
  and the 676-test Vitest suite are green again.

UX clarity:

- The Chief of Staff notes autosave confirmation no longer says
  "Draft pipeline ready" (there is no pipeline) and no longer overwrites
  a "Created: …" or error message 2.5s after a keystroke — it now shows
  a plain "Notes saved. Pick an action when you are ready." and yields to
  result/error messages the user still needs to read.

## 2026-05-12 - Chief of Staff product depth

Branch `improve/chief-of-staff-product-depth` (follow-on to the
product-readiness pass above).

Tooling:

- Added `npm run verify` (`lint → typecheck → test:run → build`) as a
  one-command local pre-push gate mirroring CI. README quickstart points
  at it.

Feature — output catalogue:

- `shared/chiefActions.js` is now the single source of truth for ten
  output types — decision brief, blocker analysis, action plan, priority
  list, action list (next 72h), weekly update, founder memo, meeting
  summary, content idea, opportunity follow-up — each with a picker
  label, group, one-line "best when…" hint, model instruction, and a
  deterministic fallback template. The server proxy derives its
  `getAllowedActionKeys()` allow-list from this config.
- Replaced the five verb buttons with a `ChiefOutputPicker`: a grouped
  "Make a…" dropdown (Decide / Plan / Communicate / Pipeline), a hint
  line for the current selection, and a "Generate …" CTA that names the
  selected artifact.

Feature — output history & safe reset:

- New `ChiefHistoryList` "Recent outputs" panel lists the saved
  generations (the repository already keeps the last 30); selecting one
  re-renders it in the output panel behind a read-only banner with a
  "Back to latest" control, and a fresh generation auto-snaps forward.
- "Reset Workspace" now opens a `ConfirmModal` that spells out exactly
  what is cleared (notes + saved outputs) and what is not (items already
  routed into Weekly Brief / Opportunities / Content OS).

Trust — acceptance routing:

- Each structured section carries a one-line destination note, and every
  item shows its specific target beside the accept button
  ("→ Opportunities · New", "→ Content OS · Drafting", "→ Weekly Brief
  priority"), flipping to an "In …" confirmation once accepted.

Budgets:

- ChiefOfStaff static route budget bumped (JS 42 → 52 KB raw / 12.5 → 16
  KB gzip, CSS 4 → 6 KB raw) with a justification comment for the picker,
  history panel, confirm dialog, and richer action config.

Verification: `npm run verify` green; `npm run check:route-budgets`
green; Vitest 677 passing / 1 skipped. (`check:route-budgets:trend` is
pre-existing-red on `main` against the frozen 2026-05-01 baseline — out
of scope here; tracked for the next release baseline refresh.)

## 2026-05-11 - Audit priority fixes (Phases 1–6)

Companion branch to the product-readiness audit at
[`docs/audits/ceo-os-product-readiness-audit.md`](./docs/audits/ceo-os-product-readiness-audit.md).
Six phased commits on `improve/ceo-os-audit-priority-fixes`.

Trust & reliability (Phase 1):

- `safeLocalStorageSetItem` / `requireLocalStorageSetItem` now emit
  `saveStatusBus` events on every CRUD write, with a `silent: true`
  escape hatch for internal telemetry housekeeping. The `SaveStatusPill`
  reflects user-data writes, not just `usePersistentState` writes.
- `dataSchema.js` declares the two real chief-workspace storage keys
  (`chiefNotes`, `chiefResponses`), removing the snowflake the audit
  flagged.
- `appErrorTelemetry.writeStoredArray` shares one storage write helper
  with the rest of the app instead of swallowing quota errors inline.
- CSP `connect-src` drops the unused `api.openai.com` host — the browser
  never speaks to OpenAI directly.
- Capture / Journal carry explicit "stays on this device, never synced"
  copy so the local-only nature of those surfaces is honest at the point
  of use.

UX clarity (Phase 2):

- Removed the disabled "Weekly Digest" and "Keyboard Shortcuts" toggles
  from Settings. They read as half-finished.
- Removed the "Connect Supabase: setup required" chip from Settings and
  the "Import backup: coming soon" / "Connect Supabase: setup required"
  chips from Focus Home's first-run card.
- Wrapped the 5-step operating ritual list above Focus Home in a
  collapsed `<details>` so the loop label still teaches the rhythm
  without dominating the top fold.
- Defined four previously-undefined design tokens (`--radius-card`,
  `--radius-md`, `--border-strong`, `--surface-muted`) and added a base
  CSS rule for `.stat-card`.

Feature flow (Phase 3):

- Restored the four secondary Chief of Staff action chips —
  Summarize This Week, Draft LinkedIn Post, Convert to Action Items,
  Suggest Next Priorities — alongside the primary Build Action Plan.
  The proxy already supported all five actions via `getAllowedActionKeys`.
- Added an aging hint to Opportunities: any opportunity in stage
  "Awaiting Reply" with `updatedAt` older than 7 days renders a small
  warning badge ("Waiting Nd") with a screen-reader-friendly aria-label.
- New `WeeklyBriefSummary` panel above the Weekly Brief editors derives a
  founder-readable brief from the current priorities, wins, blockers,
  and reflection — with a one-click "Copy brief" that writes a plain-
  text version to the clipboard.

Accessibility & mobile (Phase 4):

- Bumped dark-theme pill backgrounds from 0.20–0.22 to 0.30–0.32 alpha
  and introduced `--pill-*-text` tokens per theme so pill contrast clears
  AA in both themes.
- `Badge` now accepts an optional `ariaLabel` so contextual badges expose
  expanded labels to screen readers.
- Chief of Staff action chips are grouped under `role="group"` with a
  descriptive `aria-label`.

Architecture cleanup (Phase 5):

- Extracted `src/hooks/useSilentRefresh.js` to encapsulate the
  load-coalesce-subscribe pattern (custom events + storage + focus +
  visibilitychange) that four data hooks re-implemented.
- Migrated `useDashboardData` and `useWorkspaceSettings` onto the helper.
  `useWeeklyBrief` and `useFocusHomeSignals` are intentionally kept on
  their existing per-event handlers and tracked as a follow-up.

Documentation (Phase 6):

- Split the env-variable reference out of README into
  [`docs/CONFIGURATION.md`](./docs/CONFIGURATION.md). README trimmed from
  619 lines to roughly the product story plus pointers.
- Added an honest screenshot caveat — the PNGs in `docs/assets/`
  predate the audit cycle and do not match the current UI.
- Refreshed `docs/KNOWN_LIMITATIONS.md` with the deferred items.
- Updated `docs/ARCHITECTURE.md` to describe the new `useSilentRefresh`
  abstraction.

Verification: `npm run lint`, `npm run typecheck`, and the affected
vitest suites pass at every phase commit.

## 2026-05-08 - Senior audit pass: calm-OS polish, snooze, page boundaries

Trust & reliability:

- Added `src/lib/storageMigrations.js`: a forward-compat per-domain × `fromVersion` migration registry, wired into `readVersionedLocalStorage` so reads transparently lift legacy/older payloads. Empty today (every domain is at v1) but the pattern is in place for the next schema bump.

UX clarity:

- Replaced the Dashboard's 0–100 momentum percent with a qualitative state pill — `Visible`, `In motion`, `Steady`, `Quiet day`. The numeric score is kept on the data shape for analytics but is no longer surfaced; a numeric score conflicted with the calm-OS thesis.
- Today's Main Focus panel now surfaces a Chief-of-Staff link when `buildMainFocus` reports `isEmpty: true`, so first-time founders discover the AI surface without an onboarding modal.
- `EmptyState` gained an optional `icon` slot rendered inside an accent-tinted bubble; wired into Opportunities, Content, and Capture.

Feature flow:

- Reminders gained a Snooze button that defers the active reminder until tomorrow at 6 AM local. Snoozed items disappear from the active list and are reachable via "Show N snoozed" with a Wake button to pull them back. New repository functions: `snoozeReminderUntil`, `wakeReminder`, `isReminderSnoozed`, `buildTomorrowSnoozeDeadline`. Hook actions: `reminderActions.snooze` / `wake`.

A11y & mobile:

- `(pointer: coarse)` widens reminder action buttons to 44px on touch devices without changing desktop density.
- `index.html` declares `color-scheme: dark light`, per-scheme `theme-color`, and a `<noscript>` fallback. Meta description rewritten to match the calm-OS thesis.
- Removed redundant aria-labels on the new momentum pill and snooze badge in favour of visible text + `sr-only` prefixes.

Architecture cleanup:

- Extracted `TodayFocusPanel`, `OpenLoopsPanel`, and `BlockersPanel` from `Dashboard.jsx` into co-located components in `src/components/dashboard/`. Each gets its own isolation test. Dashboard.jsx 623 → 567 LOC.

Portfolio polish:

- New `docs/ARCHITECTURE.md` covers design trade-offs, why JS not TS yet, why pub/sub via DOM events, what's intentionally out of scope.
- `docs/KNOWN_LIMITATIONS.md` updated with this PR's closed items.

Verification: `npm run lint`, `npm run typecheck`, `npm run test:run` (647 passed, 1 skipped, +25 new tests), `npm run build`.

## 2026-05-07 - CEO OS audit: Weekly Supabase conflict hardening

- Dashboard route CSS is back under the static budget by removing unused/decorative Focus Home styles instead of bypassing route-budget governance.
- Added a central `dataSchema` registry for local storage domains and domain model shapes.
- Weekly Brief local storage now writes a versioned schema envelope while continuing to read legacy unwrapped stores.
- Weekly Brief Supabase item selectors now carry `updated_at` through list, create, and update flows so cloud-loaded rows keep a positive `updatedAt` value for conflict checks.
- Weekly Brief Supabase item updates now apply the caller's expected timestamp as an `updated_at` equality filter and raise `StaleRecordError` when another session changed the row first.
- Weekly Brief delete flows now thread `expectedUpdatedAt` from `useWeeklyBrief`, reject stale local deletes, and reject timestamped Supabase deletes without emitting fake progress.
- Added focused mocked-Supabase coverage for Weekly Brief timestamp load/create/update/delete behavior while leaving full authenticated staging regression out of scope.

## 2026-05-05 - Audit cycle 2: trust, error surfaces, dead code, mobile, and perf

Stability:

- `useOfflineQueueDrain` now catches storage-layer rejections and surfaces them as a synthetic drain failure rather than letting them escape as unhandled rejections on every reconnect.
- Capture's `sortedNotes` comparator coerces invalid `updatedAt` to 0 instead of producing NaN comparisons.
- Settings guards the saved-at timestamp before calling `toISOString` so a corrupted legacy value cannot crash the page.
- OpsReliability wraps its stat cards and snapshot table in panel-level `ErrorBoundary` blocks so a malformed Supabase row only takes down its panel, not the whole route.

Reliability:

- `useDashboardData` exposes `loadError` so consumers can distinguish "empty workspace" from "fetch failed". The `onLoadError` callback is wrapped so a thrown `showToast` (post-unmount) cannot escape.
- WeeklyBrief and OpsReliability stat cards render `—` instead of `0` when load fails — no more "Active Priorities: 0" next to a "couldn't load" notice.
- `useChiefOfStaff` and `useChiefTelemetryHealth` replace `void refresh()` fire-and-forget calls with `.catch(() => {})` so unexpected rejects cannot escape the hook boundary.

Architecture:

- Deleted `useDashboardInsights` (389-line hook + 228-line test, **617 lines** of dead code with zero importers).
- Consolidated four hand-rolled `useRef(true)` mount/teardown blocks onto the existing `useIsMountedRef` helper across `useDashboardData`, `useChiefOfStaff`, `useSystemPulse`, and `useWeeklyBrief`.

UX & Mobile:

- `.action-button--small` raised from a fixed `2rem` height to `min-height: 2.25rem` so every sticky action, modal close, retry button, and reminder action meets the 36px touch-target floor on phones.
- OpsReliability snapshot table now collapses on phones via the `data-label` stacked-card pattern already used by `.crm-table` — no more horizontal scroll.
- Settings replaces its sr-only loading announcement with a visible `Loading settings...` helper text + `aria-busy` on the form so sighted users see the page is still hydrating.

Performance:

- `useFocusHomeSignals` gates `setCaptureNotes` / `setJournalEntry` / `setReminders` on shallow equality. Without these guards every focus, visibility, and storage event swapped to a fresh reference and invalidated Dashboard's `nextMoveQueue` / `suggestions` / `mainFocus` memos on every tab switch.
- `OpportunityCrudPage` and `ContentCrudPage` now read `source` from a `useState` initializer instead of calling the resolver in render — the page re-renders often (modal open, form keystroke), and the resolver hits localStorage each time.
- `Capture` and `RemindersPanel` collapse their two-pass filters into single-pass `useMemo` blocks.

Coverage:

- 491 unit/integration tests, lint, build, and route-budget checks all pass.

## 2026-05-05 - Audit cycle: stability, schema validation, and UX polish

- Removed legacy flat props (`summary`, `section`, `modals`) from `CrudPageTemplate` — only the `slots.*` API is supported. All tests updated, migration doc closed.
- Added `useOfflineQueueDrain` hook and wired it into `AppLayout` to auto-drain the offline write queue on reconnect and surface failures via shell toast.
- Consolidated `useCrudPage` dual-prop aliases — the hook now accepts a single canonical set of prop names without backwards-compat fallbacks.
- Adopted Valibot schema validation for Opportunity and Content OS form payloads, replacing inline boolean guards with typed, per-field error messages.
- Made the Dashboard "Today's Main Focus" panel collapsible by default (persistent via `localStorage`) so SystemPulse covers the first-glance need without the full panel dominating the fold.
- Updated Dashboard CSS budget in route-performance budgets to cover the new disclosure-toggle styles.
- Added 19 new unit tests: `useOfflineQueueDrain`, `opportunityPayloadSchema`, `contentPayloadSchema`, and Dashboard collapsible-panel behavior (105 test files, 491 tests total).

## 2026-05-01 - State recovery, shell sync, and QA hardening

- `3d03dec` - Reset transient Focus Home route errors when returning home keeps the same path.
- `008b56b` - Shared focus signal normalization helpers across suggestions and next-move logic.
- `d8bc496` - Hardened persisted state key changes and malformed CRUD load responses.
- `cec77dd` - Kept fallback record IDs unique when `crypto.randomUUID` is unavailable.
- `49e88bd` - Refreshed Focus Home and Weekly Brief data after relevant storage, focus, and visibility changes.
- `82ed2f2` / `2571fb9` - Unified shell settings consumption through a shared workspace-settings hook.
- `5a21229` - Recovered Weekly Brief state after save failures so optimistic edits do not linger as truth.
- `4b4e528` - Clarified source-status recovery copy for cached workspace snapshots.
- `77963de` - Guarded Dashboard reminder submission timing and stale reminder interactions.
- `a236504` - Improved Capture feedback semantics and compact navigation focus behavior.
- `c30dc06` - Added shell settings sync and reminder timing coverage.
- `52bd2a1` - Added Capture workspace E2E coverage and refreshed route performance budgets/baseline.

## 2026-05-01 - Compact navigation and Focus Home signal hardening

- `4484b5b` - Stabilized compact sidebar state across programmatic route changes and history returns.
- `99944c3` - Centralized Focus Home capture, journal, and reminder signals in a dedicated hook.
- `4736a4d` - Prioritized the oldest pending reminder in next-move guidance and cleaned action-copy punctuation.
- `2f7f94f` - Added accessible loading and reminder helper semantics to Focus Home with responsive chip/list polish.
- `e14d497` - Added Playwright coverage for compact mobile navigation route/history behavior.

## 2026-05-01 - Calm recovery and decision-support hardening

- `19ebcb2` - Added app-shell crash recovery around the full router/Suspense shell.
- `3b9266f` - Extracted Focus Home decision rules into tested product logic.
- `3786ca1` - Ranked blocked priorities, pending reminders, and journal heaviness in the next-move queue.
- `2be9bd6` - Improved responsive wrapping plus accessible source-status and System Pulse trust cues.
- `bfb5167` - Added QA coverage for app recovery, source-status semantics, and pulse labels.

## 2026-05-01 - CRUD stale-record integrity hardening

- `0a6a97c` - Rejected stale Opportunity update/delete attempts without emitting fake update events.
- `d040d08` - Centralized local record replace/delete guards in shared state utilities.
- `8477064` - Rejected stale Content OS update/delete attempts without emitting fake update events.
- `204ae9b` - Clarified Opportunity and Content stale-record error guidance for users.
- `88c46d3` - Added CRUD integration coverage for stale-record recovery copy.

## 2026-04-30 - Capture and journal autosave trust hardening

- `c444cd2` - Rejected stale Capture deletes without emitting fake update events.
- `1b4089d` - Centralized autosave helper copy for healthy versus paused save states.
- `0780d8a` - Rejected stale Capture updates instead of silently clearing error state.
- `f715acb` - Clarified Capture and Journal paused-autosave feedback when saves fail.
- `fdf01c4` - Added Capture and Journal page coverage for local save failure states.

## 2026-04-30 - Chief and weekly persistence truth hardening

- `bccafd8` - Made Chief workspace local note/output persistence fail explicitly when browser storage rejects writes.
- `6541eb8` - Centralized required localStorage writes behind one throwing helper to reduce missed-failure drift across repositories.
- `48749ac` - Rejected stale Weekly Brief update/delete attempts without emitting fake update events.
- `48ea73f` - Clarified Weekly Brief autosave copy when persistence is paused by an error.
- `890fbae` - Added Chief workspace and Weekly Brief tests for persistence failure states.

## 2026-04-30 - Settings persistence and accessibility hardening

- `41b8764` - Guarded Settings saves against duplicate in-flight submits.
- `03b0bbc` - Reused the shared mounted-ref lifecycle helper in Settings state orchestration.
- `632b18e` - Made Settings persistence failures reject explicitly instead of emitting a false saved event.
- `d013ca7` - Clarified Settings save-button state and invalid-timezone messaging for assistive tech.
- `91ce193` - Added Settings page coverage for saving state, invalid timezone feedback, and save interactions.

## 2026-04-30 - CRUD lifecycle and reminder integrity hardening

- `0b8db1d` - Guarded CRUD mutation lifecycles against duplicate in-flight saves and late state updates after unmount.
- `fbfa22e` - Centralized mounted-ref lifecycle handling in a shared hook for mutation-heavy workflows.
- `22ccc3a` - Rejected stale reminder toggle/delete attempts without emitting fake progress events.
- `4942074` - Preserved completed reminder checkbox/control contrast by moving the done cue to reminder text.
- `f2fcd90` - Added confirm-delete unmount safety coverage and reran the full QA gate.

## 2026-04-30 - Recovery, routing, and reversible execution hardening

- `dd8d31d` - Made route error recovery return directly to Focus Home instead of depending on browser history.
- `0128dba` - Derived React Router paths from shared route metadata to reduce navigation and metadata drift.
- `4ba77bc` - Kept completed reminders visible and recoverable so accidental checks can be undone.
- `f3a7a60` - Polished shared recovery styling, modal mobile behavior, and Focus Home arrow-key support.
- `7a8865e` - Added Playwright coverage for reversible reminder completion while keeping route budgets under trend limits.

## 2026-04-30 - Stability, execution, and route-budget hardening

- `da56ca5` - Guarded System Pulse and Chief telemetry refreshes against stale async updates after remounts or fast navigation.
- `00eb961` - Removed obsolete legacy Chief AI prompt/output components so the maintained Chief of Staff path is the single source of truth.
- `bbbf75b` - Prevented Dashboard next-move recommendations from staying pinned after they fall out of the current execution queue.
- `d504d74` - Improved Focus Home support-mode keyboard navigation with roving focus semantics.
- `e340d4b` - Added Playwright coverage for Focus Home keyboard mode switching and reminder completion, and split Chief telemetry diagnostics from the initial route bundle to keep route budgets green.

## 2026-04-23 - Accessibility, reliability, and CI quality pass

- `5081529` - Added keyboard activation (Enter/Space) and focusability for interactive rows in opportunity/content tables, with test coverage.
- `9ba1d61` - Added dashboard route tests for weekly-load error/retry and empty-state rendering.
- `ce28731` - Hardened CI permissions and enabled concurrency cancellation to reduce duplicate workflow runs.
- `6d592a1` - Aligned table helper copy with keyboard interaction support and asserted updated messaging in tests.
- `d3607c2` - Resolved markdownlint issues across case study, release checklist, and README formatting.
- `1040c2c` - Improved table semantics by promoting first cells to row headers for better assistive navigation context.
- `6feb9dc` - Enforced markdown linting in CI to catch heading/list/spacing regressions before merge.
- `44c6ce5` - Added component tests for source-status error alert and retry behavior.

## 2026-04-21 - Release readiness hardening pass

- `d95e8d3` - Added Chief of Staff edge-case resilience coverage for rapid acceptance dedupe, malformed structured items, and safe partial-payload handling.
- `188dcc7` - Hardened dashboard insight resilience with malformed-input tests and safe row normalization defaults.
- `24d811d` - Fixed route metadata resolution to normalize trailing-slash paths and added regression coverage in page-meta hook/tests.
- `f18c16a` - Added a reusable release-candidate checklist and linked it from portfolio-facing docs.
- `e9e2a50` - Added README release evidence snapshot with verification date, quality-gate status, and final hardening commit trail.

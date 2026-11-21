# P2 persistence fixes — November 21, 2026

Base: `3abae93`, the deployed Notebook selection fix. This batch addresses
the audit's A06, A07, A11, and A14, plus the action-level error feedback
associated with those findings (part of A16).

The production-build browser run also reproduced an opening-focus race in
the shared modal. Its delayed initial-focus callback now respects focus
already placed inside the dialog. A deterministic unit test failed before
the fix and passes afterward. This fixes that keyboard race only; the audit's
broader stacked-dialog work (A21) remains outside this batch.

## Changes

- **A06 — Weekly reflection:** a single autosave controller owns the current
  draft and save status. Writes are serialized across route mounts; an older
  acknowledgement or load cannot replace a newer edit. Navigation, page hiding,
  and unmount flush pending work. A recovery copy in session storage survives
  reloads in the same tab and is scoped by account and week. Failed saves retain
  the editable draft and offer an explicit retry.
- **A07 — Weekly items:** editors and confirmations retain the revision shown
  when opened. They await the repository result, block duplicate submission,
  and remain open with useful feedback on failure. A conflict preserves the
  user's draft until they explicitly reload the latest item or cancel. Saved
  revisions are installed immediately so reopening an editor does not depend
  on a delayed background refresh. Week changes remount the section editors.
- **A11 — Chief workspace:** notes use the same ordered autosave and recovery
  behavior. Prompt appending no longer persists inside a React state updater.
  A completed generation is saved after route navigation, and an already-open
  Chief page refreshes its output history. Account changes and explicit resets
  invalidate obsolete generations; output writes and resets are serialized.
  Save feedback now follows actual persistence instead of an unconditional
  timer. Generation does not overwrite newer notes with its older input.
- **A14 — Opportunities and Content OS:** deletion checks the revision from
  the confirmation in both local storage and Supabase. The revision also
  travels through offline queue replay. A guarded remote delete that affects
  no rows distinguishes an already-removed record from a changed one. Errors
  remain visible inside the confirmation. Legacy local revisions are protected
  once edited, and local update timestamps advance even within one millisecond.

Weekly editor code loads when an editor opens. Chief history code loads when
there is more than one saved output. Existing route budgets remain unchanged.

## Regression coverage

Unit and integration tests cover slow and sequential saves, recovery after
failure, stale loads, route remounts, account/week isolation, delayed generation
after navigation, reset/account invalidation, duplicate clicks, editor revision
capture, failed deletions, remote revision filters, idempotent delete replay,
queued revision preservation, and same-millisecond local edits.

Five new Chromium tests run at **1366 × 650**. They cover immediate navigation
and reload with a reflection draft, failed weekly saves, a real two-tab weekly
edit conflict, Chief-note retry and reload, and stale deletion in both pipelines.

## Validation

- `npm run verify`: lint, typecheck, **1,040 unit/integration tests**, and
  production build passed. One optional real-Supabase test remains skipped
  because credentials are unavailable.
- Full Chromium suite: **77 tests passed**, including previous P1/Notebook
  regressions, accessibility checks, and laptop/mobile layouts.
- Static route budgets, the 8% baseline trend guard, and the CRUD template
  guard passed without raising their limits.
- The production build is also exercised with the browser suite before release.

## Scope and limits

The live site currently runs in local-only mode. Supabase deletion and ownership
behavior is covered with controlled repository tests, not a live authenticated
workspace. Generation can finish after changing routes in the same running app;
closing or reloading the browser still ends its in-flight network work. Recovery
drafts depend on session storage being available and are retained for that tab's
session. Successful saves continue to use the app's normal workspace storage.

This is a focused P2 release, not closure of the entire audit. Queue lifecycle
and backup/corruption recovery findings (A05, A08–A10), along with the remaining
surface-specific P2 findings and the rest of A16, remain separate work.

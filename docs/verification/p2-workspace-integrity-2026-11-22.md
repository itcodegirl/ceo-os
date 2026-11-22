# P2 workspace integrity verification — 2026-11-22

## Scope

This release addresses audit findings A18, A15, A12, and A21 on top of
`e0541ac` (queue/backup recovery and scheduled-ops repair).

- **A18 — Demo changes:** all three setup actions show a preview of affected
  stores and weeks. Cleanup removes only unchanged examples, including historical
  weeks. Edited examples, authored work, and reflections are retained. Loading
  examples merges them around existing work. Seed provenance is detached on edit;
  legacy examples require matching content and no edit timestamp. Changes use the
  restore journal, preserve an original snapshot, check for stale previews, and
  commit the setup mode last. Failed writes roll back data and mode together.
  Legacy current-week work is migrated even when older versioned weeks exist.
- **A15 — Cross-tab freshness:** Capture, Opportunities, and Content OS subscribe
  to relevant storage changes, focus, visibility, and domain events. Rapid bursts
  include a trailing refresh. Capture composer drafts have independent session
  copies; another tab's save cannot clear them, including after reload. CRUD lists
  refresh without replacing active edit drafts. Saves from the original zero
  revision now participate in conflict checks too.
- **A12 — Chief acceptance:** display, acceptance keys, and history hydration use
  the same canonical fields. Missing company, platform, and owner stay empty
  instead of becoming invented metadata. Display fallbacks and workflow defaults
  are labeled. Content context survives acceptance. Task suggestions explicitly
  say they become Weekly Brief priorities. Existing historical records are not
  rewritten because the application cannot infer which saved metadata was authored.
- **A21 — Nested dialogs:** a shared stack owns Escape, focus trapping, background
  inertness, and scroll locking. Only the top dialog is exposed to interaction.
  Closing an editor or confirmation restores focus to its trigger in the details
  dialog; closing the last dialog restores the page.

## Validation

- `npm run verify`: lint, typecheck, 1,072 passing tests, and production build.
  One optional Supabase integration test was skipped.
- Full Playwright suite against the production preview: **88 passed**. Includes
  accessibility, laptop/mobile layouts, Notebook selection, CRUD, P1 data trust,
  P2 persistence, backup recovery, and six new integrity scenarios.
- Route size and trend budgets passed without changing limits or the baseline.
  Chief of Staff is 15.95 KiB gzip against its existing 16 KiB cap.
- Legacy CRUD-prop guard and Markdown lint passed.
- Demo preview visually checked at 1366 × 650; explanation and actions fit.

The production entry asset for this build is `/assets/index-Djn_2QsB.js`.
Deployment verification checks that Netlify serves this asset and reruns the new
integrity scenarios plus the prior recovery, data-trust, and accessibility checks.
The deployment outcome and CI run are reported in the release response.

New regression coverage includes historical/legacy demo preservation, edited seed
identity, first/middle/final store failures, stale previews, cross-tab Capture
create/edit/delete, preservation of editor drafts, rejection of stale saves,
stacked dialog Escape/focus behavior, and missing-field Chief acceptance followed
by reload and repeated Add All. Browser scenarios use isolated local profiles at
1366 × 650, without altering the user's stored workspace.

The existing blank-week browser regression now waits for the demo cleanup dialog
to close before navigating. Its prior immediate navigation could interrupt the
asynchronous action before it completed.

Supabase test credentials are not configured locally; the optional live database
integration test remains skipped. Automated accessibility checks and Chromium
keyboard interaction do not substitute for a manual screen-reader session.

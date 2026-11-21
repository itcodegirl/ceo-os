# Notebook selection-to-to-do verification — November 21, 2026

Base: `4759700` (the deployed P1 fix release). This resolves the Notebook
selection issue recorded in `p1-fixes-2026-11-21.md`.

## Reproduction and cause

In Learning, create a page, focus My Notes, type `Book the venue`, and press
Shift+Home immediately. The browser briefly selects the text, but the editor
can replace it with the old caret before the selection menu appears.

A browser diagnostic recorded the DOM selection and ProseMirror selection
separately. The DOM contained the selected text while the editor still held
the old collapsed caret. ProseMirror's delayed focus callback then called
`selectionToDOM`, clearing the new selection. The to-do creation handler never
ran. This also explained the intermittent selection-to-card test failure.

## Fix

`NotebookEditor` synchronizes native navigation-key selections on key release
using public ProseMirror APIs. It maps both DOM endpoints to a text selection
and dispatches only if the selection changed. Native line wrapping and selection
direction are retained. Composing input and selections outside the focused
editor are ignored.

The browser diagnostic after the change shows the same text selected in both
the DOM and editor state, including after autosave; the selection menu remains
visible. No dependency patches, artificial waits in the original tests, or
changes to reminder persistence were needed.

## Regression coverage

The original three Notebook browser tests pass, including selection-to-card
and selection-to-to-do. Four additional tests at 1366 × 650 cover backward line,
forward line, backward character, and mouse paragraph selections. They verify
selection survival through autosave, visibility of the to-do button, a single
saved to-do, reload persistence, and the source link from Focus Home. The
forward-selection test activates the menu with Tab, End, and Enter.

## Validation before deployment

- `npm run verify`: lint, typecheck, 1,017 unit/integration tests, and production
  build passed. One optional real-Supabase telemetry test remains skipped for
  absent credentials.
- All **72 Chromium browser tests passed**, including the full Notebook suite,
  the P1 data-trust regressions, laptop/mobile layouts, and accessibility sweep.
- Static and baseline-trend route budgets passed without changing the limits.
- CRUD template guard, changed-document Markdown lint, and diff whitespace
  checks passed.

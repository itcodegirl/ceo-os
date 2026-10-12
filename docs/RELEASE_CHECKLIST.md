# Release Candidate Checklist

Last updated: April 30, 2026

Use this checklist before sharing the project as portfolio evidence or treating a branch as production-ready.

## 1) Automated quality gates

Run all required checks and confirm they pass:

```bash
npm run lint
npm run build
npm run test:run
npm run typecheck
npm run check:route-budgets
npm run check:route-budgets:trend
npm run test:e2e
npx markdownlint-cli2 "**/*.md" "!node_modules/**"
```

Confirm GitHub Actions CI is green for the branch before merge.

## 2) Manual UX smoke pass

Validate core flows without changing source code:

- Navigate all primary routes: `Focus Home`, `Capture`, `Notebook`, `Opportunities`, `Content OS`, `Weekly Brief`, `Chief of Staff`, `Ops Reliability`, and `Settings`. The old `/journal` URL must redirect to `/notebook`.
- Refresh each direct route and confirm the app shell renders instead of a platform 404.
- Confirm loading, empty, and populated states render correctly.
- On `Capture`, confirm stale edit/delete recovery does not emit fake sticky-note updates.
- On `Capture`, confirm the sticky-note helper switches away from autosave reassurance when a save error is active.
- On `Notebook`, confirm today's Personal page shows any pre-existing Journal entry, writing autosaves and survives a refresh, and a failed save shows the "not saved" status and alert while keeping the text.
- On `Notebook`, select text in a block and use **Make card**, **Question**, and **Idea**; confirm each composer is prefilled from the selection, the item appears in the panel, **Show source** selects the passage (opening a folded block), and below 1100px the panel opens as a sheet.
- On `Notebook`, select text and choose **To-do**; confirm it appears in the **Lists** tab and on `Focus Home` with a link that opens the page, and that **All open** lists every open reminder.
- On `Notebook`, when signed in on two browsers, confirm a page edited on both shows the "changed on another device" choice instead of overwriting either version.
- Confirm skip-link and route focus restoration still work from keyboard-only navigation.
- Confirm route-level error recovery returns to Focus Home and does not trap navigation after one view fails.
- Confirm source-status messaging appears correctly for local-first and Supabase-enabled environments.
- Confirm KPI tone semantics are credible (risk-heavy cards should not render as positive state).
- Confirm Focus Home support modes can be reached from keyboard, switched with arrow keys, and retain visible focus.
- Confirm reminder completion progress updates after checking and unchecking reminders, and completed reminders stay recoverable.
- Confirm rapid create/save clicks do not duplicate records in Opportunities or Content OS.
- On `Opportunities` and `Content OS`, confirm stale edit/delete failures keep the record visible and explain refresh/retry recovery.
- Confirm navigating away during modal or confirmation work does not leave stale pending UI behind.
- On `Weekly Brief`, confirm stale edit/delete recovery does not create fake progress after a failed save.
- On `Weekly Brief`, confirm the review-note helper switches away from autosave reassurance when a save/load error is active.
- On `Settings`, confirm rapid save clicks do not produce duplicate saves or misleading saved state.
- On `Settings`, enter an invalid timezone and confirm saving is disabled with one clear validation alert.
- On `Settings`, confirm save progress exposes a busy form state and descriptive save-button name.
- On `Chief of Staff`, type notes, refresh, confirm the notes return, then reset the workspace and confirm the cleared state survives another refresh.
- On `Chief of Staff`, confirm note/output persistence errors surface as workspace status instead of silently implying saved state.
- On `Chief of Staff`, confirm telemetry diagnostics can load without blocking the primary note-to-action workflow.
- Confirm no visible console errors in normal user flows.

## 3) AI workflow confidence checks

- Generate each chief action at least once with valid notes.
- Verify fallback behavior appears when proxy response is unavailable or malformed.
- Confirm fallback output is clearly labeled and does not imply AI succeeded.
- Confirm structured acceptance only saves valid items and ignores malformed entries safely.
- Confirm empty structured output explains why `Add All to System` is unavailable.
- Confirm rapid repeated acceptance does not create duplicate records for the same item.
- Confirm proxy auth mode is correct for the deployment target:
  - development: `CHIEF_STAFF_REQUIRE_TOKEN=false`
  - production: `CHIEF_STAFF_REQUIRE_TOKEN=true` with `CHIEF_STAFF_PROXY_TOKEN` set

## 4) Metadata and sharing checks

- Confirm page title and description match each route.
- Confirm `og:title`, `og:description`, and `twitter:*` tags are present.
- Confirm canonical URL updates on route changes, including trailing-slash route variants.

## 5) Portfolio packaging checks

- Keep `README.md` and `CASE_STUDY.md` aligned with current architecture and test scope.
- Update `docs/PR_SUMMARY_TEMPLATE.md` so the PR narrative matches the actual hardening commits under review.
- Add screenshots or short demo media when available, and keep labels consistent with route names.
- Ensure roadmap items are honest and separated from completed work.

## 6) Ship decision notes

Capture the outcome for the current candidate:

- Automated checks status: pass/fail
- Manual smoke status: pass/fail
- Known risks accepted for release: yes/no
- Follow-up tasks created: yes/no

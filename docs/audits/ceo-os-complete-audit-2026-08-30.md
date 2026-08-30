# CEO OS — Complete Repository, Product & Architecture Audit

**Date:** 2026-08-30
**Auditor:** Claude Code (multi-agent audit fleet, 15 subsystem inspectors + adversarial verification)
**Scope:** Entire repository — product surfaces, engineering system, operations, documentation, portfolio positioning
**Mode:** Strictly read-only. No application code, test, fixture, config, migration, workflow, or documentation file
was modified. The only files written are this audit and its companion manual-QA document.

---

## 1. Executive Summary

CEO OS is a genuinely well-engineered local-first React application whose product thesis — a *calm*
founder operating system — is visible in the code, not just the README. The repository shows real
senior judgment: a single route registry driving routes/nav/meta, a repository pattern with versioned
storage envelopes and corruption preservation, deterministic and *explained* focus recommendations, a
deliberate JS + `tsc --noEmit` posture with a written migration plan, and an unusually honest
`KNOWN_LIMITATIONS.md`. The full unit suite (823 tests) passes, `npm run verify` is green, markdownlint
is clean, and 29 of 31 Playwright specs — including nine axe accessibility sweeps across every primary
route — pass at HEAD.

The audit's central finding is a **gap between the engineering system as documented and as operating**.
Three failures cluster around it:

1. **The optimistic-concurrency feature is likely inverted in cloud mode.** Postgres stores
   `updated_at` at microsecond precision; the client round-trips it through millisecond `Date.parse`
   and then filters `.eq('updated_at', <ms-truncated ISO>)`. That predicate matches zero rows, and the
   repositories translate zero rows into `StaleRecordError`. The mechanism is confirmed statically and
   numerically; the consequence is that every guarded Supabase edit on Opportunities, Content OS and
   Weekly Brief items would be rejected with "changed in another window" — and because
   `StaleRecordError` is deliberately excluded from the offline queue, the edit is discarded rather
   than retried. Two independent inspectors found this; the orchestrator re-derived it from the
   migrations and Node. It needs a real authenticated environment to close, and it is the single most
   important item in this audit.

2. **A documented "Start blank" guarantee is not implemented for Weekly Brief.** `weeklyRepository`
   never consults `isDemoWorkspaceEnabled()` (Opportunities and Content OS both do). Any week with no
   stored record that happens to be the *current* week falls back to demo mock data, so a blank-mode
   founder gets fictional priorities, wins and blockers back at every week rollover — and those feed
   Focus Home's "Today's Focus" and get persisted into the real store on first edit. The test that
   appears to cover this passes for the wrong reason: it pins a fixed past week that never takes the
   fallback branch.

3. **The production-minded governance loops the portfolio advertises are not running.** Verified
   through the GitHub Actions API: the strict `PR Test Suite / Unit + E2E` gate has failed on all 30
   most recent runs (2026-05-18 → 2026-06-26) including on `main`, with five PRs merged over it; the
   weekly `Release Route Baseline Refresh` has failed all 14 times it has ever run, with the job log
   naming a repository setting (`GitHub Actions is not permitted to create or approve pull requests`)
   as the cause; and `Scheduled Ops Alerts` — described in the README as a daily loop that persists SLO
   snapshots, records incident transitions and pages Slack/PagerDuty — has **never executed on its
   schedule** (zero runs with `event=schedule`, on a query validated against the workflow that does
   have scheduled runs).

None of these are exploitable security vulnerabilities, and none destroy pre-existing user data. There
is no P0 in this audit. But together they describe a system whose *self-verification* has drifted from
its self-description, which matters more than usual for a project whose stated differentiator is honest
engineering.

The security posture is better than the surrounding infrastructure suggests. Row-level security is
correctly and completely applied to all seven user-data tables (`auth.uid() = user_id` in both `using`
and `with check`). The OpenAI key never reaches the browser. The client scrubs telemetry before sending.
The real security finding is an architectural dead-end rather than a hole: the Chief of Staff proxy's
token authentication cannot be satisfied by the shipped browser client, so the documented-correct
production configuration permanently disables the AI feature, and the only configuration in which AI
works is an unauthenticated public proxy.

Readiness, stated plainly: **Level 2 — Strong Portfolio Project**, held below Level 3 (Beta-Ready) by the
Supabase concurrency defect, the blank-mode contract failure, and the absence of any authenticated
end-to-end verification. Portfolio readiness is materially higher than product readiness, and both are
higher than production readiness. The fastest path to Level 3 is narrow and well-defined: fix the
timestamp comparison, gate the weekly demo fallback, repair the three CI loops, and run one authenticated
regression pass.

*(Sections 2–5 follow; the remaining sections are assembled from the full inspector fleet.)*

---

## 2. Audit Environment + Commit

| Item | Value |
| --- | --- |
| Repository | `itcodegirl/ceo-os` |
| Branch inspected | `claude/ceo-os-complete-audit-ah4q7l` |
| HEAD commit | `177ade3f09f18bc9a0f783413061c45f347f2f48` |
| Commit subject | `Merge pull request #45 from itcodegirl/claude/portfolio-audit-recommendations-ilzpfw` |
| Commit date | 2026-06-26 15:17:03 −0500 |
| Working tree at audit start | Clean (`git status --short --branch` reported only the branch line) |
| Relationship to `main` | Branch created from `main` at the same commit; HEAD matches the intended audit target |
| Node / npm | v22.22.2 / 10.9.7 |
| Platform | Linux container (Claude Code remote execution environment) |
| Dependencies | Installed fresh via `npm ci` (exit 0) |

**Git safety.** No branch switch, reset, stash, clean, commit, push, or Git configuration change was
performed. The audit inspected the working tree as checked out.

### 2.1 Runtime evidence log

Every command below was run against HEAD in the audit environment. Results are reported as run, including
the failures.

| Command | Result | Exit | Evidence provided | Limitations |
| --- | --- | --- | --- | --- |
| `npm run verify` | **RUNTIME PASS** | 0 | lint + `tsc --noEmit` + 823 unit tests + production build all succeed | Proves nothing about browser behavior |
| `npm run test:run` | **RUNTIME PASS** | 0 | 137 files passed, 1 skipped; 823 tests passed, 1 skipped; 97.6s | Unit/jsdom only |
| `npx markdownlint-cli2 "**/*.md" "!node_modules/**"` | **RUNTIME PASS** | 0 | 22 files, 0 issues | Style only, not accuracy |
| `npm run check:crud-template-legacy` | **RUNTIME PASS** | 0 | No legacy `CrudPageTemplate` props in production source | Confirms the slots migration is genuinely closed |
| `npm run check:route-budgets` | **RUNTIME PASS** | 0 | All 11 tracked route assets within static budgets | Static sizes only, not load performance |
| `npm run check:route-budgets:trend` | **RUNTIME FAIL** | **1** | `Dashboard JS rawKb regressed: 24.90 kB > 24.62 kB (baseline 22.80 kB, +8% limit)`; gzip likewise (7.84 > 7.60) | HEAD of `main` fails its own trend gate |
| `npm run test:integration:telemetry` | **INTENTIONAL SKIP** | 0 | 1 file / 1 test skipped — `describe.skip` when `SUPABASE_TEST_URL` is absent | No durable-ingest evidence obtainable here (MISSING SECRET) |
| `npm run test:e2e` (attempt 1) | **ENVIRONMENT FAIL** | — | All 31 specs failed: repo pins `@playwright/test` 1.59.1 expecting `chromium_headless_shell-1217`; the container ships build 1194 | Resolved at the environment level by symlinking 1194 into the 1217 path — **no repository file was modified** |
| `npm run test:e2e` (attempt 2) | **29 passed / 2 failed** (2.3 min) | — | See §2.2 | Ran against Chromium 1194, slightly older than the pinned build |

Build output at HEAD: 408 ms; vendor chunks `vendor-react` 189.63 kB, `vendor-supabase` 187.35 kB,
`vendor-router` 41.38 kB; largest route chunk `ChiefOfStaff` 52.75 kB raw / 15.97 kB gzip.

### 2.2 Playwright results in detail

**Passed (RUNTIME PASS):** all nine axe accessibility sweeps (Focus Home, Capture, Journal,
Opportunities, Content OS, Weekly Brief, Chief of Staff, Ops Reliability under `?meta=1`, Settings) with
no serious or critical violations; all nine direct-load-and-refresh routing smokes; Capture sticky-note
persistence across reload; Chief workspace note persistence and confirmed reset; Opportunities
create/edit/delete, keyboard-only row selection, and error-then-retry recovery; Content OS keyboard-only
selection and error-retry; Focus Home keyboard mode switching and reversible reminder completion; mobile
navigation drawer behavior; Ops Reliability mobile single-column layout; performance smoke budgets.

**Failed (2):** `crud-smoke.spec.js` — "content page supports create edit delete from routed entry" and
"content page shows error and recovers on retry for create and delete". Both time out waiting for
`getByRole('button', { name: 'Create a new content item' })`.

**Classification: TEST DEFECT (selector drift), not an application defect.** `ContentCrudPage.jsx:206-208`
sets `actionText: 'New Content'` and `actionLabel: 'Add a content idea or draft'`; no element with the
accessible name the spec expects exists anywhere in `src/`. The Content OS rebuild that renamed it landed
2026-05-12 (`7a560fa`); `e2e/crud-smoke.spec.js` was last touched 2026-04-22 (`6faa2da`). The equivalent
Opportunities specs pass because `OpportunityCrudPage.jsx:179` still sets
`actionLabel: 'Create a new opportunity'`. This is one of the deterministic causes of the red CI gate.

### 2.3 CI and automation forensics (GitHub Actions API)

Six workflows exist: `ci.yml`, `ci-tests.yml`, `branch-protection.yml`, `release-route-baseline.yml`,
`scheduled-ops-alerts.yml`, plus a dynamic Copilot agent workflow.

| Workflow | Observed state | Evidence |
| --- | --- | --- |
| `CI` (markdownlint, lint, build, test, typecheck) | **Green on `main`** | Runs 118–131 successful, including run 131 for the merge of PR #45 |
| `PR Test Suite / Unit + E2E` (adds route budgets, trend gate, CRUD guard, telemetry integration, Playwright) | **Red on all 30 most recent runs**, 2026-05-18 → 2026-06-26, including runs on `main` (144, 140, 139, 136) | PRs #39, #40, #41, #42, #45 merged over a failing gate |
| `Release Route Baseline Refresh` (weekly cron) | **Failed all 14 runs**, 2026-05-25 → 2026-08-24 | Job log, run `32715911620`: `##[error]GitHub Actions is not permitted to create or approve pull requests.` The workflow computes the baseline and force-pushes `chore/release-route-baseline-refresh`, then fails at PR creation. **Classification: CONFIGURATION** (repository Actions setting), not code |
| `Scheduled Ops Alerts` (daily cron `15 13 * * *`) | **Never ran on schedule** | `list_workflow_runs` with `event=schedule` returns `total_count: 0`. Query validated: the identical query against `release-route-baseline` correctly returns its 14 scheduled runs |

These three results are the evidentiary backbone of §21 and §28. They are reported as configuration and
process failures, not as code defects — but they invalidate specific README claims about enforcement,
which is a documentation-accuracy finding (§29).

---

## 3. Repository / System Map

```text
CEO OS  (React 19 + Vite 8, JavaScript with tsc --noEmit, no .ts files in src/)
│
├── Client shell            index.html · src/main.jsx · src/App.jsx · src/layouts/AppLayout.jsx
│                           Single route registry (src/lib/routes.js) drives routes + nav + page meta
│
├── Product domains (pages) Dashboard (Focus Home) · Capture · Journal · WeeklyBrief · ChiefOfStaff
│                           Opportunities · ContentOS · Settings · OpsReliability (meta-gated)
│                           SignIn · AuthCallback (rendered outside the shell)
│
├── Shared UI               src/components/ui/ (38 primitives: Modal, Button, EmptyState, banners,
│                           status pills, ErrorBoundary, Toast, Sidebar, Topbar, SystemPulse…)
│                           src/components/crud/ (CrudPageTemplate + loading skeletons)
│                           Feature components: dashboard/ · capture/ · weekly/ · chief/ ·
│                           opportunities/ · content/ · settings/
│
├── Hooks / orchestration   src/hooks/ (38 hooks) — data loading, silent refresh, CRUD orchestration,
│                           promotions, offline queue drain, theme, meta mode, toasts, persistence
│
├── Repository layer        src/lib/*Repository.js — opportunities, content, weekly, settings, chief,
│                           chiefTelemetry, capture, journal, reminders, opsSloSnapshots
│                           Contract: normalize → read/write active source (local | supabase) →
│                           emit *_UPDATED_EVENT
│
├── Local storage infra     versionedStorage · dataSchema · storageMigrations · storageCorruption ·
│                           usePersistentState · saveStatusBus · offlineWriteQueue(+Integration) ·
│                           staleRecordError · recordIdentity
│
├── Supabase integration    src/lib/supabase.js · supabaseAdapter.js · supabaseRuntime.js
│                           supabase/migrations/ (8 SQL files)
│
├── Authentication          src/hooks/useAuthSession.js · pages/SignIn · pages/AuthCallback ·
│                           components/settings/SettingsAccountSection
│
├── AI / Chief of Staff     Client: src/lib/openai.js · normalizeChiefOutput · chiefRepository ·
│                           hooks/useChief* · components/chief/
│                           Shared: shared/chiefActions.js · chiefConfig.js · chiefResponseText.js ·
│                           chiefStructuredPayload.js
│                           Server: server/chiefOfStaffProxyCore.js
│
├── Server (shared core)    server/chiefOfStaffProxyCore.js · appErrorTelemetryIngestCore.js +
│                           IngestRepository · KeyProvider · KeyAuditRepository ·
│                           ProviderNativeAdapters · opsIncidentLifecycleRepository
│
├── Serverless adapters     api/ (Vercel-style: chief-of-staff.js, app-error-telemetry.js)
│                           netlify/functions/ (same two, Netlify signature)
│
├── Telemetry / operations  src/lib/appErrorTelemetry.js (client emitter with PII scrubbing)
│                           scripts/ (route budgets, SLO probes, snapshot build/persist,
│                           incident transitions, branch protection, CRUD guard)
│                           pages/OpsReliability.jsx (meta-gated surface)
│
├── Tests                   137 unit/component/hook/repository/server files (823 tests) +
│                           10 Playwright specs (routing, a11y sweep, CRUD, capture, chief,
│                           focus-home, mobile nav, ops mobile, performance, settings shell)
│
├── CI                      .github/workflows/ — ci.yml · ci-tests.yml · branch-protection.yml ·
│                           release-route-baseline.yml · scheduled-ops-alerts.yml
│
├── Deployment              netlify.toml (SPA redirect, function routing, CSP/HSTS headers)
│                           No vercel.json despite the api/ directory
│
├── Documentation           README · CHANGELOG · CASE_STUDY · docs/ARCHITECTURE ·
│                           KNOWN_LIMITATIONS · CONFIGURATION · PRODUCTION_TRUST_CHECKLIST ·
│                           RELEASE_CHECKLIST · FINAL_ROADMAP · AI_ROADMAP · PR_SUMMARY_TEMPLATE ·
│                           docs/audits/ (5 prior audits) · docs/tracking/ (3) ·
│                           docs/git-course/ (unrelated, orphaned)
│
└── Portfolio assets        docs/assets/screenshots/ (5 PNGs, all 2026-04-22) ·
                            docs/assets/demo/ (walkthrough .webm, 2026-04-22) ·
                            docs/assets/README.md · CAPTURE_GUIDE.md
```

**Absent by verification:** no `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md`, `LICENSE`, `SECURITY.md`, or
`CODE_OF_CONDUCT.md` in the root or `.github/`. No `.ts`/`.tsx` file anywhere in `src/`. No global state
store (deliberate — see §26).

---

## 4. Route Inventory

Discovered from `src/App.jsx:8-73` and `src/lib/routes.js:8-126`. Every route component is `React.lazy`,
behind one app-level `Suspense` fallback (`role="status" aria-live="polite"`, `App.jsx:38-44`).

| Route | Surface | Visibility | Auth state | Data source | Runtime coverage | Findings |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | Focus Home (Dashboard) | Nav — "Today" | None required | All domains (composed) | RUNTIME PASS — direct load + refresh, axe, keyboard mode switching, reminder completion | Blank-mode demo resurrection (F-02); demo flash on first paint; reminder-selection contradiction |
| `/capture` | Capture sticky notes | Nav — "Today" | None required | `ceo-os-capture-notes` (local only) | RUNTIME PASS — direct load + refresh, axe, persistence after reload | Per-keystroke write-through edit defect (F-04) |
| `/journal` | Journal | Nav — "Today" | None required | `ceo-os-journal-entries` (local only) | RUNTIME PASS — direct load + refresh, axe | Unmount cancels pending autosave; failed date-switch flush discards text |
| `/weekly-brief` | Weekly Brief | Nav — "This week" | None required | Local envelope **or** `weekly_briefs` + `weekly_brief_items` | RUNTIME PASS — direct load + refresh, axe | Demo fallback (F-02); ms/µs stale guard (F-01); duplicated summary band |
| `/chief-of-staff` | Chief of Staff | Nav — "This week" | None required | `chief_sessions`/`chief_outputs` or local | RUNTIME PASS — direct load + refresh, axe, note persistence + reset | Proxy auth dead-end (F-03); no off-device disclosure; output discarded on navigate-away |
| `/opportunities` | Opportunities | Nav — "Workspace" | None required | Local **or** `opportunities` | RUNTIME PASS — direct load + refresh, axe, full CRUD, keyboard-only, error+retry | ms/µs stale guard (F-01); no cross-tab refresh; unordered Supabase list |
| `/content` | Content OS | Nav — "Workspace" | None required | Local **or** `content_items` | PARTIAL — direct load + refresh and axe pass; 2 CRUD specs fail on a stale selector (test defect) | Same concurrency defect; skeleton mimics retired layout |
| `/settings` | Settings | Nav — "Account" | None required | `ceo-os-settings` or `profiles` | RUNTIME PASS — direct load + refresh, axe, shell sync spec | Backup import scope; demo-data controls |
| `/ops-reliability` | Ops Reliability | **Hidden** — `meta: true` | None required | `ops_slo_snapshots` (anon-readable) or local mock | RUNTIME PASS — `?meta=1` direct load, axe, mobile layout | Fabricated local fallback snapshots; CI/UI data-plane split |
| `/sign-in` | Sign In (magic link) | Not in nav — reachable from `SyncStatusPill` and Settings | Public | Supabase auth | Not covered by any spec | Rendered outside shell: no theme on fresh load, no page title |
| `/auth/callback` | Auth callback | Not in nav — arrived at from email | Public | Supabase auth | Not covered by any spec | Same shell-exclusion consequences |
| `*` | Unknown route | — | — | — | Not directly covered | Silently `<Navigate to="/" replace>` (`App.jsx:72`) — no "not found" affordance |

**Meta-mode gating (`?meta=1`).** `useMetaMode` reads `location.search` and persists `'1'` to
`sessionStorage` under `codeherway:meta-mode`, so the flag survives navigation for the tab session
(`useMetaMode.js:76-83`). Gating happens at *route registration*, not merely in the nav
(`App.jsx:34` + `routes.js:102-104`), so with meta mode off a direct hit on `/ops-reliability` falls
through to `*` and redirects home — a genuinely correct implementation of the intent. Two honest
caveats: it is a visibility gate, not a security boundary (anyone can set the query parameter — and
`routes.js:98-101` says so explicitly), and there is no in-session off switch (`?meta=0` is ignored and
`writeMetaModeToStorage(storage, false)` has no caller), so once enabled during a demo it stays until
the tab closes.

**SPA refresh.** `netlify.toml` maps `/*` → `/index.html`, and the Playwright routing smoke proves
direct load plus refresh for all nine shell routes at runtime.

**Auth routes outside the shell.** `App.jsx:46-47` documents the choice ("so the sign-in surface is
uncluttered and not gated behind a session"). The consequence, confirmed statically, is that `/sign-in`
and `/auth/callback` never mount `useThemePreference` or `usePageMeta`: on a fresh load they render in
the default dark palette regardless of the user's stored preference and show the stale
`Dashboard | CodeHerWay CEO OS` title, while reaching the same URL by client-side navigation keeps the
previous theme and title.

*(Sections 5 onward continue below.)*

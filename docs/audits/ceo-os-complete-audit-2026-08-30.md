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
deliberate JS-not-TypeScript decision with a written staged migration plan, and an unusually honest
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
   than retried. Three independent inspectors found this, an adversarial verifier confirmed it, and the
   orchestrator re-derived it from the migrations and in Node. It needs a real authenticated environment to close, and it is the single most
   important item in this audit.

2. **A documented "Start blank" guarantee is not implemented for Weekly Brief.** `weeklyRepository`
   never consults `isDemoWorkspaceEnabled()` (Opportunities and Content OS both do). Any week with no
   stored record that happens to be the *current* week falls back to demo mock data, so a blank-mode
   founder gets fictional priorities, wins and blockers back at every week rollover — and those feed
   Focus Home's "Today's Focus" and get persisted into the real store on first edit. The test that
   appears to cover this passes for the wrong reason: it pins a fixed past week that never takes the
   fallback branch.

3. **The production-minded governance loops the portfolio advertises are not running.** Verified
   through the GitHub Actions API: the strict `PR Test Suite / Unit + E2E` gate has **never executed a
   single step** — `ci-tests.yml:56` puts `secrets` in a step-level `if:`, which GitHub does not allow, so
   every run dies at parse time with zero jobs and zero elapsed seconds, and the file has carried that line
   unedited since it was created on 2026-04-22 — five PRs have merged over a check that has never
   validated anything. The
   weekly `Release Route Baseline Refresh` has failed all 14 times it has ever run, with the job log
   naming a repository setting (`GitHub Actions is not permitted to create or approve pull requests`)
   as the cause; and `Scheduled Ops Alerts` — described in the README as a daily loop that persists SLO
   snapshots, records incident transitions and pages Slack/PagerDuty — has **never executed on its
   schedule** (zero runs with `event=schedule`, on a query validated against the workflow that does
   have scheduled runs).

A fourth, found late and worth stating beside them: the `typecheck` gate that backs the
JS-not-TypeScript decision runs with `checkJs: false` over a codebase with zero type annotations, so it
verifies almost nothing — 608 diagnostics appear the moment JS checking is switched on (J-01).

None of these are exploitable security vulnerabilities, and none destroys pre-existing user data
without a deliberate click. There is no P0 in this audit. But together they describe a system whose *self-verification* has drifted from
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

**Method.** Fifteen subsystem inspectors read the repository in parallel — each applying every relevant
lens (correctness, calm-UX, accessibility, responsive implementation, performance, security, privacy,
persistence, failure handling, testing, launch and portfolio risk) to its assigned surfaces in a single
pass, so one root problem produces one finding rather than six. High-priority findings were then re-derived
by independent adversarial verifiers instructed to refute them, and every claim reproduced here was checked
against the source a second time by the orchestrator. Findings the verifiers downgraded are reported at the
corrected priority — the weekly demo-resurrection finding, for example, was proposed as P0 and is recorded
here as P1. Runtime evidence was gathered by running the repository's own validation commands and by
querying the GitHub Actions API; §2.1 reports each command as run, including the failures.

**Verification outcome.** Every finding submitted to the adversarial pass was independently re-derived
from source by a verifier instructed to refute it. **None was refuted.** Five were downgraded. In three the
corrected priority is the one already published here (the weekly demo-resurrection finding was proposed as
P0 and is recorded as P1; two offline-queue findings were proposed as P1 and are recorded as P2). Two
produced changes that have been applied: **C-06** (branch protection) is downgraded P1 → P2, since it is a
governance gap with no auth, persistence or user-data impact — and verification added a third, decisive
piece of evidence, a live API read showing `main` is `protected: false`; and the telemetry replay finding
(T-02) originally claimed an attacker could defeat deduplication through the unsigned idempotency header,
which is wrong for the shipped client — that key travels inside the signed body — so the finding now
describes the narrower, accurate exposure. Two further self-corrections were made against measurement
rather than review: the CI root cause (C-07) and the typecheck gate (J-01), both of which contradicted
earlier drafts of this document.

**Reading order for the impatient.** §17.2 (F-01, the concurrency defect), §14 (F-87, the destructive demo
load), §13 (F-03, the AI auth dead-end), §28 (the CI reality), then §38 for what to do first.

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
| `npm run verify` | **RUNTIME PASS** | 0 | lint + `tsc --noEmit` + 823 unit tests + production build all succeed | Proves nothing about browser behavior; and see J-01 — the typecheck step passes trivially because `checkJs` is off |
| `npm run test:run` | **RUNTIME PASS** | 0 | 137 files passed, 1 skipped; 823 tests passed, 1 skipped; 97.6s | Unit/jsdom only |
| `npx markdownlint-cli2 "**/*.md" "!node_modules/**"` | **RUNTIME PASS** | 0 | 22 files, 0 issues | Style only, not accuracy |
| `npm run check:crud-template-legacy` | **RUNTIME PASS** | 0 | No legacy `CrudPageTemplate` props in production source | Confirms the slots migration is genuinely closed |
| `npm run check:route-budgets` | **RUNTIME PASS** | 0 | All 11 tracked route assets within static budgets | Static sizes only, not load performance |
| `npm run check:route-budgets:trend` | **RUNTIME FAIL** | **1** | `Dashboard JS rawKb regressed: 24.90 kB > 24.62 kB (baseline 22.80 kB, +8% limit)`; gzip likewise (7.84 > 7.60) | HEAD of `main` fails its own trend gate |
| `npm run test:integration:telemetry` | **INTENTIONAL SKIP** | 0 | 1 file / 1 test skipped — `describe.skip` when `SUPABASE_TEST_URL` is absent | No durable-ingest evidence obtainable here (MISSING SECRET) |
| `npm run test:e2e` (attempt 1) | **ENVIRONMENT FAIL** | — | All 31 specs failed: repo pins `@playwright/test` 1.59.1 expecting `chromium_headless_shell-1217`; the container ships build 1194 | Resolved at the environment level by symlinking 1194 into the 1217 path — **no repository file was modified** |
| `npm run test:e2e` (attempt 2) | **29 passed / 2 failed** (2.3 min) | — | See §2.2 | Ran against Chromium 1194, slightly older than the pinned build |

**Additional read-only probe.** `npx tsc -p jsconfig.json --noEmit --checkJs` (the same project, with JS
checking switched on) reports **608 errors** — 387 in test files, 221 in production files — against zero
for the configured command. No repository file was modified to obtain this; the flag was supplied on the
command line. See J-01.

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
| `PR Test Suite / Unit + E2E` (adds route budgets, trend gate, CRUD guard, telemetry integration, Playwright) | **Red on every run examined**, including runs on `main` (144, 140, 139, 136) and all 11 on this audit's branch — and failing at **startup with zero jobs**, so no step has ever executed (see C-07) | PRs #39, #40, #41, #42, #45 merged over a gate that has never run |
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

---

## 5. Complete Surface Inventory

201 distinct surfaces were catalogued across the inspection fleet. They are grouped below by system
area; surfaces with no findings are listed as **healthy** rather than omitted, per the audit contract.

### 5.1 Shell and global surfaces

| # | Surface | Entry | Primary files | Data / persistence | Static review | Runtime evidence | Findings |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Static HTML entry / pre-hydration | Any cold load | `index.html`, `src/main.jsx` | none | Good `noscript`, `color-scheme`, `theme-color` | Build served in e2e | Stale "Dashboard" title/og; no pre-hydration theme script (S-02, S-08) |
| 2 | Route table + unknown-route fallback | All navigation | `App.jsx`, `lib/routes.js`, `netlify.toml` | none | Single registry, lazy everywhere | RUNTIME PASS (9 routes, load + refresh) | Healthy; `*` redirects silently |
| 3 | App shell orchestration | Every shell route | `layouts/AppLayout.jsx` | settings; queue drain | Skip link, main refocus, keyed boundary | RUNTIME PASS | No scroll reset on navigation (S-03); 5 duplicate settings loads (S-06) |
| 4 | Sidebar (desktop + compact drawer) | All routes; hamburger ≤860px | `ui/Sidebar.jsx`, `styles/layout.css` | none | Correct disclosure semantics | RUNTIME PASS (mobile nav spec) | `[hidden]` defeated by `display:flex` (S-01); 30rem cap may clip (S-10) |
| 5 | Topbar (title, clock, save/sync pills) | All routes | `ui/Topbar.jsx`, `SaveStatusPill`, `SyncStatusPill` | none | Minute-aligned clock, midnight-tested | RUNTIME PASS | "Saved" fires on mount with no user write (S-07) |
| 6 | Page meta / document title | Route change | `hooks/usePageMeta.js`, `lib/pageMeta.js` | none | Title, og, canonical, trailing-slash normalization | Not asserted at runtime | Healthy inside shell; absent on auth routes |
| 7 | Meta-mode gate | `?meta=1` | `lib/metaMode.js`, `hooks/useMetaMode.js` | `sessionStorage` (per tab) | Gating at route registration | RUNTIME PASS (`?meta=1` load) | No in-session off switch (documented boundary) |
| 8 | Theming (three-state) | Settings picker; OS preference | `hooks/useThemePreference.js`, `styles/tokens.css` | `ceo-os-theme` | Token system + contrast regression test | Not visually verified | Effect-only application → dark first paint (S-02) |
| 9 | Route prefetch | Dashboard mount | `hooks/useRoutePrefetch.js` | none | Data-saver/2g guards, idle scheduling | Covered by unit tests | **Healthy** |
| 10 | Error boundaries (shell/route/panel) | Any render throw | `ui/ErrorBoundary.jsx`, `PanelErrorFallback.jsx` | emits scrubbed telemetry | Three tiers; reset + retry proven | Unit-tested | **Healthy** |
| 11 | Toast system | Any `showToast` caller | `ui/Toast.jsx`, `ToastProvider.jsx` | none | Single shared instance | Not verified with AT | 2.2s non-dismissible for failure messages (S-05) |
| 12 | StorageCorruptionBanner | `ceo-os:storage-corruption` | `ui/StorageCorruptionBanner.jsx` | `__corrupt_*` backups (cap 3) | Mounted once; restore/discard tested | Not runtime-verified | Misses first-commit render-phase events (S-04) |
| 13 | StorageQuotaBanner | save-status bus `kind:'quota'` | `ui/StorageQuotaBanner.jsx` | event-driven | Assertive live region; deep link to Settings | Not runtime-verified | **Healthy** |
| 14 | LocalOnlyNotice | Shell mount when source is local | `ui/LocalOnlyNotice.jsx` | dismissal flag | Graceful storage-failure fallbacks | — | **Healthy** |
| 15 | SystemPulse strip | All routes except `/`, `/settings`, `/ops-reliability` | `ui/SystemPulse.jsx`, `hooks/useSystemPulse.js` | reads 5 repositories | Request-id race guard tested | — | **Healthy** (exclusion rationale documented inline) |
| 16 | Auth routes outside shell | Sync pill; Settings; email link | `pages/SignIn.jsx`, `pages/AuthCallback.jsx` | Supabase auth | Honest disabled state when unconfigured | **No coverage at all** | No theme, title, or axe scan (A-05) |

### 5.2 Product-domain surfaces (condensed)

| Domain | Surfaces catalogued | Persistence | Runtime evidence | Health |
| --- | --- | --- | --- | --- |
| Focus Home | 12 (hero, needs-attention, reminders CRUD, promotion, focus tools, overwhelm reset, setup card, rhythm strip, signal plumbing, suggestions, orphaned legacy components) | Composes all domains; own keys `ceo-os-focus-mode`, `ceo-os-focus-tools-expanded` | axe + keyboard + reminder completion PASS | Structurally strong; blank-mode and reminder-selection defects |
| Capture | 6 (composer, wall, sticky card edit, three promotion verbs, repository) | `ceo-os-capture-notes` (local only, versioned) | persistence-after-reload PASS | One P1 edit defect; otherwise excellent |
| Journal | 4 (prompts/autosave, one-next-thing promotion, repository, privacy copy) | `ceo-os-journal-entries` (local only, versioned) | axe + load PASS | Two autosave-loss windows |
| Weekly Brief | 13 (review notes, three section CRUDs, summary artifact, hook, local/Supabase repository paths, week boundary, subscriptions, delete flow, responsive) | Local envelope **or** `weekly_briefs` + `weekly_brief_items` | axe + load PASS | Demo fallback; ms/µs guard; duplicated summary band |
| Opportunities + Content OS | 15 (two pages, shared CRUD engine, template + skeletons, tables/modals ×2, two repositories, identity/dedup, schemas, formatting, queue wiring, incoming promotions, styles, guard script) | Local envelopes **or** `opportunities` / `content_items` | Opportunities CRUD + keyboard + retry PASS; 2 Content specs fail on stale selector | Concurrency P1; no cross-tab refresh |
| Chief of Staff | 13 (page, workspace hook, generation, structured acceptance, output panel/picker, four accept lists, history, telemetry diagnostics, repositories) | `chief_sessions`/`chief_outputs` or local envelopes | note persistence + reset PASS; axe PASS | Display-default leakage; no off-device disclosure; unstyled primary buttons |
| Settings | 6 (profile, theme, workspace data, account, backup export/import, storage health) | `ceo-os-settings` or `profiles` | axe + shell-sync spec PASS | Backup import is well-guarded (see §14) |
| Auth / account | 8 (client module, session hook, sign-in, callback, account section, sync pill, source notices, session storage) | Supabase session under `ceo-os:auth` | **none** | Technically exists; product incomplete (§15) |
| Storage infrastructure | 14 (versioned envelope, schema registry, migrations, corruption, quota, save bus, silent refresh, offline queue + integration, stale-record, identity, utilities) | all local keys | unit-tested extensively | Strong core; queue lifecycle is weakest link |
| Supabase / data | 17 (core schema + RLS, telemetry sinks, ops tables, client module, per-domain Supabase paths, queue replay) | Supabase Postgres | **none authenticated** | RLS correct; concurrency broken; ordering hazard |
| Telemetry / ops | 14 (client emitter, remote queue, ingest core, HMAC rotation, asymmetric provider, KMS adapters, key audit, persistence/retention, platform adapters, incident lifecycle, scheduled workflow, health/SLO scripts, snapshot build/persist, Ops page) | Supabase service-role tables | Ops page axe + mobile PASS; ingest integration **skipped** | Overbuilt (documented); loops not running |
| Documentation | 14 (README, CHANGELOG, CASE_STUDY, ARCHITECTURE, KNOWN_LIMITATIONS, CONFIGURATION, TRUST/RELEASE checklists, roadmaps, template, tracking, audits, assets, git-course, governance) | none | markdownlint PASS | Accurate on architecture; drifted on visuals/env/limitations |

---

## 6. Product Health

**The thesis is real and it is implemented.** This is the most important product finding. "Calm" is not
marketing copy layered over a generic dashboard — it is visible in decisions that *cost* features:
the momentum readout deliberately hides its numeric score (`focusHomeLogic.js:406-417` carries the
reasoning in a comment); reminders gained *Snooze until tomorrow* so a founder can park a commitment
without the binary of done-or-ignored; empty states are invitations with an icon and one supportive
line rather than "0 items" badges; operational surfaces are hidden behind `?meta=1` so a first-time
reviewer sees only product; and every focus recommendation carries a visible **"Recommended because:"**
string, which is the difference between decision support and a tip rotator.

**Where the product is coherent.** The daily loop — Capture a thought, let Focus Home rank it against
priorities/blockers/reminders/journal signals, promote it into a domain, review it in Weekly Brief — is a
genuinely original workflow with one shared promotion hook (`usePromotionAction`) behind four verbs, each
with in-flight guards and unmount-safe toasts. The Chief of Staff structured-acceptance loop (generate →
review each item with its destination shown → accept individually or Add All → exact-match dedup → routed
into the right repository) is the strongest single idea in the product and is not something most portfolio
apps attempt.

**Where it feels like separate systems.** Three seams:

1. **The local/cloud seam.** "Local-first" is true and coherent in local mode. In Supabase mode it
   becomes four different strategies: Opportunities and Content OS go remote-only with a retry queue
   (no local mirror), Settings and Chief fall back to local on auth errors (two different variants),
   Weekly Brief throws, and Capture/Journal/Reminders never sync at all. A signed-in founder therefore
   has some data in the cloud, some pinned to that browser, and no single place that says which is which.
2. **The reminders seam.** Reminders are managed only inside a Focus Home panel, are deliberately
   local-only, and are the one promotion verb family whose local-only status is *not* disclosed in
   context — on a page that can simultaneously display "Workspace sync is active".
3. **The ops seam.** `/ops-reliability` is correctly hidden, but its local fallback renders fabricated
   April-2026 snapshots under workspace-source copy, so the one surface that reports on system health can
   present sample data as real.

**Does it reduce mental load?** In the common case, yes — and measurably more than a generic dashboard,
because the ranking is explained rather than asserted. Three specific defects work against the thesis and
are worth fixing precisely because of it: the hero and the Needs-Attention panel can name **different**
reminders as the one thing to do; a snoozed reminder can still be recommended by the hero while the panel
hides it; and a blank workspace refills with demo work every week. Each of these adds exactly the
"which of these is true?" load the product exists to remove.

**What would undermine the thesis and should not be added:** numeric productivity scores, streaks,
notification volume, denser dashboards, or per-domain metric tiles. The repository has already resisted
these deliberately; the audit endorses that resistance.

---

## 7. Focus Home Findings

Focus Home is structurally the best-composed page in the app: `Dashboard.jsx` is a thin orchestrator,
presentational panels are co-located in `src/components/dashboard/`, decision logic is pure and unit-tested
in `lib/focusHomeLogic.js` and `lib/suggestions.js`, and every domain it renders has an update-event
subscription plus storage/focus/visibility refresh. The May 2026 density fixes genuinely landed.

### F-02 — "Start blank" is not honoured by Weekly Brief; demo data returns every week

```text
ID:                    F-02
Priority:              P1
Confidence:            CONFIRMED (mechanism), NEEDS RUNTIME VERIFICATION (user-visible rollover)
Classification:        DEFECT
Area:                  Persistence / Focus Home / Weekly Brief
Surface:               Focus Home hero, Needs Attention, Weekly Brief (local blank-mode workspaces)
File(s):               src/lib/weeklyRepository.js:48,69,89,153-155,240-249,327-343,345-354
                       src/lib/opportunitiesRepository.js:12,43 (correct comparator)
                       src/lib/contentRepository.js:12,72 (correct comparator)
                       src/lib/weeklyRepository.test.js:18,337-345 (test that cannot catch it)
                       src/hooks/useWorkspaceSetup.js:50-57
```

**Evidence.** `weeklyRepository` never imports `isDemoWorkspaceEnabled` — a repository-wide grep returns
hits only in `opportunitiesRepository.js:12,43` and `contentRepository.js:12,72`. The three weekly
descriptors carry `fallbackSource: defaultPriorities / defaultWins / defaultBlockers` (lines 48, 69, 89),
which `getFallbackCollection` (153-155) returns verbatim. `resolveLocalWeekPayload` (327-343) takes the
legacy branch whenever there is no stored record **and** `weekStart === getCurrentWeekStart()`, and
`readLegacyCollection` resolves `parsed ?? getFallbackCollection(descriptor.type)` (246) — so with the
legacy keys archived by the blank-workspace flow, the demo collection is returned. `updateLocalWeekPayload`
(345-354) then persists that resolved payload into the real store on the first edit.

The covering test is the reason this survived: `weeklyRepository.test.js:337-345`
("does not auto-seed demo weekly items after the workspace starts blank") runs against
`weekStart = '2026-04-20'` (line 18), a fixed past date that is never the current week, so it exercises
the empty-collections branch and passes for the wrong reason.

**Problem.** "Start blank" writes an explicit empty record only for the week in which it is clicked. At the
next Monday rollover (`useWeeklyBrief` recomputes `getCurrentWeekStart` on a minute timer) there is no
record for the new week, the current-week branch runs, and the demo priorities, wins and blockers return as
the user's own data.

**Why it matters.** Weekly priorities are the top-ranked input to `buildMainFocus` and
`buildNextMoveRecommendations`, so Focus Home then presents fictional work ("Send the XPAIRK partnership
proposal…") as Today's Focus and as the recommended next step, and pollutes the user's real weekly record
on first interaction. `KNOWN_LIMITATIONS.md:95` documents "Blank mode stops automatic sample seeding for
Opportunities, Content OS, and Weekly Brief" as closed — the Weekly Brief third of that claim was never
implemented as a read-time gate.

**Launch / portfolio risk.** High for the target user and for demos: a reviewer who starts blank and
returns a week later sees demo data presented as their own, contradicting a documented guarantee.

**Recommended remediation.** Gate the demo fallback on `isDemoWorkspaceEnabled()` inside
`getFallbackCollection` or `readLegacyWeekPayload`, returning `buildEmptyCollections()` in blank mode —
exactly the comparator the other two repositories already use. Then fix the test to use
`getCurrentWeekStart()` and add a rollover case (record for week N, none for week N+1, blank mode).
Optionally reorder `startBlankWorkspace` so repositories are cleared before the mode is saved.

**Scope:** S · **Dependencies:** none (repository-local) · **Runtime verification:** recommended ·
**Manual QA:** MQ-FH-01 · **Historical relation:** A — previously found and documented as fixed; the
weekly half of the fix was never implemented (regression evidence in code, not in behavior-since-fix).

### F-05 — Reminder recommendation contradicts itself and ignores snooze

```text
ID:                    F-05
Priority:              P2
Confidence:            CONFIRMED
Classification:        DEFECT
Area:                  Focus Home decision logic
File(s):               src/lib/focusHomeLogic.js:71-75, 266-271, 298-301, 340, 357-360
                       src/lib/suggestions.js:53, 101-106
                       src/lib/remindersRepository.js:44-53, 88-91
                       src/components/dashboard/RemindersPanel.jsx:189-215
```

**Evidence.** `listReminders` returns newest-first (88-91). `buildNextMoveRecommendations` selects the
**oldest** pending reminder via `findOldestPendingReminder` (71-75). `buildOpenLoopsSummary`'s
`suggestedLoop` selects `pendingReminders[0]` — the **newest** (357-360). Neither
`focusHomeLogic.js` nor `suggestions.js` nor `getReminderProgress` imports `isReminderSnoozed`; every
pending filter is `!item?.isDone` alone, while `RemindersPanel` hides snoozed rows by default.

**Problem.** Two contradictions from one root cause (no shared "active reminder" selector). With two or
more pending reminders, the hero's Next Step names one reminder while Needs Attention's "one loop worth
closing" names a different one, both above the fold. And a reminder the user explicitly snoozed until
tomorrow still counts as an open loop, still appears in "N reminders are still open", and can be the very
item the hero tells them to do — while the panel below hides it.

**Why it matters.** This is the calm thesis inverted: the page whose purpose is one clear next action
presents two, and recommends work the user deliberately parked. It also makes Snooze feel untrustworthy,
which was itself a calm-OS feature added in May.

**Recommended remediation.** Add one selector — `selectActiveReminders(reminders, now)` filtering
`!isDone && !isReminderSnoozed` with a single canonical ordering (oldest-first is the more defensible
"don't let commitments rot" rule) — and use it in all five call sites. Add a unit test asserting the hero
and the suggested loop name the same reminder.

**Scope:** S · **Runtime verification:** not required · **Manual QA:** MQ-FH-03 · **Historical:** D — new
(Snooze shipped in May but was never wired into the decision logic).

### Focus Home — remaining findings

| ID | Pri | Confidence | Class | Finding | Evidence | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| F-06 | P2 | HIGH | DEFECT | Demo weekly data flashes as Today's Focus on first paint | `useWeeklyBrief.js:55-57` initialises state to demo mocks regardless of mode/source; real load is async after a rAF | Initialise to empty collections, or gate on `isDemoWorkspaceEnabled()` |
| F-07 | P2 | HIGH | DEFECT | Opportunities/content load failures have no persistent surface or working retry | `Dashboard.jsx:88-94` never destructures `loadError`/`loadDashboardData`; the visible Retry (`319-326`) only refreshes the weekly brief despite an aria-label claiming otherwise; failed silent refreshes re-toast | Consume `loadError`, fold into the existing notice, retry both, suppress toasts for silent refreshes |
| F-08 | P2 | HIGH | DOCUMENTATION DRIFT | Reminders panel omits the local-only disclosure while the page can say "Workspace sync is active" | `SOURCE_NOTICE_LOCAL_FIRST_ONLY` (`uiCopy.js:18`) is defined and unit-tested but has **zero** production consumers; Capture and Journal both carry inline notices | Wire the existing constant into `RemindersPanel`, at minimum when source is `supabase` |
| F-09 | P3 | HIGH | DEFECT | Momentum says "Today" but is computed from all-time and weekly counts | `completedReminderCount` is every completed reminder ever (`remindersRepository` never prunes or windows); score saturates permanently positive | Window on `completedAt >= today` (the field exists) or reword to week-scoped |
| F-10 | P3 | HIGH | DEFECT | First click of "Tell me what to do next" is a no-op with a success toast | Cursor starts at 0 and `displayedNextMove` already defaults to `queue[0]` (`Dashboard.jsx:79,231,236-238`) | Start the cursor at 1, or skip the entry equal to the displayed move |
| F-11 | P3 | HIGH | DEFECT | Operating-rhythm strip is computed once per mount and goes stale | `useMemo(() => buildOperatingRitual(), [])` with an empty dependency array (`Dashboard.jsx:111`) | Recompute on an hourly timer or `visibilitychange` |
| F-12 | P3 | HIGH | NEEDS PRODUCT DECISION | Overwhelmed mode persists indefinitely with no exit affordance or day reset | Mode persists via `usePersistentState('ceo-os-focus-mode')`; only exit is the drawer chips | Add a calm exit to the reset panel and/or reset at the day boundary |
| F-13 | P3 | HIGH | DEFECT | Drawer landmark announced to screen readers as "ADHD support layer" | `FocusModeChips.jsx:45-46`; the visible UI never uses the term | Rename to match visible language ("Support mode") |
| F-14 | P3 | HIGH | PRODUCT GAP | Reminder Remove is one-click permanent with no confirm or undo | `RemindersPanel.jsx:148-157` → `deleteReminder` writes immediately; `useConfirmDelete` exists but is unused here | A 5-second "Removed — Undo" toast is the calm-consistent option |
| F-15 | P3 | CONFIRMED | TECHNICAL DEBT | Orphaned legacy artifacts in the dashboard folder | `MomentumChart.jsx` (0 importers, verified), `ActivityFeed.jsx` (test-only importer), `dashboardDemoData`, `buildNextMoveQueue`, ~16 dead CSS blocks. `MomentumChart` renders 0–100 bars, contradicting the shipped qualitative-momentum decision | Delete, or wire `ActivityFeed` intentionally |
| F-16 | P3 | NEEDS RUNTIME | DEFECT | Reminders panel occupies half a 2-column grid row on desktop | `.focus-home__grid` is `repeat(2, minmax(0,1fr))`; hero and Needs Attention span `1/-1`, Reminders does not | Span it full width or collapse the grid to one column |

---

## 8. Capture Findings

Capture is, with Journal, one of the two best-executed surfaces in the repository: honest local-only copy at
the point of use, versioned envelopes with legacy-read compatibility, composer draft rehydration that
survives reloads, and a promotion guard (`usePromotionAction`) with per-record in-flight tracking,
unmount-safe toasts and an always-released retry slot. One defect sits in the middle of its best flow.

### F-04 — Sticky-note editing round-trips every keystroke through the trimming repository

```text
ID:                    F-04
Priority:              P1
Confidence:            HIGH CONFIDENCE (static); NEEDS RUNTIME VERIFICATION for the exact typing behavior
Classification:        DEFECT
Area:                  Capture
Surface:               StickyNoteCard in-place edit on the sticky wall
File(s):               src/components/capture/StickyNoteCard.jsx:41-49
                       src/lib/captureRepository.js:12-18, 139, 150-155
                       src/pages/Capture.jsx:63-72, 74-83, 159-166
```

**Evidence.** `StickyNoteCard` renders a **controlled** textarea whose `value` is `note.text` and whose
`onChange` immediately calls `onEdit(note.id, { text: event.target.value })`. That reaches
`updateCaptureNote`, which normalises via `normalizeText = value.trim()` (12-18, 139) and applies
`text: nextText || note.text` with a fresh `updatedAt` (150-155), then emits the update event, which
`Capture.jsx:63-72` handles by re-reading all notes — so the controlled value re-renders from the
**trimmed** stored text after every keystroke. `sortedNotes` (74-83) sorts by `updatedAt` descending.
The tests never type incrementally; they use whole-value `fireEvent.change`.

**Problem.** Four consequences of one root cause (no local draft state; per-keystroke persistence of
normalised text): a trailing space or newline typed while appending is eaten on the next render, so
"hello world" cannot be typed naturally into an existing note; clearing a note is impossible because
`nextText || note.text` silently restores the old text; the `updatedAt` bump re-sorts the card to the top
of the wall mid-edit, moving the textarea under the cursor; and every keystroke re-serialises the entire
notes array to `localStorage` and re-renders the wall.

**Why it matters.** Both prior audits recommend opening demos with Capture as the most original surface,
and in-place editing is a first-class affordance — every card is an open textarea. "I typed a space and it
vanished" is a silently broken core interaction on the page the project leads with.

**Recommended remediation.** Give `StickyNoteCard` local draft state (or the debounce pattern Journal
already uses): hold the in-progress string in component state, persist on debounce or blur, normalise only
at persist time, and decide explicitly whether empty text deletes the note or shows an inline error rather
than silently reverting. Keep wall order stable during an edit (sort by `createdAt`, or don't bump
`updatedAt` until a committed change).

**Scope:** M · **Runtime verification:** required · **Manual QA:** MQ-CAP-01 · **Historical:** D — new.

### Capture — remaining findings

| ID | Pri | Confidence | Class | Finding | Remediation |
| --- | --- | --- | --- | --- | --- |
| F-17 | P2 | HIGH | ARCHITECTURAL RISK | Capture wall has no cross-tab refresh (same-tab `CustomEvent` only), unlike the composer draft which syncs via `usePersistentState` | Add the watched-storage-key subscription `useSilentRefresh` already supports |
| F-18 | P3 | HIGH | DEFECT | Sticky action accessible names are ambiguous across notes ("Delete Idea note" ×5) and do not contain their visible labels (WCAG 2.5.3) | Include a truncated note snippet; start the accessible name with the visible label |
| F-19 | P3 | CONFIRMED | NEEDS PRODUCT DECISION | Re-promoting an already-promoted sticky is unguarded; `DuplicateRecordError` is masked by generic "right now" copy implying a transient failure | Decide multi-destination vs disable-used-verbs; surface duplicate messages distinctly |
| F-20 | P3 | CONFIRMED | TECHNICAL DEBT | Composer bypasses the shared `Input`/`Select` primitives | Swap to primitives, preserving the tested aria wiring |
| F-21 | P3 | HIGH | DEFECT | "Show N promoted" toggle is ~27px tall, below the app's own 44px coarse-pointer floor | Add `min-height` and a `(pointer: coarse)` rule |

---

## 9. Journal Findings

Journal's ref-based debounce/flush architecture (flush on blur, `visibilitychange` and `beforeunload`,
persistence kept out of `setState` updaters) is cited by the repository's own architecture audit as the
correct StrictMode-safe pattern, and it is. Two holes remain in exactly that design.

### F-22 — Pending journal text can be dropped on SPA navigation and on a failed date switch

```text
ID:                    F-22
Priority:              P2
Confidence:            HIGH CONFIDENCE
Classification:        DEFECT
Area:                  Journal autosave lifecycle
File(s):               src/pages/Journal.jsx:63-85, 123-142, 156-168, 184-198
```

**Evidence.** The unmount effect calls only `cancelPendingSave()` (140-142), and its comment — "a flush
still happens via the beforeunload listener so we don't double-write here" — is wrong for SPA navigation:
`beforeunload` fires on reload and close, not on a React Router unmount, and blur does not fire when a
focused element is removed by a popstate navigation. Because `updateField` re-arms the 600 ms trailing
timer on every keystroke, continuous typing defers persistence indefinitely, so the loss window is
everything typed since the last flush. Separately, `handleDateChange` (156-168) flushes, and when
`persistPending` throws (storage full — a state the app handles elsewhere) the catch sets an error but the
handler then unconditionally swaps in the next date's entry and calls `setErrorMessage('')`, discarding
both the unsaved text and the notice that it failed.

**Why it matters.** Journal is positioned as the private, trustworthy reflection space; silent text loss is
its worst possible failure. The existing three-way flush shows the team already cares about this — these
are the two remaining gaps, not an absent design.

**Recommended remediation.** Flush rather than cancel on unmount (call `persistPending` when a timer is
pending) and correct the comment. In `handleDateChange`, only swap when the flush succeeded — or keep the
error visible and retain the old text — rather than clearing both.

**Scope:** S · **Runtime verification:** required · **Manual QA:** MQ-JRN-01, MQ-JRN-02 · **Historical:** D.

### Journal — remaining findings

| ID | Pri | Confidence | Class | Finding | Remediation |
| --- | --- | --- | --- | --- | --- |
| F-23 | P2 | HIGH | ARCHITECTURAL RISK | Whole-entry last-writer-wins across tabs: `persistPending` writes all four fields from `entryRef`, with no `assertRecordIsFresh` (that protection covers only Opportunities/Content/Weekly) | Per-field merge or a freshness check before whole-entry writes; or document the exclusion |
| F-24 | P3 | CONFIRMED | DEFECT | "Make a reminder from this" has no duplicate-submission guard — the only one of five promotion verbs without one | Route through `usePromotionAction`; reflect a promoted state |
| F-25 | P3 | NEEDS RUNTIME | DEFECT | The promotion button is nested **inside** the prompt `<label>`, so the textarea's accessible name may absorb its text | Move the button out of the label |
| F-26 | P3 | HIGH | DEFECT | Save-status copy overstates behavior: "We'll keep trying" (there is no retry) and "Saving…" while merely debounced; three live regions can announce at once on error | Match copy to reality; collapse the overlapping regions |
| F-27 | P3 | CONFIRMED | PRODUCT GAP | First visit is four blank textareas at once — the highest-blank-canvas moment in a low-pressure product | Progressive reveal, or de-emphasise the secondary prompts until the first has text |
| F-28 | P3 | HIGH | DEFECT | "Make a reminder from this" is ~29px tall, below the 44px coarse-pointer floor | Add the coarse-pointer rule |

---

## 10. Weekly Brief Findings

The Weekly Brief is the repository's most persistence-mature surface: a per-week record store (versioned
envelope locally, `weekly_briefs` + `weekly_brief_items` remotely), a descriptor table that single-sources
the three item types' normalisation and Supabase mapping, optimistic locking with legacy-skip semantics,
shared silent-refresh subscriptions, request-id stale-response guards, and a minute-aligned rollover poll.
Its defects are concentrated at two seams: the demo fallback (F-02, §7) and the concurrency guard (F-01,
§17).

| ID | Pri | Confidence | Class | Finding | Evidence | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| F-29 | P2 | HIGH | DEFECT | **Week key mixes local time and UTC.** `resolveCurrentWeekStart` builds local Monday 00:00 then serialises with `toISOString().slice(0,10)` (`weeklyRepository.js:146`) | For any UTC+ offset, local Monday 00:00 is Sunday in UTC — Berlin's Monday 2026-08-24 stores `2026-08-23`, New York stores `2026-08-24` for the same ISO week. Self-consistent within one timezone; splits across devices and contradicts the documented "ISO Monday" model and the `unique(user_id, week_start)` constraint | Format from local date components rather than `toISOString`; alias/migrate existing Sunday-keyed rows |
| F-30 | P2 | HIGH | INTENTIONAL BOUNDARY (still open) | **Persistence side effects inside `setState` updaters.** All four setters launch writes from inside their updater callbacks | With `React.StrictMode` on (`main.jsx:11`), dev double-invocation fires `persistCollectionDiff` twice; local `createWeeklyItem` has no id dedup (`weeklyRepository.js:595-598`) | Documented deferral with a written plan (ref-based tracker). Cheap interim guard: dedup by id in local create |
| F-31 | P2 | HIGH | DEFECT | **Review-notes debounce never flushes.** Unmount cleanup clears the timer only; no `beforeunload`, no blur flush | `WeeklyBrief.jsx:77-81`. Journal implements the full pattern. The architecture audit claims flush-on-`beforeunload` for "Journal, Weekly" — `git log -S beforeunload -- src/pages/WeeklyBrief.jsx` returns nothing, so the doc claim was never true | Mirror Journal's `flushPendingSave` on unmount, `beforeunload`, and blur; correct the audit doc |
| F-32 | P2 | NEEDS RUNTIME | DEFECT | **Draft-sync effect can revert in-flight keystrokes.** The guard checks save status but not pending-debounce state | `WeeklyBrief.jsx:70-75`: typing during an in-flight save lets the resolved older value overwrite the newer draft | Include pending state in the guard; reconcile on flush |
| F-33 | P2 | HIGH | ARCHITECTURAL RISK | **Item stale-guard uses live state, not an editor-open snapshot.** `expectedUpdatedAt` comes from hook state at save time (`useWeeklyBrief.js:223`) while form values were snapshotted at modal open | Because the list silently refreshes under the open modal (a documented feature), a cross-tab edit is absorbed into state within ~400 ms and the conflict resolves as silent last-write-wins | Snapshot `updatedAt` in `useWeeklySectionEditor` at open and thread it through (part of the planned setter refactor) |
| F-34 | P2 | HIGH | DEFECT | **Failure recovery erases its own error message.** `recoverAfterPersistenceFailure` sets `loadError`, then the silent reload's success path unconditionally clears it (`useWeeklyBrief.js:110,170-176`) | In local mode the reload completes in milliseconds, so the stale-record or save-failure message flashes and vanishes while the change visibly rolls back. The hook tests encode this behavior | Don't clear `loadError` on recovery-triggered silent reloads; reword "We'll keep trying" to match reality |
| F-35 | P2 | HIGH | DEFECT | **New items prepend in state but append in persistence**, so a newly added item visibly jumps to the bottom after the silent refresh | `useWeeklySectionEditor.js:106` prepends; `weeklyRepository.js:597` appends; Supabase inserts sort last | Pick one order (appending in the editor is a one-line fix); add a test that spans both layers |
| F-36 | P2 | CONFIRMED | DEFECT | **`WeeklyBriefSummary` is rendered twice** — verified at `WeeklyBrief.jsx:153` and `:205`, with `SummaryCards` at `:121`, so the same counts appear three times on one page | Introduced by merge `4447e1a` ("resolve main conflicts in ux audit follow-ups"), which kept both branches' placements. No test asserts a single render | Keep one instance; fold or drop the `SummaryCards` band per the UX audit |
| F-37 | P2 | CONFIRMED | PRODUCT GAP | **The weekly ritual loop is unbuilt**: no week navigation, last-week review, carry-forward, chosen headline focus, or completion state | `useWeeklyBrief.js:46` hardcodes the current week; nothing in `src/components/weekly/` implements the rest. The May 2026 UX audit's Phases 2–4 remain unchecked, while Phase 1 shipped | Execute the documented phases — the week navigator first (the repository already supports arbitrary weeks) |
| F-38 | P3 | HIGH | DEFECT | **Editing a demo-seeded item keeps its demo id**, so "Clear demo data" later deletes user-authored content | Demo ids survive edits into the real store | Re-key on first edit, or match demo records by content rather than id |
| F-39 | P3 | NEEDS RUNTIME | ARCHITECTURAL RISK | Supabase create drops non-UUID client ids, leaving a brief window where fast edits target a phantom id | — | Return and adopt the server id before enabling edit affordances |
| F-40 | P3 | CONFIRMED | INTENTIONAL BOUNDARY | Weekly Brief has no offline write queue; list-action touch targets stop at 36px | Both documented deferrals | Leave as documented, or extend the queue when the wedge in F-45 is fixed |

---

## 11. Opportunities Findings

Opportunities is the reference implementation of the CRUD stack — shared `useCrudPage`, payload schema
validation at the form boundary, duplicate prevention via the extracted `makeDuplicateValidator`,
optimistic locking, offline-queue enrolment — and its Playwright coverage (create/edit/delete,
keyboard-only row selection, error-then-retry) passes at runtime. The findings below apply equally to
Content OS except where noted; both share `useCrudPage`, the offline queue, and the concurrency helper.

The dominant issue is **F-01 (§17)** — the millisecond/microsecond stale-guard defect, which affects this
domain's Supabase update *and* the same code path in Content OS and Weekly Brief.

| ID | Pri | Confidence | Class | Finding | Evidence | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| F-41 | P2 | CONFIRMED | DOCUMENTATION DRIFT + DEFECT | **Cross-tab list refresh is claimed but not implemented.** `useCrudPage` subscribes only to a same-tab `CustomEvent` | Verified: `useCrudPage.js:202` is the sole `addEventListener`, with no `storage`/`focus`/`visibilitychange` subscription. Yet `useCrudPage.js:186` comments "other tabs" and `KNOWN_LIMITATIONS.md:92` claims cross-tab refresh as closed | Wire through `useSilentRefresh` (which already supports storage keys) — or correct the comment and the doc |
| F-42 | P2 | HIGH | DEFECT | **Item-details modal stays open beneath form/delete modals, and duplicate document-level Escape handlers close the whole stack.** Verified: `Modal.jsx:74` registers a document `keydown` per open modal with no stacking guard | One Escape runs both `onClose` handlers; Escape during a failed save can flip the form from update to create | Track an open-modal registry (or `stopImmediatePropagation` on the topmost); close the item modal while a child modal is open |
| F-43 | P2 | HIGH | DEFECT | **Delete has no concurrency guard, no not-found recovery, and its errors render behind the confirm modal** | `deleteOpportunity`/`deleteContentItem` accept options but never read `expectedUpdatedAt` — no `assertRecordIsFresh`, no `eq('updated_at')` on the Supabase delete, while updates are guarded | Thread `expectedUpdatedAt` into delete (or document delete-wins); treat local not-found as success; surface errors inside the modal |
| F-44 | P2 | HIGH | ARCHITECTURAL RISK | **Auth-error handling diverges by repository.** Opportunities/Content propagate token-refresh errors; Chief/Settings catch and fall back | No PGRST301/401/403 recognition exists in either CRUD repository | Extract the Chief/Settings classification into a shared helper and apply it — this is a still-open item from the readiness audit |
| F-45 | P2 | HIGH | ARCHITECTURAL RISK | **Offline queue lifecycle wedges.** `tryRemoteOrEnqueue` enqueues *and always rethrows*, so the user sees a hard failure, retries, and enqueues duplicates; on reconnect the drain stops at the first failure, and a duplicate entry now fails permanently — blocking every later write forever with no discard affordance | `offlineWriteQueueIntegration.js:72-77`; `offlineWriteQueue.js:101-126, 204-215`. Verified: the queue bumps `attempts` but has no max-attempts eviction | At drain time treat duplicate and stale errors as terminal (remove or park the entry) and continue; make the enqueued state read as "queued", not "failed" |
| F-46 | P3 | HIGH | ARCHITECTURAL RISK | Supabase duplicate check is check-then-insert with no DB unique constraint, and fetches the user's whole table per create | TOCTOU window; O(table) read per write | Add a partial unique index; let the DB arbitrate |
| F-47 | P3 | HIGH | DEFECT | Supabase opportunities list has no `ORDER BY`, so row order is unstable and differs from local newest-first | — | Add an explicit order matching the local contract |
| F-48 | P3 | HIGH | NEEDS PRODUCT DECISION | Payload schemas are enforced only at the form boundary; promotions and Chief acceptance write records that never pass validation | — | Validate inside the repository create/update path |
| F-49 | P3 | NEEDS RUNTIME | DEFECT | `display: grid` on table rows may strip table semantics for screen readers in real browsers | jsdom cannot detect this; the axe sweep passed but does not assert row/cell roles | Verify with a real AT; add explicit ARIA roles if confirmed |

---

## 12. Content OS Findings

Content OS shares the stack above; what is specific to it is its lifecycle rebuild and one genuine
test-infrastructure failure.

**Historical reconciliation — resolved in code, stale in docs.** `KNOWN_LIMITATIONS.md:22-23` lists
"'Idea' status and publish-date for Content OS" as deferred. Both **shipped** on 2026-05-12, verified
directly: `contentPayloadSchema.js:12-31` declares the full `Idea → Drafting → Editing → Ready →
Scheduled → Published` lifecycle with `DEFAULT_CONTENT_STATUS = 'Idea'`, `scheduledFor` exists at line 60,
and `supabase/migrations/20260512_content_items_lifecycle_fields.sql` adds `content_type`, `purpose`,
`scheduled_for` and `notes` with an index. Only the **calendar view** remains genuinely deferred — that one
is correctly classified as an INTENTIONAL BOUNDARY, not a defect.

| ID | Pri | Confidence | Class | Finding | Remediation |
| --- | --- | --- | --- | --- | --- |
| F-50 | P2 | CONFIRMED | TEST DEFECT | **Two Content OS e2e specs fail at HEAD** because they target `'Create a new content item'`, an accessible name that no longer exists — `ContentCrudPage.jsx:206-208` sets `actionText: 'New Content'` / `actionLabel: 'Add a content idea or draft'`. The rename landed 2026-05-12 (`7a560fa`); the spec was last touched 2026-04-22 (`6faa2da`) | Update the two selectors. This is one of the deterministic causes of the red CI gate (§28) |
| F-51 | P3 | CONFIRMED | DEFECT | The offline notice says "No cloud replay queue is active" on the only two pages that *do* have one | Correct the copy for the queued domains |
| F-52 | P3 | CONFIRMED | TECHNICAL DEBT | The loading skeleton mimics the retired card-grid layout; the card CSS survives only to serve the skeleton | Align the skeleton with the shipped table/board |
| F-53 | P3 | CONFIRMED | PRODUCT GAP | Past-dated Scheduled items still render as "Next: \<past date\>" with no overdue signal | Add a quiet overdue state (calm-consistent: a word, not a red badge) |
| F-54 | P3 | CONFIRMED | OVERENGINEERING | The slots-migration ceremony (a CI guard script plus a dated tracking ticket) outweighs a two-consumer abstraction — though the guard **passes** and the ticket is properly closed | Retire the guard now that the migration is complete |

---

## 13. Chief of Staff Findings

Chief of Staff is the strongest-architected surface in the app and earns its billing as the differentiator.
Client and server genuinely share one source of truth — `src/lib/chiefActions.js` and
`chiefStructuredPayload.js` are pure re-export shims over the `shared/` modules the proxy core also imports
— so the feared client/server drift does not exist. Untrusted AI responses are defensively normalised on
both sides (12-item and 280-character caps, whitespace collapse, per-section dedup, fenced-JSON and
markdown-heading parsing). The deterministic fallback is honestly labelled with its reason and error code.
No API key is ever present in the client. Double-click races on accept, Add All, and stale workspace loads
are all guarded and tested.

**Verified correction to a suspected finding:** the four `Chief*List` components are *not* dead code. Each
still has exactly one production importer, and `ChiefAcceptList` has four — the 2026-06-26 consolidation
left them as live thin configs, which is the intended outcome.

**Does the AI add decision leverage?** The structured-acceptance loop does: review each item with its
destination shown, accept individually or in bulk, exact-match dedup, routed into the correct repository.
That is real leverage and is original. The deterministic fallback, by contrast, is honest but low-value —
it largely restates the first lines of the notes with generic scaffolding, so a reviewer without a
configured key sees formatting rather than intelligence. Given F-03 (below), that is what most deployments
would show.

### F-03 — Proxy token auth cannot be satisfied by the shipped client

```text
ID:                    F-03
Priority:              P1
Confidence:            CONFIRMED
Classification:        ARCHITECTURAL RISK
Area:                  AI security and reliability
File(s):               src/lib/openai.js:10-12, 113-120
                       server/chiefOfStaffProxyCore.js:185-199
                       docs/CONFIGURATION.md:36 · .env.example:10 · README.md:216-218
```

**Evidence.** The browser sends only `Content-Type` and an optional `x-chief-correlation-id`
(`openai.js:113-120`) — there is no `Authorization` or `X-Chief-Staff-Token` header, and no `VITE_`
variable exists to carry one (a shared secret in a public SPA bundle could not be a secret anyway).
The server's `hasValidProxyToken` fails **closed** when no token is configured, returning true only when
`CHIEF_STAFF_REQUIRE_TOKEN === 'false'` (`chiefOfStaffProxyCore.js:189-196`). `docs/CONFIGURATION.md:36`
states that production deployments MUST set `CHIEF_STAFF_PROXY_TOKEN`.

**Problem.** The three reachable configurations are: (a) token configured, as the docs instruct → every
request from the app's own frontend 401s and the user permanently sees the deterministic fallback;
(b) no token and no opt-out → fail-closed, same result; (c) `CHIEF_STAFF_REQUIRE_TOKEN=false` → the AI
works, but the endpoint is unauthenticated and open to anyone who finds the URL. There is no configuration
in which the shipped client gets authenticated AI.

**Why it matters.** The differentiating feature is either off or unprotected. In mode (c) the cost-abuse
controls are best-effort: the rate limiter keys on client-influenceable headers (`x-forwarded-for` and
friends), lives in a per-instance in-memory map that resets on cold start and is not shared across
concurrent lambdas, and the upstream request sets no `max_output_tokens`. The failure is graceful — the
user sees a labelled local fallback, not an error — which is exactly why it could ship unnoticed.

**Launch / portfolio risk.** High. A reviewer following the documented production setup would conclude the
AI feature does not work; a reviewer following the only working setup would be running an open proxy against
the owner's OpenAI key.

**Recommended remediation.** Replace the static shared token with per-user authentication — verify the
Supabase session JWT in the proxy, which the app already has for signed-in users — or, if the demo must stay
anonymous, keep the open endpoint but add a hard server-side spend ceiling plus `max_output_tokens`, and
document the posture honestly. Either way, reconcile `CONFIGURATION.md`, `.env.example` and the README so
they stop instructing a configuration that disables the feature.

**Scope:** M · **Dependencies:** auth decision · **Runtime verification:** required against a deployment ·
**Manual QA:** MQ-CHF-01 · **Historical:** D — new; prior audits reviewed the proxy's fail-closed logic but
never traced the client's request headers against it.

### Chief of Staff — remaining findings

| ID | Pri | Confidence | Class | Finding | Evidence | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| F-55 | P2 | HIGH | DEFECT | **Display defaults leak into acceptance.** `normalizeChiefOutput` injects presentation fallbacks (owner `"You"`, company `"Unknown"`, platform `"LinkedIn"`) and the page feeds those normalised items into the acceptance engine | Fabricated metadata is persisted as real records (a platformless idea becomes a LinkedIn draft), and acceptance keys built from display items never match hydration keys built from raw payloads, so the already-accepted "Added" state silently fails after reload whenever the AI omitted a field. Click-time dedup still prevents duplicate rows, so this is data quality, not data loss | Accept from the stored payload item (or mark defaulted fields) so keying and persistence use raw values |
| F-56 | P2 | HIGH | DEFECT | **Navigating away mid-generation discards a completed output.** The `isMountedRef` guard returns *before* `saveChiefOutput` | The generation succeeded and the result is thrown away | Persist first, gate UI updates second |
| F-57 | P2 | HIGH | DEFECT | **Notes persist on every keystroke with no debounce.** In Supabase mode that is a SELECT + UPDATE round-trip per character, with unordered completion and no sequence guard | `ChiefOfStaff.jsx:184` → `useChiefWorkspace.js:87` → `chiefRepository.js:128-168` | Debounce 500–800 ms with a monotonic sequence guard; keep the local echo immediate |
| F-58 | P2 | HIGH | PRODUCT GAP (privacy) | **No disclosure that Generate sends notes off-device**, while adjacent copy says the workspace is "stored on this device only". Verified: `OPENAI_PROXY_URL = configuredProxyUrl \|\| '/api/chief-of-staff'` is always truthy, so the `if (!aiConfig.endpoint)` branch at `openai.js:153` is unreachable and every Generate posts the full notes | The proxy forwards them to `api.openai.com` | Add one calm line near Generate; delete the dead branch; stop asserting availability from env-var presence |
| F-59 | P2 | NEEDS RUNTIME | DEFECT | **Accept buttons and "Add All to System" carry no author styling.** Verified: the per-item accept button (`ChiefAcceptList.jsx:62-70`) has *no* `className` at all, and `.chief-accept-all-btn` is styled only inside two media queries (`chief-of-staff.css:366,385`) | *Correction to the inspector's characterisation:* `reset.css:18-22` sets only `font: inherit`, so these render as **native OS-default buttons**, not padding-stripped ones — visually inconsistent on the flagship surface rather than broken, and `components.css:347` still supplies a focus ring | Give them the shared `Button` component or a dedicated rule; check both themes and coarse pointers |
| F-60 | P3 | HIGH | NEEDS PRODUCT DECISION | Chief "tasks" are silently saved as Weekly Brief **priorities** — `resolveItemType` coerces unknown types to `priority` — while the UI promises "→ Weekly Brief task" | — | Add a real task destination, route to reminders, or make the copy honest |
| F-61 | P3 | HIGH | DEFECT | Prose output types trigger a misleading "No structured actions were detected… regenerate" hint | — | Suppress the hint for prose-shaped outputs |
| F-62 | P3 | HIGH | DOCUMENTATION DRIFT | History copy promises "nothing is deleted" while responses are capped at 30 | — | Say "the last 30" |
| F-63 | P3 | HIGH | TECHNICAL DEBT | Fallback provenance (reason, error code) is lost on Supabase reload — no columns exist for it | — | Persist provenance, or scope the badge to the live session |
| F-64 | P3 | HIGH | ARCHITECTURAL RISK | Impure/side-effectful `setState` updaters in the chief hooks (response capture and note save inside updaters) | Same class as F-30 | Move side effects out of updaters |
| F-65 | P3 | HIGH | DEFECT | Telemetry Supabase insert errors are ignored and the `supabase` updated event fires regardless | — | Surface or at least record the failure |
| F-66 | P3 | NEEDS RUNTIME | NEEDS PRODUCT DECISION | A 12-second hard timeout converts slow-but-successful generations into canned fallbacks | — | Raise the ceiling or stream |
| F-67 | P3 | HIGH | DEFECT | The page ignores `feedbackKind`, so errors render in the same muted style as informational hints | — | Style by kind |
| F-68 | P3 | HIGH | INTENTIONAL BOUNDARY | Acceptance signature caches go stale against out-of-band repository changes | Documented deferral, bounded by the post-generation reset | Subscribe the caches to repository events when convenient |

---

## 14. Settings Findings

Settings is a form-orchestration surface with three sections (theme, workspace profile/data, account) plus
the workspace backup facility. Its axe sweep and the `settings-shell` e2e spec (branding and timezone
propagating to the shell after save) both pass at runtime.

**The backup path is genuinely well-built and should be preserved.** `importWorkspaceBackup`
(`workspacePortability.js:476-522`) is **validate-all-then-write-all**: every entry is normalised and
validated, and any failure throws, *before* the first `setItem` runs — so a malformed or partially-invalid
backup cannot half-apply. `validateBackupEnvelope` (395-410) requires a schema version, rejects
`schemaVersion < 1`, and — notably — rejects payloads from a **newer** CEO OS version
("Backup file was created by a newer CEO OS version"). Unknown keys are skipped and reported as
`ignoredKeyCount` rather than written blindly.

That last point produces a useful internal comparison: **the backup reader guards against future versions;
the primary storage reader does not** (see F-71, §16). The correct behavior already exists in this
codebase — it simply is not applied on the hot path.

Settings itself is mature: four extracted sections around a `useSettings` hook with request-id and
edit-version guards and a queued save loop, all covered by focused tests; genuinely careful timezone
handling (Intl validation, a supported-zone datalist, a device-timezone shortcut, blur normalisation, and a
disabled Save whose accessible name explains why); and the persistence source surfaced in three places.

### F-87 — "Load demo workspace" destroys user-created local records without confirmation

```text
ID:                    F-87
Priority:              P1
Confidence:            CONFIRMED
Classification:        DEFECT
Area:                  Settings / Focus Home setup / local persistence
File(s):               src/lib/opportunitiesRepository.js:339-343
                       src/lib/contentRepository.js:353-358
                       src/lib/weeklyRepository.js:833-848
                       src/components/settings/SettingsWorkspaceDataSection.jsx:74-85
                       src/hooks/useWorkspaceSetup.js
```

**Evidence.** Verified directly: `resetLocalOpportunityDemoData()` is
`const seeded = getDemoLocalItems(); writeLocalOpportunities(seeded);` — a **full store replacement**, not
a merge. The same pattern replaces the content store and the current week's brief. The Settings control
(`SettingsWorkspaceDataSection.jsx:74-75`) is an always-enabled button with no confirmation modal and no
`archiveStorageValue` backup — note the contrast with its sibling "Clear demo data" (line 81-85), which
*is* correctly gated behind `disabled={!isDemoMode}`. The same action is also reachable in one click from
the Focus Home setup card.

**Problem.** A founder with real local opportunities, content items and weekly data who clicks "Load demo
workspace" loses all of it irrecoverably: no confirmation, no undo, and no preserved copy. The plausible
path to accidental loss is specific and realistic — until a setup choice is saved, the card reads "No setup
choice has been saved yet. Demo records are shown for review until you choose", so a user who has been
working locally while demo records were also displayed may click "Load demo workspace" to resolve the
ambiguity and destroy their own records in the process.

**Why it matters.** This violates the repository's own stated contract. `weeklyRepository.js:306-315`
articulates the "never discard user data without trace" principle, `archiveStorageValue` exists precisely
for this purpose and is used for legacy keys, and the corruption path is built around preserving rather than
losing data. This is the one place where a destructive action skips the discipline the rest of the codebase
applies consistently.

**Why P1 and not P0.** The action is user-initiated through an explicitly labelled control rather than a
silent or automatic loss, and a backup facility exists. It is nonetheless irreversible and violates the
project's own guarantee, so it is the highest-priority item in Phase 1.

**Recommended remediation.** Archive the three stores via `archiveStorageValue` before seeding (recovery
then already exists through the corruption/restore path), and put the destructive variant behind the
existing `ConfirmModal` when the target stores are non-empty — stating how many records will be replaced.

**Scope:** S · **Runtime verification:** not required · **Manual QA:** MQ-SET-01 · **Historical:** D — new.

| ID | Pri | Confidence | Class | Finding | Remediation |
| --- | --- | --- | --- | --- | --- |
| F-88 | P2 | CONFIRMED | DEFECT | **Backup import overwrites matching stores with no confirmation and no pre-write archive**, and the write loop uses raw `storage.setItem` rather than `requireLocalStorageSetItem` — so a quota failure mid-loop half-applies the import *and* never reaches the quota banner (`workspacePortability.js:511-513`) | Archive before writing; use the guarded setter; restore on failure |
| F-89 | P2 | HIGH | DEFECT | **"Clear demo data" misses weekly demo items outside the current week.** `clearLocalWeeklyDemoData` filters demo ids only inside `store[currentWeek]`, and `startBlankWorkspace` calls it with no argument — so demo items materialised under an earlier week (via F-02) survive into a supposedly blank workspace | Clear demo ids across all week records |
| F-90 | P2 | HIGH | DEFECT | **After a failed save, "Retry" silently discards the user's on-screen edits.** The shared error slot wires `onRetry={refreshSettings}`, which reloads persisted values, while the copy claims "while we retry" | Make retry re-attempt the save, or relabel and warn that edits will be replaced |
| F-69 | P3 | HIGH | DEFECT | Import is transactional against *validation* failures but not against a quota failure mid-write | Snapshot the affected keys and restore on failure, or stage-and-swap |
| F-91 | P3 | HIGH | DEFECT | An imported theme preference is not applied until a full reload — the synthesized `StorageEvent` lacks `storageArea`, so `usePersistentState` ignores it | Include `storageArea`, or apply the theme directly after import |
| F-92 | P3 | HIGH | DEFECT | Settings' demo/blank actions give no success or failure feedback (Focus Home has toasts; Settings does not), and the mode flips before the clearing writes complete | Add feedback; order the writes before the mode flip; handle rejection |
| F-93 | P3 | HIGH | DEFECT | Signed-out users in a Supabase-configured build briefly see sync-active copy before the first settings load resolves | Initialise the source as unknown rather than `supabase` |
| F-94 | P3 | HIGH | PRODUCT GAP | The "needs recovery" health line names a problem but offers no recovery affordance on the page | Link to the corruption-restore flow |
| F-95 | P3 | HIGH | DEFECT | The hidden import file input is a focusable, invisible tab stop | Use a label-wrapped input or `display: none` until activated |
| F-96 | P3 | HIGH | ARCHITECTURAL RISK | `getLocalWorkspaceDataHealth` JSON-parses every store on **every render** of the Workspace Data section — including on every keystroke in the name field | Memoise, or recompute on repository events only |
| F-97 | P3 | HIGH | DEFECT | The `autoSave` toggle flips visually but silently skips persistence while the timezone field is invalid | Disable the toggle, or surface why the save was skipped |
| F-98 | P3 | HIGH | TECHNICAL DEBT | Orphaned settings fields and a dead offline-queue branch remain from earlier audit fixes | Remove |
| F-70 | P3 | CONFIRMED | INTENTIONAL BOUNDARY | Import replaces domains wholesale (no merge) and does not migrate into Supabase; backup-scope copy slightly overstates coverage (drafts and preserved corruption backups are excluded) | Documented in `KNOWN_LIMITATIONS.md:13`; tighten the scope copy |

Additional Settings-adjacent findings appear under Focus Home (F-08, the missing Reminders local-only
notice, whose copy constant exists but has no consumer) and §15 (account lifecycle).

---

## 15. Authentication + Account Findings

This section deliberately separates two claims the repository sometimes blurs.

**AUTHENTICATION TECHNICALLY EXISTS.** PKCE magic-link sign-in with calm three-state copy; an auth callback
with timeout and error branches; session restore via `persistSession` plus `onAuthStateChange`; sign-out in
Settings; a distinct "Sign in to sync" pill state; and honest disabled states when Supabase is unconfigured.
Statically, this looks correct.

**THE ACCOUNT PRODUCT IS NOT COMPLETE.** Missing: account recovery, account deletion, email change, cloud
data export, per-user scoping of local storage, and any user scoping of the offline write queue. The gap is
explicitly acknowledged in `README.md:303-306` and `KNOWN_LIMITATIONS.md:119` — so most of it is an
**INTENTIONAL BOUNDARY**, not a defect. What the audit adds is that three specific consequences are *not*
documented and are more than boundary-shaped.

| ID | Pri | Confidence | Class | Finding | Evidence | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| A-01 | P2 | HIGH | PRODUCT GAP | **First sign-in silently hides the existing local workspace** while the sign-in page promises "Supabase becomes an additional source rather than a replacement" | After first sign-in the four synced domains read exclusively from Supabase; pre-existing local records vanish from the UI. Local-to-cloud migration is a documented non-goal, but this copy actively contradicts the behavior | Correct the copy to say the cloud workspace replaces the local view, and tell the user their local data is still on the device (with the export path) |
| A-02 | P2 | HIGH | DEFECT (privacy) | **The offline write queue is not account-scoped.** Verified: it is a single global key `ceo-os-offline-write-queue` with entries `{id, kind, payload, createdAt, attempts}` and no `userId` | Entries survive sign-out; replay stamps the *currently* signed-in user, so user A's queued opportunity (name, company, next step) can be inserted into user B's account on a shared browser. RLS is not bypassed — the row is legitimately written to B | Scope the queue key (or each entry) by user id; drop or quarantine entries whose owner does not match on drain |
| A-03 | P2 | HIGH | DEFECT | **Signed-out-but-configured builds show a false offline state.** Opportunities/Content/Weekly call `requireSupabaseUserId` and throw, and `source === 'supabase' && hasLoadError` maps to offline copy | The user sees empty lists plus "Data source: Offline. No cloud replay queue is active." while actually online, with a retry that can never succeed | Recognise auth errors distinctly (see F-44) and render a "Sign in to continue" state instead of offline copy |
| A-04 | P3 | HIGH | DEFECT | Local storage is not per-user: user B on a shared browser sees user A's Capture, Journal, Reminders and Chief-notes residue (those domains never sync and are keyed globally) | — | Namespace local keys by account once signed in, or state the single-user-per-browser assumption in-product |
| A-05 | P2 | CONFIRMED | PORTFOLIO GAP | **The auth surfaces have zero automated coverage.** No test exists for `SignIn`, `AuthCallback`, `useAuthSession`, or `SettingsAccountSection`, and both auth routes are excluded from the axe e2e sweep (they render outside the shell) | Confirmed against the test inventory and `e2e/a11y-sweep.spec.js`'s route list | Add component tests for the three states each, and include both routes in the axe sweep |
| A-06 | P3 | NEEDS RUNTIME | DEFECT | Auth callback UX races: a fixed 5s timeout can pre-empt a slow PKCE exchange, and the intended deep-link destination is dropped | — | Make the timeout generous and resumable; preserve and honour the return path |
| A-07 | P2 | CONFIRMED | INTENTIONAL BOUNDARY | No recovery, deletion, email change, cloud export, or per-user local scoping | Documented in README and KNOWN_LIMITATIONS | Keep as a boundary; do not describe the project as account-based SaaS until closed |

Everything in this section that depends on a real session is **NEEDS RUNTIME VERIFICATION** — no
authenticated environment was available, and the repository's own docs state that an authenticated
regression pass has never been run.

---

## 16. Local-First Architecture

### 16.1 Domain persistence matrix

| Domain | Local key | Supabase | Versioned envelope | Migration | Corruption recovery | Offline queue | Cross-tab | Auth-scoped |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Opportunities | `ceo-os-opportunities` | ✅ `opportunities` | ✅ | registry present, empty | preserve + reseed | ✅ create/update/delete | ❌ page; Dashboard watches the key | ❌ |
| Content OS | `ceo-os-content-items` | ✅ `content_items` | ✅ | registry present, empty | preserve + reseed | ✅ create/update/delete | ❌ page; Dashboard watches the key | ❌ |
| Weekly Brief | `ceo-os-weekly-briefs` (+4 legacy keys) | ✅ `weekly_briefs`, `weekly_brief_items` | ✅ | ad-hoc legacy migration **outside** the registry | preserve (no reseed) | ❌ documented | ✅ event + storage keys | ❌ |
| Settings | `ceo-os-settings` (+ unversioned `…-saved-at` sidecar) | ✅ `profiles` (auth-fallback to local) | ✅ | registry present, empty | preserve | ❌ (errors throw) | ✅ | ❌ |
| Chief workspace | 2 enveloped keys | ✅ `chief_sessions`, `chief_outputs` (auth-fallback) | ✅ | registry present, empty | preserve | ❌ | ❌ no updated event | ❌ |
| Chief telemetry | `ceo-os-chief-telemetry-events` | ✅ `chief_telemetry_events` | ❌ raw array | ❌ not registered | ❌ raw `setItem` | ❌ | ❌ | ❌ |
| Capture | `ceo-os-capture-notes` | ❌ **by design** | ✅ | registry present, empty | preserve + reseed | ❌ n/a | ❌ same-tab only | ❌ |
| Journal | `ceo-os-journal-entries` | ❌ **by design** | ✅ | registry present, empty | preserve | ❌ n/a | ❌ same-tab only | ❌ |
| Reminders | `ceo-os-reminders` | ❌ **by design** | ✅ | registry present, empty | preserve | ❌ n/a | ✅ watched by Focus Home | ❌ |
| Offline queue | `ceo-os-offline-write-queue` | n/a | ❌ raw, unversioned entries | ❌ | preserve | n/a | ✅ **both** event and storage | ❌ (A-02) |
| Ops SLO snapshots | none | ✅ `ops_slo_snapshots` (read-only) | n/a | n/a | n/a | n/a | n/a | anon-readable |
| App-error telemetry | 2 raw keys | ✅ service-role tables | ❌ raw | ❌ | silent write helper | own queue | ❌ | n/a |
| UI prefs (theme, focus mode, capture draft, setup, notice) | 5 raw JSON keys | ❌ | ❌ **second storage model** | ❌ | preserve (via `usePersistentState`) | n/a | ✅ | ❌ |

### 16.2 Verdict — is "local-first" a coherent architecture or a set of special cases?

**In pure local mode: coherent.** One envelope pattern, one corruption path, one event idiom, one
save-status bus. This is genuinely good architecture and the single strongest engineering artifact in the
repository.

**In Supabase mode: not local-first, and not uniform.** Four different strategies coexist: Opportunities
and Content OS become *remote-only* with a retry queue (there is no local mirror, so the "local-first"
label is inaccurate for exactly the two domains that sync most); Settings and Chief fall back to local on
auth errors (in two different variants); Weekly Brief throws; and three domains never sync at all. The
seam, not the core, is where the special cases live.

A secondary architectural observation: there are **two storage models** — the versioned envelope used by
repositories, and raw JSON via `usePersistentState` for UI preferences. That split is defensible (prefs
are disposable), but `ARCHITECTURE.md` documents only the first, so a reader encountering
`ceo-os-focus-mode` finds an undocumented pattern.

| ID | Pri | Confidence | Class | Finding | Evidence | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| F-71 | P2 | CONFIRMED | ARCHITECTURAL RISK | **No guard for future-version envelopes, and no completeness check on the migration chain.** Verified independently: `readVersionedLocalStorage` returns `migrated.data` without ever comparing `migrated.toVersion` to `CURRENT_DATA_SCHEMA_VERSION` (`versionedStorage.js:58-60`), and `migrateStoragePayload` short-circuits and returns data **unchanged** when `currentVersion >= CURRENT` (`storageMigrations.js:46-53`) | When v2 ships, a missing or partial migrator silently yields v1-shaped data presented as current; an older build reading a v2 payload (a stale cached bundle, or a newer backup) accepts it and downgrades it on the next write. The backup reader already implements the correct future-version rejection (§14) | Reject or quarantine payloads whose version exceeds the current schema, and treat an incomplete chain as a read failure rather than returning partial data |
| F-72 | P2 | HIGH | DEFECT | **Corrupt primaries are never quarantined for non-reseeding domains**, so every read churns a new backup, evicts distinct older ones from the 3-slot cap, and re-fires the event that resets the recovery banner under the user | — | Quarantine (rename) the corrupt primary after preserving it, or de-duplicate by content hash |
| F-73 | P3 | HIGH | DEFECT | Mount-time storage writes fire spurious "Saved" signals through the save-status bus (same root cause as S-07) | `usePersistentState` re-writes and calls `notifySaveSucceeded` on mount | Skip persistence and notification when the value is unchanged from the loaded one |
| F-74 | P3 | HIGH | INTENTIONAL BOUNDARY | Queue entries are unversioned, unknown kinds accumulate silently forever, and the 200-entry cap drops oldest silently | `offlineWriteQueue.js:26,119` | Version the entries; log or surface silent drops |
| F-75 | P3 | CONFIRMED | DOCUMENTATION DRIFT | Storage documentation lags implementation in three places — most importantly `KNOWN_LIMITATIONS.md:121`, which lists Capture, Journal and reminders as lacking envelope discipline when all three have had it since May, and `:105`, which says only Weekly Brief writes an envelope | Verified in `captureRepository.js:92-98`, `journalRepository.js:65-71`, `remindersRepository.js:72-78` | Re-audit the list against actual `versionedStorage` usage |

---

## 17. Supabase + Data Integrity

### 17.1 Row-level security — verified correct

For every user-data table, the audit asked the four mandated questions and answered them from the SQL:

| Table | RLS enabled | Can A read B? | Can A modify B? | Anonymous reach | Ownership enforced by |
| --- | --- | --- | --- | --- | --- |
| `profiles` | ✅ | ❌ `auth.uid() = id` | ❌ (insert/update own; **no delete policy** — deliberate) | ❌ | RLS |
| `opportunities` | ✅ | ❌ | ❌ `using` + `with check` | ❌ | RLS |
| `content_items` | ✅ | ❌ | ❌ `using` + `with check` | ❌ | RLS |
| `weekly_briefs` | ✅ | ❌ | ❌ `using` + `with check` | ❌ | RLS |
| `weekly_brief_items` | ✅ | ❌ | ❌ `using` + `with check` | ❌ | RLS |
| `chief_sessions` | ✅ | ❌ | ❌ `using` + `with check` | ❌ | RLS |
| `chief_outputs` | ✅ | ❌ | ❌ `using` + `with check` | ❌ | RLS |
| `chief_telemetry_events` | ✅ | ❌ | ❌ | ❌ | RLS |
| `app_error_telemetry_events` | ❌ (grants) | n/a | n/a | ❌ revoked | grants: service_role only |
| `app_error_telemetry_key_audit_events` | ❌ (grants) | n/a | n/a | ❌ revoked | grants: service_role only |
| `ops_incident_lifecycle_events` | ❌ (grants) | any authenticated user can `select` | ❌ | ❌ | grants |
| `ops_slo_snapshots` | ❌ (grants) | **anon `select` granted** | ❌ | ✅ **by design** | grants |

**This is the strongest security result in the audit and should be preserved as-is.** Ownership is enforced
in the database, not merely by client filtering, with `with check` present so a client cannot write rows it
could not read. The telemetry sinks correctly revoke `anon`/`authenticated` and grant only `service_role`.

Two deliberate exposures warrant a product decision rather than a fix: `ops_slo_snapshots` is readable by
anyone holding the public anon key (operational metrics, not user data — this is how the Ops page reads it),
and `ops_incident_lifecycle_events` is readable by any signed-in user. Neither is a vulnerability; both are
broader than strictly necessary.

### 17.2 F-01 — Optimistic locking is inverted in Supabase mode

```text
ID:                    F-01
Priority:              P1
Confidence:            CONFIRMED (mechanism, re-derived independently); NEEDS RUNTIME VERIFICATION (end-to-end)
Classification:        DEFECT
Area:                  Data integrity / Supabase / the flagship concurrency feature
Surface:               Opportunities, Content OS, Weekly Brief items — every guarded Supabase update
File(s):               src/lib/staleRecordError.js:44 (readUpdatedAtMs), :63 (expectedUpdatedAtToIso)
                       src/lib/opportunitiesRepository.js:236-256
                       src/lib/contentRepository.js (same pattern)
                       src/lib/weeklyRepository.js:643-645, 741-743
                       supabase/migrations/20260421_core_schema_rls.sql:15,30,49,67,90,143-176
                       src/lib/offlineWriteQueueIntegration.js:43-45
```

**Evidence — established three independent ways.** All five core tables declare
`updated_at timestamptz not null default now()`, and `set_updated_at()` triggers assign `now()` on every
update (migration lines 143-176). Postgres `now()` carries **microsecond** precision. The client reads that
value with `readUpdatedAtMs`, which uses `Date.parse` — millisecond resolution — and writes it back through
`expectedUpdatedAtToIso`, which does `new Date(ms).toISOString()`, producing a `.SSSZ` literal. That literal
is applied as `query.eq('updated_at', expectedIso)`. Confirmed numerically in Node:

```text
Date.parse('2026-05-12T10:23:45.123456+00:00')  → 1778581425123
new Date(1778581425123).toISOString()           → '2026-05-12T10:23:45.123Z'
'2026-05-12T10:23:45.123Z' === stored value?    → false
```

`.eq()` therefore matches zero rows for any row whose microsecond remainder is non-zero (~999 of every
1000). `maybeSingle()` returns `data: null`, and the repository converts that to a thrown
`StaleRecordError` (`opportunitiesRepository.js:253-256`).

**Problem.** Nearly every authenticated edit of an opportunity, content item, or weekly item is rejected as
a phantom "changed in another window" conflict. Retrying cannot help: re-reading returns the same
microsecond value, which truncates identically. And because `shouldEnqueueWriteFailure` explicitly excludes
`StaleRecordError` (`offlineWriteQueueIntegration.js:43-45` — correct in isolation), the write is discarded
rather than queued.

**Why the test suite cannot catch it.** Every Supabase repository test mocks `updated_at` as a `.000Z`
string and compares by string equality, so the mock is precision-free by construction. This is the single
most valuable test-quality finding in the audit: the mocks encode an assumption the database does not
honour.

**Why it matters.** The optimistic-concurrency story is a headline architecture claim in the README,
CASE_STUDY and ARCHITECTURE docs. If this behaves as the code indicates, the feature does not merely fail
to protect data in cloud mode — it *inverts*, blocking all legitimate edits while a genuine cross-tab
conflict would be indistinguishable from the false one.

**Launch / portfolio risk.** Highest in the audit. It is also the most credible single explanation for why
an authenticated regression pass has never been completed.

**Recommended remediation (in preference order).** (1) Keep the raw `updated_at` ISO string on the item and
echo it back verbatim in the `.eq()` guard, using the parsed ms only for display and legacy-skip logic —
this removes the round-trip entirely. (2) Or truncate server-side so the stored precision matches what the
client can represent: `new.updated_at = date_trunc('milliseconds', now())` in the trigger. (3) Or replace
equality with a 1 ms half-open range (`gte`/`lt`). Whichever is chosen, add a repository test whose mocked
timestamps carry **microsecond** precision, so the suite can fail on this class of bug in future.

**Scope:** S (the fix) / M (with tests and an authenticated pass) · **Dependencies:** none ·
**Runtime verification:** REQUIRED · **Manual QA:** MQ-AUTH-01 · **Historical:** D — new. Prior audits added
`updated_at` to the Supabase selectors and tested stale conflicts through mocks, which is precisely how the
precision mismatch slipped through.

### 17.3 Other Supabase and data-integrity findings

| ID | Pri | Confidence | Class | Finding | Evidence | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| F-76 | P3 | CONFIRMED | TECHNICAL DEBT | **Migrations are not reproducibly applicable.** Verified: filenames use date-only prefixes with duplicates (three `20260421`, two `20260424`), and `20260421_auth_uid_defaults.sql` sorts **before** `20260421_core_schema_rls.sql`, which creates the tables it alters. Because every statement uses `alter table if exists`, an ordered apply on a fresh database makes the entire file a **silent no-op** — no error is raised | Mitigated in practice only because clients always send `user_id` explicitly | Use ordered version prefixes (timestamps, not dates), and document the apply procedure |
| F-77 | P3 | HIGH | ARCHITECTURAL RISK | RLS does not enforce parent–child ownership consistency: `weekly_brief_items.brief_id` and `chief_outputs.session_id` are checked against the child's own `user_id`, not the parent's owner | A client could in principle attach its own child row to another user's parent id | Add a policy predicate joining the parent's `user_id` |
| F-78 | P3 | CONFIRMED | TECHNICAL DEBT | Schema-vs-client drift: chief fallback provenance has no columns; content status defaults differ between schema and client; timezone handling is naive | — | Reconcile per domain |
| F-79 | P3 | HIGH | NEEDS PRODUCT DECISION | `ops_slo_snapshots` is anon-readable and `ops_incident_lifecycle_events` is readable by any authenticated user | Verified in the migrations | Decide deliberately; if public reporting is intended, say so in the docs |

---

## 18. Offline + Synchronization

The queue's primitives are well made — FIFO with a 200-entry cap, stop-on-first-failure to avoid hammering
a down service, attempt counters, a dedicated update event, correct exclusion of permanent errors from
enqueueing, and `skipQueue` on replay so a failed replay cannot re-enqueue itself. It is also the only
surface that listens to **both** its custom event and cross-tab `storage` events.

The lifecycle around those primitives is the weakest subsystem in the repository:

1. **No permanent-failure eviction.** `attempts` is incremented but never consulted. A head entry that can
   never succeed (a duplicate created by a user retry, or a record deleted server-side) blocks every later
   write indefinitely, re-toasting "check your connection" on each reconnect (F-45).
2. **No account scoping** (A-02) — a cross-account data path on a shared browser.
3. **Failure copy contradicts the queue's purpose**: `tryRemoteOrEnqueue` enqueues *and rethrows*, so a
   queued write presents as a hard save failure, inviting the retry that creates the duplicate that then
   wedges the queue.
4. **Only two domains participate.** Opportunities and Content OS queue; Weekly Brief, Settings, Chief,
   Capture, Journal and reminders do not. For the three local-only domains that is correct by design; for
   Weekly Brief and Settings it is a documented deferral.

**Trace of the intended path** — recoverable failure → `enqueueOfflineWrite` → topbar "Pending sync" →
reconnect or manual retry → `drainOfflineQueue` replays FIFO with `skipQueue` → success removes the entry
by id (re-reading the queue first, so other tabs' changes are respected) → failure bumps `attempts` and
stops. Every step exists; the missing piece is the terminal state.

---

## 19. Server / Serverless

The adapter architecture is genuinely clean and is a portfolio strength. One transport-agnostic core
(`server/chiefOfStaffProxyCore.js`, 357 lines) implements method gating, token auth, rate limiting, body
normalisation, the upstream call with a 10s abort, and an error taxonomy carrying `request_id` and
`correlation_id`. Both adapters are thin shims — `api/chief-of-staff.js` is 11 lines,
`netlify/functions/chief-of-staff.js` is 17 — so **function-level behavior parity is by construction**:
methods, status codes and error shapes cannot drift between platforms.

Where drift genuinely exists is the **deployment envelope**, not the function:

| ID | Pri | Confidence | Class | Finding | Evidence | Remediation |
| --- | --- | --- | --- | --- | --- | --- |
| F-80 | P2 | HIGH | DEFECT | **There is no `vercel.json`.** `netlify.toml` carries CSP, HSTS, `frame-ancestors`, the SPA fallback, and the `/api/chief-of-staff` function route; a Vercel deployment — for which the `api/` directory exists — ships with none of those headers | Verified: no `vercel.json` anywhere in the repository | Add a `vercel.json` mirroring the Netlify headers, or document Netlify as the only supported target |
| F-81 | P2 | HIGH | DEFECT | **Netlify has no `/api/app-error-telemetry` redirect**, so the telemetry path `.env.example` suggests silently returns `index.html` with HTTP 200 on Netlify | `netlify.toml` maps only the chief-of-staff function | Add the redirect; document the per-platform endpoint value |
| F-82 | P2 | HIGH | DEFECT | **Rate limiting is best-effort.** The limiter keys on client-influenceable headers (`x-forwarded-for` first element, `x-real-ip`), lives in per-instance memory that resets on cold start and is not shared across concurrent lambdas, and no `max_output_tokens` is set upstream | Netlify documents XFF as spoofable | Treat as advisory; add a hard spend ceiling and output cap; document the limitation |
| F-83 | P3 | HIGH | DEFECT | An upstream 2xx carrying invalid JSON returns **HTTP 200 with an error object** instead of 502; unknown `actionKey`s are silently coerced to `summarize` | — | Map upstream parse failures to 502; reject unknown action keys explicitly |
| F-84 | P3 | HIGH | DOCUMENTATION DRIFT | No local dev path for the proxy and no CORS support, so the documented "host the proxy elsewhere" override cannot work cross-origin from a browser | No `server.proxy` in `vite.config.js`, no vercel/netlify dev script | Add a dev proxy or a documented `netlify dev` flow; add CORS if the override is meant to be real |
| F-85 | P3 | HIGH | TECHNICAL DEBT | Token comparison is not constant-time and the 401 path bypasses the rate limiter | — | Use `timingSafeEqual` (the telemetry core already does) and rate-limit failures |
| F-86 | P3 | HIGH | TECHNICAL DEBT | The core's 400/500 validation branches and the success-path structured-payload attachment are untested; adapter tests mock the core and prove pass-through shape only | — | Add branch coverage for validation and the success path |

---

## 20. AI Security + Reliability

**What is correctly handled.** The OpenAI key never reaches the browser — the client only ever knows a proxy
URL. The CSP in `netlify.toml` deliberately omits `api.openai.com` from `connect-src`, with an inline
comment explaining why, so the browser cannot talk to OpenAI directly even if code tried. Untrusted model
output is normalised defensively on both sides with item and length caps, and a malformed upstream response
cannot crash the function (`json().catch`, throw-safe extraction). The deterministic fallback is
client-side and **honestly labelled** with its reason and error code — failure is visible, not hidden.
Notes are capped at 12k characters by a shared constant enforced in the UI, so server-side truncation is
unreachable in the shipped client.

**What is not.**

- **F-03 (§13)** — the authentication dead-end, which forces either a disabled feature or an open proxy.
- **F-58 (§13)** — no in-product disclosure that Generate transmits notes off-device, while nearby copy
  says the workspace is device-local. This is the audit's clearest **privacy-communication** gap.
- **Prompt injection.** User notes are embedded into the system/user messages with no hardening, and the
  model's output is parsed into structured items that the user can accept into their own workspace. The
  realistic risk is low — the attacker would be the user pasting their own notes, and accepted items are
  plain records rather than executed instructions — so this is classified **THEORETICAL ONLY** rather than
  a vulnerability. It is worth a defensive note in the system prompt, not a redesign.
- **Cost control.** With the only working configuration being an open proxy, spend protection rests on a
  spoofable, per-instance rate limiter (F-82).

---

## 21. Telemetry / Ops

### 21.1 What exists

A complete error-telemetry pipeline: a browser emitter with real PII scrubbing, a shared serverless ingest
core behind thin Vercel and Netlify adapters, HMAC current/next/legacy rotation windows, an Ed25519
asymmetric path fed by env JSON or a KMS keyset URL or provider-native AWS/GCP/Azure adapters, Supabase
persistence with content-hash idempotency and a bounded retention prune, a key-verification audit table, a
scheduled ops workflow, and a meta-gated Ops Reliability page.

Engineering quality *within* each file is high, and several parts deserve preservation: timing-safe HMAC
comparison with a length pre-check; fail-closed 503 on key-window misconfiguration rather than accepting
unsigned traffic; and content-hash idempotency backed by a DB unique constraint with 409-mapped-to-success,
which is the one part proven against a **real** Supabase instance by the integration test.

### 21.2 Proportionality verdict — **DEFENSIBLE BUT OVERBUILT**, shading to **PORTFOLIO-ONLY**

This is the mandated classification, and it is the repository's own conclusion too
(`KNOWN_LIMITATIONS.md:14,28-31`; `CONFIGURATION.md:42-46`; three prior audits), with a committed plan to
quarantine the stack behind `experimental/telemetry/` while keeping a thin HMAC ingest. Because the docs
frame it honestly, **the overbuild is an INTENTIONAL BOUNDARY, not a defect.** What the audit adds is that
the quarantine keeps slipping, and until it happens roughly 2,900 lines of server and script code must stay
green for a capability the product does not need — the definition of maintenance risk.

The sharper observation is that the subsystem's strongest parts **cannot be used together**:

| ID | Pri | Confidence | Class | Finding | Evidence |
| --- | --- | --- | --- | --- | --- |
| T-01 | P2 | CONFIRMED | ARCHITECTURAL RISK | **The asymmetric/KMS path has no browser producer and cannot be enabled without breaking the app's own telemetry.** The only client signer is WebCrypto HMAC-SHA256; there is no client Ed25519 signing. The verifier *prefers* the asymmetric path whenever any asymmetric source is configured, and that path 401s without a key-id header and accepts only `ed25519`. The three cloud KMS SDKs are **not in `package.json`** (verified), so the provider-native adapters can only throw | Enabling the sophisticated path disables ingest |
| T-02 | P2 | CONFIRMED | DEFECT (security) | **No freshness or rate limiting on ingest.** Signatures cover the raw body only; `sentAt` is parsed but never checked against a freshness window; there is no nonce and no rate limit on the ingest path, so a captured request can be replayed indefinitely | *Corrected during verification:* an earlier draft claimed a replay could defeat dedup by varying the unsigned `x-app-telemetry-idempotency-key` header. That is **wrong for the shipped client** — it embeds `idempotencyKey` inside the signed body (`appErrorTelemetry.js:254-262`) and the server prefers the body value over the header (`resolveIdempotencyKey`, ingest core :680-681), so an identical replay dedupes to 409-as-success. The residual exposure is unbounded request volume and log noise, not forged or duplicated rows; the unsigned header path only matters for a producer that omits the body key |
| T-03 | P2 | CONFIRMED | DEFECT | **The client remote queue drains only when a future error occurs** — no startup, `online`-event, or interval trigger — and never drops permanently rejected batches (400/401 are treated like transient 503s) | A misconfigured token wedges the queue silently |
| T-04 | P3 | CONFIRMED | DEFECT | The Vercel adapter verifies signatures over **re-serialised JSON** rather than raw request bytes | Any key-order or whitespace difference breaks verification |
| T-05 | P3 | CONFIRMED | DEFECT | The Ops Reliability local fallback renders four fabricated April-2026 snapshots under workspace-source copy | The one surface reporting system health can present sample data as real |
| T-06 | P3 | NEEDS RUNTIME | ARCHITECTURAL RISK | CI writes ops rows to `SUPABASE_TEST_*` while the UI reads the app's runtime project — so whether any deployment ever shows real data is unverified | — |
| T-07 | P3 | HIGH | ARCHITECTURAL RISK | Post-response pruning and timeout-less Supabase fetches in a serverless context make retention and latency unreliable | — |
| T-08 | P3 | HIGH | DEFECT | The incident-lifecycle read-then-insert race can double-fire notifications on concurrent runs | — |

**Client-side secret exposure (verified).** `VITE_APP_ERROR_TELEMETRY_TOKEN` and
`VITE_APP_ERROR_TELEMETRY_HMAC_SECRET` are read via `import.meta.env` (`appErrorTelemetry.js:120,124`) and
are therefore **inlined into the public bundle**. Anyone can read them and forge telemetry. Severity is
contained — the tables are service-role-only and hold scrubbed error data, so the impact is pollution
rather than disclosure — and the README caveats the HMAC one as "trusted/internal deployments only"
(though not the token). Classified **SECURITY WEAKNESS**, not a vulnerability.

### 21.3 Is the operational data real?

Per §2.3: the daily `Scheduled Ops Alerts` workflow **has never run on its schedule**, and the weekly
baseline refresh has failed every time. The Ops Reliability page is correctly hidden behind `?meta=1` and
degrades honestly on load errors, but between the never-run collector and the fabricated local fallback,
**no evidence was found that this surface has ever displayed real production telemetry.** It should be
described as portfolio evidence of operational thinking — which the docs mostly already do — and never as a
staffed production operations capability.

---

## 22. Security + Privacy

### 22.1 Security findings by area

| Area | Concern | Classification | Note |
| --- | --- | --- | --- |
| Supabase | Tenant isolation on all user tables | **Not vulnerable** | RLS with `using` + `with check` verified on all seven tables (§17.1) |
| Supabase | Parent–child ownership consistency | DEFENSE-IN-DEPTH (F-77) | Child rows validate their own `user_id`, not the parent's |
| Supabase | Ops tables readable by anon / any authenticated user | THEORETICAL ONLY (F-79) | Deliberate; operational metrics, not user data |
| Chief proxy | Endpoint unauthenticated in its only working configuration | **SECURITY WEAKNESS** (F-03) | Cost-abuse exposure, not data exposure |
| Chief proxy | Spoofable, per-instance rate limiting; no output cap | SECURITY WEAKNESS (F-82) | Compounds F-03 |
| Chief proxy | Non-constant-time token compare; unthrottled 401 path | DEFENSE-IN-DEPTH (F-85) | Low practical risk |
| Chief proxy | Prompt injection via user notes | THEORETICAL ONLY | Attacker is the user; output becomes records, not instructions |
| Telemetry | Client token and HMAC secret inlined into the public bundle | SECURITY WEAKNESS | Forgeable telemetry; scrubbed payloads; service-role tables |
| Telemetry | No replay protection, no freshness window, no rate limit | SECURITY WEAKNESS (T-02) | Re-persistable captured requests |
| Client | Secrets in client code | **Not vulnerable** | No API keys; the two `VITE_` telemetry values are the only secret-shaped ones, and are documented as such |
| Client | Dangerous HTML / unsafe URLs | **Not vulnerable** | No `dangerouslySetInnerHTML` in the tree |
| Deployment | CSP/HSTS present on Netlify; absent on Vercel | SECURITY WEAKNESS (F-80) | Envelope drift, not a code defect |
| Cross-account | Offline queue replays A's writes into B's account | **LIKELY VULNERABILITY** (A-02) | Requires a shared browser and account switching; RLS is not bypassed, but A's content lands in B's workspace |

**No CONFIRMED VULNERABILITY was found**, and no P0. The single most consequential security-adjacent item is
F-03, because it forces a choice between a disabled feature and an open endpoint.

### 22.2 Privacy: what actually leaves the browser

| Data | Stays local | Reaches Supabase | Reaches the AI provider | Reaches telemetry | Copy accurate? |
| --- | --- | --- | --- | --- | --- |
| Journal entries | ✅ always | ❌ never | ❌ never | ❌ never | ✅ "Private to this device — never synced" is **true** |
| Capture notes | ✅ unless promoted | only via promotion | ❌ | ❌ | ✅ "Stays on this device. Promote a note when you want it in your synced workspace" |
| Reminders | ✅ always | ❌ never | ❌ | ❌ | ❌ **No local-only notice**, on a page that can say "Workspace sync is active" (F-08) |
| Opportunities / Content | ❌ when signed in | ✅ | only if pasted into Chief | ❌ | ✅ |
| Weekly Brief | ❌ when signed in | ✅ | ❌ | ❌ | ✅ |
| **Chief of Staff notes** | local copy kept | ✅ `chief_sessions` | ✅ **every Generate** | ❌ (only `notesLength`) | ❌ **No disclosure of the off-device transmission** (F-58) |
| Error telemetry | ring buffer | ✅ service-role tables | ❌ | ✅ | scrubbing verified in code |
| Local backup export | user-initiated download | ❌ | ❌ | ❌ | ✅ |

Journal heaviness reaches Focus Home as a **presence-only boolean** (`feelsHeavy` set and `oneNextThing`
empty) rather than as text — a genuinely thoughtful privacy decision worth preserving. Telemetry sends
`notesLength`, never note content.

The two privacy gaps are both **communication** gaps rather than data leaks: reminders are silently
device-local on a page advertising sync, and Chief notes are silently transmitted off-device on a page
advertising local storage. Both are one calm sentence away from being accurate.

---

## 23. Accessibility

**What is proven at runtime.** The axe sweep passes on all nine primary routes (`wcag2a`, `wcag2aa`,
`best-practice`) with no serious or critical violations, at HEAD, in this audit's own run. Keyboard-only
row selection and modal open/close are proven by Playwright for Opportunities and Content OS, and Focus
Home's keyboard mode switching and reversible reminder completion are proven too. That is real, and more
than most portfolio projects can show.

**What that does not establish.** Automated scanning covers roughly a third of WCAG success criteria and
none of the behavioral ones. This audit therefore makes **no claim of WCAG conformance**. Four specific
gaps sit outside what the sweep can see:

1. **The sweep never runs at a mobile viewport.** `playwright.config.js` sets no viewport, so every axe
   scan runs at the desktop default. The compact navigation state — which only exists below 860px — is
   never scanned, and that is precisely where S-01 lives.
2. **The two auth routes are excluded entirely** (A-05). They render outside the shell and appear in no
   spec, so `/sign-in` and `/auth/callback` have neither automated nor manual accessibility evidence.
3. **Announcement behavior is unverified everywhere.** Several live regions mount together with their
   content (toast, page loading, save pill, the Suspense fallback), a pattern known to be announced
   unreliably by some screen-reader and browser pairings.
4. **Only serious and critical violations fail CI**; moderate and minor findings are reported to output and
   ignored. That is a defensible threshold, but it means the gate is narrower than "axe passes" suggests.

5. **The sweep only ever runs in the dark theme.** No spec sets `data-theme="light"`, so the entire light
   palette — a headline closed-audit item — has never been scanned by axe. That matters, because of the
   next finding.

### 23.1 Light-theme contrast falls below AA, and the regression test validates a different pair

```text
ID:                    G-01
Priority:              P2
Confidence:            CONFIRMED (arithmetic); NEEDS RUNTIME VERIFICATION (which token renders where)
Classification:        DEFECT
Area:                  Design system / accessibility
File(s):               src/styles/tokens.css:212-216 (light overlay)
                       src/styles/system.css (light overlay overriding the button color)
                       src/styles/tokens.contrast.test.js:272-274
```

**Evidence.** Computed directly from the token values. In the light theme `--accent` is `#1f7fc6` and
`--bg` is `#f3f6fb`:

```text
contrast(#1f7fc6, #f3f6fb) = 3.95 : 1     WCAG AA small text requires 4.5 : 1
contrast(#15243a, #f3f6fb) = 14.41 : 1    (body text — healthy)
```

`--accent` is the rendered color of light-theme action buttons and focus chips, because the light overlay
in `system.css` overrides the token the regression test actually checks. The test asserts
`--accent-soft-strong` against `--bg-accent-subtle` (`tokens.contrast.test.js:273-274`) — a **different
pair** from the one the cascade produces. The same inspection found the light "Scheduled" pill at 3.43:1,
`--warning` at 3.73:1 and `--success` at 3.99:1 in small-text roles, and the light focus ring compositing to
roughly 2.2:1 against the page, under the 3:1 non-text minimum (the dark ring is 7.6:1).

**Why it slipped through.** Two safety nets both miss it in the same way: axe never runs in light theme,
and the contrast test validates a token pair that the light cascade replaces. This is the **same failure
shape as F-01** — a check that encodes an assumption rather than measuring the real artifact.

**Why it matters.** The light theme is a documented closed audit item ("two working themes from one token
system"). Sub-AA text on the primary action color, plus a focus ring below the non-text minimum, means the
claim does not fully hold in the rendered cascade.

**Recommended remediation.** Darken the light-theme `--accent` (and the warning/success/scheduled
small-text roles) until they clear 4.5:1 on `--bg`, strengthen the light focus ring past 3:1, and — most
importantly — change the regression test to assert the token pairs that **actually render**, then add a
light-theme pass to the axe sweep so both nets close.

**Scope:** S · **Manual QA:** MQ-THM-01, MQ-THM-03 · **Historical:** D — new.

**Other design-system findings** (all P3 unless noted): shared form primitives are styled by `forms.css`,
which only five surfaces import by convention, so a new consumer silently renders unstyled; dead assets and
orphaned shell CSS (an unused Bluesky icon sheet in `public/icons.svg`, `.topbar__action`, and two other
orphaned classes); the breakpoint ladder has drifted to ten distinct max-widths with single-use outliers;
`theme-color` meta values no longer match `--bg` and `--font-mono` declares a never-loaded IBM Plex face;
`Badge` exposes `ariaLabel` on a role-less `<span>`, which assistive technology is not required to honour;
the desktop sidebar is not sticky, so it scrolls out of view on long pages; and mobile-Safari hazards
(`100vh` in modal sizing, `background-attachment: fixed`, broad `backdrop-filter`) need device verification.

**Accessibility findings** are recorded with their home surfaces rather than duplicated here: S-01
(focusable hidden nav links — the one likely serious violation found), F-13 ("ADHD support layer"
landmark), F-18 (ambiguous sticky-note action names and label-in-name mismatches), F-25 (button nested
inside a label), F-26 (three live regions announcing at once), F-49 (`display: grid` on table rows possibly
stripping table semantics), F-95 (invisible focusable file input), plus the touch-target items F-21 and
F-28. Notably, the app's own 44px coarse-pointer discipline is applied in most places and missed in
exactly two.

**Genuine accessibility strengths worth preserving:** the skip link with `main tabIndex={-1}` refocused on
every route change; the drawer's `aria-expanded`/`aria-controls` disclosure with Escape-close and focus
restoration to the toggle; the deliberate politeness split between the corruption banner (`role="status"`)
and the quota banner (`role="alert"`), with a test that asserts *why*; the global
`prefers-reduced-motion` kill switch; and the design-token contrast regression test.

---

## 24. Responsive / Manual Verification Status

Static review confirms a coherent breakpoint system — 1100px, 980px, 860px (sidebar → drawer), 700px,
640px, and coarse-pointer rules — with `min-width: 0` discipline through the shell grid so wide content
cannot force horizontal page scroll. Two runtime data points exist: the mobile-navigation spec proves the
drawer closes on route change and history return, and the ops-reliability spec proves single-column
stacking without horizontal scroll.

Everything else about rendered layout is **NEEDS RUNTIME VERIFICATION** and is enumerated in
`CEO-OS-MANUAL-QA.md` §13. The specific static-only concerns are: the 30rem drawer cap against nine links
plus four group labels (S-10), the half-width Reminders panel at desktop (F-16), dense-table degradation on
Opportunities and Content OS, modal fit at 390×844, and the two sub-44px touch targets.

---

## 25. Performance

**Measured at HEAD.** The production build completes in 408 ms. Route chunks are small and genuinely
split: Dashboard 24.90 kB raw / 7.84 gzip, ChiefOfStaff 51.52 / 15.52, Settings 20.01 / 6.53, WeeklyBrief
17.17 / 5.25, ContentOS 13.16 / 4.45, Opportunities 10.29 / 3.44. Vendor chunking is explicit and
deliberate (`vite.config.js` with a comment explaining why): `vendor-react` 189.63 kB, `vendor-supabase`
187.35 kB, `vendor-router` 41.38 kB. Every route is lazy, and `useRoutePrefetch` warms the three likely-next
chunks at idle with data-saver and slow-connection opt-outs. All eleven tracked assets pass their **static**
budgets.

**Notable:** `vendor-supabase` at 187 kB is loaded for every user including the majority who never sign in.
Given the local-first thesis, deferring the Supabase client behind the first authenticated action would be
the single largest bundle win available. That is a suggestion, not a finding.

**Runtime performance issues found in code** (all with home surfaces): per-keystroke full-array
serialisation on the Capture wall (F-04); per-keystroke SELECT + UPDATE round-trips for Chief notes in
Supabase mode (F-57); a full `localStorage` health scan on every render of the Settings Workspace Data
section, including every keystroke in the name field (F-96); five independent settings loads and four
subscription sets per shell mount, which in Supabase mode means five duplicate remote fetches on start and
again on every settings event (S-06); and an O(table) duplicate-check read per Supabase create (F-46).

### 25.1 The route-budget system itself

This is the part the brief asks to evaluate as governance, not arithmetic — and governance is where it
fails.

**What the system does well.** Per-asset raw and gzip budgets; a separate trend gate at +8% against a
committed baseline; a report artifact published per PR and commented onto the PR; and a genuinely
thoughtful refresh guard — `update-route-performance-baseline.mjs` requires `--release`,
`ROUTE_BASELINE_REFRESH_APPROVED=true`, **and** an approved event type, so a developer cannot casually
regenerate the baseline locally to hide a regression. That last control is better than most teams manage.

**Where it breaks.**

| ID | Pri | Confidence | Class | Finding |
| --- | --- | --- | --- | --- |
| C-01 | P2 | CONFIRMED | ARCHITECTURAL RISK | **The trend gate is red at HEAD** (verified, exit 1) because the baseline is frozen at 2026-05-18 — and it is frozen because **all 14 runs** of the refresh workflow have failed (§2.3). The governance loop is closed on paper and open in practice |
| C-02 | P3 | CONFIRMED | ARCHITECTURAL RISK | **The static ceilings and the baseline can both be raised inside the very PR that regresses them.** The `--release` guard protects the *scripted* refresh, but nothing prevents editing `route-performance-baseline.json` or the budget constants by hand in a feature PR, and no CODEOWNERS or review rule covers those files |
| C-03 | P3 | CONFIRMED | ARCHITECTURAL RISK | The weekly auto-refresh, when it worked, would absorb up to 8% growth per week into the baseline — the workflow comment honestly calls this "drift bounded by a week", but it means slow sustained growth is invisible to the gate by design |

So the answer to *"could someone raise the baseline to hide a regression?"* is: **not through the script,
but trivially by hand in the same PR** — and right now the question is moot, because the gate is red and
unenforced anyway.

---

## 26. React / JavaScript Architecture

**Composition is genuinely good.** Pages orchestrate and delegate; presentational components are
co-located per feature; decision logic lives in pure, unit-tested modules (`focusHomeLogic`,
`suggestions`, `weeklyBriefEditor`, `contentFormatting`); repositories share one contract; and the shared
subscription concern is properly extracted into `useSilentRefresh` with module-scope constant event arrays
so listener identity stays stable across renders — with tests that assert exactly that. Reference-stability
guards (`shallowEqualRecordArrays`) keep derived memos from invalidating on tab switches. Error boundaries
exist at three levels. Race conditions are handled with request-id guards and `useIsMountedRef` in the
places that need them, and those guards are tested.

**The one recurring anti-pattern** is persistence launched from inside `setState` updater callbacks — in
`useWeeklyBrief` (F-30) and in the chief hooks (F-64). React updaters must be pure; with `StrictMode` on,
they are double-invoked in development, which is exactly why the weekly path can double-write. This is
already documented as a deferred item with a written plan, so it is correctly classified as an
**INTENTIONAL BOUNDARY that has stayed open too long** rather than an unrecognised defect. Journal
demonstrates the correct pattern (a ref-based current-value tracker) in the same repository, which makes
the fix a port rather than a design exercise.

**Cross-cutting observations.** `usePersistentState` writing on mount is the root of two separate symptoms
(S-07 and F-73). The five-independent-settings-loads pattern in the shell (S-06) is the clearest case for a
small context provider. And the event architecture is coherent but asymmetric: `useSilentRefresh` supports
storage-key subscriptions, four hooks use them, and `useCrudPage` — the one shared by both CRUD pages —
does not, which is the entire content of F-41.

### 26.1 JavaScript and type safety

The JS-with-`tsc --noEmit` posture is deliberate, documented, and defended in `ARCHITECTURE.md` with a
staged migration plan (`lib/` → `hooks/` → `components/` → `pages/`). The *plan* is sound. The *enforcement
it claims* is not.

### J-01 — The typecheck gate verifies essentially nothing

```text
ID:                    J-01
Priority:              P2
Confidence:            CONFIRMED (measured)
Classification:        DOCUMENTATION DRIFT
Area:                  Type safety / quality gates
File(s):               jsconfig.json · docs/ARCHITECTURE.md:38 · package.json (typecheck script)
```

**Evidence — measured, not inferred.** `jsconfig.json` sets `"checkJs": false` and `"strict": false`.
With `checkJs` off, TypeScript parses `.js`/`.jsx` files but does not report type errors in them — and the
include set contains **zero** `.ts`/`.tsx` files (verified). A repository-wide grep for `@param`,
`@returns` and `@typedef` returns **zero files**, so there is also no JSDoc to power inference.

Run as configured, the gate passes trivially:

```text
npx tsc -p jsconfig.json --noEmit              → exit 0, no diagnostics
npx tsc -p jsconfig.json --noEmit --checkJs    → 608 errors
                                                  387 in test files (mostly vitest mock patterns — noise)
                                                  221 in production files
```

Production hot spots include `src/lib/focusHomeLogic.js` (22 — e.g. `Property 'priorities' does not exist
on type '{}'`), `Icon.jsx` (35), `CrudPageTemplate.jsx` (14), `AppLayout.jsx` (11). Error classes are
dominated by TS2339 (property does not exist, 67), TS2741/TS2739 (missing properties, 84) and TS2322
(type not assignable, 39).

**Problem.** `ARCHITECTURE.md:38` states: *"The current `jsconfig.json` already runs
`tsc -p jsconfig.json --noEmit` in CI, so structural type errors that JSDoc + ambient type packages can
catch are caught."* Both halves fail: `checkJs: false` means JS type errors are not reported at all, and
there is no JSDoc anywhere for the mechanism to use. The command runs in **two** CI workflows on every PR
and verifies little beyond what lint and build already cover.

**Why it matters.** This is not an argument for TypeScript — the JS choice remains defensible. It is that
the repository claims a safety net it does not have, in the same document that justifies not having
TypeScript. A reviewer who checks `jsconfig.json` finds the claim contradicted in eight lines. It also
explains why F-01's type-identity confusion survived: nothing was ever checking.

**Recommended remediation.** Either make the claim true — turn on `checkJs`, fix or `// @ts-nocheck` the
test-file noise, and work down the 221 production diagnostics (many are genuine latent bugs; the
`focusHomeLogic` ones point at exactly the untyped shapes F-02 exploits) — or correct
`ARCHITECTURE.md:38` to say the gate currently checks syntax only and that real checking arrives with the
staged migration. The honest short-term move is the documentation fix plus enabling `checkJs` on `shared/`
and `src/lib/` first.

**Scope:** S (docs) / M (enable and clear `lib/`) · **Historical:** D — new.

### 26.2 Where types would actually pay

The audit **validates the documented migration ordering** and can now ground it in evidence rather than
principle.

The two most expensive defects found — F-01 and F-02 — are both `lib/` defects, and both are *exactly* the
kind types help with:

- **F-01** is a type-identity failure: `updatedAt` is sometimes an epoch-millisecond `number`, sometimes an
  ISO `string` from Postgres, and the code converts between them lossily. A branded type
  (`type IsoTimestamp = string & { __brand: 'iso' }` versus `type EpochMs = number`) would have made
  `expectedUpdatedAtToIso(readUpdatedAtMs(row))` visibly suspicious at the boundary.
- **F-02** is a nullable-flow failure: `parsed ?? getFallbackCollection(type)` silently substitutes demo
  data for "no data", a distinction a discriminated return type would force the caller to handle.

Other type-preventable classes visible in the code: Supabase row shapes versus client models (the
snake/camel mapping is hand-rolled per repository); AI response payloads (validated at runtime by valibot,
which is genuinely a reasonable substitute here); and date parsing, where `Date.parse` returning `NaN` is
silently coerced to `0` in `readUpdatedAtMs`.

**Recommendation — confirming the documented plan with a sharper starting point.** Begin with the
persistence boundary, but start with the *timestamp and identity* modules specifically —
`staleRecordError.js`, `recordIdentity.js`, `dataSchema.js`, `versionedStorage.js` — rather than `lib/`
alphabetically. That is a handful of small, heavily-imported files whose types propagate outward through
inference, and it is where the audit's two most serious defects live. Do not convert everything; convert
the boundary that carries the invariants.

---

## 27. Tests

### 27.1 Inventory

| Category | Files | Notes |
| --- | --- | --- |
| Library / logic | 47 | Decision logic, repositories, schemas, storage, utilities |
| Hooks | 29 | Including race, listener-stability and unmount-safety tests |
| Components | 39 | Including 2 snapshot suites and 2 page-integration suites |
| Pages | 8 | Including a jsdom route-accessibility sweep |
| Layout | 1 | Shell boundary and retry behavior |
| Design tokens | 1 | `tokens.contrast.test.js` — contrast regression at the CSS-token level |
| Server cores | 10 | Proxy, ingest, key provider, KMS adapters, audit, incident lifecycle |
| Serverless adapters | 4 | Vercel + Netlify pass-through shape |
| **Vitest total** | **138 files / 823 tests** | 823 passing, 1 skipped at HEAD |
| Playwright | 10 specs / 31 tests | 9 axe sweeps, 9 direct-load smokes, 6 CRUD, 7 single-flow |
| Integration (external) | 1 | Telemetry ingest against real Supabase — **secret-gated, skipped here** |

### 27.2 Critical-workflow coverage matrix

| Workflow | Unit | Integration | E2E | A11y | Manual only |
| --- | --- | --- | --- | --- | --- |
| Focus recommendation | ✅ strong | ✅ page-level | ⚠️ mode switch + reminders only | ✅ route scan | ranking quality |
| Capture persistence | ✅ | ✅ | ✅ reload persistence | ✅ | typing behavior (F-04) |
| Journal autosave | ✅ fake timers | ❌ | ❌ | ✅ | ✅ loss windows |
| Opportunity stale save | ✅ | ✅ mocked repo | ❌ | ✅ | ✅ **real backend unproven** |
| Offline replay | ✅ ×4 | ✅ | ❌ | n/a | ✅ browser offline never simulated |
| Chief generation | ✅ + server | ✅ adapters | ❌ never generates in e2e | ✅ | ✅ |
| Chief fallback | ✅ | ✅ | ❌ | ✅ | ✅ |
| Chief acceptance | ✅ | ✅ | ❌ | ✅ | ✅ |
| Supabase auth | ❌ **none** | ❌ | ❌ | ❌ excluded | ✅ everything |
| Backup import | ✅ | ❌ | ❌ | ✅ | ✅ quota path |

### 27.3 Test quality

Sampled substantively: `useCrudPage`, the three offline-queue suites, `chiefOfStaffProxyCore`,
`ContentCrudPage.integration`, `weeklyRepositorySupabase`, the ingest integration test, `App`, `Journal`,
and `useWorkspaceBackup`. The suite is **behavior-focused with little copy-assertion or implementation
coupling** — better than typical. Exemplary cases: the fail-closed proxy tests, the duplicate-submission
guard, and the explicit test that a *non*-stale error must **not** trigger a refetch (asserting a negative
is a sign of genuine care).

**The most dangerous untested behavior — and it is not a coverage gap but a false positive:**

> Every Supabase repository test keys its hand-rolled stub by the client's own millisecond-ISO string
> (`weeklyRepositorySupabase.test.js:185-207`, `opportunitiesRepositorySupabase.test.js:116`). The mock and
> the code share the same wrong assumption about timestamp precision, so the suite is green **because** of
> the bug, not despite it. This is the class of test that actively conceals a defect (F-01).

Two smaller quality notes: the blank-mode weekly test passes for the wrong reason (F-02), and the page/hook
tests for the item-ordering bug mock opposite layers, so neither sees the mismatch (F-35). All three share
a root cause — **mocks that encode the implementation's assumptions rather than the dependency's real
contract**.

| ID | Pri | Confidence | Class | Finding |
| --- | --- | --- | --- | --- |
| C-04 | P2 | CONFIRMED | PORTFOLIO GAP | **Cloud and auth behavior is untested at every level**, and the Supabase stubs structurally cannot catch the precision inversion. `useAuthSession`, `SignIn` and `AuthCallback` have no tests at all |
| C-05 | P3 | CONFIRMED | PORTFOLIO GAP | The e2e suite never exercises AI generation, offline replay, journal autosave, weekly-brief editing, or any authenticated flow |

---

## 28. CI/CD + Deployment

### 28.1 The pipeline as configured

```text
PR ──► CI (ci.yml)                 markdownlint · lint · build · test · typecheck        → GREEN
   └─► PR Test Suite (ci-tests.yml)  lint · build · route budgets (static) ·
                                     route budgets (trend) · CRUD guard · unit ·
                                     telemetry integration (secret-gated) ·
                                     typecheck · Playwright e2e · artifacts       → RED (30/30 runs)
main ──► CI                                                                        → GREEN
      └─► deployment (Netlify; no vercel.json)
weekly ─► Release Route Baseline Refresh                                → FAILED 14/14 runs
daily ──► Scheduled Ops Alerts                                          → NEVER RAN
manual ─► Enforce Branch Protection                                     → CANNOT WORK AS SHIPPED
```

### 28.2 Findings

| ID | Pri | Confidence | Class | Finding | Evidence |
| --- | --- | --- | --- | --- | --- |
| C-06 | P2 | CONFIRMED | DEFECT | **Branch protection is neither appliable nor active.** Verified three ways: (1) `branch-protection.yml:17` requests `administration: write`, which is not a valid `GITHUB_TOKEN` permission scope; (2) a `GITHUB_TOKEN` can never hold repository-administration rights at all, which the `PUT .../branches/{branch}/protection` call requires — `configure-branch-protection.mjs:104-108` warns about this itself; (3) **the live API reports `main` at `177ade3f` as `protected: false`** | The README instructs keeping the required check set to `Unit + E2E`; that is demonstrably not in force, and five PRs merged while it was red. *Priority note:* proposed as P1 and **downgraded to P2** in verification — a governance and docs-truthfulness gap with no auth, persistence or user-data impact, and the script's own payload sets `enforce_admins: false`, so a solo maintainer would remain unbound even with protection on |
| **C-07** | **P1** | CONFIRMED | DEFECT | **The strict gate has never executed a single step — the workflow file is invalid.** `ci-tests.yml:56` uses `secrets` inside a **step-level `if:`**, a context GitHub Actions does not make available to step conditionals, so the run fails at parse time. Measured signature on every run inspected (including all 11 on this audit's own branch): conclusion `failure`, **zero jobs created, zero seconds elapsed**. `git log` shows the file was introduced in `6faa2da` (2026-04-22) with that line and **has never been edited since** | The two locally-reproduced failures (F-50 selectors, C-01 trend gate) are real defects that *would* fail this gate — but they are **not** why CI is red. Nothing in this workflow has ever run |
| C-08 | P2 | CONFIRMED | DEFECT | **The daily ops loop is doubly inoperative**: it has never fired on schedule (zero `event=schedule` runs), and it would fail if it did, because it runs `npm run check:route-budgets:trend` with **no `npm run build`** beforehand — verified: `scheduled-ops-alerts.yml:35` has no build step, while the budget script reads `dist/` | — |
| C-09 | P2 | CONFIRMED | DEFECT | **Netlify silently swallows app-error telemetry.** `netlify.toml` routes only the chief-of-staff function, so `/api/app-error-telemetry` falls into the SPA fallback and returns `index.html` with **HTTP 200** — and the client's delivery check is `Boolean(response?.ok \|\| response?.status === 409)` (`appErrorTelemetry.js:279`), so the batch is marked delivered and dropped. Verified in both files | Silent, total telemetry loss on the documented deployment target |
| C-10 | P3 | CONFIRMED | TECHNICAL DEBT | CI duplicates lint, build, test and typecheck across two workflows on every PR, while `main` never re-runs the full suite | Wasted minutes and a false sense of double coverage |
| C-11 | P3 | CONFIRMED | TECHNICAL DEBT | The CRUD legacy-prop guard hard-fails CI after 2026-09-30 with a coarse regex, though the migration it guards is already closed | A scheduled self-inflicted breakage; retire the guard |
| C-12 | P3 | CONFIRMED | DOCUMENTATION DRIFT | Env documentation gaps: `SUPABASE_URL` is used but undocumented; `VITE_CHIEF_PROXY_DEBUG` and `VITE_SUPABASE_DEBUG` are undocumented (both are `import.meta.env.DEV`-gated, verified, so neither leaks in production) | — |

### 28.3 Environment variable table (abridged to the decision-relevant rows)

| Variable | Client/Server | Required | Documented | Safe to expose | Used |
| --- | --- | --- | --- | --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` | Client | for cloud mode | ✅ | ✅ (anon key is public by design, protected by RLS) | ✅ |
| `VITE_OPENAI_PROXY_URL` | Client | ❌ (defaults to `/api/chief-of-staff`) | ✅ | ✅ | ✅ |
| `VITE_APP_ERROR_TELEMETRY_TOKEN` | Client | ❌ | ✅ | ⚠️ **inlined into the public bundle**; README does not caveat this one | ✅ |
| `VITE_APP_ERROR_TELEMETRY_HMAC_SECRET` | Client | ❌ | ✅ | ⚠️ **inlined**; README does caveat it as trusted-deployments-only | ✅ |
| `VITE_CHIEF_PROXY_DEBUG` / `VITE_SUPABASE_DEBUG` | Client | ❌ | ❌ **undocumented** | ✅ (DEV-gated, verified) | ✅ |
| `OPENAI_API_KEY` | Server | ✅ for live AI | ✅ | server-only ✅ | ✅ |
| `CHIEF_STAFF_PROXY_TOKEN` | Server | docs say "MUST" | ✅ | server-only | ⚠️ **unsatisfiable by the client** (F-03) |
| `CHIEF_STAFF_REQUIRE_TOKEN` | Server | ❌ | ✅ | server-only | ✅ — `'false'` is the only value that makes AI work |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | for durable ingest | ✅ | server-only ✅ | ✅ |
| `SUPABASE_URL` | Server | for durable ingest | ❌ **undocumented** | server-only | ✅ |
| `SUPABASE_TEST_URL` / `SUPABASE_TEST_SERVICE_ROLE_KEY` | CI | for the integration test | ✅ | CI secret | ✅ (absent here → test skipped) |
| ~20 `APP_ERROR_TELEMETRY_*` rotation/KMS variables | Server | ❌ all optional | ✅ thoroughly | server-only | partially — the KMS paths cannot resolve (T-01) |

No secret values were read or reproduced at any point in this audit.

---

## 29. Documentation Accuracy

Documentation accuracy is part of the product for this repository, because honest engineering is its stated
differentiator. The corpus is unusually strong in form — five archived audits, a date-anchored CHANGELOG
with verification evidence, a recruiter-facing limitations ledger — and most architectural claims check out
when tested against code. `docs/CONFIGURATION.md`, `.env.example`, `docs/ARCHITECTURE.md` and
`docs/PRODUCTION_TRUST_CHECKLIST.md` are accurate where verified.

The drift is concentrated in three places, and two of them are **regressions of fixes that previously
landed**.

| ID | Pri | Confidence | Class | Finding |
| --- | --- | --- | --- | --- |
| D-01 | P2 | CONFIRMED | DOCUMENTATION DRIFT | **The README presents provably stale visuals as current proof, and the honesty caveat that once covered this was removed.** All five screenshots and the walkthrough video date from commit `6faa2da` (2026-04-22) and show the pre-Focus-Home purple "Dashboard" UI. README:33 captions one "Focus Home overview" and README:278-284 presents a "Product visuals" proof table. Commit `6499631` had added an "Honest screenshot status" section; commit `fb5c48a` removed it. `KNOWN_LIMITATIONS.md:7` still says the screenshots are out of date — **the README and the limitations ledger now contradict each other** |
| D-02 | P2 | CONFIRMED | DOCUMENTATION DRIFT | **The README re-inlined the env reference that was deliberately split out, and the duplicate has already drifted on a security-relevant detail.** `docs/CONFIGURATION.md` is no longer linked from the README at all, and README:216-218 describes `CHIEF_STAFF_REQUIRE_TOKEN` as though the proxy fails *open* by default, while the code (`chiefOfStaffProxyCore.js:189-196`) and `CONFIGURATION.md:37` both say fail-**closed**. The CHANGELOG still claims the split-out as done |
| D-03 | P2 | CONFIRMED | DOCUMENTATION DRIFT | **`KNOWN_LIMITATIONS.md` contradicts itself and misstates shipped work in both directions.** Listed as deferred but **shipped**: Content OS "Idea" status and publish date (verified in `contentPayloadSchema.js:12-31,60` and the 2026-05-12 migration). Listed as present but **removed**: the "coming soon" digest and keyboard-shortcut toggles (line 103 says they exist; line 26 of the same file says they were removed). Understated: line 121 claims Capture, Journal and reminders still lack envelope discipline — all three have had it since May. Overstated: line 9 claims all three local-only surfaces carry in-product copy saying so; reminders do not (F-08) |
| D-04 | P2 | CONFIRMED | DOCUMENTATION DRIFT | **Enforcement claims that are not operative** (§28): "serious/critical violations fail CI" is true of the sweep but the gate is red and unenforced; "keep the required check set to `Unit + E2E`" describes protection that is not active; the Scheduled Ops Alerts description in README:180-186 details a daily loop that has never run |
| D-05 | P2 | CONFIRMED | PORTFOLIO GAP | **`CASE_STUDY.md` has decayed into an append-only log.** Last substantively touched 2026-05-13; sections run 1→9 then 19,18,…,10 in file order; ~480 of 611 lines are pasted CHANGELOG batches; it omits the strongest recent work (the ten-type output catalogue, the history panel, the architecture-audit closure); and it still instructs proving a behavior — source cues "without implying queued replay" — that the shipped offline queue and Pending-sync pill contradict |
| D-06 | P3 | CONFIRMED | DOCUMENTATION DRIFT | `docs/AI_ROADMAP.md` inventories a five-action pipeline and proposes building "blockers" and "followup" actions that already shipped as `blocker-analysis` and `opportunity-followup`; it is also linked from nothing |
| D-07 | P3 | CONFIRMED | DOCUMENTATION DRIFT | Point-in-time PR-voice documents are presented as living docs: `FINAL_ROADMAP.md` contains a "Current PR Scope Note" naming no PR; `PR_SUMMARY_TEMPLATE.md` is a frozen April summary with 35 hardcoded commit hashes; the two `docs/tracking/` PR summaries contradict each other on export/import when read as current; `RELEASE_CHECKLIST.md` is stamped April 30 and predates the surfaces it should smoke-test |
| D-08 | P3 | CONFIRMED | TECHNICAL DEBT | `docs/git-course/module-01-mental-model.md` is an unrelated, unreferenced Git tutorial that promises a Module 02 which does not exist. A Next.js curriculum is arriving on other branches (PR #46) into this product repository |
| D-09 | P3 | CONFIRMED | PORTFOLIO GAP | No `LICENSE` (default: all rights reserved — reviewers cannot legally run or reuse it), no `CONTRIBUTING.md`, no `CLAUDE.md`/`AGENTS.md`, and **no declared canonical-document hierarchy** — which is the root cause that let D-01, D-02 and D-03 happen: three documents each believed they owned the same fact |

---

## 30. Overengineering Assessment

The brief requires this section to be explicit and to resist praising complexity for its own sake. Each
subsystem is classified against what the product actually needs.

| Subsystem | Verdict | Reasoning |
| --- | --- | --- |
| **Repository pattern across 10 domains** | **NECESSARY** | Two persistence backends and cross-domain promotions demand a seam. It is used, consistent, and tested |
| **Versioned storage envelope + domain guard + corruption preservation** | **NECESSARY** | Solves real failure modes (wrong-key swap, silent JSON loss) that a local-first app genuinely hits. The best engineering in the repository |
| **Migration registry** | **REASONABLE FUTURE-PROOFING** | Small, pure, well-documented, honestly described as empty. Downgraded from "necessary" only because the read path is not actually ready to use it (F-71), and the one real migration performed to date bypassed it |
| **Optimistic concurrency** | **NECESSARY** | Correct instinct for a multi-tab local-first app — and the local implementation works. The cloud implementation is inverted (F-01), which is a defect in execution, not a judgment error |
| **Offline write queue** | **VALUABLE PORTFOLIO SIGNAL** | Genuinely good primitives; but it serves two of ten domains, has no terminal state, and its UX presents queued writes as failures. The concept earns its place; the lifecycle does not yet |
| **Custom event pub/sub + `useSilentRefresh`** | **NECESSARY** | The documented reasoning (no global store to justify, free cross-tab via storage events) holds. `useSilentRefresh` is the right extraction |
| **`CrudPageTemplate` slots abstraction** | **REASONABLE** | Two consumers is thin for an abstraction, but they are genuinely near-identical and the migration is complete and guarded |
| **Slots-migration CI guard + dated tracking ticket** | **OVERENGINEERED** | A bespoke regex-based CI script and a dated deadline ticket to police a two-consumer refactor that is already closed — and which will hard-fail CI after 2026-09-30 (C-11) |
| **Route-budget budgets + trend gate** | **VALUABLE PORTFOLIO SIGNAL** | Real discipline, and the `--release` refresh guard is better than most teams manage — but the loop is not operating (C-01), and the baseline is hand-editable in the regressing PR (C-02) |
| **App-error telemetry ingest (thin: token + HMAC + Supabase + idempotency)** | **DEFENSIBLE** | Proportionate for demonstrating production thinking, and the idempotency design is genuinely good |
| **HMAC rotation windows (current/next/legacy)** | **PREMATURE** | Rotation infrastructure for a single-founder app with one browser producer and no operator |
| **Ed25519 asymmetric path** | **PORTFOLIO-ONLY** | No browser producer exists; enabling it **breaks** ingest (T-01) |
| **Generic KMS keyset URL** | **PORTFOLIO-ONLY** | Same |
| **Provider-native AWS/GCP/Azure KMS adapters** | **SHOULD BE QUARANTINED** | The three SDKs are not in `package.json` (verified), so these paths can only throw. This is scaffolding presented as capability |
| **Key-verification audit table** | **PORTFOLIO-ONLY** | Audit logging for a key system with no operator to audit |
| **Ops incident lifecycle + Slack/PagerDuty fanout** | **HIGH MAINTENANCE RISK** | A full incident state machine whose driving workflow has never executed (§2.3) |
| **Ops Reliability UI** | **DEFENSIBLE BUT OVERBUILT** | Correctly hidden behind `?meta=1` and honest on load errors, but its local fallback fabricates snapshots (T-05) and no evidence exists that it has ever shown real data |
| **Dual Vercel + Netlify adapters** | **REASONABLE** | Thin shims over a shared core is the cheap way to stay portable — but shipping `api/` with **no** `vercel.json` (F-80) means the second target is claimed rather than supported |
| **JS + `tsc --noEmit` staged TS plan** | **NECESSARY / correct judgment** | A defensible, documented trade-off with a real migration plan — and the audit's two worst defects argue for starting it at the persistence boundary (§26.1) |

**The honest summary.** Roughly 2,900 lines of server and script code exist for a telemetry and operations
capability the product does not need, cannot fully enable, and has never run. The repository already knows
this — `KNOWN_LIMITATIONS.md:14` says so plainly and commits to an `experimental/telemetry/` quarantine.
**Because it is documented, the overbuild is an intentional boundary rather than a credibility problem.**
What has become a credibility problem is that the quarantine keeps slipping while the README continues to
describe the ops loop in the present tense.

The important nuance for a reviewer: the overbuild is **not** in the product architecture. Focus Home,
Capture, Journal, Weekly Brief, Opportunities, Content OS, Chief of Staff, the storage layer and the shell
are all proportionate to the problem. The disproportion is confined to one clearly-labelled corner.

---

## 31. Portfolio / Hiring Assessment

### What would impress a senior frontend hiring manager

1. **Product judgment that costs features.** Removing a working numeric momentum score because it nudged
   users toward optimisation — and committing the reasoning next to the code — is the single most senior
   thing in this repository. Most portfolios add; this one subtracts on purpose.
2. **Failure design.** Corruption is preserved and announced rather than swallowed. The AI fallback is
   labelled with its reason. Save failures say the text is retained. This is a person who has operated
   software, not just shipped it.
3. **A real seam.** The repository contract with dual backends, versioned envelopes, domain guards and
   typed stale-record errors is architecture, not file organisation.
4. **Verified accessibility work.** Nine axe route sweeps passing in CI, a skip link, a hand-rolled focus
   trap with restoration, keyboard-only e2e coverage, and a CSS-token contrast regression test. Very few
   portfolio projects have any of this; almost none have the token test.
5. **`shared/` as a true single source of truth** across client and server, so the drift a reviewer would
   look for structurally cannot happen.
6. **Honest documentation as a practice** — `KNOWN_LIMITATIONS.md` is a genuinely unusual artifact, and the
   instinct behind it is the most transferable thing in the repository.

### What would concern the same reviewer

1. **The strict CI gate has been red for three and a half months, with five PRs merged over it.** This is
   the finding most likely to be spotted in sixty seconds — the Actions tab is public — and it is the one
   that most undercuts the "production-minded" framing. **Fixing this is the highest-ROI hour available.**
2. **README screenshots do not match the app**, and the honesty caveat that once covered them was removed.
   A reviewer who runs the app sees a different product.
3. **The flagship AI feature cannot be authenticated as documented** (F-03) — a reviewer who reads
   `CONFIGURATION.md` and then the client code will find this.
4. **The concurrency feature is likely inverted in cloud mode** (F-01). A reviewer who reads
   `staleRecordError.js` alongside the migrations may spot it, and it sits under a headline claim.
5. **Infrastructure disproportionate to the product** — KMS adapters whose SDKs are not installed, an
   incident lifecycle whose workflow has never fired. Documented, but present in the tree.
6. **Unrelated content in the repository** — a Git tutorial in `docs/`, a Next.js curriculum arriving on
   other branches. It reads as an unmaintained scratch space rather than a curated artifact.
7. **No LICENSE**, so a reviewer technically cannot run or reuse it.

### What demonstrates judgment rather than code volume

The subtractions and the honest boundaries: the withheld momentum number; snooze as a third option;
meta-gating operational surfaces so a reviewer sees only product; the deliberate JS-not-TS posture with a
written plan instead of a fashionable rewrite; the explicit "what's intentionally out of scope" list; and
choosing DOM events over a state library with the reasoning recorded. Also the negative test asserting that
a non-stale error must *not* trigger a refetch — that is someone thinking about what should not happen.

### What looks disproportionately complex

The telemetry, KMS, key-audit and incident-lifecycle stack (§30), and the CI ceremony around a closed
two-consumer refactor (C-11).

### The five highest-ROI changes for hiring credibility

| # | Change | Effort | Why it pays |
| --- | --- | --- | --- |
| 1 | **Get the strict CI gate green and make it required.** Fix two e2e selectors (F-50), fix the repository Actions setting so the baseline refresh can run (C-01), and fix `branch-protection.yml`'s invalid permission (C-06) | ~1–2 hours | Turns the most visible negative signal into the strongest positive one. A public green gate backs every other claim |
| 2 | **Re-capture the five screenshots and the walkthrough**, or restore the honesty caveat until you do | ~1 afternoon | Both prior audits called this the single largest portfolio risk; it is still open and now contradicts the limitations ledger |
| 3 | **Fix F-01 and add a microsecond-precision repository test** | ~half a day | Converts the most serious defect into a demonstration of exactly the debugging depth the project claims |
| 4 | **Rewrite `CASE_STUDY.md` down to its first six sections** plus a short "what changed since" | ~2 hours | It is the document written for interviews and currently the weakest; cutting 480 pasted lines improves it |
| 5 | **Execute the `experimental/telemetry/` quarantine and add a LICENSE** | ~half a day | Removes the disproportion critique and the one instant checklist failure |

Everything on that list is a day and a half of work in total, and none of it requires new features.

---

## 32. Dead / Legacy / Duplicate Code

| Item | Classification | Evidence |
| --- | --- | --- |
| `src/components/dashboard/MomentumChart.jsx` | **CONFIRMED DEAD** | Verified: zero importers, no test. Also renders 0–100 bars, contradicting the shipped qualitative-momentum decision |
| `src/components/dashboard/ActivityFeed.jsx` + test | **CONFIRMED DEAD** | Verified: zero production importers; only its own test imports it |
| `dashboardDemoData` (`mockData.js:133-163`) | **CONFIRMED DEAD** | No consumers; carries a pre-Focus-Home `focusScore` shape |
| `buildNextMoveQueue`, `isLocalDashboardDemoMode` | **CONFIRMED DEAD** (test-only) | Exported but consumed only by tests; the latter is evaluated once at module load and would be stale anyway |
| `SOURCE_NOTICE_LOCAL_FIRST_ONLY` (`uiCopy.js:18`) | **INTENTIONAL FUTURE HOOK — should be wired now** | Defined and unit-tested with zero production consumers; it is exactly the copy F-08 needs |
| `if (!aiConfig.endpoint)` branch (`openai.js:153`) | **CONFIRMED DEAD** | Verified unreachable: the endpoint constant always falls back to `/api/chief-of-staff` |
| Bluesky icon sheet in `public/icons.svg`; `.topbar__action` and two other orphaned shell classes | **CONFIRMED DEAD** | No references |
| ~16 momentum-chart / activity-feed CSS blocks in `components.css`; content card-grid CSS retained only for the skeleton | **LIKELY DEAD** | Tied to the dead components above |
| `docs/git-course/module-01-mental-model.md` | **NEEDS PRODUCT DECISION** | Unrelated to the product, unreferenced, promises a Module 02 that does not exist |
| `docs/PR_SUMMARY_TEMPLATE.md`, the two `docs/tracking/` PR summaries | **NEEDS PRODUCT DECISION** | Point-in-time records presented as living docs |
| `scripts/check-crud-template-legacy-props.mjs` | **INTENTIONAL — now retirable** | Its migration is closed and it hard-fails CI after 2026-09-30 |
| The four `Chief*List` components | **NOT DEAD — verified live** | Each has exactly one production importer; `ChiefAcceptList` has four. The consolidation worked as intended |
| `src/lib/chiefActions.js`, `src/lib/chiefStructuredPayload.js` | **NOT DUPLICATES — verified** | Pure re-export shims over `shared/`, which is what makes client/server drift structurally impossible |

Nothing was deleted. Two of these entries exist specifically to *prevent* an unnecessary deletion: the
`Chief*List` components and the `shared/` re-export shims both look like duplication and are not.

---

---

## 33. Historical Audit Reconciliation

CEO OS has five prior audits (`docs/audits/`) plus a detailed closure ledger in `KNOWN_LIMITATIONS.md` and
a date-anchored CHANGELOG. This audit read all of them before forming findings, and spot-checked claimed
fixes against current code. The distribution across the mandated categories, over 174 findings:

| Category | Count | Meaning |
| --- | --- | --- |
| **A** — previously found and fixed | 4 | Only reopened where current code shows a regression |
| **B** — previously found, still open | 21 | Revalidated against current implementation |
| **C** — intentionally deferred | 11 | Documented boundaries, **not** characterised as neglect |
| **D** — newly discovered | 138 | Not captured by any prior audit |

### A. Previously found and confirmed fixed — verified, not reopened

The repository's closure claims are, in the main, **true**. Spot-checks that passed include: the ten-type
Chief action catalogue; `chiefRepository` writing versioned envelopes; `saveStatusBus` firing from CRUD
writes; the Content OS lifecycle rebuild; the `useSilentRefresh` migration; the removal of the orphaned
`ChiefRecentOutputs` and the `WeeklyPriorities` clone; the 2026-06-26 refactor trio
(`makeDuplicateValidator`, `ChiefAcceptList` consolidation, `useWorkspaceBackup`); the storage-quota
deep link; the `--danger-tint-rgb` tokenisation; and the 44px coarse-pointer targets. The CRUD
slots-migration is genuinely complete — its guard script passes at runtime. **This is a strong result and
the repository deserves credit for it.**

Four items are reopened **with regression evidence**:

| Item | Was closed as | Regression evidence |
| --- | --- | --- |
| Blank-mode seeding (F-02) | "Blank mode stops automatic sample seeding for Opportunities, Content OS, **and Weekly Brief**" (`KNOWN_LIMITATIONS.md:95`) | The weekly half was implemented as a one-week imperative clear, never as the read-time gate the other two received. Verified: `weeklyRepository` has no `isDemoWorkspaceEnabled` reference |
| Honest screenshot status (D-01) | Added by commit `6499631` | Removed by commit `fb5c48a`; README and `KNOWN_LIMITATIONS.md:7` now contradict each other |
| Env reference split-out (D-02) | "Split the env-variable reference out of README into docs/CONFIGURATION.md" (CHANGELOG) | Re-inlined by `fb5c48a`; `CONFIGURATION.md` is now linked from nowhere in the README, and the duplicate has drifted on the fail-closed default |
| Envelope discipline (F-75, D-03) | Documented as still outstanding | Inverse drift: the **code** shipped envelopes for Capture, Journal and reminders; the doc never caught up |

### B. Previously found and still open — revalidated

Twenty-one findings. The most significant: the weekly-brief UX audit's Phases 2–5 (week navigation,
carry-forward, chosen focus, summary-band dedupe) remain entirely unbuilt while Phase 1 shipped (F-37);
Supabase auth-error handling still diverges by repository (F-44, A-03), an item the readiness audit raised;
the `experimental/telemetry/` quarantine keeps slipping (§30); `CASE_STUDY.md` staleness was flagged before
and has worsened (D-05); the Capture composer still bypasses the shared primitives (F-20); and the Journal
empty state is still four blank textareas (F-27).

**A tracking gap worth naming.** The 2026-05-24 architecture audit's inline status table is the best
closure-tracking pattern in the repository — but it was applied only to that audit. The weekly-brief audit's
phased plan and two readiness-audit architecture items dropped off every ledger, so "what is still open"
could only be reconstructed by re-auditing. Extending the status-table pattern to the other audits would
prevent that recurring.

### C. Intentionally deferred — classified as boundaries, not defects

Eleven items, each documented in the repository before this audit found it: the telemetry/KMS/incident
overbuild and its planned quarantine; Capture, Journal and reminders being local-only by design; the
Weekly Brief and Settings absence from the offline queue; `setState`-updater persistence with a written
remediation plan; Chief acceptance signature-cache staleness; fuzzy dedup; the Content OS calendar view;
Cmd+K; the account-product incompleteness; meta mode's one-way session switch; and the client-side
telemetry token exposure as a trusted-deployment boundary.

**These are not counted against the project.** Where this audit disagrees, it is about *communication* — for
example, reminders being local-only is a legitimate boundary (C), but the *absence of in-product copy
saying so*, on a page that simultaneously advertises sync, is a defect (F-08).

### D. Newly discovered — 138 findings

The three most consequential are F-01 (Supabase concurrency inversion), F-87 (unconfirmed destructive demo
load), and the CI/automation cluster C-06 through C-09. None of these appear in any prior audit, and the
reason is instructive: each lives at a boundary that static review of a single layer cannot see — the
client/Postgres precision boundary, the button/repository boundary, and the workflow-file/actual-run
boundary. Prior audits reviewed the code correctly; what was missing was checking the code against the
*runtime and the database's real contract*.

---

## 34. Cross-Cutting Root Problems

Most of the 174 findings collapse into eight root causes. Fixing a root fixes its dependents; fixing the
dependents one at a time does not.

### R1 — The client and the database disagree about timestamp precision

**Creates:** F-01 (the audit's most important finding), the false-green Supabase test suite (C-04), and
much of the reason the authenticated regression pass has never completed.
**Why it persisted:** every test mock encodes the client's own assumption, so the suite cannot see it.
**Fix once:** stop round-tripping `updated_at` through epoch milliseconds; carry the raw string.

### R2 — Demo/blank workspace state is enforced inconsistently across repositories

**Creates:** F-02 (weekly demo resurrection), F-06 (demo flash on first paint), F-87 (destructive demo
load), F-89 (clear-demo misses other weeks), F-38 (demo ids surviving edits).
**Why it persisted:** two of three repositories got a read-time gate and one got an imperative one-time
clear; the covering test pinned a week that never exercises the branch.
**Fix once:** one shared demo-state predicate consulted by every repository at read time, plus archive
before any destructive seed.

### R3 — Repositories diverge at the local/cloud seam

**Creates:** F-44 and A-03 (auth errors thrown by two repositories and caught by two others), A-01
(local data vanishing after sign-in), the "local-first" label being inaccurate for the two domains that
actually sync, and the four-strategy inconsistency in §16.2.
**Fix once:** extract the Chief/Settings auth-fallback classification into a shared helper and apply it
everywhere; state the source contract per domain in one place.

### R4 — The offline queue has no terminal state and no owner

**Creates:** F-45 (permanent wedge), A-02 (cross-account replay), F-74 (unversioned entries, silent
drops), F-51 (contradictory copy), and the queued-write-presents-as-failure UX.
**Fix once:** give entries an owner and a terminal disposition (drop, park, or surface) after N attempts.

### R5 — Side effects inside React state updaters

**Creates:** F-30 (weekly double-writes under StrictMode), F-64 (chief hooks), and contributes to F-35
(prepend/append mismatch).
**Note:** documented, with a written plan, and Journal already demonstrates the correct pattern in-repo.

### R6 — `usePersistentState` writes on mount

**Creates:** S-07 and F-73 (spurious "Saved" signals that dilute the app's only data-trust indicator), plus
a resurrect-a-cleared-key race across tabs.
**Fix once:** skip the write and the notification when the value is unchanged from what was just loaded.

### R7 — Self-verification is configured but not operating

**Creates:** C-06 (branch protection unappliable and inactive — `main` confirmed `protected: false`), C-07 (the strict gate has never run at all), C-01/C-08
(baseline refresh failed 14/14; ops loop never fired and would fail anyway), C-09 (Netlify telemetry
silently discarded), F-50 (selector drift that nobody was forced to fix), and D-04 (README claims describing
enforcement that is not in force).
**Root of the root:** the green `CI` workflow provides a passing badge, so the red strict gate produced no
felt pressure. **Fix once:** make the strict gate green, then actually require it.

### R8 — No canonical-document hierarchy

**Creates:** D-01, D-02, D-03, D-06, D-07 — every documentation-drift finding.
**Why:** three documents each believe they own the same fact (screenshots, env reference, limitations), and
nothing arbitrates when they disagree.
**Fix once:** name the canonical owner per topic and make the README a pointer.

---

## 35. Known Good Decisions to Preserve

180 preserve-items were nominated by the inspection fleet. The ones that should survive any remediation,
consolidated:

**Product and thesis**

- The calm thesis as *implemented*, not just stated: the qualitative momentum label with the numeric score
  deliberately withheld (with the reasoning committed in a code comment), snooze as an alternative to
  done-or-ignore, invitation-shaped empty states, and operational surfaces hidden behind `?meta=1`.
- The **"Recommended because:"** reason attached to every focus recommendation. This is the single line
  that separates decision support from a tip rotator — do not remove it to save space.
- Journal heaviness reaching Focus Home as a **presence-only boolean** rather than as text.
- Point-of-use local-only copy on Capture and Journal (extend it to Reminders; do not remove it).

**Architecture**

- **RLS as written** — `auth.uid() = user_id` with both `using` and `with check` on all seven user tables,
  plus the telemetry-sink lockdown and the security-definer prune RPC with a pinned `search_path`.
- **Server-authoritative `updated_at`** via triggers. The F-01 fix should adapt the *client comparison*,
  never move timestamp authority to the client.
- The single route registry driving routes, nav groups and page meta, with tests asserting alignment; and
  meta-gating at **route registration** rather than only in the nav.
- Versioned storage envelopes with domain-mismatch rejection (the "wrong key swap" guard) and legacy-read
  compatibility.
- Corruption **preservation** — backup under `${key}__corrupt_<ts>`, an event, and a non-blocking banner.
  Data loss is loud, not silent. This is the repository's best reliability idea.
- The three-tier error boundary architecture, with the route-level boundary keyed to `location.key` so both
  navigate-away reset and same-path retry work.
- `usePromotionAction`'s promotion guard: per-record in-flight set, unmount-safe toasts, always-released
  retry slot.
- Journal's ref-based debounce/flush pattern — the correct StrictMode-safe reference implementation, which
  the weekly and chief hooks should be ported *to*.
- The transport-agnostic proxy core with paper-thin adapters, giving cross-platform behavior parity by
  construction.
- `shared/` as the genuine single source of truth for chief actions, config and payload shapes — the
  client modules are re-export shims, so client/server drift is structurally impossible.
- Backup import as **validate-all-then-write-all**, with explicit rejection of newer schema versions.
- Timing-safe HMAC comparison and fail-closed 503 on key-window misconfiguration in the ingest core.
- The deterministic AI fallback, **visibly labelled** with its reason and error code.

**Engineering practice**

- The axe sweep's calibration: hard-fail on serious/critical, log everything else. Extend it to mobile
  viewports and the auth routes rather than changing the threshold.
- Role- and label-based Playwright selectors throughout, which make the e2e suite double as an
  accessible-name contract.
- The storage fault-injection pattern in `crud-smoke.spec.js` — real browser-level failure-path coverage is
  rare and valuable.
- The negative assertion that a *non*-stale error must not trigger a refetch.
- The release-governed baseline refresh **design** (`--release` + approval env + approved-event + PR review).
  Fix the repository setting that breaks it; do not weaken the guard.
- `KNOWN_LIMITATIONS.md`'s ledger **form**, the CHANGELOG's date-anchored evidence format, and the
  2026-05-24 audit's inline status table. Fix their stale content; keep their structure.
- The documented JS-not-TS posture **as a decision**, with a staged migration plan and honest reasoning.
  (Preserve the decision and the plan — but see J-01: the `tsc --noEmit` gate that is supposed to back it
  runs with `checkJs: false` and currently verifies almost nothing, so the *claim* needs fixing even though
  the *choice* does not.)

## 36. Unknown / Unverified

94 items were nominated as not conclusively established. They collapse into eight blocks. Nothing here is
omitted for convenience — where the audit could not prove something, it says so.

### U1 — All authenticated Supabase behavior

**Why unverified:** no authenticated environment was available, and the repository's own documentation
states this pass has never been run. **Static evidence:** repository code paths, migrations and RLS policies
read in full. **Runtime evidence:** none. **Required verification:** `CEO-OS-MANUAL-QA.md` §10, especially
**MQ-AUTH-01**, which alone decides F-01 — the audit's most important finding. Also unproven: whether local
data really disappears after first sign-in (A-01), whether the queue replays across accounts (A-02),
multi-tab auth behavior, and whether the two-timezone week split materialises as two rows (F-29).

### U2 — Rendered visual behavior

Layout at real viewports, the light-theme first-paint flash, the half-width Reminders panel, drawer
clipping at 30rem, and the appearance of the unstyled Chief accept buttons. Static CSS proves the rules
exist; it cannot prove what a browser paints. **Required:** MQ-RSP-*, MQ-THM-*, MQ-SHL-03. Note that the
G-01 contrast *arithmetic* is confirmed; what needs verification is which token renders on which control.

### U3 — Screen-reader announcement behavior

Whether the conditionally-mounted live regions (toast, save pill, page loading, the Suspense fallback) are
announced at all; whether the Journal prompt's accessible name absorbs its nested button; whether
`display: grid` on table rows strips row/cell semantics; whether the corruption banner over-announces during
its re-fire storm. axe cannot establish any of these. **Required:** the `[A11Y]` items.

### U4 — Deployed proxy and platform behavior

Whether Vercel or Netlify sanitise `x-forwarded-for` before the function sees it (which decides how weak the
rate limiter really is); Vercel's SPA deep-link fallback with no `vercel.json`; and — importantly —
**whether any deployed instance is currently running in open, token-disabled mode with a live
`OPENAI_API_KEY`**. That last question is the practical severity of F-03 and can only be answered by the
owner.

### U5 — Telemetry ingest end-to-end

The one true external integration test is secret-gated and **skipped** in this environment, so durable
ingest, the retention prune, and the idempotency constraint are unproven here (they are proven in CI when
`SUPABASE_TEST_*` is present). Whether the Ops Reliability page has *ever* displayed real data is unknown
and, given §2.3, doubtful.

### U6 — Timing and perception

The visible duration of the demo-data flash and the theme flash; whether repeated silent-refresh failures
re-toast at an annoying rate in practice; whether per-keystroke writes on a 100-note Capture wall produce
perceptible lag; and whether the unsignalled lazy-route wait reads as broken.

### U7 — Behaviors this audit inferred from React or browser semantics

Chiefly F-04 (controlled-textarea snap-back), S-01 (focusable hidden nav links), and S-03 (scroll not
resetting). Each is a standard, well-understood mechanism and each is rated HIGH CONFIDENCE — but jsdom
applies no CSS and asserts no cursor behavior, so a browser is the only proof. Each has a `[REPRO]` item.

### U8 — Whether prior-audit claims about *runtime* behavior still hold

Touch-target sizes, the quota deep-link scroll-and-focus, and reduced-motion behavior were verified as CSS
rules, not as rendered results.

**One methodological note.** Three of the audit's most important findings (F-01, G-01, and the blank-mode
test in F-02) share a shape: **an existing test or check validates something adjacent to what actually
runs.** That pattern is worth carrying into the remediation — when fixing each, fix the check as well, or
the next regression will be equally invisible.

---

## 37. Master Remediation Backlog

Deduplicated and grouped under the root causes from §34. Symptoms are folded into their root where fixing
the root resolves them.

| ID | Pri | Class | Area | Root | Recommended fix | Size | Dependency | Verification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **F-01** | P1 | DEFECT | Supabase concurrency | R1 | Carry the raw `updated_at` string and echo it verbatim in the `.eq()` guard (or `date_trunc('milliseconds')` server-side); add a microsecond-precision repository test | S | none | **MQ-AUTH-01** |
| **F-02** | P1 | DEFECT | Weekly / Focus Home | R2 | Gate the weekly demo fallback on `isDemoWorkspaceEnabled()`; fix the test to pin the current week; add a rollover case | S | none | MQ-FH-01 |
| **F-87** | P1 | DEFECT | Settings / demo | R2 | `archiveStorageValue` before seeding; confirm when target stores are non-empty | S | none | MQ-SET-01 |
| **F-03** | P1 | ARCH RISK | AI proxy | — | Verify the Supabase session JWT in the proxy, or keep it open with a hard spend ceiling and `max_output_tokens` — then reconcile the docs | M | auth decision | MQ-CHF-01 |
| **C-06** | P2 | DEFECT | CI governance | R7 | Apply protection with a PAT or GitHub App (a `GITHUB_TOKEN` cannot do this at all), then actually require the strict check | S | C-07 first | §2.3 re-check |
| **C-07** | **P1** | DEFECT | CI governance | R7 | **Move `secrets` out of the step-level `if:` in `ci-tests.yml:56`** so the workflow can start at all (one line). Then fix the two Content OS selectors (F-50) and the repository Actions setting so the baseline refresh can run (C-01) | S | none | MQ-X-05, MQ-X-06 |
| **C-08** | P2 | DEFECT | Ops workflow | R7 | Add `npm run build` before the route checks; establish why the schedule never fires | S | none | MQ-X-07 |
| **C-09** | P2 | DEFECT | Deployment | R7 | Add the Netlify telemetry redirect; stop treating any `ok` response as delivery | S | none | MQ-X-03 |
| **F-45 / A-02 / F-74** | P2 | ARCH RISK | Offline queue | R4 | Give entries an owner and a terminal disposition after N attempts; continue draining past terminal failures; make queued writes read as queued | M | none | MQ-STO-05, MQ-AUTH-04 |
| **F-44 / A-03 / A-01** | P2 | ARCH RISK | Local/cloud seam | R3 | Extract the Chief/Settings auth-fallback classification into a shared helper; render a sign-in state instead of offline copy; correct the sign-in copy | M | none | MQ-AUTH-02, MQ-AUTH-03 |
| **F-04** | P1 | DEFECT | Capture | — | Local draft state with debounce; normalise only at persist time; decide the empty-text behavior | M | none | MQ-CAP-01 |
| **F-05** | P2 | DEFECT | Focus Home | — | One `selectActiveReminders` selector used by all five call sites; test that hero and suggested loop agree | S | none | MQ-FH-03 |
| **F-22 / F-31** | P2 | DEFECT | Journal / Weekly autosave | — | Flush on unmount rather than cancel; port Journal's flush pattern to the weekly reflection; fix the misleading comment and the audit doc | S | none | MQ-JRN-01, MQ-WK-03 |
| **F-71** | P2 | ARCH RISK | Storage | — | Reject future-version envelopes; treat an incomplete migration chain as a read failure | S | none | — |
| **F-72** | P2 | DEFECT | Storage | — | Quarantine the corrupt primary after preserving it | S | none | MQ-STO-02 |
| **F-41** | P2 | DEFECT + DOC | CRUD | R3 | Wire `useCrudPage` through `useSilentRefresh`, or correct the comment and the docs | S | none | MQ-OPP-03 |
| **F-42** | P2 | DEFECT | Modals | — | Modal stacking registry so only the topmost handles Escape | S | none | MQ-OPP-02 |
| **F-43** | P2 | DEFECT | CRUD delete | — | Thread `expectedUpdatedAt` into delete; treat local not-found as success; surface errors in the modal | S | F-01 | MQ-OPP-04 |
| **G-01** | P2 | DEFECT | Design / a11y | — | Darken light-theme accent/warning/success/scheduled to ≥4.5:1 and the focus ring past 3:1; **make the contrast test assert the pairs that actually render**; add a light-theme axe pass | S | none | MQ-THM-01/03 |
| **S-01** | P2 | DEFECT | Mobile nav a11y | — | Add `[hidden] { display: none !important }`; add a 390px axe scan | S | none | MQ-SHL-01 |
| **S-02** | P2 | DEFECT | Theming | — | Inline pre-hydration theme script in `index.html` (also fixes the auth routes) | S | none | MQ-SHL-03/04 |
| **F-55/F-56/F-57/F-58** | P2 | DEFECT | Chief client | — | Accept from the stored payload; persist before the mount gate; debounce notes with a sequence guard; add the off-device disclosure and delete the dead branch | M | none | MQ-CHF-03/04/05/06 |
| **F-88/F-89/F-90** | P2 | DEFECT | Settings | R2 | Archive before import and use the guarded setter; clear demo ids across all weeks; make Retry re-attempt the save | S | none | MQ-SET-02/05/06 |
| **F-29** | P2 | DEFECT | Week key | — | Format the week key from local date components; alias existing rows | M | data migration | MQ-WK-06, MQ-AUTH-10 |
| **F-33/F-30/F-64** | P2 | ARCH RISK | React updaters | R5 | Snapshot `updatedAt` at editor open; move persistence out of updaters using Journal's ref pattern | M | F-01 | MQ-OPP-03 |
| **F-34/F-35/F-36** | P2 | DEFECT | Weekly | — | Keep save errors visible; align prepend/append ordering; delete the duplicated summary render | S | none | MQ-WK-01/02/05 |
| **F-06/F-07/F-08** | P2 | DEFECT | Focus Home | R2 | Initialise weekly state empty; consume `loadError` with a real retry; wire the local-only notice into Reminders | S | none | MQ-FH-02/11/12 |
| **T-02/T-03** | P2 | DEFECT | Telemetry | — | Add a `sentAt` freshness window and a request cap on ingest; flush the client queue on start and on `online`; drop terminal batches | M | §30 quarantine decision | — |
| **T-01 + KMS stack** | P2 | ARCH RISK | Telemetry | — | Execute the documented `experimental/telemetry/` quarantine; keep a thin token + HMAC ingest | L | product decision | — |
| **D-01…D-09** | P2/P3 | DOC DRIFT | Documentation | R8 | Re-capture visuals or restore the caveat; de-duplicate the env reference and fix the fail-closed wording; reconcile `KNOWN_LIMITATIONS`; correct enforcement claims; trim `CASE_STUDY`; declare a canonical hierarchy; add a LICENSE | M | — | — |
| **A-05 / C-04 / C-05** | P2 | PORTFOLIO GAP | Tests | R7 | Add auth-surface tests and include both auth routes in the axe sweep; add e2e for generation, offline replay and autosave | M | — | — |
| ~100 P3 items | P3 | mixed | all | mixed | See the per-section tables | S each | — | — |

---

## 38. Recommended Remediation Order

### Phase 0 — Critical

**None.** No P0 was found: nothing exploitable, no silent destruction of pre-existing user data, no
completely broken core workflow in the default (local) mode.

### Phase 1 — Data and trust integrity

`F-01` (Supabase concurrency — and the microsecond test that goes with it) · `F-87` (archive + confirm
before demo seeding) · `F-02` (blank-mode gate + a test that exercises the right branch) · `F-45`/`A-02`
(queue owner and terminal state) · `F-71` (future-version guard) · `F-72` (quarantine corrupt primaries) ·
`F-88` (archive before import, guarded setter).

*Rationale: everything here either loses data, corrupts a workspace, or blocks legitimate writes.*

### Phase 2 — Core product workflows

`F-04` (Capture editing) · `F-05` (one reminder selector) · `F-22`/`F-31` (autosave flush on both surfaces) ·
`F-55`–`F-58` (Chief acceptance fidelity, mid-generation persistence, note debounce, off-device disclosure) ·
`F-34`–`F-36` (weekly error visibility, ordering, duplicated summary) · `F-06`–`F-08` (demo flash, real
retry, reminders disclosure) · `F-89`/`F-90`.

### Phase 3 — UX and accessibility

`S-01` (focusable hidden nav links) · `G-01` (light-theme contrast **and** the test that missed it) ·
`S-02` (pre-hydration theme) · `F-42` (modal Escape stacking) · `S-03` (scroll reset) · `S-05`/`F-26` (failure
messages that persist; live-region consolidation) · `F-13`/`F-18`/`F-25`/`F-95` · the two sub-44px targets.

### Phase 4 — Architecture simplification

`R3` (one auth-error helper across repositories) · `F-41` (cross-tab refresh, or honest docs) · `R5` (move
persistence out of `setState` updaters, porting Journal's pattern) · `S-06` (one settings provider in the
shell) · `R6` (`usePersistentState` mount write) · **the `experimental/telemetry/` quarantine** · retire
`C-11`'s guard script.

### Phase 5 — Tests and production trust

`MQ-AUTH-*` (the authenticated regression pass — the single largest evidence gap) · microsecond-precision
repository tests · auth-surface tests and axe coverage for `/sign-in` and `/auth/callback` · a light-theme
and 390px axe pass · e2e for generation, offline replay and autosave · `C-06`–`C-09` (make the gate green,
required, and actually running).

**Note on ordering:** `C-07` is a **one-line fix** — move the `secrets` test out of the step
`if:` (guard on an `env` var set at job level, or drop the condition and let the test self-skip, which it
already does). That single line is what stands between this repository and a functioning quality gate, and
it should be executed **first**, before anything else in this document. Only after the workflow can start
do F-50 and C-01 become the next things it reports.

### Phase 6 — Portfolio credibility

Re-capture screenshots and the walkthrough (or restore the caveat) · trim `CASE_STUDY.md` · reconcile
`KNOWN_LIMITATIONS.md` · de-duplicate and correct the env reference · add a LICENSE and a canonical-doc
declaration · relocate `docs/git-course/`.

### Phase 7 — Cleanup

Delete the confirmed-dead components, exports and CSS · resolve the point-in-time docs · consolidate the
ten-value breakpoint ladder · fix the `theme-color` and `--font-mono` drift.

---

## 39. Readiness Classification

### Overall: **Level 2 — Strong Portfolio Project**

**Evidence supporting this level.** A working, coherent product with an implemented thesis; 823 passing
unit tests and 29/31 e2e tests including nine axe route sweeps; a genuine architectural seam with versioned
storage, corruption preservation and optimistic locking that works in local mode; correct and complete RLS;
a clean shared-core serverless design; real performance budgeting; and honest limitation documentation.
This is well above a prototype.

**Evidence preventing Level 3 (Beta-Ready).**

1. **F-01** — the flagship concurrency feature appears inverted in cloud mode, and no authenticated pass has
   ever been run to prove otherwise.
2. **F-02 / F-87** — a documented workspace guarantee is not implemented, and a one-click unconfirmed action
   destroys local records.
3. **F-03** — the differentiating AI feature cannot be authenticated as documented.
4. **R7** — the project's own verification loops are red, unenforced, or have never executed, so "it works"
   currently rests on claims rather than a passing gate.

A beta implies users can rely on it. Items 1–3 each break that for a real user; item 4 means the project
cannot currently demonstrate otherwise.

**Manual/runtime verification still required.** The full `[AUTH]` block, the `[REPRO]` items, and the
`[A11Y]` pass — see `CEO-OS-MANUAL-QA.md`.

**Conditions to advance to Level 3.** Complete Phase 1; run the authenticated regression pass
(`MQ-AUTH-01` first); get the strict CI gate green and required. That is a small, well-defined body of
work — days, not months.

**Conditions to advance to Level 4 (Production-Capable With Known Limitations).** All of the above, plus:
per-user proxy authentication or a hard spend ceiling; the account lifecycle gaps either closed or
prominently bounded in-product; the offline queue given an owner and a terminal state; and either the
telemetry quarantine executed or the ops claims removed from the README.

### The three readinesses stated separately

| Dimension | Level | Reasoning |
| --- | --- | --- |
| **Portfolio readiness** | **Strong, with fixable damage** | The architecture, product judgment and accessibility work are genuinely impressive and above the bar for a senior frontend role. What holds it back is presentational and reversible: a publicly red CI gate, stale screenshots, and a decayed case study. Roughly a day and a half of work moves this to "very strong" |
| **Product readiness** | **Usable single-user local tool; not ready for someone's real week in cloud mode** | In pure local mode a founder could genuinely use this daily — with the caveats of F-04 (sticky editing), F-02 (demo resurrection) and F-87 (destructive demo load). In cloud mode, F-01 likely blocks editing entirely |
| **Production readiness** | **Not production-ready, and honestly documented as such** | No authenticated verification, incomplete account lifecycle, an AI proxy that is either off or open, unenforced quality gates, and operational tooling that has never run. The repository's own framing already says most of this — the audit's addition is that it is further from production than the ops infrastructure's *presence* implies |

The gap between portfolio readiness and production readiness is the honest headline of this audit — and
the repository's own documentation mostly says so already. What it does not yet say is that some of the
machinery it points to as evidence of production thinking is not currently running.

---

## 40. Final Coverage Reconciliation

A second, independent discovery pass was run at the end of the audit: the repository was re-enumerated from
disk and every production file was checked against the citations produced by the inspection fleet.

```text
COVERAGE

Routes discovered:                    12 (9 shell + 2 auth + 1 wildcard)
Routes audited:                       12  (100%)

Meaningful product surfaces discovered: 201
Surfaces audited:                       201 (100%) — healthy surfaces recorded, not omitted

Persistence domains discovered:        13 (10 local, 7 Supabase-backed, plus queue,
                                          ops snapshots and UI preferences)
Persistence domains audited:           13  (100%) — full matrix in §16.1

Server / API surfaces discovered:      7 server modules, 2 Vercel adapters,
                                       2 Netlify functions, 4 shared modules
Server / API surfaces audited:         all 15 (100%)

Supabase migrations reviewed:          8 of 8
Tables / policies reviewed:            12 tables; RLS verified per table (§17.1)

CI workflows reviewed:                 5 of 5 — plus their actual run history via the Actions API

Tests inventoried:                     138 vitest files (823 tests) + 10 Playwright specs (31 tests)

Production source files re-checked:    230
  cited by at least one inspector:     229
  gap found and closed by the orchestrator: 1 (src/lib/chiefPanelResult.js — read directly;
                                          43 lines, live, well-guarded on every input path,
                                          has its own test; no findings)

Runtime-verified workflows:            npm run verify (823 tests, lint, typecheck, build);
                                       markdownlint; CRUD template guard; static route budgets;
                                       route-budget trend gate (FAILS, exit 1);
                                       Playwright 29/31 including 9 axe route sweeps;
                                       GitHub Actions run history for all 5 workflows

Manual verification remaining:         ~90 checks in CEO-OS-MANUAL-QA.md, dominated by the
                                       authenticated Supabase block

Known exclusions:                      node_modules; package-lock.json; binary assets
                                       (5 PNGs, 1 .webm, 2 SVGs) — inspected as metadata and
                                       provenance (commit dates), with one PNG rendered to
                                       confirm the staleness claim in D-01
Reason for exclusions:                 vendored code is out of scope; binary content cannot be
                                       audited as source
```

**Is anything meaningful present in the repository but absent from this audit?** After the second pass:
no. The one gap found (`chiefPanelResult.js`) was inspected and closed before publication. Every route,
surface, persistence domain, server module, adapter, migration, script, workflow and documentation file is
represented somewhere in this report.

**Is "100% coverage" a defensible claim?** For *static* coverage of production source, yes — and the
numbers above are how it was checked rather than asserted. For *behavioral* coverage, emphatically no: the
entire authenticated Supabase surface, all screen-reader behavior, and all rendered visual behavior remain
unverified, and §36 enumerates them. This audit covers the whole repository; it does not claim to have
exercised the whole product.

---

## Appendix — Product Verdict

**Does CEO OS genuinely reduce founder cognitive load?** In local mode, yes — more than a generic dashboard,
and for a specific reason: it *explains* its recommendations. "Recommended because:" turns a ranking into
decision support. The daily loop (capture → ranked focus → promote → weekly review) is coherent and
original, and the deliberate subtractions — no numeric score, no streaks, snooze as a third option, ops
hidden behind a flag — mean the product resists the thing it was built to avoid.

**Which features best accomplish it.** Focus Home's single hero with a reason and a safe-to-ignore list;
Capture's frictionless entry with promotion verbs that move a thought into the right domain without
retyping; Chief of Staff's structured acceptance, which converts a wall of AI text into reviewable items
with visible destinations; and the calm failure design throughout.

**Which features add complexity without proportionate benefit.** The telemetry, KMS and incident stack —
invisible to the user and, per §30, largely unusable. Within the product itself, very little is
gratuitous: the focus-tools drawer is collapsed by default, and the momentum readout is quiet enough that
its staleness (F-09) barely registers.

**Where the product feels coherent.** Everything inside a single local workspace. The domains share
vocabulary, the promotion verbs share one hook, the surfaces share one design language, and the whole thing
degrades honestly when something fails.

**Where it feels like separate systems accumulated over time.** The local/cloud seam (four different
strategies, per §16.2); reminders — a first-class product concept that lives in a panel, syncs nowhere, and
is the only one of five promotion verbs without a guard or a disclosure; and the ops surface, which reports
on a system that is not running.

**The one-sentence product judgment:** CEO OS is a genuinely calm, genuinely original single-user operating
system whose product thinking is ahead of its infrastructure — and whose most valuable next move is not a
new feature, but making the cloud half behave as well as the local half already does.

---

## Appendix — Failure and Recovery Matrix

Consolidated answer to "what happens when X fails, and can the user recover without understanding the
implementation?" Each row states the observed behavior and where the finding lives.

| Failure | What happens today | User can recover? | Finding |
| --- | --- | --- | --- |
| Client render exception | Three-tier error boundaries: panel fallback, route-level boundary keyed to `location.key` (navigate-away reset **and** same-path retry), shell boundary. Scrubbed telemetry emitted | **Yes** — retry or navigate away | healthy |
| Route chunk fails to load | Caught by the route boundary; retry path exists | Yes | healthy |
| `localStorage` JSON corruption | Blob preserved under `${key}__corrupt_<ts>` (3-slot cap), event dispatched, non-blocking banner with restore/discard | **Mostly** — except corruption detected during the first render commit, where the backup is made but no banner ever appears | S-04, F-72 |
| Storage quota exceeded | Classified on the save-status bus; assertive banner naming the failing key; deep link scrolls and focuses Settings → Workspace Data | Yes | healthy (F-94 has no recovery affordance for the "needs recovery" line) |
| Quota exceeded **during backup import** | Raw `setItem` in the write loop: import half-applies **and** never reaches the quota banner | **No** | F-88, F-69 |
| Supabase unreachable (signed in) | Opportunities/Content enqueue recoverable failures and show "Pending sync"; Weekly Brief and Settings surface errors; Focus Home shows only a 2.2 s toast | Partly — but a queued write presents as a hard failure, inviting the retry that wedges the queue | F-45, F-07 |
| Supabase auth error / token refresh | **Divergent by repository**: Settings and Chief fall back to local; Opportunities/Content/Weekly throw, and the UI renders "Offline. No cloud replay queue is active" while actually online | **No** — the retry can never succeed | F-44, A-03 |
| Stale record (local) | `assertRecordIsFresh` throws `StaleRecordError`; `useCrudPage` shows a friendly message and refreshes the list under the open modal | Yes — this is the designed path and it works | preserve |
| Stale record (Supabase) | The guard misfires on nearly every edit because of the precision mismatch, and the write is discarded rather than queued | **No** | **F-01** |
| Offline write replay fails permanently | `attempts` increments but is never consulted; drain stops at the first failure; no eviction, no dead-letter, no discard UI | **No** — every later write is blocked indefinitely | F-45 |
| Account switch with queued writes | Queue is a single global key with no owner; replay stamps whoever is signed in now | **No** — and user A's content can land in user B's workspace | A-02 |
| AI proxy unavailable / unauthorized | Client falls back to a deterministic local plan, **visibly labelled** with reason and error code | Yes — failure is honest. But under the documented production config this is the *permanent* state | preserve / F-03 |
| AI returns malformed JSON | Normalised defensively on both sides with item and length caps; upstream parse failure cannot crash the function (though it returns 200 with an error object rather than 502) | Yes | F-83 |
| Generation completes after navigating away | Output is silently discarded — the mount guard returns before the save | **No** | F-56 |
| Telemetry endpoint missing (Netlify) | SPA fallback returns `index.html` with HTTP 200; the client's delivery check treats any `ok` as success and drops the batch | **No** — silent, total loss | C-09 |
| Telemetry batch permanently rejected (400/401) | Treated like a transient 503; queue never advances; drains only when a *future* error occurs | No | T-03 |
| Malformed backup import | Validate-all-then-write-all: rejected before any write; newer schema versions rejected explicitly; unknown keys ignored and counted | **Yes** — genuinely well built | preserve |
| Future-version storage envelope | Short-circuits and is returned **unchanged** as if current; an incomplete migration chain is also returned as data | **No** — silent wrong-shape data | F-71 |
| Expired session mid-save (Settings) | Persists locally and flips the source to local | Partly — what happens to that local change after re-authentication is unverified | A-07, U1 |
| Journal autosave fails, then date switched | Old day's unsaved text discarded **and** the error message cleared | **No** | F-22 |
| Weekly reflection unsaved at navigation | Debounce cancelled without flushing; no `beforeunload`, no blur flush | **No** | F-31 |

**The pattern.** Failure design is genuinely strong wherever the repository built it deliberately —
corruption preservation, quota banners, the labelled AI fallback, local stale-record recovery, transactional
import validation. The gaps cluster in two places: the **seam** between local and cloud (rows F-01, F-44,
A-02, A-03, F-45), and **lifecycle edges** where a pending write meets an unmount, a date change, or a
version bump (F-22, F-31, F-56, F-71). Neither is a failure of intent; both are places where a
well-designed mechanism stops short of its last state.

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

---

## 5. Complete Surface Inventory

156 distinct surfaces were catalogued across the inspection fleet. They are grouped below by system
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

# CodeHerWay CEO OS

A calm founder operating system: focus, planning, opportunities, content, and
chief-of-staff workflows in one place. Local-first by default with a
Supabase-backed path for authenticated, account-scoped persistence.

Built in React 19 + Vite to demonstrate product-minded frontend systems work —
not just feature output. Every UX decision is filtered through one question:
*does this reduce mental load, or add to it?*

## What it is

- **Focus Home** — a command center that ranks the next smallest action across
  priorities, blockers, reminders, journal signals, opportunities, and content
  drafts. Includes ADHD-supportive states and an "I'm overwhelmed" reset.
- **Capture** — sticky-note workspace for fast brain-dump input, with composer
  rehydration through localStorage so a long brain-dump survives reloads.
- **Journal** — private daily prompts with debounced autosave and a
  one-next-thing prompt that can promote straight to a reminder.
- **Weekly Brief** — priorities, blockers, wins, and a close-of-week reflection
  that feeds Focus Home momentum and the next-move recommendation.
- **Opportunities** — an executive-grade relationship pipeline with optimistic
  concurrency, stale-record protection, and an offline write queue.
- **Chief of Staff** — paste founder notes, then pick what to make from a
  grouped output catalogue (decision brief, weekly update, action plan,
  priority list, meeting summary, founder memo, content idea, opportunity
  follow-up, blocker analysis, and a 72-hour action list). Action-plan-style
  outputs come back as structured priorities / opportunities / content / tasks
  — each reviewable, with its destination shown, and accept-into-system in one
  click; a "Recent outputs" panel keeps the last 30 generations. Deterministic
  fallback when the AI is unavailable.

![Focus Home overview](docs/assets/screenshots/dashboard-overview.png)

## Architecture highlights

What makes this stand out beyond a typical portfolio app:

- **Repository pattern across 8 domains.** Same contract for opportunities,
  content, weekly brief, settings, chief, capture, journal, and reminders:
  normalize → read/write from the active source (`local` vs `supabase`) →
  emit cross-tab events for lightweight synchronization.
- **Versioned-envelope local storage.** `src/lib/dataSchema.js` declares each
  domain's schema version; `versionedStorage` writes
  `{ schemaVersion, domain, model, data }` and rejects envelopes whose `domain`
  doesn't match the read site (the "wrong key swap" failure mode). A
  forward-compat migration registry lifts older payloads transparently.
- **Optimistic concurrency for local CRUD.** Records stamp `updatedAt` and
  reject stale saves with a typed `StaleRecordError`. `useCrudPage` surfaces
  the conflict as a friendly form message and refreshes the list under the
  open modal so closing it reveals the up-to-date row.
- **Corruption preservation, not silent loss.** When a JSON parse fails,
  `storageCorruption.js` preserves the corrupt blob under `${key}__corrupt_<ts>`
  and emits an event; a non-blocking `StorageCorruptionBanner` tells the user.
- **Offline write queue.** Recoverable Supabase failures enqueue a FIFO-trimmed
  replay batch (`offlineWriteQueue.js`) with stop-on-first-failure semantics
  and attempt counters. The topbar says **Pending sync** only when there are
  writes actually waiting to replay.
- **AI proxy with safe failure behavior.** `src/lib/openai.js` handles
  abort/timeout, normalizes tool-like and plain-text outputs, and falls back
  to a deterministic action plan labelled as such — never a blank panel.
- **A11y automation in CI.** `@axe-core/playwright` scans every primary route
  against wcag2a/wcag2aa/best-practice; serious/critical violations fail CI.
- **Performance budgets in CI.** Per-route bundle budgets plus a trend
  regression check, with a release-governed baseline refresh workflow.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the *why* behind these
calls — design trade-offs, what's intentionally out of scope, and the JS-not-TS
migration plan.

## Quickstart

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/`.

Run the headline quality checks:

```bash
npm run verify   # lint → typecheck → test:run → build
```

or individually:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
```

## 5-minute product walkthrough

For portfolio demos or recruiter screenshares:

1. **Focus Home** — one hero ("Today's Focus" → next step → why → safe to
   ignore), a "Needs Your Attention" panel (blockers + open loops merged),
   and reminders. The daily operating rhythm and support tools (mode chips,
   "I'm overwhelmed" reset, momentum) sit below in a calm footer / drawer.
2. **Capture** — add one sticky note as `idea`, then edit text/category inline.
3. **Journal** — answer one prompt; watch the debounced autosave status.
4. **Weekly Brief + Opportunities** — add one blocker or in-progress item;
   return to Focus Home and see the recommendation update.
5. **Chief of Staff** — paste notes, reload once to show local persistence,
   pick an output type from the "Make a…" picker, generate, accept at least
   one structured recommendation (note the destination shown on each), then
   open the "Recent outputs" panel to revisit an earlier generation.

## Project layout

```text
src/
  components/   # UI primitives and per-feature components
  hooks/        # Workflow orchestration and state composition
  layouts/      # App shell behavior and route frame
  lib/          # Repositories, integration, decision logic, utilities
  pages/        # Route-level composition
  styles/       # Shared design tokens and page styles
shared/         # Cross-target constants (client + server)
server/         # Serverless proxy core (chief-of-staff, telemetry ingest)
api/            # Vercel-style serverless function entry points
netlify/        # Netlify function entry points
e2e/            # Playwright smoke + a11y specs
scripts/        # Route-budget / SLO / branch-protection tooling
docs/           # Architecture, limitations, release checklist, asset guide
```

## Quality gates

Everything the CI workflow runs, available locally:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run test:integration:telemetry
npm run test:e2e
npm run build
npm run check:route-budgets
npm run check:route-budgets:trend
npm run report:route-budgets
npx markdownlint-cli2 "**/*.md" "!node_modules/**"
```

Operational diagnostics (scheduled CI jobs):

```bash
npm run check:telemetry-ingest:health
npm run check:telemetry-ingest:slo
npm run build:slo-trend-snapshot
npm run persist:slo-trend-snapshot
npm run transition:ops-incident-state
```

### Continuous integration

GitHub Actions runs on every push to `main` and every PR:

- Markdown lint
- `npm run lint`
- `npm run build`
- `npm run test:run`
- `npm run typecheck`

The PR suite also runs route performance budget checks and Playwright smoke
tests including direct route refresh coverage for every primary route.

### Route baseline governance

- Baseline tracked in `scripts/route-performance-baseline.json`.
- Refresh is release-governed via the **Release Route Baseline Refresh**
  workflow (runs `update:route-budgets:baseline:release`).
- PR CI enforces static budgets + trend regression; publishes a
  `route-size-report` artifact.
- When `SUPABASE_TEST_URL` and `SUPABASE_TEST_SERVICE_ROLE_KEY` are present,
  CI also runs durable telemetry ingest integration tests.
- The **Scheduled Ops Alerts** workflow runs daily, checks route-size trend
  regressions plus telemetry ingest failure-rate and endpoint SLO health
  (p95 + non-2xx rate), persists snapshot rows into `ops_slo_snapshots`,
  records `open`/`acknowledged`/`recovered` transitions in
  `ops_incident_lifecycle_events`, opens or updates a tracked GitHub issue
  when thresholds are breached, and fans out to Slack/PagerDuty when
  configured.

### Branch protection automation

```bash
npm run configure:branch-protection:dry -- --repo owner/repo --branch main
```

Apply from GitHub Actions: run the **Enforce Branch Protection** workflow and
keep the required check set to `Unit + E2E`.

## Configuration

### Frontend (Vite)

- `VITE_OPENAI_PROXY_URL` (optional, defaults to `/api/chief-of-staff`)
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_APP_ERROR_TELEMETRY_URL` (optional remote ingest endpoint)
- `VITE_APP_ERROR_TELEMETRY_TOKEN` (optional shared ingest token header)
- `VITE_APP_ERROR_TELEMETRY_HMAC_SECRET` (optional HMAC signing secret;
  trusted/internal deployments only)
- `VITE_APP_ERROR_TELEMETRY_SIGNATURE_KEY_ID` (optional key-id header used
  with signed payloads)

### Server runtime

- `OPENAI_API_KEY` (required for proxy responses)
- `OPENAI_MODEL` (optional)
- `CHIEF_STAFF_PROXY_TOKEN` (optional)
- `CHIEF_STAFF_REQUIRE_TOKEN` (optional; `true` rejects requests when no
  proxy token is configured — recommended for production)
- `CHIEF_STAFF_RATE_LIMIT_PER_MINUTE` (optional)
- `APP_ERROR_TELEMETRY_INGEST_TOKEN` (optional ingest token validation)
- `APP_ERROR_TELEMETRY_HMAC_SECRET_CURRENT` / `..._NEXT` (optional rotating
  HMAC keys for ingest signature validation)
- `APP_ERROR_TELEMETRY_HMAC_NEXT_VALID_FROM` / `..._CURRENT_VALID_UNTIL`
  (optional ISO cutoffs for the rotation overlap window)
- `APP_ERROR_TELEMETRY_HMAC_SECRET` (optional legacy fallback when rotation
  keys are not configured)
- `APP_ERROR_TELEMETRY_ASYMMETRIC_PUBLIC_KEYS_JSON` (optional JSON map of
  `keyId -> PEM public key` for ed25519 verification)
- `APP_ERROR_TELEMETRY_KMS_KEYS_URL` (optional KMS-backed key distribution
  endpoint)
- `APP_ERROR_TELEMETRY_KMS_AUTH_TOKEN` (optional bearer token for the KMS
  endpoint)
- `APP_ERROR_TELEMETRY_KMS_CACHE_MS` (optional keyset cache TTL, default
  `300000`)
- `APP_ERROR_TELEMETRY_KEY_PROVIDER` (optional provider-native adapter:
  `aws-kms`, `gcp-kms`, `azure-keyvault`)
- `APP_ERROR_TELEMETRY_AWS_KMS_KEYS_JSON` /
  `APP_ERROR_TELEMETRY_GCP_KMS_KEYS_JSON` /
  `APP_ERROR_TELEMETRY_AZURE_KV_KEYS_JSON` (optional provider key maps)
- `APP_ERROR_TELEMETRY_AWS_REGION` (optional AWS region for provider lookups)
- `APP_ERROR_TELEMETRY_ROTATION_MAX_KEY_AGE_DAYS` /
  `APP_ERROR_TELEMETRY_ROTATION_MIN_ACTIVE_KEYS` /
  `APP_ERROR_TELEMETRY_ROTATION_REQUIRE_FUTURE_KEY` (optional rotation policy)
- `APP_ERROR_TELEMETRY_KEY_AUDIT_ENABLED` (optional; `false` disables key
  verification audit writes)
- `SUPABASE_SERVICE_ROLE_KEY` (required for durable telemetry ingest
  persistence)
- `APP_ERROR_TELEMETRY_RETENTION_DAYS` (optional, default `45`)
- `APP_ERROR_TELEMETRY_MAX_ROWS` (optional, default `50000`)
- `OPS_INCIDENT_SUPABASE_URL` /
  `OPS_INCIDENT_SUPABASE_SERVICE_ROLE_KEY` /
  `OPS_INCIDENT_KEY` (optional durable lifecycle state persistence)
- `TELEMETRY_INGEST_MONITOR_URL` /
  `TELEMETRY_INGEST_MONITOR_TOKEN` /
  `TELEMETRY_INGEST_MONITOR_SIGNATURE_MODE` (`hmac-sha256` or `ed25519`) /
  `TELEMETRY_INGEST_MONITOR_SIGNATURE_KEY_ID` (optional SLO probe config)
- `SLACK_OPS_WEBHOOK_URL` /
  `PAGERDUTY_EVENTS_ROUTING_KEY` (optional fanout)

## Data model

Supabase migration scripts live in `supabase/migrations/`. Primary tables:

- `opportunities`
- `content_items`
- `weekly_briefs`
- `weekly_brief_items`
- `profiles`
- `chief_sessions`
- `chief_outputs`
- `chief_telemetry_events`
- `app_error_telemetry_events`
- `app_error_telemetry_key_audit_events`
- `ops_slo_snapshots`
- `ops_incident_lifecycle_events`

## Product visuals

| Surface | Asset path | Proof focus |
| --- | --- | --- |
| Focus Home | `docs/assets/screenshots/dashboard-overview.png` | Command center, next-move flow, system signal |
| Opportunities | `docs/assets/screenshots/opportunities-pipeline.png` | Pipeline clarity, status flow, action readiness |
| Weekly Brief | `docs/assets/screenshots/weekly-brief-planning.png` | Priorities, blockers, weekly operating rhythm |
| Chief of Staff | `docs/assets/screenshots/chief-of-staff-structured-output.png` | AI output quality, structured acceptance workflow |
| Settings | `docs/assets/screenshots/settings-workspace-profile.png` | Workspace defaults, persistence source, local backup |

![Opportunities pipeline](docs/assets/screenshots/opportunities-pipeline.png)

![Weekly brief planning](docs/assets/screenshots/weekly-brief-planning.png)

![Chief of staff structured output](docs/assets/screenshots/chief-of-staff-structured-output.png)

![Settings workspace profile](docs/assets/screenshots/settings-workspace-profile.png)

Walkthrough capture: [ceo-os-workflow-walkthrough.webm](./docs/assets/demo/ceo-os-workflow-walkthrough.webm).
Suggested demo scope: focus-home → weekly planning → chief-of-staff generation
→ structured acceptance.

## Honest current boundaries

This is a local-first founder-OS prototype with production-minded architecture.
It is **not** a finished SaaS. The honest framing:

- Authentication and multi-user account UX are not yet a complete product
  experience. The magic-link surface and Supabase wiring exist; the
  account-recovery / multi-device / local-to-cloud-migration UX still needs
  product hardening.
- Supabase persistence is an upgrade path, but several local-first workflows
  still need an end-to-end authenticated regression pass against a real
  Supabase environment.
- Chief of Staff AI generation depends on deployed server secrets and proxy
  configuration. Without those, the app should be presented through its
  deterministic fallback and structured-review flow.
- Local backup import does not migrate data into Supabase.
- Operational telemetry and route-budget tooling demonstrate production
  thinking, but alert response workflows are still portfolio evidence rather
  than a fully staffed production process.

See [docs/KNOWN_LIMITATIONS.md](./docs/KNOWN_LIMITATIONS.md) for the
recruiter-facing limitation list and
[docs/PRODUCTION_TRUST_CHECKLIST.md](./docs/PRODUCTION_TRUST_CHECKLIST.md)
for the account/sync work that still separates this from a production SaaS.

## Roadmap

- Broaden integration coverage for cross-domain synchronization under
  concurrent updates.
- Add structured telemetry for AI fallback rates and acceptance outcomes.
- Expand acceptance criteria snapshots for AI-generated structured outputs.
- Migrate `src/lib/` (repositories, schemas, offline queue) to TypeScript
  with `strict: true` (planned staged migration; see ARCHITECTURE.md).

See [docs/FINAL_ROADMAP.md](./docs/FINAL_ROADMAP.md) for the phased path from
stabilization to a calmer guided operating system.

## Tracked migrations

- [MIG-CRUD-TEMPLATE-SLOTS-2026-09-30](./docs/tracking/CRUD_TEMPLATE_SLOTS_MIGRATION_2026-09-30.md):
  remove deprecated `CrudPageTemplate` legacy props (`summary`, `section`,
  `modals`) after migration to `slots.*`. **Closed.**

## Portfolio docs

- [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — design decisions and
  trade-offs.
- [CASE_STUDY.md](./CASE_STUDY.md) — interview- and recruiter-facing
  architecture summary.
- [CHANGELOG.md](./CHANGELOG.md) — date-anchored audit cycles, with the
  full timestamped trail of trust/UX/architecture improvements.
- [docs/KNOWN_LIMITATIONS.md](./docs/KNOWN_LIMITATIONS.md) — honest current
  boundaries for interview framing.
- [docs/RELEASE_CHECKLIST.md](./docs/RELEASE_CHECKLIST.md) — release-candidate
  verification steps.
- [docs/assets/README.md](./docs/assets/README.md) and
  [docs/assets/CAPTURE_GUIDE.md](./docs/assets/CAPTURE_GUIDE.md) — screenshot
  and walkthrough asset structure.

## Author

Jenna Zawaski — frontend product engineering with workflow-first architecture
focus.

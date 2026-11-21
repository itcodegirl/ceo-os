# Queue, backup recovery, and scheduled operations verification

Date: 2026-11-21. Source branch: `codex/queue-backup-recovery`.

## Changes

This release addresses audit A05, A08, A09, A10, and the workflow-start failure
in A29.

- Pending writes use native Web Locks for cross-tab mutations and a single drain.
  Duplicate create intentions retain their first operation identity. Creates also
  carry a stable server record ID, including older queued creates. Capacity is
  bounded at 200 without evicting old work. Failed queue persistence is reported.
- Retries use backoff and stop automatically after five failed attempts.
  Permanent errors become blocked actions. Later actions for the same record wait,
  while unrelated work continues. Settings exposes review, retry, export, and
  confirmed discard. Legacy actions without an account remain exportable but are
  not automatically replayed. Other accounts' actions are not shown or replayed.
- Backup selection opens a replacement preview. Confirmation validates all known
  domain values, preserves the original stores in a durable journal, then applies
  changes. A failure rolls back prior writes. If rollback also fails, editing is
  paused and recovery runs before the next application startup. Recovery preserves
  concurrent edits rather than replacing them. Original snapshots remain in
  Settings until explicitly discarded.
- Future versions, missing migration steps, wrong domain shapes, and malformed
  nested Notebook documents are rejected. Supported legacy data remains readable.
  Unreadable originals are quarantined once, without automatic archive eviction.
  Settings discovers archives on reload even if their secondary index is damaged.
  Invalid snapshots can be exported or explicitly discarded, but not blindly
  restored. If quarantine cannot be stored, the original stays in place and writes
  to that store are blocked.
- Scheduled Ops Alerts now builds production assets before checking route sizes.
  Secret-presence expressions are evaluated in job environment variables rather
  than unsupported step conditions. Manual dispatch defaults to `notify=false`,
  which suppresses incident publication, remote incident/snapshot persistence,
  Slack, and PagerDuty notifications while retaining validation artifacts.

## Local validation

- `npm run verify`: lint, typecheck, 1,060 tests passed, production build passed.
  One optional Supabase integration suite was skipped because its test credentials
  are not configured locally.
- Full Playwright regression suite: 82 tests passed. Includes laptop layouts,
  Notebook flows, ownership, prior persistence fixes, and five new recovery flows.
- Final targeted browser run: 14 tests passed, covering recovery workflows and
  all accessibility sweep routes after the final UI adjustments.
- `node scripts/check-queue-browser.mjs`: real Chromium tabs using the actual queue
  module and native Web Locks retained 40 concurrent enqueues and replayed all
  40 actions exactly once across competing drainers.
- Static and trend route budgets passed without changing their limits or baseline.
- Legacy CRUD-prop guard passed.
- Actionlint 1.7.12 validated `.github/workflows/scheduled-ops-alerts.yml`.

Fault injection covers first/middle/last primary-store write failures, failed
snapshot staging, failed rollback, newly created stores, stale previews, changed
accounts, concurrent edits, queue overflow, queue write failure, unknown actions,
retry exhaustion, older create identities, and damaged archive metadata.

Browser recovery scenarios use isolated test profiles at 1366 × 650. Production
verification should run `e2e/recovery-workflows.spec.js` against the deployed site
and compare the live entry asset to the locally verified production build.

## Scope and limits

The changes preserve the existing local-versus-cloud storage contract. Browser
recovery does not merge a backup into Supabase. Queued means pending, not saved
remotely. Web Locks are required for coordinated queue and restore operations;
unsupported browsers receive an explicit error.

Before-restore downloads include stores that existed before a successful restore.
Importing such a download does not delete stores added later. The interrupted
restore journal also records previously absent stores, so rollback can remove a
store created by the failed import.

Live workflow execution and live Netlify validation are recorded in the release
receipt and chat after deployment. A validation run without configured telemetry
credentials does not prove cloud ingest or notification delivery. Notification
channels are deliberately disabled for the manual validation run.

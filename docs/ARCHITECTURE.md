# Architecture decisions

Concise, opinionated record of the calls behind CodeHerWay CEO OS. Written for hiring managers who want to see *why*, not *what*. The README and CASE_STUDY cover the catalogue of features; this file covers the trade-offs.

## Product thesis: calm, not productive

CEO OS is a **calm founder operating system**, not another productivity dashboard. Every UX decision is filtered through a single question: *does this reduce mental load, or add to it?*

This thesis has cost real features. Examples:

- The momentum signal used to be a **0–100 percent score**. Even with mitigating copy, a numeric score nudges users toward optimisation. It now reports a qualitative state — `Visible`, `In motion`, `Steady`, `Quiet day` — and the percentage is no longer surfaced. The number is computed and kept on the data shape for analytics, but the UI deliberately doesn't show it.
- Empty states are designed as invitations, not placeholders: an outline icon, one line of supportive copy, and a clear CTA. No "0 items" stats with red badges.
- Reminders gained a **Snooze until tomorrow** verb in the same spirit. Without it, the only way to clear something off Today was to either complete it or ignore it; both create pressure. Snooze lets a founder park a commitment honestly without losing it.
- Operational surfaces (`/ops-reliability`) are flagged `meta: true` and hidden behind `?meta=1`, so a first-time portfolio reviewer sees only product surfaces.

## Local-first, with a real backend upgrade path

Every domain repository (`src/lib/*Repository.js`) reads from local storage by default. Supabase is wired in but conditional on `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`; without them the app works fully offline.

The trust story is built on three layers:

1. **Versioned storage envelope.** `src/lib/dataSchema.js` declares each domain's storage key, model shape, and `schemaVersion`. `src/lib/versionedStorage.js` writes `{ schemaVersion, domain, model, data }`; reads tolerate legacy unwrapped payloads and reject envelopes whose `domain` doesn't match the read site (the "wrong key swap" failure mode).
2. **Forward-compat migrations.** `src/lib/storageMigrations.js` ships a registry stub keyed by domain × `fromVersion`. Today the registry is empty (every domain ships v1, no work to do), but the pattern is in place so the next schema bump only requires registering a `(fromVersion) => nextData` migrator. Reads run the chain transparently.
3. **Corruption preservation.** `src/lib/storageCorruption.js` parses JSON and, on parse failure, **preserves** the corrupt blob under `${key}__corrupt_<ts>` (capped at 3 backups per key) and emits `ceo-os:storage-corruption`. The non-blocking `StorageCorruptionBanner` tells the user we kept a copy. Data loss is loud, not silent.

## Optimistic concurrency

Local Opportunities, Content OS, and Weekly Brief items stamp `updatedAt` on every write. The shared `assertRecordIsFresh` helper rejects stale saves with a typed `StaleRecordError`. `useCrudPage` surfaces the error as a friendly form message — *"This record was changed in another window."* — and refreshes the list under the open modal so closing it reveals the up-to-date row.

## Why JavaScript, not TypeScript (yet)

This is the single biggest visible gap in a 2026 hiring filter. The honest answer:

- The persistence layer (repositories, schemas, offline queue) is the place where types pay off the most. That's where the migration to TS should start.
- Page components are next, but they currently lean on `valibot` payload schemas at write boundaries to validate user input — the runtime validation isn't structurally weaker than TS prop checks for these surfaces, just less ambient.
- Migrating in one PR would mean ~150 files moving through a churn that breaks blame on every line. The plan is to migrate `lib/` → `hooks/` → `components/` → `pages/` in stages, with `strict: true` from the first commit.

The current `jsconfig.json` already runs `tsc -p jsconfig.json --noEmit` in CI, so structural type errors that JSDoc + ambient type packages can catch are caught.

## Cross-domain pub/sub via DOM events

Repositories dispatch `<DOMAIN>_UPDATED_EVENT` on the window. Consumers listen and refetch. This is intentional, with caveats:

- It works without a global store, which would otherwise be the only thing consuming the cross-domain events.
- It makes cross-tab refresh free (`storage` events feed the same handlers).
- It doesn't compose well in tests; consumers mock the events when they need to.

The shared subscription contract is now extracted into `src/hooks/useSilentRefresh.js` so consumer hooks declare *what* they care about — a list of custom event names, a list of storage keys to filter on, and an optional `forceEvents` set that bypasses the coalesce window — instead of re-implementing the same `addEventListener` boilerplate. `useDashboardData` and `useWorkspaceSettings` use it today. `useWeeklyBrief` and `useFocusHomeSignals` are intentionally kept on their existing per-event handlers (granular updaters and event-payload filters that don't fit the shared shape).

The path forward beyond pub/sub is a small Zustand or signal-based store wrapping the repositories — but only when there's a second pattern that needs the same plumbing. Premature abstraction is more expensive than the current pub/sub.

## Page boundary discipline

`Dashboard.jsx` and `Settings.jsx` were the two largest files in the repo. Recent work pulled the pure-presentational sections out of Dashboard into co-located components in `src/components/dashboard/` (`TodayFocusPanel`, `NeedsAttentionPanel`, `RemindersPanel`, `FocusModeChips`) and moved the add-reminder form state into `useReminderComposer`. The orchestration hooks (`useDashboardData`, `useFocusHomeSignals`, `useReminderActions`, `useWorkspaceSetup`) stay in the page so the test surface is preserved.

Settings is next; it remains larger because much of it is form orchestration that can't be cleanly split without restructuring the underlying state.

## Accessibility commitments

- Every primary route is scanned by `@axe-core/playwright` against `wcag2a/wcag2aa/best-practice`. Serious or critical violations fail CI.
- Semantic landmarks (`<main>`, `<nav>`, `<aside>`), a skip link in the shell, and proper label associations on all forms.
- Modal: hand-rolled focus trap with Escape + focus return. The bespoke implementation is correct; replacing internals with Radix Dialog is on the roadmap to lower the maintenance ceiling.
- `prefers-reduced-motion` is respected globally.
- `(pointer: coarse)` widens reminder action targets to 44px on touch devices without changing desktop density.

## What's intentionally out of scope

Captured here so reviewers don't have to guess:

- **Multi-user real-time collab.** This is a single-founder operating system.
- **Native mobile.** The web app is responsive; a native shell isn't.
- **Calendar integration.** A real one would change the product surface in ways that conflict with the calm thesis.
- **Streaming Chief of Staff output.** The current proxy returns structured JSON; streaming is a known follow-up.

See [`docs/KNOWN_LIMITATIONS.md`](./KNOWN_LIMITATIONS.md) for the recruiter-facing limitation list and [`docs/FINAL_ROADMAP.md`](./FINAL_ROADMAP.md) for the phased plan.

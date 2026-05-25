# Known Limitations

Use this as the honest interview framing for CodeHerWay CEO OS. The project is strong as a local-first founder operating-system prototype with production-minded architecture, but it should not be described as a finished SaaS.

## Current Boundaries

- **Screenshots in `docs/assets/screenshots/` are out of date** and do not match the current UI. They predate the calm-OS audit cycle and the restored Chief of Staff action chips. A re-capture pass is the cheapest next portfolio improvement.
- Authentication exists as a backend path, but the end-to-end account onboarding, sign-in, account recovery, and multi-user UX still need product hardening.
- Supabase persistence is implemented as an upgrade path for Opportunities, Content OS, Weekly Brief, and Settings. **Capture, Journal, and Reminders are deliberately local-only** — they have no Supabase tables and never sync, even when the user is signed in. The in-product copy on those pages now says so explicitly. To make a record part of the synced workspace, promote it (e.g. Capture sticky → Opportunity).
- Local-first workflows still need a complete authenticated regression pass against a real Supabase environment.
- In-session shell settings stay aligned with the Settings page, but authenticated multi-device and multi-tab settings reconciliation still needs broader QA.
- Chief of Staff AI generation depends on deployed server secrets and proxy configuration. Without those, the app falls back to a deterministic local template. The fallback is visibly labeled — failure is honest, not hidden.
- Local browser storage is intentionally resilient for demos and solo use, and Settings supports local JSON backup/import. Local backup import does not migrate data into Supabase.
- Operational telemetry (KMS adapters, asymmetric key rotation, ops incident lifecycle) is implemented but is **out of scope for portfolio framing** — it's defensible engineering but more elaborate than a single-founder app requires. A future cleanup PR will move it behind an `experimental/telemetry/` boundary; the main tree keeps CSP, RLS, fail-closed proxy, rate limiting, and a thin HMAC ingest.

## Items deferred from the May 2026 audit follow-up

These items were identified in the product-readiness audit and the
follow-up `improve/ceo-os-audit-priority-fixes` branch but are intentionally
out of scope for that PR:

- **"Idea" status and publish-date for Content OS.** Touches schema +
  Valibot + multiple tests; tracked for a focused follow-up.
- **Calendar view for Content OS.** Same scope concern.
- **Cmd+K command palette.** The "Keyboard shortcuts" Settings toggle was
  removed because it was disabled and unwired. Restoring a real command
  palette is the bigger feature it was placeholder for.
- **Telemetry / KMS / ops-incident scope reduction.** The audit
  recommended moving `server/appErrorTelemetry*` behind an
  `experimental/telemetry/` boundary. Not done in this PR — too large a
  surface to refactor safely without a focused PR.
- **Screenshot + walkthrough re-capture.** The visual proof artifacts need
  to be regenerated against the current UI. README now flags them as out
  of date so reviewers are not misled.

## Recently closed audit items

The May 24, 2026 architecture & code-quality audit closed these on
`improve/ceo-os-architecture-audit-2026-05` (see
[docs/audits/ceo-os-architecture-audit-2026-05-24.md](audits/ceo-os-architecture-audit-2026-05-24.md)):

- ✅ **`useSilentRefresh` migration finished.** `useFocusHomeSignals` and `useWeeklyBrief` no longer hand-roll the four-listener + coalesce wiring; they now share `useSilentRefresh` like `useDashboardData`/`useWorkspaceSettings`, so the prior "all four hooks share it" comment is true. `useFocusHomeSignals` uses `coalesceMs: 0` to preserve its fire-on-every-event timing; `useWeeklyBrief` keeps its 400ms window and moves the per-week guard to `eventFilter`. Behavior is unchanged (covered by existing hook + page tests).
- ✅ **Orphaned `ChiefRecentOutputs` removed.** Imported by no production file and superseded by `ChiefHistoryList`; the component, its test, and its `chief-recent-*` CSS are gone.
- ✅ **`expectedUpdatedAtToIso` deduplicated.** Hoisted from three repositories into `staleRecordError.js` beside its inverse `readUpdatedAtMs`.
- ✅ **`WeeklyPriorities` consolidated.** `PrioritiesSection` now uses the shared `WeeklyTextList` (as Wins/Blockers already did); the 52-line clone is deleted.
- ✅ **Storage-quota recovery deep-link.** The banner CTA now resolves `/settings#workspace-data` and Settings scrolls + focuses the Workspace Data section (reduced-motion aware), so a storage-full user lands on the Export/Clear controls.
- ✅ **Touch targets on Chief + recovery banners.** 44px `(pointer: coarse)` targets for the Chief accept / "Add all" buttons and the corruption/quota banner actions.
- ✅ **Chief fallback tint tokenized.** The last hardcoded `rgba()` on the AI-fallback badge/warning moved to a per-theme `--danger-tint-rgb`; alphas preserved, no visual change.

Still deferred after that pass (each its own PR): the telemetry/KMS
`experimental/` quarantine, a `useWorkspaceBackup` extraction from
`SettingsWorkspaceDataSection`, moving `useWeeklyBrief`'s persistence calls out
of its `setState` updaters, and `makeDuplicateValidator` / `ChiefAcceptList`
consolidation.

The May 8, 2026 senior audit pass closed these gaps on `improve/ceo-os-audit-fixes`:

- ✅ **Forward-compat schema migration registry.** `src/lib/storageMigrations.js` ships a per-domain × `fromVersion` migrator registry, wired into `readVersionedLocalStorage` so reads transparently lift legacy/older payloads into the current shape. Today the registry is empty (every domain ships v1) but the pattern is in place so the next schema bump only requires registering a single migrator function.
- ✅ **Calm momentum signal.** The Dashboard's "Momentum: NN%" pill is replaced with a qualitative state — `Visible`, `In motion`, `Steady`, `Quiet day` — read from `buildMomentumMessage().label`. The numeric score remains on the data shape for analytics but is no longer surfaced; a numeric score conflicted with the calm-OS thesis because it nudged users toward optimisation.
- ✅ **Chief-of-Staff hint on empty Focus Home.** When `buildMainFocus` reports `isEmpty: true` (no priority, opportunity, or content in motion yet), the Today's Focus hero panel surfaces a Chief-of-Staff link so first-time founders discover that they can paste raw notes and have them drafted into structure.
- ✅ **Snooze-until-tomorrow on reminders.** Reminders carry an optional `snoozedUntil` ISO timestamp; the UI offers a Snooze button on each active row that defers the reminder until tomorrow at 6 AM local. Snoozed items disappear from the active list and are reachable via "Show N snoozed". A Wake button pulls them back. Completed reminders cannot be snoozed (no-op). Reduces the binary done-or-not pressure that conflicted with the calm-OS thesis.
- ✅ **Warmer empty states.** `EmptyState` gained an optional `icon` slot rendered inside an accent-tinted bubble; wired into Opportunities, Content, and Capture so first-time list pages feel like an invitation instead of a placeholder.
- ✅ **Touch targets on touch devices.** `(pointer: coarse)` media query widens reminder action buttons (delete, promote, edit, snooze, wake) to 44px on touch devices without changing the 32px desktop density.
- ✅ **OS color-scheme + noscript fallback.** `index.html` now declares `color-scheme: dark light` and per-scheme `theme-color`, and a `<noscript>` block explains the JS requirement instead of rendering empty.
- ✅ **Dashboard page boundary discipline.** The presentational sections were extracted from `Dashboard.jsx` into co-located components in `src/components/dashboard/` (`TodayFocusPanel`, `NeedsAttentionPanel`, `RemindersPanel`, `FocusModeChips`), each with isolation tests; the add-reminder form state lives in `useReminderComposer`. Dashboard.jsx orchestrates the hooks but holds little markup.

## Earlier audit pass

The May 2026 calm-OS audit pass closed several gaps in this branch:

- ✅ **Light theme.** A `:root[data-theme="light"]` overlay and a System / Dark / Light picker in Settings, persisted locally. Raw-rgba surfaces in `system.css` and `chief-of-staff.css` are retuned in light mode.
- ✅ **Online/offline awareness.** A three-state sync pill (Synced / Local only / Offline) backed by `useOnlineStatus`.
- ✅ **Optimistic locking for local CRUD on Opportunities, Content OS, and Weekly Brief items.** `updatedAt` stamping plus `StaleRecordError` rejection prevents two-tab data loss across all three local-first surfaces.
- ✅ **Chief of Staff dedup against existing rows** — exact-match dedup against existing opportunities/content/priorities runs at every acceptance branch (re-verified in code review).
- ✅ **Cross-page promotion verbs.** Four verbs share the same `usePromotionAction` hook: Capture sticky → Dashboard reminder, Capture sticky → Opportunity, Capture sticky → Content draft, and pending reminder → weekly priority. All reuse the existing repositories, leave the source record in place, confirm via toast, and reject rapid double-clicks via a per-record in-flight guard.
- ✅ **Cross-tab list refresh.** `useCrudPage` subscribes to its repository's `*_UPDATED_EVENT` so writes from other surfaces (cross-page promotions, other tabs) silently re-fetch the current page's list without a manual reload, and refreshes keep `isLoading` false so the page never flashes a skeleton during in-page CRUD writes.
- ✅ **Composer rehydration on Capture.** Draft text and last-used category persist through `usePersistentState`; long brain-dumps survive reloads, route changes, and accidental navigation. The category stays selected after a successful save for rapid-fire batches; invalid stored values fall back safely.
- ✅ **Offline write queue for supported Supabase writes.** `offlineWriteQueue` ships with enqueue/drain/remove/clear primitives, FIFO-trimmed at 200 entries, stop-on-first-failure semantics, attempt counters, and an `OFFLINE_QUEUE_UPDATED_EVENT`. Opportunities and Content OS create/update/delete paths enqueue recoverable Supabase/network failures and the shell drains them through real replay handlers. The topbar says **Pending sync** only when writes are actually waiting to replay.
- ✅ **Intentional local setup.** Focus Home offers **Start blank** / **Load demo workspace** before a local user commits to sample records, and Settings includes **Clear demo data**. Blank mode stops automatic sample seeding for Opportunities, Content OS, and Weekly Brief while preserving user-created local records.
- **State-specific workspace trust copy.** Local-only, demo-data, blank-local, synced, offline, and pending-sync states now use separate copy so a blank local workspace no longer reads as demo/sample data.
- **Supabase timestamp coverage for Opportunity and Content OS conflict checks.** Supabase list/create/update selectors now include `updated_at`, and tests prove Supabase-loaded rows keep positive `updatedAt` values through edit saves.
- **Focused Weekly Brief Supabase item conflict coverage.** Weekly Brief item list/create/update paths now retain `updated_at`, update/delete mutations can use expected timestamps, and mocked repository tests cover stale Supabase conflicts without claiming a full authenticated regression pass.
- **Focus Home daily operating loop.** Focus Home now leads with Start Day / Execute / Capture / Reset / Shutdown, explains the recommended move, and names what is safe to ignore for the current focus block.
- **Open Loops decision support.** Focus Home and System Pulse now summarize pending reminders, blockers, unprocessed capture notes, waiting opportunities, drafting content, and journal heaviness without dumping a long list.
- **Chief structured acceptance review summary.** Chief of Staff now shows destination counts before **Add All to System**, while preserving exact-match dedup and individual accepting/accepted states.
- **Local workspace backup and data health.** Settings now summarizes local record count, backup-ready stores, pending supported sync writes, and local settings save time. Users can export/import a validated local JSON backup for known CEO OS storage keys; unknown keys are ignored and pending sync writes are reported rather than replayed from backups.
- ✅ **Expectation-safe controls.** Settings keeps unwired email digest and keyboard shortcut preferences disabled with coming-soon copy, while Weekly Brief tells users that saved priorities/blockers influence Focus Home.
- ✅ **Repository corruption preservation.** Repository JSON reads now share the same corruption-preservation path as `usePersistentState`, so malformed localStorage is backed up and surfaced instead of disappearing silently.
- **Schema-version foundation.** A central data-schema registry now tracks primary storage domains and model shapes, and Weekly Brief local storage writes a versioned envelope with legacy-read compatibility.
- ✅ **Unmount-safe promotion toasts.** `usePromotionAction` no longer fires success or failure toasts after the host component has unmounted, preventing stale-closure setState and orphaned dismiss timeouts.
- ✅ **Shared `readUpdatedAtMs` helper.** Three repositories used to inline the same timestamp parser for the optimistic-locking protocol; extracted into one helper alongside `assertRecordIsFresh`.
- ✅ **Chief notes-limit warning token.** `.chief-notes-meta--limit` no longer hardcodes a soft-pink color that fades on light paper; uses the semantic `--danger-text` token so the warning reads in both themes.
- ✅ **Accessibility automation.** `@axe-core/playwright` scans every primary route with a wcag2a/wcag2aa/best-practice rule set; test fails on serious or critical violations and reports lighter findings to the test output for review.
- ✅ **Stale-write recovery refresh.** When a save is rejected as stale, the items list re-fetches under the open modal so closing it reveals the up-to-date row instead of hiding the conflict. Non-stale errors do NOT trigger a refetch (covered by an explicit test).
- ✅ **Shared optimistic-locking helper.** Three repositories shared the same locking guard; extracted into `assertRecordIsFresh` with full back-compat semantics.
- ✅ **Light-mode polish on Focus Home, the corruption banner, and the weekly status dot.** Diagonal accent stripe softened; corruption banner amber strengthened; autosave status-dot box-shadow rings retuned with ink-on-paper halos so the pulse remains legible.
- ✅ **Tap-target hygiene on Dashboard inline link buttons.** Promote/Remove now ship at 32 px+ with a visible focus ring instead of 17 px tall.

## Open audit follow-ups

These items remain intentionally outside the current scope and are good candidates for the next iteration:

- **Account product completeness.** Authentication, account recovery, local-to-cloud migration, and multi-device UX need a full product pass before this should be sold as a complete account-based SaaS.
- **Authenticated conflict coverage beyond the focused repository tests.** Supabase-backed Opportunity, Content OS, and Weekly Brief item rows now carry `updated_at` through their covered paths, but Settings, Chief workspace, and a real authenticated staging pass across mutable tables still need validation.
- **Schema migrations across all persisted domains.** Weekly Brief has the first versioned envelope, and local backup import validates known storage keys before writing. Capture, Journal, Settings, Chief workspace, Opportunities, Content OS, reminders, and offline queue payloads still need the same migration discipline before future schema-changing imports or local-to-cloud migration can be automated safely.
- **Offline write replay coverage.** Opportunities and Content OS replay through the queue today. Weekly Brief, Chief workspace, Settings, Capture, Journal, and reminders still use explicit local/error states rather than queued replay.
- **Local-to-cloud migration.** Local JSON backup/import helps with data portability, but it intentionally does not merge local records into Supabase or resolve conflicts between local and remote workspaces.
- **Fuzzy dedup in Chief of Staff acceptance.** Exact-match dedup is in place; titles like "Q3 launch" vs "Q3 Launch Plan" still pass through. A similarity heuristic would help, but it has to balance recall against false positives that could block legitimate distinct items.
- **Light-mode polish across the remaining page-specific surfaces.** Focus Home, the corruption banner, the weekly autosave dot, the journal prompts, and the Chief notes-limit warning are tuned; production demos may still surface a few minor surface tweaks.

## Best Portfolio Framing

- Present it as a calm, local-first CEO command center with a clear backend upgrade path.
- Emphasize decision-support quality: Focus Home recommends the next action from priorities, blockers, reminders, journal signals, opportunities, and content.
- Show reliability work: explicit persistence failures, stale-record protection, app-shell error recovery, route refresh coverage, compact navigation coverage, and Playwright smoke tests.
- Mention that shell identity/timezone sync is tested end to end, while deeper account-sync scenarios remain an honest next step.
- Avoid calling it a complete company operating platform until authenticated multi-user sync, AI usage controls, and production incident response are finished.

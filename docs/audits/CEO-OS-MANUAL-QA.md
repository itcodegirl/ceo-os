# CEO OS — Manual QA Checklist

Companion to [`ceo-os-complete-audit-2026-08-30.md`](./ceo-os-complete-audit-2026-08-30.md).

Everything in this file requires a **real browser, a real device, a real screen reader, or a real
authenticated Supabase environment**. It is here because static code review cannot establish it — not
because it is optional. Items are grouped by product surface and carry stable IDs so audit findings can
reference them.

**Nothing in this list is pre-checked.** Checkboxes are unticked by design; ticking one is a claim that a
human ran it.

## How to use this

- **Expected-defect items** are marked **[REPRO]**. They describe behavior the audit predicts from code
  reading. Running them either confirms a finding or refutes it — both outcomes are valuable, and a
  refutation should be recorded in the audit's Unknown/Unverified section.
- **[AUTH]** marks items that need a real Supabase project and a signed-in session. The repository's own
  documentation states that this pass has never been completed, so this block is the single largest
  verification gap in the project.
- **[A11Y]** marks items needing a screen reader (NVDA + Firefox/Chrome, or VoiceOver + Safari). The
  automated axe sweep passes on all nine primary routes, but axe cannot establish announcement behavior,
  focus-trap correctness, or reading order.

Representative widths are taken from the breakpoints actually used in the stylesheets — **1440px**
(desktop), **1100px** and **980px** (grid transitions), **860px** (sidebar collapses to the drawer),
**700px**, **640px** and **390px** (phone). Do not test arbitrary device sizes; test these.

---

## 1. Shell, navigation and global chrome

- [ ] **MQ-SHL-01 [REPRO] [A11Y]** At 390px with the nav drawer **closed**, press Tab repeatedly from the
      hamburger. Confirm whether focus enters the collapsed navigation links (focus ring disappears, Enter
      still navigates). The audit predicts it does: `Sidebar.jsx:126` sets `hidden`, but
      `layout.css:103` declares `.sidebar__nav { display: flex }` and no `[hidden] { display: none }` rule
      exists anywhere in the stylesheets, so the author rule defeats the UA default. Then run axe at this
      viewport with the menu closed *and* open — the CI sweep only runs at desktop width, so this state is
      never scanned. *(Finding S-01)*
- [ ] **MQ-SHL-02** At 390×844 with `?meta=1` active, open the drawer and confirm all nine links —
      including Settings and Ops Reliability — are reachable. The open drawer caps at `max-height: 30rem`
      with `overflow: hidden`; nine links plus four group labels may exceed it. Repeat at 125% text zoom.
      *(S-10)*
- [ ] **MQ-SHL-03 [REPRO]** With the OS in light mode (and again with a stored `light` preference), hard-reload
      on a throttled connection. Watch for a dark frame before the light theme applies. Theming is applied
      only by a React effect inside `AppLayout`; there is no pre-hydration script and no
      `prefers-color-scheme` fallback in CSS. *(S-02)*
- [ ] **MQ-SHL-04 [REPRO]** Fresh-load `/sign-in` with a stored light preference: expect a dark page and the
      tab title `Dashboard | CodeHerWay CEO OS`. Then reach `/sign-in` by clicking through from Settings in
      light theme: expect it to render light with the previous page's title. Both routes render outside the
      shell, so they mount neither `useThemePreference` nor `usePageMeta`. *(S-02, S-08)*
- [ ] **MQ-SHL-05 [REPRO]** Scroll to the bottom of a populated Weekly Brief, then click Opportunities in the
      sidebar. Confirm whether the new page opens at the old scroll offset. There is no `window.scrollTo`,
      no `<ScrollRestoration>`, and focus uses `preventScroll: true`. Also check browser Back. *(S-03)*
- [ ] **MQ-SHL-06** Press Tab once on load: the skip link should become visible and Enter should move both
      focus and the viewport to the main content. Check at 1440px and 390px, in both themes.
- [ ] **MQ-SHL-07 [A11Y]** With `prefers-reduced-motion` enabled, confirm the drawer transition, the offline
      pill pulse, and sidebar link transitions are effectively instant.
- [ ] **MQ-SHL-08** Visit any page with `?meta=1`, then navigate normally: Ops Reliability stays in the nav
      for the tab session. Confirm `?meta=0` does **not** turn it off (by design) and that a new tab starts
      clean. Then hit `/ops-reliability` directly **without** the flag and confirm the redirect home.
- [ ] **MQ-SHL-09 [REPRO]** Cold-load the app and touch nothing. Confirm whether the topbar "Saved" pill
      appears within a second with a load-time timestamp, despite no user write. *(S-07, F-73)*
- [ ] **MQ-SHL-10** With the cache disabled and the network throttled, click a sidebar link to an unvisited
      route. Confirm the previous page remains visible (no full-screen "Loading CEO OS…" flash) and judge
      whether the unsignalled wait reads as broken.
- [ ] **MQ-SHL-11 [A11Y]** Trigger a toast (any save) and confirm whether NVDA/VoiceOver announce it. The
      live region mounts together with its content, which is unreliably announced by some pairings. Then
      trigger the offline-drain failure toast and confirm it is readable within its 2.2s life and cannot be
      paused or dismissed. *(S-05)*

## 2. Focus Home

- [ ] **MQ-FH-01 [REPRO]** Click **Start blank**, add one real weekly priority, then advance the system clock
      past the next Monday 00:00 local (or edit the versioned store's week key) and reload Focus Home and
      Weekly Brief. The audit predicts the XPAIRK demo priorities, wins and blockers reappear and that
      Today's Focus recommends demo work. Then edit anything and confirm the demo rows persist into the real
      store. *(F-02 — highest-value repro in this document)*
- [ ] **MQ-FH-02 [REPRO]** On a blank or Supabase workspace with the network throttled to Slow 3G, load `/`.
      Watch whether "Send the XPAIRK partnership proposal…" appears as Today's Focus before real data
      replaces it, and for how long. *(F-06)*
- [ ] **MQ-FH-03 [REPRO]** With no blockers, priorities, opportunities or content, add two reminders A then B.
      Confirm the hero's Next Step names **A** (oldest) while Needs Attention's "one loop worth closing"
      names **B** (newest). Then snooze the only pending reminder and confirm the hero still recommends it
      while the panel hides it. *(F-05)*
- [ ] **MQ-FH-04 [REPRO]** Click "Tell me what to do next" once on a fresh load and confirm the displayed move
      does not change, while a success toast appears. *(F-10)*
- [ ] **MQ-FH-05** Open Focus Home at 09:50 and leave the tab open until after 15:00 without navigating.
      Confirm whether the operating-rhythm strip still shows the morning step. *(F-11)*
- [ ] **MQ-FH-06** Snooze a reminder and leave the tab open past 6 AM the next day (or adjust the clock).
      Confirm it resurfaces on the next focus/visibility event without a reload.
- [ ] **MQ-FH-07** At 1280px+, check whether the Reminders panel renders half-width with an empty right
      column beneath the two full-width panels, and judge whether that reads as intentional. *(F-16)*
- [ ] **MQ-FH-08 [A11Y]** Press "I'm overwhelmed". Verify the drawer auto-open is perceivable, the reset
      panel's polite live region actually announces, and focus is not lost. Then confirm the mode persists
      across a full app restart and that the only exit is the drawer chips. *(F-12)*
- [ ] **MQ-FH-09 [A11Y]** Confirm the focus-mode chip group announces as "ADHD support layer" today
      (`FocusModeChips.jsx:45`), and that arrow-key roving tabindex works in a real browser. *(F-13)*
- [ ] **MQ-FH-10** On a coarse-pointer device, verify Edit/Promote/Snooze/Wake/Remove all hit 44px, and judge
      whether Remove is too easy to mis-tap beside Snooze given it deletes with no confirm or undo. *(F-14)*
- [ ] **MQ-FH-11 [REPRO]** Simulate a `listOpportunities` failure (Supabase unreachable). Confirm only a
      transient toast appears, no persistent error state, that the visible Retry reloads only the weekly
      brief, and that repeatedly switching tabs re-fires the toast. *(F-07)*
- [ ] **MQ-FH-12 [REPRO] [AUTH]** Signed into Supabase, look at the Reminders panel while the page-level notice
      says "Workspace sync is active". Confirm no local-only disclosure appears on the panel, and that
      reminders created there do not appear on a second device. *(F-08)*

## 3. Capture

- [ ] **MQ-CAP-01 [REPRO]** Click into an **existing** sticky and try to append " another word". Confirm
      whether the trailing space is eaten on each keystroke, whether Enter at the end is swallowed, whether
      select-all-and-delete snaps the old text back, and whether the first keystroke jumps the card to the
      top of the wall. *(F-04 — the highest-value product repro)*
- [ ] **MQ-CAP-02** Type a long brain-dump into the composer, navigate away and return, then reload the page.
      Confirm the draft and last-used category survive all three.
- [ ] **MQ-CAP-03** Promote one sticky to each destination (reminder, opportunity, content). Confirm the note
      archives behind "Show N promoted", the toast fires once, and rapid double-clicks create only one
      record. Then reveal a promoted sticky and promote it again — record what happens. *(F-19)*
- [ ] **MQ-CAP-04 [A11Y]** Create three "idea" notes and open the screen-reader rotor: confirm the promote and
      delete buttons are indistinguishable ("Delete Idea note" ×3). With Voice Control, say "click Make
      reminder" and confirm whether the accessible-name mismatch prevents activation. *(F-18)*
- [ ] **MQ-CAP-05** At 390px coarse pointer, measure the "Show N promoted" toggle (expected ~27px against the
      app's own 44px floor) and confirm the sticky control grid does not clip. *(F-21)*
- [ ] **MQ-CAP-06 [REPRO]** Open `/capture` in two tabs. Add and edit notes in tab A and confirm tab B does not
      refresh until reload; then act on a note deleted in tab A and confirm the "not found" copy. *(F-17)*
- [ ] **MQ-CAP-07** Seed ~100 notes and type into one card, on a mid-range device. Judge whether the
      per-keystroke full-array write produces perceptible lag.

## 4. Journal

- [ ] **MQ-JRN-01 [REPRO]** Type a sentence into a prompt and immediately press the browser **Back** button
      (SPA popstate, no blur). Return to `/journal` and confirm whether the text is lost. Repeat with a full
      reload, which should survive via the `beforeunload` flush. *(F-22)*
- [ ] **MQ-JRN-02 [REPRO]** Fill localStorage to the quota, type into today's entry, then switch the journal
      date. Confirm the old day's unsaved text disappears **and** the error message is cleared. *(F-22)*
- [ ] **MQ-JRN-03 [A11Y]** Focus the "What is one thing I can do next?" textarea and confirm whether its
      announced name absorbs the nested button's text. Then trigger a save failure and count the
      announcements — three live regions can fire. *(F-25, F-26)*
- [ ] **MQ-JRN-04 [REPRO]** Double-click "Make a reminder from this" and confirm two identical reminders
      appear on Focus Home. *(F-24)*
- [ ] **MQ-JRN-05** Confirm the save indicator never claims "We'll keep trying" (there is no retry) and never
      says "Saving…" while merely debounced. *(F-26)*
- [ ] **MQ-JRN-06** On iOS Safari, background the tab mid-typing and return: confirm the `visibilitychange`
      flush persisted the text.
- [ ] **MQ-JRN-07** Open `/journal` in two tabs on the same date, type into different prompts in each, let
      both autosave, and confirm the second writer clobbers the first tab's field. *(F-23)*

## 5. Weekly Brief

- [ ] **MQ-WK-01 [REPRO]** Open Weekly Brief with data and confirm the same counts render **three** times:
      the `SummaryCards` band plus two `WeeklyBriefSummary` instances. *(F-36)*
- [ ] **MQ-WK-02 [REPRO]** Add an item to any section and watch where it lands: it should appear at the top,
      then jump to the bottom ~400ms later when the silent refresh runs. *(F-35)*
- [ ] **MQ-WK-03 [REPRO]** Type into the close-of-week reflection and navigate away before the debounce fires.
      Confirm the text is lost — there is no flush on unmount, blur, or `beforeunload`. *(F-31)*
- [ ] **MQ-WK-04 [REPRO]** Type into the reflection, let a save start, and keep typing during the in-flight
      save. Confirm whether the textarea reverts to the older value when the save resolves. *(F-32)*
- [ ] **MQ-WK-05 [REPRO]** Fill storage so a save fails, then watch the error message: confirm it flashes and
      disappears while the change visibly rolls back. *(F-34)*
- [ ] **MQ-WK-06 [REPRO]** Set the machine to a UTC+ timezone (e.g. Europe/Berlin) and check which `week_start`
      the brief is stored under — expect the **Sunday** date. Compare against a UTC− timezone. *(F-29)*
- [ ] **MQ-WK-07** Leave the tab open across the Monday 00:00 boundary and confirm the rollover swaps the week
      without losing an in-progress draft.
- [ ] **MQ-WK-08** At 700px and 390px, confirm the three section cards stack cleanly and list-action targets
      are usable (they stop at 36px on touch). *(F-40)*
- [ ] **MQ-WK-09** Edit a demo-seeded item, then use "Clear demo data" and confirm whether the edited item is
      deleted. *(F-38)*

## 6. Opportunities

- [ ] **MQ-OPP-01** Full CRUD from a routed entry: create, edit, delete with confirmation. *(Automated
      coverage passes; re-verify visually after any fix to `useCrudPage`.)*
- [ ] **MQ-OPP-02 [REPRO]** Open the row-details modal, then open the edit form from it, then press **Escape
      once**. Confirm both modals close (each open modal registers its own document-level Escape handler
      with no stacking guard). Then trigger a failed save and press Escape: confirm whether the form flips
      from update to create. *(F-42)*
- [ ] **MQ-OPP-03 [REPRO]** Open `/opportunities` in two tabs, edit in tab A, and confirm tab B's list does
      **not** refresh — despite the code comment and `KNOWN_LIMITATIONS.md:92` claiming cross-tab refresh.
      Then save from tab B and confirm the stale-record conflict appears. *(F-41)*
- [ ] **MQ-OPP-04 [REPRO]** Edit a record in tab A, then delete the same record in tab B. Confirm the delete
      succeeds with no staleness warning (deletes carry no concurrency guard) and that the resulting error
      renders behind the open confirm modal. *(F-43)*
- [ ] **MQ-OPP-05 [A11Y]** With a screen reader, confirm the pipeline table still exposes row/cell semantics
      despite `display: grid` on rows. *(F-49)*
- [ ] **MQ-OPP-06** At 1100px, 860px and 390px, confirm the dense table degrades without horizontal page
      scroll and that the stacked card layout keeps actions reachable.

## 7. Content OS

- [ ] **MQ-CNT-01 [REPRO]** Confirm the create button's accessible name is **"Add a content idea or draft"**
      (not "Create a new content item"), which is why two e2e specs fail at HEAD. *(F-50)*
- [ ] **MQ-CNT-02** Walk a record through the full lifecycle: Idea → Drafting → Editing → Ready → Scheduled →
      Published, setting a publish date. Both shipped in May and both work per the schema — confirm visually.
- [ ] **MQ-CNT-03** Set a Scheduled item's date in the past and confirm it still reads "Next: \<past date\>"
      with no overdue signal. *(F-53)*
- [ ] **MQ-CNT-04 [REPRO]** While offline with Supabase configured, save an edit and confirm the source notice
      claims "No cloud replay queue is active" on a page that *does* queue. *(F-51)*
- [ ] **MQ-CNT-05** Confirm the loading skeleton matches the shipped board/table rather than the retired card
      grid. *(F-52)*

## 8. Chief of Staff

- [ ] **MQ-CHF-01 [REPRO]** On a deployment configured per `docs/CONFIGURATION.md` (with
      `CHIEF_STAFF_PROXY_TOKEN` set), click Generate. Confirm the request 401s and the UI shows the labelled
      local fallback — i.e. the documented production configuration disables live AI. Then set
      `CHIEF_STAFF_REQUIRE_TOKEN=false` and confirm live AI works, and that the endpoint answers
      unauthenticated requests from any origin. *(F-03)*
- [ ] **MQ-CHF-02** With a working proxy, generate each of the ten output types and judge honestly whether the
      result is decision leverage or formatted text. Repeat with the proxy disabled to see what a reviewer
      without a key experiences.
- [ ] **MQ-CHF-03 [REPRO]** Generate a structured output where the model omits a secondary field (no platform
      on a content idea). Accept it, then reload and confirm the item no longer shows as "Added" — and that
      the saved record carries a fabricated "LinkedIn" platform. *(F-55)*
- [ ] **MQ-CHF-04 [REPRO]** Start a generation and navigate away before it completes. Return and confirm the
      completed output was never saved. *(F-56)*
- [ ] **MQ-CHF-05 [REPRO] [AUTH]** Signed in, type a long note and watch the network panel: confirm a
      SELECT + UPDATE pair per keystroke. *(F-57)*
- [ ] **MQ-CHF-06 [REPRO]** Look for any in-product statement that Generate sends notes off-device. Confirm
      none exists while nearby copy says the workspace is stored on this device only. *(F-58)*
- [ ] **MQ-CHF-07 [REPRO]** Screenshot the accept buttons and "Add All to System" at 1440px in both themes.
      They carry no author styling and should render as native OS buttons. *(F-59)*
- [ ] **MQ-CHF-08** Accept a "task" item and confirm it lands in Weekly Brief as a **priority**, not a task,
      despite the UI promising "→ Weekly Brief task". *(F-60)*
- [ ] **MQ-CHF-09** Use "Add All to System" on a mixed output and confirm the destination counts shown
      beforehand match what is created, with no duplicates on a double-click.
- [ ] **MQ-CHF-10** Generate 31+ outputs and confirm the history caps at 30, contradicting the "nothing is
      deleted" copy. *(F-62)*
- [ ] **MQ-CHF-11** Force a malformed upstream response (proxy returning invalid JSON with a 200) and confirm
      the client degrades to the labelled fallback rather than rendering broken output. *(F-83)*

## 9. Settings

- [ ] **MQ-SET-01 [REPRO]** With user-created opportunities, content items and weekly data in a local
      workspace, click **"Load demo workspace"** in Settings. Confirm the records are replaced with demo
      seed with **no confirmation, no undo and no preserved backup**. Repeat from the Focus Home setup card.
      *(F-87 — the most destructive path found)*
- [ ] **MQ-SET-02 [REPRO]** Import a valid backup while localStorage is nearly full. Confirm whether stores
      half-apply, what error appears, and that the quota banner does **not** fire (the import loop uses raw
      `setItem`). *(F-88, F-69)*
- [ ] **MQ-SET-03 [REPRO]** Export with theme=light, switch to dark, then re-import. Confirm the app stays dark
      and the theme radios show the stale choice until a full reload. *(F-91)*
- [ ] **MQ-SET-04** Import a deliberately corrupt backup, one with unknown keys, and one claiming a newer
      schema version. Confirm all three are rejected or ignored cleanly with actionable messages and that no
      partial write occurred.
- [ ] **MQ-SET-05 [REPRO]** Fill storage, edit the workspace name, hit Save (it fails), then click **Retry**.
      Confirm the edited name silently reverts to the persisted value. *(F-90)*
- [ ] **MQ-SET-06 [REPRO]** Load demo, advance into the next ISO week, then click "Clear demo data". Confirm
      last week's demo items survive. *(F-89)*
- [ ] **MQ-SET-07** Trigger a quota save failure and click "Open workspace data" from another route and from
      `/settings` itself. Confirm scroll and visible focus land on the Workspace Data card, and that the
      motion respects `prefers-reduced-motion`.
- [ ] **MQ-SET-08 [A11Y]** Tab through the Workspace Data card: confirm the hidden file input takes focus with
      no visible indicator. *(F-95)*
- [ ] **MQ-SET-09** Verify the export downloads correctly in Safari and Firefox with the expected filename.
- [ ] **MQ-SET-10** Type in the workspace name field and profile the render: `getLocalWorkspaceDataHealth`
      JSON-parses every store per render. *(F-96)*
- [ ] **MQ-SET-11** Set an invalid timezone, then flip the autoSave toggle: confirm it moves visually while
      silently skipping persistence. *(F-97)*
- [ ] **MQ-SET-12** Keyboard-operate the three theme radios in both themes; confirm arrow-key navigation, a
      visible focus ring, and that "Match system" tracks a live OS scheme change.
- [ ] **MQ-SET-13** At 360–390px, confirm the settings grid collapses to one column, health tiles stack, the
      timezone datalist is usable on mobile, and nothing overflows horizontally.

## 10. Authentication and account

Every item here is **[AUTH]**. This block is the largest single verification gap in the project.

- [ ] **MQ-AUTH-01 [REPRO]** Sign in, create an opportunity, then immediately edit and save it. Confirm
      whether the save succeeds or throws "This opportunity was changed in another window." Repeat for a
      content item and a weekly item. **This single test decides F-01, the audit's most important finding.**
- [ ] **MQ-AUTH-02 [REPRO]** With `VITE_SUPABASE_*` set and **no** session, load `/opportunities` while
      online. Confirm the empty list, the "Unable to load…" error, and the false "Data source: Offline. No
      cloud replay queue is active." copy, with a retry that cannot succeed. *(A-03)*
- [ ] **MQ-AUTH-03 [REPRO]** Create local records while signed out, then sign in. Confirm the local records
      disappear from the lists while the sign-in page promises "an additional source rather than a
      replacement". *(A-01)*
- [ ] **MQ-AUTH-04 [REPRO]** As user A, go offline, create an opportunity (queued), sign out, sign in as user
      B, then reconnect. Confirm whether A's record is inserted into **B's** account and whether the pending
      count ever clears. *(A-02 — the cross-account path)*
- [ ] **MQ-AUTH-05** On Slow 3G, click a valid magic link and watch `/auth/callback`: confirm whether
      "Sign-in link not detected" flashes after 5s before a successful redirect, and whether the intended
      destination is preserved. *(A-06)*
- [ ] **MQ-AUTH-06** With two tabs on `/opportunities`, sign out in tab 2. Confirm what tab 1 shows and what
      happens on its next write.
- [ ] **MQ-AUTH-07** Force-expire a session, then save Settings. Confirm it silently persists locally, and
      document what happens to that local change after re-authenticating.
- [ ] **MQ-AUTH-08** On a shared browser, sign in as B after A used the app. Confirm A's Capture notes,
      Journal entries, reminders and Chief notes are still visible. *(A-04)*
- [ ] **MQ-AUTH-09 [A11Y]** Run axe plus a keyboard and screen-reader pass on `/sign-in` (all three states)
      and `/auth/callback` (spinner, timeout, error). Both routes are excluded from the automated sweep.
      *(A-05)*
- [ ] **MQ-AUTH-10** Create this week's brief from a UTC+ machine and again from a UTC− machine. Confirm
      whether two `weekly_briefs` rows with different `week_start` values exist for the same ISO week.
      *(F-29)*
- [ ] **MQ-AUTH-11** On a fresh Supabase project, attempt `supabase db push` with the repository's
      migrations. Confirm whether duplicate `20260421`/`20260424` prefixes are rejected, and — after any
      successful apply — whether the `auth.uid()` column defaults were actually set. *(F-76)*
- [ ] **MQ-AUTH-12** Using only the public anon key, query `ops_slo_snapshots`. Confirm anonymous read
      succeeds and assess whether the stored excerpts contain anything sensitive. *(F-79)*

## 11. Storage, corruption, quota and offline

- [ ] **MQ-STO-01 [REPRO]** Set `ceo-os-theme` (or `ceo-os-focus-mode`) to invalid JSON and reload. Confirm a
      `__corrupt_*` backup key is created but **no banner appears**. Then corrupt a repository key
      (`ceo-os-opportunities`) and confirm the banner does appear. *(S-04)*
- [ ] **MQ-STO-02 [REPRO]** Corrupt `ceo-os-reminders`, load Focus Home, expand "Recover data", then alt-tab
      away and back several times. Confirm whether the panel collapses each time and whether new duplicate
      backups accumulate, evicting distinct ones from the 3-slot cap. *(F-72)*
- [ ] **MQ-STO-03** Corrupt a store, use Restore, and reload. Confirm the data returns and no repeat banner
      appears.
- [ ] **MQ-STO-04** Fill localStorage near the quota, then edit a reminder. Confirm the assertive quota banner
      names the failing key and its link scrolls and focuses the Workspace Data card.
- [ ] **MQ-STO-05 [REPRO] [AUTH]** Signed in and offline, create an opportunity (note the error), retry the same
      create once, then reconnect. Confirm the duplicate entry fails permanently, wedges the queue for every
      later write, and re-toasts on each reconnect with no way to discard it. *(F-45)*
- [ ] **MQ-STO-06 [REPRO]** Signed in and offline, save an edit. Confirm the modal presents a hard failure with
      no "queued" reassurance even though the write was enqueued. *(F-45)*
- [ ] **MQ-STO-07** With two tabs open, queue a write in one and confirm the other tab's sync pill count
      updates via the real `storage` event.
- [ ] **MQ-STO-08 [A11Y]** With a screen reader, trigger the corruption and quota banners. Confirm the polite
      and assertive regions announce once each rather than repeatedly during the corruption re-fire.

## 12. Themes and visual consistency

- [ ] **MQ-THM-01** Walk every primary route in **dark**, then **light**, then **system** (with a live OS
      switch mid-session). Look for unstyled or mis-tinted surfaces.
- [ ] **MQ-THM-02 [REPRO]** Specifically screenshot the Chief of Staff accept buttons and "Add All to System"
      in both themes. *(F-59)*
- [ ] **MQ-THM-03** Confirm focus rings are visible against both backgrounds on every interactive control,
      including the ghost and small button variants.
- [ ] **MQ-THM-04** Re-capture the five README screenshots and the walkthrough video against the current UI —
      all six assets date from 2026-04-22 and show the pre-Focus-Home purple "Dashboard" UI. *(D-01)*

## 13. Responsive sweep

Run each primary route at **1440 / 1100 / 980 / 860 / 700 / 640 / 390 px**.

- [ ] **MQ-RSP-01** No horizontal page scroll at any width on any route.
- [ ] **MQ-RSP-02** The sidebar collapses to the drawer at 860px and the drawer closes on navigation.
- [ ] **MQ-RSP-03** Dense tables (Opportunities, Content OS) degrade to a usable stacked layout.
- [ ] **MQ-RSP-04** Every modal fits on a 390×844 viewport with its actions reachable without scrolling the
      page behind it, and the focus trap holds.
- [ ] **MQ-RSP-05** Long unbroken strings (a pasted URL in a note, a long opportunity name) wrap rather than
      overflow.
- [ ] **MQ-RSP-06** Coarse-pointer targets meet 44px everywhere the app claims them; specifically re-check the
      Journal reminder button and the Capture promoted toggle. *(F-21, F-28)*

## 14. Cross-cutting verification the automated suite cannot provide

- [ ] **MQ-X-01 [AUTH]** A complete authenticated regression pass across all four synced domains — the pass the
      repository's own documentation says has never been run.
- [ ] **MQ-X-02** Deploy to **Vercel** and confirm which security headers are present. There is no
      `vercel.json`, so CSP, HSTS and `frame-ancestors` are expected to be absent. *(F-80)*
- [ ] **MQ-X-03** On a Netlify deployment, POST to `/api/app-error-telemetry` and confirm it returns
      `index.html` with HTTP 200 because no redirect maps it. *(F-81)*
- [ ] **MQ-X-04** Confirm the deployed telemetry client bundle contains the `VITE_APP_ERROR_TELEMETRY_TOKEN`
      and HMAC secret values in plain text (view-source on the built asset). *(§21.2)*
- [ ] **MQ-X-05** Re-run the two failing Content OS e2e specs after fixing their selectors and confirm the
      suite reaches 31/31. *(F-50)*
- [ ] **MQ-X-06** Fix the repository Actions setting ("Allow GitHub Actions to create and approve pull
      requests") and confirm the next weekly baseline refresh succeeds — it has failed all 14 runs. *(§28)*
- [ ] **MQ-X-07** Confirm whether `Scheduled Ops Alerts` ever fires after being re-enabled; it has **zero**
      scheduled runs to date. *(§28)*
- [ ] **MQ-X-08** Load Ops Reliability with no Supabase snapshots available and confirm it renders four
      fabricated April-2026 rows under workspace-source copy. *(T-05)*

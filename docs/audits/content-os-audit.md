# Content OS — Audit & Rebuild

**Date:** 2026-05-12
**Branch:** `improve/ceo-os-product-readiness`
**Scope:** Content OS surface — workflow, content strategy, UX, data model, mobile, portfolio value
**Type:** audit + implementation (this PR ships the recommendations marked *Done*)

Content OS should help a founder move content from idea to published asset:
idea capture, drafting, review, scheduling/publishing, platform tracking,
content purpose, repurposing, and strategic consistency. It should answer
*what's planned, what needs drafting, what's ready, what's next, what supports
the brand, and what can be repurposed.*

---

## 1. Content OS assessment (before this PR)

The page worked, was accessible, and followed the same calm CRUD-template
pattern as the rest of the app — but the model was thinner than the name
promised.

| Dimension | Before | Notes |
| --- | --- | --- |
| Workflow | 4 / 10 | Status was `Drafting → Editing → Scheduled`. No idea-capture lane, no "ready" holding lane, no "published" record. The lifecycle started in the middle and stopped before the end. |
| Content strategy | 3 / 10 | No field connected a piece to *why* it exists or which priority it served. No repurposing space. No content type. The app couldn't distinguish an idea from a draft from a campaign. |
| UX | 6 / 10 | Table was scannable and keyboard-operable, but had no filters, a generic empty state ("No content items yet"), and CTAs that said "Add Content" everywhere. |
| Data model | 4 / 10 | `{ title, platform, status }` only. Useful as far as it went; missing publish date, type, purpose, and notes. Nothing unnecessary. |
| Mobile | 7 / 10 | Inherited the shared `crm-table` table→card collapse with `data-label`. Worked; just had little to show. |
| Portfolio value | 4 / 10 | Read as a Notion-table clone. No visible product thinking beyond "list of content." |

---

## 2. Current product gaps (the ones this PR closes)

1. **The lifecycle started in the middle and stopped early.** No `Idea`
   (capture), no `Ready` (drafted, awaiting a slot), no `Published` (a record
   of what shipped). → **Done:** six-stage lifecycle.
2. **No link between a piece and the strategy it serves.** → **Done:**
   `purpose` field, surfaced in the detail modal.
3. **No "what's next" answer.** Scheduled items had no date. → **Done:**
   `scheduledFor` date, a publish-date column, lifecycle-ordered sort that
   floats the soonest-dated piece, and a "Next: \<date\> — \<title\>" cue on
   the summary card.
4. **No content-type tracking.** A LinkedIn post and a conference talk looked
   identical. → **Done:** `contentType` (Post / Article / Newsletter / Video /
   Thread / Talk / Other).
5. **No repurposing space.** → **Done:** `notes` field ("angles, source
   material, where this could be reused").
6. **No filters.** → **Done:** a stage filter in `ContentBoard` (chips appear
   only when more than one stage has content; never strands you on an empty
   filter).
7. **Generic empty state / CTAs.** → **Done:** calmer, specific copy.

---

## 3. Recommended workflow (shipped)

```text
Idea  →  Drafting  →  Editing  →  Ready  →  Scheduled  →  Published
 │          │           │          │          │             │
capture   write       review/    finished,  has a date    a record of
an angle  the draft   polish     needs a    on the         what went
                                 slot       calendar       out
```

- **Idea** answers *"what's planned?"* — a parking lot of angles.
- **Drafting / Editing** answer *"what needs work?"*
- **Ready** answers *"what's ready?"* — done, just needs a slot.
- **Scheduled** answers *"what's next?"* — sorted by date.
- **Published** keeps a record (and feeds *"what can be repurposed?"* — the
  notes field on past winners).

UI supports action: every row opens a detail modal with Edit/Delete; the
summary cards point at the next concrete move ("Pick a publish date to queue
it", "Next: May 14 — …").

---

## 4. Recommended data model (shipped)

`ContentItem`:

| Field | Type | Why |
| --- | --- | --- |
| `id` | string | identity |
| `title` | string (required) | the piece |
| `platform` | string (required) | channel — LinkedIn, Newsletter, Blog, YouTube… |
| `contentType` | enum (`Post` default) | distinguishes a post from an article from a talk; drives repurposing thinking |
| `status` | enum (`Idea` default) | lifecycle stage — `Idea \| Drafting \| Editing \| Ready \| Scheduled \| Published` |
| `scheduledFor` | `YYYY-MM-DD` or blank | target publish date — powers "what's next" |
| `purpose` | string (optional) | which priority / audience this serves — strategic consistency |
| `notes` | string (optional) | repurposing ideas, source material, follow-ups |
| `updatedAt` | number | optimistic-locking timestamp (unchanged) |

Validated in `contentPayloadSchema` (picklists + date format), normalised in
`contentRepository` (camelCase ↔ snake_case), persisted via the additive
migration `20260512_content_items_lifecycle_fields.sql`. **Nothing was
removed** — all additions are backwards-compatible; legacy rows and the
existing storage envelope still load.

Deliberately *not* added (would be over-building for the scope): per-piece
analytics/metrics, multi-author assignment, campaign grouping as a separate
entity, content calendar view. Notes on these in §9.

---

## 5. Recommended UI structure (shipped)

```text
Content OS  (header: "Move founder content from idea to published…")
│
├── Summary (4 cards):
│     Ideas · In progress · Ready & scheduled (Next: …) · Published
│
└── Publishing Pipeline  [ + New Content ]
      ├── Stage filter chips:  All  Idea  Drafting  …  (only when >1 stage)
      └── Table: Title / type · Platform · Stage · Publish date · ↗ Open
            sorted by lifecycle stage, then soonest publish date
      └── Empty state: "Your content pipeline is empty" → "Capture your first idea"
      └── Detail modal: stage · type · platform · publish date · purpose · notes
      └── Form modal: title · platform · type+status · publish date · purpose · notes
```

`ContentBoard` is a new component that owns the filter + sort so `ContentTable`
stays a pure presenter and `ContentCrudPage` stays template-driven.

---

## 6. Better empty states (shipped)

| Surface | Before | After |
| --- | --- | --- |
| Whole page, no items | "No content items yet" / "Add your first draft to begin tracking your publishing pipeline." | "Your content pipeline is empty" / "Capture an idea, start a draft, or log something you have already published — every piece moves from idea to live right here." |
| Filtered to a stage | n/a | `ContentBoard` never lands you on an empty filtered view — if the active stage loses its last item it falls back to *All*. |

---

## 7. Better CTA copy (shipped)

| Location | Before | After |
| --- | --- | --- |
| Section action button | "Add Content" | "New Content" (aria-label: "Add a content idea or draft") |
| Empty-state button | "Add Content" | "Capture your first idea" |
| Form submit (create) | "Create Content" | "Add to Pipeline" |
| Form submit (edit) | "Save Changes" | "Save Changes" (unchanged — already clear) |
| Row hint | "Click any row or press Enter/Space to view details." | "Click any row or press Enter/Space to open the piece." |

---

## 8. Mobile improvements (shipped / verified)

- The table keeps the shared `crm-table` behaviour: at ≤1100 px it collapses
  to one labelled card per row (`data-label` on every cell, header hidden) —
  the new Type and Publish-date cells were given labels so they stack cleanly.
- The summary grid steps 4 → 2 → 1 columns (new `≤640 px` breakpoint) instead
  of jumping straight to one column.
- The form modal's type+status pair is a 2-up grid that collapses to stacked
  fields on narrow screens.
- Filter chips wrap.
- Cards-vs-tables verdict: the labelled-card collapse is the right call here —
  it preserves the same scan order on phone and desktop without a second
  layout to maintain. No change needed beyond the new labels.

---

## 9. Architecture recommendations

### Shipped this PR

- New `src/lib/contentFormatting.js` (`formatPublishDate`, `contentStatusRank`,
  `findNextScheduledItem`) — pure, unit-tested, shared by the table, board,
  detail modal, and summary.
- `ContentBoard` separates filter/sort state from presentation.
- Schema-driven picklists (`CONTENT_STATUSES`, `CONTENT_TYPES`) exported once
  and reused by the form and the board — no string duplication.
- Additive Supabase migration; repository tolerates both camelCase and
  snake_case rows.

### Follow-up (not in scope here)

- **Calendar view** of `Scheduled` / `Ready` items keyed on `scheduledFor` —
  the data now supports it.
- **Repurposing surfacing:** a "repurpose from" picker that links a new draft
  to a `Published` parent, so the notes field becomes a real graph rather than
  freeform text.
- **Chief of Staff handoff:** when the Chief generates a content item, carry
  `contentType` / `purpose` through `chiefStructuredPayload` instead of just
  title/platform/status.
- **Campaign grouping** if/when content volume justifies it — a `campaign`
  tag, not a separate entity, to keep the model calm.
- **Schema versioning:** Content OS still rides the v1 envelope without a
  domain-specific migration step (same gap as Settings/Capture/Journal flagged
  in the product-readiness audit) — fold it into that workstream rather than a
  one-off here.

---

*Implementation: see commits `improve(content): expand Content OS data model…`
and `improve(content): rebuild Content OS UI…` on this branch.*

# Workspace UX contract

## Scope and evidence

This records the shared layout and touched workflows. Product and data
rules remain in README.md and docs/ARCHITECTURE.md. Known account and sync
limits remain in docs/KNOWN_LIMITATIONS.md. This is not a new permission,
retention, or billing policy.

Visual intent and runtime token ownership are documented in DESIGN.md.
Both existing themes must retain readable text, visible focus, and usable
controls. English labels are maintained; dates use the existing Intl and
workspace-time-zone behavior.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Select/Listbox | Native select with forms.css or ChiefOutputPicker | Existing forms and DESIGN.md | Platform-owned popup | Capture keyboard/browser tests |
| Form | Input, Textarea, forms.css, page validation handlers | Existing repositories and field components | Explicit create, inline edit, autosave | Page tests and CRUD E2E |
| Toast | ToastProvider and useToast | Shared provider | Existing status feedback | Provider and promotion tests |
| CRUD | Domain repositories and useCrudPage | docs/ARCHITECTURE.md | Local and configured account-backed flows | CRUD smoke and repository tests |
| Scrollbar | Browser-native scrolling; layout.css geometry | DESIGN.md | Document, textarea, sidebar | Reflow and laptop browser checks |
| Disclosure | Native details/summary | AppLayout | Workspace signals after main workflow | Keyboard laptop regression |

## Workflow commitments

- Capture drafts survive navigation and reload. Save creates a local note;
  edits, categories, promotion destinations, and deletion retain their
  existing repository behavior. Failure keeps the composer draft and
  presents its associated error. No storage migration is part of layout work.
- Local-only and demo notices remain visible and accurate. Dismissing the
  local-only notice remains an explicit choice, remembered on this device.
- Source errors and retry controls remain visible near the relevant data.
- Focus Home keeps setup available below the daily workflow. Moving its
  controls does not run a setup action or modify records.
- Weekly Brief exposes a single copyable summary after the editable sections.
- Workspace signals expand with native keyboard interaction and return to
  the collapsed state on route changes. Main-content navigation focus and
  error-boundary recovery remain owned by AppLayout.
- Opportunities and Content OS share CrudPageTemplate; the pipeline precedes
  summary metrics in DOM and reading order.
- Compact layouts preserve labels and touch targets. At narrower widths,
  content stacks and the document scrolls; extra records need not fit within
  one screen. Table overflow remains the table's responsibility.

## Verification and limits

Run npm run verify and relevant Playwright flows after shared layout changes.
The primary controls should fit a fresh 650px-high laptop viewport with the
local-only notice still visible. Test both themes, direct route entry,
keyboard controls, and reflow down to 320 CSS pixels.

This contract records existing implementation boundaries; it does not claim
full screen-reader, device, authenticated sync, or WCAG certification.

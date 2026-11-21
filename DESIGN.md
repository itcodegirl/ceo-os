---
version: alpha
name: CodeHerWay CEO OS
description: A calm founder workspace with a navy blueprint identity and task-first layouts.
colors:
  primary: "#3cb9ff"
  background: "#060f1d"
  text: "#eef6ff"
  muted: "#a0b9d1"
  success: "#7be5bc"
typography:
  sans:
    fontFamily: '"Inter Variable", "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
  mono:
    fontFamily: '"IBM Plex Mono", "Consolas", "Menlo", monospace'
spacing:
  card-padding: "1rem"
  page-section-gap: "1rem"
  page-intro-vertical: "0rem"
omitted:
  - section: rounded
    reason: Existing radius tokens in src/styles/tokens.css remain canonical.
components:
  button: {}
  card: {}
  input: {}
---

# CodeHerWay CEO OS design

## Product context

The README and docs/ARCHITECTURE.md define a calm, local-first operating
system for a founder. The primary task should appear before setup,
secondary metrics, and explanatory content. This is a working application,
with English interface copy and browser-localized dates; the topbar follows
the workspace time zone. No additional market requirements are assumed.

## Visual identity and token ownership

The established signature is the navy blueprint background, blue actions,
quiet borders, and Inter typography. Preserve the existing dark and light
themes. Surface, text, focus, and semantic color values remain owned by
src/styles/tokens.css. This file documents that source; it does not generate
CSS or introduce a second theme. The frontmatter colors describe dark mode.

Mapping: tokens.css → base.css → shared component/layout styles → route
styles. Button owns action states; forms.css owns input surfaces and focus
rings; SummaryCards owns summary markup. Route code consumes these owners.
Contrast tests live in src/styles/tokens.contrast.test.js.

## Layout and density

- Keep body text readable. Recover space from duplicate content, generous
  margins, stacked metadata, and oversized containers before reducing type.
- Page headers use no additional vertical margin; the page's section gap
  provides separation. Cards and page section gaps use the tokens above.
- Desktop navigation uses a 210–250px responsive column. The header starts
  at 72px and grows when content needs to wrap. Navigation retains 44px
  minimum targets. Existing mobile navigation starts at 860px.
- Capture uses a 17–20rem composer alongside its notes at 1000px and above;
  narrower layouts stack in reading order. Cards wrap without clipping.
- Workspace signals are a native disclosure after the main workflow on
  applicable routes. Capture and Notebook have no extra signal strip.
- Focus Home places its primary action before safe-to-ignore guidance and
  setup below daily work. Weekly Brief has one summary after its editors.
- Opportunities and Content OS put the pipeline before summary metrics,
  keeping the first record and create action in the initial laptop viewport.
- Chief of Staff bounds the initial notes field with viewport-relative
  height; longer notes remain scrollable. Generate precedes supporting hints.
- Preserve natural document scrolling. Do not force whole pages into fixed
  viewport heights or hide content to make a screenshot fit.

## Interaction and verification

Reuse visible labels, shared Button states, native category selects, and
existing error recovery. Native select popup geometry is platform-owned.
Capture fields explicitly import forms.css, including on direct navigation.
No new animations are introduced; global reduced-motion rules still apply.

The laptop regression suite in e2e/laptop-layout.spec.js checks primary
controls at 1280×650 and 1366×650, plus narrow-screen reflow. Browser
screenshots, keyboard checks, the route accessibility sweep, and the
repository verify command complement these layout assertions.

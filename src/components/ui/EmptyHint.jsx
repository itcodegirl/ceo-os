/**
 * Inline empty-state line — the single-paragraph "no X yet" message used
 * inside list panels, charts, and feed sections. Distinct from <EmptyState>
 * (hero empty for a full page/card surface): <EmptyHint> is small,
 * one-line, and lives alongside related controls.
 *
 * Enforces a consistent a11y contract (`role="status"` + polite live region)
 * so screen readers announce the "nothing here yet" state as it appears.
 * Replaces a previously scattered pattern of `<p class="helper-text">` lines
 * that sometimes had the live region wiring and sometimes did not.
 *
 * Accepts `children` so callers can include links / inline elements in the
 * message; accepts an optional `className` for page-specific layout tweaks
 * (e.g. <EmptyHint className="momentum-chart__empty">).
 */
function EmptyHint({ children, className = '' }) {
  const composed = className ? `helper-text ${className}` : 'helper-text';
  return (
    <p className={composed} role="status" aria-live="polite">
      {children}
    </p>
  );
}

export default EmptyHint;

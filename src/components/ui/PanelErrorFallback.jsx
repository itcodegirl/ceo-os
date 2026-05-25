/**
 * Calm, accessible fallback rendered when an ErrorBoundary around a
 * Focus Home panel (or any focus-panel-shaped surface) catches an error.
 *
 * Before this primitive existed, every panel inlined its own
 * `<article className="focus-panel" aria-label="...">
 *    <p className="calm-copy">... couldn’t load. Refresh the page to retry.</p>
 *  </article>`
 * fallback inside the ErrorBoundary, producing several near-identical copies
 * across Dashboard, TodayFocusPanel, NeedsAttentionPanel, and RemindersPanel.
 * Centralising the markup keeps the recovery copy and the focus-panel
 * shape consistent — and makes calm-OS copy edits a one-place change.
 *
 * Props:
 *   - panelName: User-facing name of the panel ("Reminders", "Needs your
 *                attention", …). Used both in the visible copy and as the
 *                aria-label suffix.
 *   - panelClassName: Optional override; defaults to "focus-panel". Set this
 *                     when the live panel uses a modifier class so the
 *                     fallback occupies the same grid slot (e.g. the
 *                     "Today's Focus" hero uses "focus-panel--main focus-panel--hero").
 *   - ariaLabel: Optional override of the computed aria-label.
 */
function PanelErrorFallback({
  panelName,
  panelClassName = 'focus-panel',
  ariaLabel,
}) {
  const effectiveAriaLabel = ariaLabel || `${panelName} panel`;

  return (
    <article className={panelClassName} aria-label={effectiveAriaLabel}>
      <p className="calm-copy">
        {panelName} couldn’t load. Refresh the page to retry.
      </p>
    </article>
  );
}

export default PanelErrorFallback;

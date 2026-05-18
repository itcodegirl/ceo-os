/**
 * Shared page-level loading message. Replaces three drifted patterns
 * (sr-only-only on WeeklyBrief, role-less helper text on OpsReliability,
 * status helper on Settings) so every load surface gets the same a11y
 * contract — `role="status"` with `aria-live="polite"` — and a consistent
 * visible treatment.
 *
 * Variants:
 *   - "inline" (default): visible helper-text line.
 *   - "sr-only": announces to assistive tech only. Use when a visible
 *     skeleton or summary card is already carrying the visual load state.
 *
 * The component renders nothing when `visible` is false so callers can
 * inline it without a conditional wrapper:
 *
 *   <PageLoading visible={isLoading} label="Loading settings" />
 */
function PageLoading({ visible = true, label = 'Loading', variant = 'inline' }) {
  if (!visible) {
    return null;
  }

  const className = variant === 'sr-only' ? 'sr-only' : 'helper-text';
  // Three dots match the established convention across pre-existing
  // loading copy ("Loading settings...", "Loading reliability snapshots...").
  // Callers pass labels without punctuation; we append.
  const text = /[.!?]$/.test(label) ? label : `${label}...`;

  return (
    <p className={className} role="status" aria-live="polite">
      {text}
    </p>
  );
}

export default PageLoading;

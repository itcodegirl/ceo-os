import ErrorBoundary from '../ui/ErrorBoundary';
import PanelErrorFallback from '../ui/PanelErrorFallback';

/**
 * "Needs Your Attention" panel on Focus Home.
 *
 * Merges the former Blockers and Open Loops cards: blockers and open loops
 * are the same question asked twice ("what is stuck?"), and the open-loops
 * summary already ingests the weekly blockers. One panel, age/severity
 * ordered upstream, with the single recommended loop to close.
 *
 * Pure presentation — receives the pre-built `openLoops` object from
 * buildOpenLoopsSummary plus the flattened blocker strings and a flag for
 * whether any real blockers exist.
 */
function NeedsAttentionPanel({ blockerItems = [], hasBlockers = false, openLoops }) {
  return (
    <ErrorBoundary
      name="Dashboard / Needs attention"
      fallback={(
        <PanelErrorFallback panelName="Needs your attention" />
      )}
    >
      <article className="focus-panel focus-panel--attention" aria-label="Needs your attention panel">
        <div className="focus-panel__header">
          <h2>Needs Your Attention</h2>
          <span className="signal-node" aria-hidden="true" />
        </div>
        <p className="calm-copy">{openLoops.headline}</p>

        {hasBlockers ? (
          <ul className="focus-list" aria-label="Blockers">
            {blockerItems.map((item, index) => (
              <li key={`blocker-${index + 1}`}>
                <span className="focus-home__attention-tag">Blocker</span> {item}
              </li>
            ))}
          </ul>
        ) : (
          <p className="helper-text">
            {blockerItems[0] || 'No blockers logged. Keep protecting this focus window.'}
          </p>
        )}

        {openLoops.items.length ? (
          <ul className="focus-list focus-list--compact" aria-label="Open loops summary">
            {openLoops.items.slice(0, 4).map((item) => (
              <li key={item.id}>
                <strong>{item.count}</strong> {item.label}
              </li>
            ))}
          </ul>
        ) : null}

        <p className="focus-home__loop-close">
          <strong>One loop worth closing:</strong> {openLoops.suggestedLoop}
        </p>
        <p className="helper-text">{openLoops.canWait}</p>
      </article>
    </ErrorBoundary>
  );
}

export default NeedsAttentionPanel;

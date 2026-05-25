import { Link } from 'react-router-dom';
import Button from '../ui/Button';
import ErrorBoundary from '../ui/ErrorBoundary';
import PanelErrorFallback from '../ui/PanelErrorFallback';

/**
 * Hero panel on Focus Home — the single "one thing" surface.
 *
 * It walks the executive-briefing questions in order:
 *   what matters today  →  the next small step  →  why that step  →
 *   the one button to act  →  what's safe to ignore.
 *
 * This merges the former "Today's Main Focus" and "Next Smallest Action"
 * cards so the page leads with one hero instead of two competing ones.
 *
 * When mainFocus.isEmpty is true (no priority, opportunity, or content in
 * motion yet), the panel surfaces a Chief-of-Staff hint so first-time
 * founders discover that they can paste raw notes and let the AI draft a
 * starting structure for them.
 */
function TodayFocusPanel({
  mainFocus,
  nextMove,
  nextMoveReason,
  safeToIgnoreItems = [],
  onDoThisNext,
  onOverwhelmed,
  isFocusDataLoading,
}) {
  const safeToIgnore = safeToIgnoreItems.length
    ? safeToIgnoreItems
    : ['Nothing else needs attention during this focus block.'];

  return (
    <ErrorBoundary
      name="Dashboard / Today focus"
      fallback={(
        <PanelErrorFallback
          panelName="Today focus"
          panelClassName="focus-panel focus-panel--main focus-panel--hero"
        />
      )}
    >
      <article className="focus-panel focus-panel--main focus-panel--hero" aria-label="Today's focus panel">
        <div className="focus-panel__header">
          <h2>Today's Focus</h2>
          <span className="signal-node" aria-hidden="true" />
        </div>
        <p className="focus-home__main-focus">{mainFocus.title}</p>
        <p className="calm-copy">{mainFocus.context}</p>
        {mainFocus.isEmpty ? (
          <p className="focus-home__empty-hint">
            Or paste raw notes into{' '}
            <Link className="focus-home__empty-hint-link" to="/chief-of-staff">
              Chief of Staff
            </Link>{' '}
            and let it draft a starting structure for you.
          </p>
        ) : null}

        <div className="focus-home__next-step">
          <p className="focus-home__subheading">Next step</p>
          <p className="focus-home__next-move-text">{nextMove}</p>
          <p className="focus-home__next-move-reason">{nextMoveReason}</p>
        </div>

        <div className="focus-home__safe-ignore" aria-label="Safe to ignore for now">
          <p className="focus-home__subheading">Safe to ignore for now</p>
          <ul className="focus-home__safe-ignore-list">
            {safeToIgnore.map((item, index) => (
              <li key={`safe-ignore-${index + 1}`}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="focus-home__actions">
          <Button type="button" onClick={onDoThisNext} icon={{ name: 'action' }}>
            Tell me what to do next
          </Button>
        </div>
        <p className="focus-home__reset-trigger helper-text">
          Feeling the pressure spike?{' '}
          <Button type="button" variant="ghost" size="small" onClick={onOverwhelmed} icon={{ name: 'warning', size: 12 }}>
            I'm overwhelmed
          </Button>
        </p>

        {isFocusDataLoading ? (
          <p className="helper-text" role="status" aria-live="polite">
            Loading your focus context...
          </p>
        ) : null}
      </article>
    </ErrorBoundary>
  );
}

export default TodayFocusPanel;

import EmptyHint from '../ui/EmptyHint';

function formatEventTimestamp(value) {
  if (typeof value !== 'string' || !value.trim()) {
    return 'Unknown time';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 'Unknown time';
  }

  return parsed.toLocaleString();
}

function formatEventLabel(eventName) {
  if (typeof eventName !== 'string' || !eventName.trim()) {
    return 'Unknown event';
  }

  return eventName
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ChiefTelemetryDiagnostics({
  source,
  recentCount,
  lastEventTimestamp,
  lastRequestId,
  lastCorrelationId,
  recentEvents = [],
  outcomeCounters,
  isLoading,
  error,
}) {
  const counters = outcomeCounters && typeof outcomeCounters === 'object'
    ? outcomeCounters
    : { saved: 0, skipped: 0, failed: 0 };
  const latestTimestampLabel = formatEventTimestamp(lastEventTimestamp);

  return (
    <div className="chief-card chief-telemetry-card" aria-live="polite">
      <div className="chief-section-header">
        <h3>Decision Engine Health</h3>
        <span className="chief-count-badge">{recentCount}</span>
      </div>

      {error ? (
        <p className="chief-telemetry-copy">{error}</p>
      ) : (
        <>
          <p className="chief-telemetry-copy">
            {isLoading
              ? 'Refreshing telemetry...'
              : `Source: ${source || 'local'} - Last event: ${latestTimestampLabel}`}
          </p>
          {!isLoading && (lastRequestId || lastCorrelationId) ? (
            <p className="chief-telemetry-copy">
              {lastRequestId ? `Request: ${lastRequestId}` : 'Request: n/a'}
              {lastCorrelationId ? ` - Correlation: ${lastCorrelationId}` : ''}
            </p>
          ) : null}

          <div className="chief-telemetry-metrics">
            <span>Saved: {counters.saved || 0}</span>
            <span>Skipped: {counters.skipped || 0}</span>
            <span>Failed: {counters.failed || 0}</span>
          </div>

          {recentEvents.length ? (
            <ul className="chief-telemetry-events">
              {recentEvents.map((event) => (
                <li key={event.id || `${event.event}-${event.timestamp}`}>
                  <span>{formatEventLabel(event.event)}</span>
                  <small>{formatEventTimestamp(event.timestamp)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint className="chief-telemetry-copy">No telemetry events yet.</EmptyHint>
          )}
        </>
      )}
    </div>
  );
}

import { useMemo } from 'react';
import ErrorBoundary from '../components/ui/ErrorBoundary';
import PageHeader from '../components/ui/PageHeader';
import SectionCard from '../components/ui/SectionCard';
import SourceStatusNotice from '../components/ui/SourceStatusNotice';
import PageLoading from '../components/ui/PageLoading';
import StatCard from '../components/ui/StatCard';
import { useOpsSloTrend } from '../hooks/useOpsSloTrend';
import { buildSourceNotice } from '../lib/uiCopy';
import '../styles/ops-reliability.css';

function formatPercent(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return `${value.toFixed(2)}%`;
}

function formatMilliseconds(value) {
  if (!Number.isFinite(value)) {
    return '--';
  }

  return `${Math.round(value)}ms`;
}

function formatDateTime(value) {
  const parsed = Date.parse(value || '');
  if (!Number.isFinite(parsed)) {
    return '--';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(parsed));
}

function formatOutcomeLabel(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) {
    return 'Unknown';
  }

  if (normalized === 'success') {
    return 'Healthy';
  }

  if (normalized === 'failure') {
    return 'Degraded';
  }

  return normalized.replace(/_/g, ' ');
}

function buildStatusTone(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'failure') {
    return 'status-chip status-chip--danger';
  }

  if (normalized === 'success') {
    return 'status-chip status-chip--success';
  }

  return 'status-chip';
}

function resolveOutcomeTone(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'failure') {
    return 'warning';
  }

  if (normalized === 'success') {
    return 'positive';
  }

  return 'neutral';
}

function resolveBudgetTone(actualValue, budgetValue) {
  if (!Number.isFinite(actualValue) || !Number.isFinite(budgetValue)) {
    return 'neutral';
  }

  return actualValue > budgetValue ? 'warning' : 'positive';
}

export default function OpsReliability() {
  const {
    snapshots,
    isLoading,
    loadError,
    source,
    refreshSnapshots,
  } = useOpsSloTrend({
    limit: 30,
  });

  const latestSnapshot = snapshots[0] || null;
  // Treat any load-blocked state as "value unknown" so cards never render a
  // misleading 0 / Unknown next to a "couldn't load" SourceStatusNotice.
  const isValueUnknown = isLoading || Boolean(loadError);
  const statCards = useMemo(() => ([
    {
      id: 'snapshot-count',
      label: 'Snapshots Tracked',
      value: isValueUnknown ? '--' : snapshots.length,
      change: latestSnapshot ? `Last capture ${formatDateTime(latestSnapshot.capturedAt)}` : 'No snapshots yet',
      tone: 'neutral',
    },
    {
      id: 'route-trend',
      label: 'Route Trend Health',
      value: isValueUnknown ? '--' : formatOutcomeLabel(latestSnapshot?.routeTrendOutcome),
      change: latestSnapshot
        ? `Ingest ${formatOutcomeLabel(latestSnapshot.telemetryHealthOutcome)}`
        : 'Awaiting first run',
      tone: resolveOutcomeTone(latestSnapshot?.routeTrendOutcome),
    },
    {
      id: 'endpoint-latency',
      label: 'Endpoint p95',
      value: isValueUnknown ? '--' : formatMilliseconds(latestSnapshot?.telemetryEndpointSloP95Ms),
      change: latestSnapshot
        ? `Budget ${formatMilliseconds(latestSnapshot.telemetryEndpointSloMaxP95Ms)}`
        : 'No latency sample yet',
      tone: resolveBudgetTone(
        latestSnapshot?.telemetryEndpointSloP95Ms,
        latestSnapshot?.telemetryEndpointSloMaxP95Ms,
      ),
    },
    {
      id: 'endpoint-errors',
      label: 'Endpoint Non-2xx',
      value: isValueUnknown ? '--' : formatPercent(latestSnapshot?.telemetryEndpointSloNon2xxRatePct),
      change: latestSnapshot
        ? `Budget ${formatPercent(latestSnapshot.telemetryEndpointSloMaxNon2xxRatePct)}`
        : 'No error-rate sample yet',
      tone: resolveBudgetTone(
        latestSnapshot?.telemetryEndpointSloNon2xxRatePct,
        latestSnapshot?.telemetryEndpointSloMaxNon2xxRatePct,
      ),
    },
  ]), [isValueUnknown, latestSnapshot, snapshots.length]);

  return (
    <section className="ops-reliability-page">
      <PageHeader
        title="Ops Reliability"
        description="Track route-size and telemetry ingest SLO trends from scheduled health runs."
      />

      <SourceStatusNotice
        source={source}
        supabaseText={buildSourceNotice('supabase', { supabasePrefix: 'SLO data source: ' })}
        localText={buildSourceNotice('local', { localPrefix: 'SLO data source: ' })}
        loadError={loadError}
        onRetry={refreshSnapshots}
        retryAriaLabel="Retry loading SLO trend snapshots"
      />

      <ErrorBoundary
        name="OpsReliability / Stat cards"
        fallback={(
          <div className="dashboard-grid dashboard-grid--stats">
            <p className="helper-text">Stat cards couldn't render. Refresh to retry.</p>
          </div>
        )}
      >
        <div className="dashboard-grid dashboard-grid--stats">
          {statCards.map((item) => (
            <StatCard
              key={item.id}
              label={item.label}
              value={item.value}
              change={item.change}
              tone={item.tone}
            />
          ))}
        </div>
      </ErrorBoundary>

      <ErrorBoundary
        name="OpsReliability / Snapshot trend"
        fallback={(
          <SectionCard title="SLO Snapshot Trend" iconName="trend">
            <p className="helper-text">
              Snapshot trend couldn't render. A row may be malformed — refresh to retry.
            </p>
          </SectionCard>
        )}
      >
        <SectionCard title="SLO Snapshot Trend" iconName="trend">
          {isLoading ? (
            <PageLoading visible label="Loading reliability snapshots" />
          ) : snapshots.length ? (
            <div className="ops-table-wrapper">
              <table className="ops-table">
                <caption className="sr-only">Recent SLO snapshot trend entries</caption>
                <thead>
                  <tr>
                    <th scope="col">Captured</th>
                    <th scope="col">Route Trend</th>
                    <th scope="col">Telemetry Health</th>
                    <th scope="col">Endpoint SLO</th>
                    <th scope="col">p95</th>
                    <th scope="col">Non-2xx</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr key={snapshot.runId}>
                      <td data-label="Captured">{formatDateTime(snapshot.capturedAt)}</td>
                      <td data-label="Route Trend">
                        <span className={buildStatusTone(snapshot.routeTrendOutcome)}>
                          {formatOutcomeLabel(snapshot.routeTrendOutcome)}
                        </span>
                      </td>
                      <td data-label="Telemetry Health">
                        <span className={buildStatusTone(snapshot.telemetryHealthOutcome)}>
                          {formatOutcomeLabel(snapshot.telemetryHealthOutcome)}
                        </span>
                      </td>
                      <td data-label="Endpoint SLO">
                        <span className={buildStatusTone(snapshot.telemetryEndpointSloOutcome)}>
                          {formatOutcomeLabel(snapshot.telemetryEndpointSloOutcome)}
                        </span>
                      </td>
                      <td data-label="p95">{formatMilliseconds(snapshot.telemetryEndpointSloP95Ms)}</td>
                      <td data-label="Non-2xx">{formatPercent(snapshot.telemetryEndpointSloNon2xxRatePct)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="helper-text">No SLO snapshots are available yet.</p>
          )}
        </SectionCard>
      </ErrorBoundary>
    </section>
  );
}

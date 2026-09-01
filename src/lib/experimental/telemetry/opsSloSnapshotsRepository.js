import { opsSloSnapshotMock } from '../../../data/opsSloSnapshotMock';
import { getSupabaseRuntime, isSupabaseRuntimeEnabled } from '../../supabaseRuntime';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeSnapshot(item) {
  return {
    runId: normalizeText(item?.runId || item?.run_id),
    capturedAt: normalizeText(item?.capturedAt || item?.captured_at),
    routeTrendOutcome: normalizeText(item?.routeTrendOutcome || item?.route_trend_outcome),
    telemetryHealthOutcome: normalizeText(item?.telemetryHealthOutcome || item?.telemetry_health_outcome),
    telemetryEndpointSloOutcome: normalizeText(item?.telemetryEndpointSloOutcome || item?.telemetry_endpoint_slo_outcome),
    telemetryHealthFailureRatePct: normalizeNumber(
      item?.telemetryHealthFailureRatePct ?? item?.telemetry_health_failure_rate_pct,
    ),
    telemetryHealthMaxFailureRatePct: normalizeNumber(
      item?.telemetryHealthMaxFailureRatePct ?? item?.telemetry_health_max_failure_rate_pct,
    ),
    telemetryEndpointSloP95Ms: normalizeNumber(
      item?.telemetryEndpointSloP95Ms ?? item?.telemetry_endpoint_slo_p95_ms,
    ),
    telemetryEndpointSloNon2xxRatePct: normalizeNumber(
      item?.telemetryEndpointSloNon2xxRatePct ?? item?.telemetry_endpoint_slo_non_2xx_rate_pct,
    ),
    telemetryEndpointSloMaxP95Ms: normalizeNumber(
      item?.telemetryEndpointSloMaxP95Ms ?? item?.telemetry_endpoint_slo_max_p95_ms,
    ),
    telemetryEndpointSloMaxNon2xxRatePct: normalizeNumber(
      item?.telemetryEndpointSloMaxNon2xxRatePct ?? item?.telemetry_endpoint_slo_max_non_2xx_rate_pct,
    ),
  };
}

function getFallbackSnapshots(limit = 30) {
  return opsSloSnapshotMock
    .slice(0, limit)
    .map((item) => normalizeSnapshot(item))
    .filter((item) => item.runId && item.capturedAt);
}

export function getOpsSloSnapshotsSource() {
  return isSupabaseRuntimeEnabled ? 'supabase' : 'local';
}

export async function listOpsSloSnapshots({ limit = 30 } = {}) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 30;

  const supabase = await getSupabaseRuntime();
  const supabaseClient = supabase ? await supabase.getSupabaseClient() : null;
  if (supabaseClient) {
    const { data, error } = await supabaseClient
      .from('ops_slo_snapshots')
      .select([
        'run_id',
        'captured_at',
        'route_trend_outcome',
        'telemetry_health_outcome',
        'telemetry_endpoint_slo_outcome',
        'telemetry_health_failure_rate_pct',
        'telemetry_health_max_failure_rate_pct',
        'telemetry_endpoint_slo_p95_ms',
        'telemetry_endpoint_slo_non_2xx_rate_pct',
        'telemetry_endpoint_slo_max_p95_ms',
        'telemetry_endpoint_slo_max_non_2xx_rate_pct',
      ].join(', '))
      .order('captured_at', { ascending: false })
      .limit(safeLimit);

    if (error) {
      throw error;
    }

    return (Array.isArray(data) ? data : [])
      .map((item) => normalizeSnapshot(item))
      .filter((item) => item.runId && item.capturedAt);
  }

  return getFallbackSnapshots(safeLimit);
}

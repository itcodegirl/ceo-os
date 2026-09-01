function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeState(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'open' || normalized === 'acknowledged' || normalized === 'recovered') {
    return normalized;
  }

  return 'recovered';
}

function normalizeIssueNumber(value) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function createHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
}

function resolveSupabaseRuntime(overrides = {}) {
  const supabaseUrl = normalizeText(
    overrides.supabaseUrl
    || process.env.OPS_INCIDENT_SUPABASE_URL
    || process.env.SUPABASE_TEST_URL
    || process.env.SUPABASE_URL,
  );
  const serviceRoleKey = normalizeText(
    overrides.serviceRoleKey
    || process.env.OPS_INCIDENT_SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_TEST_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  return {
    supabaseUrl,
    serviceRoleKey,
    configured: Boolean(supabaseUrl && serviceRoleKey && typeof fetch === 'function'),
  };
}

async function fetchPreviousIncidentState({ supabaseUrl, serviceRoleKey, incidentKey }) {
  const params = new URLSearchParams({
    select: 'next_state,created_at',
    incident_key: `eq.${incidentKey}`,
    order: 'created_at.desc',
    limit: '1',
  });

  const response = await fetch(`${supabaseUrl}/rest/v1/ops_incident_lifecycle_events?${params.toString()}`, {
    method: 'GET',
    headers: createHeaders(serviceRoleKey),
  });

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Failed to query previous incident state (${response.status})${details ? `: ${details}` : ''}`);
  }

  const rows = await response.json().catch(() => []);
  const latestRow = Array.isArray(rows) ? rows[0] : null;
  if (!latestRow || !normalizeText(latestRow.next_state)) {
    return '';
  }

  return normalizeState(latestRow.next_state);
}

async function persistIncidentTransition({
  supabaseUrl,
  serviceRoleKey,
  row,
}) {
  const response = await fetch(
    `${supabaseUrl}/rest/v1/ops_incident_lifecycle_events?on_conflict=incident_key,run_id`,
    {
      method: 'POST',
      headers: {
        ...createHeaders(serviceRoleKey),
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(row),
    },
  );

  if (!response.ok) {
    const details = await response.text().catch(() => '');
    throw new Error(`Failed to persist incident lifecycle event (${response.status})${details ? `: ${details}` : ''}`);
  }
}

export async function transitionOpsIncidentLifecycleState({
  incidentKey,
  nextState,
  transitionReason = '',
  routeTrendOutcome = '',
  telemetryHealthOutcome = '',
  telemetryEndpointSloOutcome = '',
  issueNumber = null,
  issueUrl = '',
  runId = '',
  runUrl = '',
  metadata = {},
  supabaseUrl,
  serviceRoleKey,
} = {}) {
  const normalizedIncidentKey = normalizeText(incidentKey);
  const normalizedRunId = normalizeText(runId);
  const normalizedNextState = normalizeState(nextState);
  const normalizedReason = normalizeText(transitionReason);
  const normalizedIssueUrl = normalizeText(issueUrl);
  const normalizedRunUrl = normalizeText(runUrl);
  const normalizedMetadata = metadata && typeof metadata === 'object' ? metadata : {};

  if (!normalizedIncidentKey) {
    throw new Error('incidentKey is required for incident lifecycle transitions.');
  }

  const supabaseRuntime = resolveSupabaseRuntime({ supabaseUrl, serviceRoleKey });
  if (!supabaseRuntime.configured) {
    return {
      previousState: '',
      nextState: normalizedNextState,
      stateChanged: normalizedNextState !== 'recovered',
      storage: 'transient',
    };
  }

  const previousState = await fetchPreviousIncidentState({
    supabaseUrl: supabaseRuntime.supabaseUrl,
    serviceRoleKey: supabaseRuntime.serviceRoleKey,
    incidentKey: normalizedIncidentKey,
  });
  const stateChanged = previousState
    ? previousState !== normalizedNextState
    : normalizedNextState !== 'recovered';

  const row = {
    incident_key: normalizedIncidentKey,
    previous_state: previousState,
    next_state: normalizedNextState,
    state_changed: Boolean(stateChanged),
    transition_reason: normalizedReason,
    route_trend_outcome: normalizeText(routeTrendOutcome),
    telemetry_health_outcome: normalizeText(telemetryHealthOutcome),
    telemetry_endpoint_slo_outcome: normalizeText(telemetryEndpointSloOutcome),
    issue_number: normalizeIssueNumber(issueNumber),
    issue_url: normalizedIssueUrl,
    run_id: normalizedRunId,
    run_url: normalizedRunUrl,
    metadata: normalizedMetadata,
  };

  await persistIncidentTransition({
    supabaseUrl: supabaseRuntime.supabaseUrl,
    serviceRoleKey: supabaseRuntime.serviceRoleKey,
    row,
  });

  return {
    previousState,
    nextState: normalizedNextState,
    stateChanged,
    storage: 'supabase',
  };
}

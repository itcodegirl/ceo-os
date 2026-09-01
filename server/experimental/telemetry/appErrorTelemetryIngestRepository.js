const DEFAULT_RETENTION_DAYS = 45;
const DEFAULT_MAX_ROWS = 50000;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getSupabaseUrl() {
  return normalizeText(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
}

function getServiceRoleKey() {
  return normalizeText(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getRetentionDays() {
  const parsed = Number.parseInt(process.env.APP_ERROR_TELEMETRY_RETENTION_DAYS || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_RETENTION_DAYS;
  }

  return parsed;
}

function getMaxRows() {
  const parsed = Number.parseInt(process.env.APP_ERROR_TELEMETRY_MAX_ROWS || '', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_ROWS;
  }

  return parsed;
}

function createSupabaseHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  };
}

function buildPersistenceError(message, status = 500, details = null) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function isDebugRuntime() {
  return process.env.NODE_ENV !== 'production';
}

async function runRetentionPrune({ supabaseUrl, serviceRoleKey }) {
  const pruneResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/prune_old_app_error_telemetry_events`, {
    method: 'POST',
    headers: createSupabaseHeaders(serviceRoleKey),
    body: JSON.stringify({
      retention_days: getRetentionDays(),
      max_rows: getMaxRows(),
    }),
  });

  if (!pruneResponse.ok) {
    const details = await pruneResponse.text().catch(() => '');
    if (isDebugRuntime()) {
      console.warn('App error telemetry retention prune failed.', {
        status: pruneResponse.status,
        details,
      });
    }
  }
}

export function isAppErrorTelemetryPersistenceConfigured() {
  return Boolean(getSupabaseUrl() && getServiceRoleKey() && typeof fetch === 'function');
}

export async function persistAppErrorTelemetryBatch({
  idempotencyKey,
  source,
  eventType,
  sentAt,
  events,
  requestId,
  signatureVerified = false,
}) {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey || typeof fetch !== 'function') {
    return {
      persisted: false,
      duplicate: false,
      storage: 'transient',
    };
  }

  const insertResponse = await fetch(`${supabaseUrl}/rest/v1/app_error_telemetry_events`, {
    method: 'POST',
    headers: {
      ...createSupabaseHeaders(serviceRoleKey),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      idempotency_key: idempotencyKey,
      source,
      event_type: eventType,
      sent_at: sentAt,
      events,
      event_count: Array.isArray(events) ? events.length : 0,
      request_id: requestId,
      signature_verified: Boolean(signatureVerified),
    }),
  });

  if (insertResponse.status === 409) {
    return {
      persisted: true,
      duplicate: true,
      storage: 'supabase',
    };
  }

  if (!insertResponse.ok) {
    const details = await insertResponse.text().catch(() => '');
    throw buildPersistenceError(
      'Failed to persist telemetry payload in Supabase.',
      insertResponse.status,
      details,
    );
  }

  // Run retention best-effort and do not block ingestion acknowledgement.
  void runRetentionPrune({ supabaseUrl, serviceRoleKey });

  return {
    persisted: true,
    duplicate: false,
    storage: 'supabase',
  };
}

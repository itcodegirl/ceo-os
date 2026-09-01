function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function isDebugRuntime() {
  return process.env.NODE_ENV !== 'production';
}

function isAuditEnabled() {
  const raw = normalizeText(process.env.APP_ERROR_TELEMETRY_KEY_AUDIT_ENABLED);
  if (!raw) {
    return true;
  }

  return raw.toLowerCase() !== 'false';
}

function getSupabaseUrl() {
  return normalizeText(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
}

function getServiceRoleKey() {
  return normalizeText(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function createHeaders(serviceRoleKey) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    Prefer: 'return=minimal',
  };
}

export function isTelemetryKeyAuditConfigured() {
  return Boolean(
    isAuditEnabled()
    && getSupabaseUrl()
    && getServiceRoleKey()
    && typeof fetch === 'function',
  );
}

export async function recordTelemetryKeyVerificationAudit({
  requestId = '',
  source = '',
  eventType = '',
  verificationMode = '',
  signatureKeyId = '',
  signatureAlgorithm = '',
  verificationResult = false,
  keySource = '',
  keyVersion = '',
  keyMetadata = {},
  errorCode = '',
}) {
  if (!isTelemetryKeyAuditConfigured()) {
    return {
      recorded: false,
      storage: 'transient',
    };
  }

  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  const response = await fetch(`${supabaseUrl}/rest/v1/app_error_telemetry_key_audit_events`, {
    method: 'POST',
    headers: createHeaders(serviceRoleKey),
    body: JSON.stringify({
      request_id: normalizeText(requestId),
      source: normalizeText(source),
      event_type: normalizeText(eventType),
      verification_mode: normalizeText(verificationMode),
      signature_key_id: normalizeText(signatureKeyId),
      signature_algorithm: normalizeText(signatureAlgorithm),
      verification_result: Boolean(verificationResult),
      key_source: normalizeText(keySource),
      key_version: normalizeText(keyVersion),
      key_metadata: keyMetadata && typeof keyMetadata === 'object' ? keyMetadata : {},
      error_code: normalizeText(errorCode),
    }),
  });

  if (!response.ok) {
    if (isDebugRuntime()) {
      const details = await response.text().catch(() => '');
      console.warn('Telemetry key verification audit write failed.', {
        status: response.status,
        details,
      });
    }

    return {
      recorded: false,
      storage: 'supabase',
    };
  }

  return {
    recorded: true,
    storage: 'supabase',
  };
}

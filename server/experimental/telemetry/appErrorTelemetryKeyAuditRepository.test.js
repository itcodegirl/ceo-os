import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isTelemetryKeyAuditConfigured,
  recordTelemetryKeyVerificationAudit,
} from './appErrorTelemetryKeyAuditRepository.js';

describe('server/experimental/telemetry/appErrorTelemetryKeyAuditRepository', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.APP_ERROR_TELEMETRY_KEY_AUDIT_ENABLED;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('returns transient state when audit sink is not configured', async () => {
    expect(isTelemetryKeyAuditConfigured()).toBe(false);
    const result = await recordTelemetryKeyVerificationAudit({
      requestId: 'request-1',
    });

    expect(result).toEqual({
      recorded: false,
      storage: 'transient',
    });
  });

  it('writes audit events to Supabase when configured', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    global.fetch = vi.fn(async () => ({
      ok: true,
      status: 201,
    }));

    const result = await recordTelemetryKeyVerificationAudit({
      requestId: 'request-1',
      verificationMode: 'asymmetric',
      signatureKeyId: 'kms-key',
      verificationResult: true,
    });

    expect(result).toEqual({
      recorded: true,
      storage: 'supabase',
    });
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/rest/v1/app_error_telemetry_key_audit_events',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });
});

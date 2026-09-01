import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { persistAppErrorTelemetryBatch } from './appErrorTelemetryIngestRepository.js';

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

const integrationSupabaseUrl = normalizeText(process.env.SUPABASE_TEST_URL);
const integrationServiceRoleKey = normalizeText(process.env.SUPABASE_TEST_SERVICE_ROLE_KEY);
const hasIntegrationConfig = Boolean(integrationSupabaseUrl && integrationServiceRoleKey);
const describeIntegration = hasIntegrationConfig ? describe : describe.skip;

describeIntegration('server/appErrorTelemetryIngestRepository (integration)', () => {
  const originalEnv = { ...process.env };
  const idempotencyKey = `integration-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  beforeAll(() => {
    process.env.SUPABASE_URL = integrationSupabaseUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = integrationServiceRoleKey;
    process.env.APP_ERROR_TELEMETRY_RETENTION_DAYS = '45';
    process.env.APP_ERROR_TELEMETRY_MAX_ROWS = '50000';
  });

  afterAll(async () => {
    process.env = { ...originalEnv };

    if (!hasIntegrationConfig || typeof fetch !== 'function') {
      return;
    }

    await fetch(
      `${integrationSupabaseUrl}/rest/v1/app_error_telemetry_events?idempotency_key=eq.${idempotencyKey}`,
      {
        method: 'DELETE',
        headers: {
          apikey: integrationServiceRoleKey,
          Authorization: `Bearer ${integrationServiceRoleKey}`,
          Prefer: 'return=minimal',
        },
      },
    );
  });

  it('persists a batch, returns duplicate on replay, and confirms saved contract fields', async () => {
    const payload = {
      idempotencyKey,
      source: 'codeherway-ceo-os-integration',
      eventType: 'app_error',
      sentAt: new Date().toISOString(),
      requestId: `request-${Date.now()}`,
      events: [
        {
          event: 'ui_error_boundary',
          timestamp: new Date().toISOString(),
          name: 'TypeError',
          message: 'integration-test-message',
          route: '/integration-test',
        },
      ],
      signatureVerified: true,
    };

    const firstPersistResult = await persistAppErrorTelemetryBatch(payload);
    expect(firstPersistResult).toEqual({
      persisted: true,
      duplicate: false,
      storage: 'supabase',
    });

    const duplicatePersistResult = await persistAppErrorTelemetryBatch(payload);
    expect(duplicatePersistResult).toEqual({
      persisted: true,
      duplicate: true,
      storage: 'supabase',
    });

    const selectResponse = await fetch(
      `${integrationSupabaseUrl}/rest/v1/app_error_telemetry_events?select=id,idempotency_key,event_count,signature_verified&idempotency_key=eq.${idempotencyKey}`,
      {
        headers: {
          apikey: integrationServiceRoleKey,
          Authorization: `Bearer ${integrationServiceRoleKey}`,
        },
      },
    );
    expect(selectResponse.ok).toBe(true);

    const rows = await selectResponse.json();
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      idempotency_key: idempotencyKey,
      event_count: 1,
      signature_verified: true,
    });
  }, 30_000);
});

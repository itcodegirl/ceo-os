import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  isAppErrorTelemetryPersistenceConfigured,
  persistAppErrorTelemetryBatch,
} from './appErrorTelemetryIngestRepository.js';

describe('server/experimental/telemetry/appErrorTelemetryIngestRepository', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  function createBatchInput() {
    return {
      idempotencyKey: 'batch-1',
      source: 'codeherway-ceo-os',
      eventType: 'app_error',
      sentAt: '2026-04-22T20:00:00.000Z',
      requestId: 'request-1',
      events: [
        {
          event: 'ui_error_boundary',
          timestamp: '2026-04-22T20:00:00.000Z',
          name: 'TypeError',
          message: 'Cannot read properties of undefined',
        },
      ],
      signatureVerified: true,
    };
  }

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.SUPABASE_URL;
    delete process.env.VITE_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.APP_ERROR_TELEMETRY_RETENTION_DAYS;
    delete process.env.APP_ERROR_TELEMETRY_MAX_ROWS;
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  it('reports persistence as not configured when required env vars are missing', () => {
    expect(isAppErrorTelemetryPersistenceConfigured()).toBe(false);
  });

  it('returns transient storage when persistence is not configured', async () => {
    const result = await persistAppErrorTelemetryBatch(createBatchInput());

    expect(result).toEqual({
      persisted: false,
      duplicate: false,
      storage: 'transient',
    });
  });

  it('persists telemetry payload in Supabase and triggers retention pruning', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 201 })
      .mockResolvedValueOnce({ ok: true, status: 200 });
    global.fetch = fetchMock;

    const result = await persistAppErrorTelemetryBatch(createBatchInput());

    expect(result).toEqual({
      persisted: true,
      duplicate: false,
      storage: 'supabase',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://example.supabase.co/rest/v1/app_error_telemetry_events',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'service-role-key',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://example.supabase.co/rest/v1/rpc/prune_old_app_error_telemetry_events',
      expect.objectContaining({
        method: 'POST',
      }),
    );
  });

  it('treats unique conflicts as duplicate-safe success', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 409 });

    const result = await persistAppErrorTelemetryBatch(createBatchInput());

    expect(result).toEqual({
      persisted: true,
      duplicate: true,
      storage: 'supabase',
    });
  });

  it('throws an explicit persistence error for non-conflict failures', async () => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => 'db unavailable',
    });

    await expect(persistAppErrorTelemetryBatch(createBatchInput())).rejects.toMatchObject({
      message: 'Failed to persist telemetry payload in Supabase.',
      status: 503,
      details: 'db unavailable',
    });
  });
});

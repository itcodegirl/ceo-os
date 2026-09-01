import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  APP_ERROR_TELEMETRY_EVENT,
  emitAppErrorTelemetry,
  flushAppErrorTelemetryRemote,
  isAppErrorTelemetryRemoteEnabled,
  listAppErrorTelemetryEvents,
  listPendingAppErrorTelemetryRemoteEvents,
  resetAppErrorTelemetryStateForTests,
} from './appErrorTelemetry';

describe('src/lib/experimental/telemetry/appErrorTelemetry', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    resetAppErrorTelemetryStateForTests();
  });

  it('persists and dispatches error boundary telemetry details', () => {
    const listener = vi.fn();
    window.addEventListener(APP_ERROR_TELEMETRY_EVENT, listener);

    const detail = emitAppErrorTelemetry(
      new Error('Test boundary error'),
      { componentStack: '\n in Dashboard\n in AppLayout' },
      { boundary: 'AppLayout' },
    );

    expect(detail).toMatchObject({
      event: 'ui_error_boundary',
      name: 'Error',
      message: 'Test boundary error',
      context: { boundary: 'AppLayout' },
    });
    expect(typeof detail.timestamp).toBe('string');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toMatchObject({
      event: 'ui_error_boundary',
      message: 'Test boundary error',
    });

    expect(listAppErrorTelemetryEvents()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'ui_error_boundary',
          message: 'Test boundary error',
          name: 'Error',
        }),
      ]),
    );

    window.removeEventListener(APP_ERROR_TELEMETRY_EVENT, listener);
  });

  it('retains only the latest 25 events', () => {
    Array.from({ length: 30 }).forEach((_, index) => {
      emitAppErrorTelemetry(new Error(`error-${index + 1}`), null, { batch: 'overflow-test' });
    });

    const events = listAppErrorTelemetryEvents();
    expect(events).toHaveLength(25);
    expect(events[0].message).toBe('error-30');
    expect(events[24].message).toBe('error-6');
  });

  it('flushes queued app errors to an env-gated remote endpoint in batches', async () => {
    vi.stubEnv('VITE_APP_ERROR_TELEMETRY_URL', 'https://telemetry.example.com/errors');
    vi.stubEnv('VITE_APP_ERROR_TELEMETRY_TOKEN', 'ingest-token');
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    emitAppErrorTelemetry(new Error('remote-1'), null, { source: 'test' });
    emitAppErrorTelemetry(new Error('remote-2'), null, { source: 'test' });
    await flushAppErrorTelemetryRemote();

    expect(isAppErrorTelemetryRemoteEnabled()).toBe(true);
    expect(fetchMock).toHaveBeenCalled();
    expect(listPendingAppErrorTelemetryRemoteEvents()).toHaveLength(0);
    const payload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      'Content-Type': 'application/json',
      'x-app-telemetry-token': 'ingest-token',
    });
    expect(payload.events).toHaveLength(2);
    expect(payload.events[0].message).toBe('remote-1');
    expect(payload.events[1].message).toBe('remote-2');
    expect(payload.idempotencyKey).toMatch(/^app-error:/);
  });

  it('keeps queued app errors when remote upload fails', async () => {
    vi.stubEnv('VITE_APP_ERROR_TELEMETRY_URL', 'https://telemetry.example.com/errors');
    const fetchMock = vi.fn(async () => ({ ok: false }));
    vi.stubGlobal('fetch', fetchMock);

    emitAppErrorTelemetry(new Error('remote-fail'), null, { source: 'test' });
    await flushAppErrorTelemetryRemote();

    expect(fetchMock).toHaveBeenCalled();
    expect(listPendingAppErrorTelemetryRemoteEvents()).toHaveLength(1);
  });

  it('adds an HMAC signature header when telemetry signing secret is configured', async () => {
    vi.stubEnv('VITE_APP_ERROR_TELEMETRY_URL', 'https://telemetry.example.com/errors');
    vi.stubEnv('VITE_APP_ERROR_TELEMETRY_HMAC_SECRET', 'hmac-secret');
    vi.stubEnv('VITE_APP_ERROR_TELEMETRY_SIGNATURE_KEY_ID', 'telemetry-key-2026-04');
    const fetchMock = vi.fn(async () => ({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    emitAppErrorTelemetry(new Error('remote-signed'), null, { source: 'test' });
    await flushAppErrorTelemetryRemote();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1].headers).toMatchObject({
      'x-app-telemetry-signature': expect.stringMatching(/^sha256=/),
      'x-app-telemetry-signature-key-id': 'telemetry-key-2026-04',
    });
  });
});

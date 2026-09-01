import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './app-error-telemetry.js';
import * as core from '../server/experimental/telemetry/appErrorTelemetryIngestCore.js';

describe('api app-error-telemetry handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('forwards request fields and serializes the core response', async () => {
    const coreSpy = vi.spyOn(core, 'handleAppErrorTelemetryIngest').mockResolvedValue({
      status: 202,
      body: { ok: true, accepted_count: 1 },
    });
    let statusCode = null;
    let body = null;

    await handler(
      {
        method: 'POST',
        body: { events: [] },
        headers: { 'x-app-telemetry-token': 'token' },
      },
      {
        status: (code) => {
          statusCode = code;
          return {
            json: (json) => {
              body = json;
            },
          };
        },
      },
    );

    expect(coreSpy).toHaveBeenCalledWith({
      method: 'POST',
      body: { events: [] },
      headers: { 'x-app-telemetry-token': 'token' },
      rawBody: JSON.stringify({ events: [] }),
    });
    expect(statusCode).toBe(202);
    expect(body).toEqual({ ok: true, accepted_count: 1 });
  });
});

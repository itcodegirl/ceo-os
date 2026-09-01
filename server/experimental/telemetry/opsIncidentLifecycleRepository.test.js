import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transitionOpsIncidentLifecycleState } from './opsIncidentLifecycleRepository.js';

describe('server/experimental/telemetry/opsIncidentLifecycleRepository', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
    delete process.env.OPS_INCIDENT_SUPABASE_URL;
    delete process.env.OPS_INCIDENT_SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_TEST_URL;
    delete process.env.SUPABASE_TEST_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('returns transient state when supabase runtime is unavailable', async () => {
    const result = await transitionOpsIncidentLifecycleState({
      incidentKey: 'owner/repo:scheduled-ops-alert',
      nextState: 'open',
    });

    expect(result).toEqual({
      previousState: '',
      nextState: 'open',
      stateChanged: true,
      storage: 'transient',
    });
  });

  it('persists transition events and marks changed states', async () => {
    process.env.OPS_INCIDENT_SUPABASE_URL = 'https://supabase.example.com';
    process.env.OPS_INCIDENT_SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([{ next_state: 'open' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await transitionOpsIncidentLifecycleState({
      incidentKey: 'owner/repo:scheduled-ops-alert',
      nextState: 'acknowledged',
      transitionReason: 'Issue labelled as acknowledged',
      runId: '12345',
      runUrl: 'https://github.com/owner/repo/actions/runs/12345',
    });

    expect(result).toEqual({
      previousState: 'open',
      nextState: 'acknowledged',
      stateChanged: true,
      storage: 'supabase',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const persistCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(persistCallBody).toMatchObject({
      incident_key: 'owner/repo:scheduled-ops-alert',
      previous_state: 'open',
      next_state: 'acknowledged',
      state_changed: true,
      run_id: '12345',
    });
  });

  it('does not treat first healthy run as a changed recovery state', async () => {
    process.env.OPS_INCIDENT_SUPABASE_URL = 'https://supabase.example.com';
    process.env.OPS_INCIDENT_SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        text: async () => '',
      });
    vi.stubGlobal('fetch', fetchMock);

    const result = await transitionOpsIncidentLifecycleState({
      incidentKey: 'owner/repo:scheduled-ops-alert',
      nextState: 'recovered',
      runId: '12346',
    });

    expect(result).toEqual({
      previousState: '',
      nextState: 'recovered',
      stateChanged: false,
      storage: 'supabase',
    });

    const persistCallBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(persistCallBody.state_changed).toBe(false);
  });
});

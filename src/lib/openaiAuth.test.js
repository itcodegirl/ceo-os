import { afterEach, describe, expect, it, vi } from 'vitest';

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock('./supabaseRuntime', () => ({ getSupabaseRuntime: async () => ({
  getSupabaseClient: async () => ({ auth: { getSession } }),
}) }));
import { generateChiefOfStaffResponse } from './openai';
afterEach(() => vi.unstubAllGlobals());

describe('Chief browser authentication', () => {
  it('sends only the current short-lived session credential to the proxy', async () => {
    getSession.mockResolvedValue({ data: { session: { access_token: 'user-session-token' } } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ output_text: 'Ready' }) }));
    expect((await generateChiefOfStaffResponse({ actionKey: 'plan', notes: 'Test' })).source).toBe('proxy');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer user-session-token');
    expect(fetch.mock.calls[0][1].headers['x-chief-staff-token']).toBeUndefined();
  });

  it('keeps signed-out fallback explicit and sends no credential', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401,
      text: async () => JSON.stringify({ error: 'Sign in to use AI generation', error_code: 'PROXY_AUTH_INVALID' }) }));
    const result = await generateChiefOfStaffResponse({ actionKey: 'plan', notes: 'Test' });
    expect(result).toMatchObject({ source: 'fallback', errorCode: 'PROXY_AUTH_INVALID' });
    expect(fetch.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });
});

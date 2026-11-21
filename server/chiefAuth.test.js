import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleChiefOfStaffProxy } from './chiefOfStaffProxyCore.js';

beforeEach(() => {
  vi.stubEnv('CHIEF_STAFF_REQUIRE_TOKEN', 'true');
  vi.stubEnv('CHIEF_STAFF_PROXY_TOKEN', 'server-only-token');
  vi.stubEnv('SUPABASE_URL', 'https://controlled-project.supabase.co');
  vi.stubEnv('SUPABASE_ANON_KEY', 'public-project-key');
  vi.stubEnv('OPENAI_API_KEY', 'server-openai-key');
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const request = (token) => handleChiefOfStaffProxy({ method: 'POST',
  headers: token ? { authorization: `Bearer ${token}` } : {},
  body: { notes: 'Non-sensitive test note', actionKey: 'plan' } });

describe('authenticated browser Chief requests', () => {
  it('validates the user session before generation, without a browser shared secret', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'verified-user' }) });
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ output_text: 'A useful next step' }) });
    const result = await request('short-lived-user-session');
    expect(result.status).toBe(200);
    expect(fetch.mock.calls[0][0]).toBe('https://controlled-project.supabase.co/auth/v1/user');
    expect(fetch.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer short-lived-user-session', apikey: 'public-project-key' });
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe('Bearer server-openai-key');
    expect(JSON.stringify(result)).not.toContain('server-openai-key');
  });

  it.each([null, 'forged-or-expired-session'])('denies %s before spending on OpenAI', async (token) => {
    fetch.mockResolvedValue({ ok: false, status: 401 });
    expect((await request(token)).status).toBe(401);
    expect(fetch.mock.calls.every(([url]) => !url.includes('openai.com'))).toBe(true);
  });

  it('fails closed when session verification is unavailable', async () => {
    fetch.mockRejectedValue(new TypeError('network failure'));
    const result = await request('session');
    expect(result.status).toBe(503);
    expect(result.body.error_code).toBe('PROXY_AUTH_UNAVAILABLE');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('does not accept an auth success body without a verified user ID', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    expect((await request('session')).status).toBe(401);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

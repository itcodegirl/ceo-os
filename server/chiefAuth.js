import { timingSafeEqual } from 'node:crypto';

// Browser callers send a short-lived Supabase access token. Trust the auth
// service's response, never decoded JWT claims supplied by the browser.
export async function authenticateChiefRequest(headers = {}) {
  const authorization = headers.authorization || headers.Authorization || '';
  const bearer = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim() || '';
  const serverToken = process.env.CHIEF_STAFF_PROXY_TOKEN?.trim();
  const supplied = headers['x-chief-staff-token'] || headers['X-Chief-Staff-Token'] || headers['X-CHIEF-STAFF-TOKEN'] || bearer;
  if (serverToken && typeof supplied === 'string') {
    const expected = Buffer.from(serverToken);
    const received = Buffer.from(supplied);
    if (expected.length === received.length && timingSafeEqual(expected, received)) {
      return { authorized: true, userId: '' };
    }
  }

  const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
  if (bearer && url && anonKey) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(`${url}/auth/v1/user`, {
        headers: { Authorization: `Bearer ${bearer}`, apikey: anonKey },
        signal: controller.signal,
      });
      if (!response.ok) return { authorized: false };
      const user = await response.json();
      return { authorized: typeof user?.id === 'string' && Boolean(user.id), userId: user?.id };
    } catch {
      return { authorized: false, unavailable: true };
    } finally {
      clearTimeout(timeout);
    }
  }

  // Preserve the explicit development opt-out. Never turn auth off merely
  // because credentials are missing or a verification request failed.
  return { authorized: !serverToken && !bearer && process.env.CHIEF_STAFF_REQUIRE_TOKEN === 'false', userId: '' };
}

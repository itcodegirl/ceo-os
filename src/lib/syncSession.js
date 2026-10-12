import { getSupabaseRuntime } from './supabaseRuntime';

/**
 * The signed-in Supabase session for local-first sync (notebook pages and
 * items, reminders), or null when sync is unavailable: Supabase is not
 * configured or nobody is signed in. Other errors propagate.
 */
export async function getSyncSession() {
  const runtime = await getSupabaseRuntime();
  if (!runtime) return null;
  const client = await runtime.getSupabaseClient();
  if (!client) return null;
  try {
    const userId = await runtime.requireSupabaseUserId();
    return userId ? { client, userId } : null;
  } catch (error) {
    if (error?.code === 'SUPABASE_AUTH_REQUIRED') return null;
    throw error;
  }
}

import { getWorkspaceOwnerId, assertWorkspaceOwner } from './workspaceOwnership';
/**
 * Bridges the framework-agnostic offline write queue (offlineWriteQueue.js)
 * with the repository call sites. Repositories use `tryRemoteOrEnqueue` to
 * wrap a Supabase write attempt. On a transient failure, the write is
 * persisted to the queue so the next online reconnect can replay it through
 * `useOfflineQueueDrain`.
 *
 * Classification is intentionally conservative: we enqueue on signals that
 * point at a network/connectivity blip, not on server-side errors that
 * retrying won't fix. Permanent failures (RLS denials, schema errors,
 * stale-record conflicts) propagate without queue noise.
 */

import { enqueueOfflineWrite } from './offlineWriteQueue';
import { StaleRecordError } from './staleRecordError';

const TRANSIENT_MESSAGE_PATTERNS = [
  'failed to fetch',
  'network error',
  'networkerror',
  'fetch failed',
  'fetch error',
  'load failed',
  'connection',
  'timeout',
  'timed out',
  'aborted',
];

function isOfflineNavigator() {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return navigator.onLine === false;
}

export function shouldEnqueueWriteFailure(error) {
  if (!error) {
    return false;
  }

  if (error?.code === 'WORKSPACE_ACCOUNT_CHANGED' || error?.code === 'SUPABASE_AUTH_REQUIRED') return false;

  // Stale-record conflicts are user-action problems — don't replay blindly.
  if (error instanceof StaleRecordError || error?.name === 'StaleRecordError') {
    return false;
  }

  const status = Number(error?.status);
  if (status >= 400 && status < 500 && status !== 429) return false;
  if (status === 429 || status >= 500) return true;

  if (isOfflineNavigator()) {
    return true;
  }

  // fetch() typically rejects with a TypeError on network/CORS errors.
  if (error instanceof TypeError) {
    return true;
  }

  const message = String(error?.message || error?.code || '').toLowerCase();
  return TRANSIENT_MESSAGE_PATTERNS.some((pattern) => message.includes(pattern));
}

/**
 * Attempts a remote write. On a transient failure, the entry is enqueued for
 * a later replay; the original error always propagates so the calling page
 * shows the right save status. Permanent failures (StaleRecordError, server
 * validation errors, etc.) skip the queue.
 *
 * Pass `options.skipQueue` from drain replay handlers so a failed replay
 * doesn't enqueue itself a second time.
 */
export async function tryRemoteOrEnqueue({ kind, payload, options = {} }, attempt) {
  const ownerId = options.ownerId ?? getWorkspaceOwnerId();
  try {
    assertWorkspaceOwner(ownerId);
    const result = await attempt();
    assertWorkspaceOwner(ownerId);
    return result;
  } catch (error) {
    if (!options.skipQueue && shouldEnqueueWriteFailure(error)) {
      await enqueueOfflineWrite({ kind, payload, ownerId });
    }
    throw error;
  }
}

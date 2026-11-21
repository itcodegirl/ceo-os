import { getWorkspaceOwnerId, assertWorkspaceOwner } from './workspaceOwnership';
/**
 * Persistent queue for writes that could not reach Supabase (network down,
 * auth blip, etc.). Repositories can opt in: when a remote write fails with
 * a recoverable error, push an entry here, and the user's data stays
 * available locally while the queue waits to drain on the next online tick.
 *
 * Design choices:
 *
 *   - Persisted in localStorage under `ceo-os-offline-write-queue`. Survives
 *     reloads and tab restarts.
 *   - Each entry: { id, ownerId, kind, payload, createdAt, attempts }.
 *   - Drain stops on first failure to avoid hammering a still-down service.
 *     Callers can manually re-drain on a window 'online' event or a UI retry.
 *   - Emits `ceo-os:offline-queue-updated` on every queue change so the
 *     SyncStatusPill (or any other observer) can render the pending count.
 *
 * The module is intentionally framework-agnostic — the React-side hook
 * wraps it so components can subscribe with the standard usePersistentState
 * cross-tab semantics.
 */

import { parseJsonOrPreserveCorruption } from './storageCorruption';

export const OFFLINE_QUEUE_STORAGE_KEY = 'ceo-os-offline-write-queue';
export const OFFLINE_QUEUE_UPDATED_EVENT = 'ceo-os:offline-queue-updated';
const MAX_QUEUE_LENGTH = 200;

let monotonicId = 0;

function safeStorage() {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function notifyQueueUpdated(detail = {}) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT, { detail }));
  } catch {
    // ignore dispatch errors
  }
}

function readQueue(storage) {
  try {
    const raw = storage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) {
      return [];
    }
    const parsed = parseJsonOrPreserveCorruption(OFFLINE_QUEUE_STORAGE_KEY, raw, null);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((entry) => entry && typeof entry === 'object' && typeof entry.kind === 'string');
  } catch {
    return [];
  }
}

function writeQueue(storage, queue) {
  try {
    storage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    return true;
  } catch {
    return false;
  }
}

function buildEntryId() {
  monotonicId = (monotonicId + 1) % 1_000_000;
  return `q-${Date.now()}-${String(monotonicId).padStart(6, '0')}`;
}

/**
 * Reads the current queue. Returns a fresh array each call so callers can
 * filter or count without worrying about mutation.
 */
export function getOfflineQueue() {
  const storage = safeStorage();
  if (!storage) {
    return [];
  }
  return readQueue(storage);
}

/**
 * Pushes a write entry onto the queue. `kind` is a free-form string the
 * caller uses to dispatch in `drainOfflineQueue` (e.g. 'opportunity:create').
 * `payload` is whatever data the caller needs to replay the write.
 *
 * Returns the persisted entry, or null if storage is unavailable.
 */
export function enqueueOfflineWrite({ kind, payload, ownerId = getWorkspaceOwnerId() }) {
  const storage = safeStorage();
  if (!storage || typeof kind !== 'string' || !kind.trim()) {
    return null;
  }

  const queue = readQueue(storage);
  const entry = {
    id: buildEntryId(),
    kind: kind.trim(),
    ownerId,
    payload: payload === undefined ? null : payload,
    createdAt: Date.now(),
    attempts: 0,
  };

  // Keep the queue bounded so a runaway loop can't fill localStorage. When
  // we hit the limit, drop the oldest entries (FIFO) so the user's most
  // recent intentions are preserved.
  const next = queue.concat(entry).slice(-MAX_QUEUE_LENGTH);
  if (!writeQueue(storage, next)) {
    return null;
  }

  notifyQueueUpdated({ kind: 'enqueue', size: next.length });
  return entry;
}

/**
 * Removes a single entry by id. Used by `drainOfflineQueue` after a
 * successful replay; exposed so tests and a future "discard pending" UI
 * action can reuse the same path.
 */
export function removeOfflineWrite(id) {
  const storage = safeStorage();
  if (!storage) {
    return false;
  }
  const queue = readQueue(storage);
  const next = queue.filter((entry) => entry.id !== id);
  if (next.length === queue.length) {
    return false;
  }
  writeQueue(storage, next);
  notifyQueueUpdated({ kind: 'remove', size: next.length });
  return true;
}

/**
 * Empties the queue. Intended for tests and an explicit "abandon pending"
 * UI affordance — never call this on a failure path, since pending writes
 * represent the user's data that did not reach the server yet.
 */
export function clearOfflineQueue() {
  const storage = safeStorage();
  if (!storage) {
    return;
  }
  writeQueue(storage, []);
  notifyQueueUpdated({ kind: 'clear', size: 0 });
}

/**
 * Walks the queue, attempting to replay each entry through the supplied
 * handler. Returns a summary { drained, failed, remaining } so callers can
 * show a result toast.
 *
 * Stops at the first failure — assumes all entries depend on the same
 * remote service, so once one fails the rest will likely fail too.
 *
 * `handlerByKind` is a map of `{ [kind]: async (payload) => any }`. Unknown
 * kinds are left in place so a future code version that recognizes them
 * can drain them later.
 */
export async function drainOfflineQueue(handlerByKind = {}) {
  const storage = safeStorage();
  if (!storage) {
    return { drained: 0, failed: 0, remaining: 0 };
  }

  let queue = readQueue(storage);
  if (queue.length === 0) {
    return { drained: 0, failed: 0, remaining: 0 };
  }

  const ownerId = getWorkspaceOwnerId();
  let drained = 0;
  let failed = 0;
  let stopOnFailure = false;

  for (let index = 0; index < queue.length && !stopOnFailure; index += 1) {
    const entry = queue[index];
    // Older entries without ownership stay preserved for manual recovery.
    if (entry.ownerId !== ownerId) continue;
    const handler = handlerByKind[entry.kind];
    if (typeof handler !== 'function') {
      // Unknown kinds stay in place.
      continue;
    }
    try {
      assertWorkspaceOwner(ownerId);
      await handler(entry.payload, entry);
      assertWorkspaceOwner(ownerId);
      // Re-read the queue in case other tabs changed it; remove this entry by id.
      queue = readQueue(storage).filter((candidate) => candidate.id !== entry.id);
      if (!writeQueue(storage, queue)) throw new Error('Unable to acknowledge queued write on this device.');
      drained += 1;
      // After mutation, restart loop from current index against the fresh queue.
      index -= 1;
    } catch {
      // Bump attempts on the persisted entry so observers can show retry counts,
      // then stop draining for this pass.
      const persisted = readQueue(storage);
      const target = persisted.find((candidate) => candidate.id === entry.id);
      if (target) {
        target.attempts = Number(target.attempts || 0) + 1;
        writeQueue(storage, persisted);
      }
      failed += 1;
      stopOnFailure = true;
    }
  }

  const remaining = readQueue(storage).length;
  notifyQueueUpdated({ kind: 'drain', drained, failed, remaining });
  return { drained, failed, remaining };
}

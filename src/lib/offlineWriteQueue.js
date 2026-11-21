import { getWorkspaceOwnerId, assertWorkspaceOwner } from './workspaceOwnership';
import { parseJsonOrPreserveCorruption } from './storageCorruption';
import { withStorageLock } from './storageLock';

export const OFFLINE_QUEUE_STORAGE_KEY = 'ceo-os-offline-write-queue';
export const OFFLINE_QUEUE_UPDATED_EVENT = 'ceo-os:offline-queue-updated';
export const OFFLINE_QUEUE_RETRY_EVENT = 'ceo-os:offline-queue-retry';
const MAX_QUEUE_LENGTH = 200;
const MAX_ATTEMPTS = 5;

const queueError = (message, code = 'QUEUE_STORAGE_FAILED') => Object.assign(new Error(message), { code });
function storageOrThrow() {
  try { if (window.localStorage) return window.localStorage; } catch { /* report below */ }
  throw queueError('Pending work could not be kept on this device. Keep your draft open and export it before leaving.');
}
function notify(kind) {
  window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT, { detail: { kind } }));
}
function readQueue(storage) {
  const raw = storage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
  if (!raw) return [];
  const entries = parseJsonOrPreserveCorruption(OFFLINE_QUEUE_STORAGE_KEY, raw, null);
  if (!Array.isArray(entries) || entries.some((entry) => !entry || typeof entry.id !== 'string' || typeof entry.kind !== 'string')) {
    throw queueError('The pending-write list needs recovery. Export it in Settings before retrying.', 'QUEUE_RECOVERY_REQUIRED');
  }
  return entries;
}
function writeQueue(storage, entries) {
  try { storage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(entries)); }
  catch { throw queueError('Pending work could not be kept on this device. Keep your draft open and free some browser storage before retrying.'); }
}
export function getOfflineQueue() {
  try { return readQueue(storageOrThrow()); } catch { return []; }
}
const currentOwnerEntries = () => getOfflineQueue().filter((entry) => entry.ownerId === getWorkspaceOwnerId());
export function getCurrentOfflineQueue() { return currentOwnerEntries(); }

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
function fingerprint(kind, payload) {
  // Create retries can carry freshly generated metadata. The authored intent is
  // stable, and the first queued record keeps its original server id.
  const data = kind.endsWith(':create') && payload && typeof payload === 'object'
    ? Object.fromEntries(Object.entries(payload).filter(([key]) => !['id', 'updatedAt', 'createdAt'].includes(key))) : payload;
  return `${kind}:${stableJson(data)}`;
}
function targetKey(entry) {
  return `${entry.kind.split(':')[0]}:${entry.payload?.kind || ''}:${entry.payload?.id || entry.id}`;
}
function mutateQueue(work) {
  return withStorageLock('queue-write', () => {
    const storage = storageOrThrow();
    const queue = readQueue(storage);
    const result = work(queue);
    writeQueue(storage, queue);
    return result;
  });
}
export async function enqueueOfflineWrite({ kind, payload, ownerId = getWorkspaceOwnerId() }) {
  if (typeof kind !== 'string' || !kind.trim()) throw queueError('This pending action has no type.', 'QUEUE_INVALID');
  const entry = await mutateQueue((queue) => {
    const signature = fingerprint(kind, payload);
    const existing = queue.find((item) => item.ownerId === ownerId && fingerprint(item.kind, item.payload) === signature);
    if (existing) return existing;
    if (queue.length >= MAX_QUEUE_LENGTH) throw queueError('Pending writes are full. Existing work is safe. Review or export pending writes in Settings before retrying this draft.', 'QUEUE_FULL');
    const next = { id: crypto.randomUUID(), ownerId, kind: kind.trim(), payload: payload ?? null,
      createdAt: Date.now(), attempts: 0, status: 'pending', nextAttemptAt: 0 };
    queue.push(next);
    return next;
  });
  notify('enqueue');
  return entry;
}
export async function removeOfflineWrite(id) {
  const removed = await mutateQueue((queue) => {
    const index = queue.findIndex((entry) => entry.id === id);
    if (index < 0) return false;
    queue.splice(index, 1);
    return true;
  });
  notify('remove');
  return removed;
}
export async function discardOfflineWrite(id) {
  const ownerId = getWorkspaceOwnerId();
  // Wait for an in-flight request: discarding cannot cancel a server write.
  return withStorageLock('queue-drain', async () => {
    assertWorkspaceOwner(ownerId);
    const entry = getOfflineQueue().find((item) => item.id === id);
    if (!entry) return true;
    if (entry.ownerId !== undefined && entry.ownerId !== ownerId) throw queueError('This action belongs to another account.', 'QUEUE_OWNER');
    return removeOfflineWrite(id);
  });
}
export async function clearOfflineQueue() {
  await mutateQueue((queue) => { queue.length = 0; });
  notify('clear');
}
export async function retryOfflineWrite(id) {
  const ownerId = getWorkspaceOwnerId();
  await mutateQueue((queue) => {
    assertWorkspaceOwner(ownerId);
    const entry = queue.find((item) => item.id === id && item.ownerId === ownerId);
    if (!entry) throw queueError('This action belongs to another workspace or is no longer pending.', 'QUEUE_OWNER');
    Object.assign(entry, { status: 'pending', attempts: 0, nextAttemptAt: 0, lastError: '' });
  });
  notify('retry');
  window.dispatchEvent(new Event(OFFLINE_QUEUE_RETRY_EVENT));
}
function isTransient(error) {
  if (error?.code === 'STALE_RECORD' || error?.code === 'WORKSPACE_ACCOUNT_CHANGED' || error?.code === 'SUPABASE_AUTH_REQUIRED') return false;
  const status = Number(error?.status);
  return error instanceof TypeError || status === 429 || status >= 500
    || /network|fetch|connection|timeout|timed out|offline/i.test(String(error?.message || ''));
}

export async function drainOfflineQueue(handlerByKind = {}) {
  const summary = { drained: 0, failed: 0, remaining: 0 };
  const result = await withStorageLock('queue-drain', async () => {
    const ownerId = getWorkspaceOwnerId();
    const blockedTargets = new Set();
    const queue = readQueue(storageOrThrow());
    for (let entry of queue) {
      if (entry.ownerId !== ownerId) continue;
      const target = targetKey(entry);
      if (entry.status === 'blocked' || blockedTargets.has(target) || Number(entry.nextAttemptAt) > Date.now()) {
        blockedTargets.add(target);
        continue;
      }
      if (entry.kind.endsWith(':create') && entry.payload && !entry.payload.id) {
        // Persist a stable server identity before replaying older queue entries.
        entry = await mutateQueue((persisted) => {
          const current = persisted.find((item) => item.id === entry.id);
          if (!current) return entry;
          current.payload.id ||= crypto.randomUUID();
          return current;
        });
      }
      // Another tab may have explicitly discarded the entry while we waited.
      if (!getOfflineQueue().some((item) => item.id === entry.id)) continue;
      try {
        assertWorkspaceOwner(ownerId);
        if (typeof handlerByKind[entry.kind] !== 'function') throw queueError('This action is not supported by this version. Export it before discarding.', 'QUEUE_UNKNOWN_ACTION');
        await handlerByKind[entry.kind](entry.payload, entry);
        assertWorkspaceOwner(ownerId);
        await removeOfflineWrite(entry.id);
        summary.drained += 1;
      } catch (error) {
        summary.failed += 1;
        blockedTargets.add(target);
        await mutateQueue((persisted) => {
          const current = persisted.find((item) => item.id === entry.id);
          if (!current) return;
          const attempts = Number(current.attempts || 0) + 1;
          const retry = isTransient(error) && attempts < MAX_ATTEMPTS;
          Object.assign(current, { attempts, status: retry ? 'retry' : 'blocked',
            nextAttemptAt: retry ? Date.now() + Math.min(60000, 2000 * 2 ** (attempts - 1)) : 0,
            lastError: error?.code === 'STALE_RECORD' ? 'This record changed. Review the latest version before retrying.'
              : 'This action could not sync. Review it, retry, or export it before discarding.',
            errorCode: String(error?.code || 'SYNC_FAILED') });
        });
        if (getWorkspaceOwnerId() !== ownerId || error?.code === 'SUPABASE_AUTH_REQUIRED') break;
      }
    }
    summary.remaining = getOfflineQueue().filter((entry) => entry.ownerId === ownerId).length;
    notify('drain');
    return summary;
  }, { ifAvailable: true });
  return result || { ...summary, remaining: currentOwnerEntries().length };
}

export const WORKSPACE_ACCOUNT_EVENT = 'ceo-os:workspace-account-changed';
export const AUTH_STORAGE_KEY = 'ceo-os:auth';

// This selects the local workspace, not authorization. Remote operations
// still verify the session with Supabase and enforce user_id/RLS.
export function getWorkspaceOwnerId() {
  try {
    const session = JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) || 'null');
    return typeof session?.user?.id === 'string' ? session.user.id : '';
  } catch {
    return '';
  }
}

export function accountChangedError() {
  return Object.assign(new Error('Your account changed. Return to the original account to finish syncing this work.'), {
    code: 'WORKSPACE_ACCOUNT_CHANGED',
  });
}

export function assertWorkspaceOwner(ownerId) {
  if (ownerId !== getWorkspaceOwnerId()) throw accountChangedError();
}

export function isWorkspaceRecord(record, ownerId = getWorkspaceOwnerId()) {
  return (record?.sync?.ownerId || '') === ownerId;
}

export function visibleRecords(records, ownerId = getWorkspaceOwnerId()) {
  return records.filter((record) => isWorkspaceRecord(record, ownerId));
}

export function mergeWorkspaceRecords(all, next, ownerId = getWorkspaceOwnerId()) {
  return [...all.filter((record) => !isWorkspaceRecord(record, ownerId)), ...next];
}

// Legacy string tombstones have no provable owner. Preserve them, but never
// send them under a newly signed-in account. New tombstones carry provenance.
export function normalizeDeletionRecords(value) {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string'
    || (entry && typeof entry.id === 'string' && typeof entry.ownerId === 'string')) : [];
}

export function visibleDeletionIds(records, ownerId = getWorkspaceOwnerId()) {
  return records.filter((entry) => entry?.ownerId === ownerId).map((entry) => entry.id);
}

export function mergeDeletionIds(all, ids, ownerId = getWorkspaceOwnerId()) {
  return [...all.filter((entry) => entry?.ownerId !== ownerId),
    ...ids.map((id) => ({ id, ownerId }))];
}

export function selectWorkspaceStore(store, collectionKey, deletionKey, ownerId = getWorkspaceOwnerId()) {
  return { ...store, [collectionKey]: visibleRecords(store[collectionKey], ownerId),
    [deletionKey]: visibleDeletionIds(store[deletionKey], ownerId) };
}

export function mergeWorkspaceStore(all, next, collectionKey, deletionKey, ownerId = getWorkspaceOwnerId()) {
  return { ...all, ...next,
    [collectionKey]: mergeWorkspaceRecords(all[collectionKey], next[collectionKey], ownerId),
    [deletionKey]: mergeDeletionIds(all[deletionKey], next[deletionKey], ownerId) };
}

export function subscribeWorkspaceAccount(listener) {
  const onStorage = (event) => {
    if (!event.key || event.key === AUTH_STORAGE_KEY) listener();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(WORKSPACE_ACCOUNT_EVENT, listener);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(WORKSPACE_ACCOUNT_EVENT, listener);
  };
}

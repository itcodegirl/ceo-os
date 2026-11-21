import { getWorkspaceOwnerId, isWorkspaceRecord, visibleRecords, mergeWorkspaceRecords,
  normalizeDeletionRecords, selectWorkspaceStore, mergeWorkspaceStore } from './workspaceOwnership';

const SCOPED = {
  'ceo-os-notebook-pages': ['pages', 'deletedPageIds'],
  'ceo-os-notebook-cards': ['items', 'deletedIds'],
  'ceo-os-notebook-questions': ['items', 'deletedIds'],
  'ceo-os-notebook-ideas': ['items', 'deletedIds'],
};

// Export only the active workspace. Import replaces that workspace's records
// while retaining other accounts' local caches. Never reassign imported owners.
export function accountBackupValue(key, raw, { existingRaw, importing = false, backupOwnerVerified = false } = {}) {
  if (!raw || (!SCOPED[key] && key !== 'ceo-os-reminders')) return raw;
  let parsed;
  try { parsed = JSON.parse(raw); } catch { return raw; }
  const wrapped = parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'data' in parsed;
  const data = wrapped ? parsed.data : parsed;
  const [collectionKey, deletionKey] = SCOPED[key] || [];
  const records = collectionKey ? data?.[collectionKey] : data;
  if (!Array.isArray(records)) return raw;
  if (importing && records.some((record) => !isWorkspaceRecord(record))) {
    throw new Error('This backup contains notes or reminders from another workspace. Sign in to its original account, or sign out to restore local notes.');
  }
  let existing;
  try { existing = JSON.parse(existingRaw || 'null'); } catch { existing = null; }
  const previous = existing?.data ?? existing;
  let next;
  if (!collectionKey) {
    next = importing ? mergeWorkspaceRecords(Array.isArray(previous) ? previous : [], records) : visibleRecords(records);
  } else {
    const store = { ...data, [deletionKey]: normalizeDeletionRecords(data[deletionKey]) };
    if (importing) {
      if (store[deletionKey].some((entry) => typeof entry === 'string'
        ? !backupOwnerVerified : entry.ownerId !== getWorkspaceOwnerId())) {
        throw new Error('This backup has deletions without a matching workspace owner. Keep the original backup; these deletions cannot be safely restored to this account.');
      }
      // Plain IDs are portable only when the backup explicitly names this owner.
      const incoming = { ...store, [deletionKey]: store[deletionKey].filter((entry) =>
        typeof entry === 'string' || entry.ownerId === getWorkspaceOwnerId()).map((entry) => entry.id || entry) };
      const prior = { ...previous, [collectionKey]: Array.isArray(previous?.[collectionKey]) ? previous[collectionKey] : [],
        [deletionKey]: normalizeDeletionRecords(previous?.[deletionKey]) };
      next = mergeWorkspaceStore(prior, incoming, collectionKey, deletionKey);
    } else {
      next = selectWorkspaceStore(store, collectionKey, deletionKey);
    }
  }
  return JSON.stringify(wrapped ? { ...parsed, data: next } : next);
}

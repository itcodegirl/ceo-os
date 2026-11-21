// Kept independent of repositories so recovery runs before the app reads stores.
export const ACTIVE_IMPORT_KEY = 'ceo-os-import-recovery-active';
export const IMPORT_SNAPSHOT_PREFIX = 'ceo-os-import-recovery-';
export const IMPORT_RECOVERY_EVENT = 'ceo-os:import-recovery';
export function getImportRecovery(storage) {
  let key;
  try { storage ||= window.localStorage; key = storage.getItem(ACTIVE_IMPORT_KEY); } catch { return null; }
  if (!key) return null;
  if (!key.startsWith(IMPORT_SNAPSHOT_PREFIX) || key === ACTIVE_IMPORT_KEY) return { key: ACTIVE_IMPORT_KEY, unreadable: true };
  try {
    const journal = JSON.parse(storage.getItem(key));
    if (!validSnapshot(journal)) throw new Error('invalid journal');
    return { ...journal, key };
  } catch { return { key, unreadable: true }; }
}
export function rollbackImport(storage) {
  const journal = getImportRecovery(storage);
  if (!journal) return { recovered: true, failedKeys: [] };
  storage ||= window.localStorage;
  if (journal.unreadable) return { recovered: false, failedKeys: [journal.key] };
  const failedKeys = [];
  for (const [key, original] of Object.entries(journal.before)) {
    try {
      const current = storage.getItem(key);
      // Preserve edits made elsewhere after the interrupted import.
      if (current !== original && current !== journal.after[key]) { failedKeys.push(key); continue; }
      if (original === null) storage.removeItem(key);
      else storage.setItem(key, original);
    } catch { failedKeys.push(key); }
  }
  if (!failedKeys.length) {
    try { storage.removeItem(ACTIVE_IMPORT_KEY); } catch { failedKeys.push(ACTIVE_IMPORT_KEY); }
  }
  return { recovered: failedKeys.length === 0, failedKeys };
}
export function applyStorageImport(entries, { storage, ownerId }) {
  if (getImportRecovery(storage)) throw new Error('Finish recovering the interrupted import before restoring another backup.');
  const before = Object.fromEntries(entries.map(({ definition }) => [definition.key, storage.getItem(definition.key)]));
  const after = Object.fromEntries(entries.map(({ definition, rawValue }) => [definition.key, rawValue]));
  const key = `${IMPORT_SNAPSHOT_PREFIX}${crypto.randomUUID()}`;
  // Both records must be durable before the first primary value is changed.
  storage.setItem(key, JSON.stringify({ ownerId, createdAt: new Date().toISOString(), before, after }));
  storage.setItem(ACTIVE_IMPORT_KEY, key);
  let failedKey = '';
  try {
    for (const [name, value] of Object.entries(after)) {
      failedKey = name;
      if (storage.getItem(name) !== before[name]) throw new Error('The workspace changed during restore.');
      storage.setItem(name, value);
    }
    storage.removeItem(ACTIVE_IMPORT_KEY);
    return key;
  } catch (cause) {
    const result = rollbackImport(storage);
    const error = new Error(result.recovered
      ? `Restore failed at ${failedKey}. All changed stores were rolled back; your original workspace is intact.`
      : `Restore stopped at ${failedKey}. Recovery is required for: ${result.failedKeys.join(', ')}. Your original snapshot is preserved.`);
    error.cause = cause;
    error.recoveryRequired = !result.recovered;
    window.dispatchEvent(new Event(IMPORT_RECOVERY_EVENT));
    throw error;
  }
}
export function listImportSnapshots(storage) {
  const snapshots = [];
  try {
    storage ||= window.localStorage;
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (!key?.startsWith(IMPORT_SNAPSHOT_PREFIX) || key === ACTIVE_IMPORT_KEY) continue;
      try {
        const journal = JSON.parse(storage.getItem(key));
        if (validSnapshot(journal)) snapshots.push({ ...journal, key });
      } catch { /* keep unreadable originals on disk */ }
    }
  } catch { /* storage is unavailable */ }
  return snapshots;
}
function validSnapshot(journal) {
  const map = (value, nullable) => value && typeof value === 'object' && !Array.isArray(value)
    && Object.entries(value).every(([key, raw]) => key.startsWith('ceo-os-') && !key.startsWith(IMPORT_SNAPSHOT_PREFIX)
      && (typeof raw === 'string' || (nullable && raw === null)));
  return journal && map(journal.before, true) && map(journal.after, false)
    && Object.keys(journal.before).length === Object.keys(journal.after).length
    && Object.keys(journal.before).every((key) => Object.hasOwn(journal.after, key));
}

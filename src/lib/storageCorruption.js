import { validateStorageRaw, RECOVERABLE_STORAGE_KEYS } from './storageValidation';

export const STORAGE_CORRUPTION_EVENT = 'ceo-os:storage-corruption';
export const STORAGE_RESTORED_EVENT = 'ceo-os:storage-restored';
export const STORAGE_ARCHIVED_EVENT = 'ceo-os:storage-archived';
const INDEX_SUFFIX = '__corrupt_index';
const BACKUP_SUFFIX = '__corrupt_';
let counter = 0;
const memoryFailures = new Map();
function safeStorage() { try { return window.localStorage; } catch { return null; } }
function emit(name, detail) { window.dispatchEvent(new CustomEvent(name, { detail })); }
function storageKeys(storage) {
  const keys = [];
  try { for (let index = 0; index < storage.length; index += 1) keys.push(storage.key(index)); } catch { /* storage is unavailable */ }
  return keys.filter(Boolean);
}
function backupKeys(storage, key) {
  let index = [];
  try { index = JSON.parse(storage.getItem(`${key}${INDEX_SUFFIX}`) || '[]'); } catch { /* scan also recovers a missing index */ }
  return [...new Set([...(Array.isArray(index) ? index.filter((name) => typeof name === 'string' && name.startsWith(`${key}${BACKUP_SUFFIX}`) && name !== `${key}${INDEX_SUFFIX}`) : []), ...storageKeys(storage)
    .filter((name) => name.startsWith(`${key}${BACKUP_SUFFIX}`) && name !== `${key}${INDEX_SUFFIX}`)])];
}
function writeBackup(storage, key, raw) {
  const keys = backupKeys(storage, key);
  const existing = keys.find((name) => storage.getItem(name) === raw);
  if (existing) return existing;
  counter = (counter + 1) % 1000;
  const name = `${key}${BACKUP_SUFFIX}${Date.now()}-${String(counter).padStart(3, '0')}`;
  try { storage.setItem(name, raw); } catch { return null; }
  // Backups are discoverable by key scan if writing the secondary index fails.
  try { storage.setItem(`${key}${INDEX_SUFFIX}`, JSON.stringify([...keys, name])); } catch { /* original is safely preserved */ }
  return name;
}
export function preserveCorruptStorageValue(key, rawValue, error) {
  const storage = safeStorage();
  if (!storage || typeof key !== 'string' || rawValue == null) return null;
  const raw = String(rawValue);
  const prior = backupKeys(storage, key).find((name) => storage.getItem(name) === raw);
  const backupKey = prior || writeBackup(storage, key, raw);
  if (backupKey && storage.getItem(key) === raw) {
    try { storage.removeItem(key); } catch { /* guarded writes keep the original safe */ }
  }
  const detail = { key, backupKey, at: new Date().toISOString(), message: error?.message || 'Stored data needs recovery.' };
  if (!backupKey) memoryFailures.set(key, detail);
  else memoryFailures.delete(key);
  if (!prior) emit(STORAGE_CORRUPTION_EVENT, detail);
  return backupKey;
}
export function assertStorageWritable(key, storage = safeStorage()) {
  const raw = storage?.getItem(key);
  if (raw == null) return;
  try { validateStorageRaw(key, raw); } catch (error) {
    preserveCorruptStorageValue(key, raw, error);
    if (storage.getItem(key) === raw) throw Object.assign(new Error('The original data could not be preserved. Export it from Settings before replacing this store.'), { code: 'LOCAL_DATA_RECOVERY_REQUIRED' });
  }
}
export function archiveStorageValue(key, options = {}) {
  const storage = safeStorage();
  if (!storage || !key) return null;
  const raw = storage.getItem(key);
  if (raw === null || raw === '') return null;
  const backupKey = writeBackup(storage, key, raw);
  if (!backupKey) return null;
  try { storage.removeItem(key); } catch { return null; }
  emit(STORAGE_ARCHIVED_EVENT, { key, backupKey, at: new Date().toISOString(), reason: options.reason || 'manual' });
  return backupKey;
}
export function parseJsonOrPreserveCorruption(key, raw, fallback) {
  if (raw != null) {
    try { return JSON.parse(raw); } catch (error) { preserveCorruptStorageValue(key, raw, error); }
  }
  return typeof fallback === 'function' ? fallback() : fallback;
}
export function listCorruptBackups(key) {
  const storage = safeStorage();
  if (!storage || !key) return [];
  return backupKeys(storage, key).map((backupKey) => {
    const value = storage.getItem(backupKey);
    const timestamp = Number(backupKey.slice(`${key}${BACKUP_SUFFIX}`.length).split('-')[0]);
    let restorable = true;
    try { validateStorageRaw(key, value); } catch { restorable = false; }
    const date = new Date(timestamp);
    return { key, backupKey, value, restorable, savedAt: Number.isFinite(date.getTime()) ? date.toISOString() : null };
  }).filter((entry) => entry.value !== null).reverse();
}
export function listStorageRecovery() {
  const storage = safeStorage();
  if (!storage) return [];
  const keys = storageKeys(storage);
  const primaryKeys = new Set(keys.filter((key) => key.includes(BACKUP_SUFFIX)).map((key) => key.split(BACKUP_SUFFIX)[0]));
  const entries = [...primaryKeys].flatMap(listCorruptBackups);
  // Discover blocked originals even if the startup event was missed, including
  // after reload when quota prevented both the backup and its index.
  for (const key of keys.filter((name) => RECOVERABLE_STORAGE_KEYS.has(name))) {
    const value = storage.getItem(key);
    try { validateStorageRaw(key, value); } catch {
      entries.push({ key, backupKey: null, value, restorable: false, savedAt: null });
    }
  }
  for (const [key] of memoryFailures) if (storage.getItem(key) === null) memoryFailures.delete(key);
  return entries;
}
export function restoreCorruptBackup(key, backupKey) {
  const storage = safeStorage();
  if (!storage || !backupKeys(storage, key).includes(backupKey)) return false;
  const raw = storage.getItem(backupKey);
  if (raw === null) return false;
  try { validateStorageRaw(key, raw); } catch { return false; }
  const existing = storage.getItem(key);
  if (existing !== null && existing !== raw && !writeBackup(storage, key, existing)) return false;
  try { storage.setItem(key, raw); } catch { return false; }
  if (!discardCorruptBackup(key, backupKey)) return false;
  emit(STORAGE_RESTORED_EVENT, { key, backupKey, at: new Date().toISOString() });
  return true;
}
export function discardCorruptBackup(key, backupKey) {
  const storage = safeStorage();
  if (!storage) return false;
  if (backupKey && !backupKeys(storage, key).includes(backupKey)) return false;
  try {
    storage.removeItem(backupKey || key);
  } catch { return false; }
  // The index is only a hint; discovery also scans the actual stored keys.
  try { if (backupKey) storage.setItem(`${key}${INDEX_SUFFIX}`, JSON.stringify(backupKeys(storage, key).filter((item) => item !== backupKey))); } catch { /* discovery remains available */ }
  memoryFailures.delete(key);
  emit(STORAGE_ARCHIVED_EVENT, { key, backupKey, reason: 'discard' });
  return true;
}

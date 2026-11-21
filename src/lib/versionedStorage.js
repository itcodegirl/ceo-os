import { createVersionedStorageEnvelope, getStorageSchema } from './dataSchema';
import { decodeStoredDomain, validateDomainData } from './storageValidation';
import { preserveCorruptStorageValue, assertStorageWritable } from './storageCorruption';
import { requireLocalStorageSetItem, safeLocalStorageSetItem } from './utils';

export function getVersionedStorageKey(domain) {
  const schema = getStorageSchema(domain);
  if (!schema) throw new Error(`Unknown storage schema domain: ${domain}`);
  return schema.key;
}
export function readVersionedLocalStorage(domain, fallbackValue) {
  const key = getVersionedStorageKey(domain);
  let raw;
  try { raw = window.localStorage.getItem(key); } catch { return fallbackValue; }
  if (!raw) return fallbackValue;
  try { return decodeStoredDomain(domain, JSON.parse(raw)); }
  catch (error) { preserveCorruptStorageValue(key, raw, error); return fallbackValue; }
}
export function writeVersionedLocalStorage(domain, data, errorMessage) {
  const key = getVersionedStorageKey(domain);
  validateDomainData(domain, data);
  assertStorageWritable(key);
  requireLocalStorageSetItem(key, JSON.stringify(createVersionedStorageEnvelope(domain, data)), errorMessage);
}
export function safeWriteVersionedLocalStorage(domain, data, warningMessage) {
  const key = getVersionedStorageKey(domain);
  try { validateDomainData(domain, data); assertStorageWritable(key); } catch { return false; }
  return safeLocalStorageSetItem(key, JSON.stringify(createVersionedStorageEnvelope(domain, data)), warningMessage);
}

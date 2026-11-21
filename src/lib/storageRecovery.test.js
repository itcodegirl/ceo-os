import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { previewWorkspaceBackup, importWorkspaceBackup } from './workspaceBackupImport';
import { WORKSPACE_BACKUP_FORMAT } from './workspacePortability';
import { ACTIVE_IMPORT_KEY, getImportRecovery, listImportSnapshots, rollbackImport } from './importRecovery';
import { listStorageRecovery, preserveCorruptStorageValue, restoreCorruptBackup, assertStorageWritable } from './storageCorruption';
import { readVersionedLocalStorage, writeVersionedLocalStorage } from './versionedStorage';

const SETTINGS = 'ceo-os-settings';
const NOTES = 'ceo-os-capture-notes';
const CHIEF = 'ceo-os-chief-notes';
const original = { [SETTINGS]: '{"teamName":"Original"}', [NOTES]: '[{"id":"old","text":"Original note"}]', [CHIEF]: 'Original thoughts' };
const incoming = { [SETTINGS]: '{"teamName":"Restored"}', [NOTES]: '[{"id":"new","text":"Restored note"}]', [CHIEF]: 'Restored thoughts' };
const backup = (keys = incoming) => ({ format: WORKSPACE_BACKUP_FORMAT, schemaVersion: 1, keys });
const rawStores = () => Object.fromEntries(Object.keys(original).map((key) => [key, localStorage.getItem(key)]));
beforeEach(() => { localStorage.clear(); Object.entries(original).forEach(([key, raw]) => localStorage.setItem(key, raw)); });
afterEach(() => vi.restoreAllMocks());

describe('recoverable backup import', () => {
  it('previews replacements without changing storage, then preserves the originals before committing', () => {
    const preview = previewWorkspaceBackup(backup());
    expect(preview.stores.every((store) => store.replacesExisting)).toBe(true);
    expect(rawStores()).toEqual(original); expect(listImportSnapshots()).toEqual([]);
    importWorkspaceBackup(backup(), { preview });
    expect(rawStores()).toEqual(incoming);
    expect(listImportSnapshots()[0].before).toEqual(original);
    expect(localStorage.getItem(ACTIVE_IMPORT_KEY)).toBeNull();
  });
  it.each(Object.keys(incoming))('rolls back every earlier write when %s exceeds quota', (failureKey) => {
    const set = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === failureKey && value === incoming[key]) throw new DOMException('quota', 'QuotaExceededError');
      set(key, value);
    });
    expect(() => importWorkspaceBackup(backup())).toThrow(/rolled back/);
    expect(rawStores()).toEqual(original);
    expect(listImportSnapshots()[0].before).toEqual(original);
    expect(getImportRecovery()).toBeNull();
  });
  it('removes newly created stores when rolling back to their original absence', () => {
    localStorage.removeItem(SETTINGS);
    const set = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, raw) => {
      if (key === NOTES && raw === incoming[NOTES]) throw new Error('quota');
      set(key, raw);
    });
    expect(() => importWorkspaceBackup(backup())).toThrow(/rolled back/);
    expect(localStorage.getItem(SETTINGS)).toBeNull();
  });
  it('refuses to start if the original snapshot cannot be durably stored', () => {
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(() => importWorkspaceBackup(backup())).toThrow('quota');
    expect(rawStores()).toEqual(original);
  });
  it('retains a recovery journal if rollback also fails, then recovers after a reload', () => {
    const set = localStorage.setItem.bind(localStorage);
    const spy = vi.spyOn(localStorage, 'setItem').mockImplementation((key, value) => {
      if (key === NOTES || (key === SETTINGS && value === original[SETTINGS])) throw new Error('quota');
      set(key, value);
    });
    expect(() => importWorkspaceBackup(backup())).toThrow(/Recovery is required/);
    expect(getImportRecovery().before).toEqual(original);
    spy.mockRestore();
    expect(rollbackImport()).toEqual({ recovered: true, failedKeys: [] });
    expect(rawStores()).toEqual(original);
  });
  it('refuses stale preview or changed-account confirmation', () => {
    const preview = previewWorkspaceBackup(backup());
    localStorage.setItem(CHIEF, 'newer draft');
    expect(() => importWorkspaceBackup(backup(), { preview })).toThrow(/changed since/);
    expect(localStorage.getItem(CHIEF)).toBe('newer draft');
    localStorage.setItem('ceo-os:auth', '{"user":{"id":"different"}}');
    expect(() => importWorkspaceBackup(backup(), { preview })).toThrow(/account changed/);
  });
  it('does not overwrite a concurrent edit during recovery', () => {
    const key = 'ceo-os-import-recovery-test';
    localStorage.setItem(key, JSON.stringify({ before: original, after: incoming }));
    localStorage.setItem(ACTIVE_IMPORT_KEY, key);
    localStorage.setItem(CHIEF, 'another tab wrote this');
    expect(rollbackImport()).toEqual({ recovered: false, failedKeys: [CHIEF] });
    expect(localStorage.getItem(CHIEF)).toBe('another tab wrote this');
    expect(getImportRecovery()).not.toBeNull();
  });
  it.each([
    { schemaVersion: 99, domain: 'settings', data: {} },
    { schemaVersion: 1, domain: 'captureNotes', data: [] },
    { schemaVersion: 1.5, domain: 'settings', data: {} },
    { schemaVersion: 1, domain: 'settings', data: { teamName: {} } },
  ])('rejects unsupported envelopes before touching any store: %j', (value) => {
    expect(() => importWorkspaceBackup(backup({ ...incoming, [SETTINGS]: JSON.stringify(value) }))).toThrow();
    expect(rawStores()).toEqual(original);
  });
  it('rejects unknown rich-text marks and keeps legacy free-text Chief notes', () => {
    const pages = { pages: [{ id: 'p', title: 'Bad marks', blocks: { notes: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'hi', marks: [{ type: 'unknown' }] }] }] } } }], deletedPageIds: [] };
    expect(() => importWorkspaceBackup(backup({ 'ceo-os-notebook-pages': JSON.stringify(pages) }))).toThrow(/unsupported shape/);
    expect(() => importWorkspaceBackup(backup({ [CHIEF]: '[ ] An old plain-text checklist' }))).not.toThrow();
    expect(localStorage.getItem(CHIEF)).toBe('[ ] An old plain-text checklist');
  });
  it('rejects malformed nested rich text before importing any store', () => {
    const pages = { pages: [{ id: 'p', title: 'Bad doc', blocks: { notes: { type: 'doc', content: [{ type: 'text', text: {} }] } } }], deletedPageIds: [] };
    expect(() => importWorkspaceBackup(backup({ ...incoming, 'ceo-os-notebook-pages': JSON.stringify(pages) }))).toThrow(/unsupported shape/);
    expect(rawStores()).toEqual(original);
  });
});

describe('durable corruption recovery', () => {
  it('quarantines newer data without downgrading or losing it, deduplicates repeated reads, and refuses blind restore', () => {
    const raw = JSON.stringify({ schemaVersion: 99, domain: 'settings', data: { newFeature: true } });
    localStorage.setItem(SETTINGS, raw);
    expect(readVersionedLocalStorage('settings', {})).toEqual({});
    preserveCorruptStorageValue(SETTINGS, raw);
    const entries = listStorageRecovery();
    expect(entries).toHaveLength(1); expect(entries[0].value).toBe(raw);
    expect(restoreCorruptBackup(SETTINGS, entries[0].backupKey)).toBe(false);
    writeVersionedLocalStorage('settings', { teamName: 'New safe workspace' });
    expect(localStorage.getItem(entries[0].backupKey)).toBe(raw);
  });
  it('keeps the original in place and blocks replacement if even quarantine exceeds quota', () => {
    localStorage.setItem(SETTINGS, '{unreadable');
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(readVersionedLocalStorage('settings', {})).toEqual({});
    expect(() => assertStorageWritable(SETTINGS)).toThrow(/could not be preserved/);
    expect(localStorage.getItem(SETTINGS)).toBe('{unreadable');
    expect(listStorageRecovery()).toEqual([expect.objectContaining({ key: SETTINGS, backupKey: null, value: '{unreadable' })]);
  });
  it('discovers archives even when the secondary index could not be stored', () => {
    const set = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, raw) => { if (key.endsWith('__corrupt_index')) throw new Error('quota'); set(key, raw); });
    preserveCorruptStorageValue(SETTINGS, '{unreadable');
    expect(listStorageRecovery()).toHaveLength(1);
  });
  it('tolerates a damaged archive index and timestamp without hiding the original bytes', () => {
    localStorage.setItem(`${SETTINGS}__corrupt_index`, JSON.stringify([null, 5, {}, 'unrelated-key']));
    localStorage.setItem(`${SETTINGS}__corrupt_999999999999999999999`, '{original');
    expect(listStorageRecovery()).toEqual([expect.objectContaining({ value: '{original', savedAt: null })]);
  });
  it('does not mistake plain draft text or unrelated preferences for damaged structured stores', () => {
    localStorage.setItem('ceo-os-capture-draft-text', 'An ordinary thought');
    localStorage.setItem('ceo-os-focus-mode', 'focus');
    expect(listStorageRecovery()).toEqual([]);
  });
});

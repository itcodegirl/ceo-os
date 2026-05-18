import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  STORAGE_ARCHIVED_EVENT,
  STORAGE_CORRUPTION_EVENT,
  STORAGE_RESTORED_EVENT,
  archiveStorageValue,
  discardCorruptBackup,
  listCorruptBackups,
  parseJsonOrPreserveCorruption,
  preserveCorruptStorageValue,
  restoreCorruptBackup,
} from './storageCorruption';

describe('preserveCorruptStorageValue', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('writes a timestamped backup key for the corrupted blob', () => {
    const key = 'ceo-os-test-corrupt';
    const raw = '{this is not json';

    const backupKey = preserveCorruptStorageValue(key, raw, new Error('SyntaxError'));

    expect(backupKey).toMatch(/^ceo-os-test-corrupt__corrupt_\d+-\d{3}$/);
    expect(window.localStorage.getItem(backupKey)).toBe(raw);
  });

  it('dispatches a window event so a UI banner can react', () => {
    const detailEvents = [];
    const listener = (event) => {
      detailEvents.push(event.detail);
    };
    window.addEventListener(STORAGE_CORRUPTION_EVENT, listener);

    try {
      preserveCorruptStorageValue('ceo-os-test-event', '{', new Error('boom'));
    } finally {
      window.removeEventListener(STORAGE_CORRUPTION_EVENT, listener);
    }

    expect(detailEvents).toHaveLength(1);
    expect(detailEvents[0]).toMatchObject({
      key: 'ceo-os-test-event',
      message: 'boom',
    });
    expect(typeof detailEvents[0].backupKey).toBe('string');
  });

  it('keeps at most three backups per key', () => {
    const key = 'ceo-os-test-cap';
    const writtenKeys = [];
    for (let index = 0; index < 5; index += 1) {
      const backupKey = preserveCorruptStorageValue(key, `payload-${index}`, new Error('parse'));
      if (backupKey) {
        writtenKeys.push(backupKey);
      }
    }

    expect(writtenKeys).toHaveLength(5);

    const survivors = writtenKeys.filter((backupKey) => window.localStorage.getItem(backupKey) !== null);
    expect(survivors).toHaveLength(3);
  });

  it('returns null and does nothing when the raw value is null', () => {
    const result = preserveCorruptStorageValue('ceo-os-test-null', null, new Error('parse'));
    expect(result).toBeNull();
  });
});

describe('parseJsonOrPreserveCorruption', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('returns parsed JSON when readable', () => {
    expect(parseJsonOrPreserveCorruption('ceo-os-test-parse', '{"ok":true}', {})).toEqual({ ok: true });
  });

  it('preserves unreadable JSON and returns the fallback', () => {
    const fallback = { ok: false };

    expect(parseJsonOrPreserveCorruption('ceo-os-test-parse-bad', '{bad', fallback)).toBe(fallback);
    expect(listCorruptBackups('ceo-os-test-parse-bad')[0]).toMatchObject({
      value: '{bad',
    });
  });
});

describe('listCorruptBackups', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('lists preserved backups newest first with parsed timestamps and raw values', () => {
    const key = 'ceo-os-test-list';
    preserveCorruptStorageValue(key, 'first', new Error('a'));
    preserveCorruptStorageValue(key, 'second', new Error('b'));

    const backups = listCorruptBackups(key);
    expect(backups).toHaveLength(2);
    expect(backups[0].value).toBe('second');
    expect(backups[1].value).toBe('first');
    backups.forEach((entry) => {
      expect(typeof entry.backupKey).toBe('string');
      expect(typeof entry.savedAt).toBe('string');
      expect(Number.isNaN(Date.parse(entry.savedAt))).toBe(false);
    });
  });

  it('returns an empty array when there are no backups', () => {
    expect(listCorruptBackups('ceo-os-test-empty')).toEqual([]);
  });
});

describe('restoreCorruptBackup', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('writes the backup back to the primary key, removes the backup, and dispatches the restored event', () => {
    const key = 'ceo-os-test-restore';
    const backupKey = preserveCorruptStorageValue(key, '{"name":"recovered"}', new Error('parse'));
    expect(backupKey).toBeTruthy();

    const detail = [];
    const listener = (event) => detail.push(event.detail);
    window.addEventListener(STORAGE_RESTORED_EVENT, listener);

    try {
      const ok = restoreCorruptBackup(key, backupKey);
      expect(ok).toBe(true);
    } finally {
      window.removeEventListener(STORAGE_RESTORED_EVENT, listener);
    }

    expect(window.localStorage.getItem(key)).toBe('{"name":"recovered"}');
    expect(window.localStorage.getItem(backupKey)).toBeNull();
    expect(listCorruptBackups(key)).toEqual([]);
    expect(detail).toHaveLength(1);
    expect(detail[0]).toMatchObject({ key, backupKey });
  });

  it('returns false when the backup key is missing', () => {
    expect(restoreCorruptBackup('ceo-os-test-restore', 'ceo-os-test-restore__corrupt_missing')).toBe(false);
  });
});

describe('discardCorruptBackup', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('removes the backup and prunes it from the index', () => {
    const key = 'ceo-os-test-discard';
    const backupKey = preserveCorruptStorageValue(key, 'gone', new Error('parse'));
    expect(backupKey).toBeTruthy();

    expect(discardCorruptBackup(key, backupKey)).toBe(true);
    expect(window.localStorage.getItem(backupKey)).toBeNull();
    expect(listCorruptBackups(key)).toEqual([]);
  });
});

describe('archiveStorageValue', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('moves the existing value into a backup and removes the primary key', () => {
    const key = 'ceo-os-test-archive';
    window.localStorage.setItem(key, '{"legacy":true}');

    const backupKey = archiveStorageValue(key, { reason: 'legacy-cleanup' });

    expect(backupKey).toMatch(/^ceo-os-test-archive__corrupt_\d+-\d{3}$/);
    expect(window.localStorage.getItem(key)).toBeNull();
    expect(window.localStorage.getItem(backupKey)).toBe('{"legacy":true}');
  });

  it('emits STORAGE_ARCHIVED_EVENT (not the corruption event) so the UI does not misclassify the archive', () => {
    const key = 'ceo-os-test-archive-event';
    window.localStorage.setItem(key, 'value');

    const archivedDetails = [];
    const corruptionDetails = [];
    const archivedListener = (event) => archivedDetails.push(event.detail);
    const corruptionListener = (event) => corruptionDetails.push(event.detail);
    window.addEventListener(STORAGE_ARCHIVED_EVENT, archivedListener);
    window.addEventListener(STORAGE_CORRUPTION_EVENT, corruptionListener);

    try {
      archiveStorageValue(key, { reason: 'legacy-cleanup' });
    } finally {
      window.removeEventListener(STORAGE_ARCHIVED_EVENT, archivedListener);
      window.removeEventListener(STORAGE_CORRUPTION_EVENT, corruptionListener);
    }

    expect(archivedDetails).toHaveLength(1);
    expect(archivedDetails[0]).toMatchObject({ key, reason: 'legacy-cleanup' });
    expect(typeof archivedDetails[0].backupKey).toBe('string');
    expect(corruptionDetails).toHaveLength(0);
  });

  it('is a no-op and returns null when the primary key is empty or missing', () => {
    expect(archiveStorageValue('ceo-os-test-archive-missing')).toBeNull();

    window.localStorage.setItem('ceo-os-test-archive-empty', '');
    expect(archiveStorageValue('ceo-os-test-archive-empty')).toBeNull();
  });

  it('produces a backup that listCorruptBackups and restoreCorruptBackup recognise', () => {
    const key = 'ceo-os-test-archive-recover';
    window.localStorage.setItem(key, 'recoverable');

    const backupKey = archiveStorageValue(key, { reason: 'legacy-cleanup' });
    expect(backupKey).toBeTruthy();

    const backups = listCorruptBackups(key);
    expect(backups).toHaveLength(1);
    expect(backups[0]).toMatchObject({ backupKey, value: 'recoverable' });

    expect(restoreCorruptBackup(key, backupKey)).toBe(true);
    expect(window.localStorage.getItem(key)).toBe('recoverable');
  });
});

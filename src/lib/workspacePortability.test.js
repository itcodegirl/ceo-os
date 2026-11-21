import { importWorkspaceBackup } from './workspaceBackupImport';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  WORKSPACE_BACKUP_FORMAT,
  WORKSPACE_BACKUP_IMPORTED_EVENT,
  buildWorkspaceBackup,
  buildWorkspaceBackupFileName,
  getLocalWorkspaceDataHealth,
} from './workspacePortability';
import { SETTINGS_UPDATED_EVENT } from './settingsRepository';
import { CAPTURE_NOTES_UPDATED_EVENT } from './captureRepository';

describe('src/lib/workspacePortability', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('builds a versioned backup from valid local workspace stores', () => {
    window.localStorage.setItem('ceo-os-settings', JSON.stringify({ teamName: 'CodeHerWay' }));
    window.localStorage.setItem('ceo-os-capture-notes', JSON.stringify([
      { id: 'note-1', text: 'Follow up' },
    ]));
    window.localStorage.setItem('ceo-os-chief-notes', 'Prep the weekly decision review.');

    const backup = buildWorkspaceBackup({
      now: new Date('2026-05-07T12:00:00.000Z'),
    });

    expect(backup.format).toBe(WORKSPACE_BACKUP_FORMAT);
    expect(backup.schemaVersion).toBe(1);
    expect(backup.exportedAt).toBe('2026-05-07T12:00:00.000Z');
    expect(backup.keys['ceo-os-settings']).toContain('CodeHerWay');
    expect(backup.keys['ceo-os-chief-notes']).toBe('Prep the weekly decision review.');
    expect(backup.summary.includedStoreCount).toBe(3);
    expect(backup.summary.localRecordCount).toBe(3);
    expect(backup.summary.pendingSyncIncluded).toBe(false);
  });

  it('skips unreadable JSON stores instead of exporting a broken backup value', () => {
    window.localStorage.setItem('ceo-os-settings', '{not json');
    window.localStorage.setItem('ceo-os-capture-notes', JSON.stringify([]));

    const backup = buildWorkspaceBackup();

    expect(backup.keys['ceo-os-settings']).toBeUndefined();
    expect(backup.keys['ceo-os-capture-notes']).toBe('[]');
    expect(backup.skipped).toEqual([
      expect.objectContaining({
        key: 'ceo-os-settings',
        reason: 'Settings is not valid JSON.',
      }),
    ]);
  });

  it('summarizes local records, invalid stores, and pending sync without exporting the queue', () => {
    window.localStorage.setItem('ceo-os-capture-notes', JSON.stringify([
      { id: 'note-1' },
      { id: 'note-2' },
    ]));
    window.localStorage.setItem('ceo-os-journal-entries', JSON.stringify({
      '2026-05-07': { date: '2026-05-07' },
    }));
    window.localStorage.setItem('ceo-os-weekly-briefs', JSON.stringify({
      schemaVersion: 1,
      data: {
        '2026-05-04': {
          reviewNotes: 'Keep shipping calmly.',
          priorities: [{ id: 'priority-1' }],
          wins: [{ id: 'win-1' }],
          blockers: [],
        },
      },
    }));
    window.localStorage.setItem('ceo-os-settings', '{broken');
    window.localStorage.setItem('ceo-os-offline-write-queue', JSON.stringify([
      { id: 'q-1', kind: 'content:update' },
    ]));

    const health = getLocalWorkspaceDataHealth();
    const backup = buildWorkspaceBackup();

    expect(health.localRecordCount).toBe(6);
    expect(health.invalidStoreCount).toBe(1);
    expect(health.pendingSyncCount).toBe(1);
    expect(backup.keys['ceo-os-offline-write-queue']).toBeUndefined();
    expect(backup.summary.pendingSyncCount).toBe(1);
  });

  it('imports only supported keys after validating the full backup', () => {
    const settingsListener = vi.fn();
    const captureListener = vi.fn();
    const importedListener = vi.fn();
    window.addEventListener(SETTINGS_UPDATED_EVENT, settingsListener);
    window.addEventListener(CAPTURE_NOTES_UPDATED_EVENT, captureListener);
    window.addEventListener(WORKSPACE_BACKUP_IMPORTED_EVENT, importedListener);

    try {
      const result = importWorkspaceBackup(JSON.stringify({
        format: WORKSPACE_BACKUP_FORMAT,
        schemaVersion: 1,
        keys: {
          'ceo-os-settings': JSON.stringify({ teamName: 'Imported Team' }),
          'ceo-os-capture-notes': JSON.stringify([{ id: 'note-1', text: 'Imported' }]),
          'unrelated-app-key': 'ignore me',
        },
      }));

      expect(result.importedStoreCount).toBe(2);
      expect(result.ignoredKeyCount).toBe(1);
      expect(window.localStorage.getItem('ceo-os-settings')).toContain('Imported Team');
      expect(window.localStorage.getItem('unrelated-app-key')).toBeNull();
      expect(settingsListener).toHaveBeenCalledTimes(1);
      expect(captureListener).toHaveBeenCalledTimes(1);
      expect(importedListener).toHaveBeenCalledTimes(1);
    } finally {
      window.removeEventListener(SETTINGS_UPDATED_EVENT, settingsListener);
      window.removeEventListener(CAPTURE_NOTES_UPDATED_EVENT, captureListener);
      window.removeEventListener(WORKSPACE_BACKUP_IMPORTED_EVENT, importedListener);
    }
  });

  it('rejects invalid backups before writing any known store', () => {
    window.localStorage.setItem('ceo-os-settings', JSON.stringify({ teamName: 'Original' }));

    expect(() => importWorkspaceBackup(JSON.stringify({
      format: WORKSPACE_BACKUP_FORMAT,
      schemaVersion: 1,
      keys: {
        'ceo-os-settings': '{broken',
        'ceo-os-capture-notes': JSON.stringify([{ id: 'note-1' }]),
      },
    }))).toThrow('Settings is not valid JSON.');

    expect(window.localStorage.getItem('ceo-os-settings')).toContain('Original');
    expect(window.localStorage.getItem('ceo-os-capture-notes')).toBeNull();
  });

  it('uses a filesystem-safe backup file name', () => {
    expect(buildWorkspaceBackupFileName(new Date('2026-05-07T12:34:56.789Z')))
      .toBe('codeherway-ceo-os-backup-2026-05-07T12-34-56-789Z.json');
  });
});

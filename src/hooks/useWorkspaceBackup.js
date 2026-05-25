import { useCallback, useState } from 'react';
import {
  buildWorkspaceBackup,
  buildWorkspaceBackupFileName,
  getLocalWorkspaceDataHealth,
  importWorkspaceBackup,
} from '../lib/workspacePortability';

/**
 * Pluralizing count formatter shared by the backup status messages (built
 * here) and the data-health copy (built in the consuming component).
 */
export function formatCount(count, singular, plural = `${singular}s`) {
  const normalized = Number(count) || 0;
  return `${normalized} ${normalized === 1 ? singular : plural}`;
}

function readFileAsText(file) {
  if (file && typeof file.text === 'function') {
    return file.text();
  }

  return new Promise((resolve, reject) => {
    if (typeof FileReader !== 'function') {
      reject(new Error('Backup import is not available in this browser.'));
      return;
    }

    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Backup file could not be read.'));
    reader.readAsText(file);
  });
}

/**
 * Owns the local workspace backup export/import file-IO plus the resulting
 * status and data-health snapshot for the Settings "Workspace Data" section.
 * Extracted from SettingsWorkspaceDataSection so the Blob / createObjectURL /
 * FileReader plumbing is unit-testable apart from the markup.
 *
 * `dataHealth` is recomputed on every render (matching the original direct
 * call) so workspace-setup actions elsewhere on the page — start blank, load
 * demo, clear demo — reflect immediately; export/import additionally bump an
 * internal counter to force a re-read when no other state changed.
 *
 * `importBackup` swallows its own errors into `portabilityStatus` and never
 * rejects, so callers can `await` it without a try/catch.
 */
export function useWorkspaceBackup({ onRefreshSettings } = {}) {
  const [, setDataHealthRefreshKey] = useState(0);
  const [portabilityStatus, setPortabilityStatus] = useState({ tone: '', message: '' });

  const dataHealth = getLocalWorkspaceDataHealth();

  const exportBackup = useCallback(() => {
    try {
      const backup = buildWorkspaceBackup();
      if (
        typeof Blob !== 'function'
        || typeof window === 'undefined'
        || !window.URL
        || typeof window.URL.createObjectURL !== 'function'
      ) {
        setPortabilityStatus({
          tone: 'error',
          message: 'Backup export is not available in this browser.',
        });
        return;
      }

      const backupContent = JSON.stringify(backup, null, 2);
      const blob = new Blob([backupContent], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildWorkspaceBackupFileName(backup.exportedAt);
      link.rel = 'noopener';
      link.click();
      window.setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 0);

      setDataHealthRefreshKey((current) => current + 1);
      setPortabilityStatus({
        tone: 'success',
        message: `${formatCount(backup.summary.includedStoreCount, 'local store')} exported. Pending sync is reported in the file, not replayed from backups.`,
      });
    } catch (error) {
      setPortabilityStatus({
        tone: 'error',
        message: error?.message || 'Backup export failed.',
      });
    }
  }, []);

  const importBackup = useCallback(async (file) => {
    if (!file) {
      return;
    }

    try {
      const backupText = await readFileAsText(file);
      const result = importWorkspaceBackup(backupText);
      setDataHealthRefreshKey((current) => current + 1);
      if (typeof onRefreshSettings === 'function') {
        await onRefreshSettings();
      }
      setPortabilityStatus({
        tone: 'success',
        message: `${formatCount(result.importedStoreCount, 'local store')} imported. Matching local stores were replaced; Supabase data was not changed.`,
      });
    } catch (error) {
      setPortabilityStatus({
        tone: 'error',
        message: error?.message || 'Backup import failed.',
      });
    }
  }, [onRefreshSettings]);

  return {
    dataHealth,
    portabilityStatus,
    exportBackup,
    importBackup,
  };
}

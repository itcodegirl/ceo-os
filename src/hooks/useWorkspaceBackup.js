import { useCallback, useRef, useState } from 'react';
import {
  buildWorkspaceBackup,
  buildWorkspaceBackupFileName,
  getLocalWorkspaceDataHealth,
  importWorkspaceBackup,
} from '../lib/workspacePortability';

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
 * Encapsulates the workspace backup file-IO (Blob/createObjectURL export and
 * FileReader/text import) that previously lived inline in
 * `SettingsWorkspaceDataSection`. Owns the portability status message, the
 * hidden file-input ref, and a data-health refresh counter so the section can
 * stay focused on markup. Extracted so the file-IO is unit-testable apart
 * from the JSX.
 *
 * `onRefreshSettings` (optional) is awaited after a successful import so the
 * caller can reload dependent settings state.
 */
export function useWorkspaceBackup({ onRefreshSettings } = {}) {
  // Only the setter is used: bumping it forces a re-render so `dataHealth`
  // (read fresh from localStorage below) reflects the latest export/import.
  const [, setDataHealthRefreshKey] = useState(0);
  const [portabilityStatus, setPortabilityStatus] = useState({ tone: '', message: '' });
  const importInputRef = useRef(null);

  const dataHealth = getLocalWorkspaceDataHealth();

  const handleExportBackup = useCallback(() => {
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

  const handleImportClick = useCallback(() => {
    importInputRef.current?.click();
  }, []);

  const handleImportBackup = useCallback(async (event) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
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
    } finally {
      input.value = '';
    }
  }, [onRefreshSettings]);

  return {
    dataHealth,
    portabilityStatus,
    importInputRef,
    handleExportBackup,
    handleImportClick,
    handleImportBackup,
  };
}

import { useId, useRef, useState } from 'react';
import SectionCard from '../ui/SectionCard';
import Button from '../ui/Button';
import { useWorkspaceSetup } from '../../hooks/useWorkspaceSetup';
import { useOfflineWriteQueueSize } from '../../hooks/useOfflineWriteQueue';
import { SOURCE_NOTICE_DEMO_DATA } from '../../lib/uiCopy';
import {
  buildWorkspaceBackup,
  buildWorkspaceBackupFileName,
  getLocalWorkspaceDataHealth,
  importWorkspaceBackup,
} from '../../lib/workspacePortability';

function formatCount(count, singular, plural = `${singular}s`) {
  const normalized = Number(count) || 0;
  return `${normalized} ${normalized === 1 ? singular : plural}`;
}

function formatSavedAt(savedAt) {
  const timestamp = Number(savedAt);
  if (!Number.isFinite(timestamp) || timestamp <= 0) {
    return 'No local settings save recorded yet.';
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return 'No local settings save recorded yet.';
  }

  return `Last local settings save: ${date.toLocaleString()}.`;
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
 * Workspace data section — local setup choice, demo data, data health
 * summary, and backup export/import. Owns its own workspace-setup hook,
 * portability status, and data-health refresh counter. The parent passes
 * the `source` from useSettings and an `onRefreshSettings` callback so that
 * importing a backup can re-load settings without lifting all the state
 * back into Settings.jsx.
 */
function SettingsWorkspaceDataSection({ source, onRefreshSettings }) {
  const {
    hasChoice: hasWorkspaceSetupChoice,
    isDemoMode,
    startBlankWorkspace,
    loadDemoWorkspace,
    clearDemoData,
  } = useWorkspaceSetup();
  const pendingSyncCount = useOfflineWriteQueueSize();
  const [, setDataHealthRefreshKey] = useState(0);
  const [portabilityStatus, setPortabilityStatus] = useState({ tone: '', message: '' });
  const importInputId = useId();
  const importInputRef = useRef(null);

  const dataHealth = getLocalWorkspaceDataHealth();
  const backupScopeCopy = source === 'supabase'
    ? 'Backups cover this browser\'s local fallback data. Synced Supabase records stay in Supabase.'
    : 'Backups cover the local workspace data stored in this browser.';
  const healthIssueCopy = dataHealth.invalidStoreCount > 0
    ? `${formatCount(dataHealth.invalidStoreCount, 'local store')} needs recovery and will not be exported.`
    : 'No local data recovery issues detected.';
  const pendingSyncCopy = pendingSyncCount > 0
    ? `${formatCount(pendingSyncCount, 'supported write')} waiting to sync.`
    : 'No supported writes waiting to sync.';

  const handleExportBackup = () => {
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
  };

  const handleImportClick = () => {
    importInputRef.current?.click();
  };

  const handleImportBackup = async (event) => {
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
  };

  return (
    <SectionCard title="Workspace Data" iconName="section">
      <div className="settings-workspace-setup">
        <p className="helper-text">
          {hasWorkspaceSetupChoice
            ? isDemoMode
              ? SOURCE_NOTICE_DEMO_DATA
              : 'Blank local workspace is active on this device.'
            : 'No setup choice has been saved yet. Demo records are shown for review until you choose.'}
        </p>
        <div className="settings-workspace-setup__actions">
          <Button type="button" size="small" onClick={startBlankWorkspace} icon={{ name: 'check', size: 14 }}>
            Start blank
          </Button>
          <Button type="button" size="small" variant="ghost" onClick={loadDemoWorkspace} icon={{ name: 'section', size: 14 }}>
            Load demo workspace
          </Button>
          <Button
            type="button"
            size="small"
            variant="ghost"
            onClick={clearDemoData}
            disabled={!isDemoMode}
            ariaLabel={isDemoMode ? 'Clear demo data from this device' : 'Clear demo data unavailable'}
          >
            Clear demo data
          </Button>
        </div>
      </div>

      <div className="settings-data-health" role="group" aria-label="Local data health">
        <div className="settings-data-health__summary" role="list">
          <span role="listitem">
            <strong>{dataHealth.localRecordCount}</strong>
            Local records
          </span>
          <span role="listitem">
            <strong>{dataHealth.restorableStoreCount}</strong>
            Backup stores
          </span>
          <span role="listitem">
            <strong>{pendingSyncCount}</strong>
            Pending sync
          </span>
        </div>
        <p className="helper-text">
          {backupScopeCopy} {healthIssueCopy} {pendingSyncCopy}
        </p>
        <p className="helper-text helper-text--muted">
          {formatSavedAt(dataHealth.lastSettingsSavedAt)}
        </p>
        <div className="settings-workspace-setup__actions">
          <Button
            type="button"
            size="small"
            onClick={handleExportBackup}
            disabled={!dataHealth.isAvailable}
            ariaLabel="Export local workspace backup"
            icon={{ name: 'copy', size: 14 }}
          >
            Export backup
          </Button>
          <Button
            type="button"
            size="small"
            variant="ghost"
            onClick={handleImportClick}
            disabled={!dataHealth.isAvailable}
            ariaLabel="Import local workspace backup"
            icon={{ name: 'section', size: 14 }}
          >
            Import backup
          </Button>
          <input
            id={importInputId}
            ref={importInputRef}
            className="settings-backup-file"
            type="file"
            accept="application/json,.json"
            aria-label="Import local workspace backup file"
            onChange={handleImportBackup}
          />
        </div>
        <p className="helper-text helper-text--muted">
          Import replaces matching local stores only. It does not delete other local data or migrate anything into Supabase.
        </p>
        {portabilityStatus.message ? (
          <p
            className={`helper-text settings-backup-status settings-backup-status--${portabilityStatus.tone}`}
            role={portabilityStatus.tone === 'error' ? 'alert' : 'status'}
            aria-live="polite"
          >
            {portabilityStatus.message}
          </p>
        ) : null}
      </div>
    </SectionCard>
  );
}

export default SettingsWorkspaceDataSection;

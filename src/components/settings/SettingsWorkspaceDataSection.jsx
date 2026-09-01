import { useId } from 'react';
import SectionCard from '../ui/SectionCard';
import Button from '../ui/Button';
import LoadDemoWorkspaceButton from '../ui/LoadDemoWorkspaceButton';
import { useWorkspaceSetup } from '../../hooks/useWorkspaceSetup';
import { useOfflineWriteQueueSize } from '../../hooks/useOfflineWriteQueue';
import { formatCount, useWorkspaceBackup } from '../../hooks/useWorkspaceBackup';
import { SOURCE_NOTICE_DEMO_DATA } from '../../lib/uiCopy';

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

/**
 * Workspace data section — local setup choice, demo data, data health
 * summary, and backup export/import. The backup file-IO, portability status,
 * and data-health refresh live in `useWorkspaceBackup` so this component stays
 * focused on markup. The parent passes the `source` from useSettings and an
 * `onRefreshSettings` callback so that importing a backup can re-load settings
 * without lifting all the state back into Settings.jsx.
 */
function SettingsWorkspaceDataSection({ source, onRefreshSettings }) {
  const {
    hasChoice: hasWorkspaceSetupChoice,
    isDemoMode,
    startBlankWorkspace,
    clearDemoData,
  } = useWorkspaceSetup();
  const pendingSyncCount = useOfflineWriteQueueSize();
  const {
    dataHealth,
    portabilityStatus,
    importInputRef,
    handleExportBackup,
    handleImportClick,
    handleImportBackup,
  } = useWorkspaceBackup({ onRefreshSettings });
  const importInputId = useId();

  const backupScopeCopy = source === 'supabase'
    ? 'Backups cover this browser\'s local fallback data. Synced Supabase records stay in Supabase.'
    : 'Backups cover the local workspace data stored in this browser.';
  const healthIssueCopy = dataHealth.invalidStoreCount > 0
    ? `${formatCount(dataHealth.invalidStoreCount, 'local store')} needs recovery and will not be exported.`
    : 'No local data recovery issues detected.';
  const pendingSyncCopy = pendingSyncCount > 0
    ? `${formatCount(pendingSyncCount, 'supported write')} waiting to sync.`
    : 'No supported writes waiting to sync.';

  return (
    <SectionCard id="workspace-data" title="Workspace Data" iconName="section">
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
          <LoadDemoWorkspaceButton size="small" />
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

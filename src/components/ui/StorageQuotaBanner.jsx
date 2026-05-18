import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { SAVE_STATUS_EVENT } from '../../lib/saveStatusBus';

/**
 * Listens for quota-exceeded save failures (the `kind: 'quota'` variant of
 * the save-status bus) and surfaces a recovery banner. Distinct from the
 * StorageCorruptionBanner — corruption is "stored data was unreadable",
 * quota is "we ran out of room", and the recovery paths differ:
 *
 *   - Corruption → restore from a preserved backup.
 *   - Quota      → export a backup, then clear data (demo workspace or
 *                  unused stores) so future writes succeed.
 *
 * The banner shows on the first quota event and stays until dismissed.
 * Subsequent quota events refresh the "last seen at" timestamp but do not
 * flash the banner closed and back open.
 *
 * The link target is `/settings#workspace-data` so the user lands directly
 * on the Export-backup + Clear-demo-data row.
 */
function StorageQuotaBanner() {
  const [latest, setLatest] = useState(null);

  useEffect(() => {
    const handler = (event) => {
      const detail = event?.detail;
      if (!detail || detail.phase !== 'failed' || detail.kind !== 'quota') {
        return;
      }
      setLatest(detail);
    };
    window.addEventListener(SAVE_STATUS_EVENT, handler);
    return () => window.removeEventListener(SAVE_STATUS_EVENT, handler);
  }, []);

  const onDismiss = useCallback(() => {
    setLatest(null);
  }, []);

  if (!latest) {
    return null;
  }

  return (
    <div
      className="storage-quota-banner"
      role="alert"
      aria-live="assertive"
      data-testid="storage-quota-banner"
    >
      <div className="storage-quota-banner__body">
        <strong className="storage-quota-banner__title">Local storage is full</strong>
        <p className="storage-quota-banner__text">
          Your last change to <code>{latest.key}</code> didn't save because this
          device's local storage ran out of room. Export a backup, then clear
          demo data or remove unused records, to free space.
        </p>
      </div>
      <div className="storage-quota-banner__buttons">
        <Link to="/settings" className="storage-quota-banner__action">
          Open workspace data
        </Link>
        <button
          type="button"
          className="storage-quota-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss storage quota notice"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default StorageQuotaBanner;

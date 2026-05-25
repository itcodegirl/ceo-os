import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  STORAGE_CORRUPTION_EVENT,
  STORAGE_RESTORED_EVENT,
  discardCorruptBackup,
  listCorruptBackups,
  restoreCorruptBackup,
} from '../../lib/storageCorruption';

const PREVIEW_LIMIT = 140;
const RECOVERY_PANEL_ID = 'storage-corruption-banner-recovery-list';

function formatSavedAt(iso) {
  if (!iso) return 'unknown time';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function previewValue(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  if (trimmed.length <= PREVIEW_LIMIT) {
    return trimmed;
  }
  return `${trimmed.slice(0, PREVIEW_LIMIT)}…`;
}

/**
 * Listens for corrupted-localStorage events and surfaces both the warning
 * and the recovery affordance. The user can preview each preserved backup
 * (newest first), restore one back into the primary key, or discard them.
 *
 * Restoring writes the raw blob back to the primary key and emits
 * STORAGE_RESTORED_EVENT — a full reload is the simplest way to ensure
 * dependent hooks pick up the restored state, so we hint at it after a
 * successful restore.
 */
function StorageCorruptionBanner() {
  const [latest, setLatest] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [backups, setBackups] = useState([]);
  const [restoredAt, setRestoredAt] = useState(null);

  const refreshBackups = useCallback((key) => {
    if (!key) {
      setBackups([]);
      return;
    }
    setBackups(listCorruptBackups(key));
  }, []);

  useEffect(() => {
    const handleCorruption = (event) => {
      const detail = event?.detail;
      if (!detail) return;
      setLatest(detail);
      setExpanded(false);
      setRestoredAt(null);
      refreshBackups(detail.key);
    };
    const handleRestored = (event) => {
      const detail = event?.detail;
      if (!detail) return;
      setRestoredAt(detail.at);
      refreshBackups(detail.key);
    };
    window.addEventListener(STORAGE_CORRUPTION_EVENT, handleCorruption);
    window.addEventListener(STORAGE_RESTORED_EVENT, handleRestored);
    return () => {
      window.removeEventListener(STORAGE_CORRUPTION_EVENT, handleCorruption);
      window.removeEventListener(STORAGE_RESTORED_EVENT, handleRestored);
    };
  }, [refreshBackups]);

  const onToggleRecover = useCallback(() => {
    if (!latest?.key) return;
    refreshBackups(latest.key);
    setExpanded((prev) => !prev);
  }, [latest, refreshBackups]);

  const onRestore = useCallback(
    (backupKey) => {
      if (!latest?.key) return;
      const ok = restoreCorruptBackup(latest.key, backupKey);
      if (!ok) {
        refreshBackups(latest.key);
      }
    },
    [latest, refreshBackups],
  );

  const onDiscard = useCallback(
    (backupKey) => {
      if (!latest?.key) return;
      discardCorruptBackup(latest.key, backupKey);
      refreshBackups(latest.key);
    },
    [latest, refreshBackups],
  );

  const onDismiss = useCallback(() => {
    setLatest(null);
    setExpanded(false);
    setBackups([]);
    setRestoredAt(null);
  }, []);

  const hasBackups = useMemo(() => backups.length > 0, [backups]);

  if (!latest) {
    return null;
  }

  return (
    <div
      className="storage-corruption-banner"
      role="status"
      aria-live="polite"
      data-testid="storage-corruption-banner"
    >
      <div className="storage-corruption-banner__body">
        <strong className="storage-corruption-banner__title">Local data was unreadable</strong>
        <p className="storage-corruption-banner__text">
          We couldn’t read part of your saved workspace ({latest.key}).{' '}
          {latest.backupKey
            ? `A backup was preserved at "${latest.backupKey}".`
            : 'A backup could not be saved.'}{' '}
          You can keep working — new changes will save normally.
          {restoredAt
            ? ' Backup restored — reload the page to load the recovered data.'
            : null}
        </p>

        {/*
          Always render the panel (toggling `hidden`) so the recover button's
          aria-controls reference is stable across collapsed / expanded states
          — assistive tech can announce the relationship without the target
          element popping in and out of the DOM. Items are still rendered
          conditionally to avoid running formatters on the collapsed path.
        */}
        <ul
          id={RECOVERY_PANEL_ID}
          className="storage-corruption-banner__list"
          aria-label="Preserved backups"
          hidden={!expanded}
        >
          {expanded
            ? hasBackups
              ? backups.map((entry) => (
                  <li key={entry.backupKey} className="storage-corruption-banner__item">
                    <div className="storage-corruption-banner__item-head">
                      <span className="storage-corruption-banner__item-time">
                        Saved {formatSavedAt(entry.savedAt)}
                      </span>
                      <div className="storage-corruption-banner__item-actions">
                        <button
                          type="button"
                          className="storage-corruption-banner__action"
                          onClick={() => onRestore(entry.backupKey)}
                        >
                          Restore
                        </button>
                        <button
                          type="button"
                          className="storage-corruption-banner__action storage-corruption-banner__action--ghost"
                          onClick={() => onDiscard(entry.backupKey)}
                        >
                          Discard
                        </button>
                      </div>
                    </div>
                    <pre className="storage-corruption-banner__preview">{previewValue(entry.value)}</pre>
                  </li>
                ))
              : (
                <li className="storage-corruption-banner__item storage-corruption-banner__item--empty">
                  No preserved backups available for this key.
                </li>
              )
            : null}
        </ul>
      </div>

      <div className="storage-corruption-banner__buttons">
        {latest.backupKey ? (
          <button
            type="button"
            className="storage-corruption-banner__dismiss"
            onClick={onToggleRecover}
            aria-expanded={expanded}
            aria-controls={RECOVERY_PANEL_ID}
          >
            {expanded ? 'Hide backups' : 'Recover data'}
          </button>
        ) : null}
        <button
          type="button"
          className="storage-corruption-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss data recovery notice"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export default StorageCorruptionBanner;

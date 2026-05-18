/**
 * Compact, always-visible workspace sync status.
 *
 *   - useWorkspaceSettings().source       — Supabase vs local repository fallback.
 *   - useWorkspaceSettings().loadError    — surfaces failed Supabase loads.
 *   - useOnlineStatus()                   — navigator online/offline.
 *   - useOfflineWriteQueueSize()          — count of writes that failed
 *                                           transiently and are queued to
 *                                           replay on the next reconnect.
 *   - useAuthSession()                    — distinguishes "Supabase configured
 *                                           but user not signed in" from the
 *                                           "Supabase not wired at all" baseline.
 *
 * Tones: Offline > Sync error > Sign-in-available > Synced > Local only.
 * When pending writes are queued AND the workspace is connected to Supabase
 * (source === 'supabase'), the pill shows a "+N pending" suffix so the user
 * knows their data hasn't fully landed remotely. We only show the suffix
 * when the queue can actually drain — local-only or fully offline workspaces
 * hide it because the queue has nowhere to push to.
 *
 * When loadError is present the pill renders as a button, exposing the
 * refresh callback as an explicit retry CTA. When the workspace is
 * sign-in-available the pill renders as a Link to /sign-in.
 */

import { Link } from 'react-router-dom';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';
import { useOnlineStatus } from '../../hooks/useOnlineStatus';
import { useOfflineWriteQueueSize } from '../../hooks/useOfflineWriteQueue';
import { useAuthSession } from '../../hooks/useAuthSession';
import { describeSyncStatus } from '../../lib/syncStatusDescriptors';

function SyncStatusPill() {
  const { source, loadError, refreshWorkspaceSettings } = useWorkspaceSettings();
  const isOnline = useOnlineStatus();
  const pendingCount = useOfflineWriteQueueSize();
  const {
    isAuthenticated,
    isInitializing: isAuthInitializing,
    isDisabled: isAuthDisabled,
  } = useAuthSession();
  const hasLoadError = Boolean(loadError);
  // "Sign in to sync" only applies when Supabase is wired (not disabled),
  // auth has resolved (not still initializing), and the user isn't signed
  // in yet. Otherwise we fall back to "Local only" or "Synced".
  const isAuthAvailable = !isAuthDisabled && !isAuthInitializing && !isAuthenticated;
  const descriptor = describeSyncStatus(source, isOnline, hasLoadError, isAuthAvailable);
  // Only advertise the queue when there is somewhere for it to drain.
  const showPending = pendingCount > 0 && source === 'supabase' && isOnline;
  const label = showPending ? 'Pending sync' : descriptor.label;
  const pendingLabel = showPending ? ` · ${pendingCount} waiting` : '';
  const pendingTitle = showPending
    ? ` ${pendingCount} supported write${pendingCount === 1 ? ' is' : 's are'} waiting to sync.`
    : '';
  const titleText = hasLoadError && loadError
    ? `${loadError} ${descriptor.description}${pendingTitle}`
    : `${descriptor.description}${pendingTitle}`;

  if (hasLoadError && isOnline) {
    return (
      <button
        type="button"
        className={`sync-status-pill sync-status-pill--${descriptor.tone} sync-status-pill--retry${
          showPending ? ' sync-status-pill--has-pending' : ''
        }`}
        title={titleText}
        aria-label={`${descriptor.label}. Retry loading workspace settings.`}
        data-online={isOnline ? 'true' : 'false'}
        data-pending={showPending ? String(pendingCount) : undefined}
        onClick={() => {
          void refreshWorkspaceSettings();
        }}
      >
        <span className="sync-status-pill__dot" aria-hidden="true" />
        <span className="sync-status-pill__label">
          {descriptor.label}
          {pendingLabel}
        </span>
      </button>
    );
  }

  if (descriptor.label === 'Sign in to sync') {
    return (
      <Link
        to="/sign-in"
        className={`sync-status-pill sync-status-pill--${descriptor.tone} sync-status-pill--auth-available`}
        title={titleText}
        aria-label="Sign in to enable cloud sync."
        data-online="true"
      >
        <span className="sync-status-pill__dot" aria-hidden="true" />
        <span className="sync-status-pill__label">{descriptor.label}</span>
      </Link>
    );
  }

  return (
    <span
      className={`sync-status-pill sync-status-pill--${descriptor.tone}${
        showPending ? ' sync-status-pill--has-pending' : ''
      }`}
      role="status"
      aria-live="polite"
      title={titleText}
      data-online={isOnline ? 'true' : 'false'}
      data-pending={showPending ? String(pendingCount) : undefined}
    >
      <span className="sync-status-pill__dot" aria-hidden="true" />
      <span className="sync-status-pill__label">
        {label}
        {pendingLabel}
      </span>
    </span>
  );
}

export default SyncStatusPill;

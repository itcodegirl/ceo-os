import { useState } from 'react';
import { useWorkspaceSettings } from '../../hooks/useWorkspaceSettings';

const DISMISS_KEY = 'ceo-os-local-only-notice-dismissed-v1';

function isDismissed() {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function markDismissed() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    // ignore — notice will simply re-render next session
  }
}

/**
 * Surfaces the "this workspace is local-only" reality so users do not
 * mistake the app's silent localStorage fallback for cloud sync. Shown
 * once per browser when the resolved settings source is `local`; dismissible.
 *
 * Pairs with the SyncStatusPill: the pill is the always-on dot, this
 * banner is the one-time explanation of what "Local only" implies for
 * multi-device usage.
 */
function LocalOnlyNotice() {
  const { source } = useWorkspaceSettings();
  // The dismissed flag lives in localStorage, so we read it once on mount.
  // Subsequent dismissals flow through setDismissed inside handleDismiss,
  // which avoids the cascading-render lint rule. If the source flips from
  // supabase to local mid-session we re-derive dismissed at render time so
  // the freshly-relevant notice respects any prior dismissal.
  const [dismissed, setDismissed] = useState(() => isDismissed());

  if (source !== 'local' || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    markDismissed();
    setDismissed(true);
  };

  return (
    <div
      className="local-only-notice"
      role="status"
      aria-live="polite"
      data-testid="local-only-notice"
    >
      <div className="local-only-notice__body">
        <strong className="local-only-notice__title">This workspace is stored on this device only</strong>
        <p className="local-only-notice__text">
          To sync across devices, connect your workspace in Settings.
        </p>
      </div>
      <button
        type="button"
        className="local-only-notice__dismiss"
        onClick={handleDismiss}
        aria-label="Dismiss local-only notice"
      >
        Got it
      </button>
    </div>
  );
}

export default LocalOnlyNotice;

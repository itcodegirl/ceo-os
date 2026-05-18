/**
 * Pure helper that maps a workspace source + online state into the descriptor
 * used by SyncStatusPill. Lives in lib so the component file only exports a
 * component (keeps Vite Fast Refresh happy).
 */

const SOURCE_DESCRIPTORS = {
  supabase: {
    label: 'Synced',
    tone: 'ok',
    description: 'Workspace sync is active.',
  },
  local: {
    label: 'Local only',
    tone: 'local',
    description: 'This workspace is stored on this device only.',
  },
};

const OFFLINE_DESCRIPTOR = {
  label: 'Offline',
  tone: 'offline',
  description: 'No network connection detected. Local-only work stays on this device.',
};

const ERROR_DESCRIPTOR = {
  label: 'Sync error',
  tone: 'error',
  description: 'Workspace settings failed to load. Showing the last available snapshot — click to retry.',
};

// Surfaced when Supabase is configured and the user could enable cloud
// sync by signing in, but currently isn't signed in. Distinct from the
// "Local only" baseline — that one is for builds where Supabase isn't
// wired at all, where signing in is not an option. Audit Phase 1 fix: the
// previous behavior collapsed both cases into "Local only", so a user who
// expected to be syncing had no signal that they weren't.
const AUTH_AVAILABLE_DESCRIPTOR = {
  label: 'Sign in to sync',
  tone: 'local',
  description: 'Sign in to enable cloud sync. Local data on this device is preserved either way.',
};

/**
 * Map workspace state into the descriptor used by SyncStatusPill.
 *
 * Precedence (highest first): offline → sync error → sign-in-available →
 * source default (supabase/local). The sign-in-available branch only
 * fires when both `source === 'local'` AND `isAuthAvailable === true`, so
 * a signed-in supabase user never sees it.
 */
export function describeSyncStatus(source, isOnline, hasLoadError = false, isAuthAvailable = false) {
  if (!isOnline) {
    return OFFLINE_DESCRIPTOR;
  }
  if (hasLoadError) {
    return ERROR_DESCRIPTOR;
  }
  if (isAuthAvailable && source !== 'supabase') {
    return AUTH_AVAILABLE_DESCRIPTOR;
  }
  return SOURCE_DESCRIPTORS[source] || SOURCE_DESCRIPTORS.local;
}

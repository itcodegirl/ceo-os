/**
 * Tiny pub/sub for "did the last write succeed?" UX.
 *
 * Repositories and persistent-state hooks emit either
 *   - notifySaveSucceeded(key)  on a successful write, or
 *   - notifySaveFailed(key, error) on a write that threw.
 *
 * The SaveStatusPill subscribes via `subscribeSaveStatus` and shows a brief
 * "Saved · HH:MM" reassurance or a sticky "Save failed" callout. This is the
 * single piece of UI the user can rely on to know whether their data was
 * persisted.
 *
 * Framework-agnostic so it can be called from non-React modules (repositories).
 */

export const SAVE_STATUS_EVENT = 'ceo-os:save-status';

const SAVED_PHASE = 'saved';
const FAILED_PHASE = 'failed';

function dispatch(detail) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }
  try {
    window.dispatchEvent(new CustomEvent(SAVE_STATUS_EVENT, { detail }));
  } catch {
    // swallow — the bus is purely informational
  }
}

export function notifySaveSucceeded(key) {
  if (typeof key !== 'string' || !key) {
    return;
  }
  dispatch({ phase: SAVED_PHASE, key, at: new Date().toISOString() });
}

/**
 * Browser-portable quota-exceeded detector. localStorage quota errors
 * surface under different names across browsers:
 *   - Chrome / Firefox: name === 'QuotaExceededError'
 *   - Safari (old):     name === 'NS_ERROR_DOM_QUOTA_REACHED' or code 22
 *   - Spec'd code:      22
 * We treat any of these as quota so the UI can show storage-specific copy
 * instead of the generic "save failed" line.
 */
export function isQuotaExceededError(error) {
  if (!error || typeof error !== 'object') {
    return false;
  }
  if (error.name === 'QuotaExceededError') return true;
  if (error.name === 'NS_ERROR_DOM_QUOTA_REACHED') return true;
  if (error.code === 22 || error.code === 1014) return true;
  return false;
}

export function notifySaveFailed(key, error) {
  if (typeof key !== 'string' || !key) {
    return;
  }
  const message = error && typeof error === 'object'
    ? String(error.message || error.code || 'Unknown save error')
    : String(error || 'Unknown save error');
  const kind = isQuotaExceededError(error) ? 'quota' : 'generic';
  dispatch({ phase: FAILED_PHASE, key, at: new Date().toISOString(), message, kind });
}

export function subscribeSaveStatus(handler) {
  if (typeof window === 'undefined' || typeof handler !== 'function') {
    return () => {};
  }
  const wrapped = (event) => {
    const detail = event?.detail;
    if (!detail || typeof detail.phase !== 'string') {
      return;
    }
    handler(detail);
  };
  window.addEventListener(SAVE_STATUS_EVENT, wrapped);
  return () => window.removeEventListener(SAVE_STATUS_EVENT, wrapped);
}

export const SAVE_STATUS_PHASES = Object.freeze({
  SAVED: SAVED_PHASE,
  FAILED: FAILED_PHASE,
});

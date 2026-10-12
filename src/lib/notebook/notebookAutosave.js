// Framework-free autosave for one open notebook page.
//
// Adapted from the Study Journal autosave controller (itself adapted from the
// Journal's 600–800 ms debounce): typing records the changed blocks (and page
// fields like the title), a debounce saves them together, and a failed save
// keeps them queued so no writing is ever dropped. Everything for one page goes
// through this one controller so its version guard stays accurate. Saves are
// synchronous local writes (account sync happens underneath, in the
// repository), so there is no "saving" phase to flash.

import { isStaleRecordError } from '../staleRecordError';

export const NOTEBOOK_AUTOSAVE_DEBOUNCE_MS = 800;

const isEmpty = (value) => Object.keys(value).length === 0;

/**
 * @param {{
 *   page: { updatedAt: number },
 *   save: (changes: { blocks?: object, title?: string, sourceUrl?: string }, options: { expectedUpdatedAt?: number }) => { updatedAt: number },
 *   debounceMs?: number,
 * }} options
 */
export function createNotebookAutosave({ page, save, debounceMs = NOTEBOOK_AUTOSAVE_DEBOUNCE_MS }) {
  let pendingBlocks = {};
  let pendingFields = {};
  let knownUpdatedAt = page.updatedAt;
  let timer = null;
  /** status: 'idle' | 'dirty' | 'saved' | 'error'; error: 'stale' | 'storage' | null */
  let snapshot = { status: 'idle', savedAt: null, error: null };
  const listeners = new Set();

  const setSnapshot = (next) => {
    snapshot = { ...snapshot, ...next };
    listeners.forEach((listener) => listener());
  };

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const hasUnsavedChanges = () => !isEmpty(pendingBlocks) || !isEmpty(pendingFields);

  /** Saves pending changes now. Returns false when the save failed. */
  function flush() {
    clearTimer();
    if (!hasUnsavedChanges()) return true;

    const blocks = pendingBlocks;
    const fields = pendingFields;
    pendingBlocks = {};
    pendingFields = {};
    try {
      const saved = save(
        { ...(isEmpty(blocks) ? {} : { blocks }), ...fields },
        knownUpdatedAt ? { expectedUpdatedAt: knownUpdatedAt } : {},
      );
      knownUpdatedAt = saved.updatedAt;
      setSnapshot({ status: 'saved', savedAt: saved.updatedAt, error: null });
      return true;
    } catch (error) {
      // Keep the failed changes, letting anything typed since win.
      pendingBlocks = { ...blocks, ...pendingBlocks };
      pendingFields = { ...fields, ...pendingFields };
      setSnapshot({ status: 'error', error: isStaleRecordError(error) ? 'stale' : 'storage' });
      return false;
    }
  }

  function requestSave() {
    clearTimer();
    timer = setTimeout(() => {
      timer = null;
      flush();
    }, debounceMs);
  }

  function markDirty() {
    if (snapshot.status !== 'dirty') setSnapshot({ status: 'dirty', error: null });
    requestSave();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    update(blockKey, doc) {
      pendingBlocks = { ...pendingBlocks, [blockKey]: doc };
      markDirty();
    },
    /** Page fields such as `title` and `sourceUrl`. */
    updateFields(fields) {
      pendingFields = { ...pendingFields, ...fields };
      markDirty();
    },
    flush,
    /** Saves this tab's version over a newer one from another tab. */
    forceSave() {
      knownUpdatedAt = undefined;
      return flush();
    },
    hasUnsavedChanges,
    dispose: clearTimer,
  };
}

import { useEffect, useState, useSyncExternalStore } from 'react';
import { createNotebookAutosave } from '../lib/notebook/notebookAutosave';
import { registerNotebookSyncFlush, saveNotebookPage } from '../lib/notebook/notebookPagesRepository';

/**
 * Binds an autosave controller to one open page. The owning component is
 * keyed by page (and by remote revision), so switching pages unmounts it and
 * saves pending writing for the page being left, never the one being opened.
 */
export function useNotebookAutosave(page) {
  const [autosave] = useState(() => createNotebookAutosave({
    page,
    save: (changes, options) => saveNotebookPage(page.id, changes, options),
  }));
  const snapshot = useSyncExternalStore(autosave.subscribe, autosave.getSnapshot, autosave.getSnapshot);

  useEffect(() => {
    const saveBeforeLeaving = () => {
      if (autosave.hasUnsavedChanges()) autosave.flush();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') saveBeforeLeaving();
    };
    const unregisterSyncFlush = registerNotebookSyncFlush(saveBeforeLeaving);

    window.addEventListener('pagehide', saveBeforeLeaving);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      unregisterSyncFlush();
      window.removeEventListener('pagehide', saveBeforeLeaving);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      saveBeforeLeaving();
      autosave.dispose();
    };
  }, [autosave]);

  return {
    ...snapshot,
    update: autosave.update,
    updateFields: autosave.updateFields,
    flush: autosave.flush,
    forceSave: autosave.forceSave,
  };
}

export default useNotebookAutosave;

import { useEffect } from 'react';
import { syncNotebookPages } from '../lib/notebook/notebookPagesRepository';
import { syncNotebookItems } from '../lib/notebook/items/notebookItemsRepository';
import { syncReminders } from '../lib/remindersRepository';

const MIN_SYNC_INTERVAL_MS = 15_000;

/**
 * Keeps notebook pages, the cards, questions, and ideas made from them, and
 * reminders (including notebook to-dos) in step with the signed-in account
 * from anywhere in the app (so Focus Home reflects writing done on another
 * device). Runs on mount, when the tab regains focus, and when the browser
 * comes back online. Does nothing when Supabase is not configured or the user
 * is signed out.
 */
export function useNotebookBackgroundSync() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    let lastRunAt = 0;
    let running = false;

    const run = (force = false) => {
      const now = Date.now();
      if (running || (!force && now - lastRunAt < MIN_SYNC_INTERVAL_MS)) return;
      running = true;
      lastRunAt = now;
      // Pages first: cards, questions, and ideas point at pages, so a page
      // must exist in the account before its items can be uploaded.
      syncNotebookPages()
        .catch(() => {})
        .then(() => Promise.allSettled([syncNotebookItems(), syncReminders()]))
        .catch(() => {
          // Everything stays saved on this device and marked pending; the next
          // focus/online event (or the offline queue) retries.
        })
        .finally(() => {
          running = false;
        });
    };

    const handleFocus = () => run();
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') run();
    };
    const handleOnline = () => run(true);

    run(true);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);
}

export default useNotebookBackgroundSync;

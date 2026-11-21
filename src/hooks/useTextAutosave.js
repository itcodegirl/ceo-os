import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { createTextAutosave } from '../lib/textAutosave';

export function useTextAutosave({ resourceKey, save, delay = 600 }) {
  const draft = useMemo(() => createTextAutosave({ key: resourceKey, save, delay }), [resourceKey, save, delay]);
  const snapshot = useSyncExternalStore(draft.subscribe, draft.getSnapshot);
  useEffect(() => {
    // A recovered draft is still pending, never silently replaced by a load.
    if (draft.getSnapshot().status === 'dirty') void draft.flush();
    const flush = () => { void draft.flush(); };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      flush();
    };
  }, [draft]);
  return { draft, ...snapshot };
}

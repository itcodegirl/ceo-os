import { useCallback, useState } from 'react';
import {
  listSectionPages,
  NOTEBOOK_PAGES_STORAGE_KEY,
  NOTEBOOK_PAGES_UPDATED_EVENT,
} from '../lib/notebook/notebookPagesRepository';
import { useSilentRefresh } from './useSilentRefresh';

const NOTEBOOK_EVENTS = [NOTEBOOK_PAGES_UPDATED_EVENT];
const NOTEBOOK_STORAGE_KEYS = [NOTEBOOK_PAGES_STORAGE_KEY];

/** Pages in one notebook section, refreshed on saves, syncs, and other tabs. */
export function useNotebookPages(sectionId) {
  const [state, setState] = useState(() => ({ sectionId, pages: listSectionPages(sectionId) }));

  const refresh = useCallback(() => {
    setState({ sectionId, pages: listSectionPages(sectionId) });
  }, [sectionId]);

  useSilentRefresh({
    events: NOTEBOOK_EVENTS,
    storageKeys: NOTEBOOK_STORAGE_KEYS,
    onRefresh: refresh,
    coalesceMs: 0,
  });

  // Switching sections reads the new list during render instead of in an
  // effect, so the page list never flashes the previous section.
  if (state.sectionId !== sectionId) {
    const next = { sectionId, pages: listSectionPages(sectionId) };
    setState(next);
    return { pages: next.pages, refresh };
  }

  return { pages: state.pages, refresh };
}

export default useNotebookPages;

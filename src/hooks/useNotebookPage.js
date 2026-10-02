import { useCallback, useEffect, useState } from 'react';
import {
  ensureDailyPage,
  getDailyPage,
  getNotebookPage,
  NOTEBOOK_PAGES_STORAGE_KEY,
  NOTEBOOK_PAGES_UPDATED_EVENT,
} from '../lib/notebook/notebookPagesRepository';
import { getNotebookSection } from '../lib/notebook/notebookSections';
import { useSilentRefresh } from './useSilentRefresh';

const NOTEBOOK_EVENTS = [NOTEBOOK_PAGES_UPDATED_EVENT];
const NOTEBOOK_STORAGE_KEYS = [NOTEBOOK_PAGES_STORAGE_KEY];

/**
 * The page currently open: Personal pages are addressed by date (their id can
 * change when two devices' copies of a day merge), the other sections by id.
 * Returns `undefined` while today's Personal page is being created.
 */
export function useNotebookPage({ sectionId, pageId, date }) {
  const isDaily = getNotebookSection(sectionId).pageMode === 'daily';
  const key = isDaily ? `date:${date}` : `page:${pageId || ''}`;

  const read = useCallback(() => {
    if (isDaily) return getDailyPage(date) || undefined;
    return pageId ? getNotebookPage(pageId) : null;
  }, [date, isDaily, pageId]);

  const [state, setState] = useState(() => ({ key, page: read() }));

  const refresh = useCallback(() => {
    setState({ key, page: read() });
  }, [key, read]);

  useSilentRefresh({
    events: NOTEBOOK_EVENTS,
    storageKeys: NOTEBOOK_STORAGE_KEYS,
    onRefresh: refresh,
    coalesceMs: 0,
  });

  // A day's page is created when it is first opened; the update event that
  // ensureDailyPage emits brings it into state.
  useEffect(() => {
    if (isDaily && !getDailyPage(date)) ensureDailyPage(date);
  }, [date, isDaily]);

  if (state.key !== key) {
    const next = { key, page: read() };
    setState(next);
    return next.page;
  }
  return state.page;
}

export default useNotebookPage;

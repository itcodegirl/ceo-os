import { useCallback, useState } from 'react';
import { NOTEBOOK_ITEM_KINDS } from '../lib/notebook/items/itemModels';
import {
  listNotebookItems,
  NOTEBOOK_ITEMS_STORAGE_KEYS,
  NOTEBOOK_ITEMS_UPDATED_EVENT,
} from '../lib/notebook/items/notebookItemsRepository';
import { useSilentRefresh } from './useSilentRefresh';

const ITEM_EVENTS = [NOTEBOOK_ITEMS_UPDATED_EVENT];
const ITEM_STORAGE_KEYS = Object.values(NOTEBOOK_ITEMS_STORAGE_KEYS);

function readAll() {
  return Object.fromEntries(NOTEBOOK_ITEM_KINDS.map((kind) => [kind, listNotebookItems(kind)]));
}

/** Every card, question, and idea (newest first), refreshed on saves, syncs, and other tabs. */
export function useNotebookItems() {
  const [items, setItems] = useState(readAll);
  const refresh = useCallback(() => setItems(readAll()), []);

  useSilentRefresh({
    events: ITEM_EVENTS,
    storageKeys: ITEM_STORAGE_KEYS,
    onRefresh: refresh,
    coalesceMs: 0,
  });

  return items;
}

export default useNotebookItems;

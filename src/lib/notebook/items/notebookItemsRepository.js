// notebookItemsRepository — cards, questions, and ideas made from notebook
// writing. Local-first with account sync, like notebook pages
// (notebookPagesRepository.js explains why the local store is the working copy).
//
// Differences from pages, and why:
// - Items are saved by an explicit "Save" in a composer, not by autosave, so a
//   conflict is rare. When the same item was changed on another device and
//   here, both versions are kept (the other device's under the original id,
//   this device's as a copy) instead of asking the learner to choose.
// - An item points at the page it came from. It is only uploaded after that
//   page exists in the account (the foreign key needs it); deleting a page
//   keeps its items (the database sets page_id to null).

import { buildCreateId } from '../../utils';
import { STORAGE_DOMAINS } from '../../dataSchema';
import { readVersionedLocalStorage, writeVersionedLocalStorage } from '../../versionedStorage';
import { getSyncSession } from '../../syncSession';
import { tryRemoteOrEnqueue } from '../../offlineWriteQueueIntegration';
import { applyExpectedUpdatedAtFilter } from '../../staleRecordError';
import { relinkReminderSource } from '../../remindersRepository';
import { getNotebookPage, onNotebookPageIdChanged } from '../notebookPagesRepository';
import {
  createNotebookItem,
  itemContent,
  NOTEBOOK_ITEM_KINDS,
  normalizeItem,
  reviseNotebookItem,
} from './itemModels';

export const NOTEBOOK_ITEMS_UPDATED_EVENT = 'ceo-os:notebook-items-updated';
export const NOTEBOOK_ITEM_QUEUE_KIND_PUSH = 'notebook-item:push';
export const NOTEBOOK_ITEM_QUEUE_KIND_DELETE = 'notebook-item:delete';

const MAX_TOMBSTONES = 200;
const COMMON_COLUMNS = 'id, user_id, page_id, source_text, source_block, created_at, updated_at';

const KIND_CONFIG = Object.freeze({
  card: Object.freeze({
    domain: STORAGE_DOMAINS.notebookCards,
    table: 'notebook_cards',
    columns: `${COMMON_COLUMNS}, prompt, answer, ease, interval_days, repetition_count, next_review_at, last_grade, graded_at`,
  }),
  question: Object.freeze({
    domain: STORAGE_DOMAINS.notebookQuestions,
    table: 'notebook_questions',
    columns: `${COMMON_COLUMNS}, text, answer, status`,
  }),
  idea: Object.freeze({
    domain: STORAGE_DOMAINS.notebookIdeas,
    table: 'notebook_ideas',
    columns: `${COMMON_COLUMNS}, title, description, category`,
  }),
});

export const NOTEBOOK_ITEMS_STORAGE_KEYS = Object.freeze({
  card: 'ceo-os-notebook-cards',
  question: 'ceo-os-notebook-questions',
  idea: 'ceo-os-notebook-ideas',
});

function configFor(kind) {
  const config = KIND_CONFIG[kind];
  if (!config) throw new Error(`Unknown notebook item kind: ${kind}`);
  return config;
}

function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

// ── Local store ──────────────────────────────────────────────────────────────

function normalizeStore(kind, value) {
  const store = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    items: Array.isArray(store.items) ? store.items.map((item) => normalizeItem(kind, item)).filter(Boolean) : [],
    deletedIds: Array.isArray(store.deletedIds) ? store.deletedIds.filter((id) => typeof id === 'string') : [],
  };
}

function readStore(kind) {
  if (typeof window === 'undefined') return normalizeStore(kind, null);
  return normalizeStore(kind, readVersionedLocalStorage(configFor(kind).domain, null));
}

function writeStore(kind, store) {
  writeVersionedLocalStorage(configFor(kind).domain, store, 'Failed to save on this device.');
}

function emitUpdated(kind, detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTEBOOK_ITEMS_UPDATED_EVENT, { detail: { kind, ...detail } }));
}

function replaceItem(store, item) {
  return { ...store, items: store.items.map((existing) => (existing.id === item.id ? item : existing)) };
}

// ── Reads ────────────────────────────────────────────────────────────────────

/** Every item of one kind, newest first. */
export function listNotebookItems(kind) {
  return [...readStore(kind).items].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listPageItems(kind, pageId) {
  if (!pageId) return [];
  return listNotebookItems(kind).filter((item) => item.pageId === pageId);
}

export function getNotebookItem(kind, id) {
  return readStore(kind).items.find((item) => item.id === id) || null;
}

// ── Writes ───────────────────────────────────────────────────────────────────

/** Saves a new item from a composer draft. `source` is { text, blockKey } when made from a selection. */
export function createItem(kind, { draft, pageId = '', source } = {}) {
  configFor(kind);
  const item = createNotebookItem(kind, { draft, pageId, source });
  const store = readStore(kind);
  writeStore(kind, { ...store, items: [...store.items, item] });
  emitUpdated(kind, { type: 'create', id: item.id, source: 'local' });
  void syncNotebookItem(kind, item.id).catch(() => {});
  return item;
}

export function updateItem(kind, id, draft) {
  const store = readStore(kind);
  const current = store.items.find((item) => item.id === id);
  if (!current) throw new Error('This item no longer exists.');
  const next = {
    ...reviseNotebookItem(kind, current, draft),
    updatedAt: Math.max(Date.now(), current.updatedAt + 1),
    sync: { ...current.sync, pending: true },
  };
  writeStore(kind, replaceItem(store, next));
  emitUpdated(kind, { type: 'save', id, source: 'local' });
  void syncNotebookItem(kind, id).catch(() => {});
  return next;
}

export function deleteItem(kind, id) {
  const store = readStore(kind);
  const item = store.items.find((existing) => existing.id === id);
  if (!item) return;
  const wasSynced = item.sync.remoteUpdatedAt > 0;
  writeStore(kind, {
    items: store.items.filter((existing) => existing.id !== id),
    deletedIds: wasSynced ? [...store.deletedIds, id].slice(-MAX_TOMBSTONES) : store.deletedIds,
  });
  emitUpdated(kind, { type: 'delete', id, source: 'local' });
  if (wasSynced) void pushDeletion(kind, id).catch(() => {});
}

// When a Personal page is merged into the same day's page from another
// device, its id changes; items and to-dos made from it follow it.
onNotebookPageIdChanged(relinkReminderSource);
onNotebookPageIdChanged((previousId, nextId) => {
  for (const kind of NOTEBOOK_ITEM_KINDS) {
    const store = readStore(kind);
    if (!store.items.some((item) => item.pageId === previousId)) continue;
    writeStore(kind, {
      ...store,
      items: store.items.map((item) => (item.pageId === previousId
        ? { ...item, pageId: nextId, updatedAt: Math.max(Date.now(), item.updatedAt + 1), sync: { ...item.sync, pending: true } }
        : item)),
    });
    emitUpdated(kind, { type: 'relink', source: 'local' });
  }
});

// ── Account sync ─────────────────────────────────────────────────────────────

function toRow(kind, item, userId, pageId) {
  const row = {
    user_id: userId,
    page_id: pageId,
    source_text: item.sourceText || null,
    source_block: item.sourceBlock || null,
  };
  if (kind === 'card') {
    return {
      ...row,
      prompt: item.prompt,
      answer: item.answer,
      ease: item.schedule.ease,
      interval_days: item.schedule.intervalDays,
      repetition_count: item.schedule.repetitionCount,
      next_review_at: item.schedule.nextReviewAt,
      last_grade: item.schedule.lastGrade ?? null,
      graded_at: item.schedule.gradedAt ?? null,
    };
  }
  if (kind === 'question') {
    return { ...row, text: item.text, answer: item.answer || null, status: item.status };
  }
  return { ...row, title: item.title, description: item.description || null, category: item.category || null };
}

function rowToFields(kind, row) {
  const fields = {
    pageId: row.page_id ?? '',
    sourceText: row.source_text ?? '',
    sourceBlock: row.source_block ?? '',
    ...itemContent(kind, {
      prompt: row.prompt ?? '',
      answer: row.answer ?? '',
      text: row.text ?? '',
      status: row.status,
      title: row.title ?? '',
      description: row.description ?? '',
      category: row.category ?? '',
    }),
  };
  if (kind === 'card') {
    fields.schedule = {
      ease: Number(row.ease),
      intervalDays: Number(row.interval_days),
      repetitionCount: Number(row.repetition_count),
      nextReviewAt: row.next_review_at ? new Date(row.next_review_at).toISOString() : '',
      lastGrade: row.last_grade ?? undefined,
      gradedAt: row.graded_at ? new Date(row.graded_at).toISOString() : undefined,
    };
  }
  return fields;
}

function sameContent(kind, item, row) {
  const local = itemContent(kind, item);
  const remote = itemContent(kind, rowToFields(kind, row));
  return Object.keys(local).every((key) => local[key] === remote[key]);
}

function fromRow(kind, row, userId, existing) {
  return normalizeItem(kind, {
    ...(existing || {}),
    id: row.id,
    ...rowToFields(kind, row),
    createdAt: existing?.createdAt || new Date(row.created_at).toISOString(),
    updatedAt: toMs(row.updated_at),
    sync: { ownerId: userId, remoteUpdatedAt: toMs(row.updated_at), pending: false },
  });
}

function isOwnedBy(item, userId) {
  return !item.sync.ownerId || item.sync.ownerId === userId;
}

/**
 * The page id to store remotely: the page's id once it is in the account,
 * null when the page is gone, or undefined while the page is still waiting to
 * be uploaded (the item waits too, so the foreign key holds).
 */
function resolveRemotePageId(item, userId) {
  if (!item.pageId) return null;
  const page = getNotebookPage(item.pageId);
  if (!page || (page.sync.ownerId && page.sync.ownerId !== userId)) return null;
  return page.sync.remoteUpdatedAt > 0 ? page.id : undefined;
}

function markSynced(kind, id, row, userId, pushedUpdatedAt) {
  const store = readStore(kind);
  const item = store.items.find((existing) => existing.id === id);
  if (!item) return null;
  // Edits saved while the push was in flight stay pending for the next push.
  const stillPending = item.updatedAt !== pushedUpdatedAt;
  const next = { ...item, sync: { ownerId: userId, remoteUpdatedAt: toMs(row.updated_at), pending: stillPending } };
  writeStore(kind, replaceItem(store, next));
  emitUpdated(kind, { type: 'sync', id, source: 'supabase' });
  return next;
}

/**
 * The item changed both here and on another device: the other device's
 * version keeps the id, and this device's version becomes a new item.
 */
function keepBoth(kind, store, local, row, userId) {
  const copy = { ...local, id: buildCreateId(), updatedAt: Date.now(), sync: { ownerId: '', remoteUpdatedAt: 0, pending: true } };
  return {
    store: {
      ...store,
      items: [...store.items.map((item) => (item.id === local.id ? fromRow(kind, row, userId, item) : item)), copy],
    },
    copyId: copy.id,
  };
}

async function pushItem(kind, id, session, { skipQueue = false } = {}) {
  const item = getNotebookItem(kind, id);
  if (!item || !item.sync.pending || !isOwnedBy(item, session.userId)) return item;
  const pageId = resolveRemotePageId(item, session.userId);
  if (pageId === undefined) return item;
  const { client, userId } = session;
  const { table, columns } = configFor(kind);
  const pushedUpdatedAt = item.updatedAt;

  const reconcileWithRemote = async () => {
    const { data: remote, error } = await client.from(table).select(columns).eq('id', id).eq('user_id', userId).maybeSingle();
    if (error) throw error;
    if (!remote) {
      // Deleted on another device while edited here: upload it again.
      const store = readStore(kind);
      const current = store.items.find((existing) => existing.id === id);
      if (current) writeStore(kind, replaceItem(store, { ...current, sync: { ...current.sync, remoteUpdatedAt: 0 } }));
      return pushItem(kind, id, session, { skipQueue });
    }
    if (sameContent(kind, item, remote)) return markSynced(kind, id, remote, userId, pushedUpdatedAt);
    const store = readStore(kind);
    const current = store.items.find((existing) => existing.id === id);
    if (!current) return null;
    const { store: next, copyId } = keepBoth(kind, store, current, remote, userId);
    writeStore(kind, next);
    emitUpdated(kind, { type: 'conflict', id, source: 'supabase' });
    void schedulePush(kind, copyId, session, { skipQueue }).catch(() => {});
    return getNotebookItem(kind, id);
  };

  return tryRemoteOrEnqueue({ kind: NOTEBOOK_ITEM_QUEUE_KIND_PUSH, payload: { kind, id }, options: { skipQueue } }, async () => {
    if (item.sync.remoteUpdatedAt > 0) {
      const query = client.from(table).update(toRow(kind, item, userId, pageId)).eq('id', id).eq('user_id', userId);
      const { data, error } = await applyExpectedUpdatedAtFilter(query, item.sync.remoteUpdatedAt).select(columns).maybeSingle();
      if (error) throw error;
      if (data) return markSynced(kind, id, data, userId, pushedUpdatedAt);
      return reconcileWithRemote();
    }

    let { data, error } = await client.from(table).insert({ id, ...toRow(kind, item, userId, pageId) }).select(columns).single();
    if (error?.code === '23503' && pageId) {
      // The page was deleted remotely a moment ago; the link goes with it.
      ({ data, error } = await client.from(table).insert({ id, ...toRow(kind, item, userId, null) }).select(columns).single());
    }
    if (!error) return markSynced(kind, id, data, userId, pushedUpdatedAt);
    // Already inserted by an earlier attempt whose response was lost.
    if (error.code === '23505') return reconcileWithRemote();
    throw error;
  });
}

// At most one push per item in flight (see schedulePush in the pages repository).
const pushesInFlight = new Map();

function schedulePush(kind, id, session, options = {}) {
  const key = `${kind}:${id}`;
  const running = pushesInFlight.get(key);
  if (running) {
    running.again = true;
    return running.promise;
  }
  const entry = { again: false, promise: null };
  entry.promise = (async () => {
    try {
      let result;
      do {
        entry.again = false;
        result = await pushItem(kind, id, session, options);
      } while (entry.again);
      return result;
    } finally {
      pushesInFlight.delete(key);
    }
  })();
  pushesInFlight.set(key, entry);
  return entry.promise;
}

async function pushDeletion(kind, id, { skipQueue = false } = {}) {
  const session = await getSyncSession();
  if (!session) return;
  const { table } = configFor(kind);
  await tryRemoteOrEnqueue({ kind: NOTEBOOK_ITEM_QUEUE_KIND_DELETE, payload: { kind, id }, options: { skipQueue } }, async () => {
    const { error } = await session.client.from(table).delete().eq('id', id).eq('user_id', session.userId);
    if (error) throw error;
  });
  const store = readStore(kind);
  writeStore(kind, { ...store, deletedIds: store.deletedIds.filter((deletedId) => deletedId !== id) });
}

/** Pushes one item if it has unsynced changes. Safe to call when signed out. */
export async function syncNotebookItem(kind, id, options = {}) {
  configFor(kind);
  const session = await getSyncSession();
  if (!session) return getNotebookItem(kind, id);
  return schedulePush(kind, id, session, options);
}

export async function replayNotebookItemDeletion({ kind, id } = {}) {
  if (KIND_CONFIG[kind] && typeof id === 'string' && id) await pushDeletion(kind, id, { skipQueue: true });
}

async function syncKind(kind, session) {
  const { client, userId } = session;
  const { table, columns } = configFor(kind);
  await Promise.allSettled([...pushesInFlight.entries()]
    .filter(([key]) => key.startsWith(`${kind}:`))
    .map(([, entry]) => entry.promise));

  for (const id of readStore(kind).deletedIds) {
    await pushDeletion(kind, id);
  }

  const { data: rows, error } = await client.from(table).select(columns).eq('user_id', userId);
  if (error) throw error;

  let store = readStore(kind);
  const tombstones = new Set(store.deletedIds);
  const remoteIds = new Set();
  let changed = false;

  for (const row of rows || []) {
    if (tombstones.has(row.id)) continue;
    remoteIds.add(row.id);
    const local = store.items.find((item) => item.id === row.id);
    if (!local) {
      store = { ...store, items: [...store.items, fromRow(kind, row, userId)] };
      changed = true;
      continue;
    }
    if (!isOwnedBy(local, userId) || toMs(row.updated_at) === local.sync.remoteUpdatedAt) continue;
    changed = true;
    if (!local.sync.pending) {
      store = replaceItem(store, fromRow(kind, row, userId, local));
    } else if (sameContent(kind, local, row)) {
      // Same writing; only bookkeeping (such as a re-linked page) differs, and
      // the next push brings it across under the fresh guard.
      store = replaceItem(store, { ...local, sync: { ...local.sync, ownerId: userId, remoteUpdatedAt: toMs(row.updated_at) } });
    } else {
      store = keepBoth(kind, store, local, row, userId).store;
    }
  }

  // Items this account synced before that are gone remotely were deleted on
  // another device: drop them, unless they hold unsynced changes here.
  const items = store.items.flatMap((item) => {
    const deletedElsewhere = item.sync.ownerId === userId && item.sync.remoteUpdatedAt > 0 && !remoteIds.has(item.id);
    if (!deletedElsewhere) return [item];
    changed = true;
    return item.sync.pending ? [{ ...item, sync: { ...item.sync, remoteUpdatedAt: 0 } }] : [];
  });

  if (changed) {
    writeStore(kind, { ...store, items });
    emitUpdated(kind, { type: 'pull', source: 'supabase' });
  }

  for (const item of readStore(kind).items) {
    if (item.sync.pending && isOwnedBy(item, userId)) await schedulePush(kind, item.id, session);
  }
}

/**
 * Pulls and pushes every kind of item for the signed-in account. Run it after
 * syncing pages, so the pages items point at already exist remotely. Returns
 * 'local' when sync is unavailable.
 */
export async function syncNotebookItems() {
  const session = await getSyncSession();
  if (!session) return 'local';
  const results = await Promise.allSettled(NOTEBOOK_ITEM_KINDS.map((kind) => syncKind(kind, session)));
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) throw failure.reason;
  return 'synced';
}

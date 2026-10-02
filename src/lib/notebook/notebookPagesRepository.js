// notebookPagesRepository — Notebook pages, local-first with account sync.
//
// Why this differs from the opportunities/content repositories (which pick ONE
// source per call): notebook pages autosave every pause in typing and are read
// synchronously by Focus Home and System Pulse. So the local store is always
// the working copy — reads and saves are instant and work offline — and, when
// the user is signed in to Supabase, `syncNotebookPages()` pushes pending
// changes and pulls remote ones underneath it.
//
// Conflicts: every page remembers the server `updated_at` it last saw
// (`sync.remoteUpdatedAt`). Pushes are guarded with the shared
// applyExpectedUpdatedAtFilter; a page edited on another device and here
// becomes a conflict the learner resolves ("keep mine" / "use the other
// version"), never a silent overwrite.

import { buildCreateId } from '../utils';
import { STORAGE_DOMAINS } from '../dataSchema';
import { readVersionedLocalStorage, writeVersionedLocalStorage } from '../versionedStorage';
import { getSupabaseRuntime } from '../supabaseRuntime';
import { tryRemoteOrEnqueue } from '../offlineWriteQueueIntegration';
import { applyExpectedUpdatedAtFilter, assertRecordIsFresh } from '../staleRecordError';
import { getTodayJournalDateKey, listJournalEntries } from '../journalRepository';
import { getNotebookSection, isNotebookSectionId, NOTEBOOK_SECTION_IDS } from './notebookSections';
import { getPlainText, hasWriting, textToDoc } from './notebookText';

export const NOTEBOOK_PAGES_UPDATED_EVENT = 'ceo-os:notebook-pages-updated';
export const NOTEBOOK_PAGES_STORAGE_KEY = 'ceo-os-notebook-pages';
export const NOTEBOOK_PAGE_QUEUE_KIND_PUSH = 'notebook-page:push';
export const NOTEBOOK_PAGE_QUEUE_KIND_DELETE = 'notebook-page:delete';

const TABLE = 'notebook_pages';
const SELECT_COLUMNS = 'id, user_id, section, title, page_date, source_url, blocks, created_at, updated_at';
const MAX_TITLE_LENGTH = 160;
const MAX_TOMBSTONES = 200;
const PERSONAL = NOTEBOOK_SECTION_IDS.personal;

// ── Normalization ────────────────────────────────────────────────────────────

function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeBlocks(blocks) {
  if (!blocks || typeof blocks !== 'object' || Array.isArray(blocks)) return {};
  return Object.fromEntries(
    Object.entries(blocks).filter(([, doc]) => doc && typeof doc === 'object' && doc.type === 'doc'),
  );
}

function normalizeSync(sync) {
  const value = sync && typeof sync === 'object' ? sync : {};
  return {
    ownerId: typeof value.ownerId === 'string' ? value.ownerId : '',
    remoteUpdatedAt: toMs(value.remoteUpdatedAt),
    pending: value.pending !== false,
    conflict: value.conflict && typeof value.conflict === 'object' ? value.conflict : null,
    revision: Number.isInteger(value.revision) ? value.revision : 0,
  };
}

function normalizePage(page) {
  if (!page || typeof page !== 'object' || typeof page.id !== 'string' || !page.id) return null;
  const section = isNotebookSectionId(page.section) ? page.section : PERSONAL;
  return {
    id: page.id,
    section,
    title: typeof page.title === 'string' ? page.title.slice(0, MAX_TITLE_LENGTH) : '',
    pageDate: section === PERSONAL && typeof page.pageDate === 'string' ? page.pageDate : '',
    sourceUrl: typeof page.sourceUrl === 'string' ? page.sourceUrl : '',
    blocks: normalizeBlocks(page.blocks),
    createdAt: typeof page.createdAt === 'string' ? page.createdAt : new Date().toISOString(),
    updatedAt: toMs(page.updatedAt) || Date.now(),
    sync: normalizeSync(page.sync),
  };
}

function normalizeStore(value) {
  const store = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const pages = Array.isArray(store.pages) ? store.pages.map(normalizePage).filter(Boolean) : [];
  const deletedPageIds = Array.isArray(store.deletedPageIds)
    ? store.deletedPageIds.filter((id) => typeof id === 'string')
    : [];
  return { pages, deletedPageIds, journalImported: store.journalImported === true };
}

// ── Local store ──────────────────────────────────────────────────────────────

function readRawStore() {
  if (typeof window === 'undefined') return normalizeStore(null);
  return normalizeStore(readVersionedLocalStorage(STORAGE_DOMAINS.notebookPages, null));
}

// Every read first runs the one-time Journal import, so Focus Home sees the
// learner's existing entries even before the Notebook page is ever opened.
function readStore() {
  return migrateLegacyJournal(readRawStore()).store;
}

function writeStore(store) {
  writeVersionedLocalStorage(STORAGE_DOMAINS.notebookPages, store, 'Failed to save your notebook page on this device.');
}

function emitUpdated(detail = {}) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(NOTEBOOK_PAGES_UPDATED_EVENT, { detail }));
}

function updatePageInStore(store, page) {
  return { ...store, pages: store.pages.map((existing) => (existing.id === page.id ? page : existing)) };
}

// ── Reads ────────────────────────────────────────────────────────────────────

export function listNotebookPages() {
  return readStore().pages;
}

export function listSectionPages(sectionId) {
  const section = getNotebookSection(sectionId);
  const pages = readStore().pages.filter((page) => page.section === section.id);
  return section.pageMode === 'daily'
    ? pages.sort((a, b) => b.pageDate.localeCompare(a.pageDate))
    : pages.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getNotebookPage(pageId) {
  return readStore().pages.find((page) => page.id === pageId) || null;
}

export function getDailyPage(dateKey) {
  return readStore().pages.find((page) => page.section === PERSONAL && page.pageDate === dateKey) || null;
}

/**
 * Focus Home / System Pulse adapter: today's Personal page as the plain-text
 * shape the old Journal entry had, so focusHomeLogic and suggestions keep
 * working unchanged. Never imports the editor.
 */
export function getDailySignalEntry(dateKey = getTodayJournalDateKey()) {
  const page = getDailyPage(dateKey);
  const blocks = page?.blocks || {};
  return {
    onMyMind: getPlainText(blocks.onMyMind),
    feelsHeavy: getPlainText(blocks.feelsHeavy),
    oneNextThing: getPlainText(blocks.oneNextThing),
    todaySuccess: getPlainText(blocks.todaySuccess),
    updatedAt: page ? new Date(page.updatedAt).toISOString() : '',
  };
}

// ── Writes ───────────────────────────────────────────────────────────────────

function buildPage({ section, title, pageDate = '', sourceUrl = '', blocks = {}, id = buildCreateId() }) {
  const now = Date.now();
  return normalizePage({
    id,
    section,
    title,
    pageDate,
    sourceUrl,
    blocks,
    createdAt: new Date(now).toISOString(),
    updatedAt: now,
    sync: { pending: true },
  });
}

function formatDailyTitle(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(date.getTime())) return dateKey;
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

/** Returns the Personal page for a date, creating it (empty) when missing. */
export function ensureDailyPage(dateKey = getTodayJournalDateKey()) {
  const existing = getDailyPage(dateKey);
  if (existing) return existing;
  const store = readStore();
  const page = buildPage({ section: PERSONAL, title: formatDailyTitle(dateKey), pageDate: dateKey });
  writeStore({ ...store, pages: [...store.pages, page] });
  emitUpdated({ type: 'create', id: page.id, source: 'local' });
  return page;
}

export function createNotebookPage({ section, title, sourceUrl = '' }) {
  const sectionConfig = getNotebookSection(section);
  if (sectionConfig.pageMode === 'daily') {
    throw new Error('Personal pages are created one per day.');
  }
  const trimmedTitle = String(title || '').trim();
  if (!trimmedTitle) {
    throw new Error('Give the page a title.');
  }
  const store = readStore();
  const page = buildPage({ section: sectionConfig.id, title: trimmedTitle, sourceUrl: String(sourceUrl || '').trim() });
  writeStore({ ...store, pages: [...store.pages, page] });
  emitUpdated({ type: 'create', id: page.id, source: 'local' });
  void syncNotebookPage(page.id).catch(() => {});
  return page;
}

/**
 * Saves edits made in this browser. `expectedUpdatedAt` guards against a
 * second tab having saved the same page in the meantime (StaleRecordError).
 */
export function saveNotebookPage(pageId, changes = {}, { expectedUpdatedAt } = {}) {
  const store = readStore();
  const current = store.pages.find((page) => page.id === pageId);
  if (!current) {
    throw new Error('This page no longer exists.');
  }
  assertRecordIsFresh(current, expectedUpdatedAt, 'This page changed in another tab. Reload to see the latest version.');

  const next = normalizePage({
    ...current,
    ...(changes.blocks ? { blocks: { ...current.blocks, ...changes.blocks } } : {}),
    ...(typeof changes.title === 'string' && changes.title.trim() ? { title: changes.title.trim() } : {}),
    ...(typeof changes.sourceUrl === 'string' ? { sourceUrl: changes.sourceUrl.trim() } : {}),
    updatedAt: Math.max(Date.now(), current.updatedAt + 1),
    sync: { ...current.sync, pending: true },
  });
  writeStore(updatePageInStore(store, next));
  emitUpdated({ type: 'save', id: next.id, source: 'local' });
  void syncNotebookPage(next.id).catch(() => {});
  return next;
}

export function deleteNotebookPage(pageId) {
  const store = readStore();
  const page = store.pages.find((existing) => existing.id === pageId);
  if (!page) return;
  const wasSynced = page.sync.remoteUpdatedAt > 0;
  writeStore({
    ...store,
    pages: store.pages.filter((existing) => existing.id !== pageId),
    deletedPageIds: wasSynced ? [...store.deletedPageIds, pageId].slice(-MAX_TOMBSTONES) : store.deletedPageIds,
  });
  emitUpdated({ type: 'delete', id: pageId, source: 'local' });
  if (wasSynced) void pushDeletion(pageId).catch(() => {});
}

// ── Legacy Journal import ────────────────────────────────────────────────────

/**
 * One-time copy of the old Journal (one entry per date) into Personal pages.
 * The original `ceo-os-journal-entries` key is left untouched as a backup.
 * Runs inside reads, so it never emits an update event (a listener could be
 * mid-render).
 */
function migrateLegacyJournal(store) {
  if (store.journalImported) return { store, importedCount: 0 };

  const existingDates = new Set(store.pages.filter((page) => page.section === PERSONAL).map((page) => page.pageDate));
  const imported = [];
  for (const entry of listJournalEntries()) {
    if (!entry?.dateKey || existingDates.has(entry.dateKey)) continue;
    const blocks = {};
    for (const block of getNotebookSection(PERSONAL).blocks) {
      if (typeof entry[block.key] === 'string' && entry[block.key].trim()) {
        blocks[block.key] = textToDoc(entry[block.key]);
      }
    }
    if (Object.keys(blocks).length === 0) continue;
    const page = buildPage({ section: PERSONAL, title: formatDailyTitle(entry.dateKey), pageDate: entry.dateKey, blocks });
    const savedAt = toMs(entry.updatedAt);
    imported.push(savedAt ? { ...page, updatedAt: savedAt } : page);
  }

  const next = { ...store, pages: [...store.pages, ...imported], journalImported: true };
  try {
    writeStore(next);
  } catch {
    // Still show the imported pages; the import retries on the next read.
    return { store: { ...next, journalImported: false }, importedCount: imported.length };
  }
  return { store: next, importedCount: imported.length };
}

/** Runs the one-time Journal import now. Returns how many days were copied. */
export function importLegacyJournalEntries() {
  return migrateLegacyJournal(readRawStore()).importedCount;
}

// ── Account sync ─────────────────────────────────────────────────────────────

function toRow(page, userId) {
  return {
    user_id: userId,
    section: page.section,
    title: page.title,
    page_date: page.pageDate || null,
    source_url: page.sourceUrl || null,
    blocks: page.blocks,
  };
}

function rowToContent(row) {
  return {
    section: isNotebookSectionId(row.section) ? row.section : PERSONAL,
    title: typeof row.title === 'string' ? row.title : '',
    pageDate: typeof row.page_date === 'string' ? row.page_date : '',
    sourceUrl: typeof row.source_url === 'string' ? row.source_url : '',
    blocks: normalizeBlocks(row.blocks),
  };
}

// Postgres jsonb does not preserve object key order, so documents read back
// from Supabase must be compared by content, not by their JSON text.
function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (!value || typeof value !== 'object') return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
}

function sameContent(page, row) {
  const remote = rowToContent(row);
  return page.title === remote.title
    && page.sourceUrl === remote.sourceUrl
    && canonicalJson(page.blocks) === canonicalJson(remote.blocks);
}

/** Resolves the signed-in Supabase session, or null when sync is unavailable. */
async function getSyncSession() {
  const runtime = await getSupabaseRuntime();
  if (!runtime) return null;
  const client = await runtime.getSupabaseClient();
  if (!client) return null;
  try {
    const userId = await runtime.requireSupabaseUserId();
    return userId ? { client, userId } : null;
  } catch (error) {
    if (error?.code === 'SUPABASE_AUTH_REQUIRED') return null;
    throw error;
  }
}

function isOwnedBy(page, userId) {
  return !page.sync.ownerId || page.sync.ownerId === userId;
}

function markSynced(pageId, row, userId, pushedUpdatedAt) {
  const store = readStore();
  const page = store.pages.find((existing) => existing.id === pageId);
  if (!page) return null;
  // Edits typed while the push was in flight stay pending for the next push.
  const stillPending = pushedUpdatedAt !== undefined && page.updatedAt !== pushedUpdatedAt;
  const next = {
    ...page,
    sync: { ...page.sync, ownerId: userId, remoteUpdatedAt: toMs(row.updated_at), pending: stillPending, conflict: null },
  };
  writeStore(updatePageInStore(store, next));
  emitUpdated({ type: 'sync', id: pageId, source: 'supabase' });
  return next;
}

function markConflict(pageId, row) {
  const store = readStore();
  const page = store.pages.find((existing) => existing.id === pageId);
  if (!page) return;
  const next = {
    ...page,
    ...(row?.id && row.id !== page.id ? { id: row.id } : {}),
    sync: {
      ...page.sync,
      pending: true,
      conflict: row
        ? { ...rowToContent(row), remoteId: row.id, remoteUpdatedAt: toMs(row.updated_at) }
        : { deletedElsewhere: true },
    },
  };
  writeStore({ ...store, pages: store.pages.map((existing) => (existing.id === pageId ? next : existing)) });
  emitUpdated({ type: 'conflict', id: next.id, source: 'supabase' });
}

/** Replaces local content with the remote row (no unsynced local edits). */
function applyRemoteRow(store, row, userId) {
  const content = rowToContent(row);
  const existing = store.pages.find((page) => page.id === row.id);
  const page = normalizePage({
    ...(existing || {}),
    id: row.id,
    ...content,
    createdAt: existing?.createdAt || row.created_at,
    updatedAt: toMs(row.updated_at),
    sync: {
      ownerId: userId,
      remoteUpdatedAt: toMs(row.updated_at),
      pending: false,
      conflict: null,
      revision: (existing?.sync.revision || 0) + 1,
    },
  });
  return existing
    ? store.pages.map((candidate) => (candidate.id === row.id ? page : candidate))
    : [...store.pages, page];
}

async function pushPage(pageId, session, { skipQueue = false } = {}) {
  const page = getNotebookPage(pageId);
  if (!page || !page.sync.pending || page.sync.conflict || !isOwnedBy(page, session.userId)) return page;
  const { client, userId } = session;
  const pushedUpdatedAt = page.updatedAt;

  return tryRemoteOrEnqueue({ kind: NOTEBOOK_PAGE_QUEUE_KIND_PUSH, payload: { id: pageId }, options: { skipQueue } }, async () => {
    if (page.sync.remoteUpdatedAt > 0) {
      const query = client.from(TABLE).update(toRow(page, userId)).eq('id', page.id).eq('user_id', userId);
      const { data, error } = await applyExpectedUpdatedAtFilter(query, page.sync.remoteUpdatedAt)
        .select(SELECT_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      if (data) return markSynced(page.id, data, userId, pushedUpdatedAt);

      // The guard matched nothing: the row changed or vanished elsewhere.
      const { data: remote, error: readError } = await client
        .from(TABLE).select(SELECT_COLUMNS).eq('id', page.id).eq('user_id', userId).maybeSingle();
      if (readError) throw readError;
      if (remote && sameContent(page, remote)) return markSynced(page.id, remote, userId, pushedUpdatedAt);
      markConflict(page.id, remote);
      return getNotebookPage(remote?.id || page.id);
    }

    const { data, error } = await client
      .from(TABLE)
      .insert({ id: page.id, ...toRow(page, userId) })
      .select(SELECT_COLUMNS)
      .single();
    if (!error) return markSynced(page.id, data, userId, pushedUpdatedAt);
    if (error.code !== '23505' || page.section !== PERSONAL) throw error;

    // Another device already created this day's Personal page.
    const { data: remoteDaily, error: dailyError } = await client
      .from(TABLE).select(SELECT_COLUMNS)
      .eq('user_id', userId).eq('section', PERSONAL).eq('page_date', page.pageDate)
      .maybeSingle();
    if (dailyError) throw dailyError;
    if (!remoteDaily) throw error;
    return adoptRemoteDaily(page.id, remoteDaily, session, { skipQueue });
  });
}

// Autosave saves every pause in typing, and each save starts a push. Pushes
// for one page must not overlap: a second push would carry the
// pre-first-push timestamp, fail the guard, and report a false conflict. So
// each page has at most one push in flight; edits made meanwhile are pushed
// once it settles.
const pushesInFlight = new Map();

function schedulePush(pageId, session, options = {}) {
  const running = pushesInFlight.get(pageId);
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
        result = await pushPage(pageId, session, options);
      } while (entry.again);
      return result;
    } finally {
      pushesInFlight.delete(pageId);
    }
  })();
  pushesInFlight.set(pageId, entry);
  return entry.promise;
}

async function settlePushesInFlight() {
  await Promise.allSettled([...pushesInFlight.values()].map((entry) => entry.promise));
}

/** Merges a local daily page into the remote page for the same date. */
async function adoptRemoteDaily(localId, row, session, options) {
  const store = readStore();
  const local = store.pages.find((page) => page.id === localId);
  if (!local) return null;
  const localHasWriting = Object.values(local.blocks).some(hasWriting);
  const remoteHasWriting = Object.values(normalizeBlocks(row.blocks)).some(hasWriting);

  if (!localHasWriting || sameContent(local, row)) {
    const pages = applyRemoteRow({ ...store, pages: store.pages.filter((page) => page.id !== localId) }, row, session.userId);
    writeStore({ ...store, pages });
    emitUpdated({ type: 'sync', id: row.id, source: 'supabase' });
    return getNotebookPage(row.id);
  }
  if (!remoteHasWriting) {
    // Keep this device's writing under the shared remote id, then push it.
    const adopted = {
      ...local,
      id: row.id,
      sync: { ...local.sync, ownerId: session.userId, remoteUpdatedAt: toMs(row.updated_at), pending: true, conflict: null },
    };
    writeStore({ ...store, pages: store.pages.map((page) => (page.id === localId ? adopted : page)) });
    emitUpdated({ type: 'sync', id: row.id, source: 'supabase' });
    return pushPage(row.id, session, options);
  }
  markConflict(localId, row);
  return getNotebookPage(row.id);
}

async function pushDeletion(pageId, { skipQueue = false } = {}) {
  const session = await getSyncSession();
  if (!session) return;
  await tryRemoteOrEnqueue({ kind: NOTEBOOK_PAGE_QUEUE_KIND_DELETE, payload: { id: pageId }, options: { skipQueue } }, async () => {
    const { error } = await session.client.from(TABLE).delete().eq('id', pageId).eq('user_id', session.userId);
    if (error) throw error;
  });
  const store = readStore();
  writeStore({ ...store, deletedPageIds: store.deletedPageIds.filter((id) => id !== pageId) });
}

/** Pushes one page if it has unsynced edits. Safe to call when signed out. */
export async function syncNotebookPage(pageId, options = {}) {
  const session = await getSyncSession();
  if (!session) return getNotebookPage(pageId);
  return schedulePush(pageId, session, options);
}

export async function replayNotebookPageDeletion({ id } = {}) {
  if (typeof id === 'string' && id) await pushDeletion(id, { skipQueue: true });
}

// An open page's autosave registers here so a pull never replaces writing
// that is still waiting for its debounce: it is saved (and so marked pending)
// first, and a remote change then becomes a conflict instead of a loss.
const beforeSyncFlushers = new Set();

export function registerNotebookSyncFlush(flush) {
  beforeSyncFlushers.add(flush);
  return () => beforeSyncFlushers.delete(flush);
}

/**
 * Pulls the signed-in account's pages, merges them into this device, then
 * pushes local changes. Returns 'local' when sync is unavailable.
 */
export async function syncNotebookPages() {
  const session = await getSyncSession();
  if (!session) return 'local';
  const { client, userId } = session;
  beforeSyncFlushers.forEach((flush) => flush());
  await settlePushesInFlight();

  let store = readStore();
  for (const pageId of store.deletedPageIds) {
    await pushDeletion(pageId);
  }

  const { data: rows, error } = await client.from(TABLE).select(SELECT_COLUMNS).eq('user_id', userId);
  if (error) throw error;

  // Save anything typed during the fetch; the merge below is synchronous.
  beforeSyncFlushers.forEach((flush) => flush());
  store = readStore();
  const tombstones = new Set(store.deletedPageIds);
  const remoteIds = new Set();
  let pages = store.pages;
  let changed = false;
  const dailyToAdopt = [];

  for (const row of rows || []) {
    if (tombstones.has(row.id)) continue;
    remoteIds.add(row.id);
    const local = pages.find((page) => page.id === row.id);
    if (!local) {
      const localDaily = row.section === PERSONAL
        ? pages.find((page) => page.section === PERSONAL && page.pageDate === row.page_date && page.sync.remoteUpdatedAt === 0)
        : null;
      if (localDaily) {
        dailyToAdopt.push([localDaily.id, row]);
        continue;
      }
      pages = applyRemoteRow({ ...store, pages }, row, userId);
      changed = true;
      continue;
    }
    if (!isOwnedBy(local, userId) || toMs(row.updated_at) === local.sync.remoteUpdatedAt) continue;
    if (!local.sync.pending || sameContent(local, row)) {
      pages = applyRemoteRow({ ...store, pages }, row, userId);
      changed = true;
    } else if (!local.sync.conflict) {
      pages = pages.map((page) => (page.id === local.id
        ? { ...page, sync: { ...page.sync, conflict: { ...rowToContent(row), remoteId: row.id, remoteUpdatedAt: toMs(row.updated_at) } } }
        : page));
      changed = true;
    }
  }

  // Pages this account synced before that are gone remotely were deleted on
  // another device: drop them, unless they hold unsynced local edits, in which
  // case they are re-created remotely.
  pages = pages.flatMap((page) => {
    const deletedElsewhere = page.sync.ownerId === userId && page.sync.remoteUpdatedAt > 0 && !remoteIds.has(page.id);
    if (!deletedElsewhere) return [page];
    changed = true;
    return page.sync.pending ? [{ ...page, sync: { ...page.sync, remoteUpdatedAt: 0 } }] : [];
  });

  if (changed) {
    writeStore({ ...store, pages });
    emitUpdated({ type: 'pull', source: 'supabase' });
  }

  for (const [localId, row] of dailyToAdopt) {
    await adoptRemoteDaily(localId, row, session, {});
  }
  for (const page of readStore().pages) {
    if (page.sync.pending && !page.sync.conflict && isOwnedBy(page, userId)) {
      await schedulePush(page.id, session);
    }
  }
  return 'synced';
}

/**
 * Settles a sync conflict. 'mine' keeps this device's version and overwrites
 * the other copy; 'theirs' replaces this device's version with the other one.
 */
export async function resolveNotebookConflict(pageId, choice) {
  const store = readStore();
  const page = store.pages.find((existing) => existing.id === pageId);
  const conflict = page?.sync.conflict;
  if (!page || !conflict) return page || null;

  if (choice === 'theirs' && conflict.deletedElsewhere) {
    writeStore({ ...store, pages: store.pages.filter((existing) => existing.id !== pageId) });
    emitUpdated({ type: 'delete', id: pageId, source: 'supabase' });
    return null;
  }

  let next;
  if (choice === 'theirs') {
    next = {
      ...page,
      title: conflict.title || page.title,
      sourceUrl: conflict.sourceUrl,
      blocks: conflict.blocks,
      updatedAt: Math.max(Date.now(), page.updatedAt + 1),
      sync: { ...page.sync, remoteUpdatedAt: conflict.remoteUpdatedAt, pending: false, conflict: null, revision: page.sync.revision + 1 },
    };
  } else {
    // Content is unchanged, so the open editor's version guard stays valid.
    next = {
      ...page,
      sync: {
        ...page.sync,
        remoteUpdatedAt: conflict.deletedElsewhere ? 0 : conflict.remoteUpdatedAt,
        pending: true,
        conflict: null,
      },
    };
  }
  writeStore(updatePageInStore(store, next));
  emitUpdated({ type: 'resolve', id: pageId, source: 'local' });
  if (next.sync.pending) await syncNotebookPage(pageId);
  return getNotebookPage(pageId);
}

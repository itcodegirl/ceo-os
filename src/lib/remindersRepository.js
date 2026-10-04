// remindersRepository — reminders and notebook to-dos. Local-first with
// account sync, like notebook pages (notebookPagesRepository.js explains the
// design): the API stays synchronous because Focus Home, Capture promotions,
// and System Pulse read and write reminders in render and event handlers, and
// `syncReminders()` pushes and pulls the signed-in account's `reminders` rows
// underneath.
//
// Conflicts: reminders are one-line to-dos, so the latest change made on any
// device wins (a local change not yet synced is pushed over the remote row).
// Deletions are remembered locally until they reach the account, so a
// deleted reminder never comes back from a pull.

import { buildCreateId } from './utils';
import { STORAGE_DOMAINS } from './dataSchema';
import { readVersionedLocalStorage, writeVersionedLocalStorage } from './versionedStorage';
import { tryRemoteOrEnqueue } from './offlineWriteQueueIntegration';
import { applyExpectedUpdatedAtFilter } from './staleRecordError';
import { getSyncSession } from './syncSession';

export const REMINDERS_UPDATED_EVENT = 'ceo-os:reminders-updated';
export const REMINDER_DELETIONS_STORAGE_KEY = 'ceo-os-reminder-deletions';
export const REMINDER_QUEUE_KIND_PUSH = 'reminder:push';
export const REMINDER_QUEUE_KIND_DELETE = 'reminder:delete';
/** `sourceType` of a to-do made in the Notebook. */
export const REMINDER_SOURCE_NOTEBOOK_PAGE = 'notebook-page';

const TABLE = 'reminders';
const SELECT_COLUMNS = 'id, user_id, text, is_done, completed_at, snoozed_until, source_type, source_id, source_title, source_href, created_at, updated_at';
const MAX_TOMBSTONES = 200;
const MAX_SOURCE_TITLE_LENGTH = 160;

function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSync(sync) {
  const value = sync && typeof sync === 'object' ? sync : {};
  return {
    ownerId: typeof value.ownerId === 'string' ? value.ownerId : '',
    remoteUpdatedAt: toMs(value.remoteUpdatedAt),
    // Reminders saved before sync existed have no marker and upload once.
    pending: value.pending !== false,
  };
}

// Only in-app notebook links are kept, so a stored link can never point
// somewhere unexpected.
function normalizeSourceHref(value) {
  return typeof value === 'string' && value.startsWith('/notebook?') ? value : '';
}

function normalizeReminder(reminder) {
  const completedAt = typeof reminder?.completedAt === 'string'
    ? reminder.completedAt
    : '';

  // `snoozedUntil` is optional. When set, it carries an ISO timestamp the
  // reminder should re-surface at; the UI hides snoozed reminders whose
  // deadline is still in the future. Completed reminders never carry a
  // snooze marker — completion supersedes it.
  const snoozedUntil = !reminder?.isDone && typeof reminder?.snoozedUntil === 'string'
    ? reminder.snoozedUntil
    : '';

  const createdAt = typeof reminder?.createdAt === 'string'
    ? reminder.createdAt
    : new Date().toISOString();
  const sourceType = reminder?.sourceType === REMINDER_SOURCE_NOTEBOOK_PAGE ? reminder.sourceType : '';

  return {
    id: String(reminder?.id || buildCreateId()),
    text: typeof reminder?.text === 'string' ? reminder.text.trim() : '',
    isDone: Boolean(reminder?.isDone),
    completedAt: reminder?.isDone ? completedAt : '',
    createdAt,
    snoozedUntil,
    // Where a notebook to-do came from: the page id (for "this page"), its
    // title at the time, and a link back to it.
    sourceType,
    sourceId: sourceType && typeof reminder?.sourceId === 'string' ? reminder.sourceId : '',
    sourceTitle: sourceType && typeof reminder?.sourceTitle === 'string'
      ? reminder.sourceTitle.slice(0, MAX_SOURCE_TITLE_LENGTH)
      : '',
    sourceHref: sourceType ? normalizeSourceHref(reminder?.sourceHref) : '',
    updatedAt: toMs(reminder?.updatedAt) || toMs(createdAt) || Date.now(),
    sync: normalizeSync(reminder?.sync),
  };
}

/**
 * Returns an ISO timestamp for tomorrow at 6 AM local. Used as the default
 * snooze target so a single button reliably parks something off today's
 * surface without forcing a date picker decision.
 */
export function buildTomorrowSnoozeDeadline(now = new Date()) {
  const target = new Date(now.getTime());
  target.setDate(target.getDate() + 1);
  target.setHours(6, 0, 0, 0);
  return target.toISOString();
}

export function isReminderSnoozed(reminder, now = new Date()) {
  if (!reminder || !reminder.snoozedUntil || reminder.isDone) {
    return false;
  }
  const wakeAt = new Date(reminder.snoozedUntil).getTime();
  if (!Number.isFinite(wakeAt)) {
    return false;
  }
  return wakeAt > now.getTime();
}

function readStorage() {
  if (typeof window === 'undefined') {
    return [];
  }

  try {
    const parsed = readVersionedLocalStorage(STORAGE_DOMAINS.reminders, []);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((reminder) => normalizeReminder(reminder));
  } catch {
    return [];
  }
}

function writeStorage(reminders) {
  writeVersionedLocalStorage(
    STORAGE_DOMAINS.reminders,
    reminders,
    'Failed to persist reminders to localStorage',
  );
}

function readDeletedIds() {
  if (typeof window === 'undefined') return [];
  const value = readVersionedLocalStorage(STORAGE_DOMAINS.reminderDeletions, []);
  return Array.isArray(value) ? value.filter((id) => typeof id === 'string') : [];
}

function writeDeletedIds(ids) {
  writeVersionedLocalStorage(STORAGE_DOMAINS.reminderDeletions, ids.slice(-MAX_TOMBSTONES), 'Failed to save on this device.');
}

function emitReminderUpdated(detail = {}) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(REMINDERS_UPDATED_EVENT, { detail }));
}

export function listReminders() {
  return readStorage()
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}

/** To-dos made on one notebook page, newest first. */
export function listPageReminders(pageId) {
  if (!pageId) return [];
  return listReminders().filter((reminder) => (
    reminder.sourceType === REMINDER_SOURCE_NOTEBOOK_PAGE && reminder.sourceId === pageId
  ));
}

export function getReminderProgress(reminders = readStorage()) {
  const safeReminders = Array.isArray(reminders) ? reminders.map(normalizeReminder) : [];
  const total = safeReminders.length;
  const completed = safeReminders.filter((reminder) => reminder.isDone).length;
  const pending = Math.max(0, total - completed);

  return {
    total,
    completed,
    pending,
    completionRate: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}

/**
 * Creates a reminder. `payload.source` links a notebook to-do back to its
 * page: `{ type: 'notebook-page', id, title, href }`.
 */
export function createReminder(payload) {
  const text = typeof payload?.text === 'string' ? payload.text.trim() : '';
  if (!text) {
    throw new Error('Reminder text is required');
  }

  const source = payload?.source;
  const now = new Date();
  const reminder = normalizeReminder({
    id: buildCreateId(),
    text,
    isDone: false,
    createdAt: now.toISOString(),
    updatedAt: now.getTime(),
    sourceType: source?.type,
    sourceId: source?.id,
    sourceTitle: source?.title,
    sourceHref: source?.href,
    sync: { pending: true },
  });

  const current = readStorage();
  const next = [reminder, ...current];
  writeStorage(next);
  emitReminderUpdated({ type: 'create', id: reminder.id });
  void syncReminder(reminder.id).catch(() => {});
  return reminder;
}

/**
 * Applies `change` to one reminder, marks it for upload, and saves. `change`
 * returns the next reminder, or the same object for a no-op.
 */
function changeReminder(id, change, eventType, eventDetail = {}) {
  const normalizedId = String(id || '');
  if (!normalizedId) {
    throw new Error('Reminder id is required');
  }

  const current = readStorage();
  let updatedReminder = null;
  const next = current.map((reminder) => {
    if (reminder.id !== normalizedId) {
      return reminder;
    }
    const changed = change(reminder);
    updatedReminder = changed === reminder
      ? reminder
      : {
        ...changed,
        updatedAt: Math.max(Date.now(), reminder.updatedAt + 1),
        sync: { ...reminder.sync, pending: true },
      };
    return updatedReminder;
  });
  if (!updatedReminder) {
    throw new Error('Reminder not found');
  }

  writeStorage(next);
  emitReminderUpdated({ type: eventType, id: normalizedId, ...eventDetail });
  if (updatedReminder.sync.pending) void syncReminder(normalizedId).catch(() => {});
  return updatedReminder;
}

export function toggleReminder(id, isDone) {
  const nextState = Boolean(isDone);
  return changeReminder(id, (reminder) => ({
    ...reminder,
    isDone: nextState,
    completedAt: nextState ? new Date().toISOString() : '',
    snoozedUntil: nextState ? '' : reminder.snoozedUntil,
  }), 'toggle', { isDone: nextState });
}

export function updateReminderText(id, text) {
  if (!String(id || '')) {
    throw new Error('Reminder id is required');
  }
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed) {
    throw new Error('Reminder text is required');
  }
  return changeReminder(id, (reminder) => ({ ...reminder, text: trimmed }), 'update');
}

export function snoozeReminderUntil(id, untilIso) {
  if (!String(id || '')) {
    throw new Error('Reminder id is required');
  }

  const wakeAt = new Date(untilIso).getTime();
  if (!Number.isFinite(wakeAt)) {
    throw new Error('Snooze deadline must be a valid ISO timestamp');
  }
  if (wakeAt <= Date.now()) {
    throw new Error('Snooze deadline must be in the future');
  }

  // Completed reminders cannot be snoozed; the action is a no-op.
  return changeReminder(id, (reminder) => (
    reminder.isDone ? reminder : { ...reminder, snoozedUntil: new Date(wakeAt).toISOString() }
  ), 'snooze');
}

export function wakeReminder(id) {
  return changeReminder(id, (reminder) => ({ ...reminder, snoozedUntil: '' }), 'wake');
}

export function deleteReminder(id) {
  const normalizedId = String(id || '');
  if (!normalizedId) {
    throw new Error('Reminder id is required');
  }

  const current = readStorage();
  const reminder = current.find((candidate) => candidate.id === normalizedId);
  if (!reminder) {
    throw new Error('Reminder not found');
  }

  const next = current.filter((candidate) => candidate.id !== normalizedId);
  writeStorage(next);
  const wasSynced = reminder.sync.remoteUpdatedAt > 0;
  if (wasSynced) writeDeletedIds([...readDeletedIds(), normalizedId]);
  emitReminderUpdated({ type: 'delete', id: normalizedId });
  if (wasSynced) void pushDeletion(normalizedId).catch(() => {});
}

/**
 * Keeps notebook to-dos pointing at their page when the page's id changes
 * (a Personal page merged with the same day from another device).
 */
export function relinkReminderSource(previousId, nextId) {
  const current = readStorage();
  if (!current.some((reminder) => reminder.sourceId === previousId)) return;
  writeStorage(current.map((reminder) => (reminder.sourceId === previousId
    ? {
      ...reminder,
      sourceId: nextId,
      updatedAt: Math.max(Date.now(), reminder.updatedAt + 1),
      sync: { ...reminder.sync, pending: true },
    }
    : reminder)));
  emitReminderUpdated({ type: 'relink' });
}

// ── Account sync ─────────────────────────────────────────────────────────────

function toRow(reminder, userId) {
  return {
    user_id: userId,
    text: reminder.text,
    is_done: reminder.isDone,
    completed_at: reminder.completedAt || null,
    snoozed_until: reminder.snoozedUntil || null,
    source_type: reminder.sourceType || null,
    source_id: reminder.sourceId || null,
    source_title: reminder.sourceTitle || null,
    source_href: reminder.sourceHref || null,
    created_at: reminder.createdAt,
  };
}

function isoOrEmpty(value) {
  return value ? new Date(value).toISOString() : '';
}

function fromRow(row, userId) {
  return normalizeReminder({
    id: row.id,
    text: row.text,
    isDone: row.is_done,
    completedAt: isoOrEmpty(row.completed_at),
    snoozedUntil: isoOrEmpty(row.snoozed_until),
    createdAt: isoOrEmpty(row.created_at),
    sourceType: row.source_type,
    sourceId: row.source_id,
    sourceTitle: row.source_title,
    sourceHref: row.source_href,
    updatedAt: toMs(row.updated_at),
    sync: { ownerId: userId, remoteUpdatedAt: toMs(row.updated_at), pending: false },
  });
}

function isOwnedBy(reminder, userId) {
  return !reminder.sync.ownerId || reminder.sync.ownerId === userId;
}

function replaceReminder(reminders, reminder) {
  return reminders.map((candidate) => (candidate.id === reminder.id ? reminder : candidate));
}

function markSynced(id, row, userId, pushedUpdatedAt) {
  const current = readStorage();
  const reminder = current.find((candidate) => candidate.id === id);
  if (!reminder) return null;
  // Changes made while the push was in flight stay pending for the next push.
  const stillPending = reminder.updatedAt !== pushedUpdatedAt;
  const next = { ...reminder, sync: { ownerId: userId, remoteUpdatedAt: toMs(row.updated_at), pending: stillPending } };
  writeStorage(replaceReminder(current, next));
  emitReminderUpdated({ type: 'sync', id, source: 'supabase' });
  return next;
}

async function pushReminder(id, session, { skipQueue = false } = {}) {
  const reminder = readStorage().find((candidate) => candidate.id === id);
  if (!reminder || !reminder.sync.pending || !isOwnedBy(reminder, session.userId)) return reminder || null;
  const { client, userId } = session;
  const pushedUpdatedAt = reminder.updatedAt;

  return tryRemoteOrEnqueue({ kind: REMINDER_QUEUE_KIND_PUSH, payload: { id }, options: { skipQueue } }, async () => {
    if (reminder.sync.remoteUpdatedAt > 0) {
      const query = client.from(TABLE).update(toRow(reminder, userId)).eq('id', id).eq('user_id', userId);
      const { data, error } = await applyExpectedUpdatedAtFilter(query, reminder.sync.remoteUpdatedAt)
        .select(SELECT_COLUMNS)
        .maybeSingle();
      if (error) throw error;
      if (data) return markSynced(id, data, userId, pushedUpdatedAt);
    }

    // First upload, or the row changed (or vanished) elsewhere since this
    // device last saw it: this device's change is the latest, so it wins.
    const { data, error } = await client
      .from(TABLE)
      .upsert({ id, ...toRow(reminder, userId) }, { onConflict: 'id' })
      .select(SELECT_COLUMNS)
      .single();
    if (error) throw error;
    return markSynced(id, data, userId, pushedUpdatedAt);
  });
}

// At most one push per reminder in flight (see schedulePush in the notebook
// pages repository): a quick toggle-and-untoggle must not race itself.
const pushesInFlight = new Map();

function schedulePush(id, session, options = {}) {
  const running = pushesInFlight.get(id);
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
        result = await pushReminder(id, session, options);
      } while (entry.again);
      return result;
    } finally {
      pushesInFlight.delete(id);
    }
  })();
  pushesInFlight.set(id, entry);
  return entry.promise;
}

async function pushDeletion(id, { skipQueue = false } = {}) {
  const session = await getSyncSession();
  if (!session) return;
  await tryRemoteOrEnqueue({ kind: REMINDER_QUEUE_KIND_DELETE, payload: { id }, options: { skipQueue } }, async () => {
    const { error } = await session.client.from(TABLE).delete().eq('id', id).eq('user_id', session.userId);
    if (error) throw error;
  });
  writeDeletedIds(readDeletedIds().filter((deletedId) => deletedId !== id));
}

/** Pushes one reminder if it has unsynced changes. Safe to call when signed out. */
export async function syncReminder(id, options = {}) {
  const session = await getSyncSession();
  if (!session) return readStorage().find((candidate) => candidate.id === id) || null;
  return schedulePush(id, session, options);
}

export async function replayReminderDeletion({ id } = {}) {
  if (typeof id === 'string' && id) await pushDeletion(id, { skipQueue: true });
}

/**
 * Pulls the signed-in account's reminders, merges them into this device,
 * then pushes local changes (including reminders saved before sync existed,
 * once). Returns 'local' when sync is unavailable.
 */
export async function syncReminders() {
  const session = await getSyncSession();
  if (!session) return 'local';
  const { client, userId } = session;
  await Promise.allSettled([...pushesInFlight.values()].map((entry) => entry.promise));

  for (const id of readDeletedIds()) {
    await pushDeletion(id);
  }

  const { data: rows, error } = await client.from(TABLE).select(SELECT_COLUMNS).eq('user_id', userId);
  if (error) throw error;

  let reminders = readStorage();
  const tombstones = new Set(readDeletedIds());
  const remoteIds = new Set();
  let changed = false;

  for (const row of rows || []) {
    if (tombstones.has(row.id)) continue;
    remoteIds.add(row.id);
    const local = reminders.find((reminder) => reminder.id === row.id);
    if (!local) {
      reminders = [...reminders, fromRow(row, userId)];
      changed = true;
    } else if (isOwnedBy(local, userId) && !local.sync.pending && toMs(row.updated_at) !== local.sync.remoteUpdatedAt) {
      reminders = replaceReminder(reminders, fromRow(row, userId));
      changed = true;
    }
    // A local change not yet synced wins: it is pushed below.
  }

  // Reminders this account synced before that are gone remotely were deleted
  // on another device: drop them, unless they changed here since.
  reminders = reminders.flatMap((reminder) => {
    const deletedElsewhere = reminder.sync.ownerId === userId && reminder.sync.remoteUpdatedAt > 0 && !remoteIds.has(reminder.id);
    if (!deletedElsewhere) return [reminder];
    changed = true;
    return reminder.sync.pending ? [{ ...reminder, sync: { ...reminder.sync, remoteUpdatedAt: 0 } }] : [];
  });

  if (changed) {
    writeStorage(reminders);
    emitReminderUpdated({ type: 'pull', source: 'supabase' });
  }

  for (const reminder of readStorage()) {
    if (reminder.sync.pending && isOwnedBy(reminder, userId)) await schedulePush(reminder.id, session);
  }
  return 'synced';
}

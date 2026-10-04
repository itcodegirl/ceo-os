import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../supabaseRuntime', () => {
  const supabaseRuntime = {
    getSupabaseClient: vi.fn(),
    requireSupabaseUserId: vi.fn(),
  };
  return {
    isSupabaseRuntimeEnabled: true,
    getSupabaseRuntime: vi.fn(async () => supabaseRuntime),
    __supabaseRuntime: supabaseRuntime,
  };
});

import * as runtimeModule from '../supabaseRuntime';
import { isoToMicros, withMicroseconds } from '../../test/timestampPrecision';
import { getOfflineQueue } from '../offlineWriteQueue';
import {
  createNotebookPage,
  deleteNotebookPage,
  ensureDailyPage,
  getNotebookPage,
  listSectionPages,
  NOTEBOOK_PAGE_QUEUE_KIND_PUSH,
  registerNotebookSyncFlush,
  resolveNotebookConflict,
  saveNotebookPage,
  syncNotebookPage,
  syncNotebookPages,
} from './notebookPagesRepository';
import { getPlainText, textToDoc } from './notebookText';

const USER = 'user-1';

/**
 * In-memory stand-in for the `notebook_pages` table that behaves like
 * PostgREST + Postgres where it matters: the server stamps `updated_at` with
 * microsecond precision (set_updated_at trigger), the guard is evaluated as an
 * instant range, and the personal-page-per-date unique index is enforced.
 */
function createFakeSupabase() {
  const rows = [];
  let clock = Date.parse('2026-10-01T10:00:00.000Z');
  let failNext = null;
  // When set, writes wait here: lets a test hold a push mid-flight.
  let writeGate = null;
  let loseNextResponse = false;
  const stamp = () => {
    clock += 1000;
    return withMicroseconds(new Date(clock).toISOString(), 417);
  };
  const clone = (row) => JSON.parse(JSON.stringify(row));
  // Postgres jsonb does not keep key order: it stores object keys sorted by
  // length, then bytewise. Tiptap JSON comes back reordered.
  const toJsonb = (value) => {
    if (Array.isArray(value)) return value.map(toJsonb);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(Object.keys(value)
      .sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
      .map((key) => [key, toJsonb(value[key])]));
  };
  const store = (payload) => ({ ...clone(payload), ...(payload.blocks ? { blocks: toJsonb(payload.blocks) } : {}) });

  function from() {
    const state = { op: 'select', filters: [], payload: null };
    const matches = (row) => state.filters.every(([kind, column, value]) => {
      if (kind === 'eq') return row[column] === value;
      if (kind === 'gte') return isoToMicros(row[column]) >= isoToMicros(value);
      return isoToMicros(row[column]) < isoToMicros(value);
    });

    // A write that commits but whose response never arrives (dropped connection).
    const respond = (data) => {
      if (!loseNextResponse) return { data, error: null };
      loseNextResponse = false;
      return { data: null, error: new TypeError('Failed to fetch') };
    };

    const run = () => {
      if (failNext) {
        const error = failNext;
        failNext = null;
        return { data: null, error };
      }
      if (state.op === 'select') return { data: rows.filter(matches).map(clone), error: null };
      if (state.op === 'insert') {
        const next = state.payload;
        const duplicateDay = next.section === 'personal' && rows.some((row) => (
          row.user_id === next.user_id && row.section === 'personal' && row.page_date === next.page_date
        ));
        if (rows.some((row) => row.id === next.id) || duplicateDay) {
          return { data: null, error: { code: '23505', message: 'duplicate key value' } };
        }
        const now = stamp();
        const row = { ...store(next), created_at: now, updated_at: now };
        rows.push(row);
        return respond([clone(row)]);
      }
      if (state.op === 'update') {
        const hits = rows.filter(matches);
        hits.forEach((row) => Object.assign(row, store(state.payload), { updated_at: stamp() }));
        return respond(hits.map(clone));
      }
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        if (matches(rows[index])) rows.splice(index, 1);
      }
      return { data: null, error: null };
    };

    const builder = {
      select: () => builder,
      insert: (payload) => { state.op = 'insert'; state.payload = payload; return builder; },
      update: (payload) => { state.op = 'update'; state.payload = payload; return builder; },
      delete: () => { state.op = 'delete'; return builder; },
      eq: (column, value) => { state.filters.push(['eq', column, value]); return builder; },
      gte: (column, value) => { state.filters.push(['gte', column, value]); return builder; },
      lt: (column, value) => { state.filters.push(['lt', column, value]); return builder; },
      async maybeSingle() {
        if (writeGate && state.op !== 'select') await writeGate;
        const result = run();
        return result.error ? result : { data: result.data?.[0] ?? null, error: null };
      },
      async single() {
        if (writeGate && state.op !== 'select') await writeGate;
        const result = run();
        if (result.error) return result;
        return result.data?.length ? { data: result.data[0], error: null } : { data: null, error: { code: 'PGRST116' } };
      },
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return builder;
  }

  return {
    client: { from },
    rows,
    failNextWith(error) { failNext = error; },
    loseNextResponse() { loseNextResponse = true; },
    /** Holds every write until the returned release function is called. */
    holdWrites() {
      let release;
      writeGate = new Promise((resolve) => { release = resolve; });
      return () => { writeGate = null; release(); };
    },
    /** Simulates another device editing a row (server stamps a new updated_at). */
    editElsewhere(id, changes) {
      const row = rows.find((candidate) => candidate.id === id);
      Object.assign(row, changes, { updated_at: stamp() });
    },
    insertElsewhere(row) {
      const now = stamp();
      rows.push({ user_id: USER, source_url: null, page_date: null, created_at: now, updated_at: now, ...row });
    },
  };
}

let fake;

function signIn() {
  runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(fake.client);
  runtimeModule.__supabaseRuntime.requireSupabaseUserId.mockResolvedValue(USER);
}

function remoteText(id, block) {
  return getPlainText(fake.rows.find((row) => row.id === id)?.blocks?.[block]);
}

describe('notebook pages account sync', () => {
  beforeEach(() => {
    window.localStorage.clear();
    fake = createFakeSupabase();
    runtimeModule.getSupabaseRuntime.mockResolvedValue(runtimeModule.__supabaseRuntime);
    signIn();
  });

  it('stays local, with no remote calls, when the user is signed out', async () => {
    const authRequired = Object.assign(new Error('auth'), { code: 'SUPABASE_AUTH_REQUIRED' });
    runtimeModule.__supabaseRuntime.requireSupabaseUserId.mockRejectedValue(authRequired);
    createNotebookPage({ section: 'learning', title: 'Offline only' });

    await expect(syncNotebookPages()).resolves.toBe('local');
    expect(fake.rows).toEqual([]);
    expect(listSectionPages('learning')[0].sync.pending).toBe(true);
  });

  it('uploads local pages and marks them synced with the server timestamp', async () => {
    const page = ensureDailyPage('2026-10-01');
    saveNotebookPage(page.id, { blocks: { onMyMind: textToDoc('Synced thought') } });

    await expect(syncNotebookPages()).resolves.toBe('synced');

    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0]).toMatchObject({ id: page.id, user_id: USER, section: 'personal', page_date: '2026-10-01' });
    expect(remoteText(page.id, 'onMyMind')).toBe('Synced thought');
    const synced = getNotebookPage(page.id);
    expect(synced.sync).toMatchObject({ ownerId: USER, pending: false, conflict: null });
    expect(synced.sync.remoteUpdatedAt).toBe(Date.parse(fake.rows[0].updated_at));
  });

  it('pulls pages created on another device', async () => {
    fake.insertElsewhere({
      id: 'remote-1', section: 'ventures', title: 'Mentor matching', blocks: { idea: textToDoc('Pair learners with mentors') },
    });

    await syncNotebookPages();

    const [page] = listSectionPages('ventures');
    expect(page).toMatchObject({ id: 'remote-1', title: 'Mentor matching' });
    expect(getPlainText(page.blocks.idea)).toBe('Pair learners with mentors');
    expect(page.sync.pending).toBe(false);
  });

  it('pushes later edits through the updated_at guard despite microsecond timestamps', async () => {
    const page = createNotebookPage({ section: 'learning', title: 'Grid' });
    await syncNotebookPages();

    saveNotebookPage(page.id, { blocks: { notes: textToDoc('fr units') } });
    await syncNotebookPage(page.id);

    expect(remoteText(page.id, 'notes')).toBe('fr units');
    expect(getNotebookPage(page.id).sync).toMatchObject({ pending: false, conflict: null });
  });

  it('applies remote edits to pages without local changes', async () => {
    const page = createNotebookPage({ section: 'professional', title: 'Review prep' });
    await syncNotebookPages();
    const revisionBefore = getNotebookPage(page.id).sync.revision;

    fake.editElsewhere(page.id, { blocks: { wins: textToDoc('Shipped the beta') } });
    await syncNotebookPages();

    const pulled = getNotebookPage(page.id);
    expect(getPlainText(pulled.blocks.wins)).toBe('Shipped the beta');
    expect(pulled.sync.revision).toBeGreaterThan(revisionBefore);
  });

  it('turns edits on two devices into a conflict instead of overwriting either', async () => {
    const page = createNotebookPage({ section: 'learning', title: 'Closures' });
    await syncNotebookPages();

    fake.editElsewhere(page.id, { blocks: { notes: textToDoc('From the laptop') } });
    saveNotebookPage(page.id, { blocks: { notes: textToDoc('From the phone') } });
    await syncNotebookPage(page.id);

    const conflicted = getNotebookPage(page.id);
    expect(conflicted.sync.conflict).toMatchObject({ remoteId: page.id });
    expect(getPlainText(conflicted.sync.conflict.blocks.notes)).toBe('From the laptop');
    expect(getPlainText(conflicted.blocks.notes)).toBe('From the phone');
    expect(remoteText(page.id, 'notes')).toBe('From the laptop');
  });

  it("resolves a conflict with 'mine' by overwriting the other copy", async () => {
    const page = createNotebookPage({ section: 'learning', title: 'Closures' });
    await syncNotebookPages();
    fake.editElsewhere(page.id, { blocks: { notes: textToDoc('laptop') } });
    saveNotebookPage(page.id, { blocks: { notes: textToDoc('phone') } });
    await syncNotebookPage(page.id);

    await resolveNotebookConflict(page.id, 'mine');

    expect(remoteText(page.id, 'notes')).toBe('phone');
    expect(getNotebookPage(page.id).sync).toMatchObject({ pending: false, conflict: null });
  });

  it("resolves a conflict with 'theirs' by taking the other copy", async () => {
    const page = createNotebookPage({ section: 'learning', title: 'Closures' });
    await syncNotebookPages();
    fake.editElsewhere(page.id, { blocks: { notes: textToDoc('laptop') } });
    saveNotebookPage(page.id, { blocks: { notes: textToDoc('phone') } });
    await syncNotebookPage(page.id);

    await resolveNotebookConflict(page.id, 'theirs');

    const resolved = getNotebookPage(page.id);
    expect(getPlainText(resolved.blocks.notes)).toBe('laptop');
    expect(resolved.sync).toMatchObject({ pending: false, conflict: null });
  });

  describe('two devices opening the same day', () => {
    it('adopts the remote page when this device has not written anything', async () => {
      fake.insertElsewhere({ id: 'remote-day', section: 'personal', title: 'Today', page_date: '2026-10-01', blocks: { onMyMind: textToDoc('From the laptop') } });
      const local = ensureDailyPage('2026-10-01');

      await syncNotebookPages();

      expect(getNotebookPage(local.id)).toBeNull();
      const [page] = listSectionPages('personal');
      expect(page.id).toBe('remote-day');
      expect(getPlainText(page.blocks.onMyMind)).toBe('From the laptop');
    });

    it("keeps this device's writing under the shared page when the other copy is empty", async () => {
      fake.insertElsewhere({ id: 'remote-day', section: 'personal', title: 'Today', page_date: '2026-10-01', blocks: {} });
      const local = ensureDailyPage('2026-10-01');
      saveNotebookPage(local.id, { blocks: { onMyMind: textToDoc('From the phone') } });

      await syncNotebookPages();

      expect(fake.rows).toHaveLength(1);
      expect(remoteText('remote-day', 'onMyMind')).toBe('From the phone');
      expect(listSectionPages('personal')).toHaveLength(1);
    });

    it('raises a conflict when both copies have writing', async () => {
      fake.insertElsewhere({ id: 'remote-day', section: 'personal', title: 'Today', page_date: '2026-10-01', blocks: { onMyMind: textToDoc('laptop') } });
      const local = ensureDailyPage('2026-10-01');
      saveNotebookPage(local.id, { blocks: { onMyMind: textToDoc('phone') } });

      await syncNotebookPages();

      const [page] = listSectionPages('personal');
      expect(page.id).toBe('remote-day');
      expect(getPlainText(page.blocks.onMyMind)).toBe('phone');
      expect(getPlainText(page.sync.conflict.blocks.onMyMind)).toBe('laptop');
    });

    it('handles the duplicate-day insert race the unique index reports', async () => {
      const local = ensureDailyPage('2026-10-01');
      saveNotebookPage(local.id, { blocks: { onMyMind: textToDoc('phone') } });
      fake.insertElsewhere({ id: 'remote-day', section: 'personal', title: 'Today', page_date: '2026-10-01', blocks: {} });

      // Push before any pull, so the insert itself hits the unique index.
      await syncNotebookPage(local.id);

      expect(fake.rows).toHaveLength(1);
      expect(remoteText('remote-day', 'onMyMind')).toBe('phone');
    });
  });

  it('saves writing still in the autosave debounce before pulling, so a remote edit cannot replace it', async () => {
    const page = createNotebookPage({ section: 'learning', title: 'Hooks' });
    await syncNotebookPages();
    fake.editElsewhere(page.id, { blocks: { notes: textToDoc('from the laptop') } });

    // Stands in for the open page's autosave holding unsaved typing.
    let unsaved = textToDoc('typed here, not saved yet');
    const unregister = registerNotebookSyncFlush(() => {
      if (!unsaved) return;
      saveNotebookPage(page.id, { blocks: { notes: unsaved } });
      unsaved = null;
    });
    await syncNotebookPages();
    unregister();

    const after = getNotebookPage(page.id);
    expect(getPlainText(after.blocks.notes)).toBe('typed here, not saved yet');
    expect(getPlainText(after.sync.conflict.blocks.notes)).toBe('from the laptop');
  });

  it('serializes rapid autosaves into one push at a time, without false conflicts', async () => {
    const page = createNotebookPage({ section: 'learning', title: 'Promises' });
    await syncNotebookPages();

    // The first push is held mid-write while the learner keeps typing, so the
    // later edits land before it commits — the overlap autosave produces.
    const release = fake.holdWrites();
    saveNotebookPage(page.id, { blocks: { notes: textToDoc('a') } });
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    saveNotebookPage(page.id, { blocks: { notes: textToDoc('ab') } });
    saveNotebookPage(page.id, { blocks: { notes: textToDoc('abc') } });
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    release();
    await syncNotebookPage(page.id);

    expect(remoteText(page.id, 'notes')).toBe('abc');
    expect(getNotebookPage(page.id).sync).toMatchObject({ pending: false, conflict: null });
  });

  it('drops pages deleted on another device, but asks before dropping unsynced edits', async () => {
    const quiet = createNotebookPage({ section: 'professional', title: 'Quiet' });
    const edited = createNotebookPage({ section: 'professional', title: 'Edited' });
    await syncNotebookPages();

    fake.rows.splice(0, fake.rows.length);
    saveNotebookPage(edited.id, { blocks: { notes: textToDoc('still writing') } });
    await syncNotebookPages();

    expect(getNotebookPage(quiet.id)).toBeNull();
    const kept = getNotebookPage(edited.id);
    expect(kept.sync.conflict).toEqual({ deletedElsewhere: true });
    expect(getPlainText(kept.blocks.notes)).toBe('still writing');

    await resolveNotebookConflict(edited.id, 'mine');
    expect(fake.rows.map((row) => row.id)).toEqual([edited.id]);
    expect(remoteText(edited.id, 'notes')).toBe('still writing');
  });

  it("lets 'theirs' accept a deletion made on another device", async () => {
    const page = createNotebookPage({ section: 'professional', title: 'Gone' });
    await syncNotebookPages();
    fake.rows.splice(0, fake.rows.length);
    saveNotebookPage(page.id, { blocks: { notes: textToDoc('late edit') } });
    await syncNotebookPage(page.id);

    await resolveNotebookConflict(page.id, 'theirs');

    expect(getNotebookPage(page.id)).toBeNull();
    expect(fake.rows).toEqual([]);
  });

  it('deletes synced pages remotely, retrying deletions made while signed out', async () => {
    const page = createNotebookPage({ section: 'ventures', title: 'Old idea' });
    await syncNotebookPages();

    const authRequired = Object.assign(new Error('auth'), { code: 'SUPABASE_AUTH_REQUIRED' });
    runtimeModule.__supabaseRuntime.requireSupabaseUserId.mockRejectedValue(authRequired);
    deleteNotebookPage(page.id);
    await Promise.resolve();
    expect(fake.rows).toHaveLength(1);

    signIn();
    await syncNotebookPages();

    expect(fake.rows).toHaveLength(0);
    expect(getNotebookPage(page.id)).toBeNull();
  });

  it('queues a push for replay when the network drops, and keeps the edit', async () => {
    const page = createNotebookPage({ section: 'learning', title: 'Events' });
    await syncNotebookPages();

    fake.failNextWith(new TypeError('Failed to fetch'));
    saveNotebookPage(page.id, { blocks: { notes: textToDoc('bubbling') } });
    // Joins the push the save started in the background.
    await expect(syncNotebookPage(page.id)).rejects.toThrow('Failed to fetch');

    expect(getOfflineQueue()).toEqual([expect.objectContaining({ kind: NOTEBOOK_PAGE_QUEUE_KIND_PUSH, payload: { id: page.id } })]);
    expect(getNotebookPage(page.id).sync.pending).toBe(true);
    expect(getPlainText(getNotebookPage(page.id).blocks.notes)).toBe('bubbling');
  });

  it('recognizes its own write after a lost response, despite jsonb reordering keys', async () => {
    const page = createNotebookPage({ section: 'learning', title: 'Reducers' });
    await syncNotebookPages();

    // The update commits on the server, but the response is lost, so this
    // device still holds the old remote timestamp and the page stays pending.
    fake.loseNextResponse();
    saveNotebookPage(page.id, {
      blocks: { notes: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'pure', marks: [{ type: 'bold' }] }] }] } },
    });
    await syncNotebookPage(page.id).catch(() => {});
    expect(getNotebookPage(page.id).sync.pending).toBe(true);

    await syncNotebookPages();

    const after = getNotebookPage(page.id);
    expect(after.sync).toMatchObject({ pending: false, conflict: null });
    expect(remoteText(page.id, 'notes')).toBe('pure');
  });

  it('leaves pages that belong to another account alone', async () => {
    const page = createNotebookPage({ section: 'learning', title: 'Theirs' });
    await syncNotebookPages();

    runtimeModule.__supabaseRuntime.requireSupabaseUserId.mockResolvedValue('user-2');
    saveNotebookPage(page.id, { blocks: { notes: textToDoc('edited while user-2 is signed in') } });
    await syncNotebookPages();

    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0].user_id).toBe(USER);
    expect(getNotebookPage(page.id)).not.toBeNull();
  });
});

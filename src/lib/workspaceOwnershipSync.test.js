import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from '../test/fakeSupabase';
import { listNotebookPages, syncNotebookPages, replayNotebookPageDeletion } from './notebook/notebookPagesRepository';
import { listNotebookItems, syncNotebookItems, replayNotebookItemDeletion } from './notebook/items/notebookItemsRepository';
import { listReminders, syncReminders, replayReminderDeletion } from './remindersRepository';

const { runtime } = vi.hoisted(() => ({ runtime: { getSupabaseClient: vi.fn(), requireSupabaseUserId: vi.fn() } }));
vi.mock('./supabaseRuntime', () => ({ getSupabaseRuntime: async () => runtime }));

function account(id) {
  window.localStorage.setItem('ceo-os:auth', JSON.stringify({ user: { id } }));
  runtime.requireSupabaseUserId.mockResolvedValue(id);
}

const domains = [
  { name: 'pages', table: 'notebook_pages', key: 'ceo-os-notebook-pages', collection: 'pages', deleted: 'deletedPageIds',
    sync: syncNotebookPages, read: listNotebookPages, replay: (id) => replayNotebookPageDeletion({ id }) },
  { name: 'ideas', table: 'notebook_ideas', key: 'ceo-os-notebook-ideas', collection: 'items', deleted: 'deletedIds',
    sync: syncNotebookItems, read: () => listNotebookItems('idea'), replay: (id) => replayNotebookItemDeletion({ kind: 'idea', id }) },
  { name: 'reminders', table: 'reminders', key: 'ceo-os-reminder-deletions',
    sync: syncReminders, read: listReminders, replay: (id) => replayReminderDeletion({ id }) },
];
let fake;
beforeEach(() => {
  window.localStorage.clear();
  fake = createFakeSupabase();
  runtime.getSupabaseClient.mockResolvedValue(fake.client);
  account('A');
});

describe.each(domains)('$name account ownership during sync', (domain) => {
  it('rejects a late account-A pull without putting it into account B', async () => {
    fake.insertElsewhere(domain.table, { id: 'private-A', user_id: 'A', section: 'learning', title: 'A private work', text: 'A private work' });
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    let requestStarted;
    const started = new Promise((resolve) => { requestStarted = resolve; });
    const from = fake.client.from;
    fake.client.from = (table) => {
      const query = from(table);
      const originalThen = query.then;
      query.then = (resolve, reject) => originalThen(async (result) => {
        requestStarted();
        await gate;
        return resolve(result);
      }, reject);
      return query;
    };
    const syncing = domain.sync();
    await started;
    account('B');
    const rejected = expect(syncing).rejects.toMatchObject({ code: 'WORKSPACE_ACCOUNT_CHANGED' });
    release();
    await rejected;
    expect(domain.read()).toEqual([]);
    fake.client.from = from;
    await domain.sync();
    expect(domain.read()).toEqual([]);
    account('A');
    await domain.sync();
    expect(domain.read().map((record) => record.id)).toEqual(['private-A']);
  });

  it('never sends another account’s or an ownerless legacy deletion', async () => {
    fake.insertElsewhere(domain.table, { id: 'owned', user_id: 'A' });
    fake.insertElsewhere(domain.table, { id: 'legacy', user_id: 'B' });
    const deletions = [{ id: 'owned', ownerId: 'A' }, 'legacy'];
    const value = domain.collection ? { [domain.collection]: [], [domain.deleted]: deletions } : deletions;
    window.localStorage.setItem(domain.key, JSON.stringify(value));
    account('B');
    await domain.replay('owned');
    await domain.replay('legacy');
    expect(fake.tables[domain.table].map((record) => record.id)).toEqual(['owned', 'legacy']);
    account('A');
    await domain.replay('owned');
    expect(fake.tables[domain.table].map((record) => record.id)).toEqual(['legacy']);
    expect(window.localStorage.getItem(domain.key)).toContain('legacy');
  });
});

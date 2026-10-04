import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabaseRuntime', () => {
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

import * as runtimeModule from './supabaseRuntime';
import { createFakeSupabase, FAKE_USER_ID as USER } from '../test/fakeSupabase';
import { getOfflineQueue } from './offlineWriteQueue';
import {
  createReminder,
  deleteReminder,
  listPageReminders,
  listReminders,
  relinkReminderSource,
  REMINDER_QUEUE_KIND_PUSH,
  syncReminders,
  toggleReminder,
  updateReminderText,
} from './remindersRepository';

let fake;

function signIn() {
  runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(fake.client);
  runtimeModule.__supabaseRuntime.requireSupabaseUserId.mockResolvedValue(USER);
}

function signOut() {
  const authRequired = Object.assign(new Error('auth'), { code: 'SUPABASE_AUTH_REQUIRED' });
  runtimeModule.__supabaseRuntime.requireSupabaseUserId.mockRejectedValue(authRequired);
}

// Lets background pushes started by local writes (which check the session
// asynchronously) finish before the test changes who is signed in.
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const SOURCE = { type: 'notebook-page', id: 'page-1', title: 'Value pricing', href: '/notebook?section=learning&page=page-1' };

function find(id) {
  return listReminders().find((reminder) => reminder.id === id);
}

beforeEach(() => {
  window.localStorage.clear();
  fake = createFakeSupabase();
  runtimeModule.getSupabaseRuntime.mockResolvedValue(runtimeModule.__supabaseRuntime);
  signOut();
});

describe('notebook to-dos', () => {
  it('links a to-do to its page, and keeps only in-app notebook links', () => {
    const todo = createReminder({ text: 'Draft the pricing page', source: SOURCE });
    createReminder({ text: 'Plain reminder' });
    createReminder({ text: 'Odd link', source: { ...SOURCE, id: 'page-2', href: 'https://evil.example' } });

    expect(listPageReminders('page-1')).toEqual([expect.objectContaining({
      id: todo.id,
      sourceType: 'notebook-page',
      sourceTitle: 'Value pricing',
      sourceHref: SOURCE.href,
    })]);
    expect(listPageReminders('page-2')[0].sourceHref).toBe('');
    expect(listReminders().find((reminder) => reminder.text === 'Plain reminder')).toMatchObject({ sourceType: '', sourceHref: '' });
  });

  it('follows a page whose id changes', () => {
    const todo = createReminder({ text: 'Call the bank', source: { ...SOURCE, id: 'local-day' } });
    relinkReminderSource('local-day', 'remote-day');
    expect(listPageReminders('remote-day').map((reminder) => reminder.id)).toEqual([todo.id]);
    expect(find(todo.id).sync.pending).toBe(true);
  });
});

describe('reminders account sync', () => {
  it('stays local, with no remote calls, when signed out', async () => {
    createReminder({ text: 'Offline only' });
    await expect(syncReminders()).resolves.toBe('local');
    expect(fake.tables.reminders).toEqual([]);
  });

  it('uploads reminders saved before sync existed, once, keeping their fields', async () => {
    window.localStorage.setItem('ceo-os-reminders', JSON.stringify([
      { id: 'legacy-1', text: 'Legacy reminder', isDone: true, completedAt: '2026-09-01T10:00:00.000Z', createdAt: '2026-08-30T09:00:00.000Z' },
    ]));
    signIn();

    await syncReminders();
    await syncReminders();

    expect(fake.tables.reminders).toEqual([expect.objectContaining({
      id: 'legacy-1',
      user_id: USER,
      text: 'Legacy reminder',
      is_done: true,
      completed_at: '2026-09-01T10:00:00.000Z',
      created_at: '2026-08-30T09:00:00.000Z',
    })]);
    expect(find('legacy-1').sync).toMatchObject({ pending: false, ownerId: USER });
  });

  it('pushes changes and brings in reminders and changes from other devices', async () => {
    signIn();
    const todo = createReminder({ text: 'Draft the pricing page', source: SOURCE });
    await syncReminders();
    toggleReminder(todo.id, true);
    await syncReminders();
    expect(fake.tables.reminders[0]).toMatchObject({ is_done: true, source_id: 'page-1', source_href: SOURCE.href });

    fake.insertElsewhere('reminders', { id: 'from-phone', text: 'Book the venue', is_done: false });
    fake.editElsewhere('reminders', todo.id, { text: 'Draft and publish the pricing page' });
    await syncReminders();

    expect(find('from-phone')).toMatchObject({ text: 'Book the venue', isDone: false });
    expect(find(todo.id).text).toBe('Draft and publish the pricing page');
  });

  it('lets the latest change win when a reminder changed here and on another device', async () => {
    signIn();
    const todo = createReminder({ text: 'Original' });
    await syncReminders();

    await settle();
    signOut();
    updateReminderText(todo.id, 'Changed here, later');
    fake.editElsewhere('reminders', todo.id, { text: 'Changed elsewhere' });
    await settle();
    signIn();
    await syncReminders();

    expect(find(todo.id).text).toBe('Changed here, later');
    expect(fake.tables.reminders.map((row) => row.text)).toEqual(['Changed here, later']);
    expect(find(todo.id).sync.pending).toBe(false);
  });

  it('removes reminders deleted elsewhere, and deletions here never come back', async () => {
    signIn();
    const deletedElsewhere = createReminder({ text: 'Deleted on phone' });
    const deletedHere = createReminder({ text: 'Deleted here' });
    await syncReminders();

    await settle();
    signOut();
    deleteReminder(deletedHere.id);
    fake.deleteElsewhere('reminders', deletedElsewhere.id);
    await settle();
    signIn();
    await syncReminders();

    expect(listReminders()).toEqual([]);
    expect(fake.tables.reminders).toEqual([]);
  });

  it('does not bring back a reminder deleted while a pull was in flight', async () => {
    signIn();
    const todo = createReminder({ text: 'Deleted mid-sync' });
    await syncReminders();

    // Delete it the moment the next pull's request goes out.
    const originalFrom = fake.client.from;
    let deleted = false;
    fake.client.from = (table) => {
      const builder = originalFrom(table);
      const originalThen = builder.then;
      builder.then = (resolve, reject) => {
        if (!deleted) {
          deleted = true;
          deleteReminder(todo.id);
        }
        return originalThen(resolve, reject);
      };
      return builder;
    };
    await syncReminders();

    expect(find(todo.id)).toBeUndefined();
  });

  it('queues a push for later when the network drops, and a replay does not duplicate', async () => {
    signIn();
    fake.loseNextResponse();
    const todo = createReminder({ text: 'Survive the outage' });
    await settle();
    await settle();

    expect(getOfflineQueue().map((entry) => [entry.kind, entry.payload])).toContainEqual([REMINDER_QUEUE_KIND_PUSH, { id: todo.id }]);
    await syncReminders();
    expect(fake.tables.reminders).toHaveLength(1);
    expect(find(todo.id).sync.pending).toBe(false);
  });
});

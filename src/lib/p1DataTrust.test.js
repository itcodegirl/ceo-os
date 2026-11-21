import { importWorkspaceBackup } from './workspaceBackupImport';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createCaptureNote, updateCaptureNote, listCaptureNotes } from './captureRepository';
import { getCurrentWeekStart, getWeeklyBriefByWeek, createWeeklyItem } from './weeklyRepository';
import { saveWorkspaceSetupMode } from './workspaceSetup';
import { createNotebookPage, getNotebookPage, saveNotebookPage, deleteNotebookPage } from './notebook/notebookPagesRepository';
import { createItem, listNotebookItems, deleteItem } from './notebook/items/notebookItemsRepository';
import { createReminder, listReminders, deleteReminder } from './remindersRepository';
import { enqueueOfflineWrite, drainOfflineQueue, getOfflineQueue, OFFLINE_QUEUE_STORAGE_KEY } from './offlineWriteQueue';
import { tryRemoteOrEnqueue } from './offlineWriteQueueIntegration';
import { buildWorkspaceBackup } from './workspacePortability';

const account = (id) => id
  ? window.localStorage.setItem('ceo-os:auth', JSON.stringify({ user: { id } }))
  : window.localStorage.removeItem('ceo-os:auth');

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.useRealTimers());

describe('P1 data-trust regressions', () => {
  it('preserves each typed space/newline and an intentionally cleared saved note', () => {
    const note = createCaptureNote({ text: 'start' });
    let text = '';
    for (const character of 'book a follow up\nnext week ') {
      text += character;
      updateCaptureNote(note.id, { text });
      expect(listCaptureNotes()[0].text).toBe(text);
    }
    updateCaptureNote(note.id, { text: '' });
    expect(listCaptureNotes()[0].text).toBe('');
    expect(() => createCaptureNote({ text: '  ' })).toThrow();
  });

  it('keeps blank mode empty in the actual current week and after rollover', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-23T12:00:00Z'));
    saveWorkspaceSetupMode('blank');
    const firstWeek = getCurrentWeekStart();
    expect(await getWeeklyBriefByWeek()).toMatchObject({ priorities: [], wins: [], blockers: [] });
    await createWeeklyItem({ weekStart: firstWeek, itemType: 'priority', item: { title: 'Real work' } });
    vi.setSystemTime(new Date('2026-11-30T12:00:00Z'));
    expect(getCurrentWeekStart()).not.toBe(firstWeek);
    expect(await getWeeklyBriefByWeek()).toMatchObject({ priorities: [], wins: [], blockers: [] });
    expect((await getWeeklyBriefByWeek(firstWeek)).priorities.map((p) => p.title)).toEqual(['Real work']);
  });

  it('retains the intentional demo experience and legacy authored weekly entries', async () => {
    saveWorkspaceSetupMode('demo');
    expect((await getWeeklyBriefByWeek()).priorities.length).toBeGreaterThan(0);
    saveWorkspaceSetupMode('blank');
    window.localStorage.setItem('ceo-os-weekly-priorities', JSON.stringify([{ id: 'real', title: 'Legacy real work' }]));
    expect((await getWeeklyBriefByWeek()).priorities.map((p) => p.title)).toEqual(['Legacy real work']);
  });

  it('isolates page/item/reminder reads and mutations without erasing any account', () => {
    const local = createNotebookPage({ section: 'learning', title: 'Local private notes' });
    account('A');
    const page = createNotebookPage({ section: 'learning', title: 'A private notes' });
    const item = createItem('idea', { draft: { title: 'A idea' }, pageId: page.id });
    const reminder = createReminder({ text: 'A reminder' });
    account('B');
    expect(getNotebookPage(page.id)).toBeNull();
    expect(getNotebookPage(local.id)).toBeNull();
    expect(listNotebookItems('idea')).toEqual([]);
    expect(listReminders()).toEqual([]);
    expect(() => saveNotebookPage(page.id, { title: 'B overwrite' })).toThrow();
    deleteNotebookPage(page.id);
    deleteItem('idea', item.id);
    expect(() => deleteReminder(reminder.id)).toThrow();
    createReminder({ text: 'B reminder' });
    account('A');
    expect(getNotebookPage(page.id).title).toBe('A private notes');
    expect(listNotebookItems('idea')[0].id).toBe(item.id);
    expect(listReminders().map((r) => r.text)).toEqual(['A reminder']);
    account('');
    expect(getNotebookPage(local.id).title).toBe('Local private notes');
    expect(listReminders()).toEqual([]);
  });

  it('flushes an old editor draft to its original local owner after an account change', () => {
    account('A');
    const page = createNotebookPage({ section: 'learning', title: 'A original' });
    account('B');
    saveNotebookPage(page.id, { title: 'A final draft' }, { ownerId: 'A', expectedUpdatedAt: page.updatedAt });
    expect(getNotebookPage(page.id)).toBeNull();
    account('A');
    expect(getNotebookPage(page.id).title).toBe('A final draft');
  });

  it('exports/imports only the active account and preserves the other accounts', () => {
    account('A');
    createReminder({ text: 'A secret' });
    const backupA = buildWorkspaceBackup();
    account('B');
    const b = createReminder({ text: 'B draft' });
    const backupB = buildWorkspaceBackup();
    expect(JSON.stringify(backupB)).not.toContain('A secret');
    expect(() => importWorkspaceBackup(backupA)).toThrow(/another workspace/);
    deleteReminder(b.id);
    importWorkspaceBackup(backupB);
    expect(listReminders().map((r) => r.text)).toEqual(['B draft']);
    account('A');
    expect(listReminders().map((r) => r.text)).toEqual(['A secret']);
  });

  it('rejects legacy backup deletions with no proven owner before restoring any data', () => {
    account('A');
    const backup = buildWorkspaceBackup();
    delete backup.workspaceOwnerId;
    backup.keys['ceo-os-notebook-pages'] = JSON.stringify({ pages: [], deletedPageIds: ['unowned-id'] });
    expect(() => importWorkspaceBackup(backup)).toThrow(/deletions without a matching workspace owner/);
    expect(window.localStorage.getItem('ceo-os-notebook-pages')).toBeNull();
  });

  it('replays only the originating account and holds legacy ownerless entries', async () => {
    account('A');
    enqueueOfflineWrite({ kind: 'create', payload: { title: 'A' } });
    const entries = getOfflineQueue();
    window.localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify([...entries, { id: 'legacy', kind: 'create', payload: {} }]));
    account('B');
    enqueueOfflineWrite({ kind: 'create', payload: { title: 'B' } });
    const handler = vi.fn();
    expect((await drainOfflineQueue({ create: handler })).drained).toBe(1);
    expect(handler.mock.calls[0][0]).toEqual({ title: 'B' });
    account('A');
    expect((await drainOfflineQueue({ create: handler })).drained).toBe(1);
    expect(getOfflineQueue().map((entry) => entry.id)).toEqual(['legacy']);
  });

  it('preserves an uncertain replay when the account changes before acknowledgement', async () => {
    account('A');
    enqueueOfflineWrite({ kind: 'delete', payload: { id: 'A-row' } });
    const result = await drainOfflineQueue({ delete: async () => { account('B'); } });
    expect(result).toMatchObject({ drained: 0, failed: 1, remaining: 1 });
    expect(getOfflineQueue()[0].ownerId).toBe('A');
  });

  it('keeps the original owner when a pending request fails after switching accounts', async () => {
    account('A');
    await expect(tryRemoteOrEnqueue({ kind: 'create', payload: { title: 'A work' } }, async () => {
      account('B');
      throw new TypeError('Failed to fetch');
    })).rejects.toThrow();
    expect(getOfflineQueue()[0]).toMatchObject({ ownerId: 'A', payload: { title: 'A work' } });
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isStaleRecordError } from '../staleRecordError';
import { saveJournalEntry } from '../journalRepository';
import {
  createNotebookPage,
  deleteNotebookPage,
  ensureDailyPage,
  getDailySignalEntry,
  getNotebookPage,
  importLegacyJournalEntries,
  listSectionPages,
  NOTEBOOK_PAGES_STORAGE_KEY,
  NOTEBOOK_PAGES_UPDATED_EVENT,
  saveNotebookPage,
} from './notebookPagesRepository';
import { textToDoc } from './notebookText';

// No Supabase env in tests, so every call stays on the local path.

describe('notebookPagesRepository (local)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates exactly one Personal page per date', () => {
    const first = ensureDailyPage('2026-10-01');
    const again = ensureDailyPage('2026-10-01');

    expect(again.id).toBe(first.id);
    expect(first).toMatchObject({ section: 'personal', pageDate: '2026-10-01', blocks: {} });
    expect(first.title).toMatch(/2026/);
    expect(listSectionPages('personal')).toHaveLength(1);
  });

  it('creates named pages with a required title, and never for Personal', () => {
    const page = createNotebookPage({ section: 'learning', title: '  Flexbox basics  ', sourceUrl: ' https://example.com ' });
    expect(page).toMatchObject({ section: 'learning', title: 'Flexbox basics', sourceUrl: 'https://example.com', pageDate: '' });
    expect(page.sync).toMatchObject({ pending: true, remoteUpdatedAt: 0 });

    expect(() => createNotebookPage({ section: 'learning', title: '   ' })).toThrow('Give the page a title.');
    expect(() => createNotebookPage({ section: 'personal', title: 'Nope' })).toThrow(/one per day/);
  });

  it('saves edited blocks, keeps the others, and marks the page for sync', () => {
    const page = ensureDailyPage('2026-10-01');
    const first = saveNotebookPage(page.id, { blocks: { onMyMind: textToDoc('Launch prep') } });
    const second = saveNotebookPage(page.id, { blocks: { feelsHeavy: textToDoc('Too many tabs') } });

    expect(second.updatedAt).toBeGreaterThan(first.updatedAt);
    expect(Object.keys(second.blocks).sort()).toEqual(['feelsHeavy', 'onMyMind']);
    expect(second.sync.pending).toBe(true);
    expect(getNotebookPage(page.id).blocks.onMyMind).toEqual(textToDoc('Launch prep'));
  });

  it('rejects a save based on a version another tab already replaced', () => {
    const page = ensureDailyPage('2026-10-01');
    const fromOtherTab = saveNotebookPage(page.id, { blocks: { onMyMind: textToDoc('other tab') } });

    let thrown;
    try {
      saveNotebookPage(page.id, { blocks: { onMyMind: textToDoc('stale tab') } }, { expectedUpdatedAt: page.updatedAt });
    } catch (error) {
      thrown = error;
    }
    expect(isStaleRecordError(thrown)).toBe(true);
    expect(getNotebookPage(page.id).blocks.onMyMind).toEqual(fromOtherTab.blocks.onMyMind);
  });

  it('surfaces storage failures instead of pretending the save worked', () => {
    const page = ensureDailyPage('2026-10-01');
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });

    expect(() => saveNotebookPage(page.id, { blocks: { onMyMind: textToDoc('kept') } })).toThrow();
  });

  it("exposes today's Personal page to Focus Home as plain text in the old Journal shape", () => {
    expect(getDailySignalEntry('2026-10-01')).toEqual({
      onMyMind: '', feelsHeavy: '', oneNextThing: '', todaySuccess: '', updatedAt: '',
    });

    const page = ensureDailyPage('2026-10-01');
    saveNotebookPage(page.id, {
      blocks: {
        feelsHeavy: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Investor ', marks: [{ type: 'bold' }] }, { type: 'text', text: 'deck' }] }] },
      },
    });

    expect(getDailySignalEntry('2026-10-01')).toMatchObject({ feelsHeavy: 'Investor deck', oneNextThing: '' });
  });

  it('orders Personal pages by date and named pages by last edit', () => {
    ensureDailyPage('2026-09-29');
    ensureDailyPage('2026-10-01');
    ensureDailyPage('2026-09-30');
    expect(listSectionPages('personal').map((page) => page.pageDate)).toEqual(['2026-10-01', '2026-09-30', '2026-09-29']);

    const older = createNotebookPage({ section: 'ventures', title: 'Older' });
    createNotebookPage({ section: 'ventures', title: 'Newer' });
    saveNotebookPage(older.id, { blocks: { idea: textToDoc('touched') } });
    expect(listSectionPages('ventures').map((page) => page.title)).toEqual(['Older', 'Newer']);
  });

  it('announces changes on the notebook update event', () => {
    const listener = vi.fn();
    window.addEventListener(NOTEBOOK_PAGES_UPDATED_EVENT, listener);
    const page = createNotebookPage({ section: 'professional', title: 'Q4 goals' });
    deleteNotebookPage(page.id);
    window.removeEventListener(NOTEBOOK_PAGES_UPDATED_EVENT, listener);

    expect(listener.mock.calls.map(([event]) => event.detail.type)).toEqual(['create', 'delete']);
    expect(getNotebookPage(page.id)).toBeNull();
  });

  it('only keeps a deletion tombstone for pages that were synced', () => {
    const page = createNotebookPage({ section: 'professional', title: 'Never synced' });
    deleteNotebookPage(page.id);

    const stored = JSON.parse(window.localStorage.getItem(NOTEBOOK_PAGES_STORAGE_KEY));
    expect(stored.data.deletedPageIds).toEqual([]);
  });
});

describe('importLegacyJournalEntries', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('turns each written Journal day into a Personal page, once, and keeps the original', () => {
    saveJournalEntry({ dateKey: '2026-09-28', entry: { onMyMind: 'Line one\nLine two', oneNextThing: 'Email Dana' } });
    saveJournalEntry({ dateKey: '2026-09-27', entry: { onMyMind: '   ' } });
    const originalJournal = window.localStorage.getItem('ceo-os-journal-entries');

    expect(importLegacyJournalEntries()).toBe(1);
    expect(importLegacyJournalEntries()).toBe(0);

    const [page] = listSectionPages('personal');
    expect(page.pageDate).toBe('2026-09-28');
    expect(page.blocks.onMyMind).toEqual(textToDoc('Line one\nLine two'));
    expect(getDailySignalEntry('2026-09-28')).toMatchObject({ onMyMind: 'Line one\nLine two', oneNextThing: 'Email Dana' });
    expect(page.sync.pending).toBe(true);
    expect(window.localStorage.getItem('ceo-os-journal-entries')).toBe(originalJournal);
  });

  it('imports on the first notebook read from anywhere, so Focus Home never misses old entries', () => {
    saveJournalEntry({ dateKey: '2026-09-28', entry: { feelsHeavy: 'Taxes', oneNextThing: '' } });

    // Focus Home's adapter is the first reader; nothing called the import.
    expect(getDailySignalEntry('2026-09-28')).toMatchObject({ feelsHeavy: 'Taxes', oneNextThing: '' });
    expect(importLegacyJournalEntries()).toBe(0);
    expect(listSectionPages('personal')).toHaveLength(1);
  });

  it('runs once: later Journal writes are not re-imported over notebook pages', () => {
    const existing = ensureDailyPage('2026-09-28');
    saveNotebookPage(existing.id, { blocks: { onMyMind: textToDoc('Written in the notebook') } });
    saveJournalEntry({ dateKey: '2026-09-28', entry: { onMyMind: 'Old journal text' } });

    expect(importLegacyJournalEntries()).toBe(0);
    expect(getDailySignalEntry('2026-09-28').onMyMind).toBe('Written in the notebook');
  });
});

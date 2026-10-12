import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useFocusHomeSignals } from './useFocusHomeSignals';

const repositoryState = vi.hoisted(() => ({
  listCaptureNotes: vi.fn(() => []),
  getDailySignalEntry: vi.fn(() => null),
  getTodayJournalDateKey: vi.fn(() => '2026-05-01'),
  listReminders: vi.fn(() => []),
}));

vi.mock('../lib/captureRepository', () => ({
  CAPTURE_NOTES_UPDATED_EVENT: 'ceo-os:capture-notes-updated',
  listCaptureNotes: (...args) => repositoryState.listCaptureNotes(...args),
}));

vi.mock('../lib/journalRepository', () => ({
  getTodayJournalDateKey: (...args) => repositoryState.getTodayJournalDateKey(...args),
}));

vi.mock('../lib/notebook/notebookPagesRepository', () => ({
  NOTEBOOK_PAGES_STORAGE_KEY: 'ceo-os-notebook-pages',
  NOTEBOOK_PAGES_UPDATED_EVENT: 'ceo-os:notebook-pages-updated',
  getDailySignalEntry: (...args) => repositoryState.getDailySignalEntry(...args),
}));

vi.mock('../lib/remindersRepository', () => ({
  REMINDERS_UPDATED_EVENT: 'ceo-os:reminders-updated',
  listReminders: (...args) => repositoryState.listReminders(...args),
}));

describe('useFocusHomeSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    repositoryState.listCaptureNotes.mockReturnValue([]);
    repositoryState.getTodayJournalDateKey.mockReturnValue('2026-05-01');
    repositoryState.getDailySignalEntry.mockReturnValue(null);
    repositoryState.listReminders.mockReturnValue([]);
  });

  it('loads the current local-first signals on mount', () => {
    repositoryState.listCaptureNotes.mockReturnValue([{ id: 'note-1', text: 'Idea' }]);
    repositoryState.getDailySignalEntry.mockReturnValue({ oneNextThing: 'Send update' });
    repositoryState.listReminders.mockReturnValue([{ id: 'reminder-1', text: 'Follow up' }]);

    const { result } = renderHook(() => useFocusHomeSignals());

    expect(result.current.captureNotes).toEqual([{ id: 'note-1', text: 'Idea' }]);
    expect(result.current.journalEntry).toEqual({ oneNextThing: 'Send update' });
    expect(result.current.reminders).toEqual([{ id: 'reminder-1', text: 'Follow up' }]);
    expect(repositoryState.getDailySignalEntry).toHaveBeenCalledWith('2026-05-01');
  });

  it('refreshes the matching signal when repository update events fire', () => {
    repositoryState.listCaptureNotes.mockReturnValue([]);
    repositoryState.getDailySignalEntry.mockReturnValue(null);
    repositoryState.listReminders.mockReturnValue([]);

    const { result } = renderHook(() => useFocusHomeSignals());

    repositoryState.listCaptureNotes.mockReturnValue([{ id: 'note-2', text: 'New idea' }]);
    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:capture-notes-updated'));
    });
    expect(result.current.captureNotes).toEqual([{ id: 'note-2', text: 'New idea' }]);

    repositoryState.getDailySignalEntry.mockReturnValue({ feelsHeavy: 'Too many asks' });
    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:notebook-pages-updated'));
    });
    expect(result.current.journalEntry).toEqual({ feelsHeavy: 'Too many asks' });

    repositoryState.listReminders.mockReturnValue([{ id: 'reminder-2', text: 'Send recap' }]);
    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:reminders-updated'));
    });
    expect(result.current.reminders).toEqual([{ id: 'reminder-2', text: 'Send recap' }]);
  });

  it('refreshes all signals when focus, visibility, or relevant storage events fire', () => {
    const addWindowListener = vi.spyOn(window, 'addEventListener');
    const addDocumentListener = vi.spyOn(document, 'addEventListener');
    const capturedWindowHandlers = {};
    const capturedDocumentHandlers = {};

    addWindowListener.mockImplementation((type, listener) => {
      capturedWindowHandlers[type] = listener;
      return undefined;
    });
    addDocumentListener.mockImplementation((type, listener) => {
      capturedDocumentHandlers[type] = listener;
      return undefined;
    });

    try {
      repositoryState.listCaptureNotes.mockReturnValue([{ id: 'note-1', text: 'Initial note' }]);
      repositoryState.getDailySignalEntry.mockReturnValue({ onMyMind: 'Initial journal' });
      repositoryState.listReminders.mockReturnValue([{ id: 'reminder-1', text: 'Initial reminder' }]);

      const { result } = renderHook(() => useFocusHomeSignals());

      expect(result.current.captureNotes).toEqual([{ id: 'note-1', text: 'Initial note' }]);
      expect(typeof capturedWindowHandlers.focus).toBe('function');
      expect(typeof capturedWindowHandlers.storage).toBe('function');
      expect(typeof capturedDocumentHandlers.visibilitychange).toBe('function');

      repositoryState.listCaptureNotes.mockReturnValue([{ id: 'note-2', text: 'Focus refresh note' }]);
      repositoryState.getDailySignalEntry.mockReturnValue({ oneNextThing: 'Focus refresh journal' });
      repositoryState.listReminders.mockReturnValue([{ id: 'reminder-2', text: 'Focus refresh reminder' }]);

      act(() => {
        capturedWindowHandlers.focus();
      });

      expect(result.current.captureNotes).toEqual([{ id: 'note-2', text: 'Focus refresh note' }]);
      expect(result.current.journalEntry).toEqual({ oneNextThing: 'Focus refresh journal' });
      expect(result.current.reminders).toEqual([{ id: 'reminder-2', text: 'Focus refresh reminder' }]);

      repositoryState.listCaptureNotes.mockReturnValue([{ id: 'note-3', text: 'Storage refresh note' }]);
      repositoryState.getDailySignalEntry.mockReturnValue({ feelsHeavy: 'Storage refresh journal' });
      repositoryState.listReminders.mockReturnValue([{ id: 'reminder-3', text: 'Storage refresh reminder' }]);

      act(() => {
        capturedWindowHandlers.storage({ key: 'ceo-os-reminders' });
      });

      expect(result.current.captureNotes).toEqual([{ id: 'note-3', text: 'Storage refresh note' }]);
      expect(result.current.journalEntry).toEqual({ feelsHeavy: 'Storage refresh journal' });
      expect(result.current.reminders).toEqual([{ id: 'reminder-3', text: 'Storage refresh reminder' }]);

      repositoryState.listCaptureNotes.mockReturnValue([{ id: 'note-4', text: 'Visible refresh note' }]);
      repositoryState.getDailySignalEntry.mockReturnValue({ todaySuccess: 'Visible refresh journal' });
      repositoryState.listReminders.mockReturnValue([{ id: 'reminder-4', text: 'Visible refresh reminder' }]);

      act(() => {
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'visible',
        });
        capturedDocumentHandlers.visibilitychange();
      });

      expect(result.current.captureNotes).toEqual([{ id: 'note-4', text: 'Visible refresh note' }]);
      expect(result.current.journalEntry).toEqual({ todaySuccess: 'Visible refresh journal' });
      expect(result.current.reminders).toEqual([{ id: 'reminder-4', text: 'Visible refresh reminder' }]);
    } finally {
      addWindowListener.mockRestore();
      addDocumentListener.mockRestore();
    }
  });

  it('keeps reference identity when a sync event returns shallowly equal data', () => {
    // listCaptureNotes returns a fresh array each call, but with the same
    // contents. The hook should detect equality and avoid swapping the
    // reference — otherwise downstream memos would invalidate on every
    // focus / visibility / storage event.
    repositoryState.listCaptureNotes.mockImplementation(() => [{ id: 'note-1', text: 'Idea' }]);
    repositoryState.listReminders.mockImplementation(() => [{ id: 'r-1', text: 'Follow up' }]);
    repositoryState.getDailySignalEntry.mockImplementation(() => ({ oneNextThing: 'Send update' }));

    const { result } = renderHook(() => useFocusHomeSignals());

    const initialCaptureNotes = result.current.captureNotes;
    const initialJournalEntry = result.current.journalEntry;
    const initialReminders = result.current.reminders;

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:capture-notes-updated'));
      window.dispatchEvent(new CustomEvent('ceo-os:notebook-pages-updated'));
      window.dispatchEvent(new CustomEvent('ceo-os:reminders-updated'));
    });

    expect(result.current.captureNotes).toBe(initialCaptureNotes);
    expect(result.current.journalEntry).toBe(initialJournalEntry);
    expect(result.current.reminders).toBe(initialReminders);
  });
});

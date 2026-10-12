import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSystemPulse } from './useSystemPulse';

const repositoryState = vi.hoisted(() => ({
  listCaptureNotes: vi.fn(() => []),
  getDailySignalEntry: vi.fn(() => null),
  getTodayJournalDateKey: vi.fn(() => '2026-04-30'),
  listContentItems: vi.fn(() => Promise.resolve([])),
  listOpportunities: vi.fn(() => Promise.resolve([])),
  listReminders: vi.fn(() => []),
  buildDeterministicSuggestions: vi.fn(() => [{ id: 'next', text: 'Newest next move' }]),
  getCurrentWeekStart: vi.fn(() => '2026-04-27'),
  getWeeklyBriefByWeek: vi.fn(),
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

vi.mock('../lib/contentRepository', () => ({
  CONTENT_ITEMS_UPDATED_EVENT: 'ceo-os:content-items-updated',
  listContentItems: (...args) => repositoryState.listContentItems(...args),
}));

vi.mock('../lib/opportunitiesRepository', () => ({
  OPPORTUNITIES_UPDATED_EVENT: 'ceo-os:opportunities-updated',
  listOpportunities: (...args) => repositoryState.listOpportunities(...args),
}));

vi.mock('../lib/remindersRepository', () => ({
  REMINDERS_UPDATED_EVENT: 'ceo-os:reminders-updated',
  listReminders: (...args) => repositoryState.listReminders(...args),
}));

vi.mock('../lib/suggestions', () => ({
  buildDeterministicSuggestions: (...args) => repositoryState.buildDeterministicSuggestions(...args),
}));

vi.mock('../lib/weeklyRepository', () => ({
  WEEKLY_BRIEF_UPDATED_EVENT: 'ceo-os:weekly-brief-updated',
  getCurrentWeekStart: (...args) => repositoryState.getCurrentWeekStart(...args),
  getWeeklyBriefByWeek: (...args) => repositoryState.getWeeklyBriefByWeek(...args),
}));

function createDeferred() {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = nextResolve;
  });

  return {
    promise,
    resolve,
  };
}

describe('useSystemPulse', () => {
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    vi.clearAllMocks();
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;
    window.requestAnimationFrame = vi.fn((callback) => {
      callback(0);
      return 17;
    });
    window.cancelAnimationFrame = vi.fn();

    repositoryState.listCaptureNotes.mockReturnValue([]);
    repositoryState.getDailySignalEntry.mockReturnValue(null);
    repositoryState.getTodayJournalDateKey.mockReturnValue('2026-04-30');
    repositoryState.listContentItems.mockResolvedValue([]);
    repositoryState.listOpportunities.mockResolvedValue([]);
    repositoryState.listReminders.mockReturnValue([]);
    repositoryState.buildDeterministicSuggestions.mockReturnValue([{ id: 'next', text: 'Newest next move' }]);
    repositoryState.getCurrentWeekStart.mockReturnValue('2026-04-27');
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('ignores stale pulse responses when a newer refresh resolves first', async () => {
    const firstLoad = createDeferred();
    const secondLoad = createDeferred();

    repositoryState.getWeeklyBriefByWeek
      .mockImplementationOnce(() => firstLoad.promise)
      .mockImplementationOnce(() => secondLoad.promise);

    const { result } = renderHook(() => useSystemPulse());

    await waitFor(() => {
      expect(repositoryState.getWeeklyBriefByWeek).toHaveBeenCalledTimes(1);
    });

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:opportunities-updated'));
    });

    await waitFor(() => {
      expect(repositoryState.getWeeklyBriefByWeek).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      secondLoad.resolve({
        priorities: [{ id: 'p-2', status: 'Planned' }],
        blockers: [],
        wins: [],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.items.find((item) => item.id === 'focus')?.value).toBe('1');
    });

    await act(async () => {
      firstLoad.resolve({
        priorities: [
          { id: 'p-old-1', status: 'Planned' },
          { id: 'p-old-2', status: 'In Progress' },
        ],
        blockers: [{ id: 'b-old', text: 'Old blocker' }],
        wins: [],
      });
      await Promise.resolve();
    });

    expect(result.current.items.find((item) => item.id === 'focus')?.value).toBe('1');
    expect(result.current.items.find((item) => item.id === 'blockers')?.value).toBe('0');
    expect(result.current.nextMove).toBe('Newest next move');
  });
});

import { StrictMode, createElement } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_REVIEW_NOTES, defaultPriorities } from '../lib/weeklyData';
import { useWeeklyBrief } from './useWeeklyBrief';

const currentWeekStart = '2026-04-20';

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

vi.mock('../lib/weeklyRepository', () => ({
  WEEKLY_BRIEF_UPDATED_EVENT: 'ceo-os:weekly-brief-updated',
  createWeeklyItem: vi.fn(),
  deleteWeeklyItem: vi.fn(),
  emitWeeklyBriefUpdated: vi.fn(),
  getCurrentWeekStart: vi.fn(() => currentWeekStart),
  getWeeklyBriefByWeek: vi.fn(),
  resolveWeeklySource: vi.fn(() => 'local'),
  saveWeeklyBriefReviewNotes: vi.fn(),
  updateWeeklyItem: vi.fn(),
}));

import {
  createWeeklyItem,
  deleteWeeklyItem,
  getCurrentWeekStart,
  getWeeklyBriefByWeek,
  saveWeeklyBriefReviewNotes,
} from '../lib/weeklyRepository';

describe('useWeeklyBrief', () => {
  let originalRequestAnimationFrame;
  let originalCancelAnimationFrame;

  beforeEach(() => {
    vi.clearAllMocks();
    originalRequestAnimationFrame = window.requestAnimationFrame;
    originalCancelAnimationFrame = window.cancelAnimationFrame;

    window.requestAnimationFrame = vi.fn((callback) => {
      callback(0);
      return 7;
    });
    window.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    window.requestAnimationFrame = originalRequestAnimationFrame;
    window.cancelAnimationFrame = originalCancelAnimationFrame;
  });

  it('normalizes malformed persisted payloads on load', async () => {
    getWeeklyBriefByWeek.mockResolvedValue({
      reviewNotes: 1234,
      priorities: null,
      wins: null,
      blockers: null,
      source: 'supabase',
    });

    const { result } = renderHook(() => useWeeklyBrief());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(getCurrentWeekStart).toHaveBeenCalled();
    expect(getWeeklyBriefByWeek).toHaveBeenCalledWith(currentWeekStart);
    expect(result.current.source).toBe('supabase');
    expect(result.current.reviewNotes).toBe(DEFAULT_REVIEW_NOTES);
    expect(result.current.priorities).toEqual([]);
    expect(result.current.wins).toEqual([]);
    expect(result.current.blockers).toEqual([]);
  });

  it('normalizes setter payloads before persistence and removes deleted items', async () => {
    getWeeklyBriefByWeek.mockResolvedValue({
      reviewNotes: DEFAULT_REVIEW_NOTES,
      priorities: [...defaultPriorities],
      wins: [],
      blockers: [],
    });

    createWeeklyItem.mockResolvedValue({ id: 'created' });
    deleteWeeklyItem.mockResolvedValue(undefined);
    getCurrentWeekStart.mockReturnValue(currentWeekStart);

    const { result } = renderHook(() => useWeeklyBrief());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setPriorities(null);
    });

    await waitFor(() => {
      expect(deleteWeeklyItem).toHaveBeenCalledTimes(defaultPriorities.length);
    });

    defaultPriorities.forEach((item, index) => {
      expect(deleteWeeklyItem).toHaveBeenNthCalledWith(
        index + 1,
        expect.objectContaining({
          weekStart: currentWeekStart,
          itemType: 'priority',
          itemId: String(item.id),
          emitEvent: false,
        }),
      );
    });

    expect(result.current.priorities).toEqual([]);
  });

  it('threads expectedUpdatedAt when deleting weekly items with timestamps', async () => {
    const stampedPriority = {
      id: 'priority-stamped',
      title: 'Ship proof',
      owner: 'Jenna',
      status: 'Planned',
      updatedAt: 1777663200000,
    };
    getWeeklyBriefByWeek.mockResolvedValue({
      reviewNotes: DEFAULT_REVIEW_NOTES,
      priorities: [stampedPriority],
      wins: [],
      blockers: [],
      source: 'supabase',
    });
    deleteWeeklyItem.mockResolvedValue(undefined);

    const { result } = renderHook(() => useWeeklyBrief());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setPriorities([]);
    });

    await waitFor(() => {
      expect(deleteWeeklyItem).toHaveBeenCalledWith(
        expect.objectContaining({
          weekStart: currentWeekStart,
          itemType: 'priority',
          itemId: 'priority-stamped',
          emitEvent: false,
          expectedUpdatedAt: 1777663200000,
        }),
      );
    });
  });

  it('ignores stale weekly brief responses when a newer refresh finishes later', async () => {
    const firstLoad = createDeferred();
    const secondLoad = createDeferred();

    getWeeklyBriefByWeek
      .mockImplementationOnce(() => firstLoad.promise)
      .mockImplementationOnce(() => secondLoad.promise);

    const { result } = renderHook(() => useWeeklyBrief());

    await waitFor(() => {
      expect(getWeeklyBriefByWeek).toHaveBeenCalledTimes(1);
    });

    act(() => {
      void result.current.refreshWeeklyBrief();
    });

    await waitFor(() => {
      expect(getWeeklyBriefByWeek).toHaveBeenCalledTimes(2);
    });

    await act(async () => {
      secondLoad.resolve({
        reviewNotes: 'Newest weekly brief',
        priorities: [{ id: 'priority-2', text: 'Ship roadmap', status: 'Planned' }],
        wins: [],
        blockers: [],
        source: 'supabase',
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.reviewNotes).toBe('Newest weekly brief');
      expect(result.current.source).toBe('supabase');
    });

    await act(async () => {
      firstLoad.resolve({
        reviewNotes: 'Outdated weekly brief',
        priorities: [{ id: 'priority-1', text: 'Old plan', status: 'In Progress' }],
        wins: [],
        blockers: [],
        source: 'local',
      });
      await Promise.resolve();
    });

    expect(result.current.reviewNotes).toBe('Newest weekly brief');
    expect(result.current.priorities).toEqual([{ id: 'priority-2', text: 'Ship roadmap', status: 'Planned' }]);
    expect(result.current.source).toBe('supabase');
  });

  it('silently refreshes the current week on focus, visibility, storage, and weekly update events', async () => {
    getWeeklyBriefByWeek.mockResolvedValue({
      reviewNotes: 'Initial weekly brief',
      priorities: [{ id: 'priority-1', text: 'Initial plan', status: 'Planned' }],
      wins: [],
      blockers: [],
      source: 'local',
    });

    const addWindowListener = vi.spyOn(window, 'addEventListener');
    const addDocumentListener = vi.spyOn(document, 'addEventListener');
    const dateNowSpy = vi.spyOn(Date, 'now');
    const capturedWindowHandlers = {};
    const capturedDocumentHandlers = {};
    let nowMs = 1_000;

    dateNowSpy.mockImplementation(() => nowMs);

    addWindowListener.mockImplementation((type, listener) => {
      capturedWindowHandlers[type] = listener;
      return undefined;
    });
    addDocumentListener.mockImplementation((type, listener) => {
      capturedDocumentHandlers[type] = listener;
      return undefined;
    });

    try {
      const { result } = renderHook(() => useWeeklyBrief());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(typeof capturedWindowHandlers.focus).toBe('function');
      expect(typeof capturedWindowHandlers.storage).toBe('function');
      expect(typeof capturedWindowHandlers['ceo-os:weekly-brief-updated']).toBe('function');
      expect(typeof capturedDocumentHandlers.visibilitychange).toBe('function');

      getWeeklyBriefByWeek.mockResolvedValue({
        reviewNotes: 'Refreshed weekly brief',
        priorities: [{ id: 'priority-2', text: 'Refreshed plan', status: 'In Progress' }],
        wins: [],
        blockers: [],
        source: 'supabase',
      });

      act(() => {
        nowMs += 500;
        capturedWindowHandlers.focus();
      });

      await waitFor(() => {
        expect(result.current.reviewNotes).toBe('Refreshed weekly brief');
      });
      expect(result.current.source).toBe('supabase');
      expect(result.current.isLoading).toBe(false);

      getWeeklyBriefByWeek.mockResolvedValue({
        reviewNotes: 'Storage refresh',
        priorities: [{ id: 'priority-3', text: 'Storage plan', status: 'Blocked' }],
        wins: [],
        blockers: [],
        source: 'local',
      });

      act(() => {
        nowMs += 500;
        capturedWindowHandlers.storage({ key: 'ceo-os-weekly-briefs' });
      });

      await waitFor(() => {
        expect(result.current.reviewNotes).toBe('Storage refresh');
      });

      getWeeklyBriefByWeek.mockResolvedValue({
        reviewNotes: 'Visibility refresh',
        priorities: [{ id: 'priority-4', text: 'Visibility plan', status: 'Planned' }],
        wins: [],
        blockers: [],
        source: 'local',
      });

      act(() => {
        nowMs += 500;
        Object.defineProperty(document, 'visibilityState', {
          configurable: true,
          value: 'visible',
        });
        capturedDocumentHandlers.visibilitychange();
      });

      await waitFor(() => {
        expect(result.current.reviewNotes).toBe('Visibility refresh');
      });

      getWeeklyBriefByWeek.mockResolvedValue({
        reviewNotes: 'Event refresh',
        priorities: [{ id: 'priority-5', text: 'Event plan', status: 'Planned' }],
        wins: [],
        blockers: [],
        source: 'local',
      });

      act(() => {
        nowMs += 500;
        capturedWindowHandlers['ceo-os:weekly-brief-updated']({ detail: { weekStart: currentWeekStart } });
      });

      await waitFor(() => {
        expect(result.current.reviewNotes).toBe('Event refresh');
      });
    } finally {
      dateNowSpy.mockRestore();
      addWindowListener.mockRestore();
      addDocumentListener.mockRestore();
    }
  });

  it('recovers review notes from persisted state when a save fails', async () => {
    getWeeklyBriefByWeek
      .mockResolvedValueOnce({
        reviewNotes: 'Persisted notes',
        priorities: [],
        wins: [],
        blockers: [],
        source: 'local',
      })
      .mockResolvedValueOnce({
        reviewNotes: 'Persisted notes',
        priorities: [],
        wins: [],
        blockers: [],
        source: 'local',
      });
    saveWeeklyBriefReviewNotes.mockRejectedValueOnce(new Error('save failed'));

    const { result } = renderHook(() => useWeeklyBrief());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.reviewNotes).toBe('Persisted notes');
    });

    act(() => {
      result.current.setReviewNotes('Unsaved notes');
    });

    expect(result.current.reviewNotes).toBe('Unsaved notes');

    await waitFor(() => {
      expect(result.current.reviewNotes).toBe('Persisted notes');
    });

    expect(result.current.loadError).toBe('');
  });

  it('recovers priorities from persisted state when collection persistence fails', async () => {
    const persistedPriorities = [...defaultPriorities];
    getWeeklyBriefByWeek
      .mockResolvedValueOnce({
        reviewNotes: DEFAULT_REVIEW_NOTES,
        priorities: persistedPriorities,
        wins: [],
        blockers: [],
        source: 'local',
      })
      .mockResolvedValueOnce({
        reviewNotes: DEFAULT_REVIEW_NOTES,
        priorities: persistedPriorities,
        wins: [],
        blockers: [],
        source: 'local',
      });
    deleteWeeklyItem.mockRejectedValueOnce(new Error('delete failed'));

    const { result } = renderHook(() => useWeeklyBrief());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.priorities).toEqual(persistedPriorities);
    });

    act(() => {
      result.current.setPriorities([]);
    });

    expect(result.current.priorities).toEqual([]);

    await waitFor(() => {
      expect(result.current.priorities).toEqual(persistedPriorities);
    });

    expect(result.current.loadError).toBe('');
  });

  it('persists a collection edit exactly once under StrictMode double-invocation', async () => {
    const stampedPriority = {
      id: 'priority-strict',
      title: 'Only once',
      owner: 'Jenna',
      status: 'Planned',
      updatedAt: 1777663200000,
    };
    getWeeklyBriefByWeek.mockResolvedValue({
      reviewNotes: DEFAULT_REVIEW_NOTES,
      priorities: [stampedPriority],
      wins: [],
      blockers: [],
      source: 'local',
    });
    deleteWeeklyItem.mockResolvedValue(undefined);

    const wrapper = ({ children }) => createElement(StrictMode, null, children);
    const { result } = renderHook(() => useWeeklyBrief(), { wrapper });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setPriorities([]);
    });

    await waitFor(() => {
      expect(deleteWeeklyItem).toHaveBeenCalled();
    });

    // Persistence lives outside the setState updater, so StrictMode's dev-only
    // double-invocation of updaters must not delete the item twice. Before the
    // fix this ran the delete twice (once per updater invocation).
    expect(deleteWeeklyItem).toHaveBeenCalledTimes(1);
    expect(result.current.priorities).toEqual([]);
  });

  it('reads the latest value from the ref across batched setter calls in one tick', async () => {
    getWeeklyBriefByWeek.mockResolvedValue({
      reviewNotes: DEFAULT_REVIEW_NOTES,
      priorities: [],
      wins: [],
      blockers: [],
      source: 'local',
    });
    createWeeklyItem.mockResolvedValue({ id: 'created' });

    const { result } = renderHook(() => useWeeklyBrief());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Two functional updates in the same tick: the second must see the first's
    // result via the ref, so both items survive (append semantics).
    act(() => {
      result.current.setPriorities((current) => [...current, { id: 'p1', title: 'First', status: 'Planned' }]);
      result.current.setPriorities((current) => [...current, { id: 'p2', title: 'Second', status: 'Planned' }]);
    });

    await waitFor(() => {
      expect(result.current.priorities).toEqual([
        { id: 'p1', title: 'First', status: 'Planned' },
        { id: 'p2', title: 'Second', status: 'Planned' },
      ]);
    });
  });
});

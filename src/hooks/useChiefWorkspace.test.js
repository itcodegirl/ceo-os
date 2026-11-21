import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChiefWorkspace } from './useChiefWorkspace';

const repositoryState = {
  getChiefSource: vi.fn(),
  loadChiefWorkspace: vi.fn(),
  resetChiefWorkspace: vi.fn(),
  saveChiefNotes: vi.fn(),
};

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

vi.mock('../lib/chiefRepository', () => ({
  getChiefSource: (...args) => repositoryState.getChiefSource(...args),
  loadChiefWorkspace: (...args) => repositoryState.loadChiefWorkspace(...args),
  resetChiefWorkspace: (...args) => repositoryState.resetChiefWorkspace(...args),
  saveChiefNotes: (...args) => repositoryState.saveChiefNotes(...args),
}));

describe('useChiefWorkspace', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.sessionStorage.clear();

    repositoryState.getChiefSource.mockReturnValue('local');
    repositoryState.loadChiefWorkspace.mockResolvedValue({
      notes: 'Persisted notes',
      responses: [{ id: 'response-1', title: 'Executive Output', content: 'Saved output' }],
      source: 'local',
    });
    repositoryState.resetChiefWorkspace.mockResolvedValue(undefined);
    repositoryState.saveChiefNotes.mockResolvedValue('');
  });

  it('keeps local notes when an older workspace load resolves afterward', async () => {
    const firstLoad = createDeferred();
    repositoryState.loadChiefWorkspace.mockImplementationOnce(() => firstLoad.promise);
    const isMountedRef = { current: true };

    const { result } = renderHook(() => useChiefWorkspace({ isMountedRef }));

    act(() => {
      void result.current.loadWorkspace();
    });

    await waitFor(() => {
      expect(repositoryState.loadChiefWorkspace).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.setNotes('Draft in progress');
    });

    expect(result.current.notes).toBe('Draft in progress');
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      firstLoad.resolve({
        notes: 'Older persisted notes',
        responses: [{ id: 'response-old', title: 'Older Output', content: 'Old content' }],
        source: 'supabase',
      });
      await Promise.resolve();
    });

    expect(result.current.notes).toBe('Draft in progress');
    expect(result.current.responses).toEqual([{ id: 'response-old', title: 'Older Output', content: 'Old content' }]);
    expect(result.current.source).toBe('supabase');
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps the cleared workspace empty when an older load resolves later', async () => {
    const firstLoad = createDeferred();
    repositoryState.loadChiefWorkspace.mockImplementationOnce(() => firstLoad.promise);
    const isMountedRef = { current: true };

    const { result } = renderHook(() => useChiefWorkspace({ isMountedRef }));

    act(() => {
      void result.current.loadWorkspace();
    });

    await waitFor(() => {
      expect(repositoryState.loadChiefWorkspace).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      const didClear = await result.current.clearWorkspace();
      expect(didClear).toBe(true);
    });

    expect(result.current.notes).toBe('');
    expect(result.current.responses).toEqual([]);
    expect(result.current.isLoading).toBe(false);

    await act(async () => {
      firstLoad.resolve({
        notes: 'Reloaded old notes',
        responses: [{ id: 'response-old', title: 'Older Output', content: 'Old content' }],
        source: 'supabase',
      });
      await Promise.resolve();
    });

    expect(result.current.notes).toBe('');
    expect(result.current.responses).toEqual([]);
    expect(result.current.source).toBe('local');
    expect(result.current.isLoading).toBe(false);
  });

  it('surfaces note persistence failures without reverting the editable draft', async () => {
    repositoryState.saveChiefNotes.mockRejectedValueOnce(new Error('storage full'));
    const isMountedRef = { current: true };

    const { result } = renderHook(() => useChiefWorkspace({ isMountedRef }));

    act(() => {
      result.current.setNotes('Draft that failed to save');
    });

    expect(result.current.notes).toBe('Draft that failed to save');

    await waitFor(() => {
      expect(result.current.notesStatus).toBe('error');
    });
  });
});

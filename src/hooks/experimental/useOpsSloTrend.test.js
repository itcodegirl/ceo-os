import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/experimental/telemetry/opsSloSnapshotsRepository', () => ({
  getOpsSloSnapshotsSource: () => 'local',
  listOpsSloSnapshots: vi.fn(),
}));

import { useOpsSloTrend } from './useOpsSloTrend';
import { listOpsSloSnapshots } from '../../lib/experimental/telemetry/opsSloSnapshotsRepository';

describe('useOpsSloTrend', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads snapshots on mount', async () => {
    listOpsSloSnapshots.mockResolvedValue([
      {
        runId: 'run-1',
        capturedAt: '2026-04-22T00:00:00.000Z',
        routeTrendOutcome: 'success',
      },
    ]);

    const { result } = renderHook(() => useOpsSloTrend({ limit: 10 }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.snapshots).toHaveLength(1);
    expect(result.current.loadError).toBe('');
    expect(listOpsSloSnapshots).toHaveBeenCalledWith({ limit: 10 });
  });

  it('reports load errors without crashing', async () => {
    const onLoadError = vi.fn();
    listOpsSloSnapshots.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useOpsSloTrend({ onLoadError }));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.snapshots).toEqual([]);
    expect(result.current.loadError).toContain('Unable to load SLO trend snapshots');
    expect(onLoadError).toHaveBeenCalledWith(expect.any(Error));
  });
});

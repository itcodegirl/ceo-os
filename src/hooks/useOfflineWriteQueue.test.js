import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useOfflineWriteQueueSize } from './useOfflineWriteQueue';
import {
  OFFLINE_QUEUE_STORAGE_KEY,
  OFFLINE_QUEUE_UPDATED_EVENT,
  enqueueOfflineWrite,
  clearOfflineQueue,
} from '../lib/offlineWriteQueue';

describe('useOfflineWriteQueueSize', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await clearOfflineQueue();
  });

  afterEach(async () => {
    await clearOfflineQueue();
  });

  it('reads the persisted queue length on mount', async () => {
    await enqueueOfflineWrite({ kind: 'k', payload: 1 });
    await enqueueOfflineWrite({ kind: 'k', payload: 2 });

    const { result } = renderHook(() => useOfflineWriteQueueSize());
    expect(result.current).toBe(2);
  });

  it('updates when OFFLINE_QUEUE_UPDATED_EVENT fires', async () => {
    const { result } = renderHook(() => useOfflineWriteQueueSize());
    expect(result.current).toBe(0);

    await act(async () => {
      await enqueueOfflineWrite({ kind: 'k', payload: 1 });
    });

    expect(result.current).toBe(1);

    await act(async () => {
      await enqueueOfflineWrite({ kind: 'k', payload: 2 });
    });

    expect(result.current).toBe(2);
  });

  it('falls back to a fresh queue read when an event has no detail.size', async () => {
    const { result } = renderHook(() => useOfflineWriteQueueSize());
    await enqueueOfflineWrite({ kind: 'k', payload: 1 });
    await enqueueOfflineWrite({ kind: 'k', payload: 2 });

    await act(async () => {
      window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT));
    });

    expect(result.current).toBe(2);
  });

  it('refreshes when another tab emits a storage event for the queue key', async () => {
    const { result } = renderHook(() => useOfflineWriteQueueSize());

    await enqueueOfflineWrite({ kind: 'k', payload: 1 });
    await act(async () => {
      const event = new Event('storage');
      Object.defineProperty(event, 'key', { value: OFFLINE_QUEUE_STORAGE_KEY });
      window.dispatchEvent(event);
    });

    expect(result.current).toBe(1);
  });
});

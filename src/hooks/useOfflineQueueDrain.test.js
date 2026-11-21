import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOfflineQueueDrain } from './useOfflineQueueDrain';
import { clearOfflineQueue, enqueueOfflineWrite } from '../lib/offlineWriteQueue';

function setNavigatorOnline(value) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('useOfflineQueueDrain', () => {
  let originalDescriptor;

  beforeEach(async () => {
    originalDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
    setNavigatorOnline(true);
    await clearOfflineQueue();
  });

  afterEach(async () => {
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'onLine', originalDescriptor);
    }
    await clearOfflineQueue();
  });

  it('does nothing when the queue is empty on mount', async () => {
    const onDrainFailure = vi.fn();
    renderHook(() => useOfflineQueueDrain({ onDrainFailure }));
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(onDrainFailure).not.toHaveBeenCalled();
  });

  it('drains the queue when coming back online', async () => {
    setNavigatorOnline(false);
    await enqueueOfflineWrite({ kind: 'test', payload: { value: 1 } });

    const handler = vi.fn(() => Promise.resolve());
    const onDrainFailure = vi.fn();

    renderHook(() => useOfflineQueueDrain({
      handlerByKind: { test: handler },
      onDrainFailure,
    }));

    await act(async () => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledTimes(1);
    });
    expect(onDrainFailure).not.toHaveBeenCalled();
  });

  it('calls onDrainFailure when at least one entry fails', async () => {
    setNavigatorOnline(false);
    await enqueueOfflineWrite({ kind: 'test', payload: { value: 1 } });

    const handler = vi.fn(() => Promise.reject(new Error('network error')));
    const onDrainFailure = vi.fn();

    renderHook(() => useOfflineQueueDrain({
      handlerByKind: { test: handler },
      onDrainFailure,
    }));

    await act(async () => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(onDrainFailure).toHaveBeenCalledTimes(1);
    });
    expect(onDrainFailure).toHaveBeenCalledWith(
      expect.objectContaining({ failed: 1 }),
    );
  });

  it('does not call onDrainFailure when all entries drain successfully', async () => {
    setNavigatorOnline(false);
    await enqueueOfflineWrite({ kind: 'test', payload: 1 });
    await enqueueOfflineWrite({ kind: 'test', payload: 2 });

    const handler = vi.fn(() => Promise.resolve());
    const onDrainFailure = vi.fn();

    renderHook(() => useOfflineQueueDrain({
      handlerByKind: { test: handler },
      onDrainFailure,
    }));

    await act(async () => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(handler).toHaveBeenCalledTimes(2);
    });
    expect(onDrainFailure).not.toHaveBeenCalled();
  });

  it('does not re-enter while a drain is in flight', async () => {
    setNavigatorOnline(false);
    await enqueueOfflineWrite({ kind: 'test', payload: 1 });

    let resolveHandler;
    const handler = vi.fn(() => new Promise((resolve) => {
      resolveHandler = resolve;
    }));
    const onDrainFailure = vi.fn();

    renderHook(() => useOfflineQueueDrain({
      handlerByKind: { test: handler },
      onDrainFailure,
    }));

    await act(async () => {
      setNavigatorOnline(true);
      window.dispatchEvent(new Event('online'));
    });

    // Second online event fires while drain is still in flight.
    await act(async () => {
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    await act(async () => {
      resolveHandler();
      await Promise.resolve();
    });

    // Handler should only have been invoked once despite two online events.
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

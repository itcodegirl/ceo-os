import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSilentRefresh } from './useSilentRefresh';

describe('useSilentRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('fires onRefresh when a watched custom event is dispatched', () => {
    const onRefresh = vi.fn();
    renderHook(() => useSilentRefresh({
      events: ['ceo-os:demo-updated'],
      onRefresh,
    }));

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:demo-updated'));
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('coalesces rapid bursts within the throttle window', () => {
    const onRefresh = vi.fn();
    renderHook(() => useSilentRefresh({
      events: ['ceo-os:demo-updated'],
      onRefresh,
      coalesceMs: 250,
    }));

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:demo-updated'));
      window.dispatchEvent(new CustomEvent('ceo-os:demo-updated'));
      window.dispatchEvent(new CustomEvent('ceo-os:demo-updated'));
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('skips custom events rejected by eventFilter', () => {
    const onRefresh = vi.fn();
    const eventFilter = vi.fn((event) => event?.detail?.scope === 'mine');

    renderHook(() => useSilentRefresh({
      events: ['ceo-os:demo-updated'],
      onRefresh,
      eventFilter,
    }));

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:demo-updated', { detail: { scope: 'theirs' } }));
    });

    expect(onRefresh).not.toHaveBeenCalled();
    expect(eventFilter).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:demo-updated', { detail: { scope: 'mine' } }));
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes on storage events for watched keys and ignores other keys', () => {
    const onRefresh = vi.fn();
    renderHook(() => useSilentRefresh({
      events: [],
      storageKeys: ['ceo-os-demo-key'],
      onRefresh,
    }));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'other-key' }));
    });
    expect(onRefresh).not.toHaveBeenCalled();

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'ceo-os-demo-key' }));
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes on storage clear (null key)', () => {
    const onRefresh = vi.fn();
    renderHook(() => useSilentRefresh({
      events: [],
      storageKeys: ['ceo-os-demo-key'],
      onRefresh,
    }));

    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: null }));
    });

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('refreshes when the document becomes visible', () => {
    const onRefresh = vi.fn();
    renderHook(() => useSilentRefresh({ events: [], onRefresh }));

    const visibilityDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });

    try {
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });

      expect(onRefresh).toHaveBeenCalledTimes(1);
    } finally {
      if (visibilityDescriptor) {
        Object.defineProperty(document, 'visibilityState', visibilityDescriptor);
      }
    }
  });

  it('unsubscribes on unmount', () => {
    const onRefresh = vi.fn();
    const { unmount } = renderHook(() => useSilentRefresh({
      events: ['ceo-os:demo-updated'],
      onRefresh,
    }));

    unmount();

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:demo-updated'));
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('respects the enabled: false flag and does not subscribe', () => {
    const onRefresh = vi.fn();
    renderHook(() => useSilentRefresh({
      events: ['ceo-os:demo-updated'],
      onRefresh,
      enabled: false,
    }));

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:demo-updated'));
    });

    expect(onRefresh).not.toHaveBeenCalled();
  });

  it('bypasses the coalesce window for forceEvents', () => {
    const onRefresh = vi.fn();
    renderHook(() => useSilentRefresh({
      events: ['ceo-os:save'],
      forceEvents: ['ceo-os:save'],
      onRefresh,
      coalesceMs: 500,
    }));

    act(() => {
      window.dispatchEvent(new CustomEvent('ceo-os:save'));
      window.dispatchEvent(new CustomEvent('ceo-os:save'));
      window.dispatchEvent(new CustomEvent('ceo-os:save'));
    });

    expect(onRefresh).toHaveBeenCalledTimes(3);
  });
});

describe('last update in a refresh burst', () => {
  it('delivers a trailing refresh so the newest cross-tab value is not missed', () => {
    vi.useFakeTimers();
    const read = vi.fn();
    const { unmount } = renderHook(() => useSilentRefresh({ storageKeys: ['watched'], onRefresh: read, coalesceMs: 400 }));
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'watched' })));
    act(() => { vi.advanceTimersByTime(100); window.dispatchEvent(new StorageEvent('storage', { key: 'watched' })); });
    expect(read).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(300));
    expect(read).toHaveBeenCalledTimes(2);
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: 'watched' })));
    unmount(); vi.advanceTimersByTime(1000);
    expect(read).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

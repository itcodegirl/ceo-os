import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRoutePrefetch } from './useRoutePrefetch';

// The hook is a no-op in the test environment (import.meta.env.TEST) so
// unit tests don't pull in unrelated route bundles when Dashboard mounts.
// We assert that gate first, then exercise the production-path branches by
// stubbing import.meta.env.TEST to false for the remaining cases.

describe('useRoutePrefetch — test-env guard', () => {
  it('is a no-op when import.meta.env.TEST is truthy (the default in vitest)', () => {
    const importer = vi.fn();
    renderHook(() => useRoutePrefetch([importer]));
    expect(importer).not.toHaveBeenCalled();
  });
});

describe('useRoutePrefetch — production path', () => {
  let originalConnection;
  let originalRic;
  let originalCic;

  beforeEach(() => {
    // Vitest's import.meta.env.TEST is read-only at runtime; vi.stubEnv is
    // the supported way to flip it for the duration of a test.
    vi.stubEnv('TEST', '');

    originalConnection = navigator.connection;
    originalRic = window.requestIdleCallback;
    originalCic = window.cancelIdleCallback;

    // Force the setTimeout fallback path so the schedule fires under fake timers.
    delete window.requestIdleCallback;
    delete window.cancelIdleCallback;

    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: originalConnection,
    });
    if (originalRic) window.requestIdleCallback = originalRic;
    if (originalCic) window.cancelIdleCallback = originalCic;
  });

  it('invokes each importer once after the idle/timeout window elapses', () => {
    const a = vi.fn(() => Promise.resolve());
    const b = vi.fn(() => Promise.resolve());

    renderHook(() => useRoutePrefetch([a, b]));
    expect(a).not.toHaveBeenCalled();
    vi.advanceTimersByTime(200);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('swallows importer promise rejections so a failed prefetch never surfaces', () => {
    const ok = vi.fn(() => Promise.resolve());
    const fail = vi.fn(() => Promise.reject(new Error('chunk gone')));

    renderHook(() => useRoutePrefetch([ok, fail]));
    expect(() => vi.advanceTimersByTime(200)).not.toThrow();
    expect(ok).toHaveBeenCalled();
    expect(fail).toHaveBeenCalled();
  });

  it('skips prefetch when navigator.connection.saveData is true', () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: true, effectiveType: '4g' },
    });
    const importer = vi.fn();
    renderHook(() => useRoutePrefetch([importer]));
    vi.advanceTimersByTime(500);
    expect(importer).not.toHaveBeenCalled();
  });

  it('skips prefetch on slow-2g / 2g effective connection', () => {
    Object.defineProperty(navigator, 'connection', {
      configurable: true,
      value: { saveData: false, effectiveType: 'slow-2g' },
    });
    const importer = vi.fn();
    renderHook(() => useRoutePrefetch([importer]));
    vi.advanceTimersByTime(500);
    expect(importer).not.toHaveBeenCalled();
  });

  it('handles an empty importer list cleanly (no scheduled work)', () => {
    expect(() => {
      renderHook(() => useRoutePrefetch([]));
      vi.advanceTimersByTime(500);
    }).not.toThrow();
  });
});

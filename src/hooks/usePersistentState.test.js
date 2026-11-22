import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';
import { usePersistentState } from './usePersistentState';
import { STORAGE_CORRUPTION_EVENT } from '../lib/storageCorruption';

describe('usePersistentState', () => {
  const storageKey = 'ceo-os-test-persistent-state';

  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('initializes from localStorage or fallback value', () => {
    window.localStorage.setItem(storageKey, JSON.stringify({ user: 'Alice' }));

    const { result } = renderHook(() => usePersistentState(storageKey, { user: 'Default' }));

    expect(result.current[0]).toEqual({ user: 'Alice' });
  });

  it('persists updates and supports function updaters', async () => {
    const { result } = renderHook(() => usePersistentState(storageKey, 0));

    act(() => {
      result.current[1](3);
    });

    expect(result.current[0]).toBe(3);
    expect(window.localStorage.getItem(storageKey)).toBe(JSON.stringify(3));

    act(() => {
      result.current[1]((value) => value + 2);
    });

    expect(result.current[0]).toBe(5);
    await waitFor(() => {
      expect(window.localStorage.getItem(storageKey)).toBe(JSON.stringify(5));
    });
  });

  it('syncs updates from storage events', async () => {
    const { result } = renderHook(() => usePersistentState(storageKey, ''));

    act(() => {
      const storageEvent = new Event('storage');

      Object.defineProperty(storageEvent, 'storageArea', { value: window.localStorage });
      Object.defineProperty(storageEvent, 'key', { value: storageKey });
      Object.defineProperty(storageEvent, 'newValue', { value: JSON.stringify('Remote update') });

      window.dispatchEvent(
        storageEvent,
      );
    });

    await waitFor(() => {
      expect(result.current[0]).toBe('Remote update');
    });
  });

  it('keeps a tab draft through external saves, navigation, and reloads', () => {
    localStorage.setItem(storageKey, JSON.stringify('Recovered draft'));
    const first = renderHook(() => usePersistentState(storageKey, '', { tabDraft: true }));
    expect(first.result.current[0]).toBe('Recovered draft');
    act(() => first.result.current[1]('My unfinished thought'));
    act(() => {
      localStorage.setItem(storageKey, JSON.stringify(''));
      const event = new Event('storage');
      Object.defineProperties(event, {
        storageArea: { value: localStorage }, key: { value: storageKey }, newValue: { value: '""' },
      });
      window.dispatchEvent(event);
      window.dispatchEvent(new CustomEvent('ceo-os:persistent-state', { detail: { key: storageKey, value: '' } }));
    });
    expect(first.result.current[0]).toBe('My unfinished thought');
    first.unmount();
    const reloaded = renderHook(() => usePersistentState(storageKey, '', { tabDraft: true }));
    expect(reloaded.result.current[0]).toBe('My unfinished thought');
    act(() => reloaded.result.current[1](''));
    expect(sessionStorage.getItem(storageKey)).toBe('""');
  });

  it('syncs updates from in-page persistent-state events', async () => {
    const { result } = renderHook(() => usePersistentState(storageKey, ''));

    act(() => {
      window.dispatchEvent(
        new CustomEvent('ceo-os:persistent-state', {
          detail: {
            key: storageKey,
            value: { team: 'Founder' },
          },
        }),
      );
    });

    await waitFor(() => {
      expect(result.current[0]).toStrictEqual({ team: 'Founder' });
    });
  });

  it('preserves a corrupted localStorage payload and emits a recovery event', async () => {
    const corruptKey = 'ceo-os-test-corrupt-load';
    window.localStorage.setItem(corruptKey, '{not valid json');

    const events = [];
    const listener = (event) => events.push(event.detail);
    window.addEventListener(STORAGE_CORRUPTION_EVENT, listener);

    try {
      const { result } = renderHook(() => usePersistentState(corruptKey, 'fallback'));
      expect(result.current[0]).toBe('fallback');
    } finally {
      window.removeEventListener(STORAGE_CORRUPTION_EVENT, listener);
    }

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ key: corruptKey });
    expect(typeof events[0].backupKey).toBe('string');
    expect(window.localStorage.getItem(events[0].backupKey)).toBe('{not valid json');
  });

  it('reloads state when the storage key changes without leaking the previous value', async () => {
    window.localStorage.setItem('ceo-os-secondary-persistent-state', JSON.stringify('Secondary value'));

    const { result, rerender } = renderHook(
      ({ activeKey }) => usePersistentState(activeKey, ''),
      {
        initialProps: {
          activeKey: storageKey,
        },
      },
    );

    act(() => {
      result.current[1]('Primary value');
    });

    await waitFor(() => {
      expect(window.localStorage.getItem(storageKey)).toBe(JSON.stringify('Primary value'));
    });

    rerender({ activeKey: 'ceo-os-secondary-persistent-state' });

    await waitFor(() => {
      expect(result.current[0]).toBe('Secondary value');
    });

    expect(window.localStorage.getItem('ceo-os-secondary-persistent-state')).toBe(
      JSON.stringify('Secondary value'),
    );
  });
});

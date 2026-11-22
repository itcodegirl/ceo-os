import { useEffect, useRef } from 'react';

const DEFAULT_COALESCE_MS = 400;
// Module-level empty defaults so callers that omit these props don't get a
// fresh array on every render (which would invalidate the subscription
// effect's deps and re-attach all listeners on every rerender).
const EMPTY_EVENT_LIST = Object.freeze([]);
const EMPTY_STORAGE_KEY_LIST = Object.freeze([]);
const EMPTY_FORCE_EVENT_LIST = Object.freeze([]);

/**
 * Shared "refresh this surface when nearby state changes" effect that the
 * data-orchestrator hooks used to re-implement four times.
 *
 * Subscribes to:
 *   - Each custom event name in `events` (typically a domain's
 *     `*_UPDATED_EVENT`).
 *   - `window.storage` events with a configurable key filter so the hook
 *     reacts only to changes in keys it cares about (a `null` key fires when
 *     the entire localStorage is cleared and is always honored).
 *   - `window.focus` and `document.visibilitychange` so a tab returning to
 *     the foreground refreshes its data.
 *
 * Calls `onRefresh` after coalescing rapid bursts within `coalesceMs`. Use
 * `eventFilter` to skip custom events that don't apply (e.g. a weekly-brief
 * event for a different `weekStart`).
 *
 * `forceEvents` lists custom event names that should bypass the coalesce
 * window. The settings-updated event is a good example: it only fires from
 * intentional in-app saves and the user expects each save to trigger a
 * refresh, even when two saves land within the throttle window.
 *
 * The hook is purely a subscription manager — `onRefresh` is captured via a
 * ref so the caller's effects can recreate the callback without churning
 * subscriptions.
 */
export function useSilentRefresh({
  events = EMPTY_EVENT_LIST,
  storageKeys = EMPTY_STORAGE_KEY_LIST,
  forceEvents = EMPTY_FORCE_EVENT_LIST,
  eventFilter,
  onRefresh,
  coalesceMs = DEFAULT_COALESCE_MS,
  enabled = true,
}) {
  const onRefreshRef = useRef(onRefresh);
  const eventFilterRef = useRef(eventFilter);
  const lastFireAtRef = useRef(0);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    eventFilterRef.current = eventFilter;
  }, [eventFilter]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') {
      return undefined;
    }

    const watchedKeys = Array.isArray(storageKeys) ? new Set(storageKeys) : null;
    const customEventNames = Array.isArray(events) ? events : [];
    const forcedEventNames = new Set(Array.isArray(forceEvents) ? forceEvents : []);

    let trailingTimer;
    const deliver = () => {
      window.clearTimeout(trailingTimer);
      trailingTimer = undefined;
      lastFireAtRef.current = Date.now();
      onRefreshRef.current?.();
    };
    const fireRefresh = (event) => {
      if (typeof onRefreshRef.current !== 'function') {
        return;
      }

      if (event && typeof eventFilterRef.current === 'function') {
        if (eventFilterRef.current(event) === false) {
          return;
        }
      }

      // forceEvents bypass the coalesce window so intentional in-app saves
      // always trigger a refresh, even when two saves land within the same
      // throttle slice.
      const isForced = Boolean(event && event.type && forcedEventNames.has(event.type));
      const now = Date.now();
      if (!isForced && now - lastFireAtRef.current < coalesceMs) {
        if (trailingTimer === undefined) trailingTimer = window.setTimeout(deliver, coalesceMs - (now - lastFireAtRef.current));
        return;
      }
      deliver();
    };

    const handleStorageChange = (storageEvent) => {
      const key = storageEvent?.key;
      // A `null` key fires on `localStorage.clear()` — always treat as a
      // refresh signal. Otherwise check the watch list (or refresh if the
      // caller didn't specify any storage keys to filter on).
      if (
        key === null
        || !watchedKeys
        || watchedKeys.size === 0
        || watchedKeys.has(key)
      ) {
        fireRefresh();
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'visible') {
        return;
      }
      fireRefresh();
    };

    const handleFocus = () => fireRefresh();

    customEventNames.forEach((eventName) => {
      window.addEventListener(eventName, fireRefresh);
    });
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', handleFocus);
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      window.clearTimeout(trailingTimer);
      customEventNames.forEach((eventName) => {
        window.removeEventListener(eventName, fireRefresh);
      });
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', handleFocus);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
    // events / storageKeys / forceEvents / coalesceMs / enabled are part of
    // the subscription contract — recreate the effect if they change.
    // Callers should keep them stable across renders (top-level constants).
  }, [coalesceMs, enabled, events, forceEvents, storageKeys]);
}

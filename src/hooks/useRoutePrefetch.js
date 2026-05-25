import { useEffect } from 'react';

/**
 * Returns true when the browser is in a state where prefetching is rude —
 * data-saver enabled, or on a slow connection. Used by useRoutePrefetch to
 * skip the warm-up entirely.
 */
function shouldSkipPrefetch() {
  if (typeof navigator === 'undefined') return true;
  const connection = navigator.connection
    || navigator.mozConnection
    || navigator.webkitConnection;
  if (!connection) return false;
  if (connection.saveData) return true;
  if (connection.effectiveType === '2g' || connection.effectiveType === 'slow-2g') return true;
  return false;
}

/**
 * Warm up likely-next route chunks during browser idle time, so the first
 * inter-route navigation doesn't pay the full lazy-load round-trip. The
 * caller passes an array of import functions (each a `() => import('./X')`).
 * The hook fires them once the page is mostly idle.
 *
 *   useRoutePrefetch([
 *     () => import('./Capture'),
 *     () => import('./ChiefOfStaff'),
 *   ]);
 *
 * Importers should be defined at module scope (stable reference) so the
 * effect only runs once per mount. The hook is a no-op when:
 *   - the test environment is detected (vitest's import.meta.env.TEST),
 *     so unit tests don't accidentally pull in other route bundles
 *   - `navigator.connection.saveData` is true (Data Saver)
 *   - the effective connection is slow-2g / 2g
 *
 * Import failures are swallowed — prefetch is a hint, not a contract.
 */
export function useRoutePrefetch(importers) {
  useEffect(() => {
    if (import.meta.env?.TEST) {
      return undefined;
    }
    if (!Array.isArray(importers) || importers.length === 0) {
      return undefined;
    }
    if (shouldSkipPrefetch()) {
      return undefined;
    }
    if (typeof window === 'undefined') {
      return undefined;
    }

    const schedule = typeof window.requestIdleCallback === 'function'
      ? (cb) => window.requestIdleCallback(cb)
      : (cb) => window.setTimeout(cb, 200);
    const cancel = typeof window.cancelIdleCallback === 'function'
      ? (handle) => window.cancelIdleCallback(handle)
      : (handle) => window.clearTimeout(handle);

    const handle = schedule(() => {
      for (const importer of importers) {
        if (typeof importer !== 'function') continue;
        try {
          const result = importer();
          if (result && typeof result.catch === 'function') {
            result.catch(() => {
              // prefetch is a hint, not a contract; swallow.
            });
          }
        } catch {
          // import() throwing synchronously is rare; ignore either way.
        }
      }
    });

    return () => cancel(handle);
  }, [importers]);
}

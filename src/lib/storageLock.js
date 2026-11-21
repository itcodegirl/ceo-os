// Web Locks coordinate read/modify/write transactions across tabs on this origin.
// Refuse unsafe mutations if coordination is unavailable; never silently race.
export function withStorageLock(name, work, options = {}) {
  if (!globalThis.navigator?.locks?.request) {
    return Promise.reject(Object.assign(new Error('This browser cannot safely coordinate recovery or pending writes. Keep this tab open and use a current browser to retry.'), {
      code: 'STORAGE_COORDINATION_UNAVAILABLE',
    }));
  }
  return navigator.locks.request(`ceo-os:${name}`, { mode: 'exclusive', ...options }, (lock) => lock ? work() : null);
}

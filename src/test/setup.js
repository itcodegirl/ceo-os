import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

function createStorageMock() {
  const store = new Map();

  return {
    get length() { return store.size; },
    key(index) { return [...store.keys()][index] ?? null; },
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(String(key), String(value));
    },
    removeItem(key) {
      store.delete(String(key));
    },
    clear() {
      store.clear();
    },
  };
}

Object.defineProperty(window, 'localStorage', {
  value: createStorageMock(),
  configurable: true,
});

afterEach(() => {
  cleanup();
});

// jsdom has no Web Locks; emulate the native lock contract for storage tests.
const locks = new Map();
Object.defineProperty(navigator, 'locks', { configurable: true, value: {
  request(name, options, callback) {
    if (options.ifAvailable && locks.has(name)) return Promise.resolve(callback(null));
    const pending = (locks.get(name) || Promise.resolve()).catch(() => {}).then(() => callback({ name }));
    locks.set(name, pending);
    const clean = () => { if (locks.get(name) === pending) locks.delete(name); };
    pending.then(clean, clean);
    return pending;
  },
} });

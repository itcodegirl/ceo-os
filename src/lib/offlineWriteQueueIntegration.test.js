import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  shouldEnqueueWriteFailure,
  tryRemoteOrEnqueue,
} from './offlineWriteQueueIntegration';
import {
  clearOfflineQueue,
  getOfflineQueue,
} from './offlineWriteQueue';
import { StaleRecordError } from './staleRecordError';

function setNavigatorOnline(value) {
  Object.defineProperty(navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('shouldEnqueueWriteFailure', () => {
  let originalDescriptor;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
    setNavigatorOnline(true);
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'onLine', originalDescriptor);
    }
  });

  it('queues transient HTTP failures but leaves permanent HTTP errors for user correction', () => {
    expect(shouldEnqueueWriteFailure({ status: 503, message: 'Service unavailable' })).toBe(true);
    expect(shouldEnqueueWriteFailure({ status: 429 })).toBe(true);
    expect(shouldEnqueueWriteFailure({ status: 403 })).toBe(false);
  });

  it('returns false for falsy errors', () => {
    expect(shouldEnqueueWriteFailure(null)).toBe(false);
    expect(shouldEnqueueWriteFailure(undefined)).toBe(false);
  });

  it('never enqueues StaleRecordError', () => {
    setNavigatorOnline(false);
    expect(shouldEnqueueWriteFailure(new StaleRecordError())).toBe(false);
  });

  it('enqueues when navigator reports offline regardless of error shape', () => {
    setNavigatorOnline(false);
    expect(shouldEnqueueWriteFailure(new Error('weird message'))).toBe(true);
  });

  it('enqueues TypeError (fetch network blip)', () => {
    expect(shouldEnqueueWriteFailure(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('enqueues errors whose message looks transient', () => {
    expect(shouldEnqueueWriteFailure(new Error('fetch failed'))).toBe(true);
    expect(shouldEnqueueWriteFailure(new Error('Network error'))).toBe(true);
    expect(shouldEnqueueWriteFailure(new Error('Request timed out'))).toBe(true);
  });

  it('does NOT enqueue server-side errors with permanent messages', () => {
    expect(shouldEnqueueWriteFailure({ message: 'permission denied for table' })).toBe(false);
    expect(shouldEnqueueWriteFailure({ message: 'duplicate key value violates' })).toBe(false);
  });
});

describe('tryRemoteOrEnqueue', () => {
  let originalDescriptor;

  beforeEach(() => {
    originalDescriptor = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
    setNavigatorOnline(true);
    clearOfflineQueue();
    window.localStorage.clear();
  });

  afterEach(() => {
    clearOfflineQueue();
    if (originalDescriptor) {
      Object.defineProperty(navigator, 'onLine', originalDescriptor);
    }
  });

  it('returns the attempt result on success without queueing', async () => {
    const attempt = () => Promise.resolve({ id: 'X' });
    const result = await tryRemoteOrEnqueue(
      { kind: 'opportunity:create', payload: { name: 'A' } },
      attempt,
    );
    expect(result).toEqual({ id: 'X' });
    expect(getOfflineQueue()).toHaveLength(0);
  });

  it('enqueues on transient failure and re-throws the error', async () => {
    setNavigatorOnline(false);
    const error = new Error('Failed to fetch');
    const attempt = () => Promise.reject(error);

    await expect(
      tryRemoteOrEnqueue(
        { kind: 'opportunity:create', payload: { name: 'A' } },
        attempt,
      ),
    ).rejects.toBe(error);

    const queue = getOfflineQueue();
    expect(queue).toHaveLength(1);
    expect(queue[0]).toMatchObject({
      kind: 'opportunity:create',
      payload: { name: 'A' },
    });
  });

  it('does not enqueue when StaleRecordError is thrown', async () => {
    const stale = new StaleRecordError();
    const attempt = () => Promise.reject(stale);

    await expect(
      tryRemoteOrEnqueue(
        { kind: 'opportunity:update', payload: { id: '1' } },
        attempt,
      ),
    ).rejects.toBe(stale);
    expect(getOfflineQueue()).toHaveLength(0);
  });

  it('skips enqueue when options.skipQueue is true (used by drain replays)', async () => {
    setNavigatorOnline(false);
    const error = new Error('Failed to fetch');
    const attempt = () => Promise.reject(error);

    await expect(
      tryRemoteOrEnqueue(
        {
          kind: 'opportunity:create',
          payload: { name: 'A' },
          options: { skipQueue: true },
        },
        attempt,
      ),
    ).rejects.toBe(error);
    expect(getOfflineQueue()).toHaveLength(0);
  });
});

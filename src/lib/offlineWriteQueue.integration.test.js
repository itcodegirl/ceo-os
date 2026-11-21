import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearOfflineQueue,
  drainOfflineQueue,
  enqueueOfflineWrite,
  getOfflineQueue,
  retryOfflineWrite,
} from './offlineWriteQueue';

/**
 * Worked-example test: shows how a repository integrates the offline write
 * queue. This is the contract repository code will follow once the
 * Supabase paths are wired in a follow-up. Keeping it as a test makes the
 * intended shape executable and prevents the queue's API from drifting.
 */
describe('offlineWriteQueue integration shape', () => {
  beforeEach(async () => {
    window.localStorage.clear();
    await clearOfflineQueue();
  });

  afterEach(async () => {
    await clearOfflineQueue();
  });

  it('replays queued writes in the order they were enqueued', async () => {
    await enqueueOfflineWrite({ kind: 'opportunity:create', payload: { name: 'First' } });
    await enqueueOfflineWrite({ kind: 'opportunity:create', payload: { name: 'Second' } });
    await enqueueOfflineWrite({ kind: 'opportunity:create', payload: { name: 'Third' } });

    const seen = [];
    const handler = vi.fn((payload) => {
      seen.push(payload.name);
      return Promise.resolve({ id: payload.name });
    });

    const result = await drainOfflineQueue({ 'opportunity:create': handler });

    expect(result).toEqual({ drained: 3, failed: 0, remaining: 0 });
    expect(seen).toEqual(['First', 'Second', 'Third']);
    expect(getOfflineQueue()).toEqual([]);
  });

  it('continues unrelated work and retries a failed action explicitly', async () => {
    const a = await enqueueOfflineWrite({ kind: 'opportunity:create', payload: { name: 'A' } });
    await enqueueOfflineWrite({ kind: 'opportunity:create', payload: { name: 'B' } });
    const handler = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue();
    expect(await drainOfflineQueue({ 'opportunity:create': handler })).toEqual({ drained: 1, failed: 1, remaining: 1 });
    await retryOfflineWrite(a.id);
    expect(await drainOfflineQueue({ 'opportunity:create': handler })).toEqual({ drained: 1, failed: 0, remaining: 0 });
  });

  it('routes payloads to handlers by kind so multiple repositories can coexist on one queue', async () => {
    await enqueueOfflineWrite({ kind: 'opportunity:create', payload: { id: 'opp-1', name: 'A' } });
    await enqueueOfflineWrite({ kind: 'content:create', payload: { id: 'content-1' } });
    await enqueueOfflineWrite({ kind: 'opportunity:create', payload: { id: 'opp-2', name: 'B' } });

    const opportunityHandler = vi.fn().mockResolvedValue();
    const contentHandler = vi.fn().mockResolvedValue();

    const result = await drainOfflineQueue({
      'opportunity:create': opportunityHandler,
      'content:create': contentHandler,
    });

    expect(result.drained).toBe(3);
    expect(opportunityHandler).toHaveBeenCalledTimes(2);
    expect(contentHandler).toHaveBeenCalledTimes(1);
    expect(opportunityHandler.mock.calls.map(([payload]) => payload.id)).toEqual(['opp-1', 'opp-2']);
    expect(contentHandler.mock.calls[0][0].id).toBe('content-1');
  });
});

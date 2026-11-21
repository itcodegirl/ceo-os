import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OFFLINE_QUEUE_STORAGE_KEY as KEY, enqueueOfflineWrite as enqueue, getOfflineQueue as read,
  drainOfflineQueue as drain, retryOfflineWrite, discardOfflineWrite } from './offlineWriteQueue';

describe('durable offline queue', () => {
  beforeEach(() => localStorage.clear());
  it('serializes simultaneous enqueues without losing either write', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, payload) => enqueue({ kind: 'update', payload })));
    expect(read().map((entry) => entry.payload).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i));
  });
  it('deduplicates an unchanged create intent, preserving its original server id', async () => {
    const first = await enqueue({ kind: 'opportunity:create', payload: { name: 'A', id: 'first' } });
    const second = await enqueue({ kind: 'opportunity:create', payload: { id: 'retry', name: 'A' } });
    expect(second.id).toBe(first.id);
    expect(read()).toHaveLength(1);
    expect(read()[0].payload.id).toBe('first');
  });
  it('refuses overflow without evicting the oldest pending work', async () => {
    for (let payload = 0; payload < 200; payload++) await enqueue({ kind: 'k', payload });
    await expect(enqueue({ kind: 'k', payload: 200 })).rejects.toMatchObject({ code: 'QUEUE_FULL' });
    expect(read()).toHaveLength(200);
    expect(read()[0].payload).toBe(0);
  });
  it('reports a failed durable write instead of claiming the draft was queued', async () => {
    vi.spyOn(localStorage, 'setItem').mockImplementationOnce(() => { throw new Error('quota'); });
    await expect(enqueue({ kind: 'k', payload: 1 })).rejects.toMatchObject({ code: 'QUEUE_STORAGE_FAILED' });
    expect(read()).toEqual([]);
  });
  it('rejects missing action types', async () => {
    await expect(enqueue({ payload: {} })).rejects.toMatchObject({ code: 'QUEUE_INVALID' });
  });
  it('blocks poison entries while allowing unrelated later actions to finish', async () => {
    await enqueue({ kind: 'unsupported', payload: {} });
    await enqueue({ kind: 'update', payload: { id: 'a', text: 'first' } });
    await enqueue({ kind: 'update', payload: { id: 'a', text: 'second' } });
    await enqueue({ kind: 'update', payload: { id: 'b' } });
    const update = vi.fn(async (payload) => { if (payload.id === 'a') throw Object.assign(new Error('conflict'), { code: 'STALE_RECORD' }); });
    expect(await drain({ update })).toEqual({ drained: 1, failed: 2, remaining: 3 });
    expect(update).toHaveBeenCalledTimes(2);
    expect(read().map((entry) => entry.status)).toEqual(['blocked', 'blocked', 'pending']);
    await drain({ update });
    expect(update).toHaveBeenCalledTimes(2);
  });
  it('backs off transient failures and stops after five attempts until explicitly retried', async () => {
    const entry = await enqueue({ kind: 'k', payload: 1 });
    const handler = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await drain({ k: handler });
    await drain({ k: handler });
    expect(handler).toHaveBeenCalledTimes(1);
    for (let attempt = 1; attempt < 5; attempt++) {
      const queue = read(); queue[0].nextAttemptAt = 0; localStorage.setItem(KEY, JSON.stringify(queue));
      await drain({ k: handler });
    }
    expect(read()[0]).toMatchObject({ status: 'blocked', attempts: 5 });
    await retryOfflineWrite(entry.id);
    expect(read()[0]).toMatchObject({ status: 'pending', attempts: 0 });
    expect(await drain({ k: vi.fn().mockResolvedValue() })).toEqual({ drained: 1, failed: 0, remaining: 0 });
  });
  it('allows only one drainer and waits for an in-flight request before discarding', async () => {
    const entry = await enqueue({ kind: 'k', payload: 1 });
    let finish;
    const handler = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    const first = drain({ k: handler });
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
    expect((await drain({ k: handler })).drained).toBe(0);
    const discard = discardOfflineWrite(entry.id);
    finish();
    await first; await discard;
    expect(handler).toHaveBeenCalledTimes(1);
    expect(read()).toEqual([]);
  });
  it('persists a stable id for legacy creates before replay, including a lost acknowledgement', async () => {
    await enqueue({ kind: 'opportunity:create', payload: { name: 'Legacy' } });
    const ids = [];
    await drain({ 'opportunity:create': async (payload) => { ids.push(payload.id); throw new TypeError('connection lost'); } });
    await retryOfflineWrite(read()[0].id);
    await drain({ 'opportunity:create': async (payload) => { ids.push(payload.id); } });
    expect(ids[0]).toBeTruthy(); expect(ids[1]).toBe(ids[0]);
  });
  it('does not replay another account or ownerless legacy work', async () => {
    localStorage.setItem(KEY, JSON.stringify([{ id: 'old', kind: 'k', payload: 1 }]));
    await enqueue({ kind: 'k', payload: 2, ownerId: 'other-account' });
    const handler = vi.fn(); await drain({ k: handler });
    expect(handler).not.toHaveBeenCalled(); expect(read()).toHaveLength(2);
    await expect(discardOfflineWrite(read()[1].id)).rejects.toMatchObject({ code: 'QUEUE_OWNER' });
  });
});

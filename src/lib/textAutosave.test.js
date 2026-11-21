import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { createTextAutosave } from './textAutosave';

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};

describe('text autosave recovery and ordering', () => {
  beforeEach(() => { sessionStorage.clear(); vi.useFakeTimers(); });
  afterEach(() => vi.useRealTimers());

  it('serializes slow saves and never marks a newer draft saved on an older acknowledgement', async () => {
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const draft = createTextAutosave({ key: 'ordering', save });
    draft.set('first');
    await vi.advanceTimersByTimeAsync(600);
    draft.set('second');
    await vi.advanceTimersByTimeAsync(600);
    expect(save).toHaveBeenCalledTimes(1);
    expect(draft.getSnapshot()).toEqual({ value: 'second', status: 'saving' });
    first.resolve();
    await draft.flush();
    expect(save.mock.calls.map(([value]) => value)).toEqual(['first', 'second']);
    expect(draft.getSnapshot()).toEqual({ value: 'second', status: 'saved' });
  });

  it('flushes pending text on departure and orders it before writes from the next mount', async () => {
    const first = deferred();
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
    const old = createTextAutosave({ key: 'navigation', save });
    old.set('leaving immediately');
    const oldWrite = old.flush();
    const next = createTextAutosave({ key: 'navigation', save });
    next.receive('old server text');
    expect(next.getSnapshot().value).toBe('leaving immediately');
    next.set('new page edit');
    const newWrite = next.flush();
    first.resolve();
    await Promise.all([oldWrite, newWrite]);
    expect(save.mock.calls.map(([value]) => value)).toEqual(['leaving immediately', 'new page edit']);
    expect(sessionStorage.getItem('ceo-os:draft:navigation')).toBeNull();
  });

  it('retains a failed draft across reload and retries the draft rather than the server value', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
    const draft = createTextAutosave({ key: 'recovery', save });
    draft.set('do not lose me');
    expect(await draft.flush()).toBe(false);
    draft.receive('older saved text');
    expect(draft.getSnapshot()).toEqual({ value: 'do not lose me', status: 'error' });
    const reopened = createTextAutosave({ key: 'recovery', save });
    expect(reopened.getSnapshot().value).toBe('do not lose me');
    expect(await reopened.flush()).toBe(true);
    expect(save).toHaveBeenLastCalledWith('do not lose me');
  });

  it('rejects a load started before an edit or a recovered draft acknowledgement', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const draft = createTextAutosave({ key: 'read-race', save });
    draft.set('current');
    const reopened = createTextAutosave({ key: 'read-race', save });
    const loadRevision = reopened.getRevision();
    await reopened.flush();
    reopened.receive('stale read', loadRevision);
    expect(reopened.getSnapshot().value).toBe('current');
    await draft.flush();
  });

  it('keeps recovery drafts separate by account and week', () => {
    sessionStorage.setItem('ceo-os:draft:weekly:a:2026-11-16', JSON.stringify({ value: 'private', token: 'a' }));
    expect(createTextAutosave({ key: 'weekly:b:2026-11-16', save: vi.fn() }).getSnapshot().value).toBe('');
    expect(createTextAutosave({ key: 'weekly:a:2026-11-23', save: vi.fn() }).getSnapshot().value).toBe('');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOpportunity, deleteOpportunity, updateOpportunity, listOpportunities } from './opportunitiesRepository';
import { createContentItem, deleteContentItem, updateContentItem, listContentItems } from './contentRepository';
import { getSupabaseRuntime } from './supabaseRuntime';
import { getOfflineQueue } from './offlineWriteQueue';

vi.mock('./supabaseRuntime', () => ({ isSupabaseRuntimeEnabled: true, getSupabaseRuntime: vi.fn() }));

describe.each([
  ['opportunities', deleteOpportunity, createOpportunity, updateOpportunity, listOpportunities, { name: 'Protected lead', company: 'Example', priority: 'High', stage: 'New' }],
  ['content_items', deleteContentItem, createContentItem, updateContentItem, listContentItems, { title: 'Protected draft', status: 'Idea', platform: 'LinkedIn' }],
])('guarded %s deletion', (table, remove, create, update, list, payload) => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetAllMocks();
    localStorage.clear();
    localStorage.setItem('ceo-os:auth', JSON.stringify({ user: { id: 'user-1' } }));
  });

  function remote({ deleted = null, existing = null, error = null } = {}) {
    let deleting = false;
    const builder = {
      delete: vi.fn(() => { deleting = true; return builder; }),
      select: vi.fn(() => builder), eq: vi.fn(() => builder),
      gte: vi.fn(() => builder), lt: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => deleting ? { data: deleted, error } : { data: existing, error: null }),
    };
    const from = vi.fn(() => { deleting = false; return builder; });
    getSupabaseRuntime.mockResolvedValue({ getSupabaseClient: async () => ({ from }), requireSupabaseUserId: async () => 'user-1' });
    return { ...builder, from };
  }

  it('guards the deletion by user, id, and the revision shown in the confirmation', async () => {
    const query = remote({ deleted: { id: 'item-1' } });
    const stamp = Date.UTC(2026, 10, 21);
    await remove('item-1', { expectedUpdatedAt: stamp, skipQueue: true });
    expect(query.from).toHaveBeenCalledWith(table);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(query.eq).toHaveBeenCalledWith('id', 'item-1');
    expect(query.gte).toHaveBeenCalledWith('updated_at', new Date(stamp).toISOString());
    expect(query.lt).toHaveBeenCalledWith('updated_at', new Date(stamp + 1).toISOString());
  });

  it('rejects a changed row instead of treating a zero-row deletion as success', async () => {
    remote({ existing: { id: 'item-1' } });
    await expect(remove('item-1', { expectedUpdatedAt: 1000, skipQueue: true })).rejects.toMatchObject({ code: 'STALE_RECORD' });
  });

  it('accepts replay when the same row is already gone', async () => {
    remote();
    await expect(remove('item-1', { expectedUpdatedAt: 1000, skipQueue: true })).resolves.toBeUndefined();
  });

  it('keeps the confirmed revision in an offline queue entry', async () => {
    remote({ error: new TypeError('Failed to fetch') });
    await expect(remove('item-1', { expectedUpdatedAt: 1000 })).rejects.toThrow('Failed to fetch');
    expect(getOfflineQueue()).toEqual([expect.objectContaining({
      ownerId: 'user-1', payload: { id: 'item-1', expectedUpdatedAt: 1000 },
    })]);
  });
  it('protects local edits even when two writes share the same millisecond', async () => {
    getSupabaseRuntime.mockResolvedValue(null);
    vi.spyOn(Date, 'now').mockReturnValue(1700000000000);
    const original = await create(payload);
    const revised = await update(original.id, { ...payload, priority: 'Low', status: 'Drafting' }, { expectedUpdatedAt: original.updatedAt });
    expect(revised.updatedAt).toBeGreaterThan(original.updatedAt);
    await expect(remove(original.id, { expectedUpdatedAt: original.updatedAt })).rejects.toMatchObject({ code: 'STALE_RECORD' });
    expect((await list()).find((item) => item.id === original.id)).toMatchObject({ updatedAt: revised.updatedAt });
    await remove(original.id, { expectedUpdatedAt: revised.updatedAt });
    expect((await list()).find((item) => item.id === original.id)).toBeUndefined();
  });

});

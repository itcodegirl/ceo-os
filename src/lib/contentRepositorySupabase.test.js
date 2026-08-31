import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabaseRuntime', () => {
  const supabaseRuntime = {
    getSupabaseClient: vi.fn(),
    requireSupabaseUserId: vi.fn(),
  };
  return {
    isSupabaseRuntimeEnabled: true,
    getSupabaseRuntime: vi.fn(async () => supabaseRuntime),
    __supabaseRuntime: supabaseRuntime,
  };
});

import { isStaleRecordError } from './staleRecordError';
import * as runtimeModule from './supabaseRuntime';
import { matchesExpectedUpdatedAtRange, withMicroseconds } from '../test/timestampPrecision';
import { createContentItem, listContentItems, updateContentItem } from './contentRepository';

function buildSupabaseClientStub({
  listRows = [],
  createRow = null,
  storedUpdatedAt = null,
  updateRow = null,
} = {}) {
  const captured = {
    eqs: [],
    rangeFilters: [],
    insert: null,
    selects: [],
    update: null,
  };

  return {
    captured,
    from() {
      let operation = 'list';
      const filters = {};
      const range = {};
      const builder = {
        insert(payload) {
          operation = 'insert';
          captured.insert = payload;
          return builder;
        },
        update(payload) {
          operation = 'update';
          captured.update = payload;
          return builder;
        },
        eq(column, value) {
          filters[column] = value;
          captured.eqs.push([column, value]);
          if (operation === 'list') {
            return { data: listRows, error: null };
          }
          return builder;
        },
        gte(column, value) {
          captured.rangeFilters.push(['gte', column, value]);
          if (column === 'updated_at') range.gte = value;
          return builder;
        },
        lt(column, value) {
          captured.rangeFilters.push(['lt', column, value]);
          if (column === 'updated_at') range.lt = value;
          return builder;
        },
        select(value) {
          captured.selects.push(value);
          return builder;
        },
        async single() {
          return { data: createRow, error: null };
        },
        async maybeSingle() {
          // Postgres semantics: the stored row keeps microsecond precision and
          // the guard is an instant range, not string equality.
          if (!updateRow || !matchesExpectedUpdatedAtRange(storedUpdatedAt, range)) {
            return { data: null, error: null };
          }
          return { data: updateRow, error: null };
        },
      };
      return builder;
    },
  };
}

describe('contentRepository Supabase timestamp coverage', () => {
  beforeEach(() => {
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockReset();
    runtimeModule.__supabaseRuntime.requireSupabaseUserId.mockResolvedValue('user-1');
    runtimeModule.getSupabaseRuntime.mockResolvedValue(runtimeModule.__supabaseRuntime);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads updated_at from Supabase list rows as a positive updatedAt value', async () => {
    const stub = buildSupabaseClientStub({
      listRows: [
        {
          id: 'content-1',
          title: 'Founder memo',
          platform: 'LinkedIn',
          status: 'Drafting',
          updated_at: '2026-05-01T13:00:00.000Z',
        },
      ],
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    const rows = await listContentItems();

    expect(stub.captured.selects[0]).toContain('updated_at');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'content-1',
      title: 'Founder memo',
      updatedAt: Date.parse('2026-05-01T13:00:00.000Z'),
    });
    expect(rows[0].updatedAt).toBeGreaterThan(0);
  });

  it('returns updatedAt from the Supabase create select path', async () => {
    const stub = buildSupabaseClientStub({
      createRow: {
        id: 'content-2',
        title: 'Launch story',
        platform: 'Newsletter',
        status: 'Drafting',
        updated_at: '2026-05-01T13:02:00.000Z',
      },
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    const created = await createContentItem({
      title: 'Launch story',
      platform: 'Newsletter',
      status: 'Drafting',
    });

    expect(stub.captured.selects[0]).toContain('updated_at');
    expect(created.updatedAt).toBe(Date.parse('2026-05-01T13:02:00.000Z'));
  });

  it('passes expected updated_at to Supabase and returns the fresh row when it matches', async () => {
    const expectedMs = Date.UTC(2026, 4, 1, 13, 0, 0);
    // The row as Postgres holds it: same millisecond, plus the microsecond
    // remainder the client's Date.parse discarded on read.
    const stub = buildSupabaseClientStub({
      storedUpdatedAt: withMicroseconds(new Date(expectedMs).toISOString(), 321),
      updateRow: {
        id: 'content-1',
        title: 'Renamed',
        platform: 'LinkedIn',
        content_type: 'Post',
        status: 'Drafting',
        purpose: '',
        scheduled_for: null,
        notes: '',
        updated_at: '2026-05-01T13:05:00.000Z',
      },
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    const result = await updateContentItem(
      'content-1',
      { title: 'Renamed', platform: 'LinkedIn', status: 'Drafting' },
      { expectedUpdatedAt: expectedMs },
    );

    expect(stub.captured.rangeFilters).toEqual([
      ['gte', 'updated_at', new Date(expectedMs).toISOString()],
      ['lt', 'updated_at', new Date(expectedMs + 1).toISOString()],
    ]);
    expect(stub.captured.selects[0]).toContain('updated_at');
    expect(result).toMatchObject({
      id: 'content-1',
      title: 'Renamed',
      updatedAt: Date.parse('2026-05-01T13:05:00.000Z'),
    });
  });

  it('throws StaleRecordError when a Supabase content row changed elsewhere', async () => {
    const expectedMs = Date.UTC(2026, 4, 1, 13, 0, 0);
    // Row moved on by a full millisecond -> outside the client's window.
    const stub = buildSupabaseClientStub({
      storedUpdatedAt: withMicroseconds(new Date(expectedMs + 1).toISOString(), 250),
      updateRow: { id: 'content-1', title: 'Renamed', updated_at: '2026-05-01T13:05:00.000Z' },
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    let captured;
    try {
      await updateContentItem(
        'content-1',
        { title: 'Founder memo updated', platform: 'LinkedIn', status: 'Editing' },
        { expectedUpdatedAt: expectedMs },
      );
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeDefined();
    expect(isStaleRecordError(captured)).toBe(true);
  });
});

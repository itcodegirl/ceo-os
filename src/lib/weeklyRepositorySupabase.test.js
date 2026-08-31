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
import {
  createWeeklyItem,
  deleteWeeklyItem,
  getWeeklyBriefByWeek,
  updateWeeklyItem,
} from './weeklyRepository';

function buildWeeklySupabaseClientStub({
  briefRow = { id: 'brief-1', review_notes: 'Weekly notes' },
  itemRows = [],
  createRow = null,
  storedUpdatedAt = null,
  updateRow = null,
  deleteRow = null,
} = {}) {
  const captured = {
    deletes: 0,
    eqs: [],
    rangeFilters: [],
    inserts: [],
    selects: [],
    updates: [],
  };

  return {
    captured,
    from(table) {
      let operation = 'list';
      const filters = {};
      const range = {};

      const builder = {
        insert(payload) {
          operation = 'insert';
          captured.inserts.push([table, payload]);
          return builder;
        },
        update(payload) {
          operation = 'update';
          captured.updates.push([table, payload]);
          return builder;
        },
        delete() {
          operation = 'delete';
          captured.deletes += 1;
          return builder;
        },
        select(value) {
          captured.selects.push([table, value]);
          return builder;
        },
        eq(column, value) {
          filters[column] = value;
          captured.eqs.push([table, column, value]);
          return builder;
        },
        gte(column, value) {
          captured.rangeFilters.push([table, 'gte', column, value]);
          if (column === 'updated_at') range.gte = value;
          return builder;
        },
        lt(column, value) {
          captured.rangeFilters.push([table, 'lt', column, value]);
          if (column === 'updated_at') range.lt = value;
          return builder;
        },
        order() {
          return builder;
        },
        async maybeSingle() {
          if (table === 'weekly_briefs') {
            return { data: briefRow, error: null };
          }

          // Postgres semantics: the stored row keeps microsecond precision
          // and the guard is evaluated as an instant range.
          const guardMatches = matchesExpectedUpdatedAtRange(storedUpdatedAt, range);

          if (operation === 'update') {
            if (!updateRow || !guardMatches) {
              return { data: null, error: null };
            }
            return { data: updateRow, error: null };
          }

          if (operation === 'delete') {
            if (!guardMatches) {
              return { data: null, error: null };
            }
            return { data: deleteRow || { id: filters.id }, error: null };
          }

          return { data: null, error: null };
        },
        async single() {
          if (operation === 'insert') {
            return { data: createRow, error: null };
          }
          return { data: briefRow, error: null };
        },
        then(resolve, reject) {
          const result = table === 'weekly_brief_items' && operation === 'list'
            ? { data: itemRows, error: null }
            : { data: null, error: null };
          return Promise.resolve(result).then(resolve, reject);
        },
      };

      return builder;
    },
  };
}

describe('weeklyRepository Supabase timestamp coverage', () => {
  beforeEach(() => {
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockReset();
    runtimeModule.__supabaseRuntime.requireSupabaseUserId.mockResolvedValue('user-1');
    runtimeModule.getSupabaseRuntime.mockResolvedValue(runtimeModule.__supabaseRuntime);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads updated_at from Supabase weekly item rows', async () => {
    const stub = buildWeeklySupabaseClientStub({
      itemRows: [
        {
          id: 'priority-1',
          item_type: 'priority',
          title: 'Ship launch plan',
          owner: 'Jenna',
          status: 'Planned',
          updated_at: '2026-05-01T14:00:00.000Z',
        },
      ],
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    const brief = await getWeeklyBriefByWeek('2026-04-27');

    const itemSelect = stub.captured.selects.find(([table]) => table === 'weekly_brief_items')?.[1] || '';
    expect(itemSelect).toContain('updated_at');
    expect(brief.priorities).toEqual([
      expect.objectContaining({
        id: 'priority-1',
        title: 'Ship launch plan',
        updatedAt: Date.parse('2026-05-01T14:00:00.000Z'),
      }),
    ]);
  });

  it('returns updatedAt from the Supabase create path', async () => {
    const stub = buildWeeklySupabaseClientStub({
      createRow: {
        id: 'win-1',
        item_type: 'win',
        description: 'Published case study',
        category: 'Portfolio',
        updated_at: '2026-05-01T14:05:00.000Z',
      },
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    const created = await createWeeklyItem({
      weekStart: '2026-04-27',
      itemType: 'win',
      item: { text: 'Published case study', category: 'Portfolio' },
    });

    const itemSelect = stub.captured.selects.find(([table]) => table === 'weekly_brief_items')?.[1] || '';
    expect(itemSelect).toContain('updated_at');
    expect(created.updatedAt).toBe(Date.parse('2026-05-01T14:05:00.000Z'));
  });

  it('passes expected updated_at to Supabase item updates and returns the fresh row', async () => {
    const expectedMs = Date.UTC(2026, 4, 1, 14, 0, 0);

    const stub = buildWeeklySupabaseClientStub({
      storedUpdatedAt: withMicroseconds(new Date(expectedMs).toISOString(), 789),
      updateRow: {
        id: 'blocker-1',
        item_type: 'blocker',
        description: 'Waiting on partner',
        severity: 'high',
        updated_at: '2026-05-01T14:07:00.000Z',
      },
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    const updated = await updateWeeklyItem({
      weekStart: '2026-04-27',
      itemType: 'blocker',
      itemId: 'blocker-1',
      item: { text: 'Waiting on partner', severity: 'high' },
      expectedUpdatedAt: expectedMs,
    });

    expect(stub.captured.rangeFilters).toEqual([
      ['weekly_brief_items', 'gte', 'updated_at', new Date(expectedMs).toISOString()],
      ['weekly_brief_items', 'lt', 'updated_at', new Date(expectedMs + 1).toISOString()],
    ]);
    expect(updated).toMatchObject({
      id: 'blocker-1',
      text: 'Waiting on partner',
      updatedAt: Date.parse('2026-05-01T14:07:00.000Z'),
    });
  });

  it('throws StaleRecordError when a Supabase weekly item changed before update', async () => {
    // Row moved on by a full millisecond -> outside the client's window.
    const stub = buildWeeklySupabaseClientStub({
      storedUpdatedAt: withMicroseconds(new Date(Date.UTC(2026, 4, 1, 14, 0, 0) + 1).toISOString(), 400),
      updateRow: { id: 'blocker-1', item_type: 'blocker', updated_at: '2026-05-01T14:07:00.000Z' },
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    let captured;
    try {
      await updateWeeklyItem({
        weekStart: '2026-04-27',
        itemType: 'priority',
        itemId: 'priority-1',
        item: { title: 'Stale priority', owner: 'Jenna', status: 'Planned' },
        expectedUpdatedAt: Date.UTC(2026, 4, 1, 14, 0, 0),
      });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeDefined();
    expect(isStaleRecordError(captured)).toBe(true);
  });

  it('rejects Supabase deletes when the expected updated_at no longer matches', async () => {
    const expectedMs = Date.UTC(2026, 4, 1, 14, 0, 0);
    const stub = buildWeeklySupabaseClientStub({
      storedUpdatedAt: withMicroseconds(new Date(expectedMs + 1).toISOString(), 400),
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    let captured;
    try {
      await deleteWeeklyItem({
        weekStart: '2026-04-27',
        itemType: 'priority',
        itemId: 'priority-1',
        expectedUpdatedAt: expectedMs,
      });
    } catch (error) {
      captured = error;
    }

    expect(stub.captured.rangeFilters).toEqual([
      ['weekly_brief_items', 'gte', 'updated_at', new Date(expectedMs).toISOString()],
      ['weekly_brief_items', 'lt', 'updated_at', new Date(expectedMs + 1).toISOString()],
    ]);
    expect(captured).toBeDefined();
    expect(isStaleRecordError(captured)).toBe(true);
  });
});

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
import { matchesExpectedUpdatedAtRange, withMicroseconds } from '../test/timestampPrecision';
import * as runtimeModule from './supabaseRuntime';
import { listOpportunities, updateOpportunity } from './opportunitiesRepository';

function buildSupabaseListClientStub({ rows = [] } = {}) {
  const captured = { select: '', eqs: [] };
  return {
    captured,
    from() {
      const builder = {
        select(value) {
          captured.select = value;
          return builder;
        },
        async eq(column, value) {
          captured.eqs.push([column, value]);
          return { data: rows, error: null };
        },
      };
      return builder;
    },
  };
}

function buildSupabaseClientStub({ storedUpdatedAt = null, row = null } = {}) {
  const captured = { eqs: [], rangeFilters: [] };
  return {
    captured,
    from() {
      const range = {};
      const builder = {
        update() {
          return builder;
        },
        eq(column, value) {
          captured.eqs.push([column, value]);
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
        select() {
          return builder;
        },
        async maybeSingle() {
          // Behaves like Postgres: the stored row carries microsecond
          // precision and the guard is evaluated as an instant range, not as
          // string equality against whatever the client sent.
          if (!row) {
            return { data: null, error: null };
          }
          if (!matchesExpectedUpdatedAtRange(storedUpdatedAt, range)) {
            return { data: null, error: null };
          }
          return { data: row, error: null };
        },
      };
      return builder;
    },
  };
}

describe('updateOpportunity (Supabase optimistic locking)', () => {
  beforeEach(() => {
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockReset();
    runtimeModule.__supabaseRuntime.requireSupabaseUserId.mockResolvedValue('user-1');
    runtimeModule.getSupabaseRuntime.mockResolvedValue(runtimeModule.__supabaseRuntime);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('loads updated_at from Supabase list rows as a positive updatedAt value', async () => {
    const stub = buildSupabaseListClientStub({
      rows: [
        {
          id: 'opp-1',
          name: 'Expansion partner',
          company: 'Acme',
          priority: 'High',
          stage: 'Awaiting Reply',
          next_step: 'Send recap',
          updated_at: '2026-05-01T12:00:00.000Z',
        },
      ],
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    const rows = await listOpportunities();

    expect(stub.captured.select).toContain('updated_at');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'opp-1',
      nextStep: 'Send recap',
      updatedAt: Date.parse('2026-05-01T12:00:00.000Z'),
    });
    expect(rows[0].updatedAt).toBeGreaterThan(0);
  });

  it('passes expected updated_at to Supabase and returns the fresh row when it matches', async () => {
    const expectedMs = Date.UTC(2026, 4, 1, 12, 0, 0);
    // What Postgres actually holds: the same instant the client read, plus the
    // microsecond remainder `now()` produced and `Date.parse` discarded. An
    // equality guard against the client's millisecond value cannot match this.
    const storedUpdatedAt = withMicroseconds(new Date(expectedMs).toISOString(), 456);
    const stub = buildSupabaseClientStub({
      storedUpdatedAt,
      row: {
        id: 'opp-1',
        name: 'Renamed',
        company: 'Acme',
        priority: 'High',
        stage: 'New',
        next_step: 'Email the team',
        updated_at: '2026-05-01T12:01:00.000Z',
      },
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    const result = await updateOpportunity(
      'opp-1',
      { name: 'Renamed', company: 'Acme', priority: 'High', stage: 'New', nextStep: 'Email the team' },
      { expectedUpdatedAt: expectedMs },
    );

    expect(stub.captured.rangeFilters).toEqual([
      ['gte', 'updated_at', new Date(expectedMs).toISOString()],
      ['lt', 'updated_at', new Date(expectedMs + 1).toISOString()],
    ]);
    expect(result).toMatchObject({ name: 'Renamed' });
    expect(result.updatedAt).toBe(Date.parse('2026-05-01T12:01:00.000Z'));
  });

  it('throws StaleRecordError when the row was changed elsewhere', async () => {
    const expectedMs = Date.UTC(2026, 4, 1, 12, 0, 0);
    // The row moved on by a full millisecond, so it falls outside the window.
    const stub = buildSupabaseClientStub({
      storedUpdatedAt: withMicroseconds(new Date(expectedMs + 1).toISOString(), 500),
      row: { id: 'opp-1', name: 'Renamed', updated_at: '2026-05-01T12:01:00.000Z' },
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    let captured;
    try {
      await updateOpportunity(
        'opp-1',
        { name: 'Renamed', company: 'Acme', priority: 'High', stage: 'New', nextStep: 'Email' },
        { expectedUpdatedAt: expectedMs },
      );
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeDefined();
    expect(isStaleRecordError(captured)).toBe(true);
  });

  it('skips the optimistic-locking filter when no expected stamp is supplied', async () => {
    const stub = buildSupabaseClientStub({
      storedUpdatedAt: withMicroseconds('2026-05-01T12:00:00.000Z', 654),
      row: {
        id: 'opp-1',
        name: 'Renamed',
        company: 'Acme',
        priority: 'High',
        stage: 'New',
        next_step: 'Email',
        updated_at: '2026-05-01T12:01:00.000Z',
      },
    });
    runtimeModule.__supabaseRuntime.getSupabaseClient.mockResolvedValue(stub);

    await updateOpportunity('opp-1', {
      name: 'Renamed', company: 'Acme', priority: 'High', stage: 'New', nextStep: 'Email',
    });

    const updatedAtFilters = [
      ...stub.captured.eqs.filter(([col]) => col === 'updated_at'),
      ...stub.captured.rangeFilters.filter(([, col]) => col === 'updated_at'),
    ];
    expect(updatedAtFilters).toHaveLength(0);
  });
});

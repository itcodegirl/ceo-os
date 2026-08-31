import { describe, expect, it } from 'vitest';
import {
  STALE_RECORD_ERROR_CODE,
  StaleRecordError,
  assertRecordIsFresh,
  expectedUpdatedAtRangeIso,
  applyExpectedUpdatedAtFilter,
  isStaleRecordError,
  readUpdatedAtMs,
} from './staleRecordError';

describe('StaleRecordError', () => {
  it('carries the STALE_RECORD code and a default message', () => {
    const error = new StaleRecordError();
    expect(error.code).toBe(STALE_RECORD_ERROR_CODE);
    expect(error.name).toBe('StaleRecordError');
    expect(error.message).toContain('changed in another window');
    expect(error).toBeInstanceOf(Error);
  });

  it('accepts a custom message', () => {
    const error = new StaleRecordError('Custom note.');
    expect(error.message).toBe('Custom note.');
  });

  it('isStaleRecordError detects by code or name and ignores unrelated errors', () => {
    expect(isStaleRecordError(new StaleRecordError())).toBe(true);
    expect(isStaleRecordError({ code: STALE_RECORD_ERROR_CODE })).toBe(true);
    expect(isStaleRecordError({ name: 'StaleRecordError' })).toBe(true);
    expect(isStaleRecordError(new Error('something else'))).toBe(false);
    expect(isStaleRecordError(undefined)).toBe(false);
    expect(isStaleRecordError(null)).toBe(false);
  });
});

describe('assertRecordIsFresh', () => {
  it('throws StaleRecordError with the supplied message when timestamps drift', () => {
    expect(() => assertRecordIsFresh(
      { updatedAt: 1700000000000 },
      1699999999999,
      'Custom stale message.',
    )).toThrowError('Custom stale message.');
  });

  it('uses a default message when none is supplied', () => {
    let thrown;
    try {
      assertRecordIsFresh({ updatedAt: 1700000000000 }, 1699999999999);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(StaleRecordError);
    expect(thrown.message).toContain('changed in another window');
  });

  it('passes when the timestamps match exactly', () => {
    expect(() => assertRecordIsFresh(
      { updatedAt: 1700000000000 },
      1700000000000,
    )).not.toThrow();
  });

  it('skips the check when expectedUpdatedAt is missing or non-positive', () => {
    expect(() => assertRecordIsFresh({ updatedAt: 1700000000000 }, undefined)).not.toThrow();
    expect(() => assertRecordIsFresh({ updatedAt: 1700000000000 }, 0)).not.toThrow();
    expect(() => assertRecordIsFresh({ updatedAt: 1700000000000 }, -5)).not.toThrow();
    expect(() => assertRecordIsFresh({ updatedAt: 1700000000000 }, 'NaN')).not.toThrow();
  });

  it('skips the check when the persisted record has no positive timestamp (legacy data)', () => {
    expect(() => assertRecordIsFresh({ updatedAt: 0 }, 1700000000000)).not.toThrow();
    expect(() => assertRecordIsFresh({}, 1700000000000)).not.toThrow();
    expect(() => assertRecordIsFresh(null, 1700000000000)).not.toThrow();
  });
});

describe('readUpdatedAtMs', () => {
  it('reads a numeric updatedAt value', () => {
    expect(readUpdatedAtMs({ updatedAt: 1700000000000 })).toBe(1700000000000);
  });

  it('falls back to updated_at (snake_case) for Supabase row payloads', () => {
    expect(readUpdatedAtMs({ updated_at: 1700000111111 })).toBe(1700000111111);
  });

  it('prefers updatedAt over updated_at when both are present', () => {
    expect(readUpdatedAtMs({ updatedAt: 100, updated_at: 200 })).toBe(100);
  });

  it('returns 0 for missing, non-finite, null, or undefined inputs', () => {
    expect(readUpdatedAtMs({})).toBe(0);
    expect(readUpdatedAtMs({ updatedAt: 'never' })).toBe(0);
    expect(readUpdatedAtMs({ updatedAt: NaN })).toBe(0);
    expect(readUpdatedAtMs(null)).toBe(0);
    expect(readUpdatedAtMs(undefined)).toBe(0);
  });
});

describe('expectedUpdatedAtRangeIso', () => {
  it('returns the half-open [ms, ms + 1ms) window for a positive epoch-ms value', () => {
    expect(expectedUpdatedAtRangeIso(1700000000000)).toEqual({
      fromIso: new Date(1700000000000).toISOString(),
      toIso: new Date(1700000000001).toISOString(),
    });
  });

  it('round-trips the lower bound with readUpdatedAtMs', () => {
    const { fromIso } = expectedUpdatedAtRangeIso(1700000000000);
    expect(readUpdatedAtMs({ updatedAt: fromIso })).toBe(1700000000000);
  });

  it('returns null for missing, zero, negative, or non-finite inputs', () => {
    expect(expectedUpdatedAtRangeIso(undefined)).toBeNull();
    expect(expectedUpdatedAtRangeIso(null)).toBeNull();
    expect(expectedUpdatedAtRangeIso(0)).toBeNull();
    expect(expectedUpdatedAtRangeIso(-5)).toBeNull();
    expect(expectedUpdatedAtRangeIso('NaN')).toBeNull();
  });

  it('brackets a microsecond-precision Postgres timestamp that the client truncated', () => {
    // Postgres compares timestamptz by instant, not by string, so the bounds
    // are evaluated in microseconds here. (ISO strings cannot be compared
    // lexicographically across differing fractional-digit counts:
    // '...123Z' sorts after '...123456Z'.)
    const toMicros = (iso) => {
      const [, head, frac = '', zone] = /^(.*?)(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})$/.exec(iso);
      return Date.parse(`${head}${zone}`) * 1000 + Number(`${frac}000000`.slice(0, 6));
    };

    const storedIso = '2026-05-12T10:23:45.123456+00:00';
    const clientMs = readUpdatedAtMs({ updated_at: storedIso });
    const { fromIso, toIso } = expectedUpdatedAtRangeIso(clientMs);

    // The stored row sits inside the window the client can express...
    expect(toMicros(storedIso)).toBeGreaterThanOrEqual(toMicros(fromIso));
    expect(toMicros(storedIso)).toBeLessThan(toMicros(toIso));
    // ...while a write even one millisecond later falls outside it.
    expect(toMicros('2026-05-12T10:23:45.124000+00:00')).toBeGreaterThanOrEqual(toMicros(toIso));
  });
});

describe('applyExpectedUpdatedAtFilter', () => {
  function buildQueryStub() {
    const calls = [];
    const query = {
      calls,
      gte(column, value) {
        calls.push(['gte', column, value]);
        return query;
      },
      lt(column, value) {
        calls.push(['lt', column, value]);
        return query;
      },
    };
    return query;
  }

  it('applies a gte/lt range rather than an equality filter', () => {
    const query = buildQueryStub();
    const result = applyExpectedUpdatedAtFilter(query, 1700000000000);

    expect(result).toBe(query);
    expect(query.calls).toEqual([
      ['gte', 'updated_at', new Date(1700000000000).toISOString()],
      ['lt', 'updated_at', new Date(1700000000001).toISOString()],
    ]);
  });

  it('leaves the query untouched when no expected stamp is supplied', () => {
    const query = buildQueryStub();
    expect(applyExpectedUpdatedAtFilter(query, 0)).toBe(query);
    expect(applyExpectedUpdatedAtFilter(query, undefined)).toBe(query);
    expect(query.calls).toEqual([]);
  });
});

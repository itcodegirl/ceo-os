import { describe, expect, it } from 'vitest';
import {
  STALE_RECORD_ERROR_CODE,
  StaleRecordError,
  assertRecordIsFresh,
  expectedUpdatedAtToIso,
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

describe('expectedUpdatedAtToIso', () => {
  it('converts a positive epoch-ms value into an ISO string', () => {
    expect(expectedUpdatedAtToIso(1700000000000)).toBe(
      new Date(1700000000000).toISOString(),
    );
  });

  it('round-trips with readUpdatedAtMs', () => {
    const iso = expectedUpdatedAtToIso(1700000000000);
    expect(readUpdatedAtMs({ updatedAt: iso })).toBe(1700000000000);
  });

  it('returns null for missing, zero, negative, or non-finite inputs', () => {
    expect(expectedUpdatedAtToIso(undefined)).toBeNull();
    expect(expectedUpdatedAtToIso(null)).toBeNull();
    expect(expectedUpdatedAtToIso(0)).toBeNull();
    expect(expectedUpdatedAtToIso(-5)).toBeNull();
    expect(expectedUpdatedAtToIso('NaN')).toBeNull();
  });
});

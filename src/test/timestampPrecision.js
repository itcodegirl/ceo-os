/**
 * Test-only helpers for modelling Postgres timestamp precision.
 *
 * Postgres `timestamptz` keeps MICROSECOND precision — the `set_updated_at`
 * triggers write `now()` — while JavaScript `Date` only resolves to
 * milliseconds. Repository stubs that store `updated_at` as a lossless
 * `.000Z` string cannot observe that gap, which is exactly how an
 * always-failing optimistic-locking guard shipped green: the mock encoded the
 * client's assumption instead of the database's contract.
 *
 * These helpers let a stub evaluate the `gte`/`lt` window the repositories
 * apply the way Postgres would — by instant, in microseconds.
 */

const MICROS_PER_MS = 1000;
const ISO_PARTS = /^(.*?)(?:\.(\d+))?(Z|[+-]\d{2}:?\d{2})$/;

/**
 * Parses an ISO timestamp into epoch microseconds, preserving sub-millisecond
 * digits that `Date.parse` would discard.
 *
 * Note ISO strings cannot be compared lexicographically across differing
 * fractional-digit counts ('...123Z' sorts *after* '...123456Z'), so range
 * checks must go through this rather than string comparison.
 */
export function isoToMicros(iso) {
  const match = ISO_PARTS.exec(String(iso));
  if (!match) {
    return Date.parse(iso) * MICROS_PER_MS;
  }

  const [, head, fraction = '', zone] = match;
  return Date.parse(`${head}${zone}`) * MICROS_PER_MS + Number(`${fraction}000000`.slice(0, 6));
}

/**
 * Builds a microsecond-precision timestamp the way Postgres would store one:
 * the millisecond instant a client can read back, plus the sub-millisecond
 * remainder `Date.parse` discards. `subMicros` is the remainder only (0-999),
 * so the millisecond component of `isoMs` is preserved.
 */
export function withMicroseconds(isoMs, subMicros) {
  const [, head, fraction = ''] = ISO_PARTS.exec(isoMs);
  const millis = `${fraction}000`.slice(0, 3);
  const remainder = String(subMicros).padStart(3, '0').slice(0, 3);
  return `${head}.${millis}${remainder}+00:00`;
}

/**
 * Mimics the PostgREST predicate `applyExpectedUpdatedAtFilter` applies.
 * Returns true when no guard was requested (the legacy skip-the-check path).
 */
export function matchesExpectedUpdatedAtRange(storedUpdatedAt, { gte, lt } = {}) {
  if (!gte && !lt) {
    return true;
  }

  const stored = isoToMicros(storedUpdatedAt);
  if (gte && stored < isoToMicros(gte)) {
    return false;
  }
  if (lt && stored >= isoToMicros(lt)) {
    return false;
  }
  return true;
}

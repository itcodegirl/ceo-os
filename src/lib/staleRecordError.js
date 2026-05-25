export const STALE_RECORD_ERROR_CODE = 'STALE_RECORD';

/**
 * Thrown when an optimistic-locking check detects that a record has been
 * mutated by another tab/window since the user opened the editor. Callers
 * (useCrudPage) detect the code and prompt the user to reload before saving.
 */
export class StaleRecordError extends Error {
  constructor(message = 'Record changed in another window. Reload to see the latest version.') {
    super(message);
    this.name = 'StaleRecordError';
    this.code = STALE_RECORD_ERROR_CODE;
  }
}

export function isStaleRecordError(error) {
  return Boolean(error)
    && (error?.code === STALE_RECORD_ERROR_CODE || error?.name === 'StaleRecordError');
}

/**
 * Parses an `updatedAt` value off a record. Accepts both camelCase
 * (`updatedAt`) and snake_case (`updated_at`) so repositories can normalize
 * payloads from local storage and Supabase rows through a single helper.
 *
 * Numeric epoch ms values (local-only path) and ISO date strings (Supabase
 * timestamptz columns return strings) both resolve to ms; missing / unparseable
 * values return 0 so the optimistic-locking check treats them as legacy data
 * and safely skips.
 */
export function readUpdatedAtMs(record) {
  const raw = record?.updatedAt ?? record?.updated_at;
  if (raw === null || raw === undefined || raw === '') {
    return 0;
  }
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : 0;
  }
  if (typeof raw === 'string') {
    const numeric = Number(raw);
    if (Number.isFinite(numeric) && String(numeric) === raw.trim()) {
      return numeric;
    }
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Converts an epoch-ms `expectedUpdatedAt` into an ISO string for Supabase
 * conflict checks (timestamptz columns compare as ISO). Returns null for
 * missing / non-positive values so callers can omit the guard and fall back
 * to the legacy "skip the check" contract. Inverse of `readUpdatedAtMs` on
 * the write path; shared by the three optimistic-locking repositories
 * (opportunities, content, weekly) that used to each inline it.
 */
export function expectedUpdatedAtToIso(expectedUpdatedAt) {
  const expected = Number(expectedUpdatedAt);
  if (!Number.isFinite(expected) || expected <= 0) {
    return null;
  }
  return new Date(expected).toISOString();
}

/**
 * Asserts that a persisted record's updatedAt has not drifted from what the
 * caller expected. Used by the local-first repositories (opportunities,
 * content, weekly items) to reject two-tab conflicts before mutating.
 *
 * - If `expectedUpdatedAt` is missing or non-positive, the check is skipped.
 *   This keeps the legacy contract for callers that don't track timestamps.
 * - If the persisted record has no positive updatedAt yet (legacy data), the
 *   check is also skipped so old payloads keep saving cleanly.
 * - Otherwise, a mismatch throws a StaleRecordError with the supplied message.
 */
export function assertRecordIsFresh(persistedRecord, expectedUpdatedAt, message) {
  const expected = Number(expectedUpdatedAt);
  if (!Number.isFinite(expected) || expected <= 0) {
    return;
  }
  if (!persistedRecord) {
    return;
  }
  const persistedAt = Number(persistedRecord.updatedAt);
  if (!Number.isFinite(persistedAt) || persistedAt <= 0) {
    return;
  }
  if (persistedAt !== expected) {
    throw new StaleRecordError(
      message || 'This record was changed in another window. Reload to see the latest version before saving.',
    );
  }
}

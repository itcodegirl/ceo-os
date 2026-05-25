import { CONTENT_STATUSES } from './contentPayloadSchema';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Render a stored YYYY-MM-DD publish date as a calm, human label
 * ("May 14, 2026"). Parsing the parts by hand avoids the UTC-midnight
 * off-by-one you get from `new Date('2026-05-14')` in non-UTC timezones.
 * Returns `''` for blank / malformed values so callers can fall back.
 */
export function formatPublishDate(value) {
  if (typeof value !== 'string') {
    return '';
  }
  const match = ISO_DATE_RE.exec(value.trim());
  if (!match) {
    return '';
  }
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return '';
  }
  return `${MONTHS[month - 1]} ${day}, ${match[1]}`;
}

const STATUS_RANK = new Map(CONTENT_STATUSES.map((status, index) => [status, index]));

/** Lifecycle-order sort key for a status (unknown statuses sort last). */
export function contentStatusRank(status) {
  const rank = STATUS_RANK.get(status);
  return rank === undefined ? CONTENT_STATUSES.length : rank;
}

/**
 * The next piece queued to go out: the Scheduled item with the soonest
 * publish date, falling back to any Scheduled item if none have a date.
 * Returns `null` when nothing is scheduled.
 */
export function findNextScheduledItem(items) {
  if (!Array.isArray(items)) {
    return null;
  }
  const scheduled = items.filter((item) => item && item.status === 'Scheduled');
  if (scheduled.length === 0) {
    return null;
  }
  const dated = scheduled
    .filter((item) => ISO_DATE_RE.test(String(item.scheduledFor || '')))
    .sort((a, b) => String(a.scheduledFor).localeCompare(String(b.scheduledFor)));
  return dated[0] || scheduled[0];
}

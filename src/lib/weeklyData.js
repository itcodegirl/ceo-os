import {
  weeklyPriorities as defaultPriorities,
  weeklyWins as defaultWins,
  weeklyBlockers as defaultBlockers,
} from '../data/mockData';

export {
  defaultPriorities,
  defaultWins,
  defaultBlockers,
};

export const DEFAULT_REVIEW_NOTES = '';

export const PRIORITY_STATUS_OPTIONS = ['Planned', 'In Progress', 'Blocked'];

// Founder-shaped, not engineering-team-shaped. Category is optional.
export const WIN_CATEGORY_OPTIONS = ['Product', 'Revenue', 'Relationships', 'Team', 'Personal'];

/**
 * Blockers are tracked by what they *need* next (an actionable nudge), not by a
 * raw triage label. The stored value stays in the existing `severity` column /
 * field so this is a copy + option-set change, not a data migration. Each need
 * maps to a dot tone for the list view; legacy `warning`/`high` values still
 * resolve to a tone and a readable label for back-compat.
 */
export const BLOCKER_NEEDS = [
  { value: 'decision', label: 'Needs a decision', tone: 'warning' },
  { value: 'owner', label: 'Needs an owner', tone: 'high' },
  { value: 'conversation', label: 'Needs a conversation', tone: '' },
  { value: 'time', label: 'Needs protected time', tone: 'muted' },
  { value: 'money', label: 'Needs budget', tone: 'success' },
];

export const BLOCKER_SEVERITY_OPTIONS = BLOCKER_NEEDS.map((need) => need.value);

const DEFAULT_BLOCKER_NEED = BLOCKER_NEEDS[0].value;

const LEGACY_BLOCKER_TONE = { warning: 'warning', high: 'high' };
const LEGACY_BLOCKER_LABEL = { warning: 'Flagged', high: 'High priority' };

function findBlockerNeed(value) {
  return BLOCKER_NEEDS.find((need) => need.value === value) || null;
}

export function blockerNeedTone(value) {
  const need = findBlockerNeed(value);
  if (need) {
    return need.tone;
  }
  return LEGACY_BLOCKER_TONE[value] || '';
}

export function describeBlockerNeed(value) {
  const need = findBlockerNeed(value);
  if (need) {
    return need.label;
  }
  return LEGACY_BLOCKER_LABEL[value] || '';
}

const DEFAULT_EDITOR_FORM_BY_TYPE = {
  priority: {
    title: '',
    owner: '',
    status: 'Planned',
  },
  win: {
    text: '',
    category: 'Product',
  },
  blocker: {
    text: '',
    severity: DEFAULT_BLOCKER_NEED,
  },
};

export function getDefaultFormValues(type) {
  return { ...(DEFAULT_EDITOR_FORM_BY_TYPE[type] || {}) };
}

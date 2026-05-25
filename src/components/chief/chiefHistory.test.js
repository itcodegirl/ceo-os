import { describe, expect, it } from 'vitest';
import { countStructuredItems, getChiefResponseId } from './chiefHistory';

describe('getChiefResponseId', () => {
  it('uses the persisted id when present', () => {
    expect(getChiefResponseId({ id: 'abc' }, 3)).toBe('abc');
  });

  it('falls back to an index-derived id when no id exists', () => {
    expect(getChiefResponseId({}, 2)).toBe('chief-output-2');
    expect(getChiefResponseId(null, 0)).toBe('chief-output-0');
  });
});

describe('countStructuredItems', () => {
  it('returns 0 for missing or non-object payloads', () => {
    expect(countStructuredItems(null)).toBe(0);
    expect(countStructuredItems('nope')).toBe(0);
    expect(countStructuredItems({})).toBe(0);
  });

  it('sums the four known structured arrays and ignores other keys', () => {
    expect(
      countStructuredItems({
        priorities: [1, 2],
        opportunities: [1],
        contentItems: [],
        tasks: [1, 2, 3],
        somethingElse: [1, 2, 3, 4],
      }),
    ).toBe(6);
  });
});

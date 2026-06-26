import { describe, expect, it } from 'vitest';
import {
  buildContentSignature,
  buildOpportunitySignature,
  buildPrioritySignature,
  makeDuplicateValidator,
  normalizeComparableValue,
} from './recordIdentity';

describe('normalizeComparableValue', () => {
  it('trims and lowercases, coercing nullish to empty string', () => {
    expect(normalizeComparableValue('  Q3 Launch  ')).toBe('q3 launch');
    expect(normalizeComparableValue(null)).toBe('');
    expect(normalizeComparableValue(undefined)).toBe('');
  });
});

describe('signature builders', () => {
  it('builds case/whitespace-insensitive opportunity signatures', () => {
    expect(buildOpportunitySignature({ name: ' Acme Deal ', company: 'ACME' })).toBe(
      buildOpportunitySignature({ name: 'acme deal', company: 'acme' }),
    );
  });

  it('returns empty signature when the primary field is missing', () => {
    expect(buildOpportunitySignature({ company: 'Acme' })).toBe('');
    expect(buildContentSignature({ platform: 'LinkedIn' })).toBe('');
    expect(buildPrioritySignature({})).toBe('');
  });
});

describe('makeDuplicateValidator', () => {
  const validate = makeDuplicateValidator(
    buildOpportunitySignature,
    'This opportunity already exists for that company.',
  );

  it('returns no error for a unique payload', () => {
    const items = [{ id: '1', name: 'Acme', company: 'Acme Inc' }];
    expect(validate({ name: 'Globex', company: 'Globex' }, { items })).toBe('');
  });

  it('flags a duplicate payload (case/whitespace-insensitive)', () => {
    const items = [{ id: '1', name: 'Acme Deal', company: 'Acme Inc' }];
    expect(validate({ name: ' acme deal ', company: 'ACME INC' }, { items })).toBe(
      'This opportunity already exists for that company.',
    );
  });

  it('excludes the record being edited so a no-op edit is not a duplicate', () => {
    const items = [{ id: '1', name: 'Acme Deal', company: 'Acme Inc' }];
    expect(
      validate(
        { name: 'Acme Deal', company: 'Acme Inc' },
        { items, selectedItem: { id: '1' } },
      ),
    ).toBe('');
  });

  it('still flags a collision with a different record while editing', () => {
    const items = [
      { id: '1', name: 'Acme Deal', company: 'Acme Inc' },
      { id: '2', name: 'Globex Deal', company: 'Globex' },
    ];
    expect(
      validate(
        { name: 'Globex Deal', company: 'Globex' },
        { items, selectedItem: { id: '1' } },
      ),
    ).toBe('This opportunity already exists for that company.');
  });

  it('returns no error when the payload has an empty signature', () => {
    const items = [{ id: '1', name: 'Acme Deal', company: 'Acme Inc' }];
    expect(validate({ company: 'Acme Inc' }, { items })).toBe('');
  });

  it('defaults context to empty so a missing items list is safe', () => {
    expect(validate({ name: 'Acme', company: 'Acme' })).toBe('');
  });
});

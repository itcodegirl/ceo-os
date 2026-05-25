import { describe, expect, it } from 'vitest';
import {
  buildContentSignature,
  buildOpportunitySignature,
  makeDuplicateValidator,
} from './recordIdentity';

describe('makeDuplicateValidator', () => {
  const validate = makeDuplicateValidator(
    buildOpportunitySignature,
    'This opportunity already exists for that company.',
  );

  it('returns no error when the payload has no signature', () => {
    expect(validate({ name: '' }, { items: [{ id: '1', name: 'Acme' }] })).toBe('');
  });

  it('returns no error when there is no matching record', () => {
    const items = [{ id: '1', name: 'Acme', company: 'Acme Co' }];
    expect(validate({ name: 'Globex', company: 'Globex Co' }, { items })).toBe('');
  });

  it('flags a duplicate (case/whitespace-insensitive) against another record', () => {
    const items = [{ id: '1', name: 'Acme', company: 'Acme Co' }];
    expect(validate({ name: '  acme  ', company: 'ACME CO' }, { items })).toBe(
      'This opportunity already exists for that company.',
    );
  });

  it('does not flag the record being edited as its own duplicate', () => {
    const items = [{ id: '1', name: 'Acme', company: 'Acme Co' }];
    expect(
      validate({ name: 'Acme', company: 'Acme Co' }, { items, selectedItem: { id: '1' } }),
    ).toBe('');
  });

  it('still flags a different record even while editing another', () => {
    const items = [
      { id: '1', name: 'Acme', company: 'Acme Co' },
      { id: '2', name: 'Globex', company: 'Globex Co' },
    ];
    expect(
      validate({ name: 'Globex', company: 'Globex Co' }, { items, selectedItem: { id: '1' } }),
    ).toBe('This opportunity already exists for that company.');
  });

  it('tolerates an absent context (no items)', () => {
    expect(validate({ name: 'Acme', company: 'Acme Co' })).toBe('');
  });

  it('threads a different signature builder + message (content variant)', () => {
    const validateContent = makeDuplicateValidator(
      buildContentSignature,
      'This content item already exists for that platform.',
    );
    const items = [{ id: '1', title: 'Launch post', platform: 'LinkedIn' }];
    expect(validateContent({ title: 'launch post', platform: 'linkedin' }, { items })).toBe(
      'This content item already exists for that platform.',
    );
    expect(validateContent({ title: 'Launch post', platform: 'X' }, { items })).toBe('');
  });
});

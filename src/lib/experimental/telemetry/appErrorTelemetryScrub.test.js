import { describe, expect, it } from 'vitest';
import { __testables } from './appErrorTelemetry';

const { scrubSensitive, normalizeStack } = __testables;

describe('scrubSensitive', () => {
  it('redacts email addresses', () => {
    expect(scrubSensitive('failed for user jane.doe+ceo@example.com')).toBe(
      'failed for user <email>',
    );
  });

  it('strips URL query strings', () => {
    expect(scrubSensitive('GET /api/me?token=abc&team=42 401')).toBe(
      'GET /api/me?<redacted> 401',
    );
  });

  it('redacts macOS and linux home directories', () => {
    expect(scrubSensitive('at handler (/Users/jane/work/file.js:1:1)')).toContain('/<user>/work');
    expect(scrubSensitive('at handler (/home/jane/work/file.js:1:1)')).toContain('/<user>/work');
  });

  it('replaces uuids with a token marker', () => {
    expect(
      scrubSensitive('row 550e8400-e29b-41d4-a716-446655440000 missing'),
    ).toBe('row <token> missing');
  });

  it('replaces long opaque tokens with a token marker', () => {
    const jwt = 'a'.repeat(64);
    expect(scrubSensitive(`auth header Bearer ${jwt}`)).toBe('auth header Bearer <token>');
  });

  it('truncates very long lines', () => {
    const long = 'word '.repeat(120);
    const out = scrubSensitive(long);
    expect(out.length).toBeLessThanOrEqual(241);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('normalizeStack', () => {
  it('drops blank lines and applies the scrub line by line', () => {
    const stack = `Error: boom\n    at handler (/home/jane/app/index.js:1:1)\n\n    at run (jane.doe@example.com)`;
    const result = normalizeStack(stack);
    expect(result).toContain('/<user>/app');
    expect(result).toContain('<email>');
    expect(result.split('\n').every((line) => line.length > 0)).toBe(true);
  });
});

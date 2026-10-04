import { describe, expect, it } from 'vitest';
import { normalizeLinkHref } from './links';

describe('normalizeLinkHref', () => {
  it('adds https:// to bare domains and keeps web and mail links', () => {
    expect(normalizeLinkHref(' react.dev/learn ')).toBe('https://react.dev/learn');
    expect(normalizeLinkHref('http://example.com')).toBe('http://example.com/');
    expect(normalizeLinkHref('mailto:hi@example.com')).toBe('mailto:hi@example.com');
  });

  it('rejects empty input and unsafe schemes', () => {
    expect(normalizeLinkHref('   ')).toBeNull();
    expect(normalizeLinkHref('javascript:alert(1)')).toBeNull();
    expect(normalizeLinkHref('data:text/html,<b>x</b>')).toBeNull();
  });
});

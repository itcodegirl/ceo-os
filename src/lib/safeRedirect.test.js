import { describe, expect, it } from 'vitest';
import { getSafeRedirectPath, isSafeRedirectPath } from './safeRedirect';

describe('src/lib/safeRedirect', () => {
  it.each([
    '/',
    '/capture',
    '/capture?x=1',
    '/capture?x=1#notes',
    '/opportunities/abc-123',
    '/search?q=%2F%2Fevil.com',
  ])('allows same-origin relative path %j', (value) => {
    expect(isSafeRedirectPath(value)).toBe(true);
    expect(getSafeRedirectPath(value)).toBe(value);
  });

  it.each([
    // Protocol-relative and backslash variants (GHSA-wrjc-x8rr-h8h6 style).
    '//evil.com',
    '///evil.com',
    '/\\evil.com',
    '\\\\evil.com',
    '\\/evil.com',
    '/foo\\bar',
    // Absolute URLs and dangerous schemes.
    'https://evil.com',
    'http://evil.com/capture',
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    // Not rooted at '/'.
    'capture',
    'evil.com',
    ' /capture',
    // Control characters the URL parser strips, which can collapse to '//'.
    '/\t/evil.com',
    '/\n/evil.com',
    '/\r/evil.com',
    '/capture\u0000',
    '/capture\u007f',
    // Empty / non-string input.
    '',
    null,
    undefined,
    42,
    {},
  ])('rejects %j and falls back to "/"', (value) => {
    expect(isSafeRedirectPath(value)).toBe(false);
    expect(getSafeRedirectPath(value)).toBe('/');
  });

  it('uses the provided fallback when the value is unsafe', () => {
    expect(getSafeRedirectPath('//evil.com', '/settings')).toBe('/settings');
  });

  it('falls back to "/" when the provided fallback is itself unsafe', () => {
    expect(getSafeRedirectPath('//evil.com', 'https://evil.com')).toBe('/');
  });
});

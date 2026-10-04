// Guards post-auth redirects (e.g. SignIn's `?redirectTo=`) against open
// redirects. Defense in depth on top of react-router's own handling
// (cf. GHSA-wrjc-x8rr-h8h6): only same-origin, root-relative paths pass.

const PLACEHOLDER_ORIGIN = 'https://same-origin.invalid';

// C0 controls and DEL. Browsers strip tab/CR/LF while parsing URLs, so
// `/\t/evil.com` would otherwise collapse to protocol-relative `//evil.com`.
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

export function isSafeRedirectPath(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  // Must be rooted at a single '/'. A leading '/' also rules out any scheme.
  if (value[0] !== '/' || value[1] === '/') {
    return false;
  }
  // Browsers treat '\' as '/' in http(s) URLs, so '/\evil.com' is '//evil.com'.
  if (value.includes('\\') || CONTROL_CHARS.test(value)) {
    return false;
  }
  // Final check: resolving against a placeholder origin must stay on it.
  try {
    return new URL(value, PLACEHOLDER_ORIGIN).origin === PLACEHOLDER_ORIGIN;
  } catch {
    return false;
  }
}

export function getSafeRedirectPath(value, fallback = '/') {
  if (isSafeRedirectPath(value)) {
    return value;
  }
  return isSafeRedirectPath(fallback) ? fallback : '/';
}

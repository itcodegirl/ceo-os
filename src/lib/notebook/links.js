const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

/** Normalizes a typed link; adds https:// to bare domains and rejects unsafe schemes. */
export function normalizeLinkHref(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;
  const candidate = /^[a-z][a-z\d+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    return ALLOWED_PROTOCOLS.has(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

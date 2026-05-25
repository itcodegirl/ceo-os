import { normalizeChiefOutput } from './normalizeChiefOutput';

// Parse a string that may contain a JSON object describing a structured Chief
// response. Returns the parsed object, or null when the value is missing,
// blank, not valid JSON, or not an object.
export function parseStructuredText(value) {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = JSON.parse(trimmed);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

// Map a stored Chief response entry into the normalized shape consumed by
// ChiefOutputPanel. Tolerates entries whose `content` is either plain text or
// a JSON blob produced by the structured pipeline.
export function toPanelResult(entry) {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const parsedContent = parseStructuredText(entry.content);

  return normalizeChiefOutput({
    title: parsedContent?.title || entry.title || 'Executive Action Plan',
    summary: parsedContent?.summary || entry.content || '',
    source: entry.source || 'proxy',
    fallbackReason: entry.fallbackReason || '',
    errorCode: entry.errorCode || '',
    errorMessage: entry.errorMessage || '',
    structured: entry.structuredPayload || parsedContent?.structured || {},
  });
}

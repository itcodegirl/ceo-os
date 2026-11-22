function text(value, fallback = '') {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
    ? String(value).trim() : fallback;
}
export function readChiefTextField(item, ...keys) {
  for (const key of keys) {
    const value = text(item?.[key]);
    if (value) return value;
  }
  return '';
}

// The panel, acceptance identity, save payload, and history hydration all use
// these canonical fields. Missing metadata stays empty; only the UI labels it.
export function normalizeChiefSuggestion(section, input) {
  const item = input && typeof input === 'object' ? input : { title: text(input) };
  const title = readChiefTextField(item, 'title', 'name', 'text', 'summary', 'task');
  if (section === 'opportunities') return {
    name: readChiefTextField(item, 'name', 'title', 'text', 'summary', 'task'),
    company: readChiefTextField(item, 'company', 'organization'), priority: readChiefTextField(item, 'priority'),
    stage: readChiefTextField(item, 'stage'), nextStep: readChiefTextField(item, 'nextStep', 'next_step'),
  };
  if (section === 'contentItems') return {
    title, platform: readChiefTextField(item, 'platform', 'channel'), status: readChiefTextField(item, 'status'),
    summary: readChiefTextField(item, 'summary'), notes: readChiefTextField(item, 'notes', 'summary'),
    purpose: readChiefTextField(item, 'purpose'), contentType: readChiefTextField(item, 'contentType', 'content_type'),
    scheduledFor: readChiefTextField(item, 'scheduledFor', 'scheduled_for'),
  };
  return {
    title, owner: readChiefTextField(item, 'owner', 'assignee'), status: readChiefTextField(item, 'status'),
    ...(section === 'tasks' ? { type: readChiefTextField(item, 'type') || 'task' } : { reason: readChiefTextField(item, 'reason') }),
  };
}
export function normalizeChiefOutput(payload = {}) {
  return {
    title: text(payload.title, 'Executive Action Plan'), summary: text(payload.summary),
    source: text(payload.source, 'proxy'), fallbackReason: text(payload.fallbackReason),
    errorCode: text(payload.errorCode), errorMessage: text(payload.errorMessage),
    structured: Object.fromEntries(['priorities', 'opportunities', 'contentItems', 'tasks'].map((section) => [section,
      (Array.isArray(payload.structured?.[section]) ? payload.structured[section] : [])
        .map((item) => normalizeChiefSuggestion(section, item)).filter((item) => item.title || item.name),
    ])),
  };
}

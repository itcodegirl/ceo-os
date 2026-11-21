import { STORAGE_SCHEMAS, readVersionedStoragePayload } from './dataSchema';
import { migrateStoragePayload } from './storageMigrations';

const object = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const id = (value) => (typeof value === 'string' && value.length > 0) || (typeof value === 'number' && Number.isFinite(value));
const strings = (record, fields) => fields.every((field) => record[field] === undefined || typeof record[field] === 'string');
const records = (value, check) => Array.isArray(value) && value.every((record) => object(record) && id(record.id) && check(record));
const stamp = (record) => record.updatedAt === undefined || (Number.isFinite(record.updatedAt) && record.updatedAt >= 0)
  || (typeof record.updatedAt === 'string' && Number.isFinite(Date.parse(record.updatedAt)));
const sync = (record) => record.sync === undefined || (object(record.sync) && strings(record.sync, ['ownerId'])
  && (record.sync.remoteUpdatedAt == null || typeof record.sync.remoteUpdatedAt === 'string' || Number.isFinite(record.sync.remoteUpdatedAt))
  && (record.sync.pending === undefined || typeof record.sync.pending === 'boolean'));
const tombstones = (value) => value === undefined || (Array.isArray(value) && value.every((entry) => typeof entry === 'string'
  || (object(entry) && typeof entry.id === 'string' && typeof entry.ownerId === 'string')));
const richTypes = new Set(['doc', 'text', 'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem', 'blockquote', 'codeBlock', 'hardBreak', 'horizontalRule', 'taskList', 'taskItem']);
const richMarks = new Set(['bold', 'italic', 'strike', 'code', 'underline', 'link', 'highlight']);
function richDocument(value) {
  let count = 0;
  const node = (item, depth) => {
    if (++count > 20000 || depth > 40 || !object(item) || !richTypes.has(item.type)) return false;
    if (item.type === 'text' && typeof item.text !== 'string') return false;
    if (item.attrs !== undefined && !object(item.attrs)) return false;
    if (item.type === 'heading' && item.attrs?.level !== undefined && ![1, 2, 3, 4, 5, 6].includes(item.attrs.level)) return false;
    if (item.type === 'taskItem' && item.attrs?.checked !== undefined && typeof item.attrs.checked !== 'boolean') return false;
    if (item.type === 'codeBlock' && item.attrs?.language != null && typeof item.attrs.language !== 'string') return false;
    if (item.marks !== undefined && (!Array.isArray(item.marks) || !item.marks.every((mark) => object(mark)
      && richMarks.has(mark.type) && (mark.attrs === undefined || object(mark.attrs))
      && (mark.type !== 'link' || (typeof mark.attrs?.href === 'string' && !/^\s*(javascript|data|vbscript):/i.test(mark.attrs.href)))))) return false;
    return item.content === undefined || (Array.isArray(item.content) && item.content.every((child) => node(child, depth + 1)));
  };
  return value?.type === 'doc' && node(value, 0);
}
const weeklyItem = (item) => strings(item, ['title', 'owner', 'status', 'text', 'category', 'severity']) && stamp(item);
const checks = {
  captureNotes: (value) => records(value, (item) => typeof item.text === 'string' && strings(item, ['category']) && stamp(item)),
  chiefNotes: (value) => typeof value === 'string',
  chiefResponses: (value) => records(value, (item) => strings(item, ['title', 'content', 'source', 'fallbackReason', 'errorCode', 'errorMessage'])
    && (item.structuredPayload === undefined || (object(item.structuredPayload) && ['priorities', 'opportunities', 'contentItems', 'tasks'].every((key) => item.structuredPayload[key] === undefined || (Array.isArray(item.structuredPayload[key]) && item.structuredPayload[key].every((entry) => object(entry) && Object.values(entry).every((field) => typeof field === 'string'))))))),
  contentItems: (value) => records(value, (item) => typeof item.title === 'string' && strings(item, ['platform', 'status', 'contentType', 'purpose', 'scheduledFor', 'notes']) && stamp(item)),
  opportunities: (value) => records(value, (item) => typeof item.name === 'string' && strings(item, ['company', 'priority', 'stage', 'nextStep']) && stamp(item)),
  reminders: (value) => records(value, (item) => typeof item.text === 'string' && strings(item, ['completedAt', 'createdAt', 'snoozedUntil', 'sourceType', 'sourceId', 'sourceTitle', 'sourceHref'])
    && (item.isDone === undefined || typeof item.isDone === 'boolean') && stamp(item) && sync(item)),
  reminderDeletions: tombstones,
  settings: (value) => object(value) && strings(value, ['workspaceName', 'teamName', 'timezone', 'themePreference']),
  journalEntries: (value) => object(value) && Object.values(value).every((entry) => object(entry) && strings(entry, ['date', 'onMyMind', 'feelsHeavy', 'oneNextThing', 'todaySuccess']) && stamp(entry)
    && (entry.prompts === undefined || (object(entry.prompts) && Object.values(entry.prompts).every((text) => typeof text === 'string')))),
  notebookPages: (value) => object(value) && records(value.pages, (page) => typeof page.title === 'string'
    && strings(page, ['section', 'pageDate', 'sourceUrl', 'createdAt']) && stamp(page) && sync(page)
    && object(page.blocks) && Object.values(page.blocks).every(richDocument)) && tombstones(value.deletedPageIds)
    && (value.journalImported === undefined || typeof value.journalImported === 'boolean'),
  weeklyBriefs: (value) => object(value) && Object.entries(value).every(([key, week]) => /^\d{4}-\d{2}-\d{2}$/.test(key) && object(week)
    && typeof week.reviewNotes === 'string' && ['priorities', 'wins', 'blockers'].every((collection) => records(week[collection], weeklyItem))),
};
for (const domain of ['notebookCards', 'notebookQuestions', 'notebookIdeas']) {
  checks[domain] = (value) => object(value) && records(value.items, (item) => typeof item.pageId === 'string'
    && strings(item, ['sourceText', 'sourceBlock', 'prompt', 'answer', 'text', 'title', 'description', 'category', 'status', 'createdAt'])
    && stamp(item) && sync(item) && (item.schedule === undefined || (object(item.schedule)
      && ['ease', 'intervalDays', 'repetitionCount', 'nextReviewAt', 'gradedAt'].every((field) => item.schedule[field] === undefined || typeof item.schedule[field] === 'string' || Number.isFinite(item.schedule[field]))))) && tombstones(value.deletedIds);
}
export function validateDomainData(domain, value) {
  if (!checks[domain]?.(value)) throw new Error(`The ${domain} data has an unsupported shape. Keep the original file for recovery.`);
  return value;
}
export function decodeStoredDomain(domain, value) {
  const decoded = readVersionedStoragePayload(domain, value);
  if (decoded.isDomainMismatch) throw new Error('The saved data belongs to a different domain.');
  const migrated = migrateStoragePayload(domain, decoded.schemaVersion, decoded.data);
  return validateDomainData(domain, migrated.data);
}
export const RECOVERABLE_STORAGE_KEYS = new Set([
  ...Object.values(STORAGE_SCHEMAS).map((schema) => schema.key),
  'ceo-os-theme', 'ceo-os-workspace-setup', 'ceo-os-weekly-review-notes',
  'ceo-os-weekly-priorities', 'ceo-os-weekly-wins', 'ceo-os-weekly-blockers', 'ceo-os-offline-write-queue',
]);
export function validateStorageRaw(key, raw) {
  const domain = Object.keys(STORAGE_SCHEMAS).find((name) => STORAGE_SCHEMAS[name].key === key);
  // These historical note keys stored plain text before envelopes existed.
  if (key === 'ceo-os-weekly-review-notes') return raw;
  let parsed;
  try { parsed = JSON.parse(raw); }
  catch (error) {
    // Legacy Chief notes were free text, including lists and code snippets.
    // A damaged envelope must still be preserved instead of rendered as notes.
    if (key === 'ceo-os-chief-notes' && !/"(?:schemaVersion|domain)"\s*:/.test(raw)) return raw;
    throw error;
  }
  if (domain) return decodeStoredDomain(domain, parsed);
  if (key === 'ceo-os-theme') {
    if (!['light', 'dark', 'system'].includes(parsed)) throw new Error('Unsupported theme preference.');
  } else if (key === 'ceo-os-workspace-setup') {
    if (!['blank', 'demo'].includes(object(parsed) ? parsed.mode : parsed)) throw new Error('Unsupported workspace setup.');
  } else if (/^ceo-os-weekly-(priorities|wins|blockers)$/.test(key)) {
    if (!records(parsed, weeklyItem)) throw new Error('Unsupported weekly item data.');
  } else if (key === 'ceo-os-offline-write-queue') {
    if (!records(parsed, (item) => typeof item.kind === 'string')) throw new Error('Unsupported pending-write data.');
  }
  return parsed;
}

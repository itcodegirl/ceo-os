export const CURRENT_DATA_SCHEMA_VERSION = 1;

// Storage domains declared in the central registry. Each maps to a single
// browser-storage key — when a domain needs more than one physical key (the
// chief workspace currently splits notes and responses), declare both here so
// the schema stays an honest description of what's on disk.
export const STORAGE_DOMAINS = Object.freeze({
  captureNotes: 'captureNotes',
  chiefNotes: 'chiefNotes',
  chiefResponses: 'chiefResponses',
  contentItems: 'contentItems',
  journalEntries: 'journalEntries',
  opportunities: 'opportunities',
  reminders: 'reminders',
  settings: 'settings',
  weeklyBriefs: 'weeklyBriefs',
});

export const DOMAIN_MODELS = Object.freeze({
  CaptureNote: Object.freeze({
    id: 'string',
    text: 'string',
    category: 'idea|task|content|opportunity|journal',
    createdAt: 'number',
    updatedAt: 'number',
  }),
  ChiefNotes: 'string',
  ChiefResponse: Object.freeze({
    id: 'string',
    title: 'string',
    content: 'string',
    source: 'proxy|local',
    fallbackReason: 'string',
    errorCode: 'string',
    errorMessage: 'string',
    structuredPayload: 'object',
  }),
  ContentItem: Object.freeze({
    id: 'string',
    title: 'string',
    platform: 'string',
    contentType: 'Post|Article|Newsletter|Video|Thread|Talk|Other',
    status: 'Idea|Drafting|Editing|Ready|Scheduled|Published',
    purpose: 'string',
    scheduledFor: 'YYYY-MM-DD|empty',
    notes: 'string',
    updatedAt: 'number',
  }),
  JournalEntry: Object.freeze({
    date: 'YYYY-MM-DD',
    prompts: 'Record<string,string>',
    updatedAt: 'number',
  }),
  Opportunity: Object.freeze({
    id: 'string',
    name: 'string',
    company: 'string',
    priority: 'High|Medium|Low',
    stage: 'string',
    nextStep: 'string',
    updatedAt: 'number',
  }),
  Reminder: Object.freeze({
    id: 'string',
    text: 'string',
    isDone: 'boolean',
    completedAt: 'number|null',
    updatedAt: 'number',
  }),
  Settings: Object.freeze({
    workspaceName: 'string',
    teamName: 'string',
    timezone: 'string',
    themePreference: 'system|dark|light',
  }),
  WeeklyBriefStore: Object.freeze({
    '[weekStart]': 'WeeklyBrief',
  }),
  WeeklyBrief: Object.freeze({
    reviewNotes: 'string',
    priorities: 'WeeklyPriority[]',
    wins: 'WeeklyWin[]',
    blockers: 'WeeklyBlocker[]',
  }),
});

export const STORAGE_SCHEMAS = Object.freeze({
  [STORAGE_DOMAINS.captureNotes]: Object.freeze({
    key: 'ceo-os-capture-notes',
    model: 'CaptureNote[]',
    version: CURRENT_DATA_SCHEMA_VERSION,
  }),
  // Chief workspace is split across two physical keys (plain-text notes
  // separate from the structured response history) so the schema declares
  // both. The two domains share the `chief workspace` concept in the UI but
  // are persisted independently because notes are saved on every keystroke
  // while responses are appended once per generation.
  [STORAGE_DOMAINS.chiefNotes]: Object.freeze({
    key: 'ceo-os-chief-notes',
    model: 'ChiefNotes',
    version: CURRENT_DATA_SCHEMA_VERSION,
  }),
  [STORAGE_DOMAINS.chiefResponses]: Object.freeze({
    key: 'ceo-os-chief-responses',
    model: 'ChiefResponse[]',
    version: CURRENT_DATA_SCHEMA_VERSION,
  }),
  [STORAGE_DOMAINS.contentItems]: Object.freeze({
    key: 'ceo-os-content-items',
    model: 'ContentItem[]',
    version: CURRENT_DATA_SCHEMA_VERSION,
  }),
  [STORAGE_DOMAINS.journalEntries]: Object.freeze({
    key: 'ceo-os-journal-entries',
    model: 'Record<string,JournalEntry>',
    version: CURRENT_DATA_SCHEMA_VERSION,
  }),
  [STORAGE_DOMAINS.opportunities]: Object.freeze({
    key: 'ceo-os-opportunities',
    model: 'Opportunity[]',
    version: CURRENT_DATA_SCHEMA_VERSION,
  }),
  [STORAGE_DOMAINS.reminders]: Object.freeze({
    key: 'ceo-os-reminders',
    model: 'Reminder[]',
    version: CURRENT_DATA_SCHEMA_VERSION,
  }),
  [STORAGE_DOMAINS.settings]: Object.freeze({
    key: 'ceo-os-settings',
    model: 'Settings',
    version: CURRENT_DATA_SCHEMA_VERSION,
  }),
  [STORAGE_DOMAINS.weeklyBriefs]: Object.freeze({
    key: 'ceo-os-weekly-briefs',
    model: 'WeeklyBriefStore',
    version: CURRENT_DATA_SCHEMA_VERSION,
  }),
});

export function getStorageSchema(domain) {
  return STORAGE_SCHEMAS[domain] || null;
}

export function createVersionedStorageEnvelope(domain, data) {
  const schema = getStorageSchema(domain);
  if (!schema) {
    throw new Error(`Unknown storage schema domain: ${domain}`);
  }

  return {
    schemaVersion: schema.version,
    domain,
    model: schema.model,
    data,
  };
}

export function isVersionedStorageEnvelope(value) {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Number.isFinite(Number(value.schemaVersion))
    && Object.prototype.hasOwnProperty.call(value, 'data');
}

export function readVersionedStoragePayload(domain, value) {
  if (!isVersionedStorageEnvelope(value)) {
    return {
      data: value,
      schemaVersion: 0,
      isLegacy: true,
    };
  }

  if (value.domain && value.domain !== domain) {
    return {
      data: null,
      schemaVersion: Number(value.schemaVersion) || 0,
      isLegacy: false,
      isDomainMismatch: true,
    };
  }

  return {
    data: value.data,
    schemaVersion: Number(value.schemaVersion) || 0,
    isLegacy: false,
  };
}

import { CAPTURE_NOTES_UPDATED_EVENT } from './captureRepository';
import { CONTENT_ITEMS_UPDATED_EVENT } from './contentRepository';
import { JOURNAL_ENTRIES_UPDATED_EVENT } from './journalRepository';
import { NOTEBOOK_PAGES_STORAGE_KEY, NOTEBOOK_PAGES_UPDATED_EVENT } from './notebook/notebookPagesRepository';
import { NOTEBOOK_ITEMS_STORAGE_KEYS, NOTEBOOK_ITEMS_UPDATED_EVENT } from './notebook/items/notebookItemsRepository';
import { OFFLINE_QUEUE_STORAGE_KEY, OFFLINE_QUEUE_UPDATED_EVENT } from './offlineWriteQueue';
import { OPPORTUNITIES_UPDATED_EVENT } from './opportunitiesRepository';
import { REMINDERS_UPDATED_EVENT } from './remindersRepository';
import { SETTINGS_UPDATED_EVENT } from './settingsRepository';
import { THEME_STORAGE_KEY } from './themePreference';
import { WEEKLY_BRIEF_UPDATED_EVENT } from './weeklyRepository';
import { WORKSPACE_SETUP_UPDATED_EVENT } from './workspaceSetup';

export const WORKSPACE_BACKUP_FORMAT = 'codeherway-ceo-os-local-backup';
export const WORKSPACE_BACKUP_SCHEMA_VERSION = 1;
export const WORKSPACE_BACKUP_IMPORTED_EVENT = 'ceo-os:workspace-backup-imported';

const STORAGE_TYPES = {
  json: 'json',
  rawText: 'rawText',
  numericText: 'numericText',
};

const SETTINGS_SAVED_AT_KEY = 'ceo-os-settings-saved-at';

export const WORKSPACE_BACKUP_KEY_DEFINITIONS = Object.freeze([
  {
    key: 'ceo-os-workspace-setup',
    label: 'Workspace setup',
    storageType: STORAGE_TYPES.json,
    eventName: WORKSPACE_SETUP_UPDATED_EVENT,
    summaryType: 'preference',
  },
  {
    key: 'ceo-os-settings',
    label: 'Settings',
    storageType: STORAGE_TYPES.json,
    eventName: SETTINGS_UPDATED_EVENT,
    summaryType: 'profile',
  },
  {
    key: SETTINGS_SAVED_AT_KEY,
    label: 'Settings saved timestamp',
    storageType: STORAGE_TYPES.numericText,
    eventName: SETTINGS_UPDATED_EVENT,
    summaryType: 'timestamp',
    countAsRecord: false,
  },
  {
    key: THEME_STORAGE_KEY,
    label: 'Theme preference',
    storageType: STORAGE_TYPES.json,
    summaryType: 'preference',
    countAsRecord: false,
  },
  {
    key: 'ceo-os-capture-notes',
    label: 'Capture notes',
    storageType: STORAGE_TYPES.json,
    eventName: CAPTURE_NOTES_UPDATED_EVENT,
    summaryType: 'array',
  },
  {
    key: 'ceo-os-journal-entries',
    label: 'Journal entries',
    storageType: STORAGE_TYPES.json,
    eventName: JOURNAL_ENTRIES_UPDATED_EVENT,
    summaryType: 'objectValues',
  },
  {
    key: NOTEBOOK_PAGES_STORAGE_KEY,
    label: 'Notebook pages',
    storageType: STORAGE_TYPES.json,
    eventName: NOTEBOOK_PAGES_UPDATED_EVENT,
    summaryType: 'notebookPages',
  },
  {
    key: NOTEBOOK_ITEMS_STORAGE_KEYS.card,
    label: 'Notebook cards',
    storageType: STORAGE_TYPES.json,
    eventName: NOTEBOOK_ITEMS_UPDATED_EVENT,
    summaryType: 'notebookItems',
  },
  {
    key: NOTEBOOK_ITEMS_STORAGE_KEYS.question,
    label: 'Notebook questions',
    storageType: STORAGE_TYPES.json,
    eventName: NOTEBOOK_ITEMS_UPDATED_EVENT,
    summaryType: 'notebookItems',
  },
  {
    key: NOTEBOOK_ITEMS_STORAGE_KEYS.idea,
    label: 'Notebook ideas',
    storageType: STORAGE_TYPES.json,
    eventName: NOTEBOOK_ITEMS_UPDATED_EVENT,
    summaryType: 'notebookItems',
  },
  {
    key: 'ceo-os-reminders',
    label: 'Reminders',
    storageType: STORAGE_TYPES.json,
    eventName: REMINDERS_UPDATED_EVENT,
    summaryType: 'array',
  },
  {
    key: 'ceo-os-opportunities',
    label: 'Opportunities',
    storageType: STORAGE_TYPES.json,
    eventName: OPPORTUNITIES_UPDATED_EVENT,
    summaryType: 'array',
  },
  {
    key: 'ceo-os-content-items',
    label: 'Content items',
    storageType: STORAGE_TYPES.json,
    eventName: CONTENT_ITEMS_UPDATED_EVENT,
    summaryType: 'array',
  },
  {
    key: 'ceo-os-weekly-briefs',
    label: 'Weekly briefs',
    storageType: STORAGE_TYPES.json,
    eventName: WEEKLY_BRIEF_UPDATED_EVENT,
    summaryType: 'weeklyBriefs',
  },
  {
    key: 'ceo-os-weekly-priorities',
    label: 'Legacy weekly priorities',
    storageType: STORAGE_TYPES.json,
    eventName: WEEKLY_BRIEF_UPDATED_EVENT,
    summaryType: 'array',
  },
  {
    key: 'ceo-os-weekly-wins',
    label: 'Legacy weekly wins',
    storageType: STORAGE_TYPES.json,
    eventName: WEEKLY_BRIEF_UPDATED_EVENT,
    summaryType: 'array',
  },
  {
    key: 'ceo-os-weekly-blockers',
    label: 'Legacy weekly blockers',
    storageType: STORAGE_TYPES.json,
    eventName: WEEKLY_BRIEF_UPDATED_EVENT,
    summaryType: 'array',
  },
  {
    key: 'ceo-os-weekly-review-notes',
    label: 'Legacy weekly review notes',
    storageType: STORAGE_TYPES.rawText,
    eventName: WEEKLY_BRIEF_UPDATED_EVENT,
    summaryType: 'text',
  },
  {
    key: 'ceo-os-chief-notes',
    label: 'Chief notes',
    storageType: STORAGE_TYPES.rawText,
    summaryType: 'text',
  },
  {
    key: 'ceo-os-chief-responses',
    label: 'Chief outputs',
    storageType: STORAGE_TYPES.json,
    summaryType: 'array',
  },
]);

function safeStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function parseJson(raw) {
  try {
    return { value: JSON.parse(raw), isValid: true };
  } catch {
    return { value: null, isValid: false };
  }
}

function validateRawStorageValue(definition, rawValue) {
  if (typeof rawValue !== 'string') {
    return {
      isValid: false,
      reason: `${definition.label} must be stored as text.`,
    };
  }

  if (definition.storageType === STORAGE_TYPES.json) {
    const parsed = parseJson(rawValue);
    return parsed.isValid
      ? { isValid: true, parsedValue: parsed.value }
      : { isValid: false, reason: `${definition.label} is not valid JSON.` };
  }

  if (definition.storageType === STORAGE_TYPES.numericText) {
    const numericValue = Number(rawValue);
    return Number.isFinite(numericValue) && numericValue >= 0
      ? { isValid: true, parsedValue: numericValue }
      : { isValid: false, reason: `${definition.label} is not a valid timestamp.` };
  }

  return { isValid: true, parsedValue: rawValue };
}

function normalizeBackupValue(definition, value) {
  if (typeof value === 'string') {
    return value;
  }

  if (definition.storageType === STORAGE_TYPES.numericText && Number.isFinite(Number(value))) {
    return String(value);
  }

  if (definition.storageType === STORAGE_TYPES.json) {
    return JSON.stringify(value);
  }

  return null;
}

function unwrapWeeklyBriefStore(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }

  if (value.data && typeof value.data === 'object' && !Array.isArray(value.data)) {
    return value.data;
  }

  return value;
}

function countWeeklyBriefItems(value) {
  const store = unwrapWeeklyBriefStore(value);
  return Object.values(store).reduce((total, week) => {
    if (!week || typeof week !== 'object') {
      return total;
    }
    const priorities = Array.isArray(week.priorities) ? week.priorities.length : 0;
    const wins = Array.isArray(week.wins) ? week.wins.length : 0;
    const blockers = Array.isArray(week.blockers) ? week.blockers.length : 0;
    const reviewNotes = typeof week.reviewNotes === 'string' && week.reviewNotes.trim() ? 1 : 0;
    return total + priorities + wins + blockers + reviewNotes;
  }, 0);
}

// Notebook stores are versioned envelopes around { pages } or { items }.
function countNotebookRecords(value, listName) {
  const store = value && typeof value === 'object' && value.data && typeof value.data === 'object'
    ? value.data
    : value;
  return Array.isArray(store?.[listName]) ? store[listName].length : 0;
}

function countRecords(definition, validation) {
  if (definition.countAsRecord === false || !validation.isValid) {
    return 0;
  }

  const value = validation.parsedValue;
  if (definition.summaryType === 'array') {
    return Array.isArray(value) ? value.length : 0;
  }

  if (definition.summaryType === 'objectValues') {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? Object.keys(value).length
      : 0;
  }

  if (definition.summaryType === 'weeklyBriefs') {
    return countWeeklyBriefItems(value);
  }

  if (definition.summaryType === 'notebookPages') {
    return countNotebookRecords(value, 'pages');
  }

  if (definition.summaryType === 'notebookItems') {
    return countNotebookRecords(value, 'items');
  }

  if (definition.summaryType === 'text') {
    return typeof value === 'string' && value.trim() ? 1 : 0;
  }

  if (definition.summaryType === 'profile' || definition.summaryType === 'preference') {
    return 1;
  }

  return 0;
}

function buildStoreSummary(definition, rawValue) {
  if (rawValue === null || rawValue === undefined) {
    return {
      key: definition.key,
      label: definition.label,
      isPresent: false,
      isValid: true,
      recordCount: 0,
    };
  }

  const validation = validateRawStorageValue(definition, rawValue);
  return {
    key: definition.key,
    label: definition.label,
    isPresent: true,
    isValid: validation.isValid,
    reason: validation.reason || '',
    recordCount: countRecords(definition, validation),
  };
}

function readOfflineQueueSize(storage) {
  try {
    const raw = storage?.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) {
      return 0;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

function readSettingsSavedAt(storage) {
  try {
    const raw = storage?.getItem(SETTINGS_SAVED_AT_KEY);
    const value = Number(raw);
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function getStorageOrThrow(storage) {
  const resolvedStorage = storage || safeStorage();
  if (!resolvedStorage) {
    throw new Error('Local workspace storage is not available in this browser.');
  }
  return resolvedStorage;
}

export function getLocalWorkspaceDataHealth(options = {}) {
  const storage = options.storage || safeStorage();
  if (!storage) {
    return {
      isAvailable: false,
      stores: [],
      restorableStoreCount: 0,
      invalidStoreCount: 0,
      localRecordCount: 0,
      pendingSyncCount: 0,
      lastSettingsSavedAt: 0,
    };
  }

  const stores = WORKSPACE_BACKUP_KEY_DEFINITIONS.map((definition) =>
    buildStoreSummary(definition, storage.getItem(definition.key)));
  const presentStores = stores.filter((store) => store.isPresent);
  const validStores = presentStores.filter((store) => store.isValid);

  return {
    isAvailable: true,
    stores,
    restorableStoreCount: validStores.length,
    invalidStoreCount: presentStores.length - validStores.length,
    localRecordCount: validStores.reduce((total, store) => total + store.recordCount, 0),
    pendingSyncCount: readOfflineQueueSize(storage),
    lastSettingsSavedAt: readSettingsSavedAt(storage),
  };
}

export function buildWorkspaceBackup(options = {}) {
  const storage = getStorageOrThrow(options.storage);
  const now = options.now instanceof Date ? options.now : new Date();
  const keys = {};
  const skipped = [];

  WORKSPACE_BACKUP_KEY_DEFINITIONS.forEach((definition) => {
    const rawValue = storage.getItem(definition.key);
    if (rawValue === null || rawValue === undefined) {
      return;
    }

    const validation = validateRawStorageValue(definition, rawValue);
    if (!validation.isValid) {
      skipped.push({
        key: definition.key,
        label: definition.label,
        reason: validation.reason,
      });
      return;
    }

    keys[definition.key] = rawValue;
  });

  const health = getLocalWorkspaceDataHealth({ storage });

  return {
    format: WORKSPACE_BACKUP_FORMAT,
    schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
    exportedAt: now.toISOString(),
    source: 'localStorage',
    keys,
    skipped,
    summary: {
      includedStoreCount: Object.keys(keys).length,
      skippedStoreCount: skipped.length,
      localRecordCount: health.localRecordCount,
      pendingSyncCount: health.pendingSyncCount,
      pendingSyncIncluded: false,
    },
  };
}

function parseBackup(input) {
  if (typeof input === 'string') {
    try {
      return JSON.parse(input);
    } catch {
      throw new Error('Backup file is not valid JSON.');
    }
  }

  return input;
}

function validateBackupEnvelope(backup) {
  if (!backup || typeof backup !== 'object' || Array.isArray(backup)) {
    throw new Error('Backup file is not a supported CEO OS backup.');
  }

  if (backup.format !== WORKSPACE_BACKUP_FORMAT) {
    throw new Error('Backup file is not a supported CEO OS backup.');
  }

  const schemaVersion = Number(backup.schemaVersion);
  if (!Number.isFinite(schemaVersion) || schemaVersion < 1) {
    throw new Error('Backup file is missing a supported schema version.');
  }

  if (schemaVersion > WORKSPACE_BACKUP_SCHEMA_VERSION) {
    throw new Error('Backup file was created by a newer CEO OS version.');
  }

  const keys = backup.keys;
  if (!keys || typeof keys !== 'object' || Array.isArray(keys)) {
    throw new Error('Backup file does not include restorable local data.');
  }

  return keys;
}

function dispatchStorageRefresh(key) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  try {
    if (typeof StorageEvent === 'function') {
      window.dispatchEvent(new StorageEvent('storage', { key }));
      return;
    }
  } catch {
    // Fall through to a plain event with a key property.
  }

  try {
    const event = new Event('storage');
    Object.defineProperty(event, 'key', { value: key });
    window.dispatchEvent(event);
  } catch {
    // ignore refresh failures
  }
}

function dispatchImportEvents(importedDefinitions) {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') {
    return;
  }

  const eventNames = new Set(
    importedDefinitions
      .map((definition) => definition.eventName)
      .filter((eventName) => typeof eventName === 'string' && eventName),
  );

  importedDefinitions.forEach((definition) => {
    dispatchStorageRefresh(definition.key);
  });

  eventNames.forEach((eventName) => {
    window.dispatchEvent(new CustomEvent(eventName, {
      detail: { source: 'local', type: 'backup_import' },
    }));
  });

  window.dispatchEvent(new CustomEvent(WORKSPACE_BACKUP_IMPORTED_EVENT, {
    detail: {
      importedStoreCount: importedDefinitions.length,
    },
  }));

  if (importedDefinitions.some((definition) => definition.key === OFFLINE_QUEUE_STORAGE_KEY)) {
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_UPDATED_EVENT));
  }
}

export function importWorkspaceBackup(input, options = {}) {
  const storage = getStorageOrThrow(options.storage);
  const backup = parseBackup(input);
  const backupKeys = validateBackupEnvelope(backup);
  const definitionsByKey = new Map(
    WORKSPACE_BACKUP_KEY_DEFINITIONS.map((definition) => [definition.key, definition]),
  );
  const entriesToImport = [];

  Object.entries(backupKeys).forEach(([key, value]) => {
    const definition = definitionsByKey.get(key);
    if (!definition) {
      return;
    }

    const rawValue = normalizeBackupValue(definition, value);
    if (rawValue === null) {
      throw new Error(`${definition.label} cannot be restored from this backup.`);
    }

    const validation = validateRawStorageValue(definition, rawValue);
    if (!validation.isValid) {
      throw new Error(validation.reason);
    }

    entriesToImport.push({
      definition,
      rawValue,
    });
  });

  if (entriesToImport.length === 0) {
    throw new Error('Backup file does not include restorable local data.');
  }

  entriesToImport.forEach(({ definition, rawValue }) => {
    storage.setItem(definition.key, rawValue);
  });

  dispatchImportEvents(entriesToImport.map((entry) => entry.definition));

  return {
    importedStoreCount: entriesToImport.length,
    importedKeys: entriesToImport.map((entry) => entry.definition.key),
    ignoredKeyCount: Object.keys(backupKeys).length - entriesToImport.length,
  };
}

export function buildWorkspaceBackupFileName(exportedAt = new Date()) {
  const date = exportedAt instanceof Date ? exportedAt : new Date(exportedAt);
  const safeTimestamp = Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();

  return `codeherway-ceo-os-backup-${safeTimestamp.replace(/[:.]/g, '-')}.json`;
}

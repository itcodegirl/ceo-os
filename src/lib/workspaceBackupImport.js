import { applyStorageImport } from './importRecovery';
// Loaded only when a backup is selected, keeping restoration code off the
// initial Settings route. Validation completes before any storage writes.
import { accountBackupValue } from './workspaceBackupOwnership';
import { getWorkspaceOwnerId } from './workspaceOwnership';
import { OFFLINE_QUEUE_STORAGE_KEY, OFFLINE_QUEUE_UPDATED_EVENT } from './offlineWriteQueue';
import { WORKSPACE_BACKUP_FORMAT, WORKSPACE_BACKUP_SCHEMA_VERSION, WORKSPACE_BACKUP_IMPORTED_EVENT,
  WORKSPACE_BACKUP_KEY_DEFINITIONS, validateRawStorageValue, getStorageOrThrow } from './workspacePortability';

function normalizeBackupValue(definition, value) {
  if (typeof value === 'string') {
    return value;
  }

  if (definition.storageType === 'numericText' && Number.isFinite(Number(value))) {
    return String(value);
  }

  if (definition.storageType === 'json') {
    return JSON.stringify(value);
  }

  return null;
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
  if (!Number.isInteger(schemaVersion) || schemaVersion < 1) {
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

export function previewWorkspaceBackup(input, options = {}) {
  const storage = getStorageOrThrow(options.storage);
  const backup = parseBackup(input);
  const backupKeys = validateBackupEnvelope(backup);
  if (typeof backup.workspaceOwnerId === 'string' && backup.workspaceOwnerId !== getWorkspaceOwnerId()) {
    throw new Error('This backup belongs to another workspace. Switch to its original account before importing.');
  }
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
      rawValue: accountBackupValue(definition.key, rawValue, { existingRaw: storage.getItem(definition.key), importing: true, backupOwnerVerified: backup.workspaceOwnerId === getWorkspaceOwnerId() }),
    });
  });

  if (entriesToImport.length === 0) {
    throw new Error('Backup file does not include restorable local data.');
  }

  return {
    input, ownerId: getWorkspaceOwnerId(), entries: entriesToImport,
    before: Object.fromEntries(entriesToImport.map(({ definition }) => [definition.key, storage.getItem(definition.key)])),
    stores: entriesToImport.map(({ definition }) => ({ key: definition.key, label: definition.label, replacesExisting: storage.getItem(definition.key) !== null })),
    ignoredKeyCount: Object.keys(backupKeys).length - entriesToImport.length,
  };
}

export function importWorkspaceBackup(input, options = {}) {
  const storage = getStorageOrThrow(options.storage);
  if (options.preview && options.preview.ownerId !== getWorkspaceOwnerId()) throw new Error('Your account changed. Choose the backup again in the correct workspace.');
  const plan = previewWorkspaceBackup(input, options);
  if (options.preview && Object.entries(options.preview.before).some(([key, raw]) => storage.getItem(key) !== raw)) {
    throw new Error('The workspace changed since this preview. Choose the backup again before replacing data.');
  }
  const recoveryKey = applyStorageImport(plan.entries, { storage, ownerId: plan.ownerId });
  dispatchImportEvents(plan.entries.map((entry) => entry.definition));
  return { importedStoreCount: plan.entries.length, importedKeys: plan.stores.map((store) => store.key), ignoredKeyCount: plan.ignoredKeyCount, recoveryKey };
}

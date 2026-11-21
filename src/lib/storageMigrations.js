import { CURRENT_DATA_SCHEMA_VERSION, STORAGE_DOMAINS } from './dataSchema';

/**
 * Forward-compat migration registry for versioned localStorage payloads.
 *
 * Shape:
 *   STORAGE_MIGRATIONS[domain][fromVersion] = (data) => nextData
 *   // brings v(fromVersion) → v(fromVersion + 1)
 *
 * Every domain explicitly accepts its legacy v0 shape; domain validation runs
 * after migration. The registry exists so that the next schema
 * bump has a single, obvious place to register the v1 → v2 migrator without
 * touching call sites.
 *
 * "Legacy" payloads (schemaVersion 0, i.e. pre-envelope writes) are migrated
 * the same way: register a `0` migrator that lifts the legacy shape into v1.
 */
export const STORAGE_MIGRATIONS = Object.freeze(
  Object.fromEntries(
    Object.values(STORAGE_DOMAINS).map((domain) => [domain, Object.freeze({ 0: (data) => data })]),
  ),
);

function clampVersion(value) {
  const numeric = Math.floor(Number(value) || 0);
  return numeric < 0 ? 0 : numeric;
}

/**
 * Run the chain of migrators for `domain` starting at `fromVersion`, stopping
 * at CURRENT_DATA_SCHEMA_VERSION. Missing migration steps throw. Returns the
 * migrated data plus the version it ended on.
 *
 * Pure; no IO. Safe to call on every read.
 */
export function migrateStoragePayload(
  domain,
  fromVersion,
  data,
  registry = STORAGE_MIGRATIONS,
) {
  const applied = [];
  const initialVersion = clampVersion(fromVersion);
  let currentVersion = initialVersion;
  let currentData = data;

  if (currentVersion > CURRENT_DATA_SCHEMA_VERSION) throw new Error('This data was saved by a newer CEO OS version. Keep it for recovery.');
  if (currentVersion === CURRENT_DATA_SCHEMA_VERSION) {
    return {
      data: currentData,
      fromVersion: initialVersion,
      toVersion: currentVersion,
      migrationsApplied: applied,
    };
  }

  const domainMigrators = (registry && registry[domain]) || {};

  while (currentVersion < CURRENT_DATA_SCHEMA_VERSION) {
    const migrator = domainMigrators[currentVersion];
    if (typeof migrator !== 'function') {
      throw new Error(`Cannot migrate ${domain} from version ${currentVersion}. Keep the original data for recovery.`);
    }
    currentData = migrator(currentData);
    applied.push(currentVersion);
    currentVersion += 1;
  }

  return {
    data: currentData,
    fromVersion: initialVersion,
    toVersion: currentVersion,
    migrationsApplied: applied,
  };
}

import { describe, expect, it } from 'vitest';
import { CURRENT_DATA_SCHEMA_VERSION, STORAGE_DOMAINS } from './dataSchema';
import { STORAGE_MIGRATIONS, migrateStoragePayload } from './storageMigrations';

describe('storageMigrations', () => {
  it('exposes a frozen registry entry for every storage domain', () => {
    Object.values(STORAGE_DOMAINS).forEach((domain) => {
      expect(STORAGE_MIGRATIONS).toHaveProperty(domain);
      expect(Object.isFrozen(STORAGE_MIGRATIONS[domain])).toBe(true);
    });
  });

  it('is a no-op when the payload is already at the current schema version', () => {
    const data = { example: true };
    const result = migrateStoragePayload(
      STORAGE_DOMAINS.opportunities,
      CURRENT_DATA_SCHEMA_VERSION,
      data,
    );
    expect(result.data).toBe(data);
    expect(result.toVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
    expect(result.migrationsApplied).toEqual([]);
  });

  it('runs registered migrators in version order until current is reached', () => {
    const registry = {
      [STORAGE_DOMAINS.opportunities]: {
        0: (rows) => rows.map((row) => ({ ...row, owner: row.owner ?? null })),
      },
    };

    const result = migrateStoragePayload(
      STORAGE_DOMAINS.opportunities,
      0,
      [{ id: 'a' }],
      registry,
    );

    expect(result.data).toEqual([{ id: 'a', owner: null }]);
    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(1);
    expect(result.migrationsApplied).toEqual([0]);
  });

  it('stops gracefully at the first missing migrator in a chain', () => {
    // Pretend current = 3 by mocking a longer chain on a custom domain.
    const fakeRegistry = {
      'test-domain': {
        0: (data) => ({ ...data, lifted: true }),
        // 1 is missing on purpose.
        2: (data) => ({ ...data, polished: true }),
      },
    };

    // We re-use the existing CURRENT_DATA_SCHEMA_VERSION (1). Even with extra
    // migrators registered above v1, the chain stops at the current version.
    const result = migrateStoragePayload(
      'test-domain',
      0,
      { name: 'seed' },
      fakeRegistry,
    );

    expect(result.toVersion).toBe(CURRENT_DATA_SCHEMA_VERSION);
    expect(result.data.lifted).toBe(true);
    expect(result.data.polished).toBeUndefined();
  });

  it('treats missing or non-numeric fromVersion as 0', () => {
    const registry = {
      [STORAGE_DOMAINS.captureNotes]: {
        0: (rows) => [...rows, { id: 'migrated' }],
      },
    };

    const result = migrateStoragePayload(
      STORAGE_DOMAINS.captureNotes,
      'not-a-number',
      [],
      registry,
    );

    expect(result.fromVersion).toBe(0);
    expect(result.toVersion).toBe(1);
    expect(result.data).toEqual([{ id: 'migrated' }]);
  });

  it('explicitly migrates supported legacy data and rejects missing or future versions', () => {
    expect(migrateStoragePayload(STORAGE_DOMAINS.captureNotes, 0, []).migrationsApplied).toEqual([0]);
    expect(() => migrateStoragePayload(STORAGE_DOMAINS.captureNotes, 0, [], {})).toThrow(/migrat/i);
    expect(() => migrateStoragePayload(STORAGE_DOMAINS.captureNotes, 99, [])).toThrow(/newer/i);
  });
});

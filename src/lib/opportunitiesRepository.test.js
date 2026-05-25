import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OPPORTUNITIES_UPDATED_EVENT,
  clearLocalOpportunityDemoData,
  createOpportunity,
  deleteOpportunity,
  listOpportunities,
  updateOpportunity,
} from './opportunitiesRepository';
import { StaleRecordError, isStaleRecordError } from './staleRecordError';
import { saveWorkspaceSetupMode } from './workspaceSetup';
import {
  CURRENT_DATA_SCHEMA_VERSION,
  STORAGE_DOMAINS,
  createVersionedStorageEnvelope,
} from './dataSchema';
import { DUPLICATE_RECORD_CODE } from './repositoryErrors';

describe('src/lib/opportunitiesRepository', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('rejects stale local opportunity updates without emitting a fake update event', async () => {
    const created = await createOpportunity({
      name: 'Portfolio partner',
      company: 'CodeHerWay',
      priority: 'High',
      stage: 'New',
      nextStep: 'Send intro',
    });
    const updateListener = vi.fn();
    window.addEventListener(OPPORTUNITIES_UPDATED_EVENT, updateListener);

    try {
      await expect(updateOpportunity('missing-opportunity', {
        name: 'Ghost opportunity',
        company: 'Nowhere',
        priority: 'Low',
        stage: 'New',
        nextStep: 'None',
      })).rejects.toThrow('Opportunity not found');
    } finally {
      window.removeEventListener(OPPORTUNITIES_UPDATED_EVENT, updateListener);
    }

    const items = await listOpportunities();
    expect(updateListener).not.toHaveBeenCalled();
    expect(items.some((item) => item.id === created.id && item.name === created.name)).toBe(true);
    expect(items.some((item) => item.name === 'Ghost opportunity')).toBe(false);
  });

  it('stamps updatedAt on local create and bumps it on local update', async () => {
    const created = await createOpportunity({
      name: 'Updated lead',
      company: 'Bookings',
      priority: 'High',
      stage: 'New',
      nextStep: 'Send brief',
    });
    expect(created.updatedAt).toBeTypeOf('number');
    expect(created.updatedAt).toBeGreaterThan(0);

    // Allow the clock to advance so we can prove updatedAt changes.
    await new Promise((resolve) => setTimeout(resolve, 5));

    const updated = await updateOpportunity(
      created.id,
      { ...created, nextStep: 'Send revised brief' },
      { expectedUpdatedAt: created.updatedAt },
    );

    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(updated.nextStep).toBe('Send revised brief');
  });

  it('rejects duplicate local opportunity creates without emitting an update event', async () => {
    saveWorkspaceSetupMode('blank');
    await createOpportunity({
      name: 'Advisory lead',
      company: 'Studio North',
      priority: 'High',
      stage: 'New',
      nextStep: 'Send deck',
    });
    const updateListener = vi.fn();
    window.addEventListener(OPPORTUNITIES_UPDATED_EVENT, updateListener);

    try {
      await expect(createOpportunity({
        name: ' advisory lead ',
        company: 'studio north',
        priority: 'Low',
        stage: 'New',
        nextStep: 'Follow up',
      })).rejects.toMatchObject({
        code: DUPLICATE_RECORD_CODE,
        message: 'This opportunity already exists for that company.',
      });
    } finally {
      window.removeEventListener(OPPORTUNITIES_UPDATED_EVENT, updateListener);
    }

    await expect(listOpportunities()).resolves.toHaveLength(1);
    expect(updateListener).not.toHaveBeenCalled();
  });

  it('rejects duplicate local opportunity updates without replacing either record', async () => {
    saveWorkspaceSetupMode('blank');
    const existing = await createOpportunity({
      name: 'Workshop sponsor',
      company: 'CodeHerWay',
      priority: 'High',
      stage: 'In Progress',
      nextStep: 'Send proposal',
    });
    const next = await createOpportunity({
      name: 'Podcast guest',
      company: 'Founder Studio',
      priority: 'Medium',
      stage: 'New',
      nextStep: 'Draft intro',
    });

    await expect(updateOpportunity(next.id, {
      ...next,
      name: existing.name,
      company: existing.company,
    }, { expectedUpdatedAt: next.updatedAt })).rejects.toMatchObject({
      code: DUPLICATE_RECORD_CODE,
    });

    const items = await listOpportunities();
    expect(items.find((item) => item.id === next.id)).toMatchObject({
      name: 'Podcast guest',
      company: 'Founder Studio',
    });
  });

  it('persists opportunities in a versioned schema envelope', async () => {
    saveWorkspaceSetupMode('blank');
    const created = await createOpportunity({
      name: 'Versioned lead',
      company: 'CodeHerWay',
      priority: 'High',
      stage: 'New',
      nextStep: 'Follow up',
    });

    const raw = JSON.parse(window.localStorage.getItem('ceo-os-opportunities'));
    expect(raw).toMatchObject({
      schemaVersion: CURRENT_DATA_SCHEMA_VERSION,
      domain: STORAGE_DOMAINS.opportunities,
      model: 'Opportunity[]',
    });
    expect(raw.data).toEqual([
      expect.objectContaining({ id: created.id, name: 'Versioned lead' }),
    ]);
  });

  it('continues reading legacy raw opportunity arrays', async () => {
    window.localStorage.setItem('ceo-os-opportunities', JSON.stringify([
      {
        id: 'legacy-opportunity',
        name: 'Legacy lead',
        company: 'Acme',
        priority: 'Medium',
        stage: 'New',
        nextStep: 'Reply',
        updatedAt: 1745190000000,
      },
    ]));

    await expect(listOpportunities()).resolves.toEqual([
      expect.objectContaining({ id: 'legacy-opportunity', name: 'Legacy lead' }),
    ]);
  });

  it('reads opportunities from the current schema envelope', async () => {
    window.localStorage.setItem(
      'ceo-os-opportunities',
      JSON.stringify(createVersionedStorageEnvelope(STORAGE_DOMAINS.opportunities, [
        {
          id: 'versioned-opportunity',
          name: 'Versioned lead',
          company: 'Acme',
          priority: 'Medium',
          stage: 'New',
          nextStep: 'Reply',
          updatedAt: 1745190000000,
        },
      ])),
    );

    await expect(listOpportunities()).resolves.toEqual([
      expect.objectContaining({ id: 'versioned-opportunity', name: 'Versioned lead' }),
    ]);
  });

  it('rejects a local update when the expected updatedAt is stale', async () => {
    const created = await createOpportunity({
      name: 'Conflict lead',
      company: 'TwoTabs',
      priority: 'Medium',
      stage: 'New',
      nextStep: 'Trigger conflict',
    });

    // Simulate another tab advancing the persisted record.
    await new Promise((resolve) => setTimeout(resolve, 2));
    await updateOpportunity(
      created.id,
      { ...created, nextStep: 'Tab B wrote here first' },
      { expectedUpdatedAt: created.updatedAt },
    );

    // Now simulate Tab A trying to save with the original timestamp.
    const updateListener = vi.fn();
    window.addEventListener(OPPORTUNITIES_UPDATED_EVENT, updateListener);
    try {
      await expect(
        updateOpportunity(
          created.id,
          { ...created, nextStep: 'Tab A wrote here second' },
          { expectedUpdatedAt: created.updatedAt },
        ),
      ).rejects.toMatchObject({ name: 'StaleRecordError' });
    } finally {
      window.removeEventListener(OPPORTUNITIES_UPDATED_EVENT, updateListener);
    }

    expect(updateListener).not.toHaveBeenCalled();
    const items = await listOpportunities();
    const persisted = items.find((item) => item.id === created.id);
    expect(persisted.nextStep).toBe('Tab B wrote here first');
  });

  it('skips the stale check when no expectedUpdatedAt is supplied (back-compat)', async () => {
    const created = await createOpportunity({
      name: 'Compat lead',
      company: 'Legacy',
      priority: 'Low',
      stage: 'New',
      nextStep: 'Untracked',
    });

    const updated = await updateOpportunity(created.id, {
      ...created,
      nextStep: 'Updated without timestamp',
    });

    expect(updated.nextStep).toBe('Updated without timestamp');
    expect(isStaleRecordError(new StaleRecordError())).toBe(true);
  });

  it('rejects stale local opportunity deletes without emitting a fake update event', async () => {
    const created = await createOpportunity({
      name: 'Conference lead',
      company: 'Founder Summit',
      priority: 'Medium',
      stage: 'Follow-up',
      nextStep: 'Book call',
    });
    const updateListener = vi.fn();
    window.addEventListener(OPPORTUNITIES_UPDATED_EVENT, updateListener);

    try {
      await expect(deleteOpportunity('missing-opportunity')).rejects.toThrow('Opportunity not found');
    } finally {
      window.removeEventListener(OPPORTUNITIES_UPDATED_EVENT, updateListener);
    }

    const items = await listOpportunities();
    expect(updateListener).not.toHaveBeenCalled();
    expect(items.some((item) => item.id === created.id && item.name === created.name)).toBe(true);
  });

  it('does not auto-seed demo opportunities after the workspace starts blank', async () => {
    saveWorkspaceSetupMode('blank');

    await expect(listOpportunities()).resolves.toEqual([]);
  });

  it('clears known demo opportunities without deleting user-created records', async () => {
    const created = await createOpportunity({
      name: 'Real founder pipeline',
      company: 'CodeHerWay',
      priority: 'High',
      stage: 'In Progress',
      nextStep: 'Send update',
    });

    clearLocalOpportunityDemoData();

    const items = await listOpportunities();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id: created.id, name: 'Real founder pipeline' });
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CURRENT_DATA_SCHEMA_VERSION,
  STORAGE_DOMAINS,
  createVersionedStorageEnvelope,
} from './dataSchema';
import {
  WEEKLY_BRIEF_UPDATED_EVENT,
  clearLocalWeeklyDemoData,
  countNonDemoLocalWeeklyRecords,
  createWeeklyItem,
  deleteWeeklyItem,
  getWeeklyBriefByWeek,
  saveWeeklyBriefReviewNotes,
  updateWeeklyItem,
} from './weeklyRepository';
import { saveWorkspaceSetupMode } from './workspaceSetup';

const weekStart = '2026-04-20';

describe('src/lib/weeklyRepository', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('rejects stale local item updates without emitting a fake update event', async () => {
    await createWeeklyItem({
      weekStart,
      itemType: 'priority',
      item: {
        id: 'priority-1',
        title: 'Ship planner',
        owner: 'Jenna',
        status: 'Planned',
      },
      emitEvent: false,
    });

    const updateListener = vi.fn();
    window.addEventListener(WEEKLY_BRIEF_UPDATED_EVENT, updateListener);

    try {
      await expect(updateWeeklyItem({
        weekStart,
        itemType: 'priority',
        itemId: 'missing-priority',
        item: {
          title: 'Stale priority',
          owner: 'Jenna',
          status: 'Done',
        },
      })).rejects.toThrow('Weekly item not found');
    } finally {
      window.removeEventListener(WEEKLY_BRIEF_UPDATED_EVENT, updateListener);
    }

    const brief = await getWeeklyBriefByWeek(weekStart);
    expect(updateListener).not.toHaveBeenCalled();
    expect(brief.priorities).toHaveLength(1);
    expect(brief.priorities[0]).toMatchObject({
      id: 'priority-1',
      title: 'Ship planner',
      owner: 'Jenna',
      status: 'Planned',
    });
  });

  it('rejects stale local item deletes without emitting a fake update event', async () => {
    await createWeeklyItem({
      weekStart,
      itemType: 'win',
      item: {
        id: 'win-1',
        text: 'Published case study',
        category: 'Portfolio',
      },
      emitEvent: false,
    });

    const updateListener = vi.fn();
    window.addEventListener(WEEKLY_BRIEF_UPDATED_EVENT, updateListener);

    try {
      await expect(deleteWeeklyItem({
        weekStart,
        itemType: 'win',
        itemId: 'missing-win',
      })).rejects.toThrow('Weekly item not found');
    } finally {
      window.removeEventListener(WEEKLY_BRIEF_UPDATED_EVENT, updateListener);
    }

    const brief = await getWeeklyBriefByWeek(weekStart);
    expect(updateListener).not.toHaveBeenCalled();
    expect(brief.wins).toHaveLength(1);
    expect(brief.wins[0]).toMatchObject({
      id: 'win-1',
      text: 'Published case study',
      category: 'Portfolio',
    });
  });

  it('rejects failed local review-note persistence before emitting an update event', async () => {
    const originalSetItem = window.localStorage.setItem;
    window.localStorage.setItem = vi.fn(() => {
      throw new Error('storage full');
    });
    const updateListener = vi.fn();
    window.addEventListener(WEEKLY_BRIEF_UPDATED_EVENT, updateListener);

    try {
      await expect(saveWeeklyBriefReviewNotes({
        weekStart,
        reviewNotes: 'Close the week with a clear next move.',
      })).rejects.toThrow('Failed to persist weekly brief data to localStorage');
    } finally {
      window.localStorage.setItem = originalSetItem;
      window.removeEventListener(WEEKLY_BRIEF_UPDATED_EVENT, updateListener);
    }

    expect(updateListener).not.toHaveBeenCalled();
  });

  it('persists weekly brief data in a versioned schema envelope', async () => {
    await createWeeklyItem({
      weekStart,
      itemType: 'priority',
      item: {
        id: 'priority-versioned',
        title: 'Keep storage recoverable',
        owner: 'Jenna',
        status: 'Planned',
      },
      emitEvent: false,
    });

    const raw = JSON.parse(window.localStorage.getItem('ceo-os-weekly-briefs'));

    expect(raw).toMatchObject({
      schemaVersion: CURRENT_DATA_SCHEMA_VERSION,
      domain: STORAGE_DOMAINS.weeklyBriefs,
      model: 'WeeklyBriefStore',
    });
    expect(raw.data[weekStart].priorities).toEqual([
      expect.objectContaining({
        id: 'priority-versioned',
        title: 'Keep storage recoverable',
      }),
    ]);
  });

  it('continues reading legacy weekly brief stores without a schema envelope', async () => {
    window.localStorage.setItem('ceo-os-weekly-briefs', JSON.stringify({
      [weekStart]: {
        reviewNotes: 'Legacy notes',
        priorities: [
          {
            id: 'legacy-priority',
            title: 'Legacy priority',
            owner: 'Jenna',
            status: 'Planned',
          },
        ],
        wins: [],
        blockers: [],
      },
    }));

    const brief = await getWeeklyBriefByWeek(weekStart);

    expect(brief.reviewNotes).toBe('Legacy notes');
    expect(brief.priorities).toEqual([
      expect.objectContaining({
        id: 'legacy-priority',
        title: 'Legacy priority',
      }),
    ]);
  });

  it('reads weekly brief data from the current schema envelope', async () => {
    window.localStorage.setItem('ceo-os-weekly-briefs', JSON.stringify(
      createVersionedStorageEnvelope(STORAGE_DOMAINS.weeklyBriefs, {
        [weekStart]: {
          reviewNotes: 'Versioned notes',
          priorities: [],
          wins: [
            {
              id: 'versioned-win',
              text: 'Added schema guard',
              category: 'Reliability',
            },
          ],
          blockers: [],
        },
      }),
    ));

    const brief = await getWeeklyBriefByWeek(weekStart);

    expect(brief.reviewNotes).toBe('Versioned notes');
    expect(brief.wins).toEqual([
      expect.objectContaining({
        id: 'versioned-win',
        text: 'Added schema guard',
      }),
    ]);
  });

  it('stamps updatedAt on local create and bumps it on local update', async () => {
    const created = await createWeeklyItem({
      weekStart,
      itemType: 'priority',
      item: {
        id: 'priority-stamped',
        title: 'Initial title',
        owner: 'Jenna',
        status: 'Planned',
      },
      emitEvent: false,
    });

    expect(created.updatedAt).toBeGreaterThan(0);

    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await updateWeeklyItem({
      weekStart,
      itemType: 'priority',
      itemId: 'priority-stamped',
      item: {
        ...created,
        title: 'Updated title',
      },
      expectedUpdatedAt: created.updatedAt,
      emitEvent: false,
    });

    expect(updated.updatedAt).toBeGreaterThan(created.updatedAt);
    expect(updated.title).toBe('Updated title');
  });

  it('rejects a local weekly update when expectedUpdatedAt is stale', async () => {
    const created = await createWeeklyItem({
      weekStart,
      itemType: 'win',
      item: {
        id: 'win-conflict',
        text: 'Original win text',
        category: 'Portfolio',
      },
      emitEvent: false,
    });

    // Simulate another tab writing to the persisted record.
    await new Promise((resolve) => setTimeout(resolve, 2));
    await updateWeeklyItem({
      weekStart,
      itemType: 'win',
      itemId: 'win-conflict',
      item: { ...created, text: 'Tab B saved first' },
      expectedUpdatedAt: created.updatedAt,
      emitEvent: false,
    });

    await expect(updateWeeklyItem({
      weekStart,
      itemType: 'win',
      itemId: 'win-conflict',
      item: { ...created, text: 'Tab A tried second' },
      expectedUpdatedAt: created.updatedAt,
      emitEvent: false,
    })).rejects.toMatchObject({ name: 'StaleRecordError' });

    const brief = await getWeeklyBriefByWeek(weekStart);
    const persisted = brief.wins.find((entry) => entry.id === 'win-conflict');
    expect(persisted.text).toBe('Tab B saved first');
  });

  it('skips the stale check when no expectedUpdatedAt is provided (back-compat)', async () => {
    const created = await createWeeklyItem({
      weekStart,
      itemType: 'blocker',
      item: {
        id: 'blocker-compat',
        text: 'Initial blocker',
        severity: 'warning',
      },
      emitEvent: false,
    });

    const updated = await updateWeeklyItem({
      weekStart,
      itemType: 'blocker',
      itemId: 'blocker-compat',
      item: { ...created, text: 'Updated without timestamp' },
      emitEvent: false,
    });

    expect(updated.text).toBe('Updated without timestamp');
  });

  it('rejects a local weekly delete when expectedUpdatedAt is stale', async () => {
    const created = await createWeeklyItem({
      weekStart,
      itemType: 'priority',
      item: {
        id: 'priority-delete-conflict',
        title: 'Original priority',
        owner: 'Jenna',
        status: 'Planned',
      },
      emitEvent: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 2));
    await updateWeeklyItem({
      weekStart,
      itemType: 'priority',
      itemId: 'priority-delete-conflict',
      item: { ...created, title: 'Tab B saved first' },
      expectedUpdatedAt: created.updatedAt,
      emitEvent: false,
    });

    await expect(deleteWeeklyItem({
      weekStart,
      itemType: 'priority',
      itemId: 'priority-delete-conflict',
      expectedUpdatedAt: created.updatedAt,
      emitEvent: false,
    })).rejects.toMatchObject({ name: 'StaleRecordError' });

    const brief = await getWeeklyBriefByWeek(weekStart);
    const persisted = brief.priorities.find((entry) => entry.id === 'priority-delete-conflict');
    expect(persisted.title).toBe('Tab B saved first');
  });

  it('does not auto-seed demo weekly items after the workspace starts blank', async () => {
    saveWorkspaceSetupMode('blank');

    const brief = await getWeeklyBriefByWeek(weekStart);

    expect(brief.priorities).toEqual([]);
    expect(brief.wins).toEqual([]);
    expect(brief.blockers).toEqual([]);
  });

  it('clears known demo weekly items without deleting user-created records', async () => {
    await createWeeklyItem({
      weekStart,
      itemType: 'priority',
      item: {
        id: 'real-priority',
        title: 'Real weekly priority',
        owner: 'Jenna',
        status: 'In Progress',
      },
      emitEvent: false,
    });

    clearLocalWeeklyDemoData(weekStart);

    const brief = await getWeeklyBriefByWeek(weekStart);
    expect(brief.priorities).toEqual([
      expect.objectContaining({ id: 'real-priority', title: 'Real weekly priority' }),
    ]);
  });

  // Guards the "Load demo workspace" confirmation. The reset swaps the whole
  // week payload, so review notes are lost alongside the items even though
  // notes carry no id — both must be counted.
  it('counts the weekly records and review notes a demo reset would destroy', async () => {
    saveWorkspaceSetupMode('demo');
    const baseline = countNonDemoLocalWeeklyRecords(weekStart);

    await createWeeklyItem({
      weekStart,
      itemType: 'priority',
      item: { id: 'priority-real', title: 'Real priority', status: 'Planned' },
    });
    expect(countNonDemoLocalWeeklyRecords(weekStart)).toBe(baseline + 1);

    await saveWeeklyBriefReviewNotes({ weekStart, reviewNotes: 'My own retro notes' });
    expect(countNonDemoLocalWeeklyRecords(weekStart)).toBe(baseline + 2);
  });
});

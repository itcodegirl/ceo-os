import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { previewWorkspaceSetupChange, applyWorkspaceSetupChange } from './workspaceDemoChange';
import { getOpportunityDemoSeed, listOpportunities, updateOpportunity } from './opportunitiesRepository';
import { getContentDemoSeed } from './contentRepository';
import { createDemoWeekPayload, getCurrentWeekStart } from './weeklyRepository';
import { listImportSnapshots, getImportRecovery } from './importRecovery';
const OPPS = 'ceo-os-opportunities';
const CONTENT = 'ceo-os-content-items';
const WEEKLY = 'ceo-os-weekly-briefs';
const MODE = 'ceo-os-workspace-setup';
const read = (key) => { const value = JSON.parse(localStorage.getItem(key)); return value?.data ?? value; };
const save = (key, value) => localStorage.setItem(key, JSON.stringify(value));
beforeEach(() => {
  localStorage.clear();
  save(OPPS, getOpportunityDemoSeed()); save(CONTENT, getContentDemoSeed());
  save(WEEKLY, { '2026-04-06': createDemoWeekPayload(), '2026-04-13': createDemoWeekPayload() });
  save(MODE, { mode: 'demo' });
});
afterEach(() => vi.restoreAllMocks());

describe('previewed, recoverable demo changes', () => {
  it('previews without writing, then clears unchanged examples in every stored week', async () => {
    const before = localStorage.getItem(WEEKLY);
    const plan = previewWorkspaceSetupChange('blank');
    expect(plan.weeks).toEqual(['2026-04-06', '2026-04-13', getCurrentWeekStart()]);
    expect(localStorage.getItem(WEEKLY)).toBe(before);
    expect(listImportSnapshots()).toHaveLength(0);
    await applyWorkspaceSetupChange(plan);
    for (const week of Object.values(read(WEEKLY))) expect([week.priorities, week.wins, week.blockers]).toEqual([[], [], []]);
    expect(read(MODE).mode).toBe('blank');
    expect(listImportSnapshots()[0].before[WEEKLY]).toBe(before);
  });
  it('preserves edited legacy seed IDs, authored records, and historical reflections', async () => {
    const seed = getOpportunityDemoSeed()[0];
    const mine = { ...seed, name: 'My real partnership' };
    save(OPPS, [mine, { id: 'mine', name: 'A new partner', company: '' }]);
    const weeks = read(WEEKLY); weeks['2026-04-06'].reviewNotes = 'Keep this reflection';
    weeks['2026-04-06'].priorities[0].title = 'My actual priority'; save(WEEKLY, weeks);
    const plan = previewWorkspaceSetupChange('blank');
    expect(plan.preserved).toBe(4);
    await applyWorkspaceSetupChange(plan);
    expect(read(OPPS)).toEqual([mine, { id: 'mine', name: 'A new partner', company: '' }]);
    expect(read(WEEKLY)['2026-04-06']).toMatchObject({ reviewNotes: 'Keep this reflection', priorities: [{ title: 'My actual priority' }] });
  });
  it('loads demo examples without replacing authored work and detaches provenance on edit', async () => {
    save(OPPS, [{ id: 'mine', name: 'Keep me', company: '' }]);
    await applyWorkspaceSetupChange(previewWorkspaceSetupChange('demo'));
    const seed = (await listOpportunities()).find((item) => item.demoSeed);
    expect(seed).toBeTruthy();
    // Saving even the same visible value makes the example authored work.
    await updateOpportunity(seed.id, seed, { expectedUpdatedAt: seed.updatedAt });
    await applyWorkspaceSetupChange(previewWorkspaceSetupChange('blank'));
    expect(read(OPPS).map((item) => item.id).sort()).toEqual(['mine', seed.id].sort());
    expect(read(OPPS).find((item) => item.id === seed.id).demoSeed).toBeUndefined();
  });
  it.each([CONTENT, WEEKLY, MODE])('rolls back all data and mode if %s cannot be written', async (failureKey) => {
    const plan = previewWorkspaceSetupChange('blank');
    const before = Object.fromEntries([OPPS, CONTENT, WEEKLY, MODE].map((key) => [key, localStorage.getItem(key)]));
    const set = localStorage.setItem.bind(localStorage);
    vi.spyOn(localStorage, 'setItem').mockImplementation((key, raw) => {
      if (key === failureKey && raw !== before[key]) throw new Error('quota');
      set(key, raw);
    });
    await expect(applyWorkspaceSetupChange(plan)).rejects.toThrow(/rolled back/);
    expect(Object.fromEntries(Object.keys(before).map((key) => [key, localStorage.getItem(key)]))).toEqual(before);
    expect(getImportRecovery()).toBeNull();
  });
  it('rejects changed data after preview instead of silently replacing a later edit', async () => {
    const plan = previewWorkspaceSetupChange('demo'); save(OPPS, [{ id: 'other', name: 'Newer work' }]);
    await expect(applyWorkspaceSetupChange(plan)).rejects.toThrow(/changed since/);
    expect(read(OPPS)[0].name).toBe('Newer work');
  });
  it('preserves legacy weekly work during setup and rejects unreadable stores before any change', async () => {
    localStorage.removeItem(WEEKLY);
    save('ceo-os-weekly-priorities', [{ id: 'mine', title: 'Old work' }]);
    await applyWorkspaceSetupChange(previewWorkspaceSetupChange('blank'));
    expect(Object.values(read(WEEKLY))[0].priorities[0].title).toBe('Old work');
    const mode = localStorage.getItem(MODE); localStorage.setItem(OPPS, '{broken');
    expect(() => previewWorkspaceSetupChange('demo')).toThrow();
    expect(localStorage.getItem(OPPS)).toBe('{broken'); expect(localStorage.getItem(MODE)).toBe(mode);
  });

  it('migrates current legacy work even when older versioned weeks already exist', async () => {
    save('ceo-os-weekly-priorities', [{ id: 'legacy-mine', title: 'Keep my current priority' }]);
    localStorage.setItem('ceo-os-weekly-review-notes', 'Current legacy reflection');
    await applyWorkspaceSetupChange(previewWorkspaceSetupChange('demo'));
    const current = read(WEEKLY)[getCurrentWeekStart()];
    expect(current.priorities).toContainEqual({ id: 'legacy-mine', title: 'Keep my current priority' });
    expect(current.reviewNotes).toBe('Current legacy reflection');
    expect(read(WEEKLY)['2026-04-06']).toBeDefined();
  });

  it('rejects a preview when a legacy source changes before its migration', async () => {
    const plan = previewWorkspaceSetupChange('blank');
    localStorage.setItem('ceo-os-weekly-review-notes', 'Written after the preview');
    await expect(applyWorkspaceSetupChange(plan)).rejects.toThrow(/changed since/);
    expect(localStorage.getItem('ceo-os-weekly-review-notes')).toBe('Written after the preview');
    expect(read(MODE).mode).toBe('demo');
  });
});

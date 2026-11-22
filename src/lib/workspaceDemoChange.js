import { getOpportunityDemoSeed } from './opportunitiesRepository';
import { getContentDemoSeed } from './contentRepository';
import { createDemoWeekPayload, getCurrentWeekStart } from './weeklyRepository';
import { createVersionedStorageEnvelope } from './dataSchema';
import { validateStorageRaw } from './storageValidation';
import { retainAuthoredRecords, mergeDemoSeeds } from './demoProvenance';
import { previewWorkspaceBackup, importWorkspaceBackup } from './workspaceBackupImport';
import { WORKSPACE_BACKUP_FORMAT } from './workspacePortability';
import { getWorkspaceOwnerId } from './workspaceOwnership';
import { withStorageLock } from './storageLock';

export function previewWorkspaceSetupChange(mode) {
  if (!['blank', 'demo'].includes(mode)) throw new Error('Choose a supported workspace mode.');
  const storage = window.localStorage;
  const keys = {};
  const readBefore = {};
  const weeks = [];
  let preserved = 0;
  let removed = 0;
  let added = 0;
  const read = (key, fallback) => {
    const raw = storage.getItem(key);
    readBefore[key] = raw;
    return raw === null ? fallback : validateStorageRaw(key, raw);
  };
  const change = (records, seeds, add = mode === 'demo') => {
    const authored = retainAuthoredRecords(records, seeds);
    preserved += authored.length;
    removed += records.length - authored.length;
    const next = add ? mergeDemoSeeds(records, seeds) : authored;
    added += next.length - authored.length;
    return next;
  };
  const wrap = (domain, value) => JSON.stringify(createVersionedStorageEnvelope(domain, value));
  keys['ceo-os-opportunities'] = wrap('opportunities', change(read('ceo-os-opportunities', []), getOpportunityDemoSeed()));
  keys['ceo-os-content-items'] = wrap('contentItems', change(read('ceo-os-content-items', []), getContentDemoSeed()));
  const store = read('ceo-os-weekly-briefs', {});
  const currentWeek = getCurrentWeekStart();
  const seed = createDemoWeekPayload();
  // Migrate legacy work only where the repository would normally read it.
  if (!store[currentWeek]) {
    store[currentWeek] = { reviewNotes: read('ceo-os-weekly-review-notes', ''), priorities: [], wins: [], blockers: [] };
    for (const collection of ['priorities', 'wins', 'blockers']) store[currentWeek][collection] = read(`ceo-os-weekly-${collection}`, []);
  }
  for (const [week, record] of Object.entries(store)) {
    weeks.push(week);
    if (record.reviewNotes.trim()) preserved += 1;
    for (const collection of ['priorities', 'wins', 'blockers']) {
      record[collection] = change(record[collection], seed[collection], mode === 'demo' && week === currentWeek);
    }
  }
  keys['ceo-os-weekly-briefs'] = wrap('weeklyBriefs', store);
  // Retain authored legacy values, and remove only unchanged legacy examples.
  for (const collection of ['priorities', 'wins', 'blockers']) {
    const key = `ceo-os-weekly-${collection}`;
    if (storage.getItem(key) !== null) keys[key] = JSON.stringify(retainAuthoredRecords(read(key, []), seed[collection]));
  }
  // Committed last, after every domain write succeeds; rollback covers the mode too.
  keys['ceo-os-workspace-setup'] = JSON.stringify({ mode, updatedAt: new Date().toISOString() });
  const backup = { format: WORKSPACE_BACKUP_FORMAT, schemaVersion: 1, workspaceOwnerId: getWorkspaceOwnerId(), keys };
  const preview = previewWorkspaceBackup(backup);
  // Legacy sources may be copied into the current week without being written.
  // They still participate in the stale-preview check, including absent keys.
  preview.before = { ...readBefore, ...preview.before };
  return { mode, preserved, removed, added, weeks, preview, backup };
}
export async function applyWorkspaceSetupChange(plan) {
  return withStorageLock('workspace-import', () => importWorkspaceBackup(plan.backup, { preview: plan.preview }));
}

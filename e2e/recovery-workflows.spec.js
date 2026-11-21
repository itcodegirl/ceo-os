import { Buffer } from 'node:buffer';
import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

test.use({ viewport: { width: 1366, height: 650 } });
const settingsKey = 'ceo-os-settings';
const captureKey = 'ceo-os-capture-notes';
const originalSettings = JSON.stringify({ teamName: 'Before restore', timezone: 'America/Chicago', autoSave: true });
const newSettings = JSON.stringify({ teamName: 'After restore', timezone: 'America/Chicago', autoSave: true });
const originalNotes = JSON.stringify([{ id: 'original', text: 'Keep my original note', category: 'idea' }]);
const restoredNotes = JSON.stringify([{ id: 'imported', text: 'Restored note', category: 'idea' }]);
const backupFile = { name: 'recovery-test.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({
  format: 'codeherway-ceo-os-local-backup', schemaVersion: 1,
  keys: { [settingsKey]: newSettings, [captureKey]: restoredNotes },
})) };
async function openSettings(page) {
  await page.goto('/settings');
  await page.evaluate(({ settingsKey, captureKey, originalSettings, originalNotes }) => {
    localStorage.setItem(settingsKey, originalSettings); localStorage.setItem(captureKey, originalNotes);
  }, { settingsKey, captureKey, originalSettings, originalNotes });
  await page.reload();
  await expect(page.getByLabel('Import local workspace backup file')).toBeAttached();
}
async function preview(page) {
  await page.getByLabel('Import local workspace backup file').setInputFiles(backupFile);
  return page.getByRole('dialog', { name: 'Review backup restore' });
}
async function raw(page, key) { return page.evaluate((key) => localStorage.getItem(key), key); }
async function injectQuota(page, rollbackFails = false) {
  await page.evaluate(({ settingsKey, captureKey, originalSettings, restoredNotes, rollbackFails }) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if ((key === captureKey && value === restoredNotes) || (rollbackFails && key === settingsKey && value === originalSettings)) {
        throw new DOMException('Storage full', 'QuotaExceededError');
      }
      return set.call(this, key, value);
    };
  }, { settingsKey, captureKey, originalSettings, restoredNotes, rollbackFails });
}

test('backup preview can be cancelled; confirmation preserves a downloadable original snapshot', async ({ page }) => {
  await openSettings(page);
  const dialog = await preview(page);
  await expect(dialog).toContainText('Settings (replace)');
  const bounds = await dialog.boundingBox();
  expect(Math.abs(bounds.x + bounds.width / 2 - 1366 / 2)).toBeLessThan(2);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(650);
  expect(await raw(page, settingsKey)).toBe(originalSettings);
  await dialog.getByRole('button', { name: 'Cancel action' }).click();
  expect(await raw(page, captureKey)).toBe(originalNotes);
  await preview(page);
  await page.getByRole('button', { name: 'Confirm backup restore' }).click();
  await expect(page.locator('.settings-backup-status')).toContainText('2 local stores imported');
  expect(await raw(page, settingsKey)).toBe(newSettings);
  await page.getByRole('button', { name: 'Review recovery and pending writes' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download before-restore backup' }).click();
  const downloaded = await downloadPromise;
  const snapshot = JSON.parse(await readFile(await downloaded.path(), 'utf8'));
  expect(snapshot.keys[settingsKey]).toBe(originalSettings);
  expect(snapshot.keys[captureKey]).toBe(originalNotes);
});

test('quota failure rolls back earlier stores and reports the failure inside the preview', async ({ page }) => {
  await openSettings(page);
  const dialog = await preview(page);
  await injectQuota(page);
  await dialog.getByRole('button', { name: 'Confirm backup restore' }).click();
  await expect(dialog.getByRole('alert')).toContainText('All changed stores were rolled back');
  expect(await raw(page, settingsKey)).toBe(originalSettings);
  expect(await raw(page, captureKey)).toBe(originalNotes);
});

test('an interrupted rollback pauses editing and recovers original data before the next app startup', async ({ page }) => {
  await openSettings(page);
  await preview(page);
  await injectQuota(page, true);
  await page.getByRole('button', { name: 'Confirm backup restore' }).click();
  await expect(page.getByRole('heading', { name: 'Finish recovering your workspace' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Keep current data', exact: true })).toBeDisabled();
  expect(await raw(page, 'ceo-os-import-recovery-active')).toBeTruthy();
  // Reload clears the injected quota failure. Recovery runs before repositories load.
  await page.reload();
  await expect(page.getByLabel('Import local workspace backup file')).toBeAttached();
  expect(await raw(page, settingsKey)).toBe(originalSettings);
  expect(await raw(page, captureKey)).toBe(originalNotes);
  expect(await raw(page, 'ceo-os-import-recovery-active')).toBeNull();
});

test('cold-start recovery survives reload and exports newer data without restoring invalid bytes', async ({ page }) => {
  await page.goto('/capture');
  const newer = JSON.stringify({ schemaVersion: 99, domain: 'captureNotes', data: [{ futureData: 'preserve me' }] });
  await page.evaluate(({ captureKey, newer }) => localStorage.setItem(captureKey, newer), { captureKey, newer });
  await page.reload();
  await page.getByRole('link', { name: 'Review recovery data' }).click();
  await expect(page.getByRole('button', { name: 'Hide recovery tools' })).toBeVisible();
  await page.reload();
  const recovery = page.locator('#recovery-tools');
  await expect(recovery).toContainText('cannot be restored by this version');
  await expect(recovery.getByRole('button', { name: 'Restore snapshot', exact: true })).toHaveCount(0);
  const downloadPromise = page.waitForEvent('download');
  await recovery.getByRole('button', { name: 'Export original', exact: true }).click();
  const downloaded = await downloadPromise;
  expect(await readFile(await downloaded.path(), 'utf8')).toBe(newer);
  await recovery.getByRole('button', { name: 'Discard preserved data' }).click();
  await page.getByRole('dialog', { name: 'Confirm recovery action' }).getByRole('button', { name: 'Confirm action' }).click();
  await expect(recovery).toContainText('No unreadable or archived stores need review.');
});

test('blocked queue actions can be reviewed, retried, exported, and explicitly discarded', async ({ page }) => {
  await page.goto('/settings');
  await page.evaluate(() => localStorage.setItem('ceo-os-offline-write-queue', JSON.stringify([
    { id: 'unsupported', kind: 'future:action', ownerId: '', payload: { title: 'Recover this queued action' }, attempts: 0, createdAt: Date.now() },
    { id: 'private', kind: 'future:action', ownerId: 'another-account', payload: { title: 'Other account private draft' }, attempts: 0 },
  ])));
  await page.goto('/settings#recovery');
  await page.reload();
  const recovery = page.locator('#recovery-tools');
  await expect(recovery).toContainText('Recover this queued action');
  await expect(recovery).toContainText('blocked · 1 attempt');
  await expect(recovery).not.toContainText('Other account private draft');
  await recovery.getByText('Review action data', { exact: true }).click();
  await expect(recovery.locator('pre')).toContainText('Recover this queued action');
  await recovery.getByRole('button', { name: 'Retry action' }).click();
  await expect(recovery).toContainText('blocked · 1 attempt');
  const downloadPromise = page.waitForEvent('download');
  await recovery.getByRole('button', { name: 'Export pending writes' }).click();
  const downloaded = await downloadPromise;
  const queue = JSON.parse(await readFile(await downloaded.path(), 'utf8'));
  expect(queue.map((entry) => entry.id)).toEqual(['unsupported']);
  await recovery.getByRole('button', { name: 'Discard action', exact: true }).click();
  await page.getByRole('dialog', { name: 'Confirm recovery action' }).getByRole('button', { name: 'Confirm action' }).click();
  await expect(recovery).toContainText('No pending writes to review.');
  expect(JSON.parse(await raw(page, 'ceo-os-offline-write-queue')).map((entry) => entry.id)).toEqual(['private']);
});

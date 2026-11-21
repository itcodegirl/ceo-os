import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1366, height: 768 } });

test('saved Capture notes accept sequential spaces, newlines, and clearing', async ({ page }) => {
  await page.goto('/capture');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Original note');
  await page.getByRole('button', { name: 'Save sticky note' }).click();
  const saved = page.locator('.sticky-note textarea').first();
  await saved.fill('');
  await saved.pressSequentially('book a follow up');
  await saved.press('Enter');
  await saved.pressSequentially('next week ');
  await expect(saved).toHaveValue('book a follow up\nnext week ');
  await page.reload();
  await expect(saved).toHaveValue('book a follow up\nnext week ');
  await saved.fill('');
  await page.reload();
  await expect(saved).toHaveValue('');
});

test('a blank Weekly Brief stays blank after the next Monday', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-23T12:00:00Z'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Start blank', exact: true }).click();
  await page.goto('/weekly-brief');
  await expect(page.getByText(/Nothing here yet. What are the/)).toBeVisible();
  await expect(page.getByText(/No wins logged. Start with one/)).toBeVisible();
  await expect(page.getByText(/Clear runway. If something/)).toBeVisible();
  await page.clock.setFixedTime(new Date('2026-11-30T12:00:00Z'));
  await page.reload();
  await expect(page.getByText(/Nothing here yet. What are the/)).toBeVisible();
  await expect(page.getByText(/No wins logged. Start with one/)).toBeVisible();
  await expect(page.getByText(/Clear runway. If something/)).toBeVisible();
});

test('account changes clear the mounted Notebook and preserve the original local workspace', async ({ page }) => {
  // This tests local workspace transitions, not Supabase sign-in or remote RLS.
  await page.goto('/notebook?section=learning');
  await page.getByRole('button', { name: 'New page' }).first().click();
  await page.getByRole('dialog', { name: 'New Learning page' }).getByLabel('Title').fill('Private local notebook');
  await page.getByRole('button', { name: 'Create page' }).click();
  await expect(page.getByLabel('Page title')).toHaveValue('Private local notebook');
  await page.evaluate(() => {
    localStorage.setItem('ceo-os:auth', JSON.stringify({ user: { id: 'other-account' } }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'ceo-os:auth' }));
  });
  await expect(page.getByLabel('Page title')).toBeHidden();
  await expect(page.getByText('Private local notebook', { exact: true })).toBeHidden();
  await page.evaluate(() => {
    localStorage.removeItem('ceo-os:auth');
    window.dispatchEvent(new StorageEvent('storage', { key: 'ceo-os:auth' }));
  });
  await expect(page.getByRole('link', { name: 'Private local notebook', exact: true })).toBeVisible();
});

test('workspace backups round-trip through the deferred import module', async ({ page }) => {
  await page.goto('/capture');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Restore this local note');
  await page.getByRole('button', { name: 'Save sticky note' }).click();
  await page.goto('/settings');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export local workspace backup' }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  await page.goto('/capture');
  await page.getByRole('button', { name: 'Delete Idea note' }).click();
  await expect(page.getByText('No sticky notes yet')).toBeVisible();
  await page.goto('/settings');
  await page.getByLabel('Import local workspace backup file').setInputFiles(backupPath);
  await page.getByRole('button', { name: 'Confirm backup restore' }).click();
  await expect(page.getByRole('status').filter({ hasText: /local stores imported/ })).toBeVisible();
  await page.goto('/capture');
  await expect(page.locator('.sticky-note textarea').first()).toHaveValue('Restore this local note');
});

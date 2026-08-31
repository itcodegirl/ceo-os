import { expect, test } from '@playwright/test';

const OPPORTUNITIES_STORAGE_KEY = 'ceo-os-opportunities';
const CONTENT_STORAGE_KEY = 'ceo-os-content-items';

async function resetToSeedState(page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(page.getByLabel('Primary navigation')).toBeVisible();
}

async function installStorageFaultInjector(page) {
  await page.evaluate(() => {
    if (window.__ceoOsStorageFaultInjector) {
      return;
    }

    const originalSetItem = Storage.prototype.setItem;
    let failNextKey = null;

    Storage.prototype.setItem = function patchedSetItem(key, value) {
      if (failNextKey !== null && key === failNextKey) {
        failNextKey = null;
        throw new Error(`Injected storage write failure for ${key}`);
      }

      return originalSetItem.call(this, key, value);
    };

    window.__ceoOsFailNextStorageWrite = (key) => {
      failNextKey = String(key);
    };
    window.__ceoOsStorageFaultInjector = true;
  });
}

async function failNextStorageWrite(page, storageKey) {
  await page.evaluate((key) => {
    window.__ceoOsFailNextStorageWrite(key);
  }, storageKey);
}

async function navigateToPrimaryRouteWithKeyboard(page, routeName) {
  const routeLink = page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: routeName, exact: true });
  await routeLink.focus();
  await page.keyboard.press('Enter');
}

test.describe('CRUD smoke flows', () => {
  test('opportunities page supports create edit delete from routed entry', async ({ page }) => {
    const createdName = `Playwright Opportunity ${Date.now()}`;
    const editedName = `${createdName} Updated`;

    await resetToSeedState(page);
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Opportunities', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Opportunities' })).toBeVisible();

    await page.getByRole('button', { name: 'Create a new opportunity' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Add Opportunity' });
    await createDialog.getByLabel('Opportunity', { exact: true }).fill(createdName);
    await createDialog.getByLabel('Company', { exact: true }).fill('Playwright Co');
    await createDialog.getByLabel('Priority', { exact: true }).selectOption('High');
    await createDialog.getByLabel('Stage', { exact: true }).selectOption('In Progress');
    await createDialog.getByLabel('Next Step', { exact: true }).fill('Send draft agreement');
    await createDialog.getByRole('button', { name: 'Create opportunity' }).click();

    const table = page.getByRole('table', { name: 'Opportunity pipeline' });
    const createdRow = table.locator('tbody tr').filter({ hasText: createdName }).first();
    await expect(createdRow).toBeVisible();

    await createdRow.click();
    await page.getByRole('button', { name: 'Edit selected opportunity' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit Opportunity' });
    await editDialog.getByLabel('Opportunity', { exact: true }).fill(editedName);
    await editDialog.getByLabel('Company', { exact: true }).fill('Playwright Labs');
    await editDialog.getByRole('button', { name: 'Save opportunity changes' }).click();

    const editedRow = table.locator('tbody tr').filter({ hasText: editedName }).first();
    await expect(editedRow).toBeVisible();
    await page.getByRole('button', { name: 'Delete selected opportunity' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();

    await expect(table.locator('tbody tr').filter({ hasText: editedName })).toHaveCount(0);
  });

  test('content page supports create edit delete from routed entry', async ({ page }) => {
    const createdTitle = `Playwright Content ${Date.now()}`;
    const editedTitle = `${createdTitle} Updated`;

    await resetToSeedState(page);
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Content OS', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Content OS' })).toBeVisible();

    await page.getByRole('button', { name: 'Add a content idea or draft' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Add Content Item' });
    await createDialog.getByLabel('Title', { exact: true }).fill(createdTitle);
    await createDialog.getByLabel('Platform', { exact: true }).fill('Podcast');
    await createDialog.getByLabel('Status', { exact: true }).selectOption('Editing');
    await createDialog.getByRole('button', { name: 'Create content item' }).click();

    const table = page.getByRole('table', { name: 'Content pipeline' });
    const createdRow = table.locator('tbody tr').filter({ hasText: createdTitle }).first();
    await expect(createdRow).toBeVisible();

    await createdRow.click();
    await page.getByRole('button', { name: 'Edit selected content item' }).click();
    const editDialog = page.getByRole('dialog', { name: 'Edit Content Item' });
    await editDialog.getByLabel('Title', { exact: true }).fill(editedTitle);
    await editDialog.getByLabel('Platform', { exact: true }).fill('LinkedIn');
    await editDialog.getByRole('button', { name: 'Save content changes' }).click();

    const editedRow = table.locator('tbody tr').filter({ hasText: editedTitle }).first();
    await expect(editedRow).toBeVisible();
    await page.getByRole('button', { name: 'Delete selected content item' }).click();
    await page.getByRole('button', { name: 'Confirm delete' }).click();

    await expect(table.locator('tbody tr').filter({ hasText: editedTitle })).toHaveCount(0);
  });

  test('opportunities page supports keyboard-only row selection and edit-modal open/close', async ({ page }) => {
    await resetToSeedState(page);
    await navigateToPrimaryRouteWithKeyboard(page, 'Opportunities');
    await expect(page.getByRole('heading', { name: 'Opportunities' })).toBeVisible();

    const table = page.getByRole('table', { name: 'Opportunity pipeline' });
    const firstRow = table.locator('tbody tr').first();
    await firstRow.focus();
    await page.keyboard.press('Enter');

    const itemDialog = page.getByRole('dialog');
    await expect(itemDialog).toBeVisible();

    const editButton = page.getByRole('button', { name: 'Edit selected opportunity' });
    await editButton.focus();
    await page.keyboard.press('Enter');

    const editDialog = page.getByRole('dialog', { name: 'Edit Opportunity' });
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole('button', { name: 'Cancel opportunity form' }).focus();
    await page.keyboard.press('Enter');
    await expect(editDialog).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(itemDialog).toHaveCount(0);
  });

  test('content page supports keyboard-only row selection and edit-modal open/close', async ({ page }) => {
    await resetToSeedState(page);
    await navigateToPrimaryRouteWithKeyboard(page, 'Content OS');
    await expect(page.getByRole('heading', { name: 'Content OS' })).toBeVisible();

    const table = page.getByRole('table', { name: 'Content pipeline' });
    const firstRow = table.locator('tbody tr').first();
    await firstRow.focus();
    await page.keyboard.press('Space');

    const itemDialog = page.getByRole('dialog');
    await expect(itemDialog).toBeVisible();

    const editButton = page.getByRole('button', { name: 'Edit selected content item' });
    await editButton.focus();
    await page.keyboard.press('Enter');

    const editDialog = page.getByRole('dialog', { name: 'Edit Content Item' });
    await expect(editDialog).toBeVisible();
    await editDialog.getByRole('button', { name: 'Cancel content form' }).focus();
    await page.keyboard.press('Enter');
    await expect(editDialog).toHaveCount(0);

    await page.keyboard.press('Escape');
    await expect(itemDialog).toHaveCount(0);
  });

  test('opportunities page shows error and recovers on retry for create and delete', async ({ page }) => {
    const createdName = `Playwright Retry Opp ${Date.now()}`;

    await resetToSeedState(page);
    await installStorageFaultInjector(page);
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Opportunities', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Opportunities' })).toBeVisible();

    await page.getByRole('button', { name: 'Create a new opportunity' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Add Opportunity' });
    await createDialog.getByLabel('Opportunity', { exact: true }).fill(createdName);
    await createDialog.getByLabel('Company', { exact: true }).fill('Retry Labs');
    await createDialog.getByLabel('Next Step', { exact: true }).fill('Send retry proposal');
    await failNextStorageWrite(page, OPPORTUNITIES_STORAGE_KEY);
    await createDialog.getByRole('button', { name: 'Create opportunity' }).click();
    await expect(createDialog.getByRole('alert')).toContainText('Unable to save opportunity right now.');

    await createDialog.getByRole('button', { name: 'Create opportunity' }).click();

    const table = page.getByRole('table', { name: 'Opportunity pipeline' });
    const createdRow = table.locator('tbody tr').filter({ hasText: createdName }).first();
    await expect(createdRow).toBeVisible();

    await createdRow.click();
    await page.getByRole('button', { name: 'Delete selected opportunity' }).click();
    await failNextStorageWrite(page, OPPORTUNITIES_STORAGE_KEY);
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page.getByRole('alert')).toContainText('Unable to delete opportunity right now.');
    await expect(createdRow).toBeVisible();

    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(table.locator('tbody tr').filter({ hasText: createdName })).toHaveCount(0);
    await expect(page.getByText('Unable to delete opportunity right now.')).toHaveCount(0);
  });

  test('content page shows error and recovers on retry for create and delete', async ({ page }) => {
    const createdTitle = `Playwright Retry Content ${Date.now()}`;

    await resetToSeedState(page);
    await installStorageFaultInjector(page);
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: 'Content OS', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Content OS' })).toBeVisible();

    await page.getByRole('button', { name: 'Add a content idea or draft' }).click();
    const createDialog = page.getByRole('dialog', { name: 'Add Content Item' });
    await createDialog.getByLabel('Title', { exact: true }).fill(createdTitle);
    await createDialog.getByLabel('Platform', { exact: true }).fill('Newsletter');
    await failNextStorageWrite(page, CONTENT_STORAGE_KEY);
    await createDialog.getByRole('button', { name: 'Create content item' }).click();
    await expect(createDialog.getByRole('alert')).toContainText('Unable to save content item right now.');

    await createDialog.getByRole('button', { name: 'Create content item' }).click();

    const table = page.getByRole('table', { name: 'Content pipeline' });
    const createdRow = table.locator('tbody tr').filter({ hasText: createdTitle }).first();
    await expect(createdRow).toBeVisible();

    await createdRow.click();
    await page.getByRole('button', { name: 'Delete selected content item' }).click();
    await failNextStorageWrite(page, CONTENT_STORAGE_KEY);
    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(page.getByRole('alert')).toContainText('Unable to delete content item right now.');
    await expect(createdRow).toBeVisible();

    await page.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(table.locator('tbody tr').filter({ hasText: createdTitle })).toHaveCount(0);
    await expect(page.getByText('Unable to delete content item right now.')).toHaveCount(0);
  });
});

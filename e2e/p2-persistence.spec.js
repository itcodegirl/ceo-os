import { expect, test } from '@playwright/test';

test.use({ viewport: { width: 1366, height: 650 } });

async function failWrites(page, key) {
  await page.evaluate((target) => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(name, value) {
      if (this === localStorage && name === target && window.__failP2Writes) throw new Error('Storage unavailable');
      return original.call(this, name, value);
    };
    window.__failP2Writes = true;
  }, key);
}

test('reflection survives immediate navigation and a failed save followed by reload', async ({ page }) => {
  await page.goto('/weekly-brief');
  const input = page.getByLabel('What actually happened this week?');
  await input.fill('Keep this reflection when I leave immediately.');
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Capture', exact: true }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Weekly Brief', exact: true }).click();
  await expect(input).toHaveValue('Keep this reflection when I leave immediately.');
  await failWrites(page, 'ceo-os-weekly-briefs');
  await input.fill('Keep this failed reflection too.');
  await expect(page.getByRole('button', { name: 'Retry saving reflection' })).toBeVisible();
  await expect(input).toHaveValue('Keep this failed reflection too.');
  await page.reload();
  await expect(input).toHaveValue('Keep this failed reflection too.');
  await expect(page.locator('.weekly-review-notes__status')).toHaveText('Saved.');
  await page.reload();
  await expect(input).toHaveValue('Keep this failed reflection too.');
});

test('weekly item drafts stay open on failure and reject edits based on an old version', async ({ page, context }) => {
  await page.goto('/weekly-brief');
  await page.getByRole('button', { name: 'Add weekly priority' }).click();
  const create = page.getByRole('dialog', { name: 'Add Priority' });
  await create.getByLabel('Priority', { exact: true }).fill('P2 protected priority');
  await failWrites(page, 'ceo-os-weekly-briefs');
  await create.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(create.getByRole('alert')).toContainText('Your draft is kept here');
  await expect(create.getByLabel('Priority', { exact: true })).toHaveValue('P2 protected priority');
  await page.evaluate(() => { window.__failP2Writes = false; });
  await create.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(create).toBeHidden();
  await page.getByRole('button', { name: 'Edit priority P2 protected priority', exact: true }).click();
  const edit = page.getByRole('dialog', { name: 'Edit Priority' });
  await edit.getByLabel('Priority', { exact: true }).fill('My unsaved revision');

  const other = await context.newPage();
  await other.goto('/weekly-brief');
  await other.getByRole('button', { name: 'Edit priority P2 protected priority', exact: true }).click();
  const otherEdit = other.getByRole('dialog', { name: 'Edit Priority' });
  await otherEdit.getByLabel('Priority', { exact: true }).fill('Changed in another tab');
  await otherEdit.getByRole('button', { name: 'Save Changes' }).click();
  await expect(otherEdit).toBeHidden();
  // Wait for the collection refresh; the editor must still use its opening revision.
  await expect(page.getByRole('button', { name: 'Edit priority Changed in another tab', exact: true })).toBeAttached();
  await edit.getByRole('button', { name: 'Save Changes' }).click();
  await expect(edit.getByRole('alert')).toContainText('changed in another window');
  await expect(edit.getByLabel('Priority', { exact: true })).toHaveValue('My unsaved revision');
  await edit.getByRole('button', { name: 'Reload latest item' }).click();
  await expect(edit.getByLabel('Priority', { exact: true })).toHaveValue('Changed in another tab');
  await edit.getByLabel('Priority', { exact: true }).fill('Reviewed and saved');
  await edit.getByRole('button', { name: 'Save Changes' }).click();
  await expect(edit).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Edit priority Reviewed and saved', exact: true })).toBeVisible();
  await other.close();
});

test('Chief notes retain their failed draft and retry explicitly', async ({ page }) => {
  await page.goto('/chief-of-staff');
  const input = page.getByLabel('Founder notes for chief of staff workspace');
  await failWrites(page, 'ceo-os-chief-notes');
  await input.fill('Founder notes must survive failed persistence.');
  await page.getByRole('button', { name: 'Retry saving notes' }).waitFor();
  await expect(input).toHaveValue('Founder notes must survive failed persistence.');
  await page.evaluate(() => { window.__failP2Writes = false; });
  await page.getByRole('button', { name: 'Retry saving notes' }).click();
  await expect(page.getByText('Notes saved.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(input).toHaveValue('Founder notes must survive failed persistence.');
});

for (const domain of [
  { route: '/opportunities', table: 'Opportunity pipeline', storage: 'ceo-os-opportunities', field: 'name', remove: 'Delete selected opportunity' },
  { route: '/content', table: 'Content publishing pipeline', storage: 'ceo-os-content-items', field: 'title', remove: 'Delete selected content' },
]) {
  test(`${domain.route} refuses stale deletion and shows the error inside its confirmation`, async ({ page }) => {
    await page.goto(domain.route);
    const firstRow = page.getByRole('table').locator('tbody tr').first();
    await firstRow.click();
    await page.getByRole('button', { name: domain.remove }).click();
    const confirmation = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Confirm delete' }) });
    await page.evaluate(({ storage, field }) => {
      const envelope = JSON.parse(localStorage.getItem(storage));
      const records = Array.isArray(envelope) ? envelope : envelope.data;
      // Mutate every row to avoid relying on pipeline sort order.
      records.forEach((item) => { item.updatedAt = Date.now() + 1000; item[field] += ' revised elsewhere'; });
      localStorage.setItem(storage, JSON.stringify(envelope));
    }, domain);
    await confirmation.getByRole('button', { name: 'Confirm delete' }).click();
    await expect(confirmation.getByRole('alert')).toContainText('changed in another window');
    await confirmation.getByRole('button', { name: 'Cancel delete' }).click();
    await page.reload();
    await expect(page.getByRole('table').locator('tbody tr').first()).toContainText('revised elsewhere');
  });
}

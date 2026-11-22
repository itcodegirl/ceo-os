import { expect, test } from '@playwright/test';
test.use({ viewport: { width: 1366, height: 650 } });

async function storage(page, key) {
  return page.evaluate((key) => { const value = JSON.parse(localStorage.getItem(key)); return value?.data ?? value; }, key);
}
async function seedWorkspace(page) {
  await page.goto('/opportunities');
  await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible();
  await page.goto('/content');
  await expect(page.getByRole('table').locator('tbody tr').first()).toBeVisible();
  await page.goto('/weekly-brief');
  await expect(page.getByRole('button', { name: 'Add weekly priority' })).toBeVisible();
  await page.getByLabel('What actually happened this week?').fill('Current reflection');
  await expect(page.locator('.weekly-review-notes__status')).toContainText('Saved.');
}

test('demo cleanup preserves edited examples and historical work; demo loading adds examples without replacing that work', async ({ page }) => {
  await seedWorkspace(page);
  await page.evaluate(() => {
    const opps = JSON.parse(localStorage.getItem('ceo-os-opportunities'));
    opps.data[0].name = 'My real partnership'; opps.data[0].updatedAt = Date.now();
    localStorage.setItem('ceo-os-opportunities', JSON.stringify(opps));
    const weeks = JSON.parse(localStorage.getItem('ceo-os-weekly-briefs'));
    const oldWeek = structuredClone(Object.values(weeks.data)[0]);
    oldWeek.reviewNotes = 'Keep my historical reflection';
    oldWeek.priorities[0].title = 'My historical priority'; oldWeek.priorities[0].updatedAt = Date.now();
    weeks.data['2026-04-06'] = oldWeek;
    localStorage.setItem('ceo-os-weekly-briefs', JSON.stringify(weeks));
  });
  await page.goto('/settings');
  await page.getByRole('button', { name: 'Clear demo data', exact: true }).click();
  const preview = page.getByRole('dialog', { name: 'Review demo cleanup' });
  await expect(preview).toContainText('2026-04-06');
  await expect(preview).toContainText('edited or authored');
  await preview.getByRole('button', { name: 'Cancel action' }).click();
  expect((await storage(page, 'ceo-os-opportunities')).length).toBeGreaterThan(1);
  await page.getByRole('button', { name: 'Start blank', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm demo cleanup' }).click();
  await expect(preview).toBeHidden();
  expect((await storage(page, 'ceo-os-opportunities')).map((row) => row.name)).toEqual(['My real partnership']);
  const weeks = await storage(page, 'ceo-os-weekly-briefs');
  expect(weeks['2026-04-06'].reviewNotes).toBe('Keep my historical reflection');
  expect(weeks['2026-04-06'].priorities.map((row) => row.title)).toEqual(['My historical priority']);
  expect((await storage(page, 'ceo-os-workspace-setup')).mode).toBe('blank');
  await page.getByRole('button', { name: 'Load demo workspace', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm demo workspace changes' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await storage(page, 'ceo-os-opportunities')).some((row) => row.name === 'My real partnership')).toBe(true);
  expect((await storage(page, 'ceo-os-workspace-setup')).mode).toBe('demo');
});

test('failed demo cleanup keeps data and mode intact and reports the error in its dialog', async ({ page }) => {
  await seedWorkspace(page); await page.goto('/settings');
  const before = await page.evaluate(() => Object.fromEntries(['ceo-os-opportunities', 'ceo-os-content-items', 'ceo-os-weekly-briefs', 'ceo-os-workspace-setup'].map((key) => [key, localStorage.getItem(key)])));
  await page.getByRole('button', { name: 'Start blank', exact: true }).click();
  await page.evaluate((before) => {
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'ceo-os-content-items' && value !== before[key]) throw new DOMException('quota', 'QuotaExceededError');
      return set.call(this, key, value);
    };
  }, before);
  const dialog = page.getByRole('dialog', { name: 'Review demo cleanup' });
  await dialog.getByRole('button', { name: 'Confirm demo cleanup' }).click();
  await expect(dialog.getByRole('alert')).toContainText('rolled back');
  const after = await page.evaluate((keys) => Object.fromEntries(keys.map((key) => [key, localStorage.getItem(key)])), Object.keys(before));
  expect(after).toEqual(before);
});

test('Capture receives cross-tab create, rapid edit, and delete without clearing the active composer', async ({ page, context }) => {
  await page.goto('/capture');
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Keep my active composer draft');
  const other = await context.newPage(); await other.goto('/capture');
  await other.getByRole('textbox', { name: 'Note', exact: true }).fill('Created in another tab');
  await other.getByRole('button', { name: 'Save sticky note' }).click();
  await expect(page.getByRole('textbox', { name: 'Edit note', exact: true })).toHaveValue('Created in another tab');
  await other.getByRole('textbox', { name: 'Edit note', exact: true }).fill('First edit');
  await other.getByRole('textbox', { name: 'Edit note', exact: true }).fill('The final rapid edit');
  await expect(page.getByRole('textbox', { name: 'Edit note', exact: true })).toHaveValue('The final rapid edit');
  await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Keep my active composer draft');
  await page.reload();
  await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Keep my active composer draft');
  await other.getByRole('button', { name: 'Delete Idea note' }).click();
  await expect(page.locator('.sticky-note')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: 'Note', exact: true })).toHaveValue('Keep my active composer draft');
});

for (const domain of [
  { route: '/opportunities', edit: 'Edit selected opportunity', remove: 'Delete selected opportunity', field: 'Opportunity', save: 'Save opportunity changes', storageKey: 'ceo-os-opportunities' },
  { route: '/content', edit: 'Edit selected content item', remove: 'Delete selected content item', field: 'Title', save: 'Save content changes', storageKey: 'ceo-os-content-items' },
]) {
  test(`${domain.route} refreshes across tabs without replacing an edit draft; only the top dialog handles Escape`, async ({ page, context }) => {
    await page.goto(domain.route);
    await page.getByRole('table').locator('tbody tr').first().click();
    await page.getByRole('button', { name: domain.edit }).click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    const input = page.getByRole('dialog').getByLabel(domain.field, { exact: true });
    await input.fill('My active edit draft');
    const other = await context.newPage(); await other.goto(domain.route);
    await other.getByRole('table').locator('tbody tr').first().click();
    await other.getByRole('button', { name: domain.edit }).click();
    await other.getByRole('dialog').getByLabel(domain.field, { exact: true }).fill('Changed from another tab');
    await other.getByRole('button', { name: domain.save }).click();
    // The pipeline stays current beneath the inert details/edit overlays.
    await expect(page.locator('table tbody')).toContainText('Changed from another tab');
    await expect(input).toHaveValue('My active edit draft');
    await page.getByRole('button', { name: domain.save }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toContainText('changed in another window');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(page.getByRole('button', { name: domain.edit })).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
    await page.getByRole('button', { name: domain.remove }).click();
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(page.getByRole('button', { name: domain.remove })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('');
    expect(await page.locator('#root').getAttribute('inert')).toBeNull();
  });
}

test('Chief acceptance preserves missing metadata and context, and stays accepted after reload', async ({ page }) => {
  await page.goto('/chief-of-staff');
  await page.evaluate(() => localStorage.setItem('ceo-os-chief-responses', JSON.stringify([{ id: 'canonical-test', title: 'Review these suggestions', content: 'A focused plan.', source: 'local', structuredPayload: {
    opportunities: [{ name: 'Metadata-free partner' }], contentItems: [{ title: 'Metadata-free post', summary: 'Keep this publishing context' }],
    priorities: [{ title: 'Metadata-free priority' }], tasks: [{ title: 'Metadata-free task' }],
  } }])));
  await page.reload();
  await expect(page.getByText('Company not specified', { exact: true })).toBeVisible();
  await expect(page.getByText('→ Weekly Brief priority (from task)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Add All to System', exact: true }).click();
  const opportunityButton = page.getByRole('button', { name: /Add opportunity "Metadata-free partner".*already added/ });
  await expect(opportunityButton).toBeDisabled();
  const opps = await storage(page, 'ceo-os-opportunities');
  const posts = await storage(page, 'ceo-os-content-items');
  expect(opps.find((row) => row.name === 'Metadata-free partner').company).toBe('');
  expect(posts.find((row) => row.title === 'Metadata-free post')).toMatchObject({ platform: '', notes: 'Keep this publishing context' });
  const priorities = Object.values(await storage(page, 'ceo-os-weekly-briefs')).flatMap((week) => week.priorities);
  expect(priorities.find((row) => row.title === 'Metadata-free priority').owner).toBe('');
  await page.reload();
  await expect(opportunityButton).toBeDisabled();
  await expect(page.getByRole('button', { name: /Add content draft "Metadata-free post".*already added/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Add All to System', exact: true }).click();
  expect((await storage(page, 'ceo-os-opportunities')).filter((row) => row.name === 'Metadata-free partner')).toHaveLength(1);
  expect((await storage(page, 'ceo-os-content-items')).filter((row) => row.title === 'Metadata-free post')).toHaveLength(1);
});

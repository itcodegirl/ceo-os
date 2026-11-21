import { expect, test } from '@playwright/test';

const routes = [
  { path: '/', control: '.focus-home__actions button' },
  { path: '/capture', control: '.capture-composer__actions button' },
  { path: '/weekly-brief', control: '.weekly-grid .section-card__header button' },
  { path: '/chief-of-staff', control: '.chief-make button' },
  { path: '/opportunities', control: '.section-card__header button', row: '.crm-table__row' },
  { path: '/content', control: '.section-card__header button', row: '.crm-table__row' },
];

for (const colorScheme of ['dark', 'light']) {
  for (const width of [1280, 1366]) {
    test.describe(`${colorScheme} laptop at ${width}×650`, () => {
      test.use({ viewport: { width, height: 650 }, colorScheme });

      for (const route of routes) {
        test(`${route.path} exposes its primary action without scrolling`, async ({ page }) => {
          await page.goto(route.path);
          await expect(page.getByTestId('local-only-notice')).toBeVisible();
          await expect(page.locator(route.control).first()).toBeInViewport({ ratio: 1 });
          if (route.row) {
            await expect(page.locator(route.row).first()).toBeInViewport({ ratio: 0.5 });
          }
          if (route.path === '/capture') {
            await expect(page.getByRole('region', { name: 'Sticky note wall' })).toBeInViewport({ ratio: 1 });
          }
          expect(await page.evaluate(() => window.scrollY)).toBe(0);
        });
      }
    });
  }
}

for (const width of [320, 390, 640, 768]) {
  test(`workflows reflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    for (const route of routes) {
      await page.goto(route.path);
      const action = page.locator(route.control).first();
      await action.scrollIntoViewIfNeeded();
      await expect(action).toBeInViewport({ ratio: 1 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    }
  });
}

test('Capture keeps saved notes beside the composer and supports keyboard category selection', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 650 });
  await page.goto('/capture');
  const text = 'Follow up on the CodeHerWay workshop outline';
  await page.getByRole('textbox', { name: 'Note', exact: true }).fill(text);
  const category = page.getByRole('combobox', { name: 'Category', exact: true });
  await category.focus();
  await category.press('ArrowDown');
  await category.press('Enter');
  await expect(category).toHaveValue('task');
  await page.getByRole('button', { name: 'Save sticky note' }).click();
  const saved = page.getByRole('textbox', { name: 'Edit note', exact: true });
  await expect(saved).toHaveValue(text);
  await expect(saved).toBeInViewport({ ratio: 1 });
  const bounds = await saved.boundingBox();
  const composer = await page.locator('.capture-composer').boundingBox();
  expect(bounds.x).toBeGreaterThan(composer.x + composer.width);
  await page.reload();
  await expect(saved).toHaveValue(text);
});

test('workspace signals remain available by keyboard below the workflow', async ({ page }) => {
  await page.goto('/weekly-brief');
  const summary = page.locator('.workspace-signals > summary');
  await summary.focus();
  await summary.press('Enter');
  await expect(page.getByRole('region', { name: 'System pulse', exact: true })).toBeVisible();
  await summary.press('Enter');
  await expect(page.getByRole('region', { name: 'System pulse', exact: true })).toBeHidden();
  await expect(page.getByRole('article', { name: 'This week at a glance' })).toHaveCount(1);
});

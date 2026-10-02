import { expect, test } from '@playwright/test';

const primaryRoutes = [
  { path: '/', title: 'Focus Home' },
  { path: '/capture', title: 'Capture' },
  { path: '/notebook', title: 'Notebook' },
  { path: '/opportunities', title: 'Opportunities' },
  { path: '/content', title: 'Content OS' },
  { path: '/weekly-brief', title: 'Weekly Brief' },
  { path: '/chief-of-staff', title: 'Chief of Staff' },
  { path: '/ops-reliability?meta=1', title: 'Ops Reliability' },
  { path: '/settings', title: 'Settings' },
];

test.describe('Direct route smoke profile', () => {
  for (const route of primaryRoutes) {
    test(`${route.path} loads directly and survives refresh`, async ({ page }) => {
      await page.goto(route.path);
      await expect(page).toHaveTitle(`${route.title} | CodeHerWay CEO OS`);
      await expect(page.locator('#main-content')).toBeVisible();

      await page.reload();

      await expect(page).toHaveTitle(`${route.title} | CodeHerWay CEO OS`);
      await expect(page.locator('#main-content')).toBeVisible();
    });
  }
});

import { expect, test } from '@playwright/test';

const INITIAL_LOAD_BUDGET_MS = 4500;
const ROUTE_TRANSITION_BUDGET_MS = 3500;

function nowMs() {
  return Date.now();
}

async function measureDuration(run) {
  const startedAt = nowMs();
  await run();
  return nowMs() - startedAt;
}

async function navigateAndMeasure({
  page,
  linkLabel,
  headingLabel = linkLabel,
}) {
  return measureDuration(async () => {
    await page
      .getByRole('navigation', { name: 'Main navigation' })
      .getByRole('link', { name: linkLabel, exact: true })
      .click();
    await expect(page.getByRole('heading', { name: headingLabel, exact: true })).toBeVisible();
  });
}

test.describe('Performance smoke profile', () => {
  test('captures route transition timings and enforces budget guardrails', async ({ page }, testInfo) => {
    const timings = {};

    timings.dashboardInitialLoadMs = await measureDuration(async () => {
      await page.goto('/?meta=1');
      await expect(page.getByRole('heading', { name: 'Focus Home', exact: true })).toBeVisible();
    });

    timings.opportunitiesTransitionMs = await navigateAndMeasure({
      page,
      linkLabel: 'Opportunities',
    });
    timings.contentTransitionMs = await navigateAndMeasure({
      page,
      linkLabel: 'Content OS',
    });
    timings.weeklyBriefTransitionMs = await navigateAndMeasure({
      page,
      linkLabel: 'Weekly Brief',
    });
    timings.chiefOfStaffTransitionMs = await navigateAndMeasure({
      page,
      linkLabel: 'Chief of Staff',
    });
    timings.opsReliabilityTransitionMs = await navigateAndMeasure({
      page,
      linkLabel: 'Ops Reliability',
    });
    timings.settingsTransitionMs = await navigateAndMeasure({
      page,
      linkLabel: 'Settings',
    });
    // The heaviest route (lazy-loaded rich-text editor).
    timings.notebookTransitionMs = await navigateAndMeasure({
      page,
      linkLabel: 'Notebook',
    });
    timings.dashboardReturnTransitionMs = await navigateAndMeasure({
      page,
      linkLabel: 'Focus Home',
      headingLabel: 'Focus Home',
    });

    const transitionDurations = Object.entries(timings)
      .filter(([metricName]) => metricName !== 'dashboardInitialLoadMs')
      .map(([, value]) => value);
    const slowestTransitionMs = Math.max(...transitionDurations);

    await testInfo.attach('route-transition-timings', {
      body: JSON.stringify(
        {
          budgets: {
            initialLoadMs: INITIAL_LOAD_BUDGET_MS,
            routeTransitionMs: ROUTE_TRANSITION_BUDGET_MS,
          },
          timings,
          slowestTransitionMs,
        },
        null,
        2,
      ),
      contentType: 'application/json',
    });

    expect(timings.dashboardInitialLoadMs).toBeLessThan(INITIAL_LOAD_BUDGET_MS);
    expect(slowestTransitionMs).toBeLessThan(ROUTE_TRANSITION_BUDGET_MS);
  });
});

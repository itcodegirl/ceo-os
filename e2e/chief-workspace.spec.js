import { expect, test } from '@playwright/test';

async function resetToSeedState(page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
  });
  await page.reload();
  await expect(page.getByLabel('Primary navigation')).toBeVisible();
}

test.describe('Chief workspace flow', () => {
  test('persists founder notes locally and clears them cleanly after a confirmed reset', async ({ page }) => {
    const notes = 'Founder notes about priorities, pipeline follow-ups, and next week planning.';

    await resetToSeedState(page);
    await page.goto('/chief-of-staff');

    const notesInput = page.getByLabel('Founder notes for chief of staff workspace');
    const generateButton = page.getByRole('button', { name: 'Generate Action plan' });

    await expect(page.getByText('Chief workspace is stored on this device only.')).toBeVisible();
    await expect(page.getByText('Add a few founder notes, then choose what to make.')).toBeVisible();
    await expect(generateButton).toBeDisabled();

    await notesInput.fill(notes);

    await expect(page.getByText('Your notes stay editable. Review every recommendation before using it.')).toBeVisible();
    await expect(generateButton).toBeEnabled();

    await page.reload();

    await expect(notesInput).toHaveValue(notes);
    await expect(generateButton).toBeEnabled();

    // Reset is guarded by a confirmation dialog.
    await page.getByRole('button', { name: 'Reset Workspace' }).click();
    await expect(page.getByText(/This removes your saved notes and every generated output/)).toBeVisible();
    await page.getByRole('button', { name: 'Clear chief of staff workspace' }).click();

    await expect(notesInput).toHaveValue('');
    await expect(generateButton).toBeDisabled();

    await page.reload();

    await expect(notesInput).toHaveValue('');
    await expect(generateButton).toBeDisabled();
  });
});

import { expect, test } from '@playwright/test';

async function openNewLearningPage(page, title) {
  await page.goto('/notebook?section=learning');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByRole('button', { name: 'New page' }).first().click();
  await page.getByRole('dialog', { name: 'New Learning page' }).getByLabel('Title').fill(title);
  await page.getByRole('button', { name: 'Create page' }).click();
  await expect(page.getByLabel('Page title')).toHaveValue(title);
}

test.describe('Notebook cards, questions, and ideas', () => {
  test('selecting writing offers Make card, and the card links back to its source', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewLearningPage(page, 'Value pricing');

    const notes = page.getByRole('textbox', { name: 'My Notes' });
    await notes.click();
    await page.keyboard.type('Value pricing charges for the outcome.');
    await page.keyboard.down('Shift');
    for (let i = 0; i < 'the outcome.'.length; i += 1) await page.keyboard.press('ArrowLeft');
    await page.keyboard.up('Shift');

    const menu = page.getByRole('toolbar', { name: 'Selection actions in My Notes' });
    await expect(menu).toBeVisible();
    await menu.getByRole('button', { name: 'Make a card from the selection' }).click();

    const dialog = page.getByRole('dialog', { name: 'Make a card' });
    await expect(dialog.getByLabel('Prompt')).toBeFocused();
    await expect(dialog.getByLabel('Answer')).toHaveValue('the outcome.');
    await dialog.getByLabel('Prompt').fill('What does value pricing charge for?');
    await dialog.getByRole('button', { name: 'Save card' }).click();
    await expect(dialog).toBeHidden();
    await expect(notes).toBeFocused();

    const panel = page.getByRole('complementary', { name: 'Cards, questions, and ideas' });
    await expect(panel.getByRole('heading', { name: 'What does value pricing charge for?' })).toBeVisible();

    await page.reload();
    await panel.getByRole('button', { name: /^Show source in My Notes/ }).click();
    await expect(notes).toBeFocused();
    expect(await page.evaluate(() => window.getSelection()?.toString())).toBe('the outcome.');
  });

  test('the panel moves into a sheet when the window narrows', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openNewLearningPage(page, 'Hiring');
    const inlinePanel = page.getByRole('complementary', { name: 'Cards, questions, and ideas' });
    await expect(inlinePanel).toBeVisible();

    await page.setViewportSize({ width: 800, height: 900 });
    await expect(inlinePanel).toBeHidden();
    await page.getByRole('button', { name: 'Open ideas (0)' }).click();

    const sheet = page.getByRole('dialog', { name: 'Cards, questions, and ideas' });
    await expect(sheet.getByRole('tab', { name: /Ideas/ })).toHaveAttribute('aria-selected', 'true');
    await sheet.getByRole('button', { name: 'New idea' }).click();
    const composer = page.getByRole('dialog', { name: 'Save an idea' });
    await composer.getByLabel('Title').fill('Interview kit');
    await composer.getByRole('button', { name: 'Save idea' }).click();

    await expect(page.getByRole('button', { name: 'Open ideas (1)' })).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember } from './helpers';

async function openNav(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: label }).click();
}

async function makeChapterWith(page: Page, text: string) {
  await openNav(page, "Writer's Room");
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.type(text);
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
}

test.describe('tools: random tables, speed reader, templates', () => {
  test('random tables: roll → send to writer (persists) and create entity prefilled', async ({
    page,
  }) => {
    await bootWithProject(page);
    await makeChapterWith(page, 'The ferry left at dusk.');

    await openNav(page, 'Random Tables');
    await page.getByRole('button', { name: /Roll Character names/ }).click();
    const result = page.locator('.lw-rollresult__text').first();
    await expect(result).toBeVisible();
    const rolled = (await result.textContent())!.trim();

    // → Writer's Room appends to the latest chapter and opens it.
    await page.getByRole('button', { name: "→ Writer's Room" }).click();
    const body = page.getByLabel('Manuscript body');
    await expect(body).toContainText(rolled);
    await page.reload();
    await openNav(page, "Writer's Room");
    await expect(page.getByLabel('Manuscript body')).toContainText(rolled);

    // Create entity prefills the cast editor with the rolled name.
    await openNav(page, 'Random Tables');
    await page.getByRole('button', { name: /Roll Character names/ }).click();
    const rolled2 = (await page.locator('.lw-rollresult__text').first().textContent())!.trim();
    await page.getByRole('button', { name: 'Create entity' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Name *')).toHaveValue(rolled2);
    await dialog.getByRole('button', { name: 'Create character' }).click();
    await expect(dialog).toBeHidden();
    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: new RegExp(rolled2) })).toBeVisible();
  });

  test('random tables: own table with weighted rows, persists across reload', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Random Tables');

    await page.getByLabel('New table name').fill('Tavern names');
    await page.getByRole('button', { name: '+ New table' }).click();
    await page.getByRole('button', { name: '+ Add row' }).click();
    await page.getByLabel('Row 1 text').fill('The Salted Eel');
    await page.getByLabel('Row 1 weight').fill('3');

    await page.reload();
    await openNav(page, 'Random Tables');
    await page.getByLabel('Table', { exact: true }).selectOption({ label: 'Tavern names' });
    await expect(page.getByLabel('Row 1 text')).toHaveValue('The Salted Eel');
    await expect(page.getByLabel('Row 1 weight')).toHaveValue('3');

    await page.getByRole('button', { name: /Roll Tavern names/ }).click();
    await expect(page.locator('.lw-rollresult__text').first()).toHaveText('The Salted Eel');
  });

  test('speed reader: paste source plays through words; chapter source loads', async ({ page }) => {
    await bootWithProject(page);
    await makeChapterWith(page, 'Grey light crawled over the harbour wall.');

    await openNav(page, 'Speed Reader');
    await page
      .getByLabel('Paste text to read')
      .fill('alpha bravo charlie delta echo foxtrot golf hotel');
    const word = page.getByTestId('sr-word');
    await expect(word).toHaveText('alpha');

    // Manual stepping works.
    await page.getByRole('button', { name: 'Next word' }).click();
    await expect(word).toHaveText('bravo');
    await page.getByRole('button', { name: 'Previous word' }).click();
    await expect(word).toHaveText('alpha');

    // Play advances on real timers (800 wpm ≈ 75ms/word).
    await page.getByLabel(/Speed —/).fill('800');
    await page.getByRole('button', { name: 'Play' }).click();
    await expect
      .poll(async () => word.textContent(), { timeout: 5000 })
      .not.toBe('alpha');
    await page.getByRole('button', { name: 'Pause' }).click();

    // Restart rewinds.
    await page.getByRole('button', { name: 'Restart' }).click();
    await expect(word).toHaveText('alpha');

    // A chapter is a first-class source.
    await page.getByLabel('Source').selectOption({ label: 'Chapter 1 (7 words)' });
    await expect(word).toHaveText('Grey');
  });

  test('templates: genre starter prefills the editor; dossier save-as-template round trip', async ({
    page,
  }) => {
    await bootWithProject(page);

    await openNav(page, 'Templates');
    const starter = page.getByTestId('template-builtin:hf-class');
    await expect(starter).toContainText('Knight-errant');
    await starter.getByRole('button', { name: 'Use' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Description')).toHaveValue(/Heavy harness/);
    await dialog.getByLabel('Name *').fill('Ser Adalyn');
    await dialog.getByRole('button', { name: 'Create class' }).click();
    await expect(dialog).toBeHidden();
    await openNav(page, 'Classes');
    await expect(page.getByRole('button', { name: /Ser Adalyn/ })).toBeVisible();

    // Save an entity as a template from its dossier.
    await createCastMember(page, { name: 'Maren', summary: 'Runs the salt route.' });
    await page.getByRole('button', { name: /Maren/ }).click();
    await page.getByTestId('entity-detail').getByRole('button', { name: 'Save as template' }).click();
    await expect(page.getByText(/Saved “Maren template”/)).toBeVisible();

    await page.reload();
    await openNav(page, 'Templates');
    const saved = page.locator('.lw-template', { hasText: 'Maren template' });
    await expect(saved).toBeVisible();
    await saved.getByRole('button', { name: 'Delete' }).click();
    await expect(saved).toHaveCount(0);
  });

  test('tangle: save board as template and stamp it back with fresh cards', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Canvas click-placement flows are desktop.');
    await bootWithProject(page);

    await openNav(page, 'Tangle');
    await page.getByRole('button', { name: '+ New board' }).click();
    await page.getByLabel('Note text').fill('Victim');
    await page.getByRole('button', { name: 'Place', exact: true }).click();
    await page.getByTestId('tangle-canvas').click({ position: { x: 300, y: 200 } });
    await page.getByLabel('Note text').fill('Suspect');
    await page.getByRole('button', { name: 'Place', exact: true }).click();
    await page.getByTestId('tangle-canvas').click({ position: { x: 480, y: 300 } });
    await page.getByLabel('Thread label').fill('accuses');
    await page.getByRole('button', { name: 'Connect two cards' }).click();
    await page.getByTestId('node-Victim').click();
    await page.getByTestId('node-Suspect').click();
    await expect(page.getByTestId('edge-accuses')).toBeVisible();

    await page.getByRole('button', { name: 'Save board as template' }).click();
    await expect(page.getByText(/Saved “Board 1 template”/)).toBeVisible();

    await page.getByLabel('Stamp template').selectOption({ label: 'Board 1 template (2 cards)' });
    await expect(page.getByTestId('tangle-place-hint')).toContainText('Board 1 template');
    await page.getByTestId('tangle-canvas').click({ position: { x: 700, y: 420 } });

    await expect(page.getByTestId('node-Victim')).toHaveCount(2);
    await expect(page.getByTestId('node-Suspect')).toHaveCount(2);
    await expect(page.getByTestId('edge-accuses')).toHaveCount(2);

    await page.reload();
    await openNav(page, 'Tangle');
    await expect(page.getByTestId('node-Victim')).toHaveCount(2);
    await expect(page.getByTestId('edge-accuses')).toHaveCount(2);
  });
});

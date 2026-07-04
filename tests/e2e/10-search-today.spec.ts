import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember } from './helpers';

async function openNav(page: Page, label: string) {
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: label }).click();
}

async function newChapter(page: Page) {
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
}

async function typeAndSave(page: Page, text: string) {
  const seqBefore = Number(await page.getByTestId('save-state').getAttribute('data-save-seq'));
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.type(text);
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
  await expect
    .poll(async () => Number(await page.getByTestId('save-state').getAttribute('data-save-seq')))
    .toBeGreaterThan(seqBefore);
}

test.describe('command palette + Today', () => {
  test('palette finds an entity from the top bar and opens its dossier', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor Vael', summary: 'Queen in exile.' });

    await page.getByRole('button', { name: 'Search (Ctrl+K)' }).click();
    const palette = page.getByTestId('command-palette');
    await expect(palette).toBeVisible();
    await palette.getByLabel('Palette search').fill('Aelinor');
    await palette.getByRole('button', { name: /Aelinor Vael/ }).click();

    await expect(palette).toBeHidden();
    await expect(
      page.getByTestId('entity-detail').getByRole('heading', { name: 'Aelinor Vael' })
    ).toBeVisible();
  });

  test('Ctrl+K opens the palette; commands route; Escape closes', async ({ page }) => {
    await bootWithProject(page);

    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByTestId('command-palette');
    await expect(palette).toBeVisible();
    await palette.getByLabel('Palette search').fill('today');
    await palette.getByLabel('Palette search').press('Enter');
    await expect(palette).toBeHidden();
    await expect(page.getByTestId('surface-today')).toBeVisible();

    await page.keyboard.press('ControlOrMeta+k');
    await expect(palette).toBeVisible();
    await palette.getByLabel('Palette search').press('Escape');
    await expect(palette).toBeHidden();
  });

  test('palette opens the matching chapter, not just the surface', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, "Writer's Room");
    await newChapter(page);
    await typeAndSave(page, 'The salt wind came in from the east.');
    await newChapter(page);
    await typeAndSave(page, 'Aelinor waited at the ferry all night.');

    // We are on Chapter 2; the palette should switch us back to Chapter 1.
    await page.getByRole('button', { name: 'Search (Ctrl+K)' }).click();
    const palette = page.getByTestId('command-palette');
    await palette.getByLabel('Palette search').fill('salt wind');
    await palette.getByRole('button', { name: /Chapter 1/ }).click();

    const body = page.getByLabel('Manuscript body');
    await expect(body).toContainText('salt wind came in from the east');
    await expect(body).not.toContainText('waited at the ferry');
  });

  test('Today: words today count, continue-latest-chapter, review tile — and it survives reload', async ({
    page,
  }) => {
    await bootWithProject(page);
    // Home arms today's word baseline at zero before any writing.
    await expect(page.getByRole('button', { name: /0\s*Total words/ })).toBeVisible();

    await openNav(page, "Writer's Room");
    await newChapter(page);
    await typeAndSave(page, 'The salt wind came in from the east.');
    await newChapter(page);
    await typeAndSave(page, 'Aelinor waited at the ferry all night.');

    await openNav(page, 'Today');
    const today = page.getByTestId('surface-today');
    await expect(today).toBeVisible();
    // 8 + 7 words typed since the baseline was armed.
    await expect(page.getByTestId('words-today')).toContainText('15');

    // The words-today baseline lives in the database, not the session.
    await page.reload();
    await openNav(page, 'Today');
    await expect(page.getByTestId('words-today')).toContainText('15');

    // Continue writing goes to the most recently touched chapter (2), even
    // though a cold Writer's Room would default to Chapter 1.
    await page.getByRole('button', { name: /Continue “Chapter 2”/ }).click();
    await expect(page.getByLabel('Manuscript body')).toContainText('waited at the ferry');

    // The review tile is a real door too.
    await openNav(page, 'Today');
    await page.getByTestId('today-review').click();
    await expect(page.getByTestId('surface-review')).toBeVisible();
  });

  test('Today surfaces the next open quest step and opens the quest', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Quests');
    await page.getByRole('button', { name: '+ Create quest' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Title *').fill('The Silent Errand');
    await dialog.getByRole('button', { name: 'Steps & branches' }).click();
    const stepInput = dialog.getByPlaceholder('Add a step and press Enter');
    await stepInput.fill('Reach the watchhouse');
    await stepInput.press('Enter');
    await stepInput.fill('Deliver the letter');
    await stepInput.press('Enter');
    await dialog.getByRole('button', { name: 'Create quest' }).click();
    await expect(dialog).toBeHidden();

    await openNav(page, 'Today');
    const suggestion = page.getByRole('button', { name: /The Silent Errand/ });
    await expect(suggestion).toContainText('Step 1: Reach the watchhouse');
    await suggestion.click();
    await expect(
      page.getByTestId('entity-detail').getByRole('heading', { name: 'The Silent Errand' })
    ).toBeVisible();
  });
});

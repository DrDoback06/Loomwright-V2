import { test, expect, type Page } from '@playwright/test';
import { bootWithProject } from './helpers';

async function openWritersRoom(page: Page) {
  await page
    .getByRole('navigation', { name: 'Workspace' })
    .getByRole('button', { name: "Writer's Room" })
    .click();
  await expect(page.getByTestId('surface-writers-room')).toBeVisible();
}

async function createFirstChapter(page: Page) {
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
  await expect(page.getByLabel('Manuscript body')).toBeVisible();
}

test.describe("writer's room", () => {
  test('type real prose, bold a word, reload — text and formatting persist', async ({ page }) => {
    await bootWithProject(page);
    await openWritersRoom(page);
    await createFirstChapter(page);

    const body = page.getByLabel('Manuscript body');
    await body.click();
    await page.keyboard.type('The light over Pale Reach was the colour of old coin.');

    // Select "Pale Reach" by double-clicking a word then extending — simpler:
    // select all and bold, then assert strong tag exists.
    await page.keyboard.press('ControlOrMeta+a');
    await page.getByRole('toolbar', { name: 'Formatting' }).getByRole('button', { name: 'Bold' }).click();
    await expect(body.locator('strong')).toContainText('Pale Reach');

    // Autosave then reload.
    await expect(page.getByText(/Saved/)).toBeVisible();
    await page.reload();
    await openWritersRoom(page);
    const bodyAfter = page.getByLabel('Manuscript body');
    await expect(bodyAfter).toContainText('The light over Pale Reach');
    await expect(bodyAfter.locator('strong')).toContainText('Pale Reach');

    // Word count strip reflects the prose.
    await expect(page.getByText(/11 words/)).toBeVisible();
  });

  test('chapters: create two, rename, reorder with arrows, order survives reload', async ({
    page,
  }) => {
    await bootWithProject(page);
    await openWritersRoom(page);
    await createFirstChapter(page);
    await page
      .getByRole('tablist', { name: 'Chapters' })
      .getByRole('button', { name: '+ New chapter' })
      .click();

    // Rename the active (second) chapter.
    await page.getByLabel('Chapter title').fill('Pale Reach');
    await expect(page.getByRole('tab', { name: /Pale Reach/ })).toBeVisible();

    // Move it earlier.
    await page.getByRole('button', { name: 'Move chapter earlier' }).click();
    const tabs = page.getByRole('tab');
    await expect(tabs.first()).toContainText('Pale Reach');

    await page.reload();
    await openWritersRoom(page);
    await expect(page.getByRole('tab').first()).toContainText('Pale Reach');
  });

  test('chapter delete goes to trash and can be restored with its text', async ({ page }) => {
    await bootWithProject(page);
    await openWritersRoom(page);
    await createFirstChapter(page);

    await page.getByLabel('Manuscript body').click();
    await page.keyboard.type('Do not lose this sentence.');
    await expect(page.getByText(/Saved/)).toBeVisible();

    await page.getByTestId('surface-writers-room').getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('button', { name: 'Move to trash' }).click();
    await expect(page.getByText('No chapters yet.')).toBeVisible();

    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Trash' }).click();
    await page.getByTestId('surface-trash').getByRole('button', { name: 'Restore' }).click();

    await openWritersRoom(page);
    await expect(page.getByLabel('Manuscript body')).toContainText('Do not lose this sentence.');
  });

  test('paragraph note: add at caret, resolve, reload persists', async ({ page }) => {
    await bootWithProject(page);
    await openWritersRoom(page);
    await createFirstChapter(page);

    await page.getByLabel('Manuscript body').click();
    await page.keyboard.type('Open cold — make the cold a character.');
    await expect(page.getByText(/Saved/)).toBeVisible();

    // The rail starts closed on phones — open it via its real toggle.
    const notesToggle = page.getByRole('button', { name: 'Notes', exact: true });
    if ((await notesToggle.getAttribute('aria-pressed')) !== 'true') {
      await notesToggle.click();
    }
    await page.getByLabel('New note text').fill("Lean into 'architecture' of the face later.");
    await page.getByRole('button', { name: 'Add note' }).click();
    const rail = page.getByRole('complementary', { name: 'Paragraph notes' });
    await expect(rail.getByText("Lean into 'architecture'")).toBeVisible();
    await expect(rail.getByText('¶ 1')).toBeVisible();

    await page.reload();
    await openWritersRoom(page);
    const notesToggleAfter = page.getByRole('button', { name: 'Notes', exact: true });
    if ((await notesToggleAfter.getAttribute('aria-pressed')) !== 'true') {
      await notesToggleAfter.click();
    }
    const railAfter = page.getByRole('complementary', { name: 'Paragraph notes' });
    await expect(railAfter.getByText("Lean into 'architecture'")).toBeVisible();

    await railAfter.getByRole('button', { name: 'Resolve' }).click();
    await expect(railAfter.getByText("Lean into 'architecture'")).toBeHidden();
    await railAfter.getByLabel('Show resolved').check();
    await expect(railAfter.getByText("Lean into 'architecture'")).toBeVisible();
  });
});

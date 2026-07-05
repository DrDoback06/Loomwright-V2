import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, openNav } from './helpers';

async function openWritersRoom(page: Page) {
  await openNav(page, "Writer's Room");
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

    const seqBefore = Number(
      (await page.getByTestId('save-state').getAttribute('data-save-seq')) ?? '0'
    );

    // Select all and bold, then assert the strong mark exists.
    await page.keyboard.press('ControlOrMeta+a');
    await page.getByRole('toolbar', { name: 'Formatting' }).getByRole('button', { name: 'Bold' }).click();
    await expect(body.locator('strong')).toContainText('Pale Reach');

    // Wait for the POST-BOLD autosave to land: at least one save has
    // completed since before the bold AND nothing is pending. The state
    // machine only reports 'saved' when no debounce timer is armed.
    await expect
      .poll(async () => {
        const el = page.getByTestId('save-state');
        const seq = Number((await el.getAttribute('data-save-seq')) ?? '0');
        const state = await el.getAttribute('data-save-state');
        return state === 'saved' && seq > seqBefore;
      })
      .toBe(true);
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
    // Creation switches the active chapter asynchronously — wait for the
    // new tab to be selected before renaming, or the rename hits ch. 1.
    await expect(page.getByRole('tab', { name: /Chapter 2/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );

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

    await openNav(page, 'Trash');
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
    // Scope to the saved-note list — the draft textarea briefly holds the
    // same text until its clear commits.
    await expect(rail.locator('.lw-note__text', { hasText: "Lean into 'architecture'" })).toBeVisible();
    await expect(rail.getByText('¶ 1')).toBeVisible();

    await page.reload();
    await openWritersRoom(page);
    const notesToggleAfter = page.getByRole('button', { name: 'Notes', exact: true });
    if ((await notesToggleAfter.getAttribute('aria-pressed')) !== 'true') {
      await notesToggleAfter.click();
    }
    const railAfter = page.getByRole('complementary', { name: 'Paragraph notes' });
    const savedNote = railAfter.locator('.lw-note__text', { hasText: "Lean into 'architecture'" });
    await expect(savedNote).toBeVisible();

    await railAfter.getByRole('button', { name: 'Resolve' }).click();
    await expect(savedNote).toBeHidden();
    await railAfter.getByLabel('Show resolved').check();
    await expect(savedNote).toBeVisible();
  });
});

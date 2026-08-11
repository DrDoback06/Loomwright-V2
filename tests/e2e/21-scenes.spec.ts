import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, openNav } from './helpers';

// Scenes are the unit the planning views, the beats and every health
// analyser are built on. What matters here is that the prose survives
// every structural move — splitting, switching, restoring — because a
// manuscript tool that loses a paragraph has no second chance.

async function openWritersRoom(page: Page) {
  await openNav(page, "Writer's Room");
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
}

async function typeAndSave(page: Page, text: string) {
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.type(text);
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
}

test.describe('scenes', () => {
  test('a new chapter opens with one scene, and a second scene keeps its own prose', async ({
    page,
  }) => {
    await bootWithProject(page);
    await openWritersRoom(page);

    const strip = page.getByRole('tablist', { name: 'Scenes' });
    await expect(strip.getByRole('tab')).toHaveCount(1);
    await typeAndSave(page, 'The harbour bells rang the short peal.');

    await strip.getByRole('button', { name: '+ Scene' }).click();
    await expect(strip.getByRole('tab')).toHaveCount(2);
    // A fresh scene is empty — the first scene's text did not follow it.
    await expect(page.getByLabel('Manuscript body')).not.toContainText('harbour bells');
    await typeAndSave(page, 'Vex waited at the ferry all night.');

    // Switching back shows the first scene's prose, unchanged.
    await strip.getByRole('tab').first().click();
    await expect(page.getByLabel('Manuscript body')).toContainText('harbour bells');

    // And both survive a reload.
    await page.reload();
    await openNav(page, "Writer's Room");
    await expect(page.getByLabel('Manuscript body')).toContainText('harbour bells');
    await page.getByRole('tablist', { name: 'Scenes' }).getByRole('tab').nth(1).click();
    await expect(page.getByLabel('Manuscript body')).toContainText('ferry all night');
  });

  test('the chapter word count is the sum of its scenes', async ({ page }) => {
    await bootWithProject(page);
    await openWritersRoom(page);
    await typeAndSave(page, 'One two three four five.');

    const strip = page.getByRole('tablist', { name: 'Scenes' });
    await strip.getByRole('button', { name: '+ Scene' }).click();
    await typeAndSave(page, 'Six seven eight.');

    await expect(
      page.getByRole('tablist', { name: 'Chapters' }).getByRole('tab').first()
    ).toContainText('8w');
  });

  test('scene metadata persists and is what the planning views will read', async ({ page }) => {
    await bootWithProject(page);
    await openWritersRoom(page);

    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    const panel = page.getByTestId('scene-panel');
    await expect(panel).toBeVisible();

    await panel.getByLabel('Summary').fill('Vex confronts Marrow about the blade.');
    await panel.getByRole('button', { name: /Revised/ }).click();
    await panel.getByLabel('Word target').fill('1200');
    await panel.getByLabel('Let AI read this scene').uncheck();

    await page.reload();
    await openNav(page, "Writer's Room");
    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    const reopened = page.getByTestId('scene-panel');
    await expect(reopened.getByLabel('Summary')).toHaveValue(
      'Vex confronts Marrow about the blade.'
    );
    await expect(reopened.getByRole('button', { name: /Revised/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    await expect(reopened.getByLabel('Word target')).toHaveValue('1200');
    await expect(reopened.getByLabel('Let AI read this scene')).not.toBeChecked();
  });

  test('a save point restores earlier prose, and keeps what it replaced', async ({ page }) => {
    await bootWithProject(page);
    await openWritersRoom(page);
    await typeAndSave(page, 'The first version of this line.');

    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    const panel = page.getByTestId('scene-panel');
    await panel.getByRole('button', { name: 'Save point' }).click();
    await expect(panel.getByText('Manual save point')).toBeVisible();

    // On a phone the panel is a sheet over the manuscript, so close it to
    // write — the same thing a person would do.
    await panel.getByRole('button', { name: 'Close scene details' }).click();
    await page.getByLabel('Manuscript body').click();
    await page.keyboard.press('End');
    await page.keyboard.type(' And a second thought entirely.');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');

    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    await panel.getByRole('button', { name: 'Restore' }).first().click();
    await expect(page.getByLabel('Manuscript body')).not.toContainText('second thought');
    await expect(page.getByLabel('Manuscript body')).toContainText('first version');

    // Restoring is itself recoverable: the replaced version was kept.
    await expect(panel.getByText('Before restore')).toBeVisible();
  });

  test('the last scene of a chapter cannot be deleted out from under the editor', async ({
    page,
  }) => {
    await bootWithProject(page);
    await openWritersRoom(page);
    await expect(page.getByRole('button', { name: 'Delete scene' })).toBeDisabled();

    await page.getByRole('tablist', { name: 'Scenes' }).getByRole('button', { name: '+ Scene' }).click();
    await expect(page.getByRole('button', { name: 'Delete scene' })).toBeEnabled();
  });

  test('deleting a chapter takes its scenes, and restoring brings the text back', async ({
    page,
  }) => {
    await bootWithProject(page);
    await openWritersRoom(page);
    await typeAndSave(page, 'Do not lose this sentence.');

    await page
      .getByTestId('surface-writers-room')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await page.getByRole('button', { name: 'Move to trash' }).click();
    await expect(page.getByTestId('write-empty')).toBeVisible();

    await openNav(page, 'Trash');
    await page.getByTestId('surface-trash').getByRole('button', { name: 'Restore' }).click();

    await openNav(page, "Writer's Room");
    await expect(page.getByLabel('Manuscript body')).toContainText('Do not lose this sentence.');
    await expect(page.getByRole('tablist', { name: 'Scenes' }).getByRole('tab')).toHaveCount(1);
  });
});

import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, openNav } from './helpers';

// AI visibility, at both scales.
//
// A scene can be kept out of every AI prompt, and (from step 2) so can a
// single block inside one. Both promises are made by a checkbox, and a
// promise about what leaves your machine is the one kind of control that
// must be tested by its consequence rather than by its storage: proving a
// flag round-trips through a reload proves nothing about what a model was
// shown.

async function newChapter(page: Page) {
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

/** Build the handoff pack for the only chapter. The pack is the app's most
 * literal AI prompt — a self-contained block of text the author hands to
 * an outside model — and it is rendered into a textarea, so what a model
 * would be told can be read directly rather than inferred. */
async function buildPack(page: Page): Promise<string> {
  await openNav(page, 'AI Handoff');
  const chapter = page.getByLabel('Chapter to include');
  await chapter.selectOption({ index: 1 });
  await page.getByRole('button', { name: 'Build pack' }).click();
  return page.getByLabel('Handoff pack').inputValue();
}

test.describe('a scene the AI may not read', () => {
  test('is absent from the prompt, present in the word count, and still findable', async ({
    page,
  }) => {
    await bootWithProject(page);
    await newChapter(page);
    await typeAndSave(page, 'The ferry did not come.');

    const strip = page.getByRole('tablist', { name: 'Scenes' });
    await strip.getByRole('button', { name: '+ Scene' }).click();
    await typeAndSave(page, 'Maybe Marrow is the traitor.');

    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    const panel = page.getByTestId('scene-panel');
    await panel.getByLabel('Let AI read this scene').uncheck();
    await panel.getByRole('button', { name: 'Close scene details' }).click();

    // The author wrote those five words, so they are still counted. Hiding
    // a scene from a model is not the same as not having written it.
    await expect(
      page.getByRole('tablist', { name: 'Chapters' }).getByRole('tab').first()
    ).toContainText('10w');

    // But they are not in what leaves the machine.
    const pack = await buildPack(page);
    expect(pack).toContain('The ferry did not come.');
    expect(pack).not.toContain('traitor');

    // And it is still your book: local search reads the document, not the
    // AI substrate, so a note you hid is still a note you can find.
    await page.keyboard.press('Control+k');
    const palette = page.getByTestId('command-palette');
    await palette.getByLabel('Palette search').fill('#traitor');
    await expect(palette.getByRole('button', { name: /Chapter ·/ })).toHaveCount(1);
  });

  test('goes back into the prompt the moment the box is ticked again', async ({ page }) => {
    await bootWithProject(page);
    await newChapter(page);
    await typeAndSave(page, 'Maybe Marrow is the traitor.');

    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    const panel = page.getByTestId('scene-panel');
    await panel.getByLabel('Let AI read this scene').uncheck();
    await panel.getByRole('button', { name: 'Close scene details' }).click();
    expect(await buildPack(page)).not.toContain('traitor');

    await openNav(page, "Writer's Room");
    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    await page.getByTestId('scene-panel').getByLabel('Let AI read this scene').check();
    await page
      .getByTestId('scene-panel')
      .getByRole('button', { name: 'Close scene details' })
      .click();
    expect(await buildPack(page)).toContain('traitor');
  });
});

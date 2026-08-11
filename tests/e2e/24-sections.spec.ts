import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

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

test.describe('scene metadata that other surfaces read', () => {
  test('labels reach the Board, and an attached entry reaches the prompt', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow', summary: 'A ferryman who owes money.' });
    await newChapter(page);
    await typeAndSave(page, 'The ferry did not come.');

    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    const panel = page.getByTestId('scene-panel');

    await panel.getByLabel('Add a label').fill('night');
    await panel.getByRole('button', { name: 'Add', exact: true }).click();
    await panel.getByLabel('Add a label').fill('setup');
    await panel.getByLabel('Add a label').press('Enter');
    await expect(panel.getByText('night')).toBeVisible();

    // Marrow is nowhere in the prose, so nothing could infer he matters
    // here. Attaching him is how you say so.
    await panel
      // The rendered label uses a typographic apostrophe.
      .getByLabel(/Always in this scene.s AI context/)
      .selectOption({ label: 'Cast · Marrow' });
    await expect(panel.getByRole('button', { name: 'Remove Marrow from this scene' })).toBeVisible();

    await panel.getByRole('button', { name: 'Close scene details' }).click();

    // The labels are on the Board card, which is the reader that already
    // existed and had nothing to render.
    await openNav(page, 'Board');
    await expect(page.getByTestId('plan-board')).toContainText('night');
    await expect(page.getByTestId('plan-board')).toContainText('setup');

    // And the attachment is in what a beat would send.
    await openNav(page, "Writer's Room");
    await page.getByLabel('Manuscript body').click();
    await page.keyboard.press('End');
    await page.getByRole('button', { name: 'Insert scene beat' }).click();
    await page.keyboard.type('They wait.');
    await page.getByTestId('scene-beat').first().getByRole('button', { name: 'Copy prompt' }).click();
    const prompt = await page.getByTestId('scene-beat').first().getByLabel('Prompt to send').inputValue();
    expect(prompt).toContain('Marrow');
    expect(prompt).toContain('A ferryman who owes money.');

    // Both survive a reload; they are scene data, not panel state.
    await page.reload();
    await openNav(page, "Writer's Room");
    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    await expect(
      page.getByTestId('scene-panel').getByRole('button', { name: 'Remove label night' })
    ).toBeVisible();
  });
});

test.describe('sections', () => {
  test('a note counts as neither words written nor words sent', async ({ page }) => {
    await bootWithProject(page);
    await newChapter(page);
    await typeAndSave(page, 'The ferry did not come.');

    // `/note ` is the discoverable path; the toolbar button and
    // Mod+Shift+N run the identical command.
    await page.getByLabel('Manuscript body').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/note ');
    await page.keyboard.type('Marrow is the traitor.');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');

    const section = page.getByTestId('section');
    await expect(section).toContainText('Marrow is the traitor.');
    // Five words of manuscript. The note's four are not the book.
    await expect(page.getByTestId('save-state')).toContainText('5 words');

    const pack = await buildPack(page);
    expect(pack).toContain('The ferry did not come.');
    expect(pack).not.toContain('traitor');

    // It is prose in a document, so it survives a reload like any other.
    await openNav(page, "Writer's Room");
    await page.reload();
    await openNav(page, "Writer's Room");
    await expect(page.getByTestId('section')).toContainText('Marrow is the traitor.');
    await expect(page.getByTestId('save-state')).toContainText('5 words');
  });

  test('the two switches are genuinely independent', async ({ page }) => {
    await bootWithProject(page);
    await newChapter(page);
    await typeAndSave(page, 'The ferry did not come.');

    await page.getByLabel('Manuscript body').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/note ');
    await page.keyboard.type('Ferries ran hourly until nineteen twelve.');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');

    const section = page.getByTestId('section');

    // Counted but never sent: an alternate take is real writing you may
    // not want written back at you.
    await section.getByLabel('Count these words').check();
    await expect(page.getByTestId('save-state')).toContainText('11 words');
    expect(await buildPack(page)).not.toContain('nineteen twelve');

    // Sent but never counted: pasted research is the model's business and
    // not your word count. Neither switch moved the other.
    await openNav(page, "Writer's Room");
    await section.getByLabel('Count these words').uncheck();
    await section.getByLabel('Let AI read this').check();
    await expect(page.getByTestId('save-state')).toContainText('5 words');
    expect(await buildPack(page)).toContain('nineteen twelve');
  });

  test('removing a section keeps every word inside it', async ({ page }) => {
    await bootWithProject(page);
    await newChapter(page);
    await typeAndSave(page, 'The ferry did not come.');

    await page.getByLabel('Manuscript body').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/note ');
    await page.keyboard.type('Words that must survive.');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
    await expect(page.getByTestId('save-state')).toContainText('5 words');

    await page.getByTestId('section').getByRole('button', { name: 'Remove section' }).click();
    await expect(page.getByTestId('section')).toHaveCount(0);
    // Unwrapped, not deleted — and now ordinary prose, so it counts.
    await expect(page.locator('.lw-manuscript')).toContainText('Words that must survive.');
    await expect(page.getByTestId('save-state')).toContainText('9 words');
  });
});

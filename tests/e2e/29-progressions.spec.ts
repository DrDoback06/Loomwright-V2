import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

// Progressions anchor a fact to a point in the story, so drafting chapter
// two cannot leak chapter forty. The assertions that matter are about the
// PAYLOAD — the context rail's Preview is what a beat sends, so proving a
// fact is absent there proves it is absent from every AI path at once.

async function openWritersRoom(page: Page) {
  await openNav(page, "Writer's Room");
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
}

async function typeAndSave(page: Page, text: string) {
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.press('End');
  await page.keyboard.type(text);
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
}

async function openScenePanel(page: Page) {
  await page.getByRole('button', { name: 'Scene', exact: true }).click();
  const panel = page.getByTestId('scene-panel');
  await expect(panel).toBeVisible();
  return panel;
}

async function previewText(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'Context', exact: true }).click();
  const rail = page.getByTestId('context-rail');
  await rail.getByText('Show exactly what gets sent').click();
  const text = await rail.getByTestId('context-preview').innerText();
  await rail.getByRole('button', { name: 'Close AI context' }).click();
  return text;
}

test.describe('progressions', () => {
  test('a fact anchored later is absent from an earlier scene’s payload', async ({ page }) => {
    // The whole feature, asserted through the thing that actually gets sent.
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow', summary: 'A ferryman.' });
    await openWritersRoom(page);
    await typeAndSave(page, 'Marrow poled the ferry across the water.');

    // A second scene, later in the book, is where the fact becomes true.
    await page.getByRole('tablist', { name: 'Scenes' }).getByRole('button', { name: '+ Scene' }).click();
    await typeAndSave(page, 'Marrow crossed again, and did not come back.');

    const panel = await openScenePanel(page);
    await panel.getByLabel('Who or what').selectOption({ label: 'Cast · Marrow' });
    await panel.getByLabel('What became true').fill('Marrow is carrying the ash-blade.');
    await panel.getByRole('button', { name: 'Anchor here' }).click();
    await expect(panel.getByText('Marrow is carrying the ash-blade.')).toBeVisible();
    await panel.getByRole('button', { name: 'Close scene details' }).click();

    // Here — the scene it was anchored to — it is in the payload.
    expect(await previewText(page)).toContain('ash-blade');

    // And in the scene before it, it does not exist yet.
    await page.getByRole('tablist', { name: 'Scenes' }).getByRole('tab').first().click();
    const earlier = await previewText(page);
    expect(earlier).toContain('Marrow');
    expect(earlier).not.toContain('ash-blade');
  });

  test('a progression survives a reload and can be taken back out', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Vex' });
    await openWritersRoom(page);
    await typeAndSave(page, 'Vex waited at the landing.');

    let panel = await openScenePanel(page);
    await panel.getByLabel('Who or what').selectOption({ label: 'Cast · Vex' });
    await panel.getByLabel('What became true').fill('Vex knows the ferryman’s name.');
    await panel.getByRole('button', { name: 'Anchor here' }).click();
    await expect(panel.getByText('Vex knows the ferryman’s name.')).toBeVisible();

    await page.reload();
    await openNav(page, "Writer's Room");
    panel = await openScenePanel(page);
    await expect(panel.getByText('Vex knows the ferryman’s name.')).toBeVisible();

    await panel
      .getByRole('button', { name: 'Remove progression Vex knows the ferryman’s name.' })
      .click();
    await expect(panel.getByText('Vex knows the ferryman’s name.')).toBeHidden();
  });

  test('`/progress` opens the composer instead of leaving anything in the prose', async ({
    page,
  }) => {
    // A progression is a row about the story, not part of it. Left in the
    // document it would reach the word count, the exports, and — worst —
    // extraction, which would then propose the fact it had just been told.
    await bootWithProject(page);
    await createCastMember(page, { name: 'Vex' });
    await openWritersRoom(page);
    await typeAndSave(page, 'One two three four five.');

    await page.getByLabel('Manuscript body').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/progress ');

    await expect(page.getByTestId('scene-panel')).toBeVisible();
    await expect(page.getByLabel('Manuscript body')).not.toContainText('/progress');
    await expect(page.getByTestId('save-state')).toContainText('5 words');
  });

  test('summarising works with no API key, and the stale chip fires when the prose moves on', async ({
    page,
  }) => {
    await bootWithProject(page);
    await openWritersRoom(page);
    await typeAndSave(
      page,
      'Vex arrived at the ferry landing before dawn. The water was flat and grey. She told Marrow she had found the ash-blade in the reeds.'
    );

    const panel = await openScenePanel(page);
    await expect(panel.getByTestId('summary-stale')).toBeHidden();
    await panel.getByRole('button', { name: 'Summarise' }).click();
    // Extractive: every word is a word the author wrote.
    await expect(panel.getByLabel('Summary')).not.toHaveValue('');
    await expect(panel.getByLabel('Summary')).toContainText('ferry landing');

    await panel.getByRole('button', { name: 'Close scene details' }).click();
    await typeAndSave(page, ' Then the crossing closed for good.');

    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    await expect(page.getByTestId('scene-panel').getByTestId('summary-stale')).toBeVisible();
  });

  test('a summary reaches a beat’s prompt as the story so far', async ({ page }) => {
    // Long-book memory: summaries travel instead of the manuscript, which
    // is the only version of this that still fits at 150k words.
    await bootWithProject(page);
    await openWritersRoom(page);
    await typeAndSave(page, 'Vex left the city before anyone was awake.');

    let panel = await openScenePanel(page);
    await panel.getByLabel('Summary').fill('Vex leaves the city and takes the northern road.');
    await panel.getByRole('button', { name: 'Close scene details' }).click();

    await page.getByRole('tablist', { name: 'Scenes' }).getByRole('button', { name: '+ Scene' }).click();
    await typeAndSave(page, 'The road climbed.');
    // Give this scene its own summary too, so the assertion below can only
    // pass by reading the PRIOR one.
    panel = await openScenePanel(page);
    await panel.getByLabel('Summary').fill('The road climbs into the hills.');
    await panel.getByRole('button', { name: 'Close scene details' }).click();

    await page.getByLabel('Manuscript body').click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/beat ');
    await page.keyboard.type('She reaches the pass.');
    const beat = page.locator('.lw-beat').first();
    await beat.getByRole('button', { name: 'Copy prompt' }).click();

    const prompt = await beat.getByLabel('Prompt to send').inputValue();
    expect(prompt).toContain('THE STORY SO FAR');
    // Just the block under that heading, not the whole prompt: the beat
    // also carries this scene's own summary, under a different heading and
    // for a different reason.
    const block = prompt.split('THE STORY SO FAR')[1].split('\n\n')[0];
    expect(block).toContain('Vex leaves the city and takes the northern road.');
    // A scene never says its own summary back to itself as history.
    expect(block).not.toContain('The road climbs into the hills.');
  });
});

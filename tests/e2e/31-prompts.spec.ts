import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, openNav } from './helpers';

// The prompt library. The only assertion that matters is the last kind:
// editing a template must change what actually gets sent. A prompt editor
// whose edits go nowhere is the worst version of this feature, so the
// consequence is asserted through the beat's copied prompt — the same
// string the in-app call uses.

async function openPrompts(page: Page) {
  await openNav(page, 'Settings');
  const panel = page.getByTestId('settings-prompts');
  await expect(panel).toBeVisible();
  return panel;
}

async function openTemplate(page: Page, name: string) {
  const panel = await openPrompts(page);
  await panel.getByRole('button', { name: new RegExp(name) }).click();
  return panel;
}

async function newChapterWithProse(page: Page, prose: string) {
  await openNav(page, "Writer's Room");
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.type(prose);
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
}

async function beatPrompt(page: Page, instruction: string) {
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.press('End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('/beat ');
  await page.keyboard.type(instruction);
  const beat = page.locator('.lw-beat').first();
  await beat.getByRole('button', { name: 'Copy prompt' }).click();
  return beat.getByLabel('Prompt to send').inputValue();
}

test.describe('prompt library', () => {
  test('ships full rather than empty, with the app’s own prompts in it', async ({ page }) => {
    await bootWithProject(page);
    const panel = await openPrompts(page);

    // Seeded from `services/ai/prompts/`, so editing one is a fork of
    // something that works rather than a blank page.
    await expect(panel.getByRole('button', { name: /Scene beat/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /Rewrite a selection/ })).toBeVisible();
    await expect(panel.getByRole('button', { name: /Chat — Continuity/ })).toBeVisible();

    await panel.getByRole('button', { name: /Scene beat/ }).click();
    await expect(panel.getByLabel('How the model should behave')).not.toHaveValue('');
    await expect(panel.getByLabel('Extra instructions')).toHaveValue('');
  });

  test('EDITING A TEMPLATE CHANGES WHAT GETS SENT', async ({ page }) => {
    await bootWithProject(page);
    const panel = await openTemplate(page, 'Scene beat');

    await panel
      .getByLabel('Extra instructions')
      .fill('Every paragraph must name the weather in {scene.title}.');
    await panel.getByRole('button', { name: 'Save', exact: true }).click();

    await newChapterWithProse(page, 'Marrow poled the ferry across the water.');
    const prompt = await beatPrompt(page, 'They argue about the crossing.');

    expect(prompt).toContain('EXTRA INSTRUCTIONS FROM YOUR TEMPLATE');
    // Resolved, not sent as a literal token.
    expect(prompt).toContain('Every paragraph must name the weather in Scene 1.');
    expect(prompt).not.toContain('{scene.title}');
    // And the assembled brief is still there — the template adds, it does
    // not replace the context engine's work.
    expect(prompt).toContain('THIS IS A BEAT, NOT A SCENE');
  });

  test('editing a default is copy-on-write, and Reset genuinely undoes it', async ({ page }) => {
    await bootWithProject(page);
    let panel = await openTemplate(page, 'Scene beat');
    await panel.getByLabel('Extra instructions').fill('Write it all in limericks.');
    await panel.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(panel.getByText('edited')).toBeVisible();

    await newChapterWithProse(page, 'Marrow poled the ferry across the water.');
    expect(await beatPrompt(page, 'They argue.')).toContain('limericks');

    panel = await openTemplate(page, 'Scene beat');
    await panel.getByRole('button', { name: 'Reset to default' }).click();
    await expect(panel.getByRole('button', { name: /Scene beat/ })).toBeVisible();

    await openNav(page, "Writer's Room");
    expect(await beatPrompt(page, 'They argue again.')).not.toContain('limericks');
  });

  test('a test run resolves against the real project and names a variable it does not know', async ({
    page,
  }) => {
    await bootWithProject(page);
    await newChapterWithProse(page, 'Marrow poled the ferry across the water.');

    const panel = await openTemplate(page, 'Scene beat');
    await panel
      .getByLabel('Extra instructions')
      .fill('Set it in {scene.title}, and mind the {scene.weather}.');
    await panel.getByRole('button', { name: 'Test run' }).click();

    const preview = panel.getByTestId('prompt-preview');
    await expect(preview).toContainText('Set it in Scene 1');
    // A typo shows up as a typo, before it reaches a model.
    await expect(preview).toContainText('UNRECOGNISED VARIABLES: {scene.weather}');
  });

  test('prompts round-trip through the clipboard, and junk is refused', async ({ page }) => {
    await bootWithProject(page);
    const panel = await openPrompts(page);

    await panel.getByRole('button', { name: 'Copy all as JSON' }).click();
    const json = await panel.getByLabel('Prompts as JSON').inputValue();
    expect(json).toContain('loomwright-prompts-v1');
    expect(json).toContain('"kind": "beat"');

    await panel.getByLabel('Prompts as JSON').fill('these are my prompts, trust me');
    await panel.getByRole('button', { name: 'Import from JSON' }).click();
    await expect(page.getByText(/was not JSON/)).toBeVisible();
  });

  test('a chat mode’s prompt is editable, and the change reaches the conversation', async ({
    page,
  }) => {
    await bootWithProject(page);
    const panel = await openTemplate(page, 'Chat — Brainstorm');
    await panel
      .getByLabel('How the model should behave')
      .fill('You answer only in numbered lists.');
    await panel.getByRole('button', { name: 'Save', exact: true }).click();

    await newChapterWithProse(page, 'Marrow poled the ferry across the water.');
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    const dock = page.getByTestId('chat-dock');
    await dock.getByLabel('Message').fill('What could go wrong at the crossing?');
    await dock.getByRole('button', { name: 'Copy conversation' }).click();

    // The offline path carries the same edit the in-app call would — the
    // two are the same prompt, run in different places.
    expect(await dock.getByLabel('Prompt to send').inputValue()).toContain(
      'You answer only in numbered lists.'
    );
  });
});

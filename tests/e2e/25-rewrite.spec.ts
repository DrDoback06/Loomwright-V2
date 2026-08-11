import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, openNav } from './helpers';

// Rewriting in place is the one AI action that can destroy work rather than
// add to it: it replaces prose the author already wrote. So what matters is
// that it never fires uninvited, never writes without an Apply, always
// leaves a save point behind, and works with no key at all.

const FAKE_KEY = 'sk-ant-e2e-fake';

function mockAnthropic(page: Page, reply: string | (() => string)) {
  return page.route('https://api.anthropic.com/**', async (route) => {
    const text = typeof reply === 'function' ? reply() : reply;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text }] }),
    });
  });
}

async function configureAnthropic(page: Page) {
  await openNav(page, 'Settings');
  const provider = page.getByTestId('provider-anthropic');
  await provider.getByLabel('Anthropic API key').fill(FAKE_KEY);
  await provider.getByRole('button', { name: 'Save key' }).click();
  await expect(provider.getByText('key saved ✓')).toBeVisible();
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

/** Select a line of prose.
 *
 * Home-then-Shift+End rather than a triple click or Ctrl+A: a triple click
 * inherits the browser's multi-click counter from whatever was clicked
 * before it (after a button press it lands on a double-click and selects
 * one word), and Ctrl+A in the container clicks its centre, which can be a
 * bubble left open by an earlier step. This is what the caret does. */
async function selectLine(page: Page, text: string) {
  await page.locator('.lw-manuscript p', { hasText: text }).first().click();
  await page.keyboard.press('Home');
  await page.keyboard.press('Shift+End');
  await expect(page.getByTestId('rewrite-bubble')).toBeVisible();
}

test.describe('rewrite', () => {
  test('does not offer itself for a word, and does for a sentence', async ({ page }) => {
    await bootWithProject(page);
    await newChapterWithProse(page, 'The ferry did not come and the water ran black.');

    // A double-click selects one word. Three words is still not a passage.
    await page.getByLabel('Manuscript body').click();
    await page.keyboard.press('Home');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await page.keyboard.press('Shift+ArrowRight');
    await expect(page.getByTestId('rewrite-bubble')).toHaveCount(0);

    await selectLine(page, 'The ferry');
  });

  test('with no AI key the three actions are gone and the clipboard path is not', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.bringToFront();
    await bootWithProject(page);
    await newChapterWithProse(page, 'The ferry did not come and the water ran black.');

    await selectLine(page, 'The ferry');
    const bubble = page.getByTestId('rewrite-bubble');
    // Absent from the tree, not merely hidden — the convention 09-ai set.
    await expect(bubble.getByRole('button', { name: 'Expand' })).toHaveCount(0);
    await expect(bubble.getByRole('button', { name: 'Rephrase' })).toHaveCount(0);
    await expect(bubble.getByRole('button', { name: 'Shorten' })).toHaveCount(0);

    await bubble.getByRole('button', { name: 'Copy prompt' }).click();
    const shown = await bubble.getByLabel('Rewrite prompt to send').inputValue();
    expect(shown).toContain('THIS IS A REWRITE, NOT NEW PROSE');
    expect(shown).toContain('The ferry did not come');

    await bubble.getByLabel('Pasted rewrite').fill('No ferry came, and the water went black.');
    await bubble.getByRole('button', { name: 'Use this' }).click();
    await page.getByTestId('rewrite-draft').getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.lw-manuscript')).toContainText('No ferry came');
    await expect(page.locator('.lw-manuscript')).not.toContainText('did not come');
  });

  test('replaces the selection only on Apply, and the page before it is recoverable', async ({
    page,
  }) => {
    await mockAnthropic(page, 'The ferry never arrived, and the water darkened.');
    await bootWithProject(page);
    await configureAnthropic(page);
    await newChapterWithProse(page, 'The ferry did not come and the water ran black.');

    await selectLine(page, 'The ferry');
    const bubble = page.getByTestId('rewrite-bubble');
    await bubble.getByRole('button', { name: 'Rephrase' }).click();
    await page.getByTestId('privacy-guard').getByRole('button', { name: 'Send once' }).click();

    const draft = page.getByTestId('rewrite-draft');
    await expect(draft).toContainText('The ferry never arrived');
    // Nothing has reached the manuscript yet.
    await expect(page.locator('.lw-manuscript')).toContainText('did not come');

    await draft.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.lw-manuscript')).toContainText('The ferry never arrived');
    await expect(page.locator('.lw-manuscript')).not.toContainText('did not come');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');

    // A save point was taken before the model wrote.
    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    const panel = page.getByTestId('scene-panel');
    await expect(panel.getByText('Before AI wrote')).toBeVisible();
    await panel.getByRole('button', { name: 'Restore' }).first().click();
    await expect(page.locator('.lw-manuscript')).toContainText('did not come');
  });

  test('Discard leaves the passage alone, and one undo removes an applied rewrite', async ({
    page,
  }) => {
    let call = 0;
    await mockAnthropic(page, () => `Rewrite number ${++call} of the line.`);
    await bootWithProject(page);
    await configureAnthropic(page);
    await newChapterWithProse(page, 'The ferry did not come and the water ran black.');

    await selectLine(page, 'The ferry');
    const bubble = page.getByTestId('rewrite-bubble');
    await bubble.getByRole('button', { name: 'Shorten' }).click();
    await page.getByTestId('privacy-guard').getByRole('button', { name: 'Send once' }).click();

    const draft = page.getByTestId('rewrite-draft');
    await expect(draft).toContainText('Rewrite number 1');
    await draft.getByRole('button', { name: 'Retry' }).click();
    await expect(draft).toContainText('Rewrite number 2');

    await draft.getByRole('button', { name: 'Discard' }).click();
    await expect(page.locator('.lw-manuscript')).not.toContainText('Rewrite number');
    await expect(page.locator('.lw-manuscript')).toContainText('did not come');

    // Apply, then take it back with one keystroke.
    await selectLine(page, 'The ferry');
    await bubble.getByRole('button', { name: 'Shorten' }).click();
    await page.getByTestId('privacy-guard').getByRole('button', { name: 'Send once' }).click();
    await page.getByTestId('rewrite-draft').getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.lw-manuscript')).toContainText('Rewrite number 3');

    await page.getByLabel('Manuscript body').click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('.lw-manuscript')).not.toContainText('Rewrite number');
    await expect(page.locator('.lw-manuscript')).toContainText('did not come');
  });
});

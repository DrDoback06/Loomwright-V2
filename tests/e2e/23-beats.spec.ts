import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

// A beat is an instruction that lives in the prose and turns into prose.
// What matters: it never counts as manuscript, it never inserts without
// being asked, the page it replaced is always recoverable, and it works
// with no API key at all.

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
  // Beats are guarded by the privacy gate unless it is turned off; these
  // specs exercise the guard once and then get out of its way.
  await openNav(page, 'Settings');
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

async function insertBeat(page: Page, instruction: string) {
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.press('End');
  await page.getByRole('button', { name: 'Insert scene beat' }).click();
  await page.keyboard.type(instruction);
  return page.getByTestId('scene-beat').first();
}

test.describe('scene beats', () => {
  test('a beat holds an instruction that is not counted as manuscript', async ({ page }) => {
    await bootWithProject(page);
    await newChapterWithProse(page, 'One two three four five.');

    const beat = await insertBeat(page, 'Vex confronts Marrow about the blade at length here.');
    await expect(beat).toBeVisible();
    await expect(beat).toContainText('Vex confronts Marrow');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');

    // Five words of prose. The beat's nine are scaffolding.
    await expect(page.getByTestId('save-state')).toContainText('5 words');

    // And it survives a reload as part of the document.
    await page.reload();
    await openNav(page, "Writer's Room");
    await expect(page.getByTestId('scene-beat').first()).toContainText('Vex confronts Marrow');
    await expect(page.getByTestId('save-state')).toContainText('5 words');
  });

  test('expanding writes prose after the beat, and only when applied', async ({ page }) => {
    await mockAnthropic(page, 'Marrow looked at the blade and said nothing at all.');
    await bootWithProject(page);
    await configureAnthropic(page);
    await createCastMember(page, { name: 'Marrow' });
    await newChapterWithProse(page, 'The water ran black.');

    const beat = await insertBeat(page, 'Vex confronts Marrow.');
    await beat.getByRole('button', { name: 'Expand' }).click();

    // The privacy guard stands between a beat and the network.
    await page.getByTestId('privacy-guard').getByRole('button', { name: 'Send once' }).click();

    const draft = page.getByTestId('beat-draft');
    await expect(draft).toContainText('Marrow looked at the blade');
    // Nothing has reached the DOCUMENT yet. The preview renders inside the
    // editor's DOM — it is the node view's own chrome — so the honest test
    // is the word count, which is derived from the document itself.
    await expect(page.getByTestId('save-state')).toContainText('4 words');

    await draft.getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.lw-manuscript')).toContainText('Marrow looked at the blade');
    await expect(page.getByTestId('save-state')).toContainText('14 words');

    // AFTER the beat, not before it — the beat keeps its place in the page
    // so it can be re-rolled, and the prose follows it.
    const order = await page.locator('.lw-manuscript').innerText();
    expect(order.indexOf('Marrow looked at the blade')).toBeGreaterThan(
      order.indexOf('Vex confronts Marrow.')
    );
    // The beat survives, so it can be re-rolled.
    await expect(page.getByTestId('scene-beat').first()).toContainText('Vex confronts Marrow.');

    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
    await page.reload();
    await openNav(page, "Writer's Room");
    await expect(page.locator('.lw-manuscript')).toContainText('Marrow looked at the blade');
  });

  test('the page before an expansion is always recoverable', async ({ page }) => {
    await mockAnthropic(page, 'Something the author did not want.');
    await bootWithProject(page);
    await configureAnthropic(page);
    await newChapterWithProse(page, 'The line the author wrote themselves.');

    const beat = await insertBeat(page, 'Write something.');
    await beat.getByRole('button', { name: 'Expand' }).click();
    await page.getByTestId('privacy-guard').getByRole('button', { name: 'Send once' }).click();
    await page.getByTestId('beat-draft').getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.lw-manuscript')).toContainText('did not want');

    // A snapshot was taken before the model wrote, and it is in the history.
    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    const panel = page.getByTestId('scene-panel');
    await expect(panel.getByText('Before AI wrote')).toBeVisible();

    await panel.getByRole('button', { name: 'Restore' }).first().click();
    await expect(page.locator('.lw-manuscript')).not.toContainText('did not want');
    await expect(page.locator('.lw-manuscript')).toContainText('the author wrote themselves');
  });

  test('Discard leaves the manuscript untouched, Retry asks again', async ({ page }) => {
    let call = 0;
    await mockAnthropic(page, () => `Attempt number ${++call} of the prose.`);
    await bootWithProject(page);
    await configureAnthropic(page);
    await newChapterWithProse(page, 'Opening line.');

    const beat = await insertBeat(page, 'Continue.');
    await beat.getByRole('button', { name: 'Expand' }).click();
    await page.getByTestId('privacy-guard').getByRole('button', { name: 'Send once' }).click();

    const draft = page.getByTestId('beat-draft');
    await expect(draft).toContainText('Attempt number 1');

    await draft.getByRole('button', { name: 'Retry' }).click();
    await expect(draft).toContainText('Attempt number 2');

    await draft.getByRole('button', { name: 'Discard' }).click();
    await expect(page.getByTestId('beat-draft')).toHaveCount(0);
    await expect(page.locator('.lw-manuscript')).not.toContainText('Attempt number');
  });

  test('with no AI key at all, a beat still works through the clipboard', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    // The clipboard API requires the document to be focused; under parallel
    // execution a background page is not.
    await page.bringToFront();
    await bootWithProject(page);
    await newChapterWithProse(page, 'The ferry did not come.');

    const beat = await insertBeat(page, 'Vex waits until dark.');
    // No provider configured, so there is nothing to expand with — but the
    // round-trip is right there, which is the whole point.
    await expect(beat.getByRole('button', { name: 'Expand' })).toHaveCount(0);
    await beat.getByRole('button', { name: 'Copy prompt' }).click();

    // Asserted from the DOM, not the clipboard: the clipboard is a
    // convenience that any browser may refuse, and the guarantee being
    // tested is that the author can always get the prompt.
    const shown = await beat.getByLabel('Prompt to send').inputValue();
    expect(shown).toContain('Vex waits until dark.');
    expect(shown).toContain('THIS IS A BEAT, NOT A SCENE');
    expect(shown).toContain('The ferry did not come.');

    await beat.getByLabel('Pasted beat prose').fill('He waited, and the dark came on.');
    await beat.getByRole('button', { name: 'Use this' }).click();
    await page.getByTestId('beat-draft').getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.lw-manuscript')).toContainText('the dark came on');
  });

  test('one undo removes an entire expansion', async ({ page }) => {
    await mockAnthropic(page, 'First inserted paragraph.\n\nSecond inserted paragraph.');
    await bootWithProject(page);
    await configureAnthropic(page);
    await newChapterWithProse(page, 'Before.');

    const beat = await insertBeat(page, 'Go on.');
    await beat.getByRole('button', { name: 'Expand' }).click();
    await page.getByTestId('privacy-guard').getByRole('button', { name: 'Send once' }).click();
    await page.getByTestId('beat-draft').getByRole('button', { name: 'Apply' }).click();
    await expect(page.locator('.lw-manuscript')).toContainText('Second inserted paragraph');

    await page.getByLabel('Manuscript body').click();
    await page.keyboard.press('ControlOrMeta+z');
    await expect(page.locator('.lw-manuscript')).not.toContainText('First inserted paragraph');
    await expect(page.locator('.lw-manuscript')).not.toContainText('Second inserted paragraph');
    // The beat itself is still there.
    await expect(page.getByTestId('scene-beat').first()).toContainText('Go on.');
  });
});

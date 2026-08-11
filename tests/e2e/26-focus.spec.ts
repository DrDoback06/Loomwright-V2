import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, openNav } from './helpers';

// Focus mode is three behaviours from one setting: dimming, a chrome fade,
// and typewriter scrolling. The dimming is the one that must be tested by
// its effect rather than its storage — N1 shipped this preference and
// nothing on earth read it for four milestones.

async function setFocus(page: Page, label: string) {
  await openNav(page, 'Settings');
  await page
    .getByTestId('settings-tweaks')
    .getByRole('button', { name: label, exact: true })
    .click();
}

async function writeTwoParagraphs(page: Page) {
  await openNav(page, "Writer's Room");
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.type('The ferry did not come. Vex waited on the stones.');
  await page.keyboard.press('Enter');
  await page.keyboard.type('The water ran black under the last of the light.');
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
}

test.describe('focus mode', () => {
  test('stamps the document, survives a reload, and can be turned off', async ({ page }) => {
    await bootWithProject(page);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-focus', 'off');

    await setFocus(page, 'Paragraph');
    await expect(html).toHaveAttribute('data-focus', 'paragraph');

    // Read pre-paint from index.html, so a reload is the honest test.
    await page.reload();
    await expect(html).toHaveAttribute('data-focus', 'paragraph');

    await setFocus(page, 'Off');
    await expect(html).toHaveAttribute('data-focus', 'off');
  });

  test('dims every paragraph but the one the caret is in', async ({ page }) => {
    await bootWithProject(page);
    await setFocus(page, 'Paragraph');
    await writeTwoParagraphs(page);

    const paragraphs = page.locator('.lw-manuscript p');
    // The caret is in the second paragraph, so the first is dimmed and the
    // second is not.
    await expect(paragraphs.first()).toHaveClass(/lw-dim/);
    await expect(paragraphs.nth(1)).not.toHaveClass(/lw-dim/);

    // Moving the caret alone re-lights it — no keystroke, no document
    // change. This is the one way focus differs from every other
    // decoration plugin in the app.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Home');
    await expect(paragraphs.first()).not.toHaveClass(/lw-dim/);
    await expect(paragraphs.nth(1)).toHaveClass(/lw-dim/);
  });

  test('sentence focus narrows inside the paragraph, and Off lights everything', async ({
    page,
  }) => {
    await bootWithProject(page);
    await setFocus(page, 'Sentence');
    await writeTwoParagraphs(page);

    // Caret is at the end of the second paragraph. Within the FIRST
    // paragraph nothing is individually dimmed — the whole block is.
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Home');
    // Now in the first paragraph, at its start: its second sentence dims
    // while the first stays lit.
    const dimmedSpans = page.locator('.lw-manuscript p').first().locator('.lw-dim');
    await expect(dimmedSpans.first()).toContainText('Vex waited');

    await setFocus(page, 'Off');
    await openNav(page, "Writer's Room");
    await expect(page.locator('.lw-manuscript .lw-dim')).toHaveCount(0);
    await expect(page.locator('.lw-manuscript p').first()).not.toHaveClass(/lw-dim/);
  });

  test('dimming survives reduced motion; only the transition goes', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Settings');
    await page
      .getByTestId('settings-tweaks')
      .getByRole('button', { name: 'Reduced', exact: true })
      .click();
    await setFocus(page, 'Paragraph');
    await writeTwoParagraphs(page);

    const first = page.locator('.lw-manuscript p').first();
    // Reduce ≠ remove: the state still applies, it just arrives instantly.
    // `.01ms` is what tokens.css collapses every transition to — a real
    // duration rather than `none`, which is what keeps a state change
    // legible instead of making it teleport.
    await expect(first).toHaveClass(/lw-dim/);
    await expect(first).toHaveCSS('transition-duration', '1e-05s');
  });
});

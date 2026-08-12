import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

// Typing `@` links a name at the moment you mean it, instead of waiting for
// extraction to find it. What matters is that the link is made of the
// document — so it cannot drift from the prose, and cannot be destroyed by
// the Save & Extract button sitting in the same toolbar.

async function newChapter(page: Page) {
  await openNav(page, "Writer's Room");
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
}

async function typeMention(page: Page, lead: string, query: string) {
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.type(lead);
  await page.keyboard.type(`@${query}`);
  await expect(page.getByTestId('mention-suggest')).toBeVisible();
}

test.describe('typed @ mentions', () => {
  test('links a name, as prose rather than as an @handle', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow', summary: 'A ferryman who owes money.' });
    await newChapter(page);

    await typeMention(page, 'The ferry brought ', 'marr');
    await page.keyboard.press('Enter');

    // The manuscript reads as a book, not as a database. No `@` survives.
    const body = page.locator('.lw-manuscript');
    await expect(body).toContainText('The ferry brought Marrow');
    await expect(body).not.toContainText('@');
    await expect(page.locator('.lw-mention--typed')).toHaveCount(1);

    // It is ordinary prose underneath: every word counts.
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
    await expect(page.getByTestId('save-state')).toContainText('4 words');

    await page.reload();
    await openNav(page, "Writer's Room");
    await expect(page.locator('.lw-mention--typed')).toHaveCount(1);
  });

  test('the arrow keys drive the list and Escape gets rid of it', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow' });
    await createCastMember(page, { name: 'Marrowbone Hall' });
    await newChapter(page);

    await typeMention(page, 'They reached ', 'marrow');
    const list = page.getByTestId('mention-suggest');
    await expect(list.getByRole('option')).toHaveCount(3); // two entries + create

    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page.locator('.lw-manuscript')).toContainText('They reached Marrowbone Hall');

    // Escape leaves what was typed alone — it dismisses the list, not the
    // words.
    await page.keyboard.type(' and then @marr');
    await expect(list).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('mention-suggest')).toHaveCount(0);
    await expect(page.locator('.lw-manuscript')).toContainText('@marr');
  });

  test('an unknown name can be created and linked in one go', async ({ page }) => {
    await bootWithProject(page);
    await newChapter(page);

    await typeMention(page, 'The ferry brought ', 'Marrow');
    const list = page.getByTestId('mention-suggest');
    await list.getByRole('option', { name: /Create/ }).click();
    await list.getByRole('button', { name: /Cast/ }).click();

    await expect(page.locator('.lw-manuscript')).toContainText('The ferry brought Marrow');
    await expect(page.locator('.lw-mention--typed')).toHaveCount(1);

    // It is a real codex entry, not a label on a word.
    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: /Marrow/ })).toBeVisible();
  });

  test('survives Save & Extract, which clears every other mention', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow' });
    await newChapter(page);

    await typeMention(page, 'The ferry brought ', 'marr');
    await page.keyboard.press('Enter');
    await page.keyboard.type('and left again.');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');

    // Extraction deletes and rewrites a chapter's occurrences on every run.
    // An assertion the author made by hand is not extraction's to delete.
    await page.getByRole('button', { name: 'Save & Extract' }).click();
    await expect(page.getByText(/candidate|change|re-confirmed|Nothing recognisable/)).toBeVisible();
    await expect(page.locator('.lw-mention--typed')).toHaveCount(1);

    // And one mention is one mention: the matcher does not report the same
    // word a second time on top of it.
    await expect(page.locator('.lw-mention')).toHaveCount(1);
  });

  test('the preview card explains a mention, opens it, and can unlink it', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow', summary: 'A ferryman who owes money.' });
    await newChapter(page);

    await typeMention(page, 'The ferry brought ', 'marr');
    await page.keyboard.press('Enter');

    await page.locator('.lw-mention--typed').click();
    const card = page.getByTestId('mention-preview');
    await expect(card).toContainText('Marrow');
    await expect(card).toContainText('A ferryman who owes money.');

    // Unlink keeps the words and drops the link — losing a link must never
    // be able to lose a word.
    await card.getByRole('button', { name: 'Unlink' }).click();
    await expect(page.locator('.lw-mention--typed')).toHaveCount(0);
    await expect(page.locator('.lw-manuscript')).toContainText('The ferry brought Marrow');
  });

  test('is what the Matrix reads, so an assertion counts as much as a finding', async ({
    page,
  }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow' });
    await newChapter(page);

    await typeMention(page, 'The ferry brought ', 'marr');
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');

    // Typed and extracted mentions are one substrate: this cell is filled
    // with no extraction run at all.
    //
    // It lands in the `extracted` lane on purpose, not by oversight.
    // Mentioning someone is not the same as their being in the scene —
    // "Vex thought of Marrow" mentions a man who is miles away — so a
    // mention of any provenance sits in the lane that says "found in the
    // prose", and clicking it still does something real: it promotes a
    // mention to an assertion of presence, which is a stronger claim than
    // either the author or the engine has made so far.
    await openNav(page, 'Matrix');
    const cell = page.getByTestId('plan-matrix').getByRole('button', { name: /Marrow in Scene 1/ });
    await expect(cell).toHaveAttribute('data-source', 'extracted');
    await cell.click();
    await expect(cell).toHaveAttribute('data-source', 'asserted');
  });
});

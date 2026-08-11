import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

// Four views over one set of scenes. The thing worth proving is that they
// really are one set — a change made in one view shows up in the others
// and in the manuscript — and that the Matrix renders what extraction
// found, which is the part no competitor can draw.

async function seedTwoScenes(page: Page) {
  await createCastMember(page, { name: 'Aelinor' });
  await openNav(page, "Writer's Room");
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.type('Aelinor crossed the pass before dawn.');
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');

  await page.getByRole('tablist', { name: 'Scenes' }).getByRole('button', { name: '+ Scene' }).click();
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.type('The ferry did not come.');
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
}

test.describe('plan', () => {
  test('Outline shows the shape of the book with counts at every level', async ({ page }) => {
    await bootWithProject(page);
    await seedTwoScenes(page);

    await openNav(page, 'Outline');
    const outline = page.getByTestId('plan-outline');
    await expect(outline).toContainText('1 chapter · 2 scenes');
    await expect(outline.getByRole('textbox', { name: /Scene title/ })).toHaveCount(2);
  });

  test('renaming a scene in Outline reaches the Writer’s Room', async ({ page }) => {
    await bootWithProject(page);
    await seedTwoScenes(page);

    await openNav(page, 'Outline');
    const title = page.getByTestId('plan-outline').getByRole('textbox', { name: /Scene title/ }).first();
    await title.fill('The crossing');
    await title.blur();

    await openNav(page, "Writer's Room");
    await expect(
      page.getByRole('tablist', { name: 'Scenes' }).getByRole('tab').first()
    ).toContainText('The crossing');
  });

  test('reordering a scene in Outline changes the manuscript order', async ({ page }) => {
    await bootWithProject(page);
    await seedTwoScenes(page);

    await openNav(page, 'Outline');
    const outline = page.getByTestId('plan-outline');
    const titles = outline.getByRole('textbox', { name: /Scene title/ });
    await expect(titles.first()).toHaveValue('Scene 1');

    await outline.getByRole('button', { name: /Move Scene 2 earlier/ }).click();
    await expect(titles.first()).toHaveValue('Scene 2');

    await openNav(page, "Writer's Room");
    await expect(
      page.getByRole('tablist', { name: 'Scenes' }).getByRole('tab').first()
    ).toContainText('Scene 2');
  });

  test('Board groups by status, and changing status moves the card', async ({ page }) => {
    await bootWithProject(page);
    await seedTwoScenes(page);

    await openNav(page, 'Board');
    const board = page.getByTestId('plan-board');
    await expect(board.getByRole('region', { name: 'Draft' })).toContainText('Scene 1');

    await board
      .getByRole('region', { name: 'Draft' })
      .getByRole('combobox', { name: /Status for Scene 1/ })
      .selectOption('final');

    await expect(board.getByRole('region', { name: 'Final' })).toContainText('Scene 1');
    await expect(board.getByRole('region', { name: 'Draft' })).not.toContainText('Scene 1');

    // The switcher is a lens, not a second copy.
    await board.getByRole('button', { name: 'Chapter', exact: true }).click();
    await expect(board.getByRole('region', { name: 'Chapter 1' })).toContainText('Scene 1');
  });

  test('the Matrix shows what extraction found, and a click makes it yours', async ({ page }) => {
    await bootWithProject(page);
    await seedTwoScenes(page);

    // Extraction is what fills the grid in — this is the differentiator.
    await page.getByRole('button', { name: 'Save & Extract' }).click();
    await expect(page.getByText(/candidate|change|re-confirmed|Nothing recognisable/)).toBeVisible();

    await openNav(page, 'Matrix');
    const matrix = page.getByTestId('plan-matrix');
    await expect(matrix).toBeVisible();

    const cell = matrix.getByRole('button', { name: /Aelinor in Scene 1/ });
    await expect(cell).toHaveAttribute('data-source', 'extracted');

    await cell.click();
    await expect(cell).toHaveAttribute('data-source', 'asserted');
    await expect(cell).toHaveAttribute('aria-pressed', 'true');

    // And it is real data: it survives a reload.
    await page.reload();
    await openNav(page, 'Matrix');
    await expect(
      page.getByTestId('plan-matrix').getByRole('button', { name: /Aelinor in Scene 1/ })
    ).toHaveAttribute('data-source', 'asserted');
  });

  test('a Matrix row opens its scene in the Writer’s Room', async ({ page }) => {
    await bootWithProject(page);
    await seedTwoScenes(page);

    await openNav(page, 'Matrix');
    await page.getByTestId('plan-matrix').getByRole('button', { name: /^Scene 2/ }).click();
    await expect(page.getByTestId('surface-writers-room')).toBeVisible();
  });

  test('an act groups chapters everywhere, and deleting it costs no prose', async ({ page }) => {
    await bootWithProject(page);
    await seedTwoScenes(page);

    await openNav(page, 'Outline');
    const outline = page.getByTestId('plan-outline');
    // Acts stay out of the way until asked for: none until you make one.
    await expect(outline.getByTestId('outline-act')).toHaveCount(0);

    await outline.getByRole('button', { name: '+ Act' }).click();
    const act = outline.getByTestId('outline-act');
    await expect(act).toHaveCount(1);

    const title = act.getByRole('textbox', { name: /Act title/ });
    await title.fill('The gathering storm');
    await title.blur();
    await expect(act.getByText('No chapters in this act yet')).toBeVisible();

    await outline
      .getByRole('combobox', { name: 'Act for Chapter 1' })
      .selectOption({ label: 'The gathering storm' });
    await expect(act.getByRole('heading', { name: 'Chapter 1' })).toBeVisible();

    // The same grouping is a column on the Board...
    await page.getByRole('tab', { name: 'Board' }).click();
    const board = page.getByTestId('plan-board');
    await board.getByRole('button', { name: 'Act', exact: true }).click();
    await expect(board.getByRole('region', { name: 'The gathering storm' })).toContainText(
      'Scene 1'
    );

    // ...and a band across the Matrix.
    await page.getByRole('tab', { name: 'Matrix' }).click();
    await expect(page.getByTestId('plan-matrix')).toContainText('The gathering storm');

    // It survives a reload, because it is data and not view state.
    await page.reload();
    await openNav(page, 'Outline');
    await expect(
      page.getByTestId('plan-outline').getByRole('textbox', { name: /Act title/ })
    ).toHaveValue('The gathering storm');

    // And losing the grouping cannot lose the book.
    await page
      .getByTestId('plan-outline')
      .getByRole('button', { name: 'Delete The gathering storm' })
      .click();
    await expect(page.getByTestId('plan-outline').getByTestId('outline-act')).toHaveCount(0);
    await expect(page.getByTestId('plan-outline')).toContainText('1 chapter · 2 scenes');
    await openNav(page, "Writer's Room");
    await expect(page.getByLabel('Manuscript body')).toContainText('Aelinor crossed the pass');
  });

  test('every view is reachable, including on a phone', async ({ page }) => {
    await bootWithProject(page);
    await seedTwoScenes(page);
    await openNav(page, 'Outline');

    for (const [view, testId] of [
      ['Board', 'plan-board'],
      ['Matrix', 'plan-matrix'],
      ['Timeline', 'plan-timeline'],
      ['Outline', 'plan-outline'],
    ] as const) {
      await page.getByRole('tab', { name: view }).click();
      await expect(page.getByTestId(testId)).toBeVisible();
    }
  });
});

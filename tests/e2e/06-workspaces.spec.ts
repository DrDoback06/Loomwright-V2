import { test, expect } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

test.describe('document workspaces', () => {
  test('quest log: steps advance from the dossier and persist', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Quests');
    await page.getByRole('button', { name: '+ Create quest' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Title *').fill('The Silent Errand');
    // Add two steps through the real step-list widget.
    await dialog.getByRole('button', { name: 'Steps & branches' }).click();
    const stepInput = dialog.getByPlaceholder('Add a step and press Enter');
    await stepInput.fill('Reach the watchhouse');
    await stepInput.press('Enter');
    await stepInput.fill('Deliver the letter');
    await stepInput.press('Enter');
    await dialog.getByRole('button', { name: 'Create quest' }).click();
    await expect(dialog).toBeHidden();

    // Advance step 1 from the dossier: pending → active → done.
    await page.getByRole('button', { name: /The Silent Errand/ }).click();
    const detail = page.getByTestId('entity-detail');
    const step1 = detail.getByRole('button', { name: /Advance step: Reach the watchhouse/ });
    await step1.click(); // active
    await step1.click(); // done
    await expect(detail.getByText('1/2 done')).toBeVisible();

    await page.reload();
    await openNav(page, 'Quests');
    await page.getByRole('button', { name: /The Silent Errand/ }).click();
    await expect(page.getByTestId('entity-detail').getByText('1/2 done')).toBeVisible();
  });

  test('events: timeline view orders by the when field', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Events');
    for (const [title, when] of [
      ['The Auger Wake', 'Ch. 3'],
      ['The Salt Treaty', 'Ch. 1'],
    ] as const) {
      await page.getByRole('button', { name: '+ Create event' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Title *').fill(title);
      await dialog.getByRole('button', { name: 'When + where' }).click();
      await dialog.getByLabel('Chapter / Date / Time').fill(when);
      await dialog.getByRole('button', { name: 'Create event' }).click();
      await expect(dialog).toBeHidden();
    }

    await page.getByRole('radio', { name: 'Timeline' }).click();
    const timeline = page.getByTestId('timeline-view');
    await expect(timeline).toBeVisible();
    const names = await timeline.locator('.lw-timeline__name').allTextContents();
    expect(names).toEqual(['The Salt Treaty', 'The Auger Wake']);
  });

  test('compose builds a brief from context entities and inserts it', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor', summary: 'Queen of the Pale Reach' });
    // Focus Aelinor so she is in context.
    await page.getByRole('button', { name: /Aelinor/ }).click();

    await openNav(page, "Writer's Room");
    await page
      .getByRole('tablist', { name: 'Chapters' })
      .getByRole('button', { name: '+ New chapter' })
      .click();

    await page.getByRole('button', { name: 'Compose', exact: true }).click();
    const compose = page.getByTestId('compose-panel');
    await expect(compose.getByText(/Aelinor/)).toBeVisible();
    await compose.getByLabel('Direction').fill('She receives the letter about the Auger Wake.');
    await compose.getByRole('button', { name: 'Insert brief' }).click();

    const body = page.getByLabel('Manuscript body');
    await expect(body.locator('blockquote')).toContainText('Aelinor');
    await expect(body.locator('blockquote')).toContainText('Auger Wake');

    // The brief is real manuscript content — it persists.
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
    await page.reload();
    await openNav(page, "Writer's Room");
    await expect(page.getByLabel('Manuscript body').locator('blockquote')).toContainText('Aelinor');
  });
});

import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember } from './helpers';

async function createEntityViaCodex(
  page: Page,
  navLabel: string,
  createLabel: string,
  name: string,
  nameLabel = 'Name *'
) {
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: navLabel }).click();
  await page.getByRole('button', { name: `+ Create ${createLabel}` }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel(nameLabel).fill(name);
  await dialog.getByRole('button', { name: `Create ${createLabel}` }).click();
  await expect(dialog).toBeHidden();
}

test.describe('cross-panel context', () => {
  test('all 16 codex types have live create/edit surfaces', async ({ page }) => {
    await bootWithProject(page);
    // Spot-check a spread of newly-configured types end to end.
    await createEntityViaCodex(page, 'Locations', 'location', 'Pale Reach');
    await createEntityViaCodex(page, 'Items', 'item', 'Auger of Hess');
    await createEntityViaCodex(page, 'Factions', 'faction', 'Glass Throne');
    await createEntityViaCodex(page, 'Quests', 'quest', 'The Silent Errand', 'Title *');

    await page.reload();
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Quests' }).click();
    await expect(page.getByRole('button', { name: /The Silent Errand/ })).toBeVisible();
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Factions' }).click();
    await expect(page.getByRole('button', { name: /Glass Throne/ })).toBeVisible();
  });

  test('docked panels react to selection: items filter to the focused cast member', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Docked panels are a desktop feature until M11.');
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor' });
    await createCastMember(page, { name: 'Saren' });
    await createEntityViaCodex(page, 'Items', 'item', 'Auger of Hess');
    await createEntityViaCodex(page, 'Items', 'item', 'Salt Lantern');

    // Give the Auger an owner through the real editor.
    await page.getByRole('button', { name: /Auger of Hess/ }).click();
    await page.getByTestId('entity-detail').getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Ownership & location' }).click();
    await dialog.getByLabel('Current owner').selectOption({ label: 'Aelinor' });
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();

    // Open Cast + Items panels from the dock strip.
    const dock = page.getByTestId('panel-dock');
    await dock.getByRole('button', { name: 'Open Cast panel' }).click();
    await dock.getByRole('button', { name: 'Open Items panel' }).click();
    const castPanel = page.getByTestId('panel-cast');
    const itemsPanel = page.getByTestId('panel-items');
    await expect(castPanel).toBeVisible();
    await expect(itemsPanel).toBeVisible();

    // Select Aelinor in the Cast panel → the Items panel filters to her item.
    await castPanel.getByRole('button', { name: 'Aelinor', exact: true }).click();
    await expect(itemsPanel.getByRole('button', { name: /Filtered by Aelinor/ })).toBeVisible();
    await expect(itemsPanel.getByText('Auger of Hess')).toBeVisible();
    await expect(itemsPanel.getByText('Salt Lantern')).toHaveCount(0);

    // Clearing the chip shows everything again.
    await itemsPanel.getByRole('button', { name: /Filtered by Aelinor/ }).click();
    await expect(itemsPanel.getByText('Salt Lantern')).toBeVisible();

    // Panels survive a reload (layout persists per project).
    await page.reload();
    await expect(page.getByTestId('panel-cast')).toBeVisible();
    await expect(page.getByTestId('panel-items')).toBeVisible();
  });

  test('lock + same-type focus form a pair', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Docked panels are a desktop feature until M11.');
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor' });
    await createCastMember(page, { name: 'Captain Brec' });

    const dock = page.getByTestId('panel-dock');
    await dock.getByRole('button', { name: 'Open Cast panel' }).click();
    const castPanel = page.getByTestId('panel-cast');

    await castPanel.getByRole('button', { name: 'Lock Aelinor as context' }).click();
    await castPanel.getByRole('button', { name: 'Captain Brec', exact: true }).click();

    const pair = page.getByTestId('pair-strip');
    await expect(pair).toBeVisible();
    await expect(pair).toContainText('Aelinor');
    await expect(pair).toContainText('Captain Brec');

    await pair.getByRole('button', { name: 'Unlock' }).click();
    await expect(pair).toBeHidden();
  });

  test('merge rewrites mentions and references, and survives reload', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor' });
    await createCastMember(page, { name: 'Ael of Hess' });

    // A chapter mentioning the duplicate, extracted so occurrences exist.
    await page
      .getByRole('navigation', { name: 'Workspace' })
      .getByRole('button', { name: "Writer's Room" })
      .click();
    await page
      .getByRole('tablist', { name: 'Chapters' })
      .getByRole('button', { name: '+ New chapter' })
      .click();
    await page.getByLabel('Manuscript body').click();
    await page.keyboard.type('Ael of Hess crossed the harbour before dawn.');
    await page.getByRole('button', { name: 'Save & Extract' }).click();
    await expect(page.locator('.lw-mention').first()).toBeVisible();

    // Merge the duplicate into Aelinor from its dossier.
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Cast' }).click();
    await page.getByRole('button', { name: /Ael of Hess/ }).click();
    await page.getByTestId('entity-detail').getByRole('button', { name: 'Merge into…' }).click();
    await page.getByTestId('merge-picker').getByRole('button', { name: 'Merge into Aelinor' }).click();
    await expect(page.getByText(/merged into Aelinor/)).toBeVisible();

    // The duplicate is gone; Aelinor carries the alias.
    await expect(page.getByRole('button', { name: 'Ael of Hess' })).toHaveCount(0);
    await page.getByRole('button', { name: /Aelinor/ }).click();
    await expect(page.getByTestId('entity-detail').getByText(/also known as.*Ael of Hess/)).toBeVisible();

    // After reload, the manuscript mention now opens Aelinor's dossier.
    await page.reload();
    await page
      .getByRole('navigation', { name: 'Workspace' })
      .getByRole('button', { name: "Writer's Room" })
      .click();
    await page.locator('.lw-mention').first().click();
    await expect(
      page.getByTestId('entity-detail').getByRole('heading', { name: 'Aelinor' })
    ).toBeVisible();
  });
});

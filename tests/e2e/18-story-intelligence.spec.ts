import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

/** Create an entity of any type through the real roster UI. */
async function createEntity(page: Page, navLabel: string | RegExp, createLabel: RegExp, name: string) {
  await openNav(page, navLabel);
  await page.getByRole('button', { name: createLabel }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name *').fill(name);
  await dialog.getByRole('button', { name: createLabel }).click();
  await expect(dialog).toBeHidden();
}

async function writeChapter(page: Page, text: string) {
  await openNav(page, "Writer's Room");
  await expect(page.getByTestId('surface-writers-room')).toBeVisible();
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.type(text);
  await expect(page.getByText(/Saved/)).toBeVisible();
}

test.describe('story intelligence — consequences, not just nouns', () => {
  test('Save & Extract produces a cascade that accepts in one click and undoes in one', async ({
    page,
  }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow' });
    await createCastMember(page, { name: 'Vex' });
    await createEntity(page, 'Items', /Create item/, 'Saltbrand');

    await writeChapter(page, 'Marrow gave Saltbrand to Vex at the gate.');
    await page.getByRole('button', { name: 'Save & Extract' }).click();

    // A durable staged bar appears (the toast expires; the bar must not).
    const bar = page.getByTestId('staged-delta-bar');
    await expect(bar).toContainText(/change(s)? to review/);
    await bar.getByTestId('staged-delta-review').click();

    const board = page.getByTestId('cascade-board');
    await expect(board).toBeVisible();
    const group = page.getByTestId('cascade-group').first();
    await expect(group).toContainText(/Saltbrand/);

    // Expanding shows the actual before → after the author is agreeing to.
    await group.getByRole('button', { name: /change/ }).click();
    await expect(group).toContainText('Current owner');
    await expect(group).toContainText('Vex');

    await page.getByTestId('cascade-accept-all').click();
    await expect(page.getByText(/Applied:/)).toBeVisible();

    // The item's dossier now records the new owner.
    await openNav(page, 'Items');
    await page.getByRole('button', { name: /Saltbrand/ }).first().click();
    await expect(page.getByTestId('entity-detail')).toContainText('Vex');

    // One Undo reverts the whole cascade.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText(/undone/)).toBeVisible();
  });

  test('a learned skill becomes a real entity attached to the character', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Vex' });

    await writeChapter(page, 'Vex learned Venom Strike before the tide turned.');
    await page.getByRole('button', { name: 'Save & Extract' }).click();
    await expect(page.getByTestId('staged-delta-bar')).toBeVisible();

    await openNav(page, 'Review');
    await expect(page.getByTestId('cascade-board')).toContainText(/Venom Strike/);
    await page.getByTestId('cascade-accept-all').click();
    await expect(page.getByText(/Applied:/)).toBeVisible();

    // The skill exists in its own roster, not just as a mention.
    await openNav(page, 'Skills');
    await expect(page.getByRole('button', { name: /Venom Strike/ }).first()).toBeVisible();
  });

  test('pasting a manuscript on Import & Extract reaches the same board', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor' });
    await createEntity(page, /Locations/, /Create location/, 'Vraska Pass');

    await openNav(page, /Import & Extract|Handoff/);
    await expect(page.getByTestId('surface-handoff')).toBeVisible();
    await page
      .getByLabel('Manuscript text')
      .fill('Aelinor crossed Vraska Pass at first light.');
    await page.getByTestId('handoff-extract-paste').click();

    await expect(page.getByTestId('staged-delta-bar')).toBeVisible();
    await openNav(page, 'Review');
    await expect(page.getByTestId('cascade-board')).toContainText(/Aelinor/);
  });

  test('a cascade can be switched off so Accept all skips it', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow' });
    await createCastMember(page, { name: 'Vex' });
    await createEntity(page, 'Items', /Create item/, 'Saltbrand');

    await writeChapter(page, 'Marrow gave Saltbrand to Vex at the gate.');
    await page.getByRole('button', { name: 'Save & Extract' }).click();
    await expect(page.getByTestId('staged-delta-bar')).toBeVisible();
    await openNav(page, 'Review');

    // Untick the whole cascade, then accept — nothing should apply.
    await page.getByTestId('cascade-group').first().getByRole('checkbox').first().uncheck();
    await expect(page.getByTestId('cascade-accept-all')).toBeDisabled();
  });
});

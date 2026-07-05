import { test, expect } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

test.describe('generation: JSON round-trip, create-anything dialog', () => {
  test('pasted single-entity JSON prefills the drawer across tabs; save creates it', async ({
    page,
  }) => {
    await bootWithProject(page);
    await openNav(page, 'Cast');
    await page.getByRole('button', { name: /Generate character/ }).click();

    const dialog = page.getByTestId('create-anything');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Pasted JSON').fill(
      JSON.stringify({
        name: 'Vex Marrow',
        summary: 'A smuggler with a debt.',
        tags: ['smuggler'],
        fields: { role: 'Antagonist', personality: 'wry, watchful', fears: 'open water' },
      })
    );
    await dialog.getByRole('button', { name: 'Stage it' }).click();

    // Single entity → the familiar editor drawer, prefilled.
    const drawer = page.getByRole('dialog', { name: 'New Character' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel('Name *')).toHaveValue('Vex Marrow');
    await expect(drawer.getByLabel('Summary')).toHaveValue('A smuggler with a debt.');

    // The pasted values crossed section tabs (Psychology holds these).
    await drawer.getByRole('button', { name: 'Psychology' }).click();
    await expect(drawer.getByLabel('Personality')).toHaveValue('wry, watchful');
    // 'fears' is a chips field — the string coerced into one chip.
    await expect(drawer.getByText('open water')).toBeVisible();

    await drawer.getByRole('button', { name: 'Create character' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: /Vex Marrow/ })).toBeVisible();
  });

  test('copy-as-JSON from a dossier pastes into another type via the palette generate command', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor Vael', summary: 'Queen in exile.' });

    await page.getByRole('button', { name: /Aelinor Vael/ }).click();
    await page.getByRole('button', { name: 'Copy as JSON' }).click();
    await expect(page.getByText(/copied as JSON/)).toBeVisible();
    const copied = await page.evaluate<string>('navigator.clipboard.readText()');
    expect(JSON.parse(copied).name).toBe('Aelinor Vael');

    // Palette: "Generate creature" opens the dialog pre-targeted — but the
    // pasted JSON declares type "cast", and the declared type wins, so the
    // paste round-trips back into a character drawer, fully prefilled.
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByLabel('Palette search').fill('generate creature');
    await page.getByRole('button', { name: /Generate creature/ }).click();
    const dialog = page.getByTestId('create-anything');
    await dialog.getByLabel('Pasted JSON').fill(copied);
    await dialog.getByRole('button', { name: 'Stage it' }).click();

    const drawer = page.getByRole('dialog', { name: 'New Character' });
    await expect(drawer.getByLabel('Name *')).toHaveValue('Aelinor Vael');
    await expect(drawer.getByLabel('Summary')).toHaveValue('Queen in exile.');
  });

  test('multi-entity paste previews, accepts as one unit, and undoes as one unit', async ({
    page,
  }) => {
    await bootWithProject(page);
    await openNav(page, 'Cast');
    await page.getByRole('button', { name: /Generate character/ }).click();

    const dialog = page.getByTestId('create-anything');
    await dialog.getByLabel('Pasted JSON').fill(
      JSON.stringify({
        entities: [
          { type: 'cast', name: 'Vex Marrow', fields: { allies: ['Moth'] } },
          { type: 'cast', name: 'Moth' },
        ],
      })
    );
    await dialog.getByRole('button', { name: 'Stage it' }).click();

    const preview = page.getByTestId('paste-preview');
    await expect(preview).toContainText('Vex Marrow');
    await expect(preview).toContainText('Moth');
    await dialog.getByRole('button', { name: 'Accept all' }).click();

    await expect(page.getByText('2 entries added.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Vex Marrow/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Moth/ })).toBeVisible();

    // The sibling ref resolved to the real row.
    await page.getByRole('button', { name: /Vex Marrow/ }).click();
    await expect(page.getByTestId('entity-detail')).toContainText('Moth');

    // One Undo reverts the whole bundle.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Generation undone.')).toBeVisible();
    await openNav(page, 'Cast');
    await expect(page.getByText('No cast yet.')).toBeVisible();
  });

  test('the drawer paste-JSON action fills fields in place', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Cast');
    await page.getByRole('button', { name: '+ Create character' }).click();

    const drawer = page.getByRole('dialog', { name: 'New Character' });
    await drawer.getByRole('button', { name: 'Paste JSON' }).click();
    await drawer
      .getByLabel('Entity JSON')
      .fill('{"name": "Brann", "fields": {"role": "Mentor", "madeUpField": "dropped"}}');
    await drawer.getByRole('button', { name: 'Fill fields' }).click();

    await expect(page.getByText(/fields filled from JSON/)).toBeVisible();
    await expect(drawer.getByLabel('Name *')).toHaveValue('Brann');
    await drawer.getByRole('button', { name: 'Identity' }).click();
    await expect(drawer.getByRole('radio', { name: 'Mentor' })).toHaveAttribute('aria-checked', 'true');
  });
});

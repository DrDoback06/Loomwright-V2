import { test, expect } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

test.describe('cast codex', () => {
  test('create → dossier shows the data → survives reload', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor Vey', summary: 'Queen of the Pale Reach' });

    await page.getByRole('button', { name: /Aelinor Vey/ }).click();
    const detail = page.getByTestId('entity-detail');
    await expect(detail.getByRole('heading', { name: 'Aelinor Vey' })).toBeVisible();
    await expect(detail.getByText('Queen of the Pale Reach')).toBeVisible();

    await page.reload();
    await openNav(page, 'Cast');
    await page.getByRole('button', { name: /Aelinor Vey/ }).click();
    await expect(page.getByTestId('entity-detail').getByRole('heading', { name: 'Aelinor Vey' })).toBeVisible();
  });

  test('edit fills identity + psychology fields and they persist', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Captain Brec' });
    await page.getByRole('button', { name: /Captain Brec/ }).click();
    await page.getByTestId('entity-detail').getByRole('button', { name: 'Edit' }).click();

    const dialog = page.getByRole('dialog');
    // Identity section: role pill + occupation.
    await dialog.getByRole('button', { name: 'Identity' }).click();
    await dialog.getByRole('radio', { name: 'Ally' }).click();
    await dialog.getByLabel('Occupation / profession').fill('Watchhouse Captain');
    // Psychology section: chips.
    await dialog.getByRole('button', { name: 'Psychology' }).click();
    await dialog.getByRole('textbox', { name: 'Goals', exact: true }).fill('Protect the ward');
    await dialog.getByRole('button', { name: 'Add Goals' }).click();
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();

    // Dossier shows the values.
    const detail = page.getByTestId('entity-detail');
    await expect(detail.getByText('Watchhouse Captain')).toBeVisible();
    await expect(detail.getByText('Protect the ward')).toBeVisible();
    await expect(detail.getByText('Ally', { exact: true })).toBeVisible();

    // And they survive a reload.
    await page.reload();
    await openNav(page, 'Cast');
    await page.getByRole('button', { name: /Captain Brec/ }).click();
    await expect(page.getByTestId('entity-detail').getByText('Watchhouse Captain')).toBeVisible();
  });

  test('delete moves to trash; restore from Trash brings it back; purge is final', async ({
    page,
  }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Mara of Hess' });
    await page.getByRole('button', { name: /Mara of Hess/ }).click();

    const detail = page.getByTestId('entity-detail');
    await detail.getByRole('button', { name: 'Delete' }).click();
    await detail.getByRole('button', { name: 'Move to trash' }).click();
    await expect(page.getByText('No cast yet.')).toBeVisible();

    // Restore via the Trash surface (real clicks, then reload-check).
    await openNav(page, 'Trash');
    const trash = page.getByTestId('surface-trash');
    await expect(trash.getByText('Mara of Hess')).toBeVisible();
    await trash.getByRole('button', { name: 'Restore' }).click();
    await expect(trash.getByText('The trash is empty.')).toBeVisible();

    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: /Mara of Hess/ })).toBeVisible();
    await page.reload();
    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: /Mara of Hess/ })).toBeVisible();

    // Now delete + purge for real.
    await page.getByRole('button', { name: /Mara of Hess/ }).click();
    await page.getByTestId('entity-detail').getByRole('button', { name: 'Delete' }).click();
    await page.getByTestId('entity-detail').getByRole('button', { name: 'Move to trash' }).click();
    await openNav(page, 'Trash');
    await page.getByRole('button', { name: 'Delete forever…' }).click();
    await page.getByRole('button', { name: 'Delete forever', exact: true }).click();
    await expect(page.getByText('The trash is empty.')).toBeVisible();
    await page.reload();
    await openNav(page, 'Trash');
    await expect(page.getByText('The trash is empty.')).toBeVisible();
  });

  test('Home shows live cast count and recent activity with working Undo', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Saren of Hess' });
    await openNav(page, 'Home');

    await expect(page.getByText('Cast members')).toBeVisible();
    await expect(page.getByRole('button', { name: /1\s*Cast members/ })).toBeVisible();
    await expect(page.getByText(/Created/)).toBeVisible();

    // Undo the creation from Home.
    await page.getByRole('button', { name: 'Undo' }).first().click();
    await expect(page.getByRole('button', { name: /0\s*Cast members/ })).toBeVisible();
  });
});

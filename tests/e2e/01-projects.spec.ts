import { test, expect } from '@playwright/test';
import { bootWithProject, createCastMember } from './helpers';

test.describe('projects', () => {
  test('first run asks for a project; it persists across reload', async ({ page }) => {
    await bootWithProject(page, 'The Hollow Crown');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'The Hollow Crown' })).toBeVisible();
    // The gate must not reappear.
    await expect(page.getByLabel('Project name')).toHaveCount(0);
  });

  test('projects are isolated: cast in one never leaks into another', async ({ page }) => {
    await bootWithProject(page, 'Book One');
    await createCastMember(page, { name: 'Aelinor Vey', summary: 'Queen of the Pale Reach' });
    await expect(page.getByRole('button', { name: /Aelinor Vey/ })).toBeVisible();

    // Create a second project via the switcher.
    await page.getByRole('button', { name: /Book One/ }).click();
    await page.getByRole('menu').getByRole('button', { name: '+ New project' }).click();
    await page.getByLabel('New project name').fill('Book Two');
    await page.getByRole('menu').getByRole('button', { name: 'Create' }).click();

    // Book Two's cast must be empty.
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Cast' }).click();
    await expect(page.getByText('No cast yet.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Aelinor Vey/ })).toHaveCount(0);

    // Switch back — Aelinor is still there, even after a reload.
    await page.getByRole('button', { name: /Book Two/ }).click();
    await page.getByRole('menu').getByRole('menuitemradio', { name: /Book One/ }).click();
    await expect(page.getByRole('button', { name: /Aelinor Vey/ })).toBeVisible();
    await page.reload();
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Cast' }).click();
    await expect(page.getByRole('button', { name: /Aelinor Vey/ })).toBeVisible();
  });

  test('renaming a project sticks after reload', async ({ page }) => {
    await bootWithProject(page, 'Draft Name');
    await page.getByRole('button', { name: /Draft Name/ }).click();
    await page.getByRole('menu').getByRole('button', { name: /Rename/ }).click();
    await page.getByLabel('Rename project').fill('Ash & Auger');
    await page.getByRole('menu').getByRole('button', { name: 'Rename', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Ash & Auger', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Ash & Auger', exact: true })).toBeVisible();
  });
});

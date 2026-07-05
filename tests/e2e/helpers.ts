import { type Page, expect } from '@playwright/test';

/** Boot the app on a fresh origin and create the first project via the
 * real welcome gate (blank-project path). */
export async function bootWithProject(page: Page, name = 'The Hollow Crown') {
  await page.goto('./');
  await page.getByRole('button', { name: /Blank project/ }).click();
  await page.getByLabel('Project name').fill(name);
  await page.getByRole('button', { name: 'Create project' }).click();
  await expect(page.getByRole('heading', { name })).toBeVisible();
}

/** Navigate via the workspace nav — viewport-aware. Desktop rail lists
 * everything; the mobile bottom nav keeps Home/Today/Writer's Room as
 * tabs and folds codex types into the Browse sheet, the rest into More. */
export async function openNav(page: Page, label: string | RegExp) {
  const nav = page.getByRole('navigation', { name: 'Workspace' });
  // After a reload the nav renders asynchronously — wait for it to be
  // populated before probing, or count() races to 0 and we take the
  // mobile-sheet path on desktop.
  await nav.getByRole('button').first().waitFor({ state: 'visible' });
  const direct = nav.getByRole('button', { name: label });
  if ((await direct.count()) > 0) {
    await direct.first().click();
    return;
  }
  for (const sheetName of ['Browse', 'More'] as const) {
    await nav.getByRole('button', { name: sheetName, exact: true }).click();
    await expect(nav.getByRole('menu')).toBeVisible();
    const inSheet = nav.getByRole('button', { name: label });
    if ((await inSheet.count()) > 0) {
      await inSheet.first().click();
      return;
    }
    // Not in this sheet — toggle it closed and try the next.
    await nav.getByRole('button', { name: sheetName, exact: true }).click();
  }
  throw new Error(`No workspace nav entry matches ${String(label)}`);
}

/** Create a cast member through the real UI. Assumes the app is booted. */
export async function createCastMember(
  page: Page,
  fields: { name: string; summary?: string }
) {
  await openNav(page, 'Cast');
  await page.getByRole('button', { name: '+ Create character' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name *').fill(fields.name);
  if (fields.summary) {
    await dialog.getByLabel('Summary').fill(fields.summary);
  }
  await dialog.getByRole('button', { name: 'Create character' }).click();
  await expect(dialog).toBeHidden();
}

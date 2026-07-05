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

/** Create a cast member through the real UI. Assumes the app is booted. */
export async function createCastMember(
  page: Page,
  fields: { name: string; summary?: string }
) {
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Cast' }).click();
  await page.getByRole('button', { name: '+ Create character' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name *').fill(fields.name);
  if (fields.summary) {
    await dialog.getByLabel('Summary').fill(fields.summary);
  }
  await dialog.getByRole('button', { name: 'Create character' }).click();
  await expect(dialog).toBeHidden();
}

import { test, expect } from '@playwright/test';
import { bootWithProject } from './helpers';

// E2E ground rules (enforced for every spec in this suite):
//  - interact ONLY via real rendered controls (getByRole / getByLabel / getByTestId)
//  - every mutation must survive a reload before the spec may pass
//  - no synthetic event dispatch, no page.evaluate-driven actions

test.describe('boot', () => {
  test('fresh origin boots to the welcome gate with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('./');
    await expect(page.getByRole('heading', { name: 'Welcome to Loomwright' })).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('theme toggle switches theme and persists across reload', async ({ page }) => {
    await bootWithProject(page);
    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'parchment-light');

    await page.getByRole('button', { name: 'Switch to dark theme' }).click();
    await expect(html).toHaveAttribute('data-theme', 'midnight-ink');

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'midnight-ink');

    await page.getByRole('button', { name: 'Switch to light theme' }).click();
    await expect(html).toHaveAttribute('data-theme', 'parchment-light');
  });

  test('navigation renders Home as the current surface after setup', async ({ page }) => {
    await bootWithProject(page);
    const nav = page.getByRole('navigation', { name: 'Workspace' });
    await expect(nav.getByRole('button', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});

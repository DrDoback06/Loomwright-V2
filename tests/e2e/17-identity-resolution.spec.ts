import { test, expect } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

test.describe('identity resolution centre', () => {
  test('top Review access and both rail label modes are clear and persistent', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Desktop rails collapse into the mobile navigation shell.');
    await bootWithProject(page);

    const workspace = page.getByRole('navigation', { name: 'Workspace' });
    await expect(workspace.getByText('Workspace', { exact: true })).toBeVisible();

    const topbar = page.locator('.lw-topbar');
    await expect(topbar.getByRole('button', { name: /Open review queue/i })).toBeVisible();
    await topbar.getByRole('button', { name: 'Collapse left navigation' }).click();
    await expect(workspace).toHaveClass(/lw-leftrail--collapsed/);
    await expect(workspace.getByText('Workspace', { exact: true })).toHaveCount(0);
    await topbar.getByRole('button', { name: 'Expand left navigation' }).click();
    await expect(workspace).toHaveClass(/lw-leftrail--expanded/);

    const dock = page.getByTestId('panel-dock');
    await dock.getByRole('button', { name: 'Expand right navigation' }).click();
    await expect(dock).toHaveClass(/lw-dock--expanded/);
    await expect(dock.getByText('Codex panels', { exact: true })).toBeVisible();
    await expect(dock.getByText('Cast', { exact: true })).toBeVisible();

    await topbar.getByRole('button', { name: /Open review queue/i }).click();
    await expect(page.getByTestId('surface-review')).toBeVisible();
  });

  test('dragging a minor Codex entity onto the main entity opens the exact merge preview', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Pointer drag merge is exercised on the desktop roster.');
    await bootWithProject(page);
    await createCastMember(page, { name: 'Graham Hendricks', summary: 'The established courier.' });
    await createCastMember(page, { name: 'Graham', summary: 'A courier seen at the market.' });
    await openNav(page, 'Cast');

    const source = page.locator('.lw-rosterdrop', { hasText: 'Graham' }).filter({ hasNotText: 'Graham Hendricks' });
    const target = page.locator('.lw-rosterdrop', { hasText: 'Graham Hendricks' });
    await expect(source).toHaveCount(1);
    await expect(target).toHaveCount(1);
    await source.dragTo(target);

    const preview = page.getByTestId('merge-preview');
    await expect(preview).toBeVisible();
    await expect(preview).toContainText('Graham Hendricks');
    await expect(preview).toContainText('Graham');
    await expect(preview).toContainText('Every linked record that will change');
    await expect(preview.getByTestId('merge-ripple-details')).toBeVisible();
    await expect(preview).toContainText('Exact value after merge');

    await preview.getByRole('button', { name: 'Confirm merge everywhere' }).click();
    await expect(page.getByText(/Graham Hendricks is now the canonical entity/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Graham', exact: true })).toHaveCount(0);
  });
});

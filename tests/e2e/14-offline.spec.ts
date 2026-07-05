import { test, expect } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

test.describe('offline (PWA)', () => {
  test('the app boots, reads, and writes with the network gone', async ({ page, context }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor Vael', summary: 'Queen in exile.' });

    // Let the service worker finish precaching, then reload so this page
    // is controlled by it. (Read-only readiness probe — no DOM mutation.)
    await page.waitForFunction(
      'navigator.serviceWorker.getRegistration().then((r) => !!(r && r.active))',
      undefined,
      { timeout: 20000 }
    );
    await page.reload();
    await page.waitForFunction('!!navigator.serviceWorker.controller', undefined, {
      timeout: 20000,
    });

    // Kill the network. The app must still boot from the SW cache and
    // serve every byte of data from IndexedDB.
    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('heading', { name: 'The Hollow Crown' })).toBeVisible({
      timeout: 15000,
    });
    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: /Aelinor Vael/ })).toBeVisible();

    // Writing offline: create another character and a chapter with prose.
    await createCastMember(page, { name: 'Captain Brec' });
    await openNav(page, "Writer's Room");
    await page
      .getByRole('tablist', { name: 'Chapters' })
      .getByRole('button', { name: '+ New chapter' })
      .click();
    await page.getByLabel('Manuscript body').click();
    await page.keyboard.type('The harbour bells rang the short peal.');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');

    // Offline extraction works end to end (it is pure local compute).
    await page.getByRole('button', { name: 'Save & Extract' }).click();
    await expect(page.getByText(/candidate|Nothing recognisable/)).toBeVisible();

    // Still offline: reload and re-assert everything persisted.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'The Hollow Crown' })).toBeVisible({
      timeout: 15000,
    });
    await openNav(page, "Writer's Room");
    await expect(page.getByLabel('Manuscript body')).toContainText('short peal');
    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: /Captain Brec/ })).toBeVisible();

    await context.setOffline(false);
  });
});

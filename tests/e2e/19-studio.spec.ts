import { test, expect } from '@playwright/test';
import { bootWithProject, openNav } from './helpers';

// The appearance layer. `data-density` and `data-typeset` shipped in
// tokens.css during the rebuild with nothing to drive them; these specs
// exist to prove they are now genuinely wired, and that every choice
// survives a reload — the preferences are read pre-paint by a script in
// index.html, so a reload is the only honest test of persistence.

test.describe('studio appearance', () => {
  test('all four themes apply and persist', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Settings');

    const html = page.locator('html');
    await expect(html).toHaveAttribute('data-theme', 'studio-dark');

    const tweaks = page.getByTestId('settings-tweaks');
    await expect(tweaks).toBeVisible();

    for (const [label, value] of [
      ['Parchment', 'parchment-light'],
      ['Midnight ink', 'midnight-ink'],
      ['Studio light', 'studio-light'],
      ['Studio dark', 'studio-dark'],
    ] as const) {
      await tweaks.getByRole('button', { name: label, exact: true }).click();
      await expect(html).toHaveAttribute('data-theme', value);
    }

    await tweaks.getByRole('button', { name: 'Parchment', exact: true }).click();
    await page.reload();
    await expect(html).toHaveAttribute('data-theme', 'parchment-light');
  });

  test('density, typeface and motion stamp the document and survive a reload', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Settings');
    const html = page.locator('html');
    const tweaks = page.getByTestId('settings-tweaks');

    // Density has to move SPACING, not just control heights — that is what
    // `--density-pad` and `--density-gap` have always claimed, and until
    // N5b nothing read either of them.
    const card = page.getByTestId('settings-tweaks');
    await expect(card).toHaveCSS('padding', '20px');
    await tweaks.getByRole('button', { name: 'Compact', exact: true }).click();
    await expect(html).toHaveAttribute('data-density', 'compact');
    await expect(card).toHaveCSS('padding', '14px');

    await tweaks.getByRole('button', { name: 'Literary', exact: true }).click();
    await expect(html).toHaveAttribute('data-typeset', 'literary');

    await tweaks.getByRole('button', { name: 'Reduced', exact: true }).click();
    await expect(html).toHaveAttribute('data-motion-pref', 'reduce');

    await page.reload();
    await expect(html).toHaveAttribute('data-density', 'compact');
    await expect(html).toHaveAttribute('data-typeset', 'literary');
    await expect(html).toHaveAttribute('data-motion-pref', 'reduce');
  });

  test('prose measure writes the CSS variable and survives a reload', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Settings');
    const html = page.locator('html');

    const slider = page.getByLabel(/^Prose width/);
    await slider.fill('40');
    await expect(html).toHaveAttribute('style', /--measure:\s*40em/);

    // The route is not persisted, so a reload lands on Home — the variable
    // is restored by the pre-paint script regardless, and the control shows
    // the stored value once you navigate back to it.
    await page.reload();
    await expect(html).toHaveAttribute('style', /--measure:\s*40em/);

    await openNav(page, 'Settings');
    await expect(page.getByLabel(/^Prose width/)).toHaveValue('40');
  });
});

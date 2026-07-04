import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember } from './helpers';

async function createLocation(page: Page, name: string) {
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Locations' }).click();
  await page.getByRole('button', { name: '+ Create location' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Name *').fill(name);
  await dialog.getByRole('button', { name: 'Create location' }).click();
  await expect(dialog).toBeHidden();
}

async function openAtlas(page: Page) {
  await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Atlas' }).click();
  await expect(page.getByTestId('surface-atlas')).toBeVisible();
}

test.describe('atlas', () => {
  test('place a pin by real clicks, drag it, both survive reload', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Pointer-drag flow is desktop; touch pan is covered separately.');
    await bootWithProject(page);
    await createLocation(page, 'Pale Reach');
    await openAtlas(page);

    // Arm placement and click the canvas.
    await page.getByRole('button', { name: '▲ Pale Reach' }).click();
    await expect(page.getByTestId('placing-hint')).toBeVisible();
    const canvas = page.getByTestId('atlas-canvas');
    await canvas.click({ position: { x: 400, y: 300 } });
    await expect(page.getByText('Pale Reach pinned to the map.')).toBeVisible();

    const pin = page.getByTestId('pin-Pale Reach');
    await expect(pin).toBeVisible();
    const before = await pin.boundingBox();

    // Drag the pin with real pointer moves.
    await page.mouse.move(before!.x + before!.width / 2, before!.y + before!.height / 2);
    await page.mouse.down();
    await page.mouse.move(before!.x + 120, before!.y + 80, { steps: 8 });
    await page.mouse.up();
    const after = await pin.boundingBox();
    expect(Math.abs(after!.x - before!.x)).toBeGreaterThan(50);

    // Reload — the dragged position persists.
    await page.reload();
    await openAtlas(page);
    const persisted = await page.getByTestId('pin-Pale Reach').boundingBox();
    expect(Math.abs(persisted!.x - after!.x)).toBeLessThan(10);
  });

  test('travel routes derive from cast travel history', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Pointer placement flow is desktop-first.');
    await bootWithProject(page);
    await createLocation(page, 'Pale Reach');
    await createLocation(page, 'Vraska Pass');
    await createCastMember(page, { name: 'Aelinor' });

    // Aelinor travelled Pale Reach → Vraska Pass (via the editor).
    await page.getByRole('button', { name: /Aelinor/ }).click();
    await page.getByTestId('entity-detail').getByRole('button', { name: 'Edit' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Timeline / Locations' }).click();
    await dialog.getByRole('combobox', { name: 'Add to Travel history' }).selectOption({ label: 'Pale Reach' });
    await dialog.getByRole('combobox', { name: 'Add to Travel history' }).selectOption({ label: 'Vraska Pass' });
    await dialog.getByLabel('Current location').selectOption({ label: 'Vraska Pass' });
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();

    await openAtlas(page);
    // Pin both locations.
    for (const [name, x, y] of [
      ['Pale Reach', 300, 300],
      ['Vraska Pass', 550, 420],
    ] as const) {
      await page.getByRole('button', { name: `▲ ${name}` }).click();
      await page.getByTestId('atlas-canvas').click({ position: { x, y } });
      await expect(page.getByText(`${name} pinned to the map.`)).toBeVisible();
    }

    // The derived route polyline renders for Aelinor.
    await expect(page.getByTestId('travel-route')).toBeVisible();
    await expect(page.getByTestId('travel-route')).toContainText('Aelinor');

    // Toggling the layer off removes it; the choice persists.
    // The layer checkbox is controlled by the live store (async), so
    // click + assert rather than check()/uncheck().
    await page.getByRole('checkbox', { name: 'Travel routes' }).click();
    await expect(page.getByRole('checkbox', { name: 'Travel routes' })).not.toBeChecked();
    await expect(page.getByTestId('travel-route')).toHaveCount(0);
    await page.reload();
    await openAtlas(page);
    await expect(page.getByTestId('travel-route')).toHaveCount(0);
    await page.getByRole('checkbox', { name: 'Travel routes' }).click();
    await expect(page.getByTestId('travel-route')).toBeVisible();
  });

  test('touch: canvas pans and a pin tap focuses the location (mobile)', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile, 'Touch behaviour — mobile project only.');
    await bootWithProject(page);
    await createLocation(page, 'Pale Reach');
    await openAtlas(page);

    await page.getByRole('button', { name: '▲ Pale Reach' }).click();
    await page.getByTestId('atlas-canvas').tap({ position: { x: 200, y: 200 } });
    await expect(page.getByText('Pale Reach pinned to the map.')).toBeVisible();

    // Tap the pin: focuses the location (sidebar row becomes current).
    await page.getByTestId('pin-Pale Reach').tap();
    await expect(
      page.getByTestId('surface-atlas').getByRole('button', { name: '▲ Pale Reach' })
    ).toHaveAttribute('aria-current', 'true');
  });
});

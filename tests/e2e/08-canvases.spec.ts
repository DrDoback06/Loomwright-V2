import { test, expect } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

test.describe('canvas workspaces', () => {
  test('tangle: note + entity cards, labelled thread, all persist', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Canvas click-placement flows are desktop; touch pan covered in atlas.');
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor' });

    await openNav(page, 'Tangle');
    await page.getByRole('button', { name: '+ New board' }).click();

    // Note card.
    await page.getByLabel('Note text').fill('Who sent the letter?');
    await page.getByRole('button', { name: 'Place', exact: true }).click();
    await page.getByTestId('tangle-canvas').click({ position: { x: 300, y: 200 } });
    await expect(page.getByTestId('node-Who sent the letter?')).toBeVisible();

    // Entity card.
    await page.getByLabel('Add entity card').selectOption({ label: '◐ Aelinor' });
    await page.getByTestId('tangle-canvas').click({ position: { x: 520, y: 320 } });
    await expect(page.getByTestId('node-Aelinor')).toBeVisible();

    // Labelled directed thread between them.
    await page.getByLabel('Thread label').fill('suspects');
    await page.getByRole('button', { name: 'Connect two cards' }).click();
    await page.getByTestId('node-Who sent the letter?').click();
    await page.getByTestId('node-Aelinor').click();
    await expect(page.getByTestId('edge-suspects')).toBeVisible();
    await expect(page.getByTestId('edge-suspects').getByText('suspects')).toBeVisible();

    // Everything persists.
    await page.reload();
    await openNav(page, 'Tangle');
    await expect(page.getByTestId('node-Who sent the letter?')).toBeVisible();
    await expect(page.getByTestId('node-Aelinor')).toBeVisible();
    await expect(page.getByTestId('edge-suspects')).toBeVisible();
  });

  test('skill tree: nodes, prerequisite link, unlock state persist', async ({
    page,
    isMobile,
  }) => {
    test.skip(isMobile, 'Canvas click-placement flows are desktop.');
    await bootWithProject(page);
    await openNav(page, 'Skill Trees');
    await page.getByRole('button', { name: '+ New tree' }).click();

    for (const [label, x, y] of [
      ['Ember Coax', 300, 200],
      ['Flame Ward', 520, 320],
    ] as const) {
      await page.getByLabel('Free skill label').fill(label);
      await page.getByRole('button', { name: 'Place', exact: true }).click();
      await page.getByTestId('skilltree-canvas').click({ position: { x, y } });
      await expect(page.getByTestId(`node-${label}`)).toBeVisible();
    }

    // Prerequisite: Ember Coax → Flame Ward.
    await page.getByRole('button', { name: 'Link prerequisite' }).click();
    await page.getByTestId('node-Ember Coax').click();
    await page.getByTestId('node-Flame Ward').click();
    await expect(page.getByText('Prerequisite linked.')).toBeVisible();

    // Unlock Ember Coax via the side panel toggle.
    await page.getByTestId('node-Ember Coax').click();
    await page.getByRole('checkbox', { name: 'Unlocked' }).click();
    await expect(page.getByRole('checkbox', { name: 'Unlocked' })).toBeChecked();

    await page.reload();
    await openNav(page, 'Skill Trees');
    await expect(page.getByTestId('node-Ember Coax')).toBeVisible();
    await expect(page.getByTestId('node-Flame Ward')).toBeVisible();
    await page.getByTestId('node-Ember Coax').click();
    await expect(page.getByRole('checkbox', { name: 'Unlocked' })).toBeChecked();
  });

  test('relationship graph: bonds render as a network, node click focuses', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor' });
    await createCastMember(page, { name: 'Captain Brec' });

    // Create the relationship through the real editor.
    await openNav(page, 'Relationships');
    await page.getByRole('button', { name: '+ Create relationship' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('From character *').selectOption({ label: 'Aelinor' });
    await dialog.getByLabel('To character *').selectOption({ label: 'Captain Brec' });
    await dialog.getByRole('radio', { name: 'ally', exact: true }).click();
    await dialog.getByRole('button', { name: 'Create relationship' }).click();
    await expect(dialog).toBeHidden();

    // Switch to the graph view.
    await page.getByRole('radio', { name: 'Graph' }).click();
    const graph = page.getByTestId('relationship-graph');
    await expect(graph).toBeVisible();
    await expect(graph.getByTestId('node-Aelinor')).toBeVisible();
    await expect(graph.getByTestId('node-Captain Brec')).toBeVisible();
    await expect(graph.getByTestId('edge-ally')).toBeVisible();

    // Clicking a node focuses the character (visible in the Cast surface).
    await graph.getByTestId('node-Aelinor').click();
    await openNav(page, 'Cast');
    await expect(
      page.getByTestId('entity-detail').getByRole('heading', { name: 'Aelinor' })
    ).toBeVisible();
  });
});

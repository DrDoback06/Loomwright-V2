import { test, expect, type Page } from '@playwright/test';
import { createCastMember, openNav } from './helpers';

/** The final completeness sweep: load the fully-populated sample
 * project, walk EVERY surface in the app, and assert that nothing
 * throws — zero console errors, zero page errors, every surface
 * renders. The legacy app's "isn't wired yet" toast cannot appear
 * because that code path no longer exists. */

const CODEX_SURFACES = [
  'Cast', 'Locations', 'Items', 'Quests', 'Events', 'Timeline', 'Relationships',
  'Skills', 'Stats', 'Bestiary', 'Factions', 'Classes', 'Races', 'Lore', 'References',
];

const OTHER_SURFACES = [
  { label: 'Home', testId: null, heading: 'Sample — The Hollow Crown' },
  { label: 'Today', testId: 'surface-today', heading: null },
  { label: "Writer's Room", testId: 'surface-writers-room', heading: null },
  { label: 'Atlas', testId: 'surface-atlas', heading: null },
  { label: 'Tangle', testId: 'surface-tangle', heading: null },
  { label: 'Skill Trees', testId: 'surface-skill-trees', heading: null },
  { label: 'Random Tables', testId: 'surface-random-tables', heading: null },
  { label: 'Speed Reader', testId: 'surface-speed-reader', heading: null },
  { label: 'Templates', testId: 'surface-templates', heading: null },
  { label: 'Review', testId: 'surface-review', heading: null },
  { label: 'Import & Extract', testId: 'surface-handoff', heading: null },
  { label: 'Settings', testId: 'surface-settings', heading: null },
  { label: 'Trash', testId: 'surface-trash', heading: null },
] as const;

function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
  });
  return errors;
}

test.describe('final sweep', () => {
  test('every surface renders on the sample project with zero errors', async ({ page }) => {
    const errors = watchErrors(page);

    await page.goto('./');
    await page.getByRole('button', { name: /Explore a sample project/ }).click();
    await expect(page.getByRole('heading', { name: 'Sample — The Hollow Crown' })).toBeVisible();

    for (const surface of OTHER_SURFACES) {
      await openNav(page, surface.label);
      if (surface.testId) {
        await expect(page.getByTestId(surface.testId)).toBeVisible();
      } else if (surface.heading) {
        await expect(page.getByRole('heading', { name: surface.heading })).toBeVisible();
      }
    }

    for (const label of CODEX_SURFACES) {
      await openNav(page, label);
      // Each codex surface carries surface-<type> testids; assert the
      // roster heading instead of hardcoding the type slug.
      await expect(
        page.getByRole('heading', { name: new RegExp(label, 'i') }).first()
      ).toBeVisible();
    }

    // Overlays: palette, help, editor drawer open + close cleanly.
    await page.getByRole('button', { name: 'Search (Ctrl+K)' }).click();
    await expect(page.getByTestId('command-palette')).toBeVisible();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Help for this surface' }).click();
    await expect(page.getByTestId('help-dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();

    await openNav(page, 'Cast');
    await page.getByRole('button', { name: '+ Create character' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Cancel' }).click();

    expect(errors).toEqual([]);
  });

  test('the exotic field widgets are live: stats phrase rules feed extraction', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await page.goto('./');
    await page.getByRole('button', { name: /Blank project/ }).click();
    await page.getByLabel('Project name').fill('The Hollow Crown');
    await page.getByRole('button', { name: 'Create project' }).click();
    await expect(page.getByRole('heading', { name: 'The Hollow Crown' })).toBeVisible();

    // The stat-change detector needs a known actor.
    await createCastMember(page, { name: 'Maren' });

    // Create a stat with a phrase rule via the new row-list widget, and
    // check a sample against it with the interactive tester. 'Grit' is
    // the author's word for the stat — not in the built-in vocabulary.
    await openNav(page, 'Stats');
    await page.getByRole('button', { name: '+ Create stat' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name *').fill('Resolve');
    await dialog.getByRole('button', { name: 'Extraction phrase rules' }).click();
    await dialog.getByPlaceholder('Add a row and press Enter').fill('grit');
    await dialog.getByPlaceholder('Add a row and press Enter').press('Enter');
    await dialog.getByLabel('Test a phrase').fill("Maren's grit hardened at the door.");
    await expect(dialog.getByTestId('phrase-test-result')).toContainText('✓ Matches: grit');
    await dialog.getByRole('button', { name: 'Create stat' }).click();
    await expect(dialog).toBeHidden();

    // The rule is genuinely consumed: prose matching it produces a stat
    // candidate in Review.
    await openNav(page, "Writer's Room");
    await page
      .getByRole('tablist', { name: 'Chapters' })
      .getByRole('button', { name: '+ New chapter' })
      .click();
    await page.getByLabel('Manuscript body').click();
    await page.keyboard.type("Maren's grit hardened at the door.");
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
    await page.getByRole('button', { name: 'Save & Extract' }).click();
    await expect(page.getByText(/candidate|re-confirmed/)).toBeVisible();

    await openNav(page, /Review/);
    await expect(page.locator('.lw-qcard', { hasText: 'grit' }).first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});

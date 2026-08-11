import { test, expect } from '@playwright/test';
import { bootWithProject, openNav } from './helpers';

// The navigation collapsed from twenty-nine rail slots to four
// destinations. The thing worth proving is not that the four exist, but
// that nothing became unreachable: the codex types are a filter strip,
// the canvases are sub-views, and everything else is one palette away —
// on the phone as well as the desktop.

const DESTINATIONS = ['Write', 'Plan', 'Codex', 'Insights', 'Worlds'];

test.describe('shell: destinations', () => {
  test('the four destinations are reachable and mark themselves current', async ({ page }) => {
    await bootWithProject(page);
    const nav = page.getByRole('navigation', { name: 'Workspace' });

    for (const dest of DESTINATIONS) {
      await nav.getByRole('button', { name: dest, exact: true }).click();
      await expect(nav.getByRole('button', { name: dest, exact: true })).toHaveAttribute(
        'aria-current',
        'page'
      );
    }
  });

  test('every surface a legacy route named is still reachable', async ({ page }) => {
    await bootWithProject(page);

    // Sub-views of a destination.
    for (const [label, testId] of [
      ['Home', null],
      ['Today', 'surface-today'],
      ['Review', 'surface-review'],
      ['Atlas', 'surface-atlas'],
      ['Tangle', 'surface-tangle'],
      ['Skill Trees', 'surface-skill-trees'],
      ["Writer's Room", 'surface-writers-room'],
    ] as const) {
      await openNav(page, label);
      if (testId) await expect(page.getByTestId(testId)).toBeVisible();
    }

    // Palette-only routes: deferred, never hidden.
    for (const [label, testId] of [
      ['AI Handoff', 'surface-handoff'],
      ['Random Tables', 'surface-random-tables'],
      ['Speed Reader', 'surface-speed-reader'],
      ['Templates', 'surface-templates'],
      ['Trash', 'surface-trash'],
      ['Settings', 'surface-settings'],
    ] as const) {
      await openNav(page, label);
      await expect(page.getByTestId(testId)).toBeVisible();
    }
  });

  test('codex types are a filter strip, with live counts', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Codex');

    const strip = page.getByRole('tablist', { name: 'Codex types' });
    await expect(strip.getByRole('tab', { name: 'Cast' })).toHaveAttribute('aria-selected', 'true');

    await strip.getByRole('tab', { name: 'Locations' }).click();
    await expect(strip.getByRole('tab', { name: 'Locations' })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByRole('heading', { name: /Locations/i }).first()).toBeVisible();
  });

  test('Alt+1..5 jump between destinations', async ({ page }) => {
    await bootWithProject(page);
    const nav = page.getByRole('navigation', { name: 'Workspace' });

    await page.keyboard.press('Alt+5');
    await expect(nav.getByRole('button', { name: 'Worlds', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
    await page.keyboard.press('Alt+1');
    await expect(nav.getByRole('button', { name: 'Write', exact: true })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});

test.describe('shell: command palette modes', () => {
  test('each prefix narrows the palette to one kind of thing', async ({ page }) => {
    await bootWithProject(page);
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByTestId('command-palette');
    const input = palette.getByLabel('Palette search');

    await expect(palette.getByTestId('palette-mode')).toContainText('> commands');

    await input.fill('>');
    await expect(palette.getByTestId('palette-mode')).toHaveText('Commands');
    await expect(palette.getByRole('button', { name: /Go to Codex/ })).toBeVisible();

    await input.fill('/');
    await expect(palette.getByTestId('palette-mode')).toHaveText('AI actions');
    await expect(palette.getByRole('button', { name: /Generate/ }).first()).toBeVisible();
    // A pure navigation command is not an AI action.
    await expect(palette.getByRole('button', { name: /Go to Trash/ })).toHaveCount(0);

    // Backspace at position 0 leaves the mode — the prefix is just text.
    await input.fill('');
    await expect(palette.getByTestId('palette-mode')).toContainText('> commands');
  });

  test('destination rows advertise the shortcut that opens them', async ({ page }) => {
    await bootWithProject(page);
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByTestId('command-palette');
    await palette.getByLabel('Palette search').fill('>Go to Worlds');
    await expect(palette.locator('kbd', { hasText: 'Alt+5' })).toBeVisible();
  });

  test('a title match outranks a subtitle match', async ({ page }) => {
    await bootWithProject(page);
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByTestId('command-palette');
    // "Go to Insights" lists Today among its sub-views, so it matches the
    // query too — but "Go to Today" is what was asked for.
    await palette.getByLabel('Palette search').fill('today');
    await palette.getByLabel('Palette search').press('Enter');
    await expect(page.getByTestId('surface-today')).toBeVisible();
  });
});

test.describe('shell: empty states', () => {
  test("Write leads with the paste path, and it goes somewhere", async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, "Writer's Room");

    const empty = page.getByTestId('write-empty');
    await expect(empty).toContainText('No AI key needed');
    await empty.getByRole('button', { name: /Paste a chapter/ }).click();
    await expect(page.getByTestId('surface-handoff')).toBeVisible();
  });
});

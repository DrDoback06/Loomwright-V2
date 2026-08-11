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

/** Where each surface lives now that the rail is four destinations.
 * Specs still ask for a surface by name — 'Cast', 'Atlas', 'Review' —
 * and this table knows which destination owns it and which sub-control
 * to click once there. Keeping the mapping here is what let the whole
 * suite survive the navigation change untouched. */
const SURFACE_HOME: { name: string; dest: string; sub: string }[] = [
  { name: "Writer's Room", dest: 'Write', sub: '' },
  { name: 'Home', dest: 'Insights', sub: 'Overview' },
  { name: 'Today', dest: 'Insights', sub: 'Today' },
  { name: 'Review', dest: 'Insights', sub: 'Review' },
  { name: 'Atlas', dest: 'Worlds', sub: 'Atlas' },
  { name: 'Tangle', dest: 'Worlds', sub: 'Tangle' },
  { name: 'Skill Trees', dest: 'Worlds', sub: 'Skill Trees' },
];

/** Routes with no rail slot — reached through the command palette, which
 * is the point: deferred, never hidden. */
const PALETTE_ONLY: { name: string; command: string }[] = [
  { name: 'AI Handoff', command: 'Go to AI Handoff' },
  { name: 'Import & Extract', command: 'Go to AI Handoff' },
  { name: 'Trash', command: 'Go to Trash' },
  { name: 'Random Tables', command: 'Go to Random Tables' },
  { name: 'Speed Reader', command: 'Go to Speed Reader' },
  { name: 'Templates', command: 'Go to Templates' },
  // The rail carries Settings on desktop and is matched directly above;
  // the phone reaches it through the More tab, which opens the palette.
  { name: 'Settings', command: 'Go to Settings' },
];

/** Specs name a surface with either a string or a regex. A string is an
 * exact name; a regex is used as written, which is why `/Import &
 * Extract|Handoff/` finds the handoff surface under either name. */
function matcher(label: string | RegExp): (candidate: string) => boolean {
  if (label instanceof RegExp) return (c) => label.test(c);
  const exact = label.toLowerCase();
  return (c) => c.toLowerCase() === exact;
}

/** Navigate to a surface by name, whatever the viewport and wherever the
 * IA has since put it. Four destinations on both desktop and phone; the
 * codex types are a filter strip inside Codex; everything else is one
 * palette away. */
export async function openNav(page: Page, label: string | RegExp) {
  const nav = page.getByRole('navigation', { name: 'Workspace' });
  // After a reload the nav renders asynchronously — wait for it to be
  // populated before probing, or count() races to 0.
  await nav.getByRole('button').first().waitFor({ state: 'visible' });

  const matches = matcher(label);

  // 1. A destination itself.
  const direct = nav.getByRole('button', { name: label });
  if ((await direct.count()) > 0) {
    await direct.first().click();
    return;
  }

  // 2. A surface that now lives inside a destination.
  const home = SURFACE_HOME.find((h) => matches(h.name));
  if (home) {
    await nav.getByRole('button', { name: home.dest, exact: true }).click();
    if (home.sub) {
      await page.getByRole('tab', { name: new RegExp(home.sub, 'i') }).first().click();
    }
    return;
  }

  // 3. A palette-only route.
  const palette = PALETTE_ONLY.find((p) => matches(p.name));
  if (palette) {
    await openPalette(page, palette.command);
    return;
  }

  // 4. A codex type — the filter strip inside Codex.
  await nav.getByRole('button', { name: 'Codex', exact: true }).click();
  const chip = page.getByRole('tab', { name: label });
  if ((await chip.count()) > 0) {
    await chip.first().click();
    return;
  }

  throw new Error(`No workspace nav entry matches ${String(label)}`);
}

/** Run a command palette entry by title. */
export async function openPalette(page: Page, command: string) {
  await page.keyboard.press('Control+k');
  const palette = page.getByTestId('command-palette');
  await expect(palette).toBeVisible();
  await palette.getByLabel('Palette search').fill(command);
  // A palette row's accessible name is its title AND its subtitle, so this
  // is a substring match by necessity, not by laziness.
  await palette.getByRole('button', { name: command }).first().click();
  await expect(palette).toBeHidden();
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

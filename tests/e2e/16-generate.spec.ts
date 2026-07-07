import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// AI specs mock provider HTTP with page.route — no real keys, ever.
const FAKE_KEY = 'sk-ant-e2e-fake-generate';

function mockAnthropic(page: Page, reply: string) {
  return page.route('https://api.anthropic.com/**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text: reply }] }),
    });
  });
}

async function configureAnthropic(page: Page) {
  await openNav(page, 'Settings');
  const provider = page.getByTestId('provider-anthropic');
  await provider.getByLabel('Anthropic API key').fill(FAKE_KEY);
  await provider.getByRole('button', { name: 'Save key' }).click();
  await expect(provider.getByText('key saved ✓')).toBeVisible();
}

const AI_TREE_REPLY = JSON.stringify({
  loomwright: 'loomwright-generation-v1',
  kind: 'skilltree',
  name: 'The Serpent Path',
  skills: [
    { type: 'skills', name: 'Coat Blade', summary: 'Base craft.', fields: { skillType: 'active' } },
    { name: 'Venom Strike', summary: 'The payoff.', fields: { skillType: 'active', effects: ['Poison one foe'] } },
    { name: 'Numbing Cloud', summary: 'Area denial.', fields: { skillType: 'triggered' } },
  ],
  tree: {
    nodes: [
      { skill: 'Coat Blade', tier: 0, branch: 'Toxins', requires: [] },
      { skill: 'Venom Strike', tier: 1, branch: 'Toxins', requires: ['Coat Blade'] },
      { skill: 'Numbing Cloud', tier: 1, branch: 'Clouds', requires: ['Coat Blade'] },
    ],
  },
});

test.describe('generation: JSON round-trip, create-anything dialog', () => {
  test('pasted single-entity JSON prefills the drawer across tabs; save creates it', async ({
    page,
  }) => {
    await bootWithProject(page);
    await openNav(page, 'Cast');
    await page.getByRole('button', { name: /Generate character/ }).click();

    const dialog = page.getByTestId('create-anything');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('tab', { name: 'Paste JSON' }).click();
    await dialog.getByLabel('Pasted JSON').fill(
      JSON.stringify({
        name: 'Vex Marrow',
        summary: 'A smuggler with a debt.',
        tags: ['smuggler'],
        fields: { role: 'Antagonist', personality: 'wry, watchful', fears: 'open water' },
      })
    );
    await dialog.getByRole('button', { name: 'Stage it' }).click();

    // Single entity → the familiar editor drawer, prefilled.
    const drawer = page.getByRole('dialog', { name: 'New Character' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByLabel('Name *')).toHaveValue('Vex Marrow');
    await expect(drawer.getByLabel('Summary')).toHaveValue('A smuggler with a debt.');

    // The pasted values crossed section tabs (Psychology holds these).
    await drawer.getByRole('button', { name: 'Psychology' }).click();
    await expect(drawer.getByLabel('Personality', { exact: true })).toHaveValue('wry, watchful');
    // 'fears' is a chips field — the string coerced into one chip.
    await expect(drawer.getByText('open water')).toBeVisible();

    await drawer.getByRole('button', { name: 'Create character' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: /Vex Marrow/ })).toBeVisible();
  });

  test('copy-as-JSON from a dossier pastes into another type via the palette generate command', async ({
    page,
    context,
    browserName,
  }) => {
    test.skip(browserName !== 'chromium', 'clipboard permissions are chromium-only');
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor Vael', summary: 'Queen in exile.' });

    await page.getByRole('button', { name: /Aelinor Vael/ }).click();
    await page.getByRole('button', { name: 'Copy as JSON' }).click();
    await expect(page.getByText(/copied as JSON/)).toBeVisible();
    const copied = await page.evaluate<string>('navigator.clipboard.readText()');
    expect(JSON.parse(copied).name).toBe('Aelinor Vael');

    // Palette: "Generate creature" opens the dialog pre-targeted — but the
    // pasted JSON declares type "cast", and the declared type wins, so the
    // paste round-trips back into a character drawer, fully prefilled.
    await page.keyboard.press('ControlOrMeta+k');
    await page.getByLabel('Palette search').fill('generate creature');
    await page.getByRole('button', { name: /Generate creature/ }).click();
    const dialog = page.getByTestId('create-anything');
    await dialog.getByRole('tab', { name: 'Paste JSON' }).click();
    await dialog.getByLabel('Pasted JSON').fill(copied);
    await dialog.getByRole('button', { name: 'Stage it' }).click();

    const drawer = page.getByRole('dialog', { name: 'New Character' });
    await expect(drawer.getByLabel('Name *')).toHaveValue('Aelinor Vael');
    await expect(drawer.getByLabel('Summary')).toHaveValue('Queen in exile.');
  });

  test('multi-entity paste previews, accepts as one unit, and undoes as one unit', async ({
    page,
  }) => {
    await bootWithProject(page);
    await openNav(page, 'Cast');
    await page.getByRole('button', { name: /Generate character/ }).click();

    const dialog = page.getByTestId('create-anything');
    await dialog.getByRole('tab', { name: 'Paste JSON' }).click();
    await dialog.getByLabel('Pasted JSON').fill(
      JSON.stringify({
        entities: [
          { type: 'cast', name: 'Vex Marrow', fields: { allies: ['Moth'] } },
          { type: 'cast', name: 'Moth' },
        ],
      })
    );
    await dialog.getByRole('button', { name: 'Stage it' }).click();

    const preview = page.getByTestId('paste-preview');
    await expect(preview).toContainText('Vex Marrow');
    await expect(preview).toContainText('Moth');
    await dialog.getByRole('button', { name: 'Accept all' }).click();

    await expect(page.getByText('2 entries added.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Vex Marrow/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Moth/ })).toBeVisible();

    // The sibling ref resolved to the real row.
    await page.getByRole('button', { name: /Vex Marrow/ }).click();
    await expect(page.getByTestId('entity-detail')).toContainText('Moth');

    // One Undo reverts the whole bundle.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Generation undone.')).toBeVisible();
    await openNav(page, 'Cast');
    await expect(page.getByText('No cast yet.')).toBeVisible();
  });

  test('random roll prefills the drawer; a field die rerolls only its field', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Cast');
    await page.getByRole('button', { name: /Generate character/ }).click();

    const dialog = page.getByTestId('create-anything');
    await dialog.getByRole('tab', { name: 'Random' }).click();
    await dialog.getByLabel('Theme').selectOption('high-fantasy');
    await dialog.getByLabel('Tailor it (optional)').fill('sorcerer');
    await dialog.getByRole('button', { name: '🎲 Roll it' }).click();

    const drawer = page.getByRole('dialog', { name: 'New Character' });
    await expect(drawer).toBeVisible();
    const nameInput = drawer.getByLabel('Name *');
    await expect(nameInput).not.toHaveValue('');
    const rolledName = await nameInput.inputValue();

    // A single die rerolls just its own field; the name stays put.
    await drawer.getByRole('button', { name: 'Identity' }).click();
    await drawer.getByRole('button', { name: 'Reroll Role in story' }).click();
    await expect(
      page.getByRole('radiogroup', { name: 'Role in story' }).locator('[aria-checked="true"]')
    ).toHaveCount(1);
    await drawer.getByRole('button', { name: 'Basics' }).click();
    await expect(nameInput).toHaveValue(rolledName);

    await drawer.getByRole('button', { name: 'Create character' }).click();
    await expect(drawer).toBeHidden();
    await expect(page.getByRole('button', { name: new RegExp(escapeRegex(rolledName)) })).toBeVisible();
  });

  test('random batch previews in the dialog and accepts as one unit', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Locations');
    await page.getByRole('button', { name: /Generate location/ }).click();

    const dialog = page.getByTestId('create-anything');
    await dialog.getByRole('tab', { name: 'Random' }).click();
    await dialog.getByLabel('How many').fill('3');
    await dialog.getByRole('button', { name: '🎲 Roll it' }).click();

    await expect(page.getByTestId('random-preview')).toContainText('3 entries staged');
    await dialog.getByRole('button', { name: 'Accept all' }).click();
    await expect(page.getByText('3 entries added.')).toBeVisible();
  });

  test('"Fill empty fields" random-fills a blank manual form', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Cast');
    await page.getByRole('button', { name: '+ Create character' }).click();

    const drawer = page.getByRole('dialog', { name: 'New Character' });
    await drawer.getByRole('button', { name: '🎲 Fill empty fields' }).click();
    await expect(page.getByText(/fields filled\./)).toBeVisible();
    await expect(drawer.getByLabel('Name *')).not.toHaveValue('');
  });

  test('sorcerer skill tree: ghosts populate the canvas, Accept persists, Undo reverts', async ({
    page,
  }) => {
    await bootWithProject(page);
    await openNav(page, 'Skill Trees');

    await page.getByRole('button', { name: '✨ Generate tree…' }).first().click();
    const dialog = page.getByTestId('create-anything');
    await dialog.getByLabel('Theme').selectOption('high-fantasy');
    await dialog.getByLabel('Tailor it (optional)').fill('sorcerer');
    await dialog.getByLabel('How many skills').fill('10');
    await dialog.getByRole('button', { name: '🎲 Roll it' }).click();

    // The tree stages as ghost nodes on the real canvas.
    await expect(page.getByTestId('staged-bar')).toBeVisible();
    await expect(page.getByTestId('staged-tree-note')).toBeVisible();
    await expect(page.locator('.lw-graph__node--staged')).toHaveCount(10);
    await expect(page.getByTestId('branch-legend').locator('.lw-chip')).not.toHaveCount(0);

    await page.getByTestId('staged-bar').getByRole('button', { name: 'Accept all' }).click();
    await expect(page.getByText(/created\./)).toBeVisible();
    await expect(page.getByTestId('staged-bar')).toBeHidden();

    // Real nodes on the canvas, real entries in the Skills codex.
    await expect(page.locator('.lw-graph__node')).toHaveCount(10);
    await expect(page.locator('.lw-graph__node--staged')).toHaveCount(0);
    await openNav(page, 'Skills');
    await expect(page.locator('.lw-roster__count')).toHaveText('10');

    // One Undo reverts the tree AND all ten skills.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Generation undone.')).toBeVisible();
    await expect(page.locator('.lw-roster__count')).toHaveText('0');
    await openNav(page, 'Skill Trees');
    await expect(page.getByText('No skill trees yet.')).toBeVisible();
  });

  test('generate branch extends an existing tree; auto-arrange and fit work', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Skill Trees');

    // Seed a tree via generation and accept it.
    await page.getByRole('button', { name: '✨ Generate tree…' }).first().click();
    const dialog = page.getByTestId('create-anything');
    await dialog.getByLabel('How many skills').fill('6');
    await dialog.getByRole('button', { name: '🎲 Roll it' }).click();
    await page.getByTestId('staged-bar').getByRole('button', { name: 'Accept all' }).click();
    await expect(page.getByTestId('staged-bar')).toBeHidden();
    await expect(page.locator('.lw-graph__node')).toHaveCount(6);

    // Grow a themed branch onto it.
    await page.getByRole('button', { name: '✨ Generate branch…' }).click();
    await page.getByTestId('create-anything').getByLabel('Tailor it (optional)').fill('poison');
    await page.getByTestId('create-anything').getByRole('button', { name: '🎲 Roll it' }).click();
    await expect(page.locator('.lw-graph__node--staged')).toHaveCount(5);
    await page.getByTestId('staged-bar').getByRole('button', { name: 'Accept all' }).click();
    await expect(page.locator('.lw-graph__node')).toHaveCount(11);

    // Surface upgrades: auto-arrange re-lays the tree; fit reframes it.
    await page.getByRole('button', { name: 'Auto-arrange' }).click();
    await expect(page.getByText('Tree arranged by tier and branch.')).toBeVisible();
    await page.getByRole('button', { name: 'Fit to view' }).click();
    await expect(page.locator('.lw-graph__node')).toHaveCount(11);
  });

  test('questline stages ghost quests in the roster and accepts with links', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Quests');
    await page.getByRole('button', { name: /Generate quest/ }).click();

    const dialog = page.getByTestId('create-anything');
    await dialog.getByRole('tab', { name: 'Random' }).click();
    await dialog.getByLabel('How many').fill('3');
    await dialog.getByLabel(/Questline/).check();
    await dialog.getByRole('button', { name: '🎲 Roll it' }).click();

    // Ghost quest cards land in the roster; events ride along in the bundle.
    await expect(page.getByTestId('staged-bar')).toBeVisible();
    await expect(page.getByTestId('staged-rostercard').first()).toBeVisible();

    await page.getByTestId('staged-bar').getByRole('button', { name: 'Accept all' }).click();
    await expect(page.getByTestId('staged-bar')).toBeHidden();
    await expect(page.locator('.lw-roster__count')).toHaveText('3');
  });

  test('AI tab without a provider points to Settings; with one it stages a mocked tree', async ({
    page,
  }) => {
    await mockAnthropic(page, AI_TREE_REPLY);
    await bootWithProject(page);

    // No provider yet → the AI tab explains and links to Settings.
    await openNav(page, 'Skill Trees');
    await page.getByRole('button', { name: '✨ Generate tree…' }).first().click();
    await page.getByTestId('create-anything').getByRole('tab', { name: 'AI' }).click();
    await expect(page.getByText(/needs a configured provider/)).toBeVisible();
    await page.getByRole('button', { name: 'Configure AI in Settings' }).click();
    await configureAnthropic(page);

    // With a key: describe the tree → privacy guard → mocked reply stages.
    await openNav(page, 'Skill Trees');
    await page.getByRole('button', { name: '✨ Generate tree…' }).first().click();
    const dialog = page.getByTestId('create-anything');
    await dialog.getByRole('tab', { name: 'AI' }).click();
    await dialog.getByLabel('What do you want?').fill('a poison skill tree for my assassin');
    await dialog.getByRole('button', { name: '✨ Generate' }).click();
    await expect(dialog.getByTestId('privacy-guard')).toBeVisible();
    await dialog.getByRole('button', { name: 'Send once' }).click();

    await expect(page.getByTestId('staged-bar')).toBeVisible();
    await expect(page.getByTestId('staged-bar')).toContainText('The Serpent Path');
    await expect(page.locator('.lw-graph__node--staged')).toHaveCount(3);
    // AI bundles don't offer Reroll (that's a random-mode affordance).
    await expect(page.getByTestId('staged-bar').getByRole('button', { name: '🎲 Reroll' })).toBeHidden();

    await page.getByTestId('staged-bar').getByRole('button', { name: 'Accept all' }).click();
    await expect(page.locator('.lw-graph__node')).toHaveCount(3);
    await openNav(page, 'Skills');
    await expect(page.locator('.lw-roster__count')).toHaveText('3');
  });

  test('AI tab generates a single character straight into the drawer', async ({ page }) => {
    await mockAnthropic(
      page,
      '```json\n{"type":"cast","name":"Maren Salt-Eye","summary":"Runs the night ferry.","fields":{"role":"Ally","personality":"unsentimental, loyal"}}\n```'
    );
    await bootWithProject(page);
    await configureAnthropic(page);
    await openNav(page, 'Cast');
    await page.getByRole('button', { name: /Generate character/ }).click();

    const dialog = page.getByTestId('create-anything');
    await dialog.getByRole('tab', { name: 'AI' }).click();
    await dialog.getByLabel('What do you want?').fill('a ferrywoman who knows too much');
    await dialog.getByRole('button', { name: '✨ Generate' }).click();
    await dialog.getByRole('button', { name: 'Send once' }).click();

    const drawer = page.getByRole('dialog', { name: 'New Character' });
    await expect(drawer.getByLabel('Name *')).toHaveValue('Maren Salt-Eye');
    await expect(drawer.getByLabel('Summary')).toHaveValue('Runs the night ferry.');
  });

  test('the drawer paste-JSON action fills fields in place', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Cast');
    await page.getByRole('button', { name: '+ Create character' }).click();

    const drawer = page.getByRole('dialog', { name: 'New Character' });
    await drawer.getByRole('button', { name: 'Paste JSON' }).click();
    await drawer
      .getByLabel('Entity JSON')
      .fill('{"name": "Brann", "fields": {"role": "Mentor", "madeUpField": "dropped"}}');
    await drawer.getByRole('button', { name: 'Fill fields' }).click();

    await expect(page.getByText(/fields filled from JSON/)).toBeVisible();
    await expect(drawer.getByLabel('Name *')).toHaveValue('Brann');
    await drawer.getByRole('button', { name: 'Identity' }).click();
    await expect(drawer.getByRole('radio', { name: 'Mentor' })).toHaveAttribute('aria-checked', 'true');
  });

  test('relationship set stages dashed ghost bonds in the graph and accepts', async ({ page }) => {
    await bootWithProject(page);
    // A set weaves bonds among existing cast — seed three so several pairs exist.
    await createCastMember(page, { name: 'Aelinor Vael' });
    await createCastMember(page, { name: 'Brann Duskmere' });
    await createCastMember(page, { name: 'Vex Marrow' });

    await openNav(page, 'Relationships');
    // The graph view is where staged bonds render as dashed ghost edges.
    await page.getByRole('radio', { name: 'Graph' }).click();
    await expect(page.getByText('No relationships to map yet.')).toBeVisible();

    await page.getByRole('button', { name: '✨ Generate relationships' }).click();
    const dialog = page.getByTestId('create-anything');
    await dialog.getByLabel('How many').fill('3');
    await dialog.getByRole('button', { name: '🎲 Roll it' }).click();

    // Ghost bonds appear dashed; their cast endpoints simply show up.
    await expect(page.getByTestId('staged-bar')).toBeVisible();
    await expect(page.locator('.lw-graph__edge--staged')).not.toHaveCount(0);

    await page.getByTestId('staged-bar').getByRole('button', { name: 'Accept all' }).click();
    await expect(page.getByTestId('staged-bar')).toBeHidden();
    // Accepted bonds are now real (no longer dashed) and drawn on the graph.
    await expect(page.locator('.lw-graph__edge--staged')).toHaveCount(0);
    await expect(page.locator('.lw-graph__edge')).not.toHaveCount(0);

    // One Undo reverts the whole set.
    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(page.getByText('Generation undone.')).toBeVisible();
    await expect(page.getByText('No relationships to map yet.')).toBeVisible();
  });

  test('tangle board generates as a staged board and accepts', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Tangle');

    await page.getByRole('button', { name: '✨ Generate board…' }).first().click();
    const dialog = page.getByTestId('create-anything');
    await dialog.getByLabel('How many').fill('6');
    await dialog.getByRole('button', { name: '🎲 Roll it' }).click();

    // The virtual staged board takes over the canvas until Accept/Discard.
    await expect(page.getByTestId('staged-bar')).toBeVisible();
    await expect(page.getByTestId('staged-board-note')).toBeVisible();
    await expect(page.locator('.lw-graph__node--staged')).not.toHaveCount(0);

    await page.getByTestId('staged-bar').getByRole('button', { name: 'Accept all' }).click();
    await expect(page.getByTestId('staged-bar')).toBeHidden();
    // Real cards persist on the now-real board.
    await expect(page.locator('.lw-graph__node')).not.toHaveCount(0);
    await expect(page.locator('.lw-graph__node--staged')).toHaveCount(0);

    // Adding generated cards to the existing board merges more ghosts in.
    await page.getByRole('button', { name: '✨ Add generated cards…' }).click();
    await page.getByTestId('create-anything').getByLabel('How many').fill('4');
    await page.getByTestId('create-anything').getByRole('button', { name: '🎲 Roll it' }).click();
    await expect(page.locator('.lw-graph__node--staged')).not.toHaveCount(0);
    await page.getByTestId('staged-bar').getByRole('button', { name: 'Accept all' }).click();
    await expect(page.getByTestId('staged-bar')).toBeHidden();
    await expect(page.locator('.lw-graph__node--staged')).toHaveCount(0);
  });
});

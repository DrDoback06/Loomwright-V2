import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

// The per-entity AI policy: what this entry contributes to a prompt, and how
// its name is matched. This spec covers the drawer half (N7 step 2). What the
// assembler does with the policy is asserted alongside the context rail, which
// is the first thing that renders entity fields generically — a control that
// stores a value and changes no payload is the failure this milestone is
// specifically trying not to repeat.

async function openAiSection(page: Page, name: string) {
  // A reload lands on the default destination, not the roster — the pattern
  // 02-cast already follows.
  await openNav(page, 'Cast');
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByTestId('entity-detail').getByRole('button', { name: 'Edit' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'AI context' }).click();
  return dialog;
}

test.describe('entity AI policy', () => {
  test('policy, case-sensitivity and exclusions persist across a reload', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'May Thornbury' });

    const dialog = await openAiSection(page, 'May Thornbury');

    // Defaults: detected, loose matching, nothing excluded.
    await expect(dialog.getByRole('radio', { name: 'When detected' })).toHaveAttribute(
      'aria-checked',
      'true'
    );

    await dialog.getByRole('radio', { name: 'Always' }).click();
    await dialog.getByRole('checkbox', { name: /case-sensitively/ }).check();
    await dialog.getByRole('textbox', { name: 'Never count as a mention' }).fill('may well');
    await dialog.getByRole('button', { name: 'Add Never count as a mention' }).click();
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    const reopened = await openAiSection(page, 'May Thornbury');
    await expect(reopened.getByRole('radio', { name: 'Always' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    await expect(reopened.getByRole('checkbox', { name: /case-sensitively/ })).toBeChecked();
    await expect(reopened.getByText('may well')).toBeVisible();
  });

  test('appearance is withheld by default and can be turned back on per entity', async ({
    page,
  }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Vex Ilmaren' });

    const dialog = await openAiSection(page, 'Vex Ilmaren');

    // The opinion lives in the entity config, so it applies without anything
    // having been written into this entity's row.
    const physical = dialog.getByRole('checkbox', { name: 'Physical description' });
    const personality = dialog.getByRole('checkbox', { name: 'Personality' });
    await expect(physical).not.toBeChecked();
    await expect(personality).toBeChecked();

    // Overrides go both ways — the reason this is a map and not a hidden list.
    await physical.check();
    await personality.uncheck();
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();

    await page.reload();
    const reopened = await openAiSection(page, 'Vex Ilmaren');
    await expect(reopened.getByRole('checkbox', { name: 'Physical description' })).toBeChecked();
    await expect(reopened.getByRole('checkbox', { name: 'Personality' })).not.toBeChecked();
  });

  test('editing an ordinary field does not reset the policy', async ({ page }) => {
    // `updateEntity` replaces the whole fields bag. This is the regression
    // that would be invisible: no error, no toast, just a policy quietly
    // back at its default the next time you look.
    await bootWithProject(page);
    await createCastMember(page, { name: 'Ruth Ackerley' });

    let dialog = await openAiSection(page, 'Ruth Ackerley');
    await dialog.getByRole('radio', { name: 'Never' }).click();
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();

    // A completely unrelated edit, in a different section.
    await page.getByTestId('entity-detail').getByRole('button', { name: 'Edit' }).click();
    dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Psychology' }).click();
    await dialog.getByLabel('Personality').fill('Guarded, and tired of explaining it.');
    await dialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(dialog).toBeHidden();

    // Reload so this reads the stored row rather than anything still in
    // memory — the reset would happen at the write, and only show up later.
    await page.reload();
    const reopened = await openAiSection(page, 'Ruth Ackerley');
    await expect(reopened.getByRole('radio', { name: 'Never' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });
});

async function openWriteWithScene(page: Page, text: string) {
  await openNav(page, "Writer's Room");
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.type(text);
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
  await page.getByRole('button', { name: 'Context', exact: true }).click();
  return page.getByTestId('context-rail');
}

test.describe('context rail', () => {
  test('shows the three lanes, a budget, and the exact text that gets sent', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow', summary: 'A ferryman with a long pole.' });
    const rail = await openWriteWithScene(page, 'Marrow poled the ferry across the water.');

    await expect(rail.getByRole('region', { name: 'Always sent' })).toBeVisible();
    await expect(rail.getByRole('region', { name: 'Found in this scene' })).toBeVisible();
    await expect(rail.getByRole('region', { name: 'Not sent' })).toBeVisible();

    // Characters, not tokens — there is no tokeniser in this repo.
    await expect(rail.getByTestId('context-budget')).toContainText('characters');

    // The Preview is the payload, not a summary of it.
    await rail.getByText('Show exactly what gets sent').click();
    await expect(rail.getByTestId('context-preview')).toContainText('Marrow');
    await expect(rail.getByTestId('context-preview')).toContainText('A ferryman with a long pole.');
  });

  test('removing a chip changes this scene and leaves the entity alone', async ({ page }) => {
    // The reason lane moves are per-scene: a gesture made while reading one
    // scene must not silently change what every other scene sends.
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow', summary: 'A ferryman.' });
    const rail = await openWriteWithScene(page, 'Marrow poled the ferry across the water.');

    const found = rail.getByRole('region', { name: 'Found in this scene' });
    await expect(found.getByRole('button', { name: /Marrow/ })).toBeVisible();

    await found.getByRole('button', { name: /Marrow/ }).click();
    await rail.getByRole('button', { name: "Don't send here" }).click();

    await expect(
      rail.getByRole('region', { name: 'Not sent' }).getByRole('button', { name: /Marrow/ })
    ).toBeVisible();
    await rail.getByText('Show exactly what gets sent').click();
    await expect(rail.getByTestId('context-preview')).not.toContainText('A ferryman.');

    // On a phone the rail is a full-screen sheet over the nav (the pattern
    // ScenePanel sets), so close it before navigating — as a reader would.
    await rail.getByRole('button', { name: 'Close AI context' }).click();

    // The entity's own policy is untouched — still the default.
    const dialog = await openAiSection(page, 'Marrow');
    await expect(dialog.getByRole('radio', { name: 'When detected' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
  });

  test('the lane move survives a reload', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow', summary: 'A ferryman.' });
    const rail = await openWriteWithScene(page, 'Marrow poled the ferry across the water.');

    await rail.getByRole('region', { name: 'Found in this scene' })
      .getByRole('button', { name: /Marrow/ })
      .click();
    await rail.getByRole('button', { name: 'Always send' }).click();
    await expect(
      rail.getByRole('region', { name: 'Always sent' }).getByRole('button', { name: /Marrow/ })
    ).toBeVisible();

    await page.reload();
    await openNav(page, "Writer's Room");
    await page.getByRole('button', { name: 'Context', exact: true }).click();
    await expect(
      page
        .getByTestId('context-rail')
        .getByRole('region', { name: 'Always sent' })
        .getByRole('button', { name: /Marrow/ })
    ).toBeVisible();
  });
});

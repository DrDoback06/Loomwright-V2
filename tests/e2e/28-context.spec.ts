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

import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember } from './helpers';

async function openWritersRoom(page: Page) {
  await page
    .getByRole('navigation', { name: 'Workspace' })
    .getByRole('button', { name: "Writer's Room" })
    .click();
  await expect(page.getByTestId('surface-writers-room')).toBeVisible();
}

async function typeChapter(page: Page, text: string) {
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
  const body = page.getByLabel('Manuscript body');
  await body.click();
  await page.keyboard.type(text);
  await expect(page.getByText(/Saved/)).toBeVisible();
}

test.describe('extraction + review loop', () => {
  test('known cast mentions become highlighted and click-through to the dossier', async ({
    page,
  }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor', summary: 'Queen of the Pale Reach' });

    await openWritersRoom(page);
    await typeChapter(page, 'Aelinor walked the wall at dawn. Far below, Aelinor turned for home.');
    await page.getByRole('button', { name: 'Save & Extract' }).click();
    await expect(page.getByText(/re-confirmed Aelinor/)).toBeVisible();

    // Highlights render as decorations in the manuscript.
    const mentions = page.locator('.lw-mention');
    await expect(mentions.first()).toBeVisible();
    expect(await mentions.count()).toBeGreaterThanOrEqual(2);

    // They persist across reload (occurrences are stored).
    await page.reload();
    await openWritersRoom(page);
    await expect(page.locator('.lw-mention').first()).toBeVisible();

    // Clicking a mention opens the entity in the Cast surface.
    await page.locator('.lw-mention').first().click();
    await expect(page.getByTestId('entity-detail').getByRole('heading', { name: 'Aelinor' })).toBeVisible();
  });

  test('fresh project discovers new cast offline; accepting creates the entity', async ({
    page,
  }) => {
    await bootWithProject(page);
    await openWritersRoom(page);
    await typeChapter(
      page,
      '"We ride at dawn," said Maren. Lord Brennan only nodded. Later, Maren found Brennan waiting by the gate. "You are late," said Maren.'
    );
    await page.getByRole('button', { name: 'Save & Extract' }).click();
    await expect(page.getByText(/candidate/)).toBeVisible();

    // The nav badge shows pending review items.
    const reviewNav = page
      .getByRole('navigation', { name: 'Workspace' })
      .getByRole('button', { name: /Review/ });
    await reviewNav.click();
    await expect(page.getByTestId('surface-review')).toBeVisible();

    // A cast candidate for Maren exists — accept it via the real button.
    const marenCard = page.locator('.lw-qcard', { hasText: 'Maren' }).first();
    await expect(marenCard).toBeVisible();
    await marenCard.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(page.getByText(/Maren added/)).toBeVisible();

    // The entity now exists in the Cast roster — and survives reload.
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Cast' }).click();
    await expect(page.getByRole('button', { name: /Maren/ })).toBeVisible();
    await page.reload();
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: 'Cast' }).click();
    await expect(page.getByRole('button', { name: /Maren/ })).toBeVisible();
  });

  test('deny removes a candidate; denied work stays done after re-extraction', async ({ page }) => {
    await bootWithProject(page);
    await openWritersRoom(page);
    await typeChapter(
      page,
      '"Move along," said Tobbin. The crowd parted. "Nothing to see," said Tobbin, and the gate closed.'
    );
    await page.getByRole('button', { name: 'Save & Extract' }).click();

    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: /Review/ }).click();
    const tobbinCard = page.locator('.lw-qcard', { hasText: 'Tobbin' }).first();
    await expect(tobbinCard).toBeVisible();
    await tobbinCard.getByRole('button', { name: 'Deny' }).click();
    await expect(page.locator('.lw-qcard', { hasText: 'Tobbin' })).toHaveCount(0);

    // Reload — still denied.
    await page.reload();
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: /Review/ }).click();
    await expect(page.locator('.lw-qcard', { hasText: 'Tobbin' })).toHaveCount(0);
  });

  test('item handoff between cast members produces an update candidate; accepting sets the owner', async ({
    page,
  }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor' });
    await createCastMember(page, { name: 'Saren' });

    // Items ship their own codex surface in M4 — here the item enters the
    // world through extraction itself: "Blade" is an item-noun cue, so the
    // offline discovery pass classifies "Blackwork Blade" as an item.
    await openWritersRoom(page);
    await typeChapter(
      page,
      'Aelinor drew the Blackwork Blade and studied its grain. Aelinor handed the Blackwork Blade to Saren without a word.'
    );
    await page.getByRole('button', { name: 'Save & Extract' }).click();
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: /Review/ }).click();

    // Discovery suggests the item as a new record.
    const itemCard = page.locator('.lw-qcard', { hasText: 'Blackwork Blade' }).first();
    await expect(itemCard).toBeVisible();
    await itemCard.getByRole('button', { name: 'Accept', exact: true }).click();

    // Re-extract: now the item is KNOWN, so the transfer detector fires.
    await openWritersRoom(page);
    await page.getByRole('button', { name: 'Save & Extract' }).click();
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('button', { name: /Review/ }).click();
    const transferCard = page.locator('.lw-qcard', { hasText: 'transferred' }).first();
    await expect(transferCard).toBeVisible();
    await expect(transferCard.getByText(/Saren/).first()).toBeVisible();
    await transferCard.getByRole('button', { name: 'Accept', exact: true }).click();
    await expect(page.getByText(/Blackwork Blade updated/)).toBeVisible();
  });
});

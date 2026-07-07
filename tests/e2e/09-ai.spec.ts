import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

// All AI specs mock provider HTTP with page.route — no real keys, no
// real calls, ever. The fake key below exists only in the test browser.
const FAKE_KEY = 'sk-ant-e2e-fake';

function mockAnthropic(page: Page, reply: string | (() => string)) {
  return page.route('https://api.anthropic.com/**', async (route) => {
    const text = typeof reply === 'function' ? reply() : reply;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ content: [{ type: 'text', text }] }),
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

test.describe('AI layer (mocked providers)', () => {
  test('save key encrypted, test connection, state survives reload', async ({ page }) => {
    await mockAnthropic(page, 'ready');
    await bootWithProject(page);
    await configureAnthropic(page);

    const provider = page.getByTestId('provider-anthropic');
    await provider.getByRole('button', { name: 'Test connection' }).click();
    await expect(page.getByTestId('test-result-anthropic')).toContainText('✓');

    await page.reload();
    await openNav(page, 'Settings');
    await expect(page.getByTestId('provider-anthropic').getByText('key saved ✓')).toBeVisible();
    // Default provider radio persisted too.
    await expect(
      page.getByTestId('provider-anthropic').getByRole('radio')
    ).toBeChecked();
  });

  test('compose: privacy guard, mocked generation, insert as prose', async ({ page }) => {
    await mockAnthropic(
      page,
      'The light over Pale Reach was the colour of old coin.\n\nAelinor did not turn from the window.'
    );
    await bootWithProject(page);
    await configureAnthropic(page);
    await createCastMember(page, { name: 'Aelinor' });
    await page.getByRole('button', { name: /Aelinor/ }).click();

    await openNav(page, "Writer's Room");
    await page
      .getByRole('tablist', { name: 'Chapters' })
      .getByRole('button', { name: '+ New chapter' })
      .click();
    await page.getByRole('button', { name: 'Compose', exact: true }).click();

    await page.getByRole('button', { name: 'Generate with AI' }).click();
    await expect(page.getByTestId('privacy-guard')).toBeVisible();
    await page.getByRole('button', { name: 'Send once' }).click();

    const draft = page.getByTestId('ai-draft');
    await expect(draft.getByLabel('AI draft')).toContainText('colour of old coin');
    await draft.getByRole('button', { name: 'Insert draft' }).click();

    const body = page.getByLabel('Manuscript body');
    await expect(body).toContainText('Aelinor did not turn from the window.');
    // Prose, not a blockquote note.
    await expect(body.locator('blockquote')).toHaveCount(0);

    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
    await page.reload();
    await openNav(page, "Writer's Room");
    await expect(page.getByLabel('Manuscript body')).toContainText('colour of old coin');
  });

  test('deep extraction feeds the review queue from a mocked JSON reply', async ({ page }) => {
    await mockAnthropic(
      page,
      'Here: {"characters":[{"name":"Maren","role":"smuggler","summary":"Runs the salt route."}]}'
    );
    await bootWithProject(page);
    await configureAnthropic(page);

    await openNav(page, "Writer's Room");
    await page
      .getByRole('tablist', { name: 'Chapters' })
      .getByRole('button', { name: '+ New chapter' })
      .click();
    await page.getByLabel('Manuscript body').click();
    await page.keyboard.type('Maren ran the salt route by night.');
    await expect(page.getByText(/Saved/)).toBeVisible();

    await page.getByRole('button', { name: 'Deep Extract (AI)' }).click();
    await expect(page.getByTestId('deep-privacy-guard')).toBeVisible();
    await page.getByRole('button', { name: 'Send chapter to provider' }).click();
    await expect(page.getByText(/AI deep pass found/)).toBeVisible();

    await openNav(page, 'Review');
    const card = page.locator('.lw-qcard', { hasText: 'Maren' }).first();
    await expect(card).toBeVisible();
    await expect(card).toContainText('salt route');
  });

  test('handoff: build pack, paste reply, candidates land in review — fully offline', async ({
    page,
  }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor' });

    await openNav(page, 'Import & Extract');
    await page.getByRole('button', { name: 'Build pack' }).click();
    const pack = page.getByLabel('Handoff pack');
    await expect(pack).toContainText('Known cast: Aelinor');

    await page
      .getByLabel('AI reply')
      .fill('Sure — {"locations":[{"name":"Vraska Pass","kind":"pass","summary":"A cold road."}]}');
    await page.getByRole('button', { name: 'Import to review queue' }).click();
    await expect(page.getByText(/Imported 1 finding/)).toBeVisible();

    await openNav(page, 'Review');
    await expect(page.locator('.lw-qcard', { hasText: 'Vraska Pass' })).toBeVisible();

    // Accept it → it lands in the Locations codex.
    await page
      .locator('.lw-qcard', { hasText: 'Vraska Pass' })
      .getByRole('button', { name: 'Accept', exact: true })
      .click();
    await openNav(page, 'Locations');
    await expect(page.getByRole('button', { name: /Vraska Pass/ })).toBeVisible();
  });

  test('whole-book offline intake chunks a manuscript into review findings', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Import & Extract');

    // A long manuscript with a recurring new character → chunked, scanned.
    const text = 'The guards watched Maren cross the bridge. Everyone feared Maren that winter. '.repeat(90);
    await page.getByLabel('Manuscript text').fill(text);
    await page.getByRole('button', { name: 'Extract offline' }).click();
    await expect(page.getByText(/from \d+ chunks?/)).toBeVisible();

    // The findings land in Review.
    await page.locator('.lw-toast__action', { hasText: 'Review' }).click();
    await expect(page.getByTestId('surface-review')).toBeVisible();
    await expect(page.locator('.lw-qcard', { hasText: 'Maren' }).first()).toBeVisible();
  });

  test('the mega-prompt shows a one-time privacy notice before copying', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'Import & Extract');
    // Depth is adjustable; the first copy surfaces the one-time notice.
    await page.getByRole('radio', { name: 'Full' }).click();
    await page.getByRole('button', { name: 'Copy mega-prompt' }).click();
    await expect(page.getByTestId('mega-notice')).toBeVisible();
    await expect(page.getByTestId('mega-notice')).toContainText(/goes wherever you paste/);
  });

  test('in-app AI enrichment sends the mega-prompt and imports facts + suggestions', async ({ page }) => {
    await mockAnthropic(
      page,
      JSON.stringify({
        locations: [{ name: 'Vraska Pass', kind: 'pass', summary: 'A cold road.' }],
        suggestions: [{ kind: 'arc', title: 'A reckoning at the border', detail: 'Trouble follows.', about: 'Vraska Pass' }],
      })
    );
    await bootWithProject(page);
    await configureAnthropic(page);

    await openNav(page, 'Import & Extract');
    await page.getByLabel('Manuscript text').fill('They struggled through Vraska Pass at dawn, half-frozen.');
    await page.getByRole('button', { name: '✨ Enrich with AI' }).click();
    // Privacy guard → send once (mocked provider, no real key).
    await page.getByRole('button', { name: 'Send once' }).click();
    await expect(page.getByText(/AI enrichment:/)).toBeVisible();

    await page.locator('.lw-toast__action', { hasText: 'Review' }).click();
    await expect(page.locator('.lw-qcard', { hasText: 'Vraska Pass' }).first()).toBeVisible();
  });

  test('local-only mode hides every AI entry point', async ({ page }) => {
    await bootWithProject(page);
    await configureAnthropic(page);
    // Async-controlled checkbox: click + assert (state flows through Dexie).
    await page.getByRole('checkbox', { name: /Local-only mode/ }).click();
    await expect(page.getByRole('checkbox', { name: /Local-only mode/ })).toBeChecked();

    await openNav(page, "Writer's Room");
    await page
      .getByRole('tablist', { name: 'Chapters' })
      .getByRole('button', { name: '+ New chapter' })
      .click();
    await expect(page.getByRole('button', { name: 'Deep Extract (AI)' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Compose', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Generate with AI' })).toHaveCount(0);
    // The offline paths stay useful.
    await expect(page.getByRole('button', { name: 'Insert brief' })).toBeVisible();
  });
});

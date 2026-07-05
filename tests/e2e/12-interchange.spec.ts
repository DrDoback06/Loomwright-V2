import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

// Only ever a fake key — proves export hygiene without any real secret.
const FAKE_KEY = 'sk-ant-e2e-fake-interchange';

test.describe('interchange: world bible, project export/import, references', () => {
  test('world bible download carries the codex and manuscript outline', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor Vael', summary: 'Queen in exile.' });

    await openNav(page, 'Settings');
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'World bible (.md)' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('the-hollow-crown-world-bible.md');
    const content = readFileSync((await download.path())!, 'utf8');
    expect(content).toContain('# The Hollow Crown — World Bible');
    expect(content).toContain('## Cast');
    expect(content).toContain('### Aelinor Vael');
    expect(content).toContain('Queen in exile.');
  });

  test('project export never leaks keys; import round-trips into a new project', async ({
    page,
  }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Aelinor Vael', summary: 'Queen in exile.' });
    await openNav(page, "Writer's Room");
    await page
      .getByRole('tablist', { name: 'Chapters' })
      .getByRole('button', { name: '+ New chapter' })
      .click();
    await page.getByLabel('Manuscript body').click();
    await page.keyboard.type('The salt wind came in from the east.');
    await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');

    // A stored (fake) API key must never appear in the export.
    await openNav(page, 'Settings');
    const provider = page.getByTestId('provider-anthropic');
    await provider.getByLabel('Anthropic API key').fill(FAKE_KEY);
    await provider.getByRole('button', { name: 'Save key' }).click();
    await expect(provider.getByText('key saved ✓')).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export project (.json)' }).click();
    const download = await downloadPromise;
    const filePath = (await download.path())!;
    const blob = readFileSync(filePath, 'utf8');
    expect(blob).toContain('loomwright-project-v2');
    expect(blob).toContain('Aelinor Vael');
    expect(blob).not.toContain(FAKE_KEY);
    expect(blob).not.toContain('"keys"');

    // Import lands in a NEW project with everything intact.
    await page.getByLabel('Import project file').setInputFiles(filePath);
    await expect(page.getByText(/Imported “The Hollow Crown” — 1 entries, 1 chapters/)).toBeVisible();

    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: /Aelinor Vael/ })).toBeVisible();
    await openNav(page, "Writer's Room");
    await expect(page.getByLabel('Manuscript body')).toContainText('salt wind came in from the east');

    // The imported project is remembered as current across reloads.
    await page.reload();
    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: /Aelinor Vael/ })).toBeVisible();
  });

  test('references: paste and file ingestion create reference entries', async ({ page }) => {
    await bootWithProject(page);
    await openNav(page, 'References');

    // Paste path.
    await page.getByRole('button', { name: 'Import…' }).click();
    const dialog = page.getByTestId('reference-import');
    await dialog.getByLabel('Title').fill('Coastal trade routes');
    await dialog
      .getByLabel('Text')
      .fill('Salt moves north in autumn; the ferries run only until the first frost.');
    await dialog.getByRole('button', { name: 'Add reference' }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: /Coastal trade routes/ })).toBeVisible();

    // File path (a real .md file buffer).
    await page.getByRole('button', { name: 'Import…' }).click();
    await page.getByLabel('Reference files').setInputFiles({
      name: 'harbour-law.md',
      mimeType: 'text/markdown',
      buffer: Buffer.from('# Harbour law\nNo ship leaves after the beacon is lit.'),
    });
    await expect(page.getByText('1 reference imported.')).toBeVisible();
    await expect(page.getByRole('button', { name: /harbour-law/ })).toBeVisible();

    // Both survive reload; the body landed in the dossier.
    await page.reload();
    await openNav(page, 'References');
    await page.getByRole('button', { name: /Coastal trade routes/ }).click();
    await expect(page.getByTestId('entity-detail')).toContainText('ferries run only until the first frost');
  });
});

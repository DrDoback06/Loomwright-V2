import { test, expect } from '@playwright/test';
import { bootWithProject, openNav } from './helpers';

const MANUSCRIPT = [
  'Chapter One — The Short Peal',
  '',
  'Aelinor Vael reached Pale Reach two days ahead of the frost. Captain Brec met her at the water stairs with the Blackwork Blade wrapped in oilcloth.',
  '',
  'Chapter Two — The Drovers’ Road',
  '',
  'They took the old road toward Vraska Pass. Maren rode ahead, reading the mile-stones that lied.',
].join('\n');

const STYLE_SAMPLE =
  '"You should not be here," he said. She did not answer him at once. The harbour bells rang the short peal that meant a ship had failed to come home, and the tar-smell sat over the water like a lid.';

test.describe('onboarding, sample project, help', () => {
  test('guided setup seeds the whole project — cast, world, chapters, review, references', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /Guided setup/ }).click();
    const wizard = page.getByTestId('onboarding-wizard');
    await expect(wizard).toBeVisible();

    // 1 — Foundation. Genre and tone are multi-select — pick two genres.
    await wizard.getByLabel('Project name *').fill('The Hollow Crown');
    const genre = wizard.getByRole('group', { name: 'Genre' });
    await genre.getByRole('checkbox', { name: 'Fantasy' }).click();
    await genre.getByRole('checkbox', { name: 'Romance' }).click();
    await expect(genre.getByRole('checkbox', { name: 'Fantasy' })).toBeChecked();
    await expect(genre.getByRole('checkbox', { name: 'Romance' })).toBeChecked();
    await wizard.getByLabel(/Premise/).fill('A queen in exile returns for the succession.');
    await wizard.getByLabel('Themes').fill('loyalty');
    await wizard.getByLabel('Themes').press('Enter');
    await wizard.getByRole('group', { name: 'Tone' }).getByRole('checkbox', { name: 'Grounded' }).click();
    await wizard.getByRole('button', { name: 'Continue ›' }).click();

    // 2 — Voice: offline style analysis produces a profile.
    await wizard.getByRole('radiogroup', { name: 'Point of view' }).getByRole('radio', { name: 'Third limited' }).click();
    await wizard.getByRole('radiogroup', { name: 'Tense' }).getByRole('radio', { name: 'Past' }).click();
    await wizard.getByLabel(/Paste a sample of your prose/).fill(STYLE_SAMPLE);
    await wizard.getByRole('button', { name: 'Analyze style' }).click();
    await expect(wizard.getByTestId('style-profile')).toContainText('Sentences average');
    await wizard.getByRole('button', { name: 'Continue ›' }).click();

    // 3 — Cast: one manual seed + offline suggestion from pasted text.
    await wizard.getByRole('button', { name: '+ Add character' }).click();
    await wizard.getByLabel('Character 1 name').fill('Aelinor Vael');
    await wizard.getByLabel('Character 1 role').selectOption('Protagonist');
    await wizard.getByLabel('Character 1 note').fill('Queen in exile.');
    await wizard
      .getByLabel(/let the offline scanner suggest names/)
      .fill('Captain Brec met Maren Holt at the ferry. Captain Brec paid Maren Holt in salt.');
    await wizard.getByRole('button', { name: 'Suggest cast from this text' }).click();
    await expect(page.getByText(/characters? suggested/)).toBeVisible();
    await wizard.getByRole('button', { name: 'Continue ›' }).click();

    // 4 — World.
    await wizard.getByRole('button', { name: '+ Add place' }).click();
    await wizard.getByLabel('Place 1 name').fill('Pale Reach');
    await wizard.getByLabel('Place 1 type').selectOption('Port');
    await wizard.getByRole('button', { name: 'Continue ›' }).click();

    // 5 — Manuscript: auto chapter split preview + extraction toggle.
    await wizard.getByLabel('Manuscript text').fill(MANUSCRIPT);
    await expect(wizard.getByTestId('split-preview')).toContainText('2');
    await expect(wizard.getByTestId('split-preview')).toContainText('The Short Peal');
    await wizard.getByRole('button', { name: 'Continue ›' }).click();

    // 6 — AI & privacy: pick local-only.
    await wizard.getByRole('radio', { name: /Local-only/ }).click();
    await wizard.getByRole('button', { name: 'Continue ›' }).click();

    // 7 — Finish.
    await expect(wizard.getByTestId('finish-summary')).toContainText('2 chapter(s) will import');
    await wizard.getByRole('button', { name: 'Open the door', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'The Hollow Crown' })).toBeVisible();

    // Seeds all landed.
    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: /Aelinor Vael/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Maren Holt/ })).toBeVisible();
    await openNav(page, 'Locations');
    await expect(page.getByRole('button', { name: /Pale Reach/ })).toBeVisible();
    await openNav(page, "Writer's Room");
    const tabs = page.getByRole('tablist', { name: 'Chapters' });
    await expect(tabs.getByRole('tab', { name: /The Short Peal/ })).toBeVisible();
    await expect(tabs.getByRole('tab', { name: /Drovers/ })).toBeVisible();
    await expect(page.getByLabel('Manuscript body')).toContainText('two days ahead of the frost');
    await openNav(page, 'Review');
    await expect(page.locator('.lw-qcard').first()).toBeVisible();
    await openNav(page, 'References');
    await expect(page.getByRole('button', { name: /Story foundation/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Project brief \(AI context\)/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Style sample/ })).toBeVisible();

    // Local-only mode chosen in the wizard is live in Settings.
    await openNav(page, 'Settings');
    await expect(page.getByRole('checkbox', { name: /Local-only mode/ })).toBeChecked();

    // Everything survives reload.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'The Hollow Crown' })).toBeVisible();
    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: /Aelinor Vael/ })).toBeVisible();
  });

  test('AI prompt round-trip fills the whole interview from a pasted reply', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /Guided setup/ }).click();
    const wizard = page.getByTestId('onboarding-wizard');

    // Reveal the AI card and confirm the copyable prompt is a real prompt.
    await wizard.getByTestId('ob-ai-fill').getByRole('button', { name: 'Show' }).click();
    await expect(wizard.getByTestId('ob-ai-prompt')).toHaveValue(/Return ONLY a single JSON object/);

    // Paste a canned AI reply (as if from ChatGPT/Claude) and fill.
    const reply = JSON.stringify({
      name: 'The Salt Road',
      genre: ['Fantasy', 'Historical'],
      tone: ['Grounded'],
      premise: 'A smuggler must run one last cargo before the frost closes the pass.',
      themes: ['debt', 'loyalty'],
      pov: 'Third limited',
      tense: 'Past',
      cast: [{ name: 'Maren Holt', role: 'Protagonist', note: 'Runs the salt route.' }],
      places: [{ name: 'Vraska Pass', kind: 'Mountain Pass' }],
    });
    await wizard.getByLabel('AI reply').fill(`Here you go:\n\`\`\`json\n${reply}\n\`\`\``);
    await wizard.getByRole('button', { name: 'Fill from reply' }).click();
    await expect(page.getByText(/Filled \d+ sections? from the AI reply/)).toBeVisible();

    // Foundation fields populated, including both genres.
    await expect(wizard.getByLabel('Project name *')).toHaveValue('The Salt Road');
    await expect(wizard.getByLabel(/Premise/)).toHaveValue(/one last cargo/);
    const genre = wizard.getByRole('group', { name: 'Genre' });
    await expect(genre.getByRole('checkbox', { name: 'Fantasy' })).toBeChecked();
    await expect(genre.getByRole('checkbox', { name: 'Historical' })).toBeChecked();

    // Cast seed carried across to step 3.
    await wizard.getByRole('button', { name: /^3 / }).click();
    await expect(wizard.getByLabel('Character 1 name')).toHaveValue('Maren Holt');

    // And it genuinely builds the project.
    await wizard.getByRole('button', { name: /^7 / }).click();
    await wizard.getByRole('button', { name: 'Open the door', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'The Salt Road' })).toBeVisible();
    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: /Maren Holt/ })).toBeVisible();
    await openNav(page, 'Locations');
    await expect(page.getByRole('button', { name: /Vraska Pass/ })).toBeVisible();
  });

  test('closing the wizard keeps a draft — even across reload', async ({ page }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /Guided setup/ }).click();
    await page.getByLabel('Project name *').fill('Draft Book');
    await page.getByRole('button', { name: 'Close (draft is saved)' }).click();
    await expect(page.getByTestId('onboarding-wizard')).toBeHidden();

    await page.reload();
    await page.getByRole('button', { name: /Guided setup/ }).click();
    await expect(page.getByLabel('Project name *')).toHaveValue('Draft Book');
  });

  test('sample project: one click to explore, clean removal from the switcher', async ({
    page,
  }) => {
    await page.goto('./');
    await page.getByRole('button', { name: /Explore a sample project/ }).click();
    await expect(page.getByRole('heading', { name: 'Sample — The Hollow Crown' })).toBeVisible();

    await openNav(page, 'Cast');
    await expect(page.getByRole('button', { name: /Aelinor Vael/ })).toBeVisible();
    await openNav(page, 'Quests');
    await expect(page.getByRole('button', { name: /Reach the succession stone/ })).toBeVisible();
    await openNav(page, 'Review');
    await expect(page.locator('.lw-qcard').first()).toBeVisible();
    await openNav(page, "Writer's Room");
    await expect(page.getByLabel('Manuscript body')).toContainText('two days ahead of the frost');

    // Clean removal returns to the welcome gate.
    await page.getByRole('button', { name: /Sample — The Hollow Crown/ }).first().click();
    await page.getByRole('button', { name: /^Delete “Sample — The Hollow Crown”…$/ }).click();
    await page.getByRole('button', { name: 'Delete forever' }).click();
    await expect(page.getByRole('heading', { name: 'Welcome to Loomwright' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Welcome to Loomwright' })).toBeVisible();
  });

  test('per-surface help follows the current route', async ({ page }) => {
    await bootWithProject(page);
    await page.getByRole('button', { name: 'Help for this surface' }).click();
    const help = page.getByTestId('help-dialog');
    await expect(help).toContainText('Home — how it works');
    await help.getByRole('button', { name: 'Got it' }).click();
    await expect(help).toBeHidden();

    await openNav(page, "Writer's Room");
    await page.getByRole('button', { name: 'Help for this surface' }).click();
    await expect(page.getByTestId('help-dialog')).toContainText("Writer's Room — how it works");
  });
});

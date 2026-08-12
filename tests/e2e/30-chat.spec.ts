import { test, expect, type Page } from '@playwright/test';
import { bootWithProject, createCastMember, openNav } from './helpers';

// A conversation about the book, with the book attached. What matters:
// the chips are the payload and removing one removes it, a reply can be
// turned into prose or into verified codex data, and none of it needs a
// key — with no provider the whole conversation copies out and the reply
// comes back in.

const FAKE_KEY = 'sk-ant-e2e-fake';

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

async function openChat(page: Page, prose = 'Marrow poled the ferry across the water.') {
  await openNav(page, "Writer's Room");
  await page
    .getByRole('tablist', { name: 'Chapters' })
    .getByRole('button', { name: '+ New chapter' })
    .click();
  await page.getByLabel('Manuscript body').click();
  await page.keyboard.type(prose);
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-save-state', 'saved');
  await page.getByRole('button', { name: 'Chat', exact: true }).click();
  const dock = page.getByTestId('chat-dock');
  await expect(dock).toBeVisible();
  return dock;
}

test.describe('chat', () => {
  test('opens with a thread and this scene attached, and a chip can be removed', async ({
    page,
  }) => {
    await bootWithProject(page);
    const dock = await openChat(page);

    // A thread exists without anyone pressing New thread, and it starts
    // attached to the scene the author is in.
    await expect(dock.getByRole('button', { name: /Remove Scene: .* from this thread/ })).toBeVisible();

    await dock.getByRole('button', { name: /Remove Scene: .* from this thread/ }).click();
    await expect(
      dock.getByText('Nothing attached — the model is answering from your message alone.')
    ).toBeVisible();
  });

  test('+ Context attaches a codex type, and it survives a reload', async ({ page }) => {
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow', summary: 'A ferryman.' });
    let dock = await openChat(page);

    await dock.getByRole('button', { name: '+ Context' }).click();
    await dock.getByLabel('Add a codex type').selectOption('cast');
    await expect(dock.getByText('All cast')).toBeVisible();

    await page.reload();
    await openNav(page, "Writer's Room");
    await page.getByRole('button', { name: 'Chat', exact: true }).click();
    dock = page.getByTestId('chat-dock');
    await expect(dock.getByText('All cast')).toBeVisible();
  });

  test('with no key the conversation copies out and a pasted reply lands', async ({ page }) => {
    // The standing promise. Chat is not disabled without a provider — it
    // is the same conversation, run somewhere else.
    await bootWithProject(page);
    const dock = await openChat(page);

    await expect(dock.getByRole('button', { name: 'Send' })).toHaveCount(0);
    await dock.getByLabel('Message').fill('Who is the ferryman, and what does he want?');
    await dock.getByRole('button', { name: 'Copy conversation' }).click();

    // The prompt is shown as text, because the clipboard can refuse.
    const prompt = await dock.getByLabel('Prompt to send').inputValue();
    expect(prompt).toContain('Who is the ferryman');
    expect(prompt).toContain('MATERIAL FROM THE AUTHOR’S STORY');

    await dock.getByLabel('Paste the reply').fill('He wants the crossing kept open.');
    await dock.getByRole('button', { name: 'Add reply' }).click();

    await expect(dock.getByTestId('chat-user')).toContainText('Who is the ferryman');
    await expect(dock.getByTestId('chat-assistant')).toContainText('crossing kept open');
  });

  test('a mocked reply is recorded with what travelled, and can be inserted as prose', async ({
    page,
  }) => {
    await bootWithProject(page);
    await configureAnthropic(page);
    await mockAnthropic(page, 'He keeps the crossing open because nobody else will.');
    const dock = await openChat(page);

    await dock.getByLabel('Message').fill('What does Marrow want?');
    await dock.getByRole('button', { name: 'Send' }).click();
    // The privacy guard stands between a chat and the network, exactly as
    // it does between a beat and the network.
    await dock.getByTestId('privacy-guard').getByRole('button', { name: 'Send once' }).click();
    await expect(dock.getByTestId('chat-assistant')).toContainText('nobody else will');
    // Auditability: an author should never have to guess why a reply knew
    // something.
    await expect(dock.getByTestId('chat-user')).toContainText('Sent with: Scene:');

    await dock.getByRole('button', { name: 'Insert into scene' }).click();
    await expect(page.getByLabel('Manuscript body')).toContainText('nobody else will');

    // The page before an AI write is always recoverable.
    await dock.getByRole('button', { name: 'Close chat' }).click();
    await page.getByRole('button', { name: 'Scene', exact: true }).click();
    await expect(page.getByTestId('scene-panel').getByText('Before a chat insertion')).toBeVisible();
  });

  test('Send to codex runs the reply through the same verification a paste gets', async ({
    page,
  }) => {
    // Novelcrafter's Extract proposes entries. Ours goes through
    // `parseDeltaReply`, so a model cannot make the app write anything the
    // offline engine would not have written on its own.
    await bootWithProject(page);
    await createCastMember(page, { name: 'Marrow', summary: 'A ferryman.' });
    await configureAnthropic(page);
    await mockAnthropic(
      page,
      JSON.stringify({
        facts: [
          {
            kind: 'travel',
            character: 'Marrow',
            place: 'Pale Reach',
            quote: 'Marrow crossed to Pale Reach before dark.',
          },
        ],
      })
    );
    const dock = await openChat(page);

    await dock.getByLabel('Message').fill('Give me the facts as JSON.');
    await dock.getByRole('button', { name: 'Send' }).click();
    await dock.getByTestId('privacy-guard').getByRole('button', { name: 'Send once' }).click();
    await expect(dock.getByTestId('chat-assistant')).toContainText('Pale Reach');

    await dock.getByRole('button', { name: 'Send to codex' }).click();
    // The staged bar, not the toast: a toast is an announcement, the bar
    // is the app actually holding a cascade waiting to be accepted.
    await expect(page.getByText(/1 change to review — 1 new/)).toBeVisible();

    // On a phone the dock is a full-screen sheet over the nav, so close it
    // before navigating — as a reader would.
    await dock.getByRole('button', { name: 'Close chat' }).click();
    // It arrives as a cascade the engine built, not as text a model wrote:
    // the same propagation rules a local extraction goes through.
    await openNav(page, 'Review');
    await expect(page.getByText('Pale Reach').first()).toBeVisible();
  });

  test('a second thread is separate, and switching between them keeps each log', async ({
    page,
  }) => {
    await bootWithProject(page);
    const dock = await openChat(page);

    await dock.getByLabel('Message').fill('First question.');
    await dock.getByRole('button', { name: 'Copy conversation' }).click();
    await dock.getByLabel('Paste the reply').fill('First answer.');
    await dock.getByRole('button', { name: 'Add reply' }).click();
    await expect(dock.getByTestId('chat-assistant')).toContainText('First answer.');

    await dock.getByRole('button', { name: 'New thread' }).click();
    await expect(dock.getByTestId('chat-log')).toContainText('Ask about the story');

    // The first thread took its title from what was asked, which is how it
    // is findable again.
    await dock.getByLabel('Thread', { exact: true }).selectOption({ label: 'First question.' });
    await expect(dock.getByTestId('chat-assistant')).toContainText('First answer.');
  });
});

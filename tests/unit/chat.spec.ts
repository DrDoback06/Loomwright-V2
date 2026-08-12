import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import {
  addMessage,
  createThread,
  deleteThread,
  listMessages,
  listThreads,
  titleFrom,
  updateThread,
} from '@/db/repos/chat';
import { buildChatPrompt, chatSystemPrompt, recentHistory } from '@/services/ai/prompts/chat';
import { buildChatContext, describeContext } from '@/services/context/chat-context';
import type { ChatMessage, Scene } from '@/db/types';

const PROJECT = 'p-chat';

function scene(patch: Partial<Scene> = {}): Scene {
  return {
    id: 'sc1',
    projectId: PROJECT,
    chapterId: 'ch1',
    title: 'The ferry',
    order: 0,
    globalOrder: 0,
    doc: {},
    paragraphs: [{ id: 'p1', text: 'Marrow poled the ferry across.' }],
    wordCount: 5,
    summary: 'Marrow takes someone across.',
    summaryUpdatedAt: 0,
    status: 'draft',
    pov: null,
    povType: null,
    characterIds: [],
    locationId: null,
    attachedRefs: [],
    labels: [],
    targetWords: null,
    aiVisible: true,
    createdAt: 1,
    updatedAt: 1,
    ...patch,
  };
}

function msg(role: ChatMessage['role'], text: string, createdAt: number): ChatMessage {
  return { id: `m${createdAt}`, threadId: 't1', role, text, createdAt };
}

describe('chat threads', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('takes its title from the first thing the author said', async () => {
    const thread = await createThread(PROJECT);
    expect(thread.title).toBe('New thread');
    await addMessage(thread.id, 'user', 'Why does Marrow stay at the crossing?');
    const [stored] = await listThreads(PROJECT);
    expect(stored.title).toBe('Why does Marrow stay at the crossing?');
  });

  it('does not rename itself again on the second question', async () => {
    const thread = await createThread(PROJECT);
    await addMessage(thread.id, 'user', 'First question.');
    await addMessage(thread.id, 'assistant', 'An answer.');
    await addMessage(thread.id, 'user', 'A completely different second question.');
    const [stored] = await listThreads(PROJECT);
    expect(stored.title).toBe('First question.');
  });

  it('deleting a thread takes its messages with it', async () => {
    const thread = await createThread(PROJECT);
    await addMessage(thread.id, 'user', 'Something.');
    await addMessage(thread.id, 'assistant', 'Something back.');
    await deleteThread(thread.id);
    expect(await listMessages(thread.id)).toHaveLength(0);
    expect(await listThreads(PROJECT)).toHaveLength(0);
  });

  it('lists newest first, so the thread you just used is the one on top', async () => {
    const a = await createThread(PROJECT);
    const b = await createThread(PROJECT);
    await updateThread(a.id, { title: 'Older, then touched' });
    const [first] = await listThreads(PROJECT);
    expect(first.id).toBe(a.id);
    expect(first.id).not.toBe(b.id);
  });

  it('truncates a long first line rather than making an unreadable tab', () => {
    expect(titleFrom('x'.repeat(80))).toHaveLength(48);
    expect(titleFrom('  \n ')).toBe('New thread');
  });
});

describe('recentHistory', () => {
  const log = [
    msg('user', 'Q1', 1),
    msg('assistant', 'A1', 2),
    msg('user', 'Q2', 3),
    msg('assistant', 'A2', 4),
    msg('user', 'Q3', 5),
    msg('assistant', 'A3', 6),
  ];

  it('keeps the last N pairs, oldest first', () => {
    expect(recentHistory(log, 2).map((m) => m.text)).toEqual(['Q2', 'A2', 'Q3', 'A3']);
  });

  it('never leaves an answer with no question in front of it', () => {
    // Cutting by message count instead of by pair is how a model ends up
    // reading a reply to something it was never shown.
    const cut = recentHistory(log, 1);
    expect(cut[0].role).toBe('user');
    expect(cut.map((m) => m.text)).toEqual(['Q3', 'A3']);
  });

  it('sends nothing when the thread carries no memory', () => {
    expect(recentHistory(log, 0)).toEqual([]);
  });
});

describe('buildChatPrompt', () => {
  it('leaves the material heading out entirely when nothing is attached', () => {
    const prompt = buildChatPrompt({ mode: 'free', context: '', history: [], message: 'Hello.' });
    expect(prompt).not.toContain('MATERIAL FROM');
    expect(prompt).toContain('Hello.');
  });

  it('labels the turns so a copied conversation reads as one', () => {
    const prompt = buildChatPrompt({
      mode: 'free',
      context: '- Cast Marrow',
      history: [{ role: 'user', text: 'Q' }, { role: 'assistant', text: 'A' }],
      message: 'And then?',
    });
    expect(prompt).toContain('MATERIAL FROM THE AUTHOR’S STORY:');
    expect(prompt).toContain('Author: Q');
    expect(prompt).toContain('You: A');
    expect(prompt.trimEnd().endsWith('And then?')).toBe(true);
  });

  it('every mode forbids inventing canon', () => {
    for (const mode of ['brainstorm', 'ask-the-codex', 'editor', 'continuity', 'free'] as const) {
      expect(chatSystemPrompt(mode)).toContain('Never invent names');
    }
  });
});

describe('buildChatContext', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('sends nothing at all when no chip is attached', async () => {
    expect((await buildChatContext(PROJECT, [])).text).toBe('');
  });

  it('a codex-type chip carries every live entry of that type', async () => {
    await createEntity({ projectId: PROJECT, type: 'cast', name: 'Marrow', summary: 'A ferryman.' });
    await createEntity({ projectId: PROJECT, type: 'cast', name: 'Vex', summary: 'A courier.' });
    await createEntity({ projectId: PROJECT, type: 'locations', name: 'Pale Reach' });

    const ctx = await buildChatContext(PROJECT, [
      { kind: 'codex-type', id: 'cast', label: 'All cast' },
    ]);
    expect(ctx.text).toContain('Marrow');
    expect(ctx.text).toContain('Vex');
    expect(ctx.text).not.toContain('Pale Reach');
  });

  it('a scene chip carries the assembled context AND the prose', async () => {
    await createEntity({ projectId: PROJECT, type: 'cast', name: 'Marrow', summary: 'A ferryman.' });
    await db.scenes.add(scene());
    const ctx = await buildChatContext(PROJECT, [
      { kind: 'scene', id: 'sc1', label: 'Scene: The ferry' },
    ]);
    expect(ctx.text).toContain('A ferryman.');
    expect(ctx.text).toContain('Marrow poled the ferry across.');
  });

  it('the outline chip omits a scene the author hid from models', async () => {
    await db.scenes.bulkAdd([
      scene({ id: 'sc1', globalOrder: 0, title: 'Open' }),
      scene({ id: 'sc2', globalOrder: 1, title: 'A note to self', aiVisible: false }),
    ]);
    const ctx = await buildChatContext(PROJECT, [
      { kind: 'outline', id: '', label: 'The outline' },
    ]);
    expect(ctx.text).toContain('Open');
    expect(ctx.text).not.toContain('A note to self');
  });

  it('"the story so far" stops at the latest attached scene, not at the end of the book', async () => {
    // Otherwise attaching scene two and asking what has happened hands the
    // model the ending.
    await db.scenes.bulkAdd([
      scene({ id: 'sc1', globalOrder: 0, title: 'One', summary: 'Vex leaves the city.' }),
      scene({ id: 'sc2', globalOrder: 1, title: 'Two', summary: 'The road climbs.' }),
      scene({ id: 'sc3', globalOrder: 2, title: 'Three', summary: 'She reaches the pass at last.' }),
    ]);
    const ctx = await buildChatContext(PROJECT, [
      { kind: 'scene', id: 'sc2', label: 'Scene: Two' },
      { kind: 'story-so-far', id: '', label: 'The story so far' },
    ]);
    const soFar = ctx.text.split('THE STORY SO FAR:')[1] ?? '';
    expect(soFar).toContain('Vex leaves the city.');
    expect(soFar).not.toContain('reaches the pass');
  });

  it('a removed chip is genuinely absent from the payload', async () => {
    await createEntity({ projectId: PROJECT, type: 'cast', name: 'Marrow', summary: 'A ferryman.' });
    const withIt = await buildChatContext(PROJECT, [
      { kind: 'codex-type', id: 'cast', label: 'All cast' },
    ]);
    expect(withIt.text).toContain('Marrow');
    expect((await buildChatContext(PROJECT, [])).text).toBe('');
  });
});

describe('describeContext', () => {
  it('names what travelled, so a reply never has to be explained after the fact', () => {
    expect(
      describeContext([
        { kind: 'scene', id: 'sc1', label: 'Scene: The ferry' },
        { kind: 'codex-type', id: 'cast', label: 'All cast' },
      ])
    ).toBe('Scene: The ferry · All cast');
    expect(describeContext([])).toBe('nothing attached');
  });
});

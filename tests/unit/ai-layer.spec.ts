import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { extractJsonBlock, mapAiPayload } from '@/services/ai/ai-candidates';
import { importHandoffResponse, buildHandoffPack } from '@/services/ai/handoff';
import { clearApiKey, getApiKey, hasApiKey, saveApiKey } from '@/services/crypto/keys';
import type { KnownEntity } from '@/services/extraction/known-index';

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

const KNOWN: KnownEntity[] = [
  { id: 'aelinor', type: 'cast', name: 'Aelinor', aliases: ['Ael'] },
  { id: 'auger', type: 'items', name: 'Auger of Hess', aliases: [] },
];

describe('AI key vault', () => {
  it('round-trips an API key through AES-GCM encryption', async () => {
    await saveApiKey('anthropic', 'sk-ant-test-123');
    expect(await hasApiKey('anthropic')).toBe(true);
    expect(await getApiKey('anthropic')).toBe('sk-ant-test-123');

    // The ciphertext row never contains the plaintext.
    const row = await db.keys.get('anthropic');
    const blob = JSON.stringify(row);
    expect(blob).not.toContain('sk-ant-test-123');

    await clearApiKey('anthropic');
    expect(await getApiKey('anthropic')).toBeNull();
  });
});

describe('AI payload parsing', () => {
  it('extracts JSON from fenced and prose-wrapped replies', () => {
    expect(extractJsonBlock('Here you go:\n```json\n{"characters":[{"name":"Maren"}]}\n```')).toEqual({
      characters: [{ name: 'Maren' }],
    });
    expect(extractJsonBlock('Sure! {"items":[{"name":"Salt Lantern"}]} Hope that helps.')).toEqual({
      items: [{ name: 'Salt Lantern' }],
    });
    expect(extractJsonBlock('no json here')).toBeNull();
  });

  it('maps unknown names to create candidates and known names to updates', () => {
    const out = mapAiPayload(
      {
        characters: [
          { name: 'Maren', role: 'smuggler', traits: ['wry'] },
          { name: 'Aelinor', summary: 'Now queen in exile.' },
        ],
        items: [{ name: 'Auger of Hess', owner: 'Aelinor' }],
        relationships: [{ from: 'Ael', to: 'Maren', type: 'ally' }],
      },
      [...KNOWN, { id: 'maren', type: 'cast', name: 'Maren-Existing', aliases: [] }],
      'ai'
    );
    const maren = out.find((c) => c.name === 'Maren');
    expect(maren?.suggestedAction).toBe('create');
    expect(maren?.suggestedChanges).toMatchObject({ role: 'smuggler' });

    const aelinor = out.find((c) => c.name === 'Aelinor');
    expect(aelinor?.suggestedAction).toBe('update');
    expect(aelinor?.existingEntityId).toBe('aelinor');

    const auger = out.find((c) => c.name === 'Auger of Hess');
    expect(auger?.suggestedAction).toBe('update');
    expect(auger?.suggestedChanges).toMatchObject({
      currentOwner: { id: 'aelinor', type: 'cast', name: 'Aelinor' },
    });

    // Relationship resolves the alias 'Ael' → Aelinor; 'Maren' fuzzy-hits
    // Maren-Existing at ≥0.9? ('maren' vs 'maren-existing' similarity is low)
    // so no relationship lands unless both resolve.
    const rel = out.find((c) => c.entityType === 'relationships');
    expect(rel).toBeUndefined();
  });
});

describe('handoff', () => {
  it('pack embeds known names and the chapter text', () => {
    const pack = buildHandoffPack({
      projectName: 'The Hollow Crown',
      known: KNOWN,
      chapter: { title: 'Ch 1', paragraphs: [{ id: 'p1', text: 'Aelinor walked the wall.' }] },
    });
    expect(pack).toContain('Known cast: Aelinor');
    expect(pack).toContain('Aelinor walked the wall.');
    expect(pack).toContain('"relationships"');
  });

  it('paste-back lands candidates in the pending queue with dedupe', async () => {
    const projectId = 'p1';
    const reply = 'Result: {"characters":[{"name":"Maren","summary":"A smuggler."}]}';
    const first = await importHandoffResponse(projectId, reply, KNOWN);
    expect(first).toEqual({ added: 1 });
    const second = await importHandoffResponse(projectId, reply, KNOWN);
    expect(second).toEqual({ added: 0 }); // deduped against pending
    const pending = await db.candidates.where('[projectId+status]').equals([projectId, 'pending']).toArray();
    expect(pending).toHaveLength(1);
    expect(pending[0].source).toBe('handoff');
    const bad = await importHandoffResponse(projectId, 'nope', KNOWN);
    expect('error' in bad).toBe(true);
  });
});

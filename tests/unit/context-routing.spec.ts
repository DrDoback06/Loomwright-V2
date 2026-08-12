import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { entityWireString } from '@/services/generate/serialize';
import { buildProseBrief } from '@/services/ai/prompts/prose';
import { AI_POLICY_KEY, DEFAULT_AI_POLICY } from '@/domain/ai-policy';

const PROJECT = 'p-route';

/** Step 7's whole claim: every AI path is fed by one assembler, and the
 * per-field gate reaches the paths that bypass it. */
describe('one context block, one rendering', () => {
  it('buildProseBrief renders the assembled block verbatim', () => {
    const context = '- Character Marrow — A ferryman.';
    const brief = buildProseBrief({
      mode: 'scene',
      pov: 'third limited',
      tense: 'past',
      length: 'a few paragraphs',
      instruction: 'They meet at the water.',
      context,
    });
    expect(brief).toContain(context);
    // One heading, not two — beats and rewrites used to render their own.
    expect(brief.match(/WHO AND WHAT IS IN THIS PASSAGE/g)).toHaveLength(1);
  });

  it('says nothing at all when there is no context', () => {
    const brief = buildProseBrief({
      mode: 'scene',
      pov: 'third limited',
      tense: 'past',
      length: 'a few paragraphs',
      instruction: 'x',
      context: '',
    });
    expect(brief).not.toContain('WHO AND WHAT');
  });
});

describe('Copy AI prompt honours the per-field gate', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
  });

  it('withholds a hidden field from the prompt and keeps it in the export', async () => {
    // Two buttons, two jobs. Filtering the data export would make it
    // silently lossy, which is a worse bug than an over-sharing prompt.
    const entity = await createEntity({
      projectId: PROJECT,
      type: 'cast',
      name: 'Vex',
      fields: { personality: 'Guarded', physicalDescription: 'Green eyes, always noted.' },
    });

    expect(entityWireString(entity, { forPrompt: true })).not.toContain('Green eyes');
    expect(entityWireString(entity, { forPrompt: true })).toContain('Guarded');
    // Copy as JSON — unfiltered.
    expect(entityWireString(entity)).toContain('Green eyes');
  });

  it('follows a per-entity override in the prompt path', async () => {
    const entity = await createEntity({
      projectId: PROJECT,
      type: 'cast',
      name: 'Ruth',
      fields: {
        physicalDescription: 'A scar through one brow.',
        [AI_POLICY_KEY]: { ...DEFAULT_AI_POLICY, fieldVisibility: { physicalDescription: true } },
      },
    });
    expect(entityWireString(entity, { forPrompt: true })).toContain('A scar through one brow.');
  });
});

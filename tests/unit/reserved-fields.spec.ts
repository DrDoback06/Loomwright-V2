import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { saveEntityTemplate } from '@/services/templates';
import { renderWorldBible } from '@/services/archive/world-bible';
import { buildMergePreview } from '@/db/repos/merge';
import { AI_POLICY_KEY, DEFAULT_AI_POLICY } from '@/domain/ai-policy';

const PROJECT = 'p-reserved';

/** The AI policy is settings, not authored content. It must never surface
 * anywhere a human reads their own writing back. */
describe('reserved field keys stay out of human-facing surfaces', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    await db.projects.add({
      id: PROJECT,
      name: 'Reserved',
      createdAt: 1,
      updatedAt: 1,
    } as never);
  });

  async function seed() {
    return createEntity({
      projectId: PROJECT,
      type: 'cast',
      name: 'Grimguff',
      summary: 'A man with a clipboard.',
      fields: {
        personality: 'Weary',
        [AI_POLICY_KEY]: { ...DEFAULT_AI_POLICY, context: 'never', exclusions: ['the Reach'] },
      },
    });
  }

  it('does not ride into a template', async () => {
    // Otherwise one entity's tracking settings land on every entity ever
    // created from that template.
    const template = await saveEntityTemplate(PROJECT, await seed(), 'Bureaucrat');
    expect(template.fields).toHaveProperty('personality');
    expect(template.fields).not.toHaveProperty(AI_POLICY_KEY);
  });

  it('does not become a merge conflict row', async () => {
    // `MergePreviewDialog` renders an unrecognised object with
    // `JSON.stringify`, so an unfiltered policy shows up as raw JSON under a
    // heading reading " ai" — and asks the author to pick between two of them.
    const target = await seed();
    const other = await createEntity({
      projectId: PROJECT,
      type: 'cast',
      name: 'Grimguff Hendricks',
      summary: 'The same man, filed twice.',
      fields: {
        personality: 'Tired',
        [AI_POLICY_KEY]: { ...DEFAULT_AI_POLICY, context: 'always' },
      },
    });
    const preview = await buildMergePreview({
      entityType: 'cast',
      sourceEntityIds: [other.id],
      targetEntityId: target.id,
    });
    const keys = preview.fields.map((f) => f.key);
    expect(keys).toContain('personality');
    expect(keys).not.toContain(AI_POLICY_KEY);
    // The synthetic summary row is pushed outside the fields loop and must
    // survive the prefix skip.
    expect(keys).toContain('__summary');
  });

  it('does not appear in the world bible export', async () => {
    // This one passes today by accident — `renderValue` returns '' for an
    // object with no `.name`, so the row is dropped rather than skipped.
    // The test states the intent, so a future edit to `renderValue` cannot
    // leak the policy into a shareable document without going red.
    await seed();
    const { markdown } = await renderWorldBible(PROJECT);
    expect(markdown).toContain('Grimguff');
    expect(markdown).not.toContain(AI_POLICY_KEY);
    expect(markdown.toLowerCase()).not.toContain('the reach');
  });
});

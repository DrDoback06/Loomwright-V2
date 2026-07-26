import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import {
  dismissSuggestion,
  listSuggestionsFor,
  markSuggestionAccepted,
  pruneSuggestions,
} from '@/db/repos/suggestions';
import type { Entity, SkillTree } from '@/db/types';
import type { EntityType } from '@/domain/entity-types';
import { applyDelta } from '@/services/intelligence/apply';
import { buildStoryDelta } from '@/services/intelligence/engine';
import { suggestForSkill, suggestFromRelationshipWeb } from '@/services/intelligence/suggestions';
import { emptyDelta, type SuggestionRecord } from '@/services/intelligence/types';

let seq = 0;
function entity(type: EntityType, name: string, fields: Record<string, unknown> = {}): Entity {
  seq++;
  return {
    id: `${type}-${name.toLowerCase().replace(/\s+/g, '-')}`,
    projectId: 'p1',
    type,
    name,
    aliases: [],
    summary: '',
    status: 'active',
    tags: [],
    fields,
    createdAt: seq,
    updatedAt: seq,
  };
}

describe('intelligence/suggestions — finished cards, not open questions', () => {
  it('proposes a next tier that carries a real drafted skill, not a stub', () => {
    const ref = { id: 'skills-venom-strike', type: 'skills' as const, name: 'Venom Strike' };
    const out = suggestForSkill('Venom Strike', ref, 'balanced');

    const next = out.find((s) => s.kind === 'skill-next-tier');
    expect(next?.title).toBe('Venom Strike II');
    expect(next?.body.length).toBeGreaterThan(10);
    // Accepting it must create a filled entity, so the payload carries a draft.
    expect(next?.payload?.entities?.[0]?.draft.name).toBe('Venom Strike II');
    expect(next?.payload?.entities?.[0]?.draft.fields.effects).toBeTruthy();
  });

  it('respects the volume slider', () => {
    const ref = { id: 's1', type: 'skills' as const, name: 'Venom Strike' };
    expect(suggestForSkill('Venom Strike', ref, 'quiet')).toHaveLength(1);
    expect(suggestForSkill('Venom Strike', ref, 'balanced').length).toBeLessThanOrEqual(3);
    expect(suggestForSkill('Venom Strike', ref, 'abundant').length).toBeLessThanOrEqual(6);
  });

  it('is stable across runs so the same skill never reshuffles its cards', () => {
    const ref = { id: 's1', type: 'skills' as const, name: 'Venom Strike' };
    const a = suggestForSkill('Venom Strike', ref, 'balanced').map((s) => s.title);
    const b = suggestForSkill('Venom Strike', ref, 'balanced').map((s) => s.title);
    expect(a).toEqual(b);
  });

  it('reads the relationship web for who else could learn it and what arcs are live', () => {
    const vex = entity('cast', 'Vex');
    const marrow = entity('cast', 'Marrow');
    const kell = entity('cast', 'Kell');
    const ally = entity('relationships', 'Vex → Marrow', {
      from: { id: vex.id, type: 'cast', name: 'Vex' },
      to: { id: marrow.id, type: 'cast', name: 'Marrow' },
      bondType: 'ally',
    });
    const foe = entity('relationships', 'Vex → Kell', {
      from: { id: vex.id, type: 'cast', name: 'Vex' },
      to: { id: kell.id, type: 'cast', name: 'Kell' },
      bondType: 'enemy',
    });

    const out = suggestFromRelationshipWeb(vex, [vex, marrow, kell, ally, foe], 'abundant', {
      learnedSkill: 'Venom Strike',
    });

    const teach = out.find((s) => s.kind === 'cast-candidate');
    expect(teach?.title).toContain('Marrow');
    const arc = out.find((s) => s.kind === 'story-arc');
    expect(arc?.title).toContain('Kell');
    expect(arc?.body).toContain('Venom Strike');
  });

  it('rides along on a skill-learned cascade rather than forming its own group', () => {
    const vex = entity('cast', 'Vex');
    const trees: SkillTree[] = [];
    const delta = buildStoryDelta({
      projectId: 'p1',
      text: 'Vex learned Venom Strike that winter.',
      entities: [vex],
      trees,
      volume: 'balanced',
    });

    expect(delta.suggestions.length).toBeGreaterThan(0);
    const group = delta.groups.find((g) => g.headline.includes('Venom Strike'));
    for (const s of delta.suggestions) {
      expect(group?.unitIds).toContain(s.unitId);
    }
  });

  it('stays silent on quiet when nothing was learned', () => {
    const aelinor = entity('cast', 'Aelinor');
    const pass = entity('locations', 'Vraska Pass');
    const delta = buildStoryDelta({
      projectId: 'p1',
      text: 'Aelinor crossed Vraska Pass at first light.',
      entities: [aelinor, pass],
      trees: [],
      volume: 'quiet',
    });
    expect(delta.suggestions).toHaveLength(0);
  });
});

/** A minimal inbox row; only the fields these tests assert on vary. */
function row(
  id: string,
  targetEntityId: string,
  status: SuggestionRecord['status'],
  createdAt: number
): SuggestionRecord {
  return {
    id,
    projectId: 'p1',
    kind: 'story-arc',
    targetRef: null,
    targetEntityId,
    title: id,
    body: '…',
    payload: null,
    source: 'local',
    status,
    createdAt,
  };
}

describe('suggestions inbox', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('lists only pending suggestions for the entity they hang off', async () => {
    const vex = await createEntity({ projectId: 'p1', type: 'cast', name: 'Vex' });
    const other = await createEntity({ projectId: 'p1', type: 'cast', name: 'Marrow' });

    await db.suggestions.bulkAdd([
      row('s1', vex.id, 'pending', 1),
      row('s2', other.id, 'pending', 2),
      row('s3', vex.id, 'dismissed', 3),
    ]);

    const listed = await listSuggestionsFor('p1', vex.id);
    expect(listed.map((r) => r.id)).toEqual(['s1']);
  });

  it('accepting a payload suggestion creates the entity with one undoable audit entry', async () => {
    const delta = {
      ...emptyDelta('d1', 'p1', 'local'),
      entities: [
        {
          unitId: 'u1',
          confidence: 0.66,
          confidenceBand: 'orange' as const,
          sourceQuote: '',
          origin: 'suggestions',
          draft: {
            localId: 'l1',
            type: 'skills' as const,
            name: 'Venom Strike II',
            aliases: [],
            summary: '',
            tags: [],
            fields: { skillType: 'active' },
          },
        },
      ],
      createdAt: 1,
    };
    const result = await applyDelta(delta);
    expect(result.created).toHaveLength(1);
    const entry = await db.auditLog.get(result.auditId);
    expect(entry?.reversible).toBe(true);
  });

  it('prunes only resolved rows once a project runs over the cap', async () => {
    const rows: SuggestionRecord[] = [];
    for (let i = 0; i < 260; i++) {
      // First 60 resolved, rest pending.
      rows.push(row(`s${i}`, '', i < 60 ? 'dismissed' : 'pending', i));
    }
    await db.suggestions.bulkAdd(rows);

    const pruned = await pruneSuggestions('p1');
    expect(pruned).toBe(60);
    const left = await db.suggestions.where('projectId').equals('p1').toArray();
    // Pending work is never thrown away, even over the cap.
    expect(left.every((r) => r.status === 'pending')).toBe(true);
    expect(left).toHaveLength(200);
  });

  it('dismiss and accept move a row out of the inbox', async () => {
    const vex = await createEntity({ projectId: 'p1', type: 'cast', name: 'Vex' });
    await db.suggestions.bulkAdd([
      row('a', vex.id, 'pending', 1),
      row('b', vex.id, 'pending', 2),
    ]);

    await dismissSuggestion('a');
    await markSuggestionAccepted('b');
    expect(await listSuggestionsFor('p1', vex.id)).toHaveLength(0);
  });
});

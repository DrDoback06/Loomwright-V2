import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { undoAuditEntry } from '@/db/repos/undo';
import {
  dismissSuggestion,
  listSuggestions,
  listSuggestionsFor,
  markSuggestionAccepted,
  saveSuggestions,
} from '@/db/repos/suggestions';
import { applyDelta } from '@/services/intelligence/apply';
import { generateWorldSuggestions } from '@/services/intelligence/suggest';
import { buildWorldDigest } from '@/services/intelligence/digest';
import { extractWholeText } from '@/services/intelligence/intake';
import { buildMegaPrompt, importMegaResponse } from '@/services/intelligence/megaprompt';
import { emptyDelta, type StoryDelta, type SuggestionDraft } from '@/services/intelligence/types';
import type { Entity, EntityStatus } from '@/db/types';
import type { EntityType } from '@/domain/entity-types';

function ent(type: EntityType, name: string, fields: Record<string, unknown> = {}): Entity {
  return {
    id: `${type}:${name}`, projectId: 'p1', type, name, aliases: [], summary: '',
    status: 'active' as EntityStatus, tags: [], fields, createdAt: 0, updatedAt: 0,
  };
}

function delta(over: Partial<StoryDelta>): StoryDelta {
  return { ...emptyDelta('d1', 'p1', 'local', 1), ...over };
}

describe('intelligence/applyDelta + undo', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('applies creates + replace/append field patches as one reversible unit', async () => {
    const owner = await createEntity({ projectId: 'p1', type: 'cast', name: 'Mara' });
    const amulet = await createEntity({
      projectId: 'p1',
      type: 'items',
      name: 'Bone Amulet',
      fields: {
        currentOwner: { id: 'old', type: 'cast', name: 'Old Owner' },
        ownershipHistory: 'Made by the vault-smith.',
      },
    });

    const d = delta({
      entities: [
        { localId: 'l1', type: 'locations', name: 'Vraska Town', aliases: [], summary: 'A town.', tags: [], fields: {} },
      ],
      patches: [
        {
          entityId: amulet.id, entityType: 'items', entityName: 'Bone Amulet',
          field: 'currentOwner', mode: 'replace',
          before: { id: 'old', type: 'cast', name: 'Old Owner' },
          after: { id: owner.id, type: 'cast', name: 'Mara' },
          confidence: 0.8, reason: 'Vex handed the amulet to Mara.',
        },
        {
          entityId: amulet.id, entityType: 'items', entityName: 'Bone Amulet',
          field: 'ownershipHistory', mode: 'append',
          before: 'Made by the vault-smith.', after: 'Handed to Mara in the harbour.',
          confidence: 0.8, reason: '',
        },
        {
          entityId: amulet.id, entityType: 'items', entityName: 'Bone Amulet',
          field: 'status', mode: 'replace',
          before: undefined, after: 'carried', confidence: 0.7, reason: '',
        },
      ],
    });

    const result = await applyDelta(d);
    expect(result.created).toHaveLength(1);
    expect(result.updated.some((r) => r.id === amulet.id)).toBe(true);

    const patched = (await db.entities.get(amulet.id))!;
    expect(patched.fields.currentOwner).toEqual({ id: owner.id, type: 'cast', name: 'Mara' });
    expect(patched.fields.ownershipHistory).toBe('Made by the vault-smith.\nHanded to Mara in the harbour.');
    expect(patched.fields.status).toBe('carried');
    expect(await db.entities.where('[projectId+name]').equals(['p1', 'Vraska Town']).count()).toBe(1);

    // One Undo reverts the create AND restores every patched field.
    expect(await undoAuditEntry(result.auditId)).toBe(true);
    const restored = (await db.entities.get(amulet.id))!;
    expect(restored.fields.currentOwner).toEqual({ id: 'old', type: 'cast', name: 'Old Owner' });
    expect(restored.fields.ownershipHistory).toBe('Made by the vault-smith.');
    expect(restored.fields.status).toBeUndefined();
    expect(await db.entities.where('[projectId+name]').equals(['p1', 'Vraska Town']).count()).toBe(0);
  });

  it('appends to an array field and keeps unrelated fields intact', async () => {
    const vex = await createEntity({
      projectId: 'p1',
      type: 'cast',
      name: 'Vex',
      fields: { skills: [{ id: 's0', type: 'skills', name: 'Pickpocket' }], role: 'Antagonist' },
    });
    const d = delta({
      patches: [
        {
          entityId: vex.id, entityType: 'cast', entityName: 'Vex',
          field: 'skills', mode: 'append',
          before: undefined, after: { id: 's1', type: 'skills', name: 'Venom Strike' },
          confidence: 0.75, reason: 'Vex learned Venom Strike.',
        },
      ],
    });
    const result = await applyDelta(d);
    const patched = (await db.entities.get(vex.id))!;
    expect(patched.fields.skills).toHaveLength(2);
    expect((patched.fields.skills as { name: string }[])[1].name).toBe('Venom Strike');
    expect(patched.fields.role).toBe('Antagonist');

    await undoAuditEntry(result.auditId);
    const restored = (await db.entities.get(vex.id))!;
    expect(restored.fields.skills).toHaveLength(1);
  });
});

describe('intelligence/suggestions inbox', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('saves pending suggestions, dedupes, lists per-entity, accepts and dismisses', async () => {
    const targetRef = { id: 'c1', type: 'cast' as const, name: 'Vex' };
    const drafts: SuggestionDraft[] = [
      { targetRef, kind: 'skill-sibling', title: 'Venom Strike II', detail: 'Coating spreads.', source: 'local', confidence: 0.7 },
      { targetRef, kind: 'arc', title: 'A rival awakens', source: 'local', confidence: 0.6 },
      { targetRef, kind: 'skill-sibling', title: 'venom strike ii', source: 'local', confidence: 0.7 }, // case-insensitive dup
    ];
    const saved = await saveSuggestions('p1', drafts);
    expect(saved).toHaveLength(2);

    const pending = await listSuggestions('p1');
    expect(pending).toHaveLength(2);
    expect(pending.every((s) => s.status === 'pending' && s.source === 'local')).toBe(true);
    expect(await listSuggestionsFor('p1', 'c1')).toHaveLength(2);

    // Re-saving the same drafts adds nothing (still deduped vs pending).
    expect(await saveSuggestions('p1', drafts)).toHaveLength(0);

    await dismissSuggestion(pending[0].id);
    expect(await listSuggestions('p1')).toHaveLength(1);
    const accepted = await markSuggestionAccepted(pending[1].id);
    expect(accepted?.status).toBe('accepted');
    expect(await listSuggestions('p1', 'accepted')).toHaveLength(1);
    // Dossier chips only surface pending suggestions.
    expect(await listSuggestionsFor('p1', 'c1')).toHaveLength(0);
  });
});

describe('intelligence/world suggestions', () => {
  const rows: Entity[] = [
    ent('skills', 'Venom Strike', { skillType: 'active' }),
    ent('quests', 'The Long Road', { status: 'active' }),
    ent('cast', 'Aelinor'),
    ent('cast', 'Brann'),
    ent('relationships', 'Aelinor → Brann', {
      from: { id: 'cast:Aelinor', type: 'cast', name: 'Aelinor' },
      to: { id: 'cast:Brann', type: 'cast', name: 'Brann' },
      bondType: 'rivalry',
    }),
  ];

  it('generates skill siblings, quest outcomes, and relationship arcs — each with a payload', () => {
    const all = generateWorldSuggestions({ projectId: 'p1', entities: rows }, 'abundant');
    expect(all.some((s) => s.kind === 'skill-sibling')).toBe(true);
    expect(all.some((s) => s.kind === 'quest-outcome')).toBe(true);
    expect(all.some((s) => s.kind === 'arc')).toBe(true);
    // Every suggestion is concrete — it carries a ready-to-apply delta.
    expect(all.every((s) => (s.payload?.entities.length ?? 0) > 0)).toBe(true);
    // The skill sibling creates "<name> II".
    const sibling = all.find((s) => s.kind === 'skill-sibling')!;
    expect(sibling.payload?.entities[0].name).toBe('Venom Strike II');
  });

  it('the volume setting caps how many fire', () => {
    const many = Array.from({ length: 20 }, (_, i) => ent('skills', `Skill ${i}`));
    expect(generateWorldSuggestions({ projectId: 'p1', entities: many }, 'quiet').length).toBeLessThanOrEqual(3);
    expect(generateWorldSuggestions({ projectId: 'p1', entities: many }, 'balanced').length).toBeLessThanOrEqual(8);
    expect(generateWorldSuggestions({ projectId: 'p1', entities: many }, 'abundant').length).toBeLessThanOrEqual(20);
  });

  it("doesn't re-suggest a sibling that already exists", () => {
    const withSibling = [...rows, ent('skills', 'Venom Strike II')];
    const all = generateWorldSuggestions({ projectId: 'p1', entities: withSibling }, 'abundant');
    // No suggestion re-creates the existing "Venom Strike II".
    expect(all.some((s) => s.payload?.entities[0]?.name === 'Venom Strike II')).toBe(false);
  });
});

describe('intelligence/world digest', () => {
  it('renders id-free sections and deepens with depth', () => {
    const rows: Entity[] = [
      ent('cast', 'Aelinor', { role: 'Queen', currentLocation: { id: 'loc1', type: 'locations', name: 'Vraska' } }),
      ent('locations', 'Vraska Town', { parentId: { id: 'loc0', type: 'locations', name: 'Vraska' } }),
      ent('items', 'Bone Amulet', { currentOwner: { id: 'cst1', type: 'cast', name: 'Aelinor' } }),
      ent('relationships', 'Aelinor → Brann', {
        from: { id: 'cst1', type: 'cast', name: 'Aelinor' },
        to: { id: 'cst2', type: 'cast', name: 'Brann' },
        bondType: 'rivalry',
      }),
    ];
    const lean = buildWorldDigest(rows, 'lean');
    expect(lean).toContain('Aelinor');
    expect(lean).not.toContain('role: Queen');

    const std = buildWorldDigest(rows, 'standard');
    expect(std).toContain('role: Queen');
    expect(std).toContain('held by Aelinor');
    expect(std).toContain('inside Vraska');

    const full = buildWorldDigest(rows, 'full');
    expect(full).toContain('Aelinor → Brann');
    // Never leaks internal ids.
    expect(full).not.toContain('loc1');
    expect(full).not.toContain('cst1');
  });
});

describe('intelligence/whole-book intake', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('chunks a long text, dedupes across chunks, and queues candidates with progress', async () => {
    const known = [{ id: 'c1', type: 'cast' as const, name: 'Aelinor', aliases: [] }];
    // Maren appears in varied mid-sentence contexts so NER discovers her.
    const text = 'The guards watched Maren cross the bridge. Everyone feared Maren that winter. '.repeat(90); // > 5000 chars → many chunks
    const progress: number[] = [];
    const result = await extractWholeText('p1', text, known, (p) => progress.push(p.chunk));

    expect(result.chunks).toBeGreaterThan(1);
    expect(progress.length).toBe(result.chunks);
    expect(result.added).toBeGreaterThan(0);
    const pending = await db.candidates.where('[projectId+status]').equals(['p1', 'pending']).toArray();
    // "Maren" appears in every chunk but is queued once (deduped).
    expect(pending.filter((c) => c.name.toLowerCase().includes('maren'))).toHaveLength(1);
  });
});

describe('intelligence/mega-prompt round-trip', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear())); 
  });

  it('builds a digest+schema prompt and imports facts + suggestions from a reply', async () => {
    const rows: Entity[] = [ent('cast', 'Aelinor'), ent('skills', 'Venom Strike')];
    const prompt = buildMegaPrompt({ projectName: 'The Hollow Crown', entities: rows, depth: 'standard' });
    expect(prompt).toContain('World digest');
    expect(prompt).toContain('suggestions');

    const known = [{ id: rows[0].id, type: 'cast' as const, name: 'Aelinor', aliases: [] }];
    const reply = JSON.stringify({
      locations: [{ name: 'Vraska Pass', kind: 'pass', summary: 'A cold road.' }],
      suggestions: [{ kind: 'arc', title: 'Aelinor faces her exile', detail: 'A reckoning at the border.', about: 'Aelinor' }],
    });
    const result = await importMegaResponse('p1', reply, known, rows);
    if ('error' in result) throw new Error(result.error);
    expect(result.facts).toBeGreaterThan(0);
    expect(result.suggestions).toBe(1);
    // The suggestion targets Aelinor's dossier inbox.
    const sug = await db.suggestions.where('projectId').equals('p1').toArray();
    expect(sug[0].targetId).toBe(rows[0].id);
  });
});

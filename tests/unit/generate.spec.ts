import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import { undoAuditEntry } from '@/db/repos/undo';
import { configuredEntityTypes } from '@/domain/entity-configs';
import type { EntityType } from '@/domain/entity-types';
import type { KnownEntity } from '@/services/extraction/known-index';
import {
  coerceEntityDraft,
  coerceFieldValue,
  draftToInitialForm,
  matchOption,
} from '@/services/generate/coerce';
import { entitySpec, generableFields, wireExample } from '@/services/generate/spec';
import { entityToWireJson } from '@/services/generate/serialize';
import { applyBundle } from '@/services/generate/apply';
import { parseWireBundle } from '@/services/generate/wire';
import type { FieldSpec } from '@/services/generate/spec';
import type { GenerationBundle } from '@/services/generate/types';

const emptyCtx = { known: [] as KnownEntity[], siblings: [] };

/** A plausible wire value for every field kind — the golden-fixture
 * generator that proves coercion covers each type's whole config. */
function sampleWireValue(field: FieldSpec): unknown {
  switch (field.kind) {
    case 'text':
      return 'Sample text';
    case 'textarea':
    case 'longtext':
      return 'A longer sample paragraph of prose.';
    case 'chips':
    case 'row-list':
      return ['first', 'second'];
    case 'pills':
    case 'select':
      return field.options?.[0] ?? '';
    case 'multiselect':
      return field.options ? [field.options[0]] : [];
    case 'toggle':
      return true;
    case 'number':
      return 7;
    case 'dual-number':
      return { x: 3, y: 4 };
    case 'stat-grid':
      return [{ name: 'STR', value: '14' }];
    case 'step-list':
      return ['find the gate', { text: 'open it', status: 'done' }];
    case 'related':
      return 'Aelinor';
    case 'related-multi':
      return ['Aelinor'];
    default:
      return undefined;
  }
}

describe('generate/spec', () => {
  it('derives a spec with fields for all 16 configured types', () => {
    const types = configuredEntityTypes();
    expect(types).toHaveLength(16);
    for (const type of types) {
      const spec = entitySpec(type);
      expect(spec, type).not.toBeNull();
      expect(generableFields(spec!).length, type).toBeGreaterThan(3);
      const example = wireExample(type);
      expect(example.type).toBe(type);
      expect(example.fields).toBeTypeOf('object');
    }
  });

  it('never exposes image or phrase-tester fields on the wire', () => {
    for (const type of configuredEntityTypes()) {
      const example = wireExample(type);
      const fieldIds = Object.keys(example.fields as Record<string, unknown>);
      const spec = entitySpec(type)!;
      for (const f of spec.fields) {
        if (f.kind === 'image' || f.kind === 'phrase-tester') {
          expect(fieldIds, `${type}.${f.id}`).not.toContain(f.id);
        }
      }
    }
  });
});

describe('generate/coerce field kinds', () => {
  const field = (kind: FieldSpec['kind'], extra: Partial<FieldSpec> = {}): FieldSpec => ({
    id: 'f',
    label: 'Field',
    kind,
    sectionTitle: 'Test',
    ...extra,
  });

  it('matches pills/select options case-insensitively and by prefix', () => {
    expect(matchOption('ACTIVE', ['active', 'passive'])).toBe('active');
    expect(matchOption('pass', ['active', 'passive'])).toBe('passive');
    expect(matchOption('a', ['active', 'passive'])).toBe('active');
    expect(matchOption('nope', ['active', 'passive'])).toBeUndefined();
    const bad = coerceFieldValue(field('pills', { options: ['a', 'b'] }), 'zzz', emptyCtx);
    expect(bad.value).toBeUndefined();
    expect(bad.warnings).toHaveLength(1);
  });

  it('coerces stat-grid from arrays and object maps', () => {
    const fromArray = coerceFieldValue(field('stat-grid'), [{ name: 'STR', value: 14 }], emptyCtx);
    expect(fromArray.value).toEqual([{ name: 'STR', value: '14' }]);
    const fromMap = coerceFieldValue(field('stat-grid'), { STR: 14, DEX: '12' }, emptyCtx);
    expect(fromMap.value).toEqual([
      { name: 'STR', value: '14' },
      { name: 'DEX', value: '12' },
    ]);
  });

  it('coerces step-list from strings and objects, validating status', () => {
    const result = coerceFieldValue(
      field('step-list'),
      ['walk in', { text: 'strike', status: 'DONE' }, { text: 'flee', status: 'sideways' }],
      emptyCtx
    );
    expect(result.value).toEqual([
      { text: 'walk in', status: 'pending' },
      { text: 'strike', status: 'done' },
      { text: 'flee', status: 'pending' },
    ]);
  });

  it('coerces dual-number from pairs, objects, and "3/4" strings', () => {
    expect(coerceFieldValue(field('dual-number'), '3/4', emptyCtx).value).toEqual({ x: '3', y: '4' });
    expect(coerceFieldValue(field('dual-number'), [5, 6], emptyCtx).value).toEqual({ x: '5', y: '6' });
    expect(coerceFieldValue(field('dual-number'), { x: 1, y: 2 }, emptyCtx).value).toEqual({ x: '1', y: '2' });
  });

  it('coerces toggles from yes/no strings', () => {
    expect(coerceFieldValue(field('toggle'), 'yes', emptyCtx).value).toBe(true);
    expect(coerceFieldValue(field('toggle'), 'No', emptyCtx).value).toBe(false);
    expect(coerceFieldValue(field('toggle'), 'maybe', emptyCtx).value).toBeUndefined();
  });

  it('resolves related names against known entities, then siblings, then warns', () => {
    const known: KnownEntity[] = [{ id: 'e1', type: 'cast', name: 'Aelinor', aliases: ['Ael'] }];
    const siblings = [
      { localId: 'l1', type: 'cast' as EntityType, name: 'Brann', aliases: [], summary: '', tags: [], fields: {} },
    ];
    const ctx = { known, siblings };
    const rel = field('related', { related: 'cast' });
    expect(coerceFieldValue(rel, 'Ael', ctx).value).toEqual({ id: 'e1', type: 'cast', name: 'Aelinor' });
    expect(coerceFieldValue(rel, 'brann', ctx).value).toEqual({ id: 'l1', type: 'cast', name: 'Brann' });
    const miss = coerceFieldValue(rel, 'Nobody Here', ctx);
    expect(miss.value).toBeUndefined();
    expect(miss.warnings[0]).toContain('Nobody Here');
  });
});

describe('generate/coerce entity drafts', () => {
  it('coerces a full sample of every generable field for all 16 types', () => {
    const known: KnownEntity[] = [
      { id: 'e1', type: 'cast', name: 'Aelinor', aliases: [] },
      { id: 'e2', type: 'locations', name: 'Vraska Pass', aliases: [] },
      { id: 'e3', type: 'skills', name: 'Riposte', aliases: [] },
      { id: 'e4', type: 'items', name: 'Hollow Crown', aliases: [] },
      { id: 'e5', type: 'quests', name: 'The Long Road', aliases: [] },
      { id: 'e6', type: 'factions', name: 'The Veiled Court', aliases: [] },
      { id: 'e7', type: 'stats', name: 'Resolve', aliases: [] },
      { id: 'e8', type: 'classes', name: 'Warden', aliases: [] },
      { id: 'e9', type: 'races', name: 'Tidefolk', aliases: [] },
      { id: 'e10', type: 'events', name: 'The Sundering', aliases: [] },
      { id: 'e11', type: 'bestiary', name: 'Marsh Wyrm', aliases: [] },
    ];
    for (const type of configuredEntityTypes()) {
      const spec = entitySpec(type)!;
      const fields: Record<string, unknown> = {};
      for (const f of generableFields(spec)) {
        // Related samples need a matching known name; use type-appropriate ones.
        if (f.kind === 'related' || f.kind === 'related-multi') {
          const match = known.find((k) => f.related === 'any' || k.type === f.related);
          if (!match) continue;
          fields[f.id] = f.kind === 'related' ? match.name : [match.name];
        } else {
          const v = sampleWireValue(f);
          if (v !== undefined) fields[f.id] = v;
        }
      }
      const raw: Record<string, unknown> = {
        [spec.nameField ?? 'name']: 'Golden Sample',
        aliases: ['GS'],
        summary: 'A fixture.',
        tags: ['test'],
        fields,
      };
      const result = coerceEntityDraft(type, raw, { known, siblings: [] });
      expect(result, type).not.toBeNull();
      const { draft, warnings } = result!;
      expect(warnings, `${type}: ${warnings.join(' | ')}`).toHaveLength(0);
      if (spec.nameField) expect(draft.name).toBe('Golden Sample');
      // Every sampled field must survive coercion.
      for (const id of Object.keys(fields)) {
        expect(draft.fields[id], `${type}.${id}`).toBeDefined();
      }
    }
  });

  it('accepts flat legacy JSON with fields at the top level', () => {
    const result = coerceEntityDraft(
      'cast',
      { name: 'Brann', role: 'Protagonist', personality: 'stoic, wry' },
      emptyCtx
    );
    expect(result).not.toBeNull();
    expect(result!.draft.fields.role).toBe('Protagonist');
  });

  it('accepts title in place of name and vice versa', () => {
    const quest = coerceEntityDraft('quests', { name: 'Named as name' }, emptyCtx);
    expect(quest!.draft.name).toBe('Named as name');
    const castRow = coerceEntityDraft('cast', { title: 'Titled cast' }, emptyCtx);
    expect(castRow!.draft.name).toBe('Titled cast');
  });

  it('warns about unknown fields instead of failing', () => {
    const result = coerceEntityDraft('cast', { name: 'X', fields: { madeUp: 'zap' } }, emptyCtx);
    expect(result!.draft.fields.madeUp).toBeUndefined();
    expect(result!.warnings.some((w) => w.includes('madeUp'))).toBe(true);
  });

  it('derives relationship names from resolved endpoints', () => {
    const known: KnownEntity[] = [
      { id: 'a', type: 'cast', name: 'Aelinor', aliases: [] },
      { id: 'b', type: 'cast', name: 'Brann', aliases: [] },
    ];
    const result = coerceEntityDraft(
      'relationships',
      { fields: { from: 'Aelinor', to: 'Brann', bondType: 'Rivalry' } },
      { known, siblings: [] }
    );
    expect(result).not.toBeNull();
    expect(result!.draft.name).toBe('Aelinor → Brann');
  });

  it('flags exact same-type name matches as updates (duplicate guard)', () => {
    const known: KnownEntity[] = [{ id: 'e1', type: 'cast', name: 'Aelinor', aliases: [] }];
    const dupe = coerceEntityDraft('cast', { name: 'aelinor' }, { known, siblings: [] });
    expect(dupe!.draft.existingEntityId).toBe('e1');
    const otherType = coerceEntityDraft('bestiary', { name: 'Aelinor' }, { known, siblings: [] });
    expect(otherType!.draft.existingEntityId).toBeUndefined();
  });
});

describe('generate/serialize round-trip', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('flattens related refs to names and pastes back losslessly', async () => {
    const aelinor = await createEntity({ projectId: 'p1', type: 'cast', name: 'Aelinor' });
    const skill = await createEntity({
      projectId: 'p1',
      type: 'skills',
      name: 'Riposte',
      summary: 'Counter-strike.',
      tags: ['combat'],
      fields: {
        skillType: 'Active',
        effects: ['Deflect one blow'],
        assignedCast: [{ id: aelinor.id, type: 'cast', name: 'Aelinor' }],
      },
    });
    const wire = entityToWireJson(skill);
    expect((wire.fields as Record<string, unknown>).assignedCast).toEqual(['Aelinor']);
    expect(JSON.stringify(wire)).not.toContain(aelinor.id);

    const known: KnownEntity[] = [{ id: aelinor.id, type: 'cast', name: 'Aelinor', aliases: [] }];
    const back = coerceEntityDraft('skills', wire, { known, siblings: [] });
    expect(back!.draft.fields.assignedCast).toEqual([{ id: aelinor.id, type: 'cast', name: 'Aelinor' }]);
    expect(back!.draft.fields.effects).toEqual(['Deflect one blow']);
    const form = draftToInitialForm(back!.draft);
    expect(form.name).toBe('Riposte');
    expect(form.tags).toEqual(['combat']);
  });
});

describe('generate/wire parsing', () => {
  const ctx = { projectId: 'p1', known: [] as KnownEntity[] };

  it('parses a fenced single entity into a one-draft bundle', () => {
    const text = 'Sure! Here you go:\n```json\n{"name": "Vex", "summary": "A smuggler."}\n```';
    const result = parseWireBundle(text, { kind: 'entity', entityType: 'cast' }, ctx);
    expect('bundle' in result && result.bundle.entities).toHaveLength(1);
  });

  it('parses a bare array and an {entities:[...]} wrapper', () => {
    const arr = parseWireBundle('[{"name":"A"},{"name":"B"}]', { kind: 'entity-batch', entityType: 'cast' }, ctx);
    expect('bundle' in arr && arr.bundle.entities).toHaveLength(2);
    const wrapped = parseWireBundle(
      '{"entities": [{"type":"skills","name":"S1"},{"type":"cast","name":"C1"}]}',
      { kind: 'entity-batch' },
      ctx
    );
    expect('bundle' in wrapped && wrapped.bundle.entities.map((d) => d.type)).toEqual(['skills', 'cast']);
  });

  it('parses extraction-style payloads keyed by type name', () => {
    const result = parseWireBundle(
      '{"cast": [{"name": "Vex"}], "locations": [{"name": "The Shallows"}]}',
      { kind: 'entity-batch' },
      ctx
    );
    expect('bundle' in result && result.bundle.entities.map((d) => d.type).sort()).toEqual([
      'cast',
      'locations',
    ]);
  });

  it('lets siblings reference each other regardless of order', () => {
    const result = parseWireBundle(
      JSON.stringify({
        entities: [
          { type: 'cast', name: 'Vex', fields: { allies: ['Moth'] } },
          { type: 'cast', name: 'Moth' },
        ],
      }),
      { kind: 'entity-batch' },
      ctx
    );
    if (!('bundle' in result)) throw new Error(result.error);
    const vex = result.bundle.entities.find((d) => d.name === 'Vex')!;
    const moth = result.bundle.entities.find((d) => d.name === 'Moth')!;
    expect((vex.fields.allies as { id: string }[])[0].id).toBe(moth.localId);
  });

  it('returns a readable error for garbage', () => {
    const result = parseWireBundle('no json at all', { kind: 'entity', entityType: 'cast' }, ctx);
    expect('error' in result && result.error).toContain('No JSON');
  });
});

describe('generate/apply + undo', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  function bundleWith(overrides: Partial<GenerationBundle>): GenerationBundle {
    return {
      id: 'bundle1',
      projectId: 'p1',
      request: { kind: 'entity-batch', entityType: 'cast' },
      mode: 'paste',
      entities: [],
      graphs: [],
      chapters: [],
      links: [],
      warnings: [],
      createdAt: 1,
      ...overrides,
    };
  }

  it('creates entities with remapped sibling refs, links, and one reversible audit entry', async () => {
    const bundle = bundleWith({
      entities: [
        {
          localId: 'l1',
          type: 'cast',
          name: 'Vex',
          aliases: [],
          summary: '',
          tags: [],
          fields: { allies: [{ id: 'l2', type: 'cast', name: 'Moth' }] },
        },
        { localId: 'l2', type: 'cast', name: 'Moth', aliases: [], summary: '', tags: [], fields: {} },
      ],
      links: [{ from: 'l1', to: 'l2', kind: 'allies' }],
    });
    const result = await applyBundle(bundle);
    expect(result.created).toHaveLength(2);

    const rows = await db.entities.toArray();
    expect(rows).toHaveLength(2);
    const vex = rows.find((r) => r.name === 'Vex')!;
    const moth = rows.find((r) => r.name === 'Moth')!;
    expect((vex.fields.allies as { id: string }[])[0].id).toBe(moth.id);

    const links = await db.links.toArray();
    expect(links).toHaveLength(1);
    expect(links[0].from.id).toBe(vex.id);
    expect(links[0].source).toBe('generate');

    const entry = await db.auditLog.get(result.auditId);
    expect(entry?.action).toBe('generate.apply');
    expect(entry?.reversible).toBe(true);

    // Undo reverts the whole bundle as one unit.
    expect(await undoAuditEntry(result.auditId)).toBe(true);
    expect(await db.entities.count()).toBe(0);
    expect(await db.links.count()).toBe(0);
  });

  it('merges duplicate-matched drafts into the existing row and restores it on undo', async () => {
    const existing = await createEntity({
      projectId: 'p1',
      type: 'cast',
      name: 'Aelinor',
      summary: 'Queen in exile.',
      fields: { role: 'Protagonist' },
    });
    const bundle = bundleWith({
      entities: [
        {
          localId: 'l1',
          type: 'cast',
          name: 'Aelinor',
          aliases: ['The Exile'],
          summary: 'Should not replace.',
          tags: [],
          fields: { fears: 'the sea' },
          existingEntityId: existing.id,
        },
      ],
    });
    const result = await applyBundle(bundle);
    expect(result.updated).toHaveLength(1);
    expect(await db.entities.count()).toBe(1);
    const merged = (await db.entities.get(existing.id))!;
    expect(merged.summary).toBe('Queen in exile.');
    expect(merged.fields.role).toBe('Protagonist');
    expect(merged.fields.fears).toBe('the sea');
    expect(merged.aliases).toContain('The Exile');

    await undoAuditEntry(result.auditId);
    const restored = (await db.entities.get(existing.id))!;
    expect(restored.fields.fears).toBeUndefined();
    expect(restored.aliases).not.toContain('The Exile');
  });

  it('creates graph docs and chapters, and undo removes them', async () => {
    const bundle = bundleWith({
      request: { kind: 'skilltree' },
      entities: [
        { localId: 's1', type: 'skills', name: 'Venom Strike', aliases: [], summary: '', tags: [], fields: {} },
      ],
      graphs: [
        {
          localId: 'g1',
          kind: 'skilltree',
          name: 'Serpent Path',
          nodes: [
            { id: 'n1', label: 'Venom Strike', x: 100, y: 100, entity: { id: 's1', type: 'skills', name: 'Venom Strike' }, unlocked: false },
            { id: 'n2', label: 'Coat Blade', x: 100, y: 220, unlocked: false },
          ],
          edges: [{ id: 'ed1', from: 'n1', to: 'n2', directed: true }],
        },
      ],
      chapters: [
        { localId: 'c1', title: 'The Bitten Court', summary: 'Poison politics.', beats: ['Arrival', 'The tasting'], linkedEntityLocalIds: [] },
      ],
    });
    const result = await applyBundle(bundle);
    expect(result.graphIds).toHaveLength(1);
    expect(result.chapterIds).toHaveLength(1);

    const tree = (await db.skillTrees.toArray())[0];
    expect(tree.nodes).toHaveLength(2);
    const skillRow = (await db.entities.toArray())[0];
    expect(tree.nodes[0].entity?.id).toBe(skillRow.id);
    expect(tree.edges[0].from).toBe(tree.nodes[0].id);

    const chapter = (await db.chapters.toArray())[0];
    expect(chapter.paragraphs.map((p) => p.text)).toEqual(['Poison politics.', 'Arrival', 'The tasting']);
    expect(chapter.wordCount).toBeGreaterThan(0);

    await undoAuditEntry(result.auditId);
    expect(await db.skillTrees.count()).toBe(0);
    expect(await db.chapters.count()).toBe(0);
    expect(await db.entities.count()).toBe(0);
  });

  it('appends to an existing tree and undo restores the original document', async () => {
    await db.skillTrees.add({
      id: 'tree1',
      projectId: 'p1',
      name: 'Old Tree',
      nodes: [{ id: 'orig', label: 'Root', x: 50, y: 50 }],
      edges: [],
      updatedAt: 1,
    });
    const bundle = bundleWith({
      request: { kind: 'skilltree-branch', targetGraphId: 'tree1' },
      graphs: [
        {
          localId: 'g1',
          kind: 'skilltree',
          targetGraphId: 'tree1',
          name: 'Old Tree',
          nodes: [{ id: 'n1', label: 'New Branch', x: 200, y: 50 }],
          edges: [{ id: 'e1', from: 'orig', to: 'n1', directed: true }],
        },
      ],
    });
    const result = await applyBundle(bundle);
    const grown = (await db.skillTrees.get('tree1'))!;
    expect(grown.nodes).toHaveLength(2);
    expect(grown.edges).toHaveLength(1);
    expect(grown.edges[0].from).toBe('orig');

    await undoAuditEntry(result.auditId);
    const restored = (await db.skillTrees.get('tree1'))!;
    expect(restored.nodes).toHaveLength(1);
    expect(restored.edges).toHaveLength(0);
  });
});

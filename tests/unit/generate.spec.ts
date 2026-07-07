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
import { buildGenerationPrompt, parseWireBundle } from '@/services/generate/wire';
import {
  generateRandomBundle,
  generateSkillTreeBranchBundle,
  rollEmptyFields,
  rollField,
} from '@/services/generate/random/engine';
import { createRng } from '@/services/generate/random/rng';
import { deepPackFor, matchArchetype } from '@/services/generate/random/packs';
import { generateTreeTopology } from '@/services/generate/random/topology';
import { layoutTree } from '@/services/generate/layout';
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

describe('generate/random engine', () => {
  const ctx = { projectId: 'p1', known: [] as KnownEntity[] };

  it('is deterministic for a fixed seed and different across seeds', () => {
    const req = { kind: 'entity' as const, entityType: 'cast' as const, theme: 'high-fantasy', hint: 'sorcerer' };
    const a = generateRandomBundle(req, ctx, 42);
    const b = generateRandomBundle(req, ctx, 42);
    const c = generateRandomBundle(req, ctx, 43);
    expect(a.entities[0].name).toBe(b.entities[0].name);
    expect(a.entities[0].fields).toEqual(b.entities[0].fields);
    expect(a.seed).toBe(42);
    expect(a.entities[0].name).not.toBe(c.entities[0].name);
  });

  it('yields a valid named draft with filled fields for every configured type', () => {
    for (const type of configuredEntityTypes()) {
      if (type === 'relationships') continue; // needs cast context; see below
      const bundle = generateRandomBundle(
        { kind: 'entity', entityType: type, theme: 'grimdark' },
        ctx,
        7
      );
      const draft = bundle.entities[0];
      expect(draft, type).toBeDefined();
      expect(draft.name.length, type).toBeGreaterThan(2);
      expect(draft.summary.length, type).toBeGreaterThan(10);
      expect(Object.keys(draft.fields).length, `${type} fields`).toBeGreaterThan(0);
      // Everything rolled must survive the coercion path (valid shapes).
      const recoerced = coerceEntityDraft(
        type,
        { name: draft.name, summary: draft.summary, fields: draft.fields },
        { known: ctx.known, siblings: [] }
      );
      expect(recoerced, type).not.toBeNull();
    }
  });

  it('links related fields to known entities when they exist', () => {
    const known: KnownEntity[] = [
      { id: 'c1', type: 'cast', name: 'Aelinor', aliases: [] },
      { id: 'r1', type: 'races', name: 'Tidefolk', aliases: [] },
      { id: 'f1', type: 'factions', name: 'The Veiled Court', aliases: [] },
    ];
    // Across many seeds, cast drafts must eventually link a known race.
    let linked = false;
    for (let seed = 1; seed < 30 && !linked; seed++) {
      const draft = generateRandomBundle(
        { kind: 'entity', entityType: 'cast', theme: 'high-fantasy' },
        { projectId: 'p1', known },
        seed
      ).entities[0];
      const species = draft.fields.species as { id?: string } | undefined;
      if (species?.id === 'r1') linked = true;
    }
    expect(linked).toBe(true);
  });

  it('entity-batch produces the requested count', () => {
    const bundle = generateRandomBundle(
      { kind: 'entity-batch', entityType: 'items', theme: 'science-fiction', count: 5 },
      ctx,
      11
    );
    expect(bundle.entities).toHaveLength(5);
  });

  it('rollField (forced) always produces a valid option for pills', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const value = rollField('cast', 'role', { ...ctx }, seed);
      expect(typeof value).toBe('string');
    }
  });

  it('rollEmptyFields never overwrites existing values', () => {
    const current = { name: 'Keep Me', role: 'Mentor' };
    const rolled = rollEmptyFields('cast', current, ctx, 5);
    expect(rolled.name).toBeUndefined();
    expect(rolled.role).toBeUndefined();
    expect(Object.keys(rolled).length).toBeGreaterThan(0);
  });

  it('matchArchetype picks by hint keywords within theme', () => {
    const pack = {
      type: 'skills' as const,
      archetypes: [
        { id: 'fire', keywords: ['fire', 'flame'], themes: 'any' as const, lexicon: {} },
        { id: 'poison', keywords: ['poison', 'venom'], themes: 'any' as const, lexicon: {} },
      ],
      generate: () => {
        throw new Error('unused');
      },
    };
    const rng = createRng(1);
    expect(matchArchetype(rng, pack, 'grimdark', 'a venom blade').id).toBe('poison');
    expect(matchArchetype(rng, pack, 'grimdark', 'flame dancer').id).toBe('fire');
  });
});

describe('generate/deep packs coherence', () => {
  const ctx = { projectId: 'p1', known: [] as KnownEntity[] };
  // Every type with a hand-authored pack (§4). Types without one fall back
  // to the config-driven generic filler and are covered by the block above.
  const DEEP_TYPES: EntityType[] = ['cast', 'skills', 'quests', 'locations', 'items', 'bestiary', 'factions'];

  it('deep packs emit only valid config fields — no coercion warnings across seeds', () => {
    for (const type of DEEP_TYPES) {
      for (let seed = 1; seed <= 8; seed++) {
        const draft = generateRandomBundle(
          { kind: 'entity', entityType: type, theme: 'high-fantasy', hint: '' },
          ctx,
          seed
        ).entities[0];
        // Re-coerce with no known context so no related fields are present;
        // any invalid pill/option or unknown field id surfaces as a warning.
        const recoerced = coerceEntityDraft(
          type,
          { name: draft.name, summary: draft.summary, tags: draft.tags, fields: draft.fields },
          { known: [], siblings: [] }
        );
        expect(recoerced, `${type} seed ${seed}`).not.toBeNull();
        expect(
          recoerced!.warnings,
          `${type} seed ${seed}: ${recoerced!.warnings.join(' | ')}`
        ).toHaveLength(0);
        // A deep pack always tags its draft with the chosen archetype id.
        expect(draft.tags.length, `${type} seed ${seed} tags`).toBeGreaterThan(0);
      }
    }
  });

  it('the archetype matcher selects the right flavor by hint keyword (G4 packs)', () => {
    const rng = createRng(1);
    const match = (type: EntityType, hint: string) =>
      matchArchetype(rng, deepPackFor(type)!, 'high-fantasy', hint).id;
    expect(match('items', 'a fine sword')).toBe('weapon');
    expect(match('items', 'a healing potion')).toBe('consumable');
    expect(match('bestiary', 'a shambling zombie')).toBe('undead');
    expect(match('bestiary', 'a swarm of insects')).toBe('swarm');
    expect(match('factions', 'the thieves guild')).toBe('thieves');
    expect(match('factions', 'a doomsday cult')).toBe('cult');
  });

  it('deep packs are deterministic and stay on-archetype for a fixed seed', () => {
    const req = {
      kind: 'entity' as const,
      entityType: 'items' as const,
      theme: 'grimdark',
      hint: 'a cursed haunted heirloom',
    };
    const a = generateRandomBundle(req, ctx, 99);
    const b = generateRandomBundle(req, ctx, 99);
    expect(a.entities[0].name).toBe(b.entities[0].name);
    expect(a.entities[0].fields).toEqual(b.entities[0].fields);
    expect(a.entities[0].tags[0]).toBe('cursed');
    // Cursed items only ever carry a Cursed/Unique rarity from their pool.
    expect(['Cursed', 'Unique']).toContain(a.entities[0].fields.rarity);
  });

  it('a bestiary draft fills threat, disposition, and behaviour coherently', () => {
    const bundle = generateRandomBundle(
      { kind: 'entity', entityType: 'bestiary', theme: 'grimdark', hint: 'apex predator' },
      ctx,
      3
    );
    const draft = bundle.entities[0];
    expect(draft.tags[0]).toBe('apex');
    expect(draft.fields.threatLevel).toBeTruthy();
    expect(draft.fields.disposition).toBeTruthy();
    expect((draft.fields.abilities as string[]).length).toBeGreaterThan(0);
    expect((draft.fields.behaviour as string).length).toBeGreaterThan(10);
  });

  it('a faction draft fills kind, goals, and methods coherently', () => {
    const bundle = generateRandomBundle(
      { kind: 'entity', entityType: 'factions', theme: 'high-fantasy', hint: 'a merchant company' },
      ctx,
      4
    );
    const draft = bundle.entities[0];
    expect(draft.tags[0]).toBe('merchant-company');
    expect(draft.fields.kind).toBeTruthy();
    expect((draft.fields.goals as string[]).length).toBeGreaterThan(1);
    expect((draft.fields.methods as string[]).length).toBeGreaterThan(1);
  });
});

describe('generate/skill trees', () => {
  const ctx = { projectId: 'p1', known: [] as KnownEntity[] };

  it('topology is a rooted DAG with the requested branches and no dangling edges', () => {
    for (let seed = 1; seed <= 12; seed++) {
      const rng = createRng(seed);
      const topo = generateTreeTopology(rng, { nodeCount: 14, branchCount: 3 });
      expect(topo.nodes).toHaveLength(14);
      expect(topo.branchCount).toBe(3);
      const ids = new Set(topo.nodes.map((n) => n.localId));
      const incoming = new Map<string, number>();
      for (const e of topo.edges) {
        expect(ids.has(e.from), `seed ${seed}`).toBe(true);
        expect(ids.has(e.to), `seed ${seed}`).toBe(true);
        incoming.set(e.to, (incoming.get(e.to) ?? 0) + 1);
      }
      // Exactly one root (no incoming edges) and every other node reachable.
      const roots = topo.nodes.filter((n) => !incoming.has(n.localId));
      expect(roots.map((r) => r.localId), `seed ${seed}`).toEqual([topo.nodes[0].localId]);
      // Edges always point down a tier (from earlier to later) — acyclic.
      const tierOf = new Map(topo.nodes.map((n) => [n.localId, n.tier]));
      for (const e of topo.edges) {
        expect(tierOf.get(e.to)!, `seed ${seed}`).toBeGreaterThan(tierOf.get(e.from)! - 1);
      }
    }
  });

  it('layout is deterministic and collision-free', () => {
    const rng = createRng(9);
    const topo = generateTreeTopology(rng, { nodeCount: 18, branchCount: 4 });
    const ids = topo.nodes.map((n) => n.localId);
    const a = layoutTree(ids, topo.edges);
    const b = layoutTree(ids, topo.edges);
    expect([...a.entries()]).toEqual([...b.entries()]);
    const seen = new Set<string>();
    for (const [, pos] of a) {
      const key = `${Math.round(pos.x / 40)}:${Math.round(pos.y / 40)}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it('layout places disconnected components side by side', () => {
    const positions = layoutTree(
      ['a1', 'a2', 'b1', 'b2'],
      [
        { from: 'a1', to: 'a2' },
        { from: 'b1', to: 'b2' },
      ],
      { jitter: 0 }
    );
    expect(positions.get('a1')!.x).not.toBe(positions.get('b1')!.x);
    expect(positions.get('a1')!.y).toBe(positions.get('b1')!.y);
  });

  it('generates a full sorcerer tree: skills + positioned, grouped, edged graph', () => {
    const bundle = generateRandomBundle(
      { kind: 'skilltree', theme: 'high-fantasy', hint: 'sorcerer', count: 12, options: { branches: 3 } },
      ctx,
      21
    );
    expect(bundle.entities).toHaveLength(12);
    expect(bundle.graphs).toHaveLength(1);
    const graph = bundle.graphs[0];
    expect(graph.kind).toBe('skilltree');
    expect(graph.name.length).toBeGreaterThan(3);
    expect(graph.nodes).toHaveLength(12);
    // Every node is bound to a skill draft in the same bundle and carries
    // a position from the layout plus a branch group (except the root).
    const draftIds = new Set(bundle.entities.map((d) => d.localId));
    for (const [i, node] of graph.nodes.entries()) {
      expect(draftIds.has(node.entity!.id)).toBe(true);
      expect(Number.isFinite(node.x) && Number.isFinite(node.y)).toBe(true);
      if (i > 0) expect(node.group).toBeTruthy();
    }
    // Skill names are unique; sorcery archetype flavors the content.
    const names = bundle.entities.map((d) => d.name.toLowerCase());
    expect(new Set(names).size).toBe(names.length);
    expect(bundle.entities.every((d) => (d.fields.effects as string[]).length > 0)).toBe(true);
    expect(bundle.entities[0].tags).toContain('sorcery');
    // Deterministic reroll.
    const again = generateRandomBundle(bundle.request, ctx, 21);
    expect(again.graphs[0].name).toBe(graph.name);
  });

  it('branch bundles attach to an existing tree via real node ids', () => {
    const tree = {
      id: 'tree1',
      projectId: 'p1',
      name: 'Old Tree',
      nodes: [
        { id: 'root', label: 'Root', x: 100, y: 100 },
        { id: 'leaf', label: 'Leaf', x: 100, y: 210 },
      ],
      edges: [{ id: 'e1', from: 'root', to: 'leaf', directed: true }],
      updatedAt: 1,
    };
    const real = generateSkillTreeBranchBundle(
      { kind: 'skilltree-branch', theme: 'grimdark', hint: 'poison', count: 4, targetGraphId: 'tree1' },
      ctx,
      tree,
      5
    );
    expect(real.graphs[0].targetGraphId).toBe('tree1');
    expect(real.entities.length).toBeGreaterThanOrEqual(4);
    // The first edge hangs off an existing node of the tree.
    const treeIds = new Set(tree.nodes.map((n) => n.id));
    expect(real.graphs[0].edges.some((e) => treeIds.has(e.from))).toBe(true);
    // New nodes sit in free space right of the existing tree.
    const maxTreeX = Math.max(...tree.nodes.map((n) => n.x));
    expect(real.graphs[0].nodes.every((n) => n.x > maxTreeX)).toBe(true);
  });
});

describe('generate/wire tree + questline payloads', () => {
  const ctx = { projectId: 'p1', known: [] as KnownEntity[] };

  const TREE_REPLY = JSON.stringify({
    loomwright: 'loomwright-generation-v1',
    kind: 'skilltree',
    name: 'The Serpent Path',
    skills: [
      { type: 'skills', name: 'Coat Blade', summary: 'Base.', fields: { skillType: 'active' } },
      { name: 'Venom Strike', fields: { skillType: 'active', effects: ['Poison one foe'] } },
      { name: 'Numbing Cloud', fields: { skillType: 'triggered' } },
    ],
    tree: {
      nodes: [
        { skill: 'Coat Blade', tier: 0, branch: 'Toxins', requires: [] },
        { skill: 'Venom Strike', tier: 1, branch: 'Toxins', requires: ['Coat Blade'] },
        { skill: 'Numbing Cloud', tier: 1, branch: 'Clouds', requires: ['Coat Blade', 'Nonexistent'] },
      ],
    },
  });

  it('parses a tree payload into skills + a positioned graph draft', () => {
    const result = parseWireBundle(TREE_REPLY, { kind: 'skilltree' }, ctx, 'ai');
    if (!('bundle' in result)) throw new Error(result.error);
    const { bundle } = result;
    expect(bundle.entities).toHaveLength(3);
    expect(bundle.graphs).toHaveLength(1);
    const graph = bundle.graphs[0];
    expect(graph.name).toBe('The Serpent Path');
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(2); // 'Nonexistent' prerequisite dropped
    expect(bundle.warnings.some((w) => w.includes('Nonexistent'))).toBe(true);
    // Positions computed by layout, groups from branch names.
    for (const node of graph.nodes) {
      expect(node.x !== 0 || node.y !== 0).toBe(true);
    }
    expect(graph.nodes[1].group).toBe('Toxins');
    // Node entity refs point at the skill drafts.
    const draftIds = new Set(bundle.entities.map((d) => d.localId));
    expect(graph.nodes.every((n) => draftIds.has(n.entity!.id))).toBe(true);
  });

  it('parses a branch payload attaching to existing tree labels', () => {
    const tree = {
      id: 'tree1',
      projectId: 'p1',
      name: 'Old Tree',
      nodes: [{ id: 'n-root', label: 'Old Root', x: 100, y: 100 }],
      edges: [],
      updatedAt: 1,
    };
    const reply = JSON.stringify({
      kind: 'skilltree-branch',
      skills: [{ name: 'Graft One' }, { name: 'Graft Two' }],
      tree: {
        nodes: [
          { skill: 'Graft One', requires: ['Old Root'] },
          { skill: 'Graft Two', requires: ['Graft One'] },
        ],
      },
    });
    const result = parseWireBundle(
      reply,
      { kind: 'skilltree-branch', targetGraphId: 'tree1' },
      { ...ctx, tree },
      'paste'
    );
    if (!('bundle' in result)) throw new Error(result.error);
    const graph = result.bundle.graphs[0];
    expect(graph.targetGraphId).toBe('tree1');
    // The graft hangs off the real existing node id and sits beside the tree.
    expect(graph.edges.some((e) => e.from === 'n-root')).toBe(true);
    expect(Math.min(...graph.nodes.map((n) => n.x))).toBeGreaterThan(100);
  });

  it('parses a questline payload into linked quests + events', () => {
    const reply = JSON.stringify({
      kind: 'questline',
      quests: [
        { title: 'Steal the Ledger', fields: { steps: ['case the vault', 'go in'] } },
        { title: 'Pay the Debt' },
      ],
      events: [{ title: 'The Vault Alarm' }],
      chain: [{ from: 'Steal the Ledger', to: 'Pay the Debt' }, { from: 'Nope', to: 'Also Nope' }],
    });
    const result = parseWireBundle(reply, { kind: 'questline' }, ctx, 'ai');
    if (!('bundle' in result)) throw new Error(result.error);
    expect(result.bundle.entities.map((d) => d.type).sort()).toEqual(['events', 'quests', 'quests']);
    expect(result.bundle.links).toHaveLength(1);
    expect(result.bundle.warnings.some((w) => w.includes('Nope'))).toBe(true);
    const quest = result.bundle.entities.find((d) => d.name === 'Steal the Ledger')!;
    expect(quest.fields.steps).toEqual([
      { text: 'case the vault', status: 'pending' },
      { text: 'go in', status: 'pending' },
    ]);
  });

  it('kind-aware prompts include tree schema and adjacency context', () => {
    const tree = {
      id: 'tree1',
      projectId: 'p1',
      name: 'Old Tree',
      nodes: [
        { id: 'a', label: 'Old Root', x: 0, y: 0 },
        { id: 'b', label: 'Old Leaf', x: 0, y: 110 },
      ],
      edges: [{ id: 'e', from: 'a', to: 'b', directed: true }],
      updatedAt: 1,
    };
    const prompt = buildGenerationPrompt(
      { kind: 'skilltree-branch', count: 4, hint: 'poison', targetGraphId: 'tree1' },
      { ...ctx, tree }
    );
    expect(prompt).toContain('NEW BRANCH');
    expect(prompt).toContain('"skills"');
    expect(prompt).toContain('Old Leaf (tier 1) requires Old Root');
    expect(prompt).toContain('NEVER include coordinates');
    const questPrompt = buildGenerationPrompt({ kind: 'questline', count: 3 }, ctx);
    expect(questPrompt).toContain('QUESTLINE');
    expect(questPrompt).toContain('"chain"');
  });
});

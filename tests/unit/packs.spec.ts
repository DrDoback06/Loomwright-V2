import { describe, expect, it } from 'vitest';
import { ALL_ENTITY_TYPES, type EntityType } from '@/domain/entity-types';
import { entitySpec } from '@/services/generate/spec';
import { deepPackFor, matchArchetype, resolveTheme } from '@/services/generate/random/packs';
import { createRng } from '@/services/generate/random/rng';
import { THEMES } from '@/services/generate/random/packs/lexicon';

/**
 * The pack contract.
 *
 * A pack writes straight into `entity.fields`, which is an untyped bag — so
 * nothing at compile time stops a pack from inventing a field id the editor
 * has never heard of, or putting a value in a `pills` field that is not one of
 * its options. Both failures are invisible until an author opens the drawer
 * and finds a blank where their content should be. This walks every
 * registered pack against the real config and checks it properly.
 */

const PACKED_TYPES: EntityType[] = ALL_ENTITY_TYPES.filter((type) => Boolean(deepPackFor(type)));

describe('content packs write fields the editor can actually render', () => {
  it('covers the types the product promises deep generation for', () => {
    // items.ts was written, exported, and never registered — every item the
    // app generated fell back to the config-driven filler for months.
    for (const type of ['skills', 'cast', 'quests', 'locations', 'items', 'bestiary', 'factions']) {
      expect(deepPackFor(type as EntityType), `${type} has no deep pack`).toBeDefined();
    }
  });

  for (const type of PACKED_TYPES) {
    it(`${type}: every field id is real and every option value is in its list`, () => {
      const spec = entitySpec(type);
      expect(spec, `${type} has no config`).not.toBeNull();
      const byId = new Map(spec!.fields.map((f) => [f.id, f]));
      const pack = deepPackFor(type)!;

      for (const theme of THEMES) {
        for (let seed = 0; seed < 12; seed++) {
          const rng = createRng(seed * 7919 + theme.id.length);
          const resolved = resolveTheme(rng, theme.id);
          const arch = matchArchetype(rng, pack, resolved, '');
          const draft = pack.generate(rng, arch, { theme: resolved, hint: '', known: [] });

          expect(draft.name.trim().length, `${type}/${theme.id}/${seed} produced no name`).toBeGreaterThan(0);

          for (const [fieldId, value] of Object.entries(draft.fields ?? {})) {
            const field = byId.get(fieldId);
            expect(field, `${type}.fields.${fieldId} is not a field on the ${type} config`).toBeDefined();
            if (value == null) continue;

            if (field!.kind === 'pills' || field!.kind === 'select') {
              const options = field!.options ?? [];
              if (!options.length) continue;
              expect(
                options as readonly string[],
                `${type}.${fieldId} = ${JSON.stringify(value)} is not one of its options`
              ).toContain(value);
            }
            if (field!.kind === 'multiselect') {
              for (const entry of Array.isArray(value) ? value : [value]) {
                expect(field!.options ?? [], `${type}.${fieldId} entry ${entry}`).toContain(entry);
              }
            }
            if (field!.kind === 'chips' || field!.kind === 'row-list') {
              expect(Array.isArray(value), `${type}.${fieldId} must be a list`).toBe(true);
              for (const entry of value as unknown[]) {
                expect(typeof entry, `${type}.${fieldId} entries must be strings`).toBe('string');
              }
            }
            if (field!.kind === 'related') {
              expect(value).toHaveProperty('id');
              expect(value).toHaveProperty('name');
            }
            if (field!.kind === 'related-multi') {
              expect(Array.isArray(value), `${type}.${fieldId} must be a list of refs`).toBe(true);
              for (const entry of value as { id?: string }[]) expect(entry).toHaveProperty('id');
            }
          }
        }
      }
    });

    it(`${type}: the same seed always rolls the same draft`, () => {
      const pack = deepPackFor(type)!;
      const roll = () => {
        const rng = createRng(4242);
        const theme = resolveTheme(rng, 'high-fantasy');
        const arch = matchArchetype(rng, pack, theme, 'test');
        const draft = pack.generate(rng, arch, { theme, hint: 'test', known: [] });
        return { ...draft, localId: 'fixed' };
      };
      expect(roll()).toEqual(roll());
    });
  }
});

describe('archetypes are selectable by the words an author would type', () => {
  for (const type of PACKED_TYPES) {
    it(`${type}: every archetype has keywords and a populated lexicon`, () => {
      const pack = deepPackFor(type)!;
      expect(pack.archetypes.length).toBeGreaterThanOrEqual(6);
      for (const arch of pack.archetypes) {
        expect(arch.keywords.length, `${type}/${arch.id} has too few keywords`).toBeGreaterThanOrEqual(5);
        const slots = Object.values(arch.lexicon);
        expect(slots.length, `${type}/${arch.id} has an empty lexicon`).toBeGreaterThan(0);
        for (const pool of slots) {
          expect(pool.length, `${type}/${arch.id} has an empty slot`).toBeGreaterThan(0);
        }
        // Some slots legitimately hold one value — an archetype's item type is
        // not meant to vary. Richness is about the slots that DO vary: without
        // several deep pools, every draft from an archetype reads the same.
        const deep = slots.filter((pool) => pool.length >= 4).length;
        expect(deep, `${type}/${arch.id} has too few varied slots`).toBeGreaterThanOrEqual(3);
      }
    });

    it(`${type}: a matching hint selects the archetype it names`, () => {
      const pack = deepPackFor(type)!;
      const arch = pack.archetypes[0];
      const rng = createRng(1);
      const theme = resolveTheme(rng, arch.themes === 'any' ? 'high-fantasy' : arch.themes[0]);
      const matched = matchArchetype(rng, pack, theme, arch.keywords[0]);
      expect(matched.id).toBe(arch.id);
    });
  }
});

/** The extraction contract: run every golden fixture from
 * tests/fixtures/extraction against the ported engine. These fixtures
 * pinned the legacy engine's behaviour; the port must preserve it. */
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runLocalExtraction } from '@/services/extraction/engine';
import type { KnownEntity } from '@/services/extraction/known-index';
import type { EntityType } from '@/domain/entity-types';

const require = createRequire(import.meta.url);
const FIXTURE_DIR = join(__dirname, '..', 'fixtures', 'extraction');

interface Fixture {
  name: string;
  description: string;
  seed: Partial<Record<EntityType, { id: string; name: string; aliases?: string[] }[]>>;
  text: string;
  expectedOccurrences: { entityId: string; exactText?: string }[];
  expectedCandidates: {
    entityType: string;
    suggestedAction?: string;
    matchType?: string;
    existingEntityId?: string;
    name?: string;
    suggestedChanges?: Record<string, unknown>;
  }[];
  forbiddenOccurrences: { entityId: string }[];
  minOccurrences?: number;
  maxOccurrences?: number;
}

const files = readdirSync(FIXTURE_DIR).filter((f) => f.endsWith('.fixture.cjs'));

function seedEntities(fixture: Fixture): KnownEntity[] {
  const out: KnownEntity[] = [];
  for (const [type, rows] of Object.entries(fixture.seed ?? {})) {
    for (const row of rows ?? []) {
      out.push({
        id: row.id,
        type: type as EntityType,
        name: row.name,
        aliases: row.aliases ?? [],
      });
    }
  }
  return out;
}

describe('extraction fixtures (golden contract)', () => {
  expect(files.length).toBeGreaterThanOrEqual(16);

  for (const file of files) {
    const fixture = require(join(FIXTURE_DIR, file)) as Fixture;

    it(`${fixture.name} — ${fixture.description}`, () => {
      const entities = seedEntities(fixture);
      const { occurrences, candidates } = runLocalExtraction({
        text: fixture.text,
        entities,
        // Pronoun occurrences are additive noise for count windows that
        // predate them in some fixtures; the legacy smoke also ran with
        // resolution on, and count windows accommodate it.
      });

      // Expected occurrences: subset — each must appear at least once.
      for (const exp of fixture.expectedOccurrences ?? []) {
        const found = occurrences.some(
          (o) =>
            o.entityId === exp.entityId &&
            (exp.exactText == null || o.exactText === exp.exactText)
        );
        expect(found, `expected occurrence ${JSON.stringify(exp)}`).toBe(true);
      }

      // Forbidden occurrences: none may match.
      for (const forbidden of fixture.forbiddenOccurrences ?? []) {
        const hits = occurrences.filter((o) => o.entityId === forbidden.entityId);
        expect(hits, `forbidden occurrence for ${forbidden.entityId}`).toHaveLength(0);
      }

      // Count windows exclude pronoun resolutions (fixtures predate them).
      const explicit = occurrences.filter((o) => !o.isPronounResolution);
      if (fixture.minOccurrences != null) {
        expect(explicit.length).toBeGreaterThanOrEqual(fixture.minOccurrences);
      }
      if (fixture.maxOccurrences != null) {
        expect(explicit.length).toBeLessThanOrEqual(fixture.maxOccurrences);
      }

      // Expected candidates: subset match on the given properties.
      for (const exp of fixture.expectedCandidates ?? []) {
        const found = candidates.some((c) => {
          if (c.entityType !== exp.entityType) return false;
          if (exp.suggestedAction && c.suggestedAction !== exp.suggestedAction) return false;
          if (exp.matchType && c.matchType !== exp.matchType) return false;
          if (exp.existingEntityId && c.existingEntityId !== exp.existingEntityId) return false;
          if (exp.name && c.name !== exp.name) return false;
          if (exp.suggestedChanges) {
            for (const [k, v] of Object.entries(exp.suggestedChanges)) {
              if (JSON.stringify((c.suggestedChanges ?? {})[k]) !== JSON.stringify(v)) return false;
            }
          }
          return true;
        });
        expect(
          found,
          `expected candidate ${JSON.stringify(exp)} in ${JSON.stringify(
            candidates.map((c) => ({
              t: c.entityType,
              n: c.name,
              a: c.suggestedAction,
              m: c.matchType,
              ch: c.suggestedChanges,
            }))
          )}`
        ).toBe(true);
      }
    });
  }
});

import { buildKnownIndex, resolvePronounsInText, scanTextForKnownEntities, type KnownEntity, type ScanOccurrence } from './known-index';
import { dedupeCandidates, runLocalDetectors, type ExtractionCandidate } from './detectors';
import { clusterAliases, discoverEntities } from './discovery';
import { findRanges } from './text-utils';

export interface ExtractionInput {
  text: string;
  entities: KnownEntity[];
  /** gentle → 3, balanced → 2, aggressive → 1 minimum recurrences for
   * bare-name discovery. */
  aggressiveness?: 'gentle' | 'balanced' | 'aggressive';
  confidenceOverrides?: Record<string, number>;
  resolvePronouns?: boolean;
}

export interface ExtractionResult {
  occurrences: ScanOccurrence[];
  candidates: ExtractionCandidate[];
}

/** The always-available offline extraction pass, pure and DB-free:
 * 1. scan for known entity mentions (+ pronoun resolution)
 * 2. offline NER discovery of brand-new entities
 * 3. phrase detectors (item transfer/loss, travel, relationships, stats,
 *    quests, events, lore, dialogue, epithets, chains, allegiance)
 * 4. alias clustering + dedupe
 * Behaviour pinned by tests/fixtures/extraction. */
export function runLocalExtraction(input: ExtractionInput): ExtractionResult {
  const text = input.text ?? '';
  const entities = input.entities ?? [];
  const index = buildKnownIndex(entities);

  const occurrences = scanTextForKnownEntities(text, entities);
  if (input.resolvePronouns !== false) {
    occurrences.push(...resolvePronounsInText(text, entities));
  }

  const minRecurrence =
    input.aggressiveness === 'gentle' ? 3 : input.aggressiveness === 'aggressive' ? 1 : 2;
  const discovered = clusterAliases(discoverEntities(text, entities, { minRecurrence }));

  const detectorCandidates = runLocalDetectors({
    text,
    index,
    entities,
    confidenceOverrides: input.confidenceOverrides,
    extraStatNames: entities.filter((e) => e.type === 'stats').map((e) => e.name),
  });

  const candidates = dedupeCandidates([...discovered, ...detectorCandidates]);

  // Candidate occurrences: tag mentions of NEW discoveries (entityId null,
  // candidateName set) so accepting the candidate can backfill the id and
  // the Writer's Room can highlight them as pending. Legacy pattern.
  for (const c of candidates) {
    if (c.matchType !== 'new') continue;
    if (
      ['relationships', 'stats', 'lore', 'quests', 'events'].includes(c.entityType) &&
      c.suggestedAction !== 'create'
    ) {
      continue;
    }
    const needle = c.name.toLowerCase();
    if (!needle || needle.includes('→')) continue;
    for (const r of findRanges(text, needle)) {
      occurrences.push({
        entityId: null,
        entityType: c.entityType,
        exactText: text.slice(r.start, r.end),
        start: r.start,
        end: r.end,
        candidateName: c.name,
      });
    }
  }

  return { occurrences, candidates };
}

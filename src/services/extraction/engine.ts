import type { EntityType } from '@/domain/entity-types';
import { buildKnownIndex, resolvePronounsInText, scanTextForKnownEntities, type KnownEntity, type ScanOccurrence } from './known-index';
import {
  dedupeCandidates,
  runLocalDetectors,
  type ExtractionCandidate,
  type ExtractionSignal,
} from './detectors';
import { clusterAliases, discoverCommonItems, discoverEntities } from './discovery';
import { findRanges } from './text-utils';

export interface ExtractionInput {
  text: string;
  entities: KnownEntity[];
  /** gentle → 3, balanced → 2, aggressive → 1 minimum recurrences for
   * bare-name discovery. */
  aggressiveness?: 'gentle' | 'balanced' | 'aggressive';
  confidenceOverrides?: Record<string, number>;
  resolvePronouns?: boolean;
  /** Second detector pass over pass-1 discoveries (default on). See
   * {@link runLocalExtraction}. */
  bootstrap?: boolean;
  /** Extra verbs the author added in Settings ▸ Extraction, per detector. */
  extraVerbs?: Record<string, string[]>;
}

export interface ExtractionResult {
  occurrences: ScanOccurrence[];
  candidates: ExtractionCandidate[];
}

/** Marks an id as belonging to a name discovered in this very run rather than
 * to a row in the database. Propagation turns these into entity creates and
 * `applyDelta` swaps them for real ids at accept time. */
export const PROVISIONAL_PREFIX = 'prov:';

export function provisionalIdFor(type: EntityType, name: string): string {
  return `${PROVISIONAL_PREFIX}${type}:${name.trim().toLowerCase().replace(/\s+/g, '-')}`;
}

export function isProvisionalId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(PROVISIONAL_PREFIX);
}

/** Does this signal name anything that only exists because pass 1 found it? */
function touchesProvisional(signal: ExtractionSignal): boolean {
  switch (signal.kind) {
    case 'item-transfer':
      return [signal.itemId, signal.fromId, signal.toId].some(isProvisionalId);
    case 'item-loss':
      return isProvisionalId(signal.itemId);
    case 'travel':
      return isProvisionalId(signal.actorId) || isProvisionalId(signal.placeId);
    case 'skill-learned':
      return isProvisionalId(signal.actorId) || isProvisionalId(signal.skillId);
    case 'relationship':
      return isProvisionalId(signal.fromId) || isProvisionalId(signal.toId);
    case 'quest-progress':
      return isProvisionalId(signal.questId) || isProvisionalId(signal.actorId);
  }
}

/**
 * When a name was typed two different ways in one run, the detector wins.
 *
 * Discovery types a name by its *shape* and surroundings; a phrase detector
 * types it by the verb it is bound to. "Vex learned Venom Strike" gives the
 * skill detector a skill and gives discovery a two-word capitalised phrase
 * that looks exactly like a person's name — and the two used to survive side
 * by side, so the codex gained a character called Venom Strike AND the skill
 * cascade lost its subject. Binding to a verb is the stronger claim, so the
 * discovery is re-typed to agree with it rather than competing.
 */
function arbitrateTypes(candidates: ExtractionCandidate[]): ExtractionCandidate[] {
  const typedBySignal = new Map<string, EntityType>();
  for (const c of candidates) {
    if (c.signal) typedBySignal.set(c.name.trim().toLowerCase(), c.entityType);
  }
  if (!typedBySignal.size) return candidates;

  let changed = false;
  const retyped = candidates.map((c) => {
    if (c.signal || c.matchType !== 'new') return c;
    const agreed = typedBySignal.get(c.name.trim().toLowerCase());
    if (!agreed || agreed === c.entityType) return c;
    changed = true;
    return {
      ...c,
      entityType: agreed,
      detector: `${c.detector ?? 'ner'}→${agreed}`,
      summary: c.summary
        ? `${c.summary} Re-typed: the prose binds this name to a ${agreed} verb.`
        : undefined,
    };
  });
  return changed ? dedupeCandidates(retyped) : candidates;
}

/** Which discoveries are solid enough to act as stand-in entities for the
 * second pass. Below this the name is probably scenery, and inventing
 * consequences for scenery is worse than missing them. */
const BOOTSTRAP_FLOOR = 0.5;

/** Consequences derived from names we only just invented are real findings,
 * but they are one inference further from the page than a confirmed
 * participant. The board should say so. */
const BOOTSTRAP_CONFIDENCE_CEILING = 0.7;

/** The always-available offline extraction pass, pure and DB-free:
 * 1. scan for known entity mentions (+ pronoun resolution)
 * 2. offline NER discovery of brand-new entities
 * 3. phrase detectors (item transfer/loss, travel, relationships, stats,
 *    quests, events, lore, dialogue, epithets, chains, allegiance)
 * 4. alias clustering + dedupe
 * 5. BOOTSTRAP: re-run the detectors with step 2's discoveries standing in as
 *    known entities, and keep whatever new consequences that unlocks
 *
 * Step 5 is what lets a project with an empty codex still produce cascades.
 * Detectors bind verbs to *known* entities, so on a fresh project every
 * "Marrow handed the Saltbrand to Vex" used to die on the first lookup: the
 * discovery pass had just found all three names, but nothing handed them to
 * the detectors. Now it does, and a first-ever paste of a whole book comes
 * back with ownership, travel and bonds already worked out.
 *
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
  const discovered = clusterAliases([
    ...discoverEntities(text, entities, { minRecurrence }),
    ...discoverCommonItems(text, entities),
  ]);

  const extraStatNames = entities
    .filter((e) => e.type === 'stats')
    .flatMap((e) => [e.name, ...(e.statPhrases ?? [])]);

  const detectorCandidates = runLocalDetectors({
    text,
    index,
    entities,
    confidenceOverrides: input.confidenceOverrides,
    extraVerbs: input.extraVerbs,
    extraStatNames,
  });

  const firstPass = arbitrateTypes(dedupeCandidates([...discovered, ...detectorCandidates]));

  // Stamp every fresh discovery with the id it will carry as a provisional
  // entity. The delta reuses this same string as the draft's localId, so a
  // patch produced in pass 2 already points at the draft pass 1 created.
  for (const c of firstPass) {
    if (c.matchType !== 'new' || c.suggestedAction !== 'create') continue;
    if (!c.name || c.name.includes('→')) continue;
    c.provisionalId = provisionalIdFor(c.entityType, c.name);
  }

  // Candidate occurrences: tag mentions of NEW discoveries (entityId null,
  // candidateName set) so accepting the candidate can backfill the id and
  // the Writer's Room can highlight them as pending. Legacy pattern.
  // Deliberately computed from the FIRST pass only — the bootstrap pass adds
  // consequences, never new highlight spans, so occurrence counts stay stable.
  for (const c of firstPass) {
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

  if (input.bootstrap === false) return { occurrences, candidates: firstPass };

  const provisional: KnownEntity[] = firstPass
    .filter((c) => c.provisionalId && c.confidence >= BOOTSTRAP_FLOOR)
    .map((c) => ({
      id: c.provisionalId!,
      type: c.entityType,
      name: c.name,
      aliases: ((c.suggestedChanges?.aliases as string[] | undefined) ?? []).filter(Boolean),
    }));
  if (!provisional.length) return { occurrences, candidates: firstPass };

  const merged = [...entities, ...provisional];
  const secondPass = runLocalDetectors({
    text,
    index: buildKnownIndex(merged),
    entities: merged,
    confidenceOverrides: input.confidenceOverrides,
    extraVerbs: input.extraVerbs,
    extraStatNames,
  });

  // Pass 1 already read some of these events, just with a participant it
  // could not name. Both passes run the same detectors over the same text, so
  // the same event lands on the same offsets — that, not the participant
  // names, is what identifies "this is the reading I already had, improved".
  const eventSite = (c: ExtractionCandidate): string =>
    `${c.signal?.kind}|${c.start ?? -1}|${c.end ?? -1}`;
  const priorBySite = new Map<string, ExtractionCandidate>();
  for (const c of firstPass) {
    if (c.signal) priorBySite.set(eventSite(c), c);
  }

  // A refinement keeps pass 1's confidence: resolving a participant makes a
  // reading better, never shakier. A genuinely new event — one only visible
  // because both participants were invented moments ago — is discounted.
  const unlocked: ExtractionCandidate[] = [];
  const supersededSites = new Set<string>();
  for (const c of secondPass) {
    if (!c.signal || !touchesProvisional(c.signal)) continue;
    const site = eventSite(c);
    const prior = priorBySite.get(site);
    if (prior) supersededSites.add(site);
    unlocked.push({
      ...c,
      confidence: prior
        ? Math.max(prior.confidence, c.confidence)
        : Math.min(c.confidence * 0.85, BOOTSTRAP_CONFIDENCE_CEILING),
      detector: prior ? c.detector : `${c.detector ?? 'detector'}:bootstrap`,
    });
  }
  if (!unlocked.length) return { occurrences, candidates: firstPass };

  // A superseded pass-1 candidate is not discarded — it loses its signal, so
  // the cascade is not read twice, but it stays on as the record that this
  // name is NEW. "Marrow handed the Saltbrand to Vex" is simultaneously the
  // discovery of the Saltbrand and the transfer of it; dropping the candidate
  // wholesale threw the discovery away and left the transfer pointing at
  // nothing.
  const surviving: ExtractionCandidate[] = [];
  for (const c of firstPass) {
    if (!c.signal || !supersededSites.has(eventSite(c))) {
      surviving.push(c);
      continue;
    }
    if (!c.provisionalId) continue;
    const { signal: _dropped, ...rest } = c;
    void _dropped;
    surviving.push(rest);
  }
  return { occurrences, candidates: dedupeCandidates([...surviving, ...unlocked]) };
}

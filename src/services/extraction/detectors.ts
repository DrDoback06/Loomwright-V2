import type { CandidateInterpretationKind, EntityType, EntityTypeSuggestion } from '@/domain/entity-types';
import {
  findEntityInSpan,
  findKnownEntityMention,
  type KnownEntity,
  type KnownIndex,
} from './known-index';
import { confidenceBand, makeSourceQuote, type ConfidenceBand } from './text-utils';
import { NER_STOPWORDS } from './ner-lexicon';

/**
 * A typed, role-labelled reading of a detected event.
 *
 * Detectors already work out *who did what to whom* — the item transfer
 * detector knows the giver and the receiver — but they flatten that into a
 * prose `summary` and an unordered `relatedEntityIds`, so a downstream rule
 * cannot tell the giver from the receiver without re-parsing the sentence.
 * Signals keep the roles, which is what propagation (X2) consumes: you can
 * only conflict-flag "the recorded owner is not who handed it over" if you
 * know which participant was the giver.
 *
 * `null` ids mean "named in the prose but not a known entity yet" — the rule
 * decides whether to create it or ask.
 */
export type ExtractionSignal =
  | {
      kind: 'item-transfer';
      /** Null when the prose named an item the codex has never seen. The
       * bootstrap pass resolves it to the draft discovery just created. */
      itemId: string | null;
      itemName: string;
      fromId: string | null;
      fromName: string | null;
      toId: string | null;
      toName: string | null;
    }
  | {
      kind: 'item-loss';
      itemId: string | null;
      itemName: string;
      destroyed: boolean;
    }
  | {
      kind: 'travel';
      actorId: string;
      actorName: string;
      placeId: string | null;
      placeName: string;
      /** Containment cue from the sentence: "a town in the Vraska region". */
      parentHint: string | null;
    }
  | {
      kind: 'skill-learned';
      actorId: string | null;
      actorName: string;
      skillId: string | null;
      skillName: string;
    }
  | {
      kind: 'relationship';
      fromId: string;
      fromName: string;
      toId: string;
      toName: string;
      bond: string;
    }
  | {
      kind: 'quest-progress';
      questId: string | null;
      questName: string;
      /** Which way the quest moved. `started` also covers a first mention. */
      phase: 'started' | 'advanced' | 'completed' | 'failed';
      /** The step text the prose described, when it named one. */
      step: string | null;
      actorId: string | null;
      actorName: string | null;
    };

/** Candidate shape produced by every detector — ported from the legacy
 * buildCandidate contract that the fixtures assert against. */
export interface ExtractionCandidate {
  entityType: EntityType;
  name: string;
  suggestedAction: 'create' | 'update' | 'merge';
  matchType: 'exact' | 'new' | 'ambiguous' | 'nickname' | 'fuzzy';
  existingEntityId?: string | null;
  suggestedChanges?: Record<string, unknown> | null;
  confidence: number;
  confidenceBand: ConfidenceBand;
  sourceQuote: string;
  sourceQuotes?: string[];
  relatedEntityIds?: string[];
  summary?: string;
  detector?: string;
  typeSuggestions?: EntityTypeSuggestion[];
  interpretation?: { kind: CandidateInterpretationKind; note: string };
  start?: number;
  end?: number;
  /** Role-labelled reading of the event, when the detector can name the
   * participants. Consumed by the propagation rules in services/intelligence. */
  signal?: ExtractionSignal;
  /** Set on brand-new discoveries: the stand-in id this name carries through
   * the bootstrap pass and into the delta as its draft `localId`. */
  provisionalId?: string;
}

/**
 * Identity of the EVENT a signal describes, independent of how well its
 * participants happened to resolve.
 *
 * Keyed on names rather than ids on purpose: the same "Vex learned Venom
 * Strike" is read once with `skillId: null` and again, after the bootstrap
 * pass, with the skill resolved to a stand-in. Those are one event described
 * twice, and keying on ids would let both survive into the review board as
 * two identical cascades.
 */
export function signalEventKey(signal: ExtractionSignal): string {
  const n = (value: string | null | undefined) => (value ?? '').trim().toLowerCase();
  switch (signal.kind) {
    case 'item-transfer':
      return `item-transfer|${n(signal.itemName)}|${n(signal.fromName)}|${n(signal.toName)}`;
    case 'item-loss':
      return `item-loss|${n(signal.itemName)}|${signal.destroyed}`;
    case 'travel':
      return `travel|${n(signal.actorName)}|${n(signal.placeName)}`;
    case 'skill-learned':
      return `skill-learned|${n(signal.actorName)}|${n(signal.skillName)}`;
    case 'relationship':
      return `relationship|${n(signal.fromName)}|${n(signal.toName)}|${n(signal.bond)}`;
    case 'quest-progress':
      return `quest-progress|${n(signal.questName)}|${signal.phase}|${n(signal.step)}`;
  }
}

type CandidateInput = Omit<ExtractionCandidate, 'confidenceBand'> & { confidenceBand?: ConfidenceBand };

export function buildCandidate(input: CandidateInput): ExtractionCandidate {
  return {
    ...input,
    confidenceBand: input.confidenceBand ?? confidenceBand(input.confidence),
    sourceQuotes:
      input.sourceQuotes && input.sourceQuotes.length
        ? input.sourceQuotes.slice(0, 3)
        : input.sourceQuote
          ? [input.sourceQuote]
          : [],
  };
}

/** Per-detector base confidences — user-tunable via extraction settings. */
export const DETECTOR_BASE_CONFIDENCE: Record<string, number> = {
  itemTransfer: 0.78,
  itemLoss: 0.72,
  travel: 0.8,
  skillLearned: 0.76,
  relationships: 0.74,
  statChange: 0.7,
  questProgression: 0.66,
  questProgress: 0.74,
  events: 0.7,
  lore: 0.62,
  dialogueAttribution: 0.78,
  roleEpithet: 0.66,
  eventChain: 0.6,
  factionAllegiance: 0.72,
};

export interface DetectorContext {
  text: string;
  index: KnownIndex;
  entities: KnownEntity[];
  /** Settings ▸ Extraction per-detector confidence overrides. */
  confidenceOverrides?: Record<string, number>;
  /** Settings ▸ Extraction author-taught verbs, keyed by detector id. */
  extraVerbs?: Record<string, string[]>;
  /** Project-defined stat names (stats entities) extend the built-in
   * stat vocabulary for the stat-change detector. */
  extraStatNames?: string[];
}

function detectorConfidence(
  ctx: DetectorContext,
  detectorId: string,
  opts: { proximity?: number; near?: number } = {}
): number {
  let base = DETECTOR_BASE_CONFIDENCE[detectorId] ?? 0.7;
  const o = Number(ctx.confidenceOverrides?.[detectorId]);
  if (Number.isFinite(o) && o > 0 && o <= 1) base = o;
  if (opts.proximity != null && opts.proximity <= (opts.near ?? 60)) {
    base = Math.min(0.9, Math.round((base + 0.06) * 100) / 100);
  }
  return base;
}

const ITEM_TRANSFER_VERBS = /(gave|handed|tossed|passed|sold|threw|surrendered|delivered)/i;
const ITEM_LOSS_VERBS = /(lost|broke|shattered|left behind|dropped|abandoned|destroyed)/i;
const TRAVEL_VERBS =
  /(crossed|entered|left|reached|arrived at|fled|returned to|set out for|came to|travelled to|walked to|rode to|sailed to)/i;
const RELATIONSHIP_VERBS =
  /(whispered to|shouted at|confronted|kissed|embraced|struck|saved|betrayed|abandoned|forgave|comforted|trusted)/i;
const STAT_VERBS =
  /(grew|hardened|weakened|broke|sharpened|dulled|surged|faltered|crumbled|swelled|kindled)/i;
const COMMON_STATS = ['resolve', 'fear', 'hope', 'strength', 'wit', 'grief', 'courage', 'rage', 'doubt'];

function inner(re: RegExp): string {
  return re.source.slice(1, -1);
}

/**
 * A detector's verb list, widened by whatever the author added in
 * Settings ▸ Extraction.
 *
 * Every verb list here is a closed set of about a dozen words, which is fine
 * for high-fantasy register and useless for anything else: "nicked", "palmed",
 * "slipped him", "legged it to" are ordinary English that the engine simply
 * could not see. Authors know their own vocabulary — this lets them teach it.
 * Entries are escaped and shape-checked, so a stray character cannot turn a
 * verb list into a catastrophic regex.
 */
function verbSource(ctx: DetectorContext, detectorId: string, base: RegExp): string {
  const extra = (ctx.extraVerbs?.[detectorId] ?? [])
    .map((verb) => verb.trim())
    .filter((verb) => /^[\p{L}][\p{L}\s'’-]{1,39}$/u.test(verb))
    .map((verb) => verb.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const source = inner(base);
  return extra.length ? `${source}|${[...new Set(extra)].join('|')}` : source;
}

/**
 * Start of the sentence containing `pos`, clamped to `window` characters back.
 *
 * The subject of a verb is in the SAME sentence as the verb. Scanning a flat
 * 80-character window reaches back across sentence boundaries, so in
 * "Vex learned Venom Strike. Aelinor reached Ashen Ford" — where Aelinor is not
 * yet a known character — the travel detector found Vex in the previous
 * sentence and attributed the journey to the wrong person. Silently wrong
 * attribution is worse than no candidate at all.
 */
function sentenceStart(text: string, pos: number, window: number): number {
  const floor = Math.max(0, pos - window);
  for (let i = pos - 1; i > floor; i--) {
    const ch = text[i];
    if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') return i + 1;
  }
  return floor;
}

/** End of the sentence containing `pos`, clamped to `window` characters on.
 * The mirror of sentenceStart: the object of a verb is in the verb's own
 * sentence, so a forward window that runs past the full stop will happily
 * pick a participant out of the NEXT sentence. */
function sentenceEnd(text: string, pos: number, window: number): number {
  const ceiling = Math.min(text.length, pos + window);
  for (let i = pos; i < ceiling; i++) {
    const ch = text[i];
    if (ch === '.' || ch === '!' || ch === '?' || ch === '\n') return i;
  }
  return ceiling;
}

export function detectItemTransfers(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, index } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const verbRe = new RegExp(`(${verbSource(ctx, 'itemTransfer', ITEM_TRANSFER_VERBS)})`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = verbRe.exec(text)) !== null) {
    const verbStart = m.index;
    const verbEnd = m.index + m[0].length;
    const left = { start: sentenceStart(text, verbStart, 80), end: verbStart };
    const right = { start: verbEnd, end: sentenceEnd(text, verbEnd, 160) };
    const giver = findEntityInSpan(text, left, index, ['cast']);
    const item = findEntityInSpan(text, right, index, ['items']);
    const receiver = findEntityInSpan(text, right, index, ['cast']);
    // "Marrow handed the Saltbrand to Vex" is a transfer whether or not the
    // Saltbrand is already in the codex. Naming the direct object ourselves —
    // the way the skill detector already names an unheard-of technique — is
    // what lets a first-ever paste track an item introduced on the same page.
    const namedItem = item ? null : findUnknownItemName(text, right, index);
    if (!item && !namedItem) continue;
    const itemName = item ? item.name : namedItem!.name;
    const itemOffset = item ? item.offset : namedItem!.offset;
    const suggestedChanges: Record<string, unknown> = {};
    if (receiver) {
      suggestedChanges.currentOwner = { id: receiver.id, name: receiver.name, type: 'cast' };
      suggestedChanges.ownerId = receiver.id;
    }
    out.push(
      buildCandidate({
        entityType: 'items',
        name: itemName,
        existingEntityId: item?.id ?? null,
        suggestedAction: item ? 'update' : 'create',
        suggestedChanges,
        confidence: detectorConfidence(ctx, 'itemTransfer', {
          proximity: Math.abs((itemOffset || 0) - verbStart),
        }),
        matchType: item ? 'exact' : 'new',
        sourceQuote: makeSourceQuote(text, verbStart, verbEnd),
        start: itemOffset,
        end: itemOffset + itemName.length,
        relatedEntityIds: [giver?.id, receiver?.id].filter(Boolean) as string[],
        summary: `Item ${itemName} transferred${receiver ? ' to ' + receiver.name : ''}${giver ? ' by ' + giver.name : ''}.`,
        detector: 'itemTransfer',
        signal: {
          kind: 'item-transfer',
          itemId: item?.id ?? null,
          itemName,
          fromId: giver?.id ?? null,
          fromName: giver?.name ?? null,
          toId: receiver?.id ?? null,
          toName: receiver?.name ?? null,
        },
      })
    );
  }
  return out;
}

export function detectItemLoss(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, index } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const verbRe = new RegExp(`(${verbSource(ctx, 'itemLoss', ITEM_LOSS_VERBS)})`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = verbRe.exec(text)) !== null) {
    const verbStart = m.index;
    const verbEnd = verbStart + m[0].length;
    const verbWord = m[0].toLowerCase();
    const right = { start: verbEnd, end: sentenceEnd(text, verbEnd, 160) };
    const item = findEntityInSpan(text, right, index, ['items']);
    const namedItem = item ? null : findUnknownItemName(text, right, index);
    if (!item && !namedItem) continue;
    const itemName = item ? item.name : namedItem!.name;
    const itemOffset = item ? item.offset : namedItem!.offset;
    const changes: Record<string, unknown> = {};
    if (/lost|left behind|dropped|abandoned/.test(verbWord)) changes.lost = true;
    if (/broke|shattered|destroyed/.test(verbWord)) changes.destroyed = true;
    out.push(
      buildCandidate({
        entityType: 'items',
        name: itemName,
        existingEntityId: item?.id ?? null,
        suggestedAction: item ? 'update' : 'create',
        suggestedChanges: changes,
        confidence: 0.72,
        matchType: item ? 'exact' : 'new',
        sourceQuote: makeSourceQuote(text, verbStart, verbEnd),
        start: itemOffset,
        end: itemOffset + itemName.length,
        summary: `Item ${itemName} ${changes.destroyed ? 'destroyed' : 'lost'}.`,
        detector: 'itemLoss',
        signal: {
          kind: 'item-loss',
          itemId: item?.id ?? null,
          itemName,
          destroyed: Boolean(changes.destroyed),
        },
      })
    );
  }
  return out;
}

/** Object nouns a determiner can front, for the "the bread knife" case where
 * prose never capitalises the thing being handed over. */
const ITEM_HEAD_NOUN =
  'sword|blade|dagger|knife|axe|bow|spear|lance|mace|hammer|flail|club|whip|ring|amulet|crown|circlet|cloak|robe|staff|wand|rod|sceptre|scepter|shield|tome|grimoire|chalice|goblet|orb|gauntlets|gauntlet|helm|helmet|pendant|necklace|locket|relic|key|crystal|gem|jewel|stone|elixir|potion|scroll|banner|horn|bell|mirror|talisman|charm|armour|armor|boots|gloves|belt|brooch|lantern|compass|map|ledger|purse|letter|package|parcel|bundle';

/**
 * The direct object of a transfer or loss verb, when the codex has never heard
 * of it.
 *
 * English marks it plainly: a determiner followed by either a capitalised
 * proper name ("the Saltbrand") or an object noun ("the bread knife"). What it
 * must never return is the *recipient* — "gave Vex the letter" has two noun
 * phrases and only one of them is the thing — so known cast and place names
 * are excluded, and so is anything sitting after a "to"/"from" preposition.
 */
function findUnknownItemName(
  text: string,
  span: { start: number; end: number },
  index: KnownIndex
): { name: string; offset: number } | null {
  const window = text.slice(span.start, span.end);
  const re = new RegExp(
    `\\b(?:the|a|an|his|her|their|its|my|your|our)\\s+((?:[a-z]+\\s+){0,2}(?:${ITEM_HEAD_NOUN})\\b|[A-Z][A-Za-z'’-]+(?:\\s+[A-Z][A-Za-z'’-]+){0,2})`,
    'g'
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(window)) !== null) {
    const raw = m[1].trim();
    if (!raw || raw.length < 3) continue;
    if (NER_STOPWORDS.has(raw.toLowerCase())) continue;
    const offset = span.start + m.index + m[0].indexOf(raw);

    // A determiner cannot front a recipient in English ("to the Vex" is not a
    // sentence), but a known person or place may still be named this way in
    // apposition — skip those rather than inventing a duplicate item.
    const clash =
      findEntityInSpan(text, { start: offset, end: offset + raw.length }, index, [
        'cast',
        'locations',
        'factions',
      ]) !== null;
    if (clash) continue;

    const name = /^[a-z]/.test(raw) ? raw[0].toUpperCase() + raw.slice(1) : raw;
    return { name, offset };
  }
  return null;
}

export function detectTravel(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, index } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const verbRe = new RegExp(`(${verbSource(ctx, 'travel', TRAVEL_VERBS)})`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = verbRe.exec(text)) !== null) {
    const verbStart = m.index;
    const verbEnd = verbStart + m[0].length;
    const left = { start: sentenceStart(text, verbStart, 80), end: verbStart };
    const right = { start: verbEnd, end: sentenceEnd(text, verbEnd, 160) };
    const actor = findEntityInSpan(text, left, index, ['cast']);
    if (!actor) continue;

    // A place the project has never heard of still moves the character and
    // still wants nesting — "reached Ashen Ford, a town in the Vraska region".
    // Offline discovery creates the location candidate itself; here we only
    // need the destination's name so the travel rule can match it.
    const knownPlace = findEntityInSpan(text, right, index, ['locations']);
    const unknownPlace = findUnknownPlaceName(text, right);

    // The destination is whatever follows the verb, so proximity decides. In
    // the sentence above the known entity ("Vraska") sits inside the trailing
    // containment cue and is the *parent*, not the destination — taking it
    // would move the character to the region and lose the town entirely.
    const place =
      knownPlace && (!unknownPlace || knownPlace.offset <= unknownPlace.offset)
        ? knownPlace
        : null;
    if (!place && !unknownPlace) continue;

    const placeName = place ? place.name : unknownPlace!.name;
    out.push(
      buildCandidate({
        entityType: 'cast',
        name: actor.name,
        existingEntityId: actor.id,
        suggestedAction: 'update',
        // `location` (bare id) is the legacy key the golden fixtures pin.
        // The real cast field is `currentLocation` and takes an EntityRef —
        // the travel propagation rule writes that from the signal below.
        suggestedChanges: place ? { location: place.id } : {},
        confidence: detectorConfidence(ctx, 'travel', {
          proximity: Math.abs((place?.offset || 0) - verbEnd),
        }),
        matchType: 'exact',
        sourceQuote: makeSourceQuote(text, verbStart, verbEnd),
        start: actor.offset,
        end: actor.offset + actor.matchText.length,
        relatedEntityIds: place ? [place.id] : [],
        summary: `${actor.name} travelled to ${placeName}.`,
        detector: 'travel',
        signal: {
          kind: 'travel',
          actorId: actor.id,
          actorName: actor.name,
          placeId: place?.id ?? null,
          placeName,
          parentHint: findContainmentHint(text, right.start, right.end),
        },
      })
    );
  }
  return out;
}

/** A capitalised proper noun immediately after a travel verb, skipping
 * leading articles/prepositions. Deliberately narrow — discovery owns
 * general NER; this only names a travel destination. */
function findUnknownPlaceName(
  text: string,
  span: { start: number; end: number }
): { name: string; offset: number } | null {
  const window = text.slice(span.start, span.end);
  const m = /^\s*(?:in|into|to|at|for|toward|towards|upon)?\s*(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/.exec(
    window
  );
  if (!m) return null;
  const name = m[1].trim();
  if (NER_STOPWORDS.has(name.toLowerCase())) return null;
  return { name, offset: span.start + window.indexOf(name) };
}

/** Containment cue naming a parent place: "a town in the Vraska region",
 * "a village of the Reach". Returns the parent's bare name. */
function findContainmentHint(text: string, start: number, end: number): string | null {
  const window = text.slice(start, Math.min(text.length, end + 60));
  const m =
    /\b(?:a|an|the)\s+\w+(?:\s+\w+)?\s+(?:in|of|within|inside)\s+(?:the\s+)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})/.exec(
      window
    );
  if (!m) return null;
  // Trim a trailing common noun the cue swept up ("Vraska region" → "Vraska").
  return m[1].replace(/\s+(region|province|realm|territory|lands?|valley|reach)$/i, '').trim();
}

export function detectRelationships(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, index } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const verbRe = new RegExp(`(${verbSource(ctx, 'relationships', RELATIONSHIP_VERBS)})`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = verbRe.exec(text)) !== null) {
    const verbStart = m.index;
    const verbEnd = verbStart + m[0].length;
    const verbWord = m[0].toLowerCase().replace(/\s+/g, '-');
    const left = { start: sentenceStart(text, verbStart, 80), end: verbStart };
    const right = { start: verbEnd, end: sentenceEnd(text, verbEnd, 120) };
    const subject = findEntityInSpan(text, left, index, ['cast']);
    const object = findEntityInSpan(text, right, index, ['cast']);
    if (!subject || !object || subject.id === object.id) continue;
    out.push(
      buildCandidate({
        entityType: 'relationships',
        name: `${subject.name} → ${object.name}`,
        suggestedAction: 'create',
        confidence: detectorConfidence(ctx, 'relationships', {
          proximity: Math.abs((object.offset || 0) - verbEnd),
        }),
        matchType: 'new',
        sourceQuote: makeSourceQuote(text, verbStart, verbEnd),
        start: verbStart,
        end: verbEnd,
        relatedEntityIds: [subject.id, object.id],
        suggestedChanges: { fromId: subject.id, toId: object.id, relationshipType: verbWord },
        summary: `${subject.name} ${m[0]} ${object.name}.`,
        detector: 'relationships',
        signal: {
          kind: 'relationship',
          fromId: subject.id,
          fromName: subject.name,
          toId: object.id,
          toName: object.name,
          bond: verbWord,
        },
      })
    );
  }
  return out;
}

export function detectStatChanges(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, entities } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const statNames = [
    ...COMMON_STATS,
    ...(ctx.extraStatNames ?? [])
      .map((n) => n.toLowerCase().trim())
      .filter((n) => /^[a-z][a-z -]{1,30}$/.test(n)),
  ];
  const re = new RegExp(
    `([A-Z][A-Za-z]+)(?:'s)\\s+(${[...new Set(statNames)].join('|')})\\s+(${verbSource(ctx, 'statChange', STAT_VERBS)})`,
    'gi'
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const statName = m[2].toLowerCase();
    const verb = m[3].toLowerCase();
    const actorMatch = findKnownEntityMention(m[1], entities, { threshold: 0.95 });
    if (!actorMatch) continue;
    const direction = /(grew|hardened|sharpened|surged|swelled|kindled)/.test(verb) ? 'up' : 'down';
    out.push(
      buildCandidate({
        entityType: 'stats',
        name: statName,
        suggestedAction: 'create',
        confidence: detectorConfidence(ctx, 'statChange'),
        matchType: 'new',
        sourceQuote: makeSourceQuote(text, m.index, m.index + m[0].length),
        start: m.index,
        end: m.index + m[0].length,
        relatedEntityIds: [actorMatch.entity.id],
        suggestedChanges: { actorId: actorMatch.entity.id, statName, direction, verb },
        summary: `${actorMatch.entity.name}'s ${statName} ${verb}.`,
        detector: 'statChange',
      })
    );
  }
  return out;
}

export function detectQuestProgression(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, entities } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const re =
    /[Tt]he\s+(?:hunt|search|journey|mission|quest)\s+(?:for|to|against)\s+(?:the\s+)?([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const subject = m[1];
    const subjectMatch = findKnownEntityMention(subject, entities, { threshold: 0.85 });
    const start = m.index;
    const end = m.index + m[0].length;
    out.push(
      buildCandidate({
        entityType: 'quests',
        name: m[0]
          .replace(/^[Tt]he\s+/, '')
          .replace(
            /^(hunt|search|journey|mission|quest) (for|to|against)\s+(the\s+)?/i,
            (_s, verb: string) => verb[0].toUpperCase() + verb.slice(1) + ' for '
          )
          .trim(),
        suggestedAction: 'create',
        confidence: detectorConfidence(ctx, 'questProgression'),
        matchType: 'new',
        sourceQuote: makeSourceQuote(text, start, end),
        start,
        end,
        relatedEntityIds: subjectMatch ? [subjectMatch.entity.id] : [],
        suggestedChanges: { subject: subjectMatch?.entity.id ?? subject, phase: 'in-progress' },
        summary: `Quest involving ${subject}.`,
        detector: 'questProgression',
      })
    );
  }
  return out;
}

const QUEST_COMPLETE =
  /(completed|finished|fulfilled|concluded|closed|won|achieved|delivered on|saw\s+\w+\s+through|made good on)/i;
const QUEST_FAIL = /(failed|abandoned|gave up on|forsook|called off|lost|broke)/i;
const QUEST_ADVANCE =
  /(pressed on with|continued|advanced|resumed|made progress on|took up|set out on|swore to|accepted|began|started|renewed|turned back to)/i;

/**
 * A quest the codex already knows *moved*.
 *
 * The existing quest detector reports that a quest EXISTS — "the hunt for the
 * Saltbrand" — which is a discovery, not a progression, and it is why quest
 * propagation shipped with nothing to propagate. This one binds a status verb
 * to a quest already on the board, so "they finally completed the Hunt for the
 * Saltbrand" moves the status pill and closes out the open steps.
 */
export function detectQuestProgress(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, index } = ctx;
  if (!text) return [];
  const quests = index.quests ?? [];
  if (!quests.length) return [];
  const out: ExtractionCandidate[] = [];

  for (const quest of quests) {
    if (!quest.regex) continue;
    quest.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = quest.regex.exec(text)) !== null) {
      const at = m.index;
      const from = sentenceStart(text, at, 200);
      const to = sentenceEnd(text, at + m[0].length, 200);
      const sentence = text.slice(from, to);
      // Only the words on the quest's own side of the sentence decide the
      // phase — a later clause about something else must not flip a status.
      const before = text.slice(from, at);

      let phase: Extract<ExtractionSignal, { kind: 'quest-progress' }>['phase'] | null = null;
      if (QUEST_COMPLETE.test(before)) phase = 'completed';
      else if (QUEST_FAIL.test(before)) phase = 'failed';
      else if (QUEST_ADVANCE.test(before)) phase = 'advanced';
      if (!phase) continue;

      const actor = findEntityInSpan(text, { start: from, end: at }, index, ['cast']);
      const step = sentence.replace(/\s+/g, ' ').trim().slice(0, 160) || null;
      out.push(
        buildCandidate({
          entityType: 'quests',
          name: quest.name,
          existingEntityId: quest.id,
          suggestedAction: 'update',
          matchType: 'exact',
          confidence: detectorConfidence(ctx, 'questProgress'),
          sourceQuote: makeSourceQuote(text, from, to),
          start: at,
          end: at + m[0].length,
          relatedEntityIds: actor ? [actor.id] : [],
          summary: `${quest.name} ${phase}.`,
          detector: 'questProgress',
          signal: {
            kind: 'quest-progress',
            questId: quest.id,
            questName: quest.name,
            phase,
            step,
            actorId: actor?.id ?? null,
            actorName: actor?.name ?? null,
          },
        })
      );
      if (m.index === quest.regex.lastIndex) quest.regex.lastIndex++;
    }
  }
  return out;
}

export function detectEvents(ctx: DetectorContext): ExtractionCandidate[] {
  const { text } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const re =
    /(?:the\s+)?([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,2})\s+(began|started|broke out|came to an end|erupted|ended)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const eventName = m[1];
    if (/^(He|She|They|It|We|You|Then|Now)$/.test(eventName)) continue;
    const start = m.index;
    const end = m.index + m[0].length;
    out.push(
      buildCandidate({
        entityType: 'events',
        name: eventName,
        suggestedAction: 'create',
        confidence: detectorConfidence(ctx, 'events'),
        matchType: 'new',
        sourceQuote: makeSourceQuote(text, start, end),
        start,
        end,
        suggestedChanges: { eventType: 'named-event', verb: m[2] },
        summary: `Event "${eventName}" ${m[2]}.`,
        detector: 'events',
      })
    );
  }
  return out;
}

export function detectLore(ctx: DetectorContext): ExtractionCandidate[] {
  const { text } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const re =
    /(it was said(?: that)?|the legend (?:of|said)|centuries ago|long before|once,? long ago)\s+([^.!?\n]{8,200})/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    const phrase = m[2].trim();
    out.push(
      buildCandidate({
        entityType: 'lore',
        name: phrase.split(/[,;]/)[0].slice(0, 80) || 'Lore fragment',
        suggestedAction: 'create',
        confidence: detectorConfidence(ctx, 'lore'),
        matchType: 'new',
        sourceQuote: makeSourceQuote(text, start, end),
        start,
        end,
        suggestedChanges: {
          scope: /centuries ago|long before|long ago/i.test(m[1]) ? 'world-history' : 'legend',
          body: phrase,
        },
        summary: `Lore: ${phrase.slice(0, 100)}${phrase.length > 100 ? '…' : ''}`,
        detector: 'lore',
      })
    );
  }
  return out;
}

const SAID_VERBS =
  'said|asked|replied|whispered|shouted|muttered|answered|growled|called|murmured|snapped|breathed|hissed|added';

export function detectDialogueAttribution(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, index } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const unknownCounts = new Map<string, { quote: string; offset: number }[]>();
  const hit = (quote: string, name: string, offset: number, matchLen: number) => {
    const span = { start: offset, end: offset + matchLen };
    const speaker = findEntityInSpan(text, span, index, ['cast']);
    const line = (quote ?? '').trim().slice(0, 200);
    if (!line) return;
    if (speaker) {
      out.push(
        buildCandidate({
          entityType: 'cast',
          name: speaker.name,
          existingEntityId: speaker.id,
          suggestedAction: 'update',
          suggestedChanges: { voiceProfile: '“' + line + '”' },
          confidence: detectorConfidence(ctx, 'dialogueAttribution'),
          matchType: 'exact',
          sourceQuote: makeSourceQuote(text, span.start, span.end),
          start: speaker.offset,
          end: speaker.offset + speaker.matchText.length,
          summary: `Line attributed to ${speaker.name}: “${line.slice(0, 80)}${line.length > 80 ? '…' : ''}”`,
          detector: 'dialogueAttribution',
        })
      );
    } else if (/^[A-Z][a-zA-Z'’-]+$/.test(name) && !NER_STOPWORDS.has(name.toLowerCase())) {
      const list = unknownCounts.get(name) ?? [];
      list.push({ quote: makeSourceQuote(text, span.start, span.end), offset });
      unknownCounts.set(name, list);
    }
  };
  const reA = new RegExp(
    '["“]([^"”]{2,200})["”]\\s*,?\\s*(?:' + SAID_VERBS + ')\\s+([A-Z][a-zA-Z\'’-]+)',
    'g'
  );
  let m: RegExpExecArray | null;
  while ((m = reA.exec(text)) !== null) hit(m[1], m[2], m.index, m[0].length);
  const reB = new RegExp(
    '\\b([A-Z][a-zA-Z\'’-]+)\\s+(?:' + SAID_VERBS + ')\\s*,?\\s*["“]([^"”]{2,200})["”]',
    'g'
  );
  while ((m = reB.exec(text)) !== null) hit(m[2], m[1], m.index, m[0].length);
  for (const [name, lines] of unknownCounts) {
    if (lines.length < 2) continue;
    out.push(
      buildCandidate({
        entityType: 'cast',
        name,
        suggestedAction: 'create',
        suggestedChanges: {},
        confidence: 0.62,
        matchType: 'new',
        sourceQuote: lines[0].quote,
        sourceQuotes: lines.slice(0, 3).map((l) => l.quote),
        start: lines[0].offset,
        end: lines[0].offset + name.length,
        summary: `${name} speaks ${lines.length} times but has no cast record.`,
        detector: 'dialogueAttribution',
      })
    );
  }
  return out;
}

const ROLE_EPITHETS = [
  'baker', 'smith', 'blacksmith', 'captain', 'innkeeper', 'healer', 'guard', 'priest', 'priestess',
  'ferryman', 'drover', 'keeper', 'warden', 'steward', 'scribe', 'miller', 'hunter', 'fisher',
  'midwife', 'sergeant', 'merchant', 'butcher', 'brewer', 'shepherd', 'carpenter', 'mason',
  'archivist', 'chandler', 'tanner', 'weaver', 'sailor', 'soldier', 'watchman', 'gatekeeper',
];

export function detectRoleEpithets(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, index } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const standalone = new Map<string, { offset: number; quote: string }[]>();
  const re = new RegExp(
    "\\b[Tt]he\\s+((?:[A-Z][a-zA-Z'’-]+-)?(?:" + ROLE_EPITHETS.join('|') + '))\\b',
    'g'
  );
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const epithet = m[1];
    const start = m.index;
    const end = m.index + m[0].length;
    const apposition = /^[^.!?;]{0,50}?\b(?:named|called)\s+([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+)?)/.exec(
      text.slice(end, end + 70)
    );
    let near = null;
    if (apposition) {
      const known = findEntityInSpan(text, { start: end, end: end + 70 }, index, ['cast']);
      if (known && apposition[1].includes(known.matchText)) near = known;
      else continue;
    } else {
      near = findEntityInSpan(text, { start: Math.max(0, start - 60), end: start }, index, ['cast']);
    }
    if (near) {
      out.push(
        buildCandidate({
          entityType: 'cast',
          name: near.name,
          existingEntityId: near.id,
          suggestedAction: 'update',
          suggestedChanges: { occupation: epithet.toLowerCase() },
          confidence: detectorConfidence(ctx, 'roleEpithet', {
            proximity: Math.abs(near.offset - start),
          }),
          matchType: 'exact',
          sourceQuote: makeSourceQuote(text, start, end),
          start,
          end,
          summary: `${near.name} is "the ${epithet}".`,
          detector: 'roleEpithet',
        })
      );
    } else {
      const list = standalone.get(epithet.toLowerCase()) ?? [];
      list.push({ offset: start, quote: makeSourceQuote(text, start, end) });
      standalone.set(epithet.toLowerCase(), list);
    }
  }
  for (const [epithet, hits] of standalone) {
    if (hits.length < 3) continue;
    const display = 'The ' + epithet.charAt(0).toUpperCase() + epithet.slice(1);
    const already = (ctx.index.cast ?? []).some(
      (c) => c.name.toLowerCase() === display.toLowerCase()
    );
    if (already) continue;
    out.push(
      buildCandidate({
        entityType: 'cast',
        name: display,
        suggestedAction: 'create',
        suggestedChanges: { occupation: epithet, epithet: true },
        confidence: 0.55,
        matchType: 'new',
        sourceQuote: hits[0].quote,
        sourceQuotes: hits.slice(0, 3).map((h) => h.quote),
        start: hits[0].offset,
        end: hits[0].offset + display.length,
        summary: `"${display}" appears ${hits.length} times with no record — an unnamed recurring character?`,
        detector: 'roleEpithet',
      })
    );
  }
  return out;
}

const CHAIN_CAUSE_RIGHT = /(because of|as a result of|in the wake of|in retaliation for|caused by)/i;
const CHAIN_EFFECT_RIGHT = /(which led to|led to|sparked|triggered|set off|gave rise to)/i;

export function detectEventChaining(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, index } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const scan = (re: RegExp, causeSide: 'left' | 'right') => {
    const verbRe = new RegExp(re.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = verbRe.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      const left = { start: Math.max(0, start - 120), end: start };
      const right = { start: end, end: Math.min(text.length, end + 120) };
      const leftEnt = findEntityInSpan(text, left, index, ['events', 'quests']);
      const rightEnt = findEntityInSpan(text, right, index, ['events', 'quests']);
      if (!leftEnt || !rightEnt || leftEnt.id === rightEnt.id) continue;
      const cause = causeSide === 'right' ? rightEnt : leftEnt;
      const effect = causeSide === 'right' ? leftEnt : rightEnt;
      if (effect.type === 'quests' && cause.type === 'quests') continue;
      const quote = makeSourceQuote(text, start, end);
      out.push(
        buildCandidate({
          entityType: 'events',
          name: effect.name,
          existingEntityId: effect.type === 'events' ? effect.id : undefined,
          suggestedAction: effect.type === 'events' ? 'update' : 'create',
          suggestedChanges: { cause: `${cause.name} — “${quote.slice(0, 100)}”` },
          confidence: detectorConfidence(ctx, 'eventChain'),
          matchType: effect.type === 'events' ? 'exact' : 'new',
          sourceQuote: quote,
          start: effect.offset,
          end: effect.offset + effect.matchText.length,
          relatedEntityIds: [cause.id],
          summary: `${effect.name} follows from ${cause.name}.`,
          detector: 'eventChain',
        })
      );
    }
  };
  scan(CHAIN_CAUSE_RIGHT, 'right');
  scan(CHAIN_EFFECT_RIGHT, 'left');
  return out;
}

const ALLEGIANCE_VERBS =
  /(swore (?:fealty |allegiance )?to|sworn to|pledged (?:herself |himself |themselves )?to|joined|defected to|under the banner of|took the banner of|banner of)/i;

export function detectFactionAllegiance(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, index } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const verbRe = new RegExp(ALLEGIANCE_VERBS.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = verbRe.exec(text)) !== null) {
    const start = m.index;
    const end = m.index + m[0].length;
    const left = { start: Math.max(0, start - 90), end: start };
    const right = { start: end, end: Math.min(text.length, end + 100) };
    const actor = findEntityInSpan(text, left, index, ['cast']);
    if (!actor) continue;
    const faction = findEntityInSpan(text, right, index, ['factions']);
    const quote = makeSourceQuote(text, start, end);
    if (faction) {
      out.push(
        buildCandidate({
          entityType: 'cast',
          name: actor.name,
          existingEntityId: actor.id,
          suggestedAction: 'update',
          suggestedChanges: { faction: { id: faction.id, name: faction.name, type: 'factions' } },
          confidence: detectorConfidence(ctx, 'factionAllegiance', {
            proximity: (faction.offset || end) - end,
          }),
          matchType: 'exact',
          sourceQuote: quote,
          start: actor.offset,
          end: actor.offset + actor.matchText.length,
          relatedEntityIds: [faction.id],
          summary: `${actor.name} swears to ${faction.name}.`,
          detector: 'factionAllegiance',
        })
      );
    } else {
      const slice = text.slice(right.start, right.end);
      const fm = /^\s*(?:the\s+)?([A-Z][\w'’-]+(?:\s+[A-Z][\w'’-]+){0,2})/.exec(slice);
      if (fm && !NER_STOPWORDS.has(fm[1].toLowerCase())) {
        out.push(
          buildCandidate({
            entityType: 'factions',
            name: fm[1],
            suggestedAction: 'create',
            suggestedChanges: { members: [{ id: actor.id, name: actor.name, type: 'cast' }] },
            confidence: 0.55,
            matchType: 'new',
            sourceQuote: quote,
            start: right.start + (fm.index ?? 0),
            end: right.start + (fm.index ?? 0) + fm[1].length,
            relatedEntityIds: [actor.id],
            summary: `${actor.name} swears to "${fm[1]}" — no faction record yet.`,
            detector: 'factionAllegiance',
          })
        );
      }
    }
  }
  return out;
}

const SKILL_LEARN_VERBS =
  /(learned|mastered|studied|practised|practiced|was taught|taught herself|taught himself|taught themselves|picked up|perfected)/i;

/**
 * "Vex learned Venom Strike" — the headline case for propagation. The skill
 * may be known or brand new; either way the rule attaches it to the character,
 * places it on a tree, and offers what it grows into.
 *
 * Quoted skill names win over bare capitalised ones because prose commonly
 * writes them as 'the Serpent's Coil' or "Venom Strike".
 */
export function detectSkillLearning(ctx: DetectorContext): ExtractionCandidate[] {
  const { text, index } = ctx;
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const verbRe = new RegExp(`(${verbSource(ctx, 'skillLearned', SKILL_LEARN_VERBS)})`, 'gi');
  let m: RegExpExecArray | null;
  while ((m = verbRe.exec(text)) !== null) {
    const verbStart = m.index;
    const verbEnd = verbStart + m[0].length;
    const left = { start: sentenceStart(text, verbStart, 80), end: verbStart };
    const right = { start: verbEnd, end: sentenceEnd(text, verbEnd, 120) };

    const actor = findEntityInSpan(text, left, index, ['cast']);
    const knownSkill = findEntityInSpan(text, right, index, ['skills']);
    const skillName = knownSkill ? knownSkill.name : findSkillName(text, right);
    if (!actor && !skillName) continue;
    if (!skillName) continue;

    out.push(
      buildCandidate({
        entityType: 'skills',
        name: skillName,
        existingEntityId: knownSkill?.id ?? null,
        suggestedAction: knownSkill ? 'update' : 'create',
        matchType: knownSkill ? 'exact' : 'new',
        suggestedChanges: actor
          ? { assignedCast: [{ id: actor.id, type: 'cast', name: actor.name }] }
          : {},
        confidence: detectorConfidence(ctx, 'skillLearned', {
          proximity: Math.abs((knownSkill?.offset ?? verbEnd) - verbEnd),
        }),
        sourceQuote: makeSourceQuote(text, verbStart, verbEnd),
        start: verbStart,
        end: verbEnd,
        relatedEntityIds: actor ? [actor.id] : [],
        summary: actor
          ? `${actor.name} learned ${skillName}.`
          : `${skillName} was learned.`,
        detector: 'skillLearned',
        signal: {
          kind: 'skill-learned',
          actorId: actor?.id ?? null,
          actorName: actor?.name ?? '',
          skillId: knownSkill?.id ?? null,
          skillName,
        },
      })
    );
  }
  return out;
}

/** A skill name after a learning verb: quoted first, then a capitalised
 * phrase, skipping the articles prose puts in the way. */
function findSkillName(text: string, span: { start: number; end: number }): string | null {
  const window = text.slice(span.start, span.end);
  const quoted = /^[^.?!]{0,40}?['"“‘]([^'"”’]{3,40})['"”’]/.exec(window);
  if (quoted) return quoted[1].trim();
  const bare =
    /^\s*(?:the\s+|a\s+|an\s+|how\s+to\s+|to\s+)?([A-Z][a-z]+(?:['’][a-z]+)?(?:\s+[A-Z][a-z]+){0,2})/.exec(
      window
    );
  if (!bare) return null;
  const name = bare[1].trim();
  if (NER_STOPWORDS.has(name.toLowerCase())) return null;
  // A single common word is far more likely to be prose than a skill.
  if (!name.includes(' ') && name.length < 5) return null;
  return name;
}

export function runLocalDetectors(ctx: DetectorContext): ExtractionCandidate[] {
  return [
    ...detectItemTransfers(ctx),
    ...detectItemLoss(ctx),
    ...detectTravel(ctx),
    ...detectSkillLearning(ctx),
    ...detectRelationships(ctx),
    ...detectStatChanges(ctx),
    ...detectQuestProgression(ctx),
    ...detectQuestProgress(ctx),
    ...detectEvents(ctx),
    ...detectLore(ctx),
    ...detectDialogueAttribution(ctx),
    ...detectRoleEpithets(ctx),
    ...detectEventChaining(ctx),
    ...detectFactionAllegiance(ctx),
  ];
}

/** Dedupe: same entityType + canonical name + suggestedAction +
 * existingEntityId merge into one candidate (highest confidence wins,
 * quotes/related unioned, chunk-overlap spans skipped). */
export function dedupeCandidates(candidates: ExtractionCandidate[]): ExtractionCandidate[] {
  if (!candidates.length) return [];
  interface Merged extends ExtractionCandidate {
    _seenOffsets?: Set<string>;
  }
  const byKey = new Map<string, Merged>();
  for (const c of candidates) {
    const key = [
      c.entityType,
      c.name.toLowerCase().trim(),
      c.suggestedAction,
      c.existingEntityId ?? '',
    ].join('|');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, {
        ...c,
        sourceQuotes: c.sourceQuotes?.length ? c.sourceQuotes.slice(0, 3) : c.sourceQuote ? [c.sourceQuote] : [],
        _seenOffsets: new Set(c.start != null ? [`${c.start}:${c.end}`] : []),
      });
      continue;
    }
    if (c.start != null) {
      const offKey = `${c.start}:${c.end}`;
      if (existing._seenOffsets?.has(offKey)) continue;
      existing._seenOffsets?.add(offKey);
    }
    if (c.confidence > existing.confidence) {
      existing.confidence = c.confidence;
      existing.confidenceBand = c.confidenceBand;
    }
    const quotes = new Set(
      [...(existing.sourceQuotes ?? []), ...(c.sourceQuotes ?? []), c.sourceQuote].filter(Boolean)
    );
    existing.sourceQuotes = [...quotes].slice(0, 3);
    existing.sourceQuote = existing.sourceQuotes[0] ?? existing.sourceQuote;
    existing.relatedEntityIds = [
      ...new Set([...(existing.relatedEntityIds ?? []), ...(c.relatedEntityIds ?? [])]),
    ];
    existing.suggestedChanges = { ...(existing.suggestedChanges ?? {}), ...(c.suggestedChanges ?? {}) };
    const suggestions = new Map((existing.typeSuggestions ?? []).map((suggestion) => [suggestion.type, suggestion]));
    for (const suggestion of c.typeSuggestions ?? []) {
      const prior = suggestions.get(suggestion.type);
      if (!prior || suggestion.confidence > prior.confidence) suggestions.set(suggestion.type, suggestion);
    }
    existing.typeSuggestions = [...suggestions.values()].sort((a, b) => b.confidence - a.confidence);
    if (!existing.interpretation && c.interpretation) existing.interpretation = c.interpretation;
  }
  return [...byKey.values()].map((c) => {
    delete c._seenOffsets;
    return c;
  });
}

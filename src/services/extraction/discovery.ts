import type { EntityType } from '@/domain/entity-types';
import { buildCandidate, type ExtractionCandidate } from './detectors';
import { findKnownEntityMention, type KnownEntity } from './known-index';
import {
  NER_CONNECTORS,
  NER_DIALOGUE_AFTER,
  NER_DIALOGUE_BEFORE,
  NER_HONORIFIC_LEAD,
  NER_HONORIFICS_BEFORE,
  NER_ITEM_DET_BEFORE,
  NER_ITEM_NOUN_END,
  NER_ITEM_VERB_BEFORE,
  NER_LOC_HEADNOUN_AFTER,
  NER_LOC_OF_BEFORE,
  NER_LOC_PREP_BEFORE,
  NER_SKILL_BEFORE,
  NER_STOPWORDS,
  stripHonorific,
} from './ner-lexicon';
import { assessCandidateQuality, likelyPersonName } from './quality';
import { confidenceBand, levenshteinSimilarity, makeSourceQuote } from './text-utils';

interface ProperNounSpan {
  surface: string;
  start: number;
  end: number;
  atSentenceStart: boolean;
}

/** Runs of capitalised words. Span extraction is deliberately permissive;
 * contextual quality gates below decide whether a span is a real entity. */
export function extractProperNounSpans(text: string): ProperNounSpan[] {
  if (!text) return [];
  const tokenRe = /[A-Za-z][A-Za-z'’-]*/g;
  const tokens: { word: string; start: number; end: number }[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = tokenRe.exec(text)) !== null) {
    tokens.push({ word: tm[0], start: tm.index, end: tm.index + tm[0].length });
  }
  const isCap = (word: string) => /^[A-Z]/.test(word);
  const smallGap = (left: { end: number }, right: { start: number }) =>
    /^[ \t]{1,4}$/.test(text.slice(left.end, right.start));
  const spans: ProperNounSpan[] = [];
  let index = 0;
  while (index < tokens.length) {
    if (!isCap(tokens[index].word)) {
      index += 1;
      continue;
    }
    let last = index;
    let cursor = index;
    while (cursor + 1 < tokens.length) {
      const next = tokens[cursor + 1];
      if (!smallGap(tokens[cursor], next)) break;
      if (isCap(next.word)) {
        cursor += 1;
        last = cursor;
        continue;
      }
      if (
        NER_CONNECTORS.has(next.word.toLowerCase()) &&
        cursor + 2 < tokens.length &&
        isCap(tokens[cursor + 2].word) &&
        smallGap(next, tokens[cursor + 2])
      ) {
        cursor += 2;
        last = cursor;
        continue;
      }
      break;
    }
    let previous = tokens[index].start - 1;
    while (previous >= 0 && /\s/.test(text[previous])) previous -= 1;
    const before = previous >= 0 ? text[previous] : '';
    const atStart = previous < 0 || /[.!?:;"“”'‘()[\]—–-]/.test(before);
    let first = index;
    while (first <= last && NER_STOPWORDS.has(tokens[first].word.toLowerCase())) first += 1;
    if (first <= last) {
      const start = tokens[first].start;
      const end = tokens[last].end;
      const surface = text.slice(start, end);
      if (surface.length >= 2 && !NER_STOPWORDS.has(surface.toLowerCase())) {
        const segment = tokens.slice(first, last + 1);
        const classWords = new Set([
          'berserker','warrior','knight','mage','wizard','sorcerer','warlock','hunter','assassin',
          'rogue','paladin','cleric','druid','monk','ranger','bard','necromancer','artificer',
          'guardian','reaver','dreadknight',
        ]);
        let splitAfter = -1;
        for (let tokenIndex = 0; tokenIndex <= segment.length - 3; tokenIndex += 1) {
          if (classWords.has(segment[tokenIndex].word.toLowerCase())) splitAfter = tokenIndex;
        }
        const trailing = splitAfter >= 0 ? segment.slice(splitAfter + 1) : [];
        const trailingLooksHuman =
          trailing.length >= 2 &&
          trailing.length <= 4 &&
          trailing.every((token) => /^[A-Z][A-Za-z'’-]*$/.test(token.word));
        if (splitAfter >= 0 && trailingLooksHuman) {
          const classStart = segment[0].start;
          const classEnd = segment[splitAfter].end;
          const personStart = trailing[0].start;
          const personEnd = trailing[trailing.length - 1].end;
          spans.push({
            surface: text.slice(classStart, classEnd),
            start: classStart,
            end: classEnd,
            atSentenceStart: atStart && first === index,
          });
          spans.push({
            surface: text.slice(personStart, personEnd),
            start: personStart,
            end: personEnd,
            atSentenceStart: false,
          });
        } else {
          spans.push({ surface, start, end, atSentenceStart: atStart && first === index });
        }
      }
    }
    index = last + 1;
  }
  return spans;
}

interface Classification {
  type: EntityType;
  signal: string;
  confidence: number;
}

function classifyProperNoun(
  text: string,
  surface: string,
  occurrences: ProperNounSpan[]
): Classification | null {
  if (NER_HONORIFIC_LEAD.test(surface)) return { type: 'cast', signal: 'honorific', confidence: 0.84 };
  let best: Classification | null = null;
  const consider = (candidate: Classification | null) => {
    if (candidate && (!best || candidate.confidence > best.confidence)) best = candidate;
  };
  if (NER_ITEM_NOUN_END.test(surface)) consider({ type: 'items', signal: 'item-name', confidence: 0.68 });
  for (const occurrence of occurrences) {
    const before = text.slice(Math.max(0, occurrence.start - 48), occurrence.start);
    const after = text.slice(occurrence.end, Math.min(text.length, occurrence.end + 48));
    if (NER_HONORIFICS_BEFORE.test(before)) return { type: 'cast', signal: 'honorific', confidence: 0.84 };
    if (NER_DIALOGUE_AFTER.test(after) || NER_DIALOGUE_BEFORE.test(before)) {
      consider({ type: 'cast', signal: 'dialogue', confidence: 0.84 });
    }
    if (NER_LOC_OF_BEFORE.test(before)) consider({ type: 'locations', signal: 'loc-cue', confidence: 0.82 });
    if (NER_LOC_HEADNOUN_AFTER.test(after)) {
      consider({ type: 'locations', signal: 'loc-headnoun', confidence: 0.74 });
    }
    if (NER_SKILL_BEFORE.test(before)) consider({ type: 'skills', signal: 'skill-cue', confidence: 0.76 });
    if (NER_ITEM_VERB_BEFORE.test(before) && NER_ITEM_NOUN_END.test(surface)) {
      consider({ type: 'items', signal: 'item-cue', confidence: 0.8 });
    }
    if (NER_ITEM_DET_BEFORE.test(before) && NER_ITEM_NOUN_END.test(surface)) {
      consider({ type: 'items', signal: 'item-cue', confidence: 0.76 });
    }
    // A bare “from Name” is not enough to turn a human name into a place.
    if (NER_LOC_PREP_BEFORE.test(before) && !likelyPersonName(surface)) {
      consider({ type: 'locations', signal: 'loc-prep', confidence: 0.64 });
    }
  }
  return best;
}

/** Conservative offline entity discovery. It favours missing an uncertain
 * phrase over presenting dialogue fragments, commands, adjectives or titles
 * as high-confidence world entities. Known names and learned aliases remain
 * available through the known-entity scan even when discovery rejects a span. */
export function discoverEntities(
  text: string,
  entities: KnownEntity[],
  opts: { minRecurrence?: number; maxCandidates?: number } = {}
): ExtractionCandidate[] {
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const minRecurrence = opts.minRecurrence ?? 2;
  const maxCandidates = opts.maxCandidates ?? 120;
  const spans = extractProperNounSpans(text);
  const groups = new Map<string, { surface: string; rawSurface: string; occ: ProperNounSpan[] }>();
  for (const span of spans) {
    const quality = assessCandidateQuality({ text, surface: span.surface, occurrences: [span], entities });
    const key = quality.canonical.toLowerCase();
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, { surface: quality.canonical, rawSurface: span.surface, occ: [] });
    const group = groups.get(key)!;
    group.occ.push(span);
    if (!span.atSentenceStart) {
      group.surface = quality.canonical;
      group.rawSurface = span.surface;
    }
  }

  for (const group of groups.values()) {
    if (out.length >= maxCandidates) break;
    const quality = assessCandidateQuality({
      text,
      surface: group.rawSurface,
      occurrences: group.occ,
      entities,
    });
    if (quality.rejectReason) continue;

    const surface = quality.canonical;
    const count = group.occ.length;
    const known =
      findKnownEntityMention(surface, entities, { threshold: 0.9 }) ||
      findKnownEntityMention(group.surface, entities, { threshold: 0.9 });
    let matchType: ExtractionCandidate['matchType'] = 'new';
    if (known && (known.matchType === 'exact' || known.matchType === 'nickname')) continue;
    if (known) matchType = 'ambiguous';
    if (matchType === 'new') {
      const nearExisting =
        findKnownEntityMention(surface, entities, { threshold: 0.82 }) ||
        findKnownEntityMention(stripHonorific(surface), entities, { threshold: 0.9 });
      if (nearExisting) continue;
    }

    const classified = classifyProperNoun(text, surface, group.occ);
    let type: EntityType;
    let signal: string;
    let confidence: number;
    if (quality.forcedType) {
      type = quality.forcedType;
      signal = quality.signal ?? 'contextual';
      confidence = Math.max(quality.confidenceFloor, classified?.confidence ?? 0);
      confidence = Math.min(confidence + 0.025 * Math.max(0, count - 1), quality.confidenceCap);
    } else if (classified) {
      type = classified.type;
      signal = classified.signal;
      confidence = Math.min(classified.confidence + 0.025 * Math.max(0, count - 1), quality.confidenceCap);
    } else {
      if (count < minRecurrence) continue;
      const sentenceStartOnly = !group.occ.some((occurrence) => !occurrence.atSentenceStart);
      const tokenCount = surface.trim().split(/\s+/).length;
      if (sentenceStartOnly && tokenCount < 2) continue;
      type = known ? known.type : 'cast';
      signal = 'recurrence';
      confidence = Math.min(0.46 + 0.04 * count, quality.confidenceCap, 0.58);
      if (sentenceStartOnly) confidence = Math.min(confidence, 0.52);
    }
    if (matchType === 'ambiguous' && known) confidence = Math.min(confidence, known.confidence);

    let name = surface;
    const aliases = [...quality.aliases];
    if (signal === 'honorific') {
      const stripped = surface.replace(NER_HONORIFIC_LEAD, '').trim();
      if (stripped.length >= 2) {
        aliases.push(surface);
        name = stripped;
      }
    }
    const representative = group.occ.find((occurrence) => !occurrence.atSentenceStart) ?? group.occ[0];
    out.push(
      buildCandidate({
        entityType: type,
        name,
        matchType,
        existingEntityId: matchType === 'ambiguous' && known ? known.entity.id : null,
        suggestedAction: matchType === 'ambiguous' ? 'merge' : 'create',
        confidence,
        sourceQuote: makeSourceQuote(text, representative.start, representative.end),
        sourceQuotes: group.occ.slice(0, 4).map((occurrence) => makeSourceQuote(text, occurrence.start, occurrence.end)),
        start: representative.start,
        end: representative.end,
        suggestedChanges: aliases.length ? { aliases: [...new Set(aliases)] } : null,
        typeSuggestions: quality.typeSuggestions,
        interpretation: quality.interpretation ?? undefined,
        summary: `“${name}” is supported by ${count} contextual mention${count === 1 ? '' : 's'} (${signal}).`,
        detector: `ner:${signal}`,
      })
    );
  }
  return out;
}


const COMMON_ITEM_RE = /\b(?:(bread|kitchen|combat|hunting|pocket|butter|ritual|ceremonial|silver|iron|steel|wooden|old|rusted)\s+)?(knife|sword|blade|dagger|axe|hammer|shield|gun|rifle|pistol|bow|spear|staff|wand|ring|key|phone|book|scroll|potion|bottle|bag|coin|card|ticket|badge|helmet|armour|armor|boots|gloves|cloak|vest)\b/gi;

/** Repeated concrete object nouns are useful even when prose does not capitalise
 * them. This deliberately requires recurrence so ordinary scenery does not flood
 * Review. The user still receives a low-certainty interpretation and can retype. */
export function discoverCommonItems(text: string, entities: KnownEntity[]): ExtractionCandidate[] {
  const groups = new Map<string, { starts: { start: number; end: number; exact: string }[]; aliases: Set<string> }>();
  let match: RegExpExecArray | null;
  COMMON_ITEM_RE.lastIndex = 0;
  while ((match = COMMON_ITEM_RE.exec(text)) !== null) {
    const noun = match[2].toLowerCase();
    const exact = match[0];
    const group = groups.get(noun) ?? { starts: [], aliases: new Set<string>() };
    group.starts.push({ start: match.index, end: match.index + match[0].length, exact });
    if (exact.toLowerCase() !== noun) group.aliases.add(exact.toLowerCase());
    groups.set(noun, group);
  }
  const out: ExtractionCandidate[] = [];
  for (const [noun, group] of groups) {
    if (group.starts.length < 2) continue;
    const name = noun[0].toUpperCase() + noun.slice(1);
    const known = findKnownEntityMention(name, entities.filter((entity) => entity.type === 'items'), { threshold: 0.92 });
    if (known?.matchType === 'exact' || known?.matchType === 'nickname') continue;
    const representative = group.starts[0];
    out.push(buildCandidate({
      entityType: 'items',
      name,
      suggestedAction: known ? 'merge' : 'create',
      matchType: known ? 'ambiguous' : 'new',
      existingEntityId: known?.entity.id ?? null,
      confidence: Math.min(0.52 + group.starts.length * 0.035, 0.66),
      sourceQuote: makeSourceQuote(text, representative.start, representative.end),
      sourceQuotes: group.starts.slice(0, 4).map((occurrence) => makeSourceQuote(text, occurrence.start, occurrence.end)),
      start: representative.start,
      end: representative.end,
      suggestedChanges: group.aliases.size ? { aliases: [...group.aliases] } : null,
      typeSuggestions: [
        { type: 'items', confidence: 0.64, reason: 'Repeated concrete object noun in the chapter' },
        { type: 'skills', confidence: 0.2, reason: 'Could be a move name if used figuratively' },
      ],
      interpretation: { kind: 'generic-item', note: 'Repeated uncapitalised object retained as a possible tracked item.' },
      summary: `“${name}” appears ${group.starts.length}× as a concrete object.`,
      detector: 'ner:repeated-common-item',
    }));
  }
  return out;
}

/** Cluster near-duplicate discovery candidates of the same type. */
export function clusterAliases(candidates: ExtractionCandidate[]): ExtractionCandidate[] {
  if (candidates.length < 2) return candidates;
  const used = new Set<number>();
  const result: ExtractionCandidate[] = [];
  const tokens = (value: string) =>
    value.toLowerCase().split(/\s+/).filter((token) => token && !NER_CONNECTORS.has(token));
  const lastToken = (value: string) => tokens(value).at(-1) ?? '';
  for (let left = 0; left < candidates.length; left += 1) {
    if (used.has(left)) continue;
    const base = candidates[left];
    const aliases: string[] = [];
    const baseTokens = new Set(tokens(base.name));
    for (let right = left + 1; right < candidates.length; right += 1) {
      if (used.has(right)) continue;
      const other = candidates[right];
      if (other.entityType !== base.entityType) continue;
      const otherTokens = new Set(tokens(other.name));
      const subset =
        [...baseTokens].every((token) => otherTokens.has(token)) ||
        [...otherTokens].every((token) => baseTokens.has(token));
      const near = levenshteinSimilarity(base.name, other.name) >= 0.88;
      const titleMerge =
        stripHonorific(base.name).toLowerCase() === other.name.toLowerCase().trim() ||
        stripHonorific(other.name).toLowerCase() === base.name.toLowerCase().trim();
      const epithetMerge =
        baseTokens.size > 1 &&
        otherTokens.size > 1 &&
        lastToken(base.name).length > 3 &&
        levenshteinSimilarity(lastToken(base.name), lastToken(other.name)) >= 0.95;
      if (!subset && !near && !titleMerge && !epithetMerge) continue;
      used.add(right);
      const longer = base.name.length >= other.name.length ? base.name : other.name;
      const shorter = longer === base.name ? other.name : base.name;
      if (shorter && shorter !== longer && !aliases.includes(shorter)) aliases.push(shorter);
      base.name = longer;
      base.confidence = Math.max(base.confidence, other.confidence);
      base.confidenceBand = confidenceBand(base.confidence);
      base.sourceQuotes = [...new Set([...(base.sourceQuotes ?? []), ...(other.sourceQuotes ?? [])])].slice(0, 4);
      base.relatedEntityIds = [...new Set([...(base.relatedEntityIds ?? []), ...(other.relatedEntityIds ?? [])])];
    }
    if (aliases.length) {
      const prior = (base.suggestedChanges?.aliases as string[] | undefined) ?? [];
      base.suggestedChanges = {
        ...(base.suggestedChanges ?? {}),
        aliases: [...new Set([...prior, ...aliases])],
      };
    }
    result.push(base);
    used.add(left);
  }
  return result;
}

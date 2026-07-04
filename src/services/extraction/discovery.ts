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
import { confidenceBand, levenshteinSimilarity, makeSourceQuote } from './text-utils';

interface ProperNounSpan {
  surface: string;
  start: number;
  end: number;
  atSentenceStart: boolean;
}

/** Runs of capitalised words (multi-word proper nouns), trimming leading
 * stopwords and recording sentence-start position. Offsets index `text`. */
export function extractProperNounSpans(text: string): ProperNounSpan[] {
  if (!text) return [];
  const tokenRe = /[A-Za-z][A-Za-z'’-]*/g;
  const tokens: { word: string; start: number; end: number }[] = [];
  let tm: RegExpExecArray | null;
  while ((tm = tokenRe.exec(text)) !== null) {
    tokens.push({ word: tm[0], start: tm.index, end: tm.index + tm[0].length });
  }
  const isCap = (w: string) => /^[A-Z]/.test(w);
  const smallGap = (a: { end: number }, b: { start: number }) =>
    /^[ \t]{1,4}$/.test(text.slice(a.end, b.start));
  const spans: ProperNounSpan[] = [];
  let i = 0;
  while (i < tokens.length) {
    if (!isCap(tokens[i].word)) {
      i++;
      continue;
    }
    let last = i;
    let j = i;
    while (j + 1 < tokens.length) {
      const next = tokens[j + 1];
      if (!smallGap(tokens[j], next)) break;
      if (isCap(next.word)) {
        j++;
        last = j;
        continue;
      }
      if (
        NER_CONNECTORS.has(next.word.toLowerCase()) &&
        j + 2 < tokens.length &&
        isCap(tokens[j + 2].word) &&
        smallGap(next, tokens[j + 2])
      ) {
        j += 2;
        last = j;
        continue;
      }
      break;
    }
    let k = tokens[i].start - 1;
    while (k >= 0 && /\s/.test(text[k])) k--;
    const prev = k >= 0 ? text[k] : '';
    const atStart = k < 0 || /[.!?:;"“”'‘()[\]—–-]/.test(prev);
    let s = i;
    while (s <= last && NER_STOPWORDS.has(tokens[s].word.toLowerCase())) s++;
    if (s <= last) {
      const start = tokens[s].start;
      const end = tokens[last].end;
      const surface = text.slice(start, end);
      if (surface.length >= 2 && !NER_STOPWORDS.has(surface.toLowerCase())) {
        spans.push({ surface, start, end, atSentenceStart: atStart && s === i });
      }
    }
    i = last + 1;
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
  if (NER_HONORIFIC_LEAD.test(surface)) return { type: 'cast', signal: 'honorific', confidence: 0.82 };
  let best: Classification | null = null;
  const consider = (c: Classification | null) => {
    if (c && (!best || c.confidence > best.confidence)) best = c;
  };
  if (NER_ITEM_NOUN_END.test(surface)) consider({ type: 'items', signal: 'item-name', confidence: 0.68 });
  for (const o of occurrences) {
    const before = text.slice(Math.max(0, o.start - 32), o.start);
    const after = text.slice(o.end, Math.min(text.length, o.end + 28));
    if (NER_HONORIFICS_BEFORE.test(before)) return { type: 'cast', signal: 'honorific', confidence: 0.82 };
    if (NER_DIALOGUE_AFTER.test(after) || NER_DIALOGUE_BEFORE.test(before))
      consider({ type: 'cast', signal: 'dialogue', confidence: 0.8 });
    if (NER_LOC_OF_BEFORE.test(before)) consider({ type: 'locations', signal: 'loc-cue', confidence: 0.8 });
    if (NER_LOC_HEADNOUN_AFTER.test(after))
      consider({ type: 'locations', signal: 'loc-headnoun', confidence: 0.7 });
    if (NER_SKILL_BEFORE.test(before)) consider({ type: 'skills', signal: 'skill-cue', confidence: 0.72 });
    if (NER_ITEM_VERB_BEFORE.test(before) && NER_ITEM_NOUN_END.test(surface))
      consider({ type: 'items', signal: 'item-cue', confidence: 0.76 });
    if (NER_ITEM_DET_BEFORE.test(before) && NER_ITEM_NOUN_END.test(surface))
      consider({ type: 'items', signal: 'item-cue', confidence: 0.74 });
    if (NER_LOC_PREP_BEFORE.test(before)) consider({ type: 'locations', signal: 'loc-prep', confidence: 0.62 });
  }
  return best;
}

/** Offline NER discovery: brand-new named entities from prose, so a fresh
 * project's first extraction is never empty. Deterministic, no AI. */
export function discoverEntities(
  text: string,
  entities: KnownEntity[],
  opts: { minRecurrence?: number; maxCandidates?: number } = {}
): ExtractionCandidate[] {
  if (!text) return [];
  const out: ExtractionCandidate[] = [];
  const minRecurrence = opts.minRecurrence ?? 2;
  const maxCandidates = opts.maxCandidates ?? 200;
  const spans = extractProperNounSpans(text);
  const groups = new Map<string, { surface: string; occ: ProperNounSpan[] }>();
  for (const sp of spans) {
    const key = sp.surface.toLowerCase();
    if (!groups.has(key)) groups.set(key, { surface: sp.surface, occ: [] });
    const g = groups.get(key)!;
    g.occ.push(sp);
    if (!sp.atSentenceStart) g.surface = sp.surface;
  }
  for (const g of groups.values()) {
    if (out.length >= maxCandidates) break;
    const surface = g.surface;
    const count = g.occ.length;
    const known = findKnownEntityMention(surface, entities, { threshold: 0.9 });
    let matchType: ExtractionCandidate['matchType'] = 'new';
    if (known && (known.matchType === 'exact' || known.matchType === 'nickname')) continue;
    if (known) matchType = 'ambiguous';
    if (matchType === 'new') {
      const nearExisting =
        findKnownEntityMention(surface, entities, { threshold: 0.8 }) ||
        findKnownEntityMention(stripHonorific(surface), entities, { threshold: 0.9 });
      if (nearExisting) continue;
    }
    const cls = classifyProperNoun(text, surface, g.occ);
    let type: EntityType;
    let signal: string;
    let confidence: number;
    if (cls) {
      type = cls.type;
      signal = cls.signal;
      confidence = Math.min(cls.confidence + 0.03 * (count - 1), 0.92);
    } else {
      if (count < minRecurrence) continue;
      const sentenceStartOnly = !g.occ.some((o) => !o.atSentenceStart);
      const tokenCount = surface.trim().split(/\s+/).length;
      if (sentenceStartOnly && tokenCount < 2) continue;
      type = known ? known.type : 'cast';
      signal = 'recurrence';
      confidence = Math.min(0.48 + 0.05 * count, 0.6);
      if (sentenceStartOnly) confidence = Math.min(confidence, 0.55);
    }
    if (matchType === 'ambiguous' && known) confidence = Math.min(confidence, known.confidence);
    let name = surface;
    const aliases: string[] = [];
    if (signal === 'honorific') {
      const stripped = surface.replace(NER_HONORIFIC_LEAD, '').trim();
      if (stripped.length >= 2) {
        aliases.push(surface);
        name = stripped;
      }
    }
    const rep = g.occ.find((o) => !o.atSentenceStart) ?? g.occ[0];
    out.push(
      buildCandidate({
        entityType: type,
        name,
        matchType,
        existingEntityId: matchType === 'ambiguous' && known ? known.entity.id : null,
        suggestedAction: matchType === 'ambiguous' ? 'merge' : 'create',
        confidence,
        sourceQuote: makeSourceQuote(text, rep.start, rep.end),
        sourceQuotes: g.occ.slice(0, 3).map((o) => makeSourceQuote(text, o.start, o.end)),
        start: rep.start,
        end: rep.end,
        suggestedChanges: aliases.length ? { aliases } : null,
        summary: `"${name}" appears ${count}× with no ${type} record (${signal}).`,
        detector: 'ner:' + signal,
      })
    );
  }
  return out;
}

/** Cluster near-duplicate discovery candidates of the same type: token
 * subsets ("Saren" ⊂ "Saren of Hess"), typo-level Levenshtein, honorific
 * forms ("Captain Brec" ↔ "Brec"), shared-epithet last tokens. */
export function clusterAliases(candidates: ExtractionCandidate[]): ExtractionCandidate[] {
  if (candidates.length < 2) return candidates;
  const used = new Set<number>();
  const result: ExtractionCandidate[] = [];
  const tokens = (s: string) =>
    s.toLowerCase().split(/\s+/).filter((t) => t && !NER_CONNECTORS.has(t));
  const lastToken = (s: string) => {
    const t = tokens(s);
    return t[t.length - 1] ?? '';
  };
  for (let i = 0; i < candidates.length; i++) {
    if (used.has(i)) continue;
    const base = candidates[i];
    const aliases: string[] = [];
    const baseTok = new Set(tokens(base.name));
    for (let j = i + 1; j < candidates.length; j++) {
      if (used.has(j)) continue;
      const other = candidates[j];
      if (other.entityType !== base.entityType) continue;
      const otherTok = new Set(tokens(other.name));
      const subset =
        [...baseTok].every((t) => otherTok.has(t)) || [...otherTok].every((t) => baseTok.has(t));
      const near = levenshteinSimilarity(base.name, other.name) >= 0.88;
      const titleMerge =
        stripHonorific(base.name).toLowerCase() === other.name.toLowerCase().trim() ||
        stripHonorific(other.name).toLowerCase() === base.name.toLowerCase().trim();
      const epithetMerge =
        baseTok.size > 1 &&
        otherTok.size > 1 &&
        lastToken(base.name).length > 3 &&
        levenshteinSimilarity(lastToken(base.name), lastToken(other.name)) >= 0.95;
      if (!subset && !near && !titleMerge && !epithetMerge) continue;
      used.add(j);
      const longer = base.name.length >= other.name.length ? base.name : other.name;
      const shorter = longer === base.name ? other.name : base.name;
      if (shorter && shorter !== longer && !aliases.includes(shorter)) aliases.push(shorter);
      base.name = longer;
      base.confidence = Math.max(base.confidence, other.confidence);
      base.confidenceBand = confidenceBand(base.confidence);
      base.sourceQuotes = [
        ...new Set([...(base.sourceQuotes ?? []), ...(other.sourceQuotes ?? [])]),
      ].slice(0, 3);
      base.relatedEntityIds = [
        ...new Set([...(base.relatedEntityIds ?? []), ...(other.relatedEntityIds ?? [])]),
      ];
    }
    if (aliases.length) {
      const prior = (base.suggestedChanges?.aliases as string[] | undefined) ?? [];
      base.suggestedChanges = {
        ...(base.suggestedChanges ?? {}),
        aliases: [...new Set([...prior, ...aliases])],
      };
    }
    result.push(base);
    used.add(i);
  }
  return result;
}

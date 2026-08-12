import type { EntityType } from '@/domain/entity-types';
import { findRanges, isExcludedAt, levenshteinSimilarity, splitSentenceSpans } from './text-utils';

/** Minimal entity shape the engine needs — decoupled from the Dexie
 * record so fixtures can seed plain objects. */
export interface KnownEntity {
  id: string;
  type: EntityType;
  name: string;
  aliases?: string[];
  /** cast only: pronouns / gender hints for pronoun resolution */
  pronouns?: string;
  gender?: string;
  /** stats only: author-defined phrase rules the statChange detector
   * scans for in addition to the stat name. */
  statPhrases?: string[];
  /** Match this entity's names case-sensitively when scanning PROSE. The fix
   * for a character called Red, Will or May. Optional because two producers
   * hand-build this object (`extraction/engine.ts` provisional rows,
   * `intelligence/rules.ts` drafts) and every fixture seeds a bare literal.
   *
   * Deliberately NOT consulted by `findKnownEntityMention` — that resolves
   * names a model emitted, in whatever case the model chose. */
  caseSensitive?: boolean;
  /** Phrases in the prose that never count as a mention of this entity,
   * e.g. "the Reach" for an entity named Reach. */
  exclusions?: string[];
}

export interface KnownIndexEntry {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  /** Case-sensitivity is baked into this regex's flags, so every consumer
   * inherits it for free. Exclusions cannot be — they are about the words
   * AROUND a match — so they travel separately and are applied after. */
  regex: RegExp | null;
  exclusions?: string[];
}

export type KnownIndex = Partial<Record<EntityType, KnownIndexEntry[]>>;

export function buildKnownIndex(entities: KnownEntity[]): KnownIndex {
  const out: KnownIndex = {};
  for (const e of entities) {
    const names = [e.name, ...(e.aliases ?? [])].filter(
      (n) => typeof n === 'string' && n.trim().length >= 2
    );
    if (!names.length) continue;
    const escaped = names
      .map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      .sort((a, b) => b.length - a.length);
    let regex: RegExp | null = null;
    try {
      regex = new RegExp(
        `(?<![A-Za-z0-9])(${escaped.join('|')})(?![A-Za-z0-9])`,
        e.caseSensitive ? 'g' : 'gi'
      );
    } catch {
      regex = null;
    }
    (out[e.type] ??= []).push({
      id: e.id,
      type: e.type,
      name: e.name,
      aliases: e.aliases ?? [],
      regex,
      exclusions: e.exclusions,
    });
  }
  return out;
}

export interface EntityMention {
  entity: KnownEntity;
  type: EntityType;
  confidence: number;
  matchType: 'exact' | 'nickname' | 'fuzzy';
}

/** Three-tier match: exact → alias → fuzzy (Levenshtein ≥ threshold).
 *
 * **This resolves an already-extracted string, not prose — and it stays
 * case-insensitive on purpose.** Six of its callers hand it a name a *model*
 * produced (`ai-candidates.ts`, `generate/coerce.ts`, `intelligence/digest.ts`),
 * and models return whatever case they like: "vex ilmaren", "VEX ILMAREN".
 * `KnownEntity` now carries `caseSensitive`, so the temptation is to honour it
 * here because it is in scope. Doing that would break every AI round-trip for
 * any entity the author had marked case-sensitive, and it would fail quietly —
 * the name simply stops resolving and the finding is dropped.
 *
 * The flag belongs to the prose scan only: `buildKnownIndex`,
 * `scanTextForKnownEntities`, `resolvePronounsInText`. */
export function findKnownEntityMention(
  needle: string,
  entities: KnownEntity[],
  opts: { threshold?: number } = {}
): EntityMention | null {
  if (!needle) return null;
  const threshold = opts.threshold ?? 0.85;
  const lowerNeedle = needle.toLowerCase();
  let best: EntityMention | null = null;
  for (const entity of entities) {
    const name = entity.name ?? '';
    if (name.toLowerCase() === lowerNeedle) {
      return { entity, type: entity.type, confidence: 1.0, matchType: 'exact' };
    }
    for (const alias of entity.aliases ?? []) {
      if (alias.toLowerCase() === lowerNeedle) {
        return { entity, type: entity.type, confidence: 0.95, matchType: 'nickname' };
      }
    }
    const score = levenshteinSimilarity(needle, name);
    if (score >= threshold && (!best || score > best.confidence)) {
      best = { entity, type: entity.type, confidence: score, matchType: 'fuzzy' };
    }
  }
  return best;
}

export interface SpanHit extends KnownIndexEntry {
  matchText: string;
  offset: number;
}

/** First matching known entity inside a text span — binds verb phrases
 * to specific entities in the phrase detectors. */
export function findEntityInSpan(
  text: string,
  span: { start: number; end: number },
  index: KnownIndex,
  types?: EntityType[]
): SpanHit | null {
  if (!index || !span || span.end <= span.start) return null;
  const slice = text.slice(span.start, span.end);
  // Nearest in READING ORDER, not first in index order. Returning whichever
  // entity happened to sit earliest in the index made the winner arbitrary:
  // in "gave Saltbrand to Vex … Aelinor reached …" the receiver came out as
  // Aelinor purely because of index position. The participant closest to the
  // verb is the one the sentence is actually about.
  let best: SpanHit | null = null;
  for (const type of types ?? (Object.keys(index) as EntityType[])) {
    for (const ent of index[type] ?? []) {
      if (!ent.regex) continue;
      ent.regex.lastIndex = 0;
      let m = ent.regex.exec(slice);
      // Walk past hits the author excluded rather than giving up on the
      // entity: "the Reach" early in the span must not hide a real "Reach"
      // later in it. Offsets are absolute so the exclusion window can see
      // the words on either side of the span boundary.
      while (m && isExcludedAt(text, span.start + m.index, span.start + m.index + m[0].length, ent.exclusions)) {
        m = ent.regex.exec(slice);
      }
      if (!m) continue;
      const offset = span.start + m.index;
      if (!best || offset < best.offset) best = { ...ent, matchText: m[0], offset };
    }
  }
  return best;
}

export interface ScanOccurrence {
  /** null for occurrences of a not-yet-accepted discovery candidate —
   * accept backfills the entityId (legacy candidate-occurrence pattern). */
  entityId: string | null;
  entityType: EntityType;
  exactText: string;
  start: number;
  end: number;
  isPronounResolution?: boolean;
  /** Set on candidate occurrences: the candidate's canonical name. */
  candidateName?: string;
}

/** The always-on local pass: whole-word scan for known entity names +
 * aliases across the chapter text. */
export function scanTextForKnownEntities(text: string, entities: KnownEntity[]): ScanOccurrence[] {
  if (!text) return [];
  const out: ScanOccurrence[] = [];
  for (const entity of entities) {
    const labels = [entity.name, ...(entity.aliases ?? [])].filter(Boolean);
    for (const label of labels) {
      for (const r of findRanges(text, label, { caseSensitive: entity.caseSensitive })) {
        if (isExcludedAt(text, r.start, r.end, entity.exclusions, entity.caseSensitive)) continue;
        out.push({
          entityId: entity.id,
          entityType: entity.type,
          exactText: text.slice(r.start, r.end),
          start: r.start,
          end: r.end,
        });
      }
    }
  }
  return out;
}

const PRONOUN_GENDER: Record<string, string> = {
  he: 'male',
  him: 'male',
  his: 'male',
  she: 'female',
  her: 'female',
  hers: 'female',
  they: 'any',
  them: 'any',
  their: 'any',
};

function castGenderOf(entity: KnownEntity): string | null {
  const explicit = (entity.gender ?? '').toLowerCase();
  if (explicit === 'male' || explicit === 'female') return explicit;
  if (explicit === 'nonbinary' || explicit === 'neutral') return 'any';
  const pr = (entity.pronouns ?? '').toLowerCase();
  if (/\bshe\b|\bher\b/.test(pr)) return 'female';
  if (/\bhe\b|\bhim\b/.test(pr)) return 'male';
  if (/\bthey\b|\bthem\b/.test(pr)) return 'any';
  return null; // unknown — compatible with anything
}

/** Offline pronoun resolution: he/she/they → most recent gender-compatible
 * cast mention within a two-sentence lookback. Flagged occurrences enrich
 * mention counts; the Writer's Room keeps highlights to explicit names. */
export function resolvePronounsInText(
  text: string,
  entities: KnownEntity[],
  opts: { max?: number } = {}
): ScanOccurrence[] {
  if (!text) return [];
  const castRows = entities.filter((e) => e.type === 'cast' && e.name);
  if (!castRows.length) return [];
  const cast = castRows.map((e) => ({
    id: e.id,
    gender: castGenderOf(e),
    labels: [e.name, ...(e.aliases ?? [])].filter(Boolean),
    caseSensitive: e.caseSensitive,
    exclusions: e.exclusions,
  }));
  const spans = splitSentenceSpans(text);
  const maxOut = opts.max ?? 200;
  const lookback = 2;
  const out: ScanOccurrence[] = [];
  const mentionsBySentence = spans.map((s) => {
    const slice = text.slice(s.start, s.end);
    const found: { castIx: number; offset: number }[] = [];
    cast.forEach((c, ix) => {
      for (const label of c.labels) {
        for (const r of findRanges(slice, label, { caseSensitive: c.caseSensitive })) {
          // Absolute offsets: an exclusion phrase can straddle the sentence
          // boundary this slice was cut on.
          const start = s.start + r.start;
          const end = s.start + r.end;
          if (isExcludedAt(text, start, end, c.exclusions, c.caseSensitive)) continue;
          found.push({ castIx: ix, offset: start });
        }
      }
    });
    return found.sort((a, b) => a.offset - b.offset);
  });
  const pronounRe = /\b(he|she|they)\b/gi;
  for (let si = 0; si < spans.length && out.length < maxOut; si++) {
    const s = spans[si];
    const slice = text.slice(s.start, s.end);
    pronounRe.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pronounRe.exec(slice)) !== null && out.length < maxOut) {
      const want = PRONOUN_GENDER[m[0].toLowerCase()];
      const pronAbs = s.start + m.index;
      let resolved: (typeof cast)[number] | null = null;
      for (let back = 0; back <= lookback && !resolved; back++) {
        const tix = si - back;
        if (tix < 0) break;
        const pool = mentionsBySentence[tix].filter((mm) => back > 0 || mm.offset < pronAbs);
        for (let k = pool.length - 1; k >= 0; k--) {
          const cand = cast[pool[k].castIx];
          const g = cand.gender;
          const compatible = want === 'any' ? true : g === want || g === 'any' || g === null;
          if (compatible) {
            resolved = cand;
            break;
          }
        }
      }
      if (!resolved) continue;
      out.push({
        entityId: resolved.id,
        entityType: 'cast',
        exactText: m[0],
        start: pronAbs,
        end: pronAbs + m[0].length,
        isPronounResolution: true,
      });
    }
  }
  return out;
}

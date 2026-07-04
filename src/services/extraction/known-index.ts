import type { EntityType } from '@/domain/entity-types';
import { findRanges, levenshteinSimilarity, splitSentenceSpans } from './text-utils';

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
}

export interface KnownIndexEntry {
  id: string;
  type: EntityType;
  name: string;
  aliases: string[];
  regex: RegExp | null;
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
      regex = new RegExp(`(?<![A-Za-z0-9])(${escaped.join('|')})(?![A-Za-z0-9])`, 'gi');
    } catch {
      regex = null;
    }
    (out[e.type] ??= []).push({
      id: e.id,
      type: e.type,
      name: e.name,
      aliases: e.aliases ?? [],
      regex,
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

/** Three-tier match: exact → alias → fuzzy (Levenshtein ≥ threshold). */
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
  for (const type of types ?? (Object.keys(index) as EntityType[])) {
    for (const ent of index[type] ?? []) {
      if (!ent.regex) continue;
      ent.regex.lastIndex = 0;
      const m = ent.regex.exec(slice);
      if (m) return { ...ent, matchText: m[0], offset: span.start + m.index };
    }
  }
  return null;
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
      for (const r of findRanges(text, label)) {
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
        for (const r of findRanges(slice, label)) {
          found.push({ castIx: ix, offset: s.start + r.start });
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

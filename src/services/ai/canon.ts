import type { Entity } from '@/db/types';
import { runLocalExtraction } from '@/services/extraction/engine';
import type { KnownEntity } from '@/services/extraction/known-index';

/**
 * Canon, both directions.
 *
 * Going out: the recorded state of everyone about to appear in a scene, so a
 * model is told who owns what and who hates whom instead of guessing. A brief
 * that says only "Vex, a poisoner" will cheerfully have Vex hand over a sword
 * she gave away two chapters ago.
 *
 * Coming back: the same engine that reads the author's manuscript, pointed at
 * the draft the model just produced. Generated prose was the one thing in the
 * app that nothing checked — it went straight into a textarea and from there
 * into the manuscript. Now it gets read first, and anything that contradicts
 * the codex is shown before the author accepts it.
 *
 * Entirely offline. This costs no tokens and works with no key.
 */

function refName(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'name' in value) return String((value as { name: unknown }).name);
  return null;
}

function refId(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id);
  return null;
}

function refNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const one = refName(value);
    return one ? [one] : [];
  }
  return value.map(refName).filter((v): v is string => Boolean(v));
}

/**
 * The recorded state of a set of entities, as flat sentences a model can obey.
 *
 * Deliberately facts, not flavour: ownership, whereabouts, bonds and skills
 * are the things a scene contradicts by accident. Personality belongs in the
 * cast list, not here.
 */
export function buildCanonFacts(subjects: Entity[], all: Entity[]): string[] {
  const byId = new Map(all.map((e) => [e.id, e]));
  const subjectIds = new Set(subjects.map((e) => e.id));
  const facts: string[] = [];

  for (const entity of subjects) {
    const f = entity.fields ?? {};
    if (entity.type === 'cast') {
      const where = refName(f.currentLocation);
      if (where) facts.push(`${entity.name} was last recorded at ${where}.`);
      const carrying = refNames(f.inventory);
      if (carrying.length) facts.push(`${entity.name} is carrying: ${carrying.join(', ')}.`);
      const skills = refNames(f.skills);
      if (skills.length) facts.push(`${entity.name} knows: ${skills.slice(0, 8).join(', ')}.`);
      const status = typeof f.status === 'string' ? f.status : null;
      if (status) facts.push(`${entity.name}'s status is "${status}".`);
    }
    if (entity.type === 'items') {
      const owner = refName(f.currentOwner);
      if (owner) facts.push(`${entity.name} belongs to ${owner}.`);
      if (typeof f.status === 'string' && f.status) facts.push(`${entity.name} is ${f.status}.`);
    }
    if (entity.type === 'locations') {
      const parent = refName(f.parentId);
      if (parent) facts.push(`${entity.name} is inside ${parent}.`);
    }
  }

  // Bonds between two people who are both in the scene — the ones a draft can
  // actually get wrong.
  for (const bond of all) {
    if (bond.type !== 'relationships') continue;
    const from = refId(bond.fields?.from);
    const to = refId(bond.fields?.to);
    if (!from || !to || !subjectIds.has(from) || !subjectIds.has(to)) continue;
    const a = byId.get(from)?.name;
    const b = byId.get(to)?.name;
    if (!a || !b) continue;
    facts.push(`${a} and ${b} are recorded as ${String(bond.fields?.bondType ?? 'bonded')}.`);
  }

  return facts;
}

export type CanonIssueKind = 'contradiction' | 'change' | 'introduction';

export interface CanonIssue {
  kind: CanonIssueKind;
  /** One sentence, phrased for the author, never for a developer. */
  message: string;
  /** The span of draft prose that raised it. */
  quote: string;
}

/**
 * Read a generated draft the way the app reads a chapter, and report anything
 * an author would want to know before pressing Insert.
 *
 * Three severities, and the distinction matters. A **contradiction** is the
 * draft asserting something the codex says is false — the sword being handed
 * over by the wrong person. A **change** is the draft moving canon forward,
 * which is usually the point of writing the scene and only needs flagging so
 * it is not a surprise. An **introduction** is a name the codex has never
 * seen, which is fine but worth counting.
 */
export function checkDraftAgainstCanon(draft: string, entities: Entity[]): CanonIssue[] {
  if (!draft.trim()) return [];
  const known: KnownEntity[] = entities.map((e) => ({
    id: e.id,
    type: e.type,
    name: e.name,
    aliases: e.aliases ?? [],
  }));
  const byId = new Map(entities.map((e) => [e.id, e]));
  const { candidates } = runLocalExtraction({ text: draft, entities: known });
  const issues: CanonIssue[] = [];

  for (const candidate of candidates) {
    const signal = candidate.signal;
    if (!signal) continue;
    const quote = candidate.sourceQuote ?? '';

    if (signal.kind === 'item-transfer') {
      const item = signal.itemId ? byId.get(signal.itemId) : undefined;
      if (!item) continue;
      const recordedOwnerId = refId(item.fields?.currentOwner);
      const recordedOwner = recordedOwnerId ? byId.get(recordedOwnerId)?.name : null;
      if (signal.fromId && recordedOwnerId && signal.fromId !== recordedOwnerId) {
        issues.push({
          kind: 'contradiction',
          message: `The draft has ${signal.fromName ?? 'someone'} handing over ${signal.itemName}, but the codex records it as ${recordedOwner ?? 'someone else'}'s.`,
          quote,
        });
      } else if (signal.toName) {
        issues.push({
          kind: 'change',
          message: `${signal.itemName} changes hands to ${signal.toName} in this draft.`,
          quote,
        });
      }
    }

    if (signal.kind === 'travel') {
      const actor = byId.get(signal.actorId);
      const recordedPlace = refName(actor?.fields?.currentLocation);
      if (recordedPlace && recordedPlace.toLowerCase() !== signal.placeName.toLowerCase()) {
        issues.push({
          kind: 'change',
          message: `${signal.actorName} moves from ${recordedPlace} to ${signal.placeName} in this draft.`,
          quote,
        });
      }
    }

    if (signal.kind === 'relationship') {
      const existing = entities.find(
        (e) =>
          e.type === 'relationships' &&
          refId(e.fields?.from) === signal.fromId &&
          refId(e.fields?.to) === signal.toId
      );
      const recorded = existing ? String(existing.fields?.bondType ?? '') : '';
      if (recorded && recorded !== signal.bond) {
        issues.push({
          kind: 'contradiction',
          message: `The draft plays ${signal.fromName} and ${signal.toName} as ${signal.bond}, but the codex records them as ${recorded}.`,
          quote,
        });
      }
    }

    if (signal.kind === 'skill-learned' && signal.actorId) {
      const actor = byId.get(signal.actorId);
      const has = refNames(actor?.fields?.skills).some(
        (s) => s.toLowerCase() === signal.skillName.toLowerCase()
      );
      if (!has) {
        issues.push({
          kind: 'change',
          message: `${signal.actorName || 'Someone'} learns ${signal.skillName} in this draft.`,
          quote,
        });
      }
    }
  }

  const introduced = candidates.filter(
    (c) => c.matchType === 'new' && c.suggestedAction === 'create' && !c.name.includes('→')
  );
  if (introduced.length) {
    issues.push({
      kind: 'introduction',
      message: `The draft introduces ${introduced.length} name${introduced.length === 1 ? '' : 's'} the codex has not seen: ${introduced
        .slice(0, 6)
        .map((c) => c.name)
        .join(', ')}${introduced.length > 6 ? '…' : ''}.`,
      quote: '',
    });
  }

  // Contradictions first — they are the ones worth stopping for.
  const rank: Record<CanonIssueKind, number> = { contradiction: 0, change: 1, introduction: 2 };
  return issues.sort((a, b) => rank[a.kind] - rank[b.kind]).slice(0, 12);
}

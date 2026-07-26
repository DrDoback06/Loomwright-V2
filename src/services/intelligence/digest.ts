import { newId } from '@/lib/id';
import { db } from '@/db/schema';
import type { Entity } from '@/db/types';
import type { ExtractionCandidate, ExtractionSignal } from '@/services/extraction/detectors';
import { confidenceBand } from '@/services/extraction/text-utils';
import { findKnownEntityMention, type KnownEntity } from '@/services/extraction/known-index';
import { ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';
import { runPropagation, type RuleContext } from './rules';
import { DEFAULT_VOLUME } from './suggestions';
import { emptyDelta, type DeltaSuggestion, type StoryDelta, type SuggestionKind } from './types';

export type DigestDepth = 'lean' | 'standard' | 'full';

/** Rough character budget per depth. ~4 chars/token, targeting ≤8k tokens at
 * full depth so the digest fits alongside a chapter in most context windows. */
const BUDGET: Record<DigestDepth, number> = {
  lean: 6_000,
  standard: 16_000,
  full: 32_000,
};

/** Types worth spending digest budget on, most load-bearing first. */
const DIGEST_ORDER: EntityType[] = [
  'cast',
  'locations',
  'items',
  'skills',
  'factions',
  'quests',
  'relationships',
  'events',
  'lore',
  'bestiary',
  'classes',
  'races',
  'stats',
];

function refName(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'name' in value) return String((value as { name: unknown }).name);
  return null;
}

function refNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    const single = refName(value);
    return single ? [single] : [];
  }
  return value.map(refName).filter((v): v is string => Boolean(v));
}

/**
 * A compact, structured picture of the world for an external model: who
 * exists, what they own, where places sit in the hierarchy, and how the cast
 * is bonded. Names only — ids never leave the app, which also means a reply
 * can never address anything by an internal identifier.
 */
export async function buildWorldDigest(projectId: string, depth: DigestDepth): Promise<string> {
  const [entities, trees] = await Promise.all([
    db.entities.where('projectId').equals(projectId).toArray(),
    db.skillTrees.where('projectId').equals(projectId).toArray(),
  ]);
  const live = entities.filter((e) => e.status !== 'merged' && !e.mergedIntoId);
  const budget = BUDGET[depth];
  const lines: string[] = [];
  let degraded = false;

  const byType = new Map<EntityType, Entity[]>();
  for (const e of live) {
    const list = byType.get(e.type) ?? [];
    list.push(e);
    byType.set(e.type, list);
  }

  const push = (line: string): boolean => {
    if (lines.join('\n').length + line.length > budget) {
      degraded = true;
      return false;
    }
    lines.push(line);
    return true;
  };

  for (const type of DIGEST_ORDER) {
    const rows = byType.get(type);
    if (!rows?.length) continue;
    if (!push(`\n## ${ENTITY_TYPE_META[type].plural}`)) break;
    for (const e of rows) {
      const bits: string[] = [];
      if (depth !== 'lean') {
        if (e.summary) bits.push(e.summary.slice(0, 120));
        if (e.aliases.length) bits.push(`aka ${e.aliases.join('/')}`);
      }
      if (type === 'items') {
        const owner = refName(e.fields.currentOwner);
        if (owner) bits.push(`owned by ${owner}`);
        if (e.fields.status) bits.push(String(e.fields.status));
      }
      if (type === 'locations') {
        const parent = refName(e.fields.parentId);
        if (parent) bits.push(`inside ${parent}`);
      }
      if (type === 'cast') {
        const where = refName(e.fields.currentLocation);
        if (where) bits.push(`at ${where}`);
        const skills = refNames(e.fields.skills);
        if (skills.length && depth === 'full') bits.push(`skills: ${skills.join(', ')}`);
      }
      if (type === 'relationships') {
        const from = refName(e.fields.from);
        const to = refName(e.fields.to);
        if (from && to) bits.push(`${from} → ${to} (${e.fields.bondType ?? 'bond'})`);
      }
      if (!push(`- ${e.name}${bits.length ? ` — ${bits.join('; ')}` : ''}`)) break;
    }
  }

  if (trees.length && depth !== 'lean') {
    push(`\n## Skill trees`);
    for (const tree of trees) {
      const groups = [...new Set(tree.nodes.map((n) => n.group).filter(Boolean))];
      if (!push(`- ${tree.name}${groups.length ? ` — branches: ${groups.join(', ')}` : ''}`)) break;
    }
  }

  const header = degraded
    ? `# World digest (${depth}, truncated to fit — some entries omitted)`
    : `# World digest (${depth})`;
  return [header, ...lines].join('\n');
}

/**
 * The mega-prompt. Asks for facts AND suggestions in a shape our own rules
 * can consume, and is explicit that names — never ids — travel on the wire.
 */
export function buildMegaPrompt(digest: string, manuscript: string): string {
  return `You are helping an author keep a story bible in sync with their manuscript.

Below is a digest of everything currently recorded, followed by new manuscript text.
Read the manuscript and report what CHANGED, plus concrete forward-looking suggestions.

Reply with ONE JSON object and nothing else:

{
  "facts": [
    { "kind": "item-transfer", "item": "NAME", "from": "NAME", "to": "NAME", "quote": "..." },
    { "kind": "item-loss", "item": "NAME", "destroyed": true, "quote": "..." },
    { "kind": "travel", "character": "NAME", "place": "NAME", "parent": "REGION or null", "quote": "..." },
    { "kind": "skill-learned", "character": "NAME", "skill": "NAME", "quote": "..." },
    { "kind": "relationship", "from": "NAME", "to": "NAME", "bond": "ally|enemy|lover|rival|mentor|family|debt|oath", "quote": "..." }
  ],
  "suggestions": [
    { "kind": "skill-next-tier", "target": "NAME", "title": "Short card title", "body": "One concrete sentence." }
  ]
}

Rules:
- Use NAMES exactly as they appear in the digest when the thing already exists.
- "quote" must be a short verbatim span from the manuscript that justifies the fact.
- Only report what the manuscript actually states. Do not invent events.
- Suggestions must be finished, ready-to-accept artifacts — a specific card with a
  title and one concrete sentence, never an open question.
- Suggestion "kind" is one of: skill-sibling, skill-next-tier, quest-outcome,
  story-arc, relationship, item-synergy, cast-candidate.

${digest}

# New manuscript text
${manuscript}`;
}

const SUGGESTION_KINDS: SuggestionKind[] = [
  'skill-sibling',
  'skill-next-tier',
  'quest-outcome',
  'story-arc',
  'relationship',
  'item-synergy',
  'cast-candidate',
];

interface WireFact {
  kind?: string;
  item?: string;
  from?: string;
  to?: string;
  character?: string;
  place?: string;
  parent?: string | null;
  skill?: string;
  bond?: string;
  destroyed?: boolean;
  quote?: string;
}

/** Tolerant JSON extraction — models wrap replies in prose and fences. */
function parseJsonLoose(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(trimmed);
  const body = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(body);
  } catch {
    const start = body.indexOf('{');
    const end = body.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(body.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Verify a pasted reply against the project and turn it into a StoryDelta.
 *
 * Every external claim is resolved to a real entity by name and then fed
 * through the SAME offline propagation rules the local engine uses. That is
 * the verification: a model cannot make the app write anything the offline
 * rules would not have written, it can only tell us where to look. Claims
 * naming things that do not exist become warnings, not silent writes.
 */
export async function parseDeltaReply(
  projectId: string,
  reply: string
): Promise<StoryDelta | { error: string }> {
  const parsed = parseJsonLoose(reply);
  if (!parsed || typeof parsed !== 'object') {
    return { error: 'That reply was not JSON. Paste the whole reply, including the braces.' };
  }
  const payload = parsed as { facts?: WireFact[]; suggestions?: unknown[] };
  const facts = Array.isArray(payload.facts) ? payload.facts : [];
  const rawSuggestions = Array.isArray(payload.suggestions) ? payload.suggestions : [];
  if (!facts.length && !rawSuggestions.length) {
    return { error: 'That reply had no facts or suggestions in it.' };
  }

  const [entities, trees] = await Promise.all([
    db.entities.where('projectId').equals(projectId).toArray(),
    db.skillTrees.where('projectId').equals(projectId).toArray(),
  ]);
  const live = entities.filter((e) => e.status !== 'merged' && !e.mergedIntoId);
  const known: KnownEntity[] = live.map((e) => ({
    id: e.id,
    type: e.type,
    name: e.name,
    aliases: e.aliases,
  }));

  const warnings: string[] = [];
  const resolve = (name: string | undefined, type: EntityType): Entity | null => {
    if (!name) return null;
    const match = findKnownEntityMention(
      name,
      known.filter((k) => k.type === type),
      { threshold: 0.85 }
    );
    return match ? live.find((e) => e.id === match.entity.id) ?? null : null;
  };

  // Facts become candidates carrying signals — the exact shape the local
  // detectors produce — so the rules cannot tell them apart.
  const candidates: ExtractionCandidate[] = [];
  const asCandidate = (signal: ExtractionSignal, quote: string, name: string, type: EntityType) => {
    // External claims start below local ones: they are unverified until the
    // rules resolve every participant against the real project.
    const confidence = 0.7;
    candidates.push({
      entityType: type,
      name,
      suggestedAction: 'update',
      matchType: 'exact',
      confidence,
      confidenceBand: confidenceBand(confidence),
      sourceQuote: quote,
      sourceQuotes: quote ? [quote] : [],
      detector: 'handoff',
      signal,
    });
  };

  for (const fact of facts) {
    const quote = String(fact.quote ?? '').slice(0, 240);
    switch (fact.kind) {
      case 'item-transfer': {
        const item = resolve(fact.item, 'items');
        const to = resolve(fact.to, 'cast');
        const from = resolve(fact.from, 'cast');
        if (!item) {
          warnings.push(`Ignored a transfer of "${fact.item ?? 'an unnamed item'}" — no such item.`);
          break;
        }
        asCandidate(
          {
            kind: 'item-transfer',
            itemId: item.id,
            itemName: item.name,
            fromId: from?.id ?? null,
            fromName: from?.name ?? fact.from ?? null,
            toId: to?.id ?? null,
            toName: to?.name ?? fact.to ?? null,
          },
          quote,
          item.name,
          'items'
        );
        break;
      }
      case 'item-loss': {
        const item = resolve(fact.item, 'items');
        if (!item) {
          warnings.push(`Ignored a loss of "${fact.item ?? 'an unnamed item'}" — no such item.`);
          break;
        }
        asCandidate(
          {
            kind: 'item-loss',
            itemId: item.id,
            itemName: item.name,
            destroyed: Boolean(fact.destroyed),
          },
          quote,
          item.name,
          'items'
        );
        break;
      }
      case 'travel': {
        const actor = resolve(fact.character, 'cast');
        if (!actor || !fact.place) {
          warnings.push(
            `Ignored travel for "${fact.character ?? 'an unnamed character'}" — no such character.`
          );
          break;
        }
        const place = resolve(fact.place, 'locations');
        asCandidate(
          {
            kind: 'travel',
            actorId: actor.id,
            actorName: actor.name,
            placeId: place?.id ?? null,
            placeName: place?.name ?? fact.place,
            parentHint: fact.parent ? String(fact.parent) : null,
          },
          quote,
          actor.name,
          'cast'
        );
        break;
      }
      case 'skill-learned': {
        const actor = resolve(fact.character, 'cast');
        if (!fact.skill) break;
        const skill = resolve(fact.skill, 'skills');
        asCandidate(
          {
            kind: 'skill-learned',
            actorId: actor?.id ?? null,
            actorName: actor?.name ?? fact.character ?? '',
            skillId: skill?.id ?? null,
            skillName: skill?.name ?? fact.skill,
          },
          quote,
          fact.skill,
          'skills'
        );
        break;
      }
      case 'relationship': {
        const from = resolve(fact.from, 'cast');
        const to = resolve(fact.to, 'cast');
        if (!from || !to) {
          warnings.push(
            `Ignored a bond between "${fact.from ?? '?'}" and "${fact.to ?? '?'}" — both must already exist.`
          );
          break;
        }
        asCandidate(
          {
            kind: 'relationship',
            fromId: from.id,
            fromName: from.name,
            toId: to.id,
            toName: to.name,
            bond: String(fact.bond ?? 'other'),
          },
          quote,
          `${from.name} → ${to.name}`,
          'relationships'
        );
        break;
      }
      default:
        if (fact.kind) warnings.push(`Ignored an unrecognised fact kind: "${fact.kind}".`);
    }
  }

  const ctx: RuleContext = {
    projectId,
    entities: live,
    trees,
    volume: DEFAULT_VOLUME,
    newUnitId: () => newId(),
    newLocalId: () => newId(),
  };
  const propagated = runPropagation(candidates, ctx);

  const suggestions: DeltaSuggestion[] = [];
  for (const raw of rawSuggestions) {
    if (!raw || typeof raw !== 'object') continue;
    const s = raw as { kind?: string; target?: string; title?: string; body?: string };
    if (!s.title || !s.body) continue;
    const kind = SUGGESTION_KINDS.includes(s.kind as SuggestionKind)
      ? (s.kind as SuggestionKind)
      : 'story-arc';
    const target = s.target
      ? live.find((e) => e.name.toLowerCase() === s.target!.toLowerCase())
      : undefined;
    suggestions.push({
      unitId: newId(),
      confidence: 0.6,
      confidenceBand: confidenceBand(0.6),
      sourceQuote: '',
      origin: 'handoff',
      kind,
      targetRef: target ? { id: target.id, type: target.type, name: target.name } : null,
      title: String(s.title).slice(0, 120),
      body: String(s.body).slice(0, 400),
      payload: null,
    });
  }

  const delta: StoryDelta = {
    ...emptyDelta(newId(), projectId, 'handoff'),
    entities: propagated.entities,
    patches: propagated.patches,
    graphPlacements: propagated.graphPlacements,
    hierarchyPlacements: propagated.hierarchyPlacements,
    links: propagated.links,
    suggestions: [...propagated.suggestions, ...suggestions],
    groups: propagated.groups,
    warnings: [...warnings, ...propagated.warnings],
    createdAt: Date.now(),
  };

  if (suggestions.length) {
    delta.groups = [
      ...delta.groups,
      {
        id: newId(),
        subject: { id: '', type: 'lore', name: 'Suggestions' },
        headline: `${suggestions.length} suggestion${suggestions.length === 1 ? '' : 's'} to consider`,
        unitIds: suggestions.map((s) => s.unitId),
        confidence: 0.6,
        confidenceBand: confidenceBand(0.6),
        flagged: false,
      },
    ];
  }

  return delta;
}

import type { EntityType } from '@/domain/entity-types';
import { buildCandidate, type ExtractionCandidate } from '@/services/extraction/detectors';
import { findKnownEntityMention, type KnownEntity } from '@/services/extraction/known-index';

/** The JSON shape we ask AI passes (deep extraction + handoff paste-back)
 * to produce. Tolerant parsing: anything missing is skipped. */
export interface AiExtractionPayload {
  characters?: { name: string; role?: string; traits?: string[]; summary?: string }[];
  locations?: { name: string; kind?: string; summary?: string }[];
  items?: { name: string; type?: string; owner?: string; summary?: string }[];
  quests?: { name: string; status?: string; summary?: string }[];
  events?: { name: string; when?: string; summary?: string }[];
  factions?: { name: string; summary?: string }[];
  lore?: { title?: string; name?: string; body?: string; summary?: string }[];
  relationships?: { from: string; to: string; type?: string; summary?: string }[];
  skills?: { name: string; summary?: string }[];
}

/** Extract the first JSON object from arbitrary AI text (handles prose
 * wrappers and ```json fences). Returns null when nothing parses. Shared
 * by every AI paste-back path (deep extraction, handoff, onboarding). */
export function parseJsonObject(text: string): unknown | null {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    const start = c.indexOf('{');
    const end = c.lastIndexOf('}');
    if (start === -1 || end <= start) continue;
    try {
      return JSON.parse(c.slice(start, end + 1));
    } catch {
      /* keep trying */
    }
  }
  return null;
}

/** Extraction-shaped view of {@link parseJsonObject}. */
export function extractJsonBlock(text: string): AiExtractionPayload | null {
  return parseJsonObject(text) as AiExtractionPayload | null;
}

const TYPE_MAP: [keyof AiExtractionPayload, EntityType][] = [
  ['characters', 'cast'],
  ['locations', 'locations'],
  ['items', 'items'],
  ['quests', 'quests'],
  ['events', 'events'],
  ['factions', 'factions'],
  ['lore', 'lore'],
  ['skills', 'skills'],
];

/** Map an AI payload into review candidates: names that exactly/alias
 * match a known entity become field-update candidates (or are skipped
 * when nothing new is offered); unknown names become create candidates.
 * Everything stays in the review queue — nothing auto-applies. */
export function mapAiPayload(
  payload: AiExtractionPayload,
  known: KnownEntity[],
  source: 'ai' | 'handoff'
): ExtractionCandidate[] {
  const out: ExtractionCandidate[] = [];

  for (const [payloadKey, entityType] of TYPE_MAP) {
    for (const row of payload[payloadKey] ?? []) {
      const rawName =
        (row as { name?: string; title?: string }).name ??
        (row as { title?: string }).title ??
        '';
      const name = rawName.trim();
      if (!name || name.length > 80) continue;
      const summary = ((row as { summary?: string; body?: string }).summary ??
        (row as { body?: string }).body ??
        '') as string;
      const changes: Record<string, unknown> = {};
      const r = row as Record<string, unknown>;
      if (typeof r.role === 'string') changes.role = r.role;
      if (Array.isArray(r.traits) && r.traits.length) changes.personality = (r.traits as string[]).join(', ');
      if (typeof r.kind === 'string') changes.kind = r.kind;
      if (typeof r.type === 'string' && payloadKey === 'items') changes.itemType = r.type;
      if (typeof r.owner === 'string') {
        const owner = findKnownEntityMention(r.owner, known, { threshold: 0.9 });
        if (owner) changes.currentOwner = { id: owner.entity.id, type: owner.type, name: owner.entity.name };
      }
      if (typeof r.status === 'string') changes.status = r.status;
      if (typeof r.when === 'string') changes.chapter = r.when;
      if (typeof r.body === 'string') changes.body = r.body;

      const match = findKnownEntityMention(name, known, { threshold: 0.92 });
      if (match && (match.matchType === 'exact' || match.matchType === 'nickname')) {
        if (Object.keys(changes).length === 0 && !summary) continue; // nothing new
        out.push(
          buildCandidate({
            entityType: match.type,
            name: match.entity.name,
            existingEntityId: match.entity.id,
            suggestedAction: 'update',
            matchType: 'exact',
            suggestedChanges: changes,
            confidence: 0.8,
            sourceQuote: summary.slice(0, 200),
            summary: summary ? `AI: ${summary.slice(0, 140)}` : `AI enrichment for ${name}.`,
            detector: source,
          })
        );
      } else {
        out.push(
          buildCandidate({
            entityType,
            name,
            suggestedAction: 'create',
            matchType: 'new',
            suggestedChanges: Object.keys(changes).length ? changes : null,
            confidence: 0.72,
            sourceQuote: summary.slice(0, 200),
            summary: summary ? summary.slice(0, 160) : `Found by ${source === 'ai' ? 'the AI deep pass' : 'your external AI'}.`,
            detector: source,
          })
        );
      }
    }
  }

  for (const rel of payload.relationships ?? []) {
    const a = findKnownEntityMention(rel.from ?? '', known, { threshold: 0.9 });
    const b = findKnownEntityMention(rel.to ?? '', known, { threshold: 0.9 });
    if (!a || !b || a.entity.id === b.entity.id) continue;
    out.push(
      buildCandidate({
        entityType: 'relationships',
        name: `${a.entity.name} → ${b.entity.name}`,
        suggestedAction: 'create',
        matchType: 'new',
        suggestedChanges: {
          from: { id: a.entity.id, type: a.type, name: a.entity.name },
          to: { id: b.entity.id, type: b.type, name: b.entity.name },
          bondType: (rel.type ?? 'other').toLowerCase(),
        },
        confidence: 0.75,
        sourceQuote: (rel.summary ?? '').slice(0, 200),
        summary: rel.summary?.slice(0, 160) ?? `Bond between ${a.entity.name} and ${b.entity.name}.`,
        relatedEntityIds: [a.entity.id, b.entity.id],
        detector: source,
      })
    );
  }

  return out;
}

/** The prompt both AI paths share (deep pass sends it per chunk; the
 * handoff pack embeds it for the external AI). */
export function extractionPrompt(knownNames: { type: string; names: string[] }[]): string {
  const knownBlock = knownNames
    .filter((k) => k.names.length)
    .map((k) => `Known ${k.type}: ${k.names.slice(0, 40).join(', ')}`)
    .join('\n');
  return [
    'You are a story-canon extraction system. Read the chapter text and extract narrative entities.',
    knownBlock ? `\n${knownBlock}\n(Use these exact names when the text refers to them.)` : '',
    '\nReturn ONLY a JSON object with this shape (omit empty arrays):',
    '{"characters":[{"name":"","role":"","traits":[],"summary":""}],',
    ' "locations":[{"name":"","kind":"","summary":""}],',
    ' "items":[{"name":"","type":"","owner":"","summary":""}],',
    ' "quests":[{"name":"","status":"","summary":""}],',
    ' "events":[{"name":"","when":"","summary":""}],',
    ' "factions":[{"name":"","summary":""}],',
    ' "skills":[{"name":"","summary":""}],',
    ' "lore":[{"title":"","body":""}],',
    ' "relationships":[{"from":"","to":"","type":"","summary":""}]}',
    '\nBe conservative: only include entities the text actually establishes.',
  ].join('\n');
}

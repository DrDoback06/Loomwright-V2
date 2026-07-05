import { parseJsonObject } from '@/services/ai/ai-candidates';
import type { KnownEntity } from '@/services/extraction/known-index';
import { ENTITY_TYPE_META, type EntityType, ALL_ENTITY_TYPES } from '@/domain/entity-types';
import { newId } from '@/lib/id';
import { coerceEntityDraft, str, type CoerceContext } from './coerce';
import { entitySpec, promptFieldLines, wireExample } from './spec';
import type { BundleEntityDraft, GenerationBundle, GenerationMode, GenerationRequest } from './types';

export const WIRE_SCHEMA_VERSION = 'loomwright-generation-v1';

export interface WireContext {
  projectId: string;
  known: KnownEntity[];
}

/** Cap known-name context per type so prompts stay small. */
const KNOWN_NAMES_CAP = 40;

function knownNamesBlock(known: KnownEntity[], types: EntityType[]): string[] {
  const lines: string[] = [];
  for (const type of types) {
    const names = known
      .filter((e) => e.type === type)
      .slice(0, KNOWN_NAMES_CAP)
      .map((e) => e.name);
    if (names.length) lines.push(`${ENTITY_TYPE_META[type].plural}: ${names.join(', ')}`);
  }
  return lines;
}

/** Which entity types a request produces (drives schema + context blocks). */
export function requestEntityTypes(request: GenerationRequest): EntityType[] {
  switch (request.kind) {
    case 'entity':
    case 'entity-batch':
      return request.entityType ? [request.entityType] : [];
    case 'skilltree':
    case 'skilltree-branch':
      return ['skills'];
    case 'relationship-set':
      return ['relationships'];
    case 'questline':
      return ['quests', 'events'];
    case 'tangle':
    case 'chapter':
      return [];
  }
}

/** The prompt a user copies to an external AI (or the app sends to the
 * configured provider) for an entity / entity-batch request. Kind-specific
 * bundle prompts (trees, questlines, chapters) extend this in their
 * milestones. */
export function buildGenerationPrompt(request: GenerationRequest, ctx: WireContext): string {
  const lines: string[] = [
    'You are generating content for Loomwright, a worldbuilding app for authors.',
    '',
  ];
  const type = request.entityType;
  const spec = type ? entitySpec(type) : null;
  const count = Math.max(1, request.count ?? 1);
  if (spec && type) {
    lines.push(
      count === 1
        ? `Create ONE ${spec.displayName.toLowerCase()} entry.`
        : `Create ${count} ${ENTITY_TYPE_META[type].plural.toLowerCase()} entries.`
    );
    if (request.theme) lines.push(`Theme: ${request.theme}.`);
    if (request.hint) lines.push(`The author asked for: ${request.hint}`);
    lines.push(
      '',
      'Return ONLY a single JSON object with this exact shape (no prose, no markdown fences):',
      '',
      JSON.stringify(
        count === 1
          ? wireExample(type)
          : { loomwright: WIRE_SCHEMA_VERSION, entities: [wireExample(type)] },
        null,
        2
      ),
      '',
      'Field guidance:',
      ...promptFieldLines(type),
      '',
      'Rules:',
      '- Fill every field you can with rich, coherent, specific content; omit fields you cannot infer.',
      '- Related fields take NAMES (of existing entries below, or of new entries you invent in the same reply), never ids.',
      '- Keep names evocative and consistent with the theme.'
    );
    const context = knownNamesBlock(ctx.known, [type, 'cast', 'locations'].filter(
      (t, i, arr) => arr.indexOf(t) === i
    ) as EntityType[]);
    if (context.length) {
      lines.push('', 'Existing entries in this project (reference them by name where fitting):', ...context);
    }
  }
  return lines.join('\n');
}

export interface ParsedWire {
  bundle: GenerationBundle;
}

export interface WireError {
  error: string;
}

function guessType(raw: Record<string, unknown>, fallback?: EntityType): EntityType | undefined {
  const t = str(raw.type, 40)?.toLowerCase();
  if (t && (ALL_ENTITY_TYPES as string[]).includes(t)) return t as EntityType;
  // Tolerate singular labels ("skill" → skills).
  if (t) {
    const byLabel = ALL_ENTITY_TYPES.find(
      (et) => ENTITY_TYPE_META[et].label.toLowerCase() === t || `${t}s` === et
    );
    if (byLabel) return byLabel;
  }
  return fallback;
}

/** Two-pass entity coercion so drafts can reference siblings that appear
 * later in the array: pass 1 collects identity stubs, pass 2 coerces every
 * draft with the full stub roster visible. */
export function coerceEntityList(
  items: { type: EntityType; raw: unknown }[],
  known: KnownEntity[]
): { drafts: BundleEntityDraft[]; warnings: string[] } {
  const stubs: BundleEntityDraft[] = [];
  for (const item of items) {
    const r = item.raw as Record<string, unknown> | null;
    if (!r || typeof r !== 'object') continue;
    const name = str(r.name ?? r.title, 120);
    stubs.push({
      localId: newId(),
      type: item.type,
      name: name ?? '',
      aliases: [],
      summary: '',
      tags: [],
      fields: {},
    });
  }
  const drafts: BundleEntityDraft[] = [];
  const warnings: string[] = [];
  items.forEach((item, i) => {
    const stub = stubs[i];
    if (!stub) return;
    const siblings = stubs.filter((s) => s !== stub && s.name);
    const ctx: CoerceContext = { known, siblings };
    const result = coerceEntityDraft(item.type, item.raw, ctx, stub.localId);
    if (result) {
      drafts.push(result.draft);
      warnings.push(...result.warnings);
    } else {
      warnings.push(`Skipped an unusable ${item.type} entry (no name).`);
    }
  });
  return { drafts, warnings };
}

/** Parse pasted/AI text into a bundle. Tolerant of shape: a wire bundle
 * object, a bare entity object, or a bare array of entities all parse.
 * Kind-specific payloads (trees, questlines, chapters) are handled by
 * their milestones' parsers layered on top of this. */
export function parseWireBundle(
  text: string,
  request: GenerationRequest,
  ctx: WireContext,
  mode: GenerationMode = 'paste'
): ParsedWire | WireError {
  let parsed = parseJsonObject(text);
  if (!parsed) {
    // parseJsonObject only finds objects; tolerate a bare top-level array.
    const start = text.indexOf('[');
    const end = text.lastIndexOf(']');
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(text.slice(start, end + 1));
      } catch {
        parsed = null;
      }
    }
  }
  if (!parsed || typeof parsed !== 'object') {
    return { error: 'No JSON object found in the pasted text.' };
  }

  const fallbackType = request.entityType;
  const items: { type: EntityType; raw: unknown }[] = [];

  const pushItem = (raw: unknown) => {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return;
    const type = guessType(raw as Record<string, unknown>, fallbackType);
    if (type) items.push({ type, raw });
  };

  if (Array.isArray(parsed)) {
    for (const item of parsed) pushItem(item);
  } else {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.entities)) {
      for (const item of obj.entities) pushItem(item);
    } else if (obj.name !== undefined || obj.title !== undefined || obj.fields !== undefined) {
      pushItem(obj);
    } else {
      // Payload keyed by type name: { "skills": [...], "cast": [...] }
      for (const [key, value] of Object.entries(obj)) {
        const type = guessType({ type: key }, undefined);
        if (type && Array.isArray(value)) for (const item of value) pushItem({ type, ...(item as object) });
      }
    }
  }

  if (!items.length) {
    return { error: 'The JSON parsed, but no usable entries were found in it.' };
  }

  const { drafts, warnings } = coerceEntityList(items, ctx.known);
  if (!drafts.length) {
    return { error: 'No entries survived validation — every item was missing a usable name.' };
  }

  const bundle: GenerationBundle = {
    id: newId(),
    projectId: ctx.projectId,
    request,
    mode,
    entities: drafts,
    graphs: [],
    chapters: [],
    links: [],
    warnings,
    createdAt: Date.now(),
  };
  return { bundle };
}

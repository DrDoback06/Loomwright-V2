import { parseJsonObject } from '@/services/ai/ai-candidates';
import type { KnownEntity } from '@/services/extraction/known-index';
import type { GraphEdge, GraphNode, SkillTree } from '@/db/types';
import { ENTITY_TYPE_META, type EntityType, ALL_ENTITY_TYPES } from '@/domain/entity-types';
import { newId } from '@/lib/id';
import { coerceEntityDraft, str, strList, type CoerceContext } from './coerce';
import { entitySpec, promptFieldLines, wireExample } from './spec';
import { layoutTree } from './layout';
import type {
  BundleEntityDraft,
  BundleGraphDraft,
  GenerationBundle,
  GenerationMode,
  GenerationRequest,
} from './types';

export const WIRE_SCHEMA_VERSION = 'loomwright-generation-v1';

export interface WireContext {
  projectId: string;
  known: KnownEntity[];
  /** Branch extension: the existing tree, for prompts and requires-resolution. */
  tree?: SkillTree;
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

/** Serialize an existing tree compactly for branch prompts. */
function treeAdjacencyLines(tree: SkillTree): string[] {
  const parentOf = new Map(tree.edges.map((e) => [e.to, e.from]));
  const labelOf = new Map(tree.nodes.map((n) => [n.id, n.label]));
  const depthOf = (id: string, guard = 0): number => {
    const parent = parentOf.get(id);
    return parent && guard < 50 ? depthOf(parent, guard + 1) + 1 : 0;
  };
  return tree.nodes
    .slice(0, 40)
    .map((n) => {
      const parent = parentOf.get(n.id);
      return `- ${n.label} (tier ${depthOf(n.id)})${parent ? ` requires ${labelOf.get(parent)}` : ''}`;
    });
}

const COMMON_RULES = [
  '- Fill every field you can with rich, coherent, specific content; omit fields you cannot infer.',
  '- Related fields take NAMES (of existing entries below, or of new entries you invent in the same reply), never ids.',
  '- Keep names evocative and consistent with the theme.',
];

/** The prompt a user copies to an external AI (or the app sends to the
 * configured provider). Kind-aware: entities, skill trees, tree branches,
 * and questlines each get their own wire schema. */
export function buildGenerationPrompt(request: GenerationRequest, ctx: WireContext): string {
  const lines: string[] = [
    'You are generating content for Loomwright, a worldbuilding app for authors.',
    '',
  ];
  const count = Math.max(1, request.count ?? 1);
  const wants: string[] = [];
  if (request.theme) wants.push(`Theme: ${request.theme}.`);
  if (request.hint) wants.push(`The author asked for: ${request.hint}`);

  switch (request.kind) {
    case 'skilltree':
    case 'skilltree-branch': {
      const skillCount = Math.max(3, request.count ?? 12);
      const branches = request.options?.branches ?? 3;
      if (request.kind === 'skilltree') {
        lines.push(
          `Create a complete SKILL TREE: ${skillCount} skills arranged in ${branches} named branches under one root skill.`
        );
      } else {
        lines.push(
          `Create a NEW BRANCH of ${skillCount} skills to graft onto the existing skill tree shown below.`
        );
      }
      lines.push(...wants, '', 'Return ONLY a single JSON object with this exact shape (no prose, no markdown fences):', '');
      lines.push(
        JSON.stringify(
          {
            loomwright: WIRE_SCHEMA_VERSION,
            kind: request.kind,
            name: request.kind === 'skilltree' ? '<evocative tree name>' : (ctx.tree?.name ?? ''),
            skills: [wireExample('skills')],
            tree: {
              nodes: [
                {
                  skill: '<name of one of your skills>',
                  tier: 0,
                  branch: '<branch name>',
                  requires: ['<names of prerequisite skills>'],
                },
              ],
            },
          },
          null,
          2
        )
      );
      lines.push(
        '',
        'Skill field guidance:',
        ...promptFieldLines('skills'),
        '',
        'Rules:',
        ...COMMON_RULES,
        '- Every skill you list must appear exactly once in tree.nodes; requires reference skill NAMES.',
        '- NEVER include coordinates — the app lays the tree out itself.',
        request.kind === 'skilltree'
          ? '- Exactly one root skill with an empty requires list; every other skill requires at least one.'
          : '- The FIRST new skill\'s requires must name one of the existing tree nodes below.'
      );
      if (request.kind === 'skilltree-branch' && ctx.tree) {
        lines.push('', 'The existing tree:', ...treeAdjacencyLines(ctx.tree));
      }
      break;
    }
    case 'questline': {
      const questCount = Math.max(2, request.count ?? 3);
      lines.push(
        `Create a QUESTLINE: ${questCount} linked quests forming one story arc, with 0-2 significant events attached to quests where fitting.`
      );
      lines.push(...wants, '', 'Return ONLY a single JSON object with this exact shape (no prose, no markdown fences):', '');
      lines.push(
        JSON.stringify(
          {
            loomwright: WIRE_SCHEMA_VERSION,
            kind: 'questline',
            quests: [wireExample('quests')],
            events: [wireExample('events')],
            chain: [{ from: '<earlier quest title>', to: '<the quest it leads to>' }],
          },
          null,
          2
        )
      );
      lines.push('', 'Quest field guidance:', ...promptFieldLines('quests'), '', 'Rules:', ...COMMON_RULES);
      const context = knownNamesBlock(ctx.known, ['cast', 'locations', 'factions']);
      if (context.length) {
        lines.push('', 'Existing entries in this project (reference them by name where fitting):', ...context);
      }
      break;
    }
    default: {
      const type = request.entityType;
      const spec = type ? entitySpec(type) : null;
      if (!spec || !type) break;
      lines.push(
        count === 1
          ? `Create ONE ${spec.displayName.toLowerCase()} entry.`
          : `Create ${count} ${ENTITY_TYPE_META[type].plural.toLowerCase()} entries.`
      );
      lines.push(...wants);
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
        ...COMMON_RULES
      );
      const context = knownNamesBlock(ctx.known, [type, 'cast', 'locations'].filter(
        (t, i, arr) => arr.indexOf(t) === i
      ) as EntityType[]);
      if (context.length) {
        lines.push('', 'Existing entries in this project (reference them by name where fitting):', ...context);
      }
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

  // Structured payloads first: skill trees and questlines.
  if (!Array.isArray(parsed)) {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.skills) && obj.tree && typeof obj.tree === 'object') {
      return parseTreePayload(obj, request, ctx, mode);
    }
    if (Array.isArray(obj.quests) && (obj.chain !== undefined || obj.events !== undefined)) {
      return parseQuestlinePayload(obj, request, ctx, mode);
    }
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

interface WireTreeNode {
  skill?: unknown;
  name?: unknown;
  tier?: unknown;
  branch?: unknown;
  requires?: unknown;
}

/** Tree payload → skill drafts + a positioned graph draft. Topology comes
 * in semantically (requires by name); layout assigns every coordinate. */
function parseTreePayload(
  obj: Record<string, unknown>,
  request: GenerationRequest,
  ctx: WireContext,
  mode: GenerationMode
): ParsedWire | WireError {
  const { drafts, warnings } = coerceEntityList(
    (obj.skills as unknown[]).map((raw) => ({ type: 'skills' as EntityType, raw })),
    ctx.known
  );
  if (!drafts.length) return { error: 'No usable skills found in the tree JSON.' };
  const draftByName = new Map(drafts.map((d) => [d.name.toLowerCase(), d]));

  const isBranch = request.kind === 'skilltree-branch' && Boolean(request.targetGraphId && ctx.tree);
  const existingByLabel = new Map(
    (ctx.tree?.nodes ?? []).map((n) => [n.label.toLowerCase(), n])
  );

  const wireNodes = Array.isArray((obj.tree as Record<string, unknown>).nodes)
    ? ((obj.tree as Record<string, unknown>).nodes as WireTreeNode[])
    : [];
  const nodes: GraphNode[] = [];
  const nodeIdByName = new Map<string, string>();
  const seenDrafts = new Set<string>();
  for (const wn of wireNodes) {
    const name = str(wn.skill ?? wn.name, 120);
    if (!name) continue;
    const draft = draftByName.get(name.toLowerCase());
    if (!draft || seenDrafts.has(draft.localId)) {
      if (!draft) warnings.push(`Tree node "${name}" has no matching skill — skipped.`);
      continue;
    }
    seenDrafts.add(draft.localId);
    const id = newId();
    nodeIdByName.set(draft.name.toLowerCase(), id);
    nodes.push({
      id,
      label: draft.name,
      x: 0,
      y: 0,
      unlocked: false,
      entity: { id: draft.localId, type: draft.type, name: draft.name },
      group: str(wn.branch, 60),
    });
  }
  // Skills the tree section forgot still become nodes (as roots).
  for (const draft of drafts) {
    if (!seenDrafts.has(draft.localId)) {
      const id = newId();
      nodeIdByName.set(draft.name.toLowerCase(), id);
      nodes.push({
        id,
        label: draft.name,
        x: 0,
        y: 0,
        unlocked: false,
        entity: { id: draft.localId, type: draft.type, name: draft.name },
      });
    }
  }

  const edges: GraphEdge[] = [];
  for (const wn of wireNodes) {
    const name = str(wn.skill ?? wn.name, 120);
    const toId = name ? nodeIdByName.get(name.toLowerCase()) : undefined;
    if (!toId) continue;
    for (const req of strList(wn.requires, 6, 120)) {
      const fromNew = nodeIdByName.get(req.toLowerCase());
      const fromExisting = existingByLabel.get(req.toLowerCase());
      const from = fromNew ?? (isBranch ? fromExisting?.id : undefined);
      if (!from) {
        warnings.push(`Prerequisite "${req}" not found for "${name}" — dropped.`);
        continue;
      }
      if (from !== toId) edges.push({ id: newId(), from, to: toId, directed: true });
    }
  }

  // Layout the new nodes (branch chains get shifted beside the tree).
  const positions = layoutTree(
    nodes.map((n) => n.id),
    edges.filter((e) => nodes.some((n) => n.id === e.from))
  );
  for (const node of nodes) {
    const pos = positions.get(node.id);
    if (pos) {
      node.x = pos.x;
      node.y = pos.y;
    }
  }
  if (isBranch && ctx.tree && ctx.tree.nodes.length) {
    const maxX = Math.max(...ctx.tree.nodes.map((n) => n.x));
    const minNewX = Math.min(...nodes.map((n) => n.x));
    const dx = maxX + 190 - minNewX;
    for (const node of nodes) node.x += dx;
  }

  const graph: BundleGraphDraft = {
    localId: newId(),
    kind: 'skilltree',
    targetGraphId: isBranch ? request.targetGraphId : undefined,
    name: str(obj.name, 80) ?? ctx.tree?.name ?? 'Generated tree',
    nodes,
    edges,
  };

  return {
    bundle: {
      id: newId(),
      projectId: ctx.projectId,
      request,
      mode,
      entities: drafts,
      graphs: [graph],
      chapters: [],
      links: [],
      warnings,
      createdAt: Date.now(),
    },
  };
}

interface WireChainLink {
  from?: unknown;
  to?: unknown;
}

/** Questline payload → quest + event drafts with leads-to links. */
function parseQuestlinePayload(
  obj: Record<string, unknown>,
  request: GenerationRequest,
  ctx: WireContext,
  mode: GenerationMode
): ParsedWire | WireError {
  const items = [
    ...(obj.quests as unknown[]).map((raw) => ({ type: 'quests' as EntityType, raw })),
    ...(Array.isArray(obj.events) ? (obj.events as unknown[]) : []).map((raw) => ({
      type: 'events' as EntityType,
      raw,
    })),
  ];
  const { drafts, warnings } = coerceEntityList(items, ctx.known);
  if (!drafts.some((d) => d.type === 'quests')) {
    return { error: 'No usable quests found in the questline JSON.' };
  }
  const byName = new Map(drafts.map((d) => [d.name.toLowerCase(), d]));
  const links: GenerationBundle['links'] = [];
  for (const raw of Array.isArray(obj.chain) ? (obj.chain as WireChainLink[]) : []) {
    const from = str(raw.from, 120);
    const to = str(raw.to, 120);
    const fromDraft = from ? byName.get(from.toLowerCase()) : undefined;
    const toDraft = to ? byName.get(to.toLowerCase()) : undefined;
    if (fromDraft && toDraft && fromDraft !== toDraft) {
      links.push({ from: fromDraft.localId, to: toDraft.localId, kind: 'leads-to' });
    } else if (from || to) {
      warnings.push(`Chain link "${from ?? '?'} → ${to ?? '?'}" didn't match quest titles — dropped.`);
    }
  }
  return {
    bundle: {
      id: newId(),
      projectId: ctx.projectId,
      request,
      mode,
      entities: drafts,
      graphs: [],
      chapters: [],
      links,
      warnings,
      createdAt: Date.now(),
    },
  };
}

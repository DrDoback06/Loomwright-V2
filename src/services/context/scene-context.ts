import { db } from '@/db/schema';
import type { Entity, Occurrence, Scene } from '@/db/types';
import { ENTITY_TYPE_META, type EntityRef, type EntityType } from '@/domain/entity-types';
import { isFieldHiddenFromAi, readAiPolicy } from '@/domain/ai-policy';
import { entitySpec, generableFields } from '@/services/generate/spec';
import { isLiveEntity, toKnownEntity } from '@/services/extraction/entity-to-known';
import { scanTextForKnownEntities } from '@/services/extraction/known-index';
import { fitToBudget, TIER_BUDGET, type ModelTier } from '@/services/ai/prompts';
import { fieldValueToText } from './field-text';

export type ContextLane = 'always' | 'detected' | 'excluded';
export type ContextDepth = 'lean' | 'standard' | 'full';

export interface ContextItem {
  ref: EntityRef;
  lane: ContextLane;
  /** Plain words, rendered verbatim in the rail. The author should never
   * have to guess why something is in their prompt. */
  reason: string;
  /** Exactly the text that will be sent — the Preview is not a paraphrase. */
  digest: string;
  chars: number;
  score: number;
}

export interface SceneContext {
  items: ContextItem[];
  budget: number;
  used: number;
  /** An individual digest was cut to fit. */
  trimmed: boolean;
  /** The assembled block, exactly as it reaches the model. */
  text: string;
}

/** Types worth spending budget on, most load-bearing first — the same order
 * `intelligence/digest.ts` already uses, rather than a second opinion about
 * which types matter. */
const TYPE_RANK: EntityType[] = [
  'cast', 'locations', 'items', 'skills', 'factions', 'quests',
  'relationships', 'events', 'lore', 'bestiary', 'classes', 'races', 'stats',
];

/** Per-depth cap on how much of one entity is worth sending. A digest that
 * eats the whole budget starves every other entity in the scene. */
const PER_ENTITY_CHARS: Record<ContextDepth, number> = {
  lean: 200,
  standard: 600,
  full: 1_400,
};

function rankOf(type: EntityType): number {
  const ix = TYPE_RANK.indexOf(type);
  return ix === -1 ? TYPE_RANK.length : ix;
}

function refOf(entity: Entity): EntityRef {
  return { id: entity.id, type: entity.type, name: entity.name };
}

/**
 * One entity as the lines a model reads, honouring the per-field AI gate.
 *
 * This is the first generic renderer of entity fields in the app — every
 * other AI path names ~8 fields by hand. It is also what makes the drawer's
 * per-field checkboxes mean anything, and what finally reads cast's
 * "AI profile" section (`writingInstructions`, `avoidTropes`), which has had
 * zero readers since it was written.
 *
 * Uses the same `generableFields` filter the drawer's checkbox list uses, so
 * the two cannot disagree about which fields exist.
 */
export function entityDigest(entity: Entity, depth: ContextDepth): string {
  const policy = readAiPolicy(entity.fields);
  const head = `${ENTITY_TYPE_META[entity.type].label} ${entity.name}`;
  const lines: string[] = [];
  if (entity.summary.trim()) lines.push(entity.summary.trim());

  if (depth !== 'lean') {
    const spec = entitySpec(entity.type);
    for (const field of spec ? generableFields(spec) : []) {
      if (isFieldHiddenFromAi(field, policy)) continue;
      const text = fieldValueToText(entity.fields[field.id]);
      if (text) lines.push(`${field.label}: ${text}`);
    }
  }

  const body = lines.join('. ');
  const capped = fitToBudget(body, PER_ENTITY_CHARS[depth]);
  return `- ${head}${capped.text ? ` — ${capped.text}` : ''}`;
}

/**
 * What the AI will be told about this scene, and why.
 *
 * Deterministic and offline: no provider, no network, no randomness. The
 * rail renders this verbatim, which is the whole point — an author should be
 * able to see exactly what leaves their machine.
 *
 * Scenes with `aiVisible: false` and sections with `hiddenFromAi` are absent
 * for free: they never reach `scene.paragraphs` in the first place (N5b).
 */
export async function buildSceneContext(
  projectId: string,
  scene: Scene,
  opts: { depth?: ContextDepth; pinned?: EntityRef[]; tier?: ModelTier } = {}
): Promise<SceneContext> {
  const tier = opts.tier ?? 'large';
  // Depth is clamped by tier exactly as `intelligence/enrich.ts` clamps it —
  // a small model asked for `full` gets a prompt it cannot use.
  const requested = opts.depth ?? 'standard';
  const depth: ContextDepth = tier === 'small' && requested === 'full' ? 'standard' : requested;
  const budget = TIER_BUDGET[tier].digestChars;

  const rows = await db.entities.where('projectId').equals(projectId).toArray();
  const world = rows.filter(isLiveEntity);
  const byId = new Map(world.map((e) => [e.id, e]));

  /** id → the strongest reason it is here, and which lane that implies. */
  const reasons = new Map<string, { lane: ContextLane; reason: string; bonus: number }>();
  const claim = (id: string, lane: ContextLane, reason: string, bonus: number) => {
    const existing = reasons.get(id);
    if (existing && existing.bonus >= bonus) return;
    reasons.set(id, { lane, reason, bonus });
  };

  // --- always ------------------------------------------------------------
  if (scene.pov) claim(scene.pov, 'always', 'POV character', 100);
  if (scene.locationId) claim(scene.locationId, 'always', 'where this scene happens', 90);
  for (const ref of opts.pinned ?? []) claim(ref.id, 'always', 'pinned', 88);
  for (const ref of scene.attachedRefs ?? []) claim(ref.id, 'always', 'attached to this scene', 85);
  for (const id of scene.characterIds ?? []) claim(id, 'always', 'in this scene', 80);
  for (const entity of world) {
    if (readAiPolicy(entity.fields).context === 'always') {
      claim(entity.id, 'always', 'set to Always', 70);
    }
  }

  // --- detected: two sources, and the assertion beats the guess -----------
  // A typed @ mention is something the author stated. It also carries what a
  // scan can never reproduce: "the ferryman" resolving to Marrow.
  const paragraphIds = new Set(scene.paragraphs.map((p) => p.id));
  const typed: Occurrence[] = (
    await db.occurrences.where('projectId').equals(projectId).toArray()
  ).filter((o) => o.source === 'typed' && o.paragraphId && paragraphIds.has(o.paragraphId));
  for (const occurrence of typed) {
    if (occurrence.entityId) claim(occurrence.entityId, 'detected', 'you linked this with @', 60);
  }

  // The live scan keeps the lane fresh for prose that has never been through
  // extraction, and is the only path that honours the case/exclusion controls.
  const text = scene.paragraphs.map((p) => p.text).join('\n');
  const mentionCount = new Map<string, number>();
  for (const hit of scanTextForKnownEntities(text, world.map((e) => toKnownEntity(e)))) {
    // A scan seeded with real entities always resolves, but the type allows
    // null for the candidate-occurrence path this does not use.
    if (!hit.entityId) continue;
    mentionCount.set(hit.entityId, (mentionCount.get(hit.entityId) ?? 0) + 1);
    claim(hit.entityId, 'detected', 'named in this scene', 40);
  }

  // --- excluded -----------------------------------------------------------
  for (const entity of world) {
    if (readAiPolicy(entity.fields).context === 'never') {
      reasons.set(entity.id, { lane: 'excluded', reason: 'set to Never', bonus: -1 });
    }
  }
  // Removed from THIS scene only, and it wins over any claim above: the
  // author said so after seeing what the matcher found. The entity's own
  // policy is untouched, so every other scene is unaffected.
  for (const ref of scene.excludedRefs ?? []) {
    reasons.set(ref.id, { lane: 'excluded', reason: 'you removed this from this scene', bonus: -1 });
  }

  const scored: ContextItem[] = [];
  for (const [id, claimed] of reasons) {
    const entity = byId.get(id);
    if (!entity) continue;
    const digest = claimed.lane === 'excluded' ? '' : entityDigest(entity, depth);
    scored.push({
      ref: refOf(entity),
      lane: claimed.lane,
      reason: claimed.reason,
      digest,
      chars: digest.length,
      // Lane dominates, then why it is here, then how often it is named,
      // then which type earns its space. Mentions are logarithmic on purpose:
      // a name said nine times is not nine times more relevant than one said
      // once, it is just the POV character again.
      score:
        (claimed.lane === 'always' ? 1_000 : 0) +
        claimed.bonus +
        Math.log2(1 + (mentionCount.get(id) ?? 0)) * 6 -
        rankOf(entity.type),
    });
  }
  scored.sort((a, b) => b.score - a.score || a.ref.name.localeCompare(b.ref.name));

  // --- fit to budget ------------------------------------------------------
  // `always` is ranked first so it is the LAST thing cut — but it is still
  // cut. Thirty entities marked Always would otherwise blow a small model's
  // whole allowance and fail the request outright. Anything that does not
  // fit moves to `excluded` and says so, because silently overflowing and
  // silently dropping a promise are both worse than naming what was left out.
  const items: ContextItem[] = [];
  const kept: string[] = [];
  let used = 0;
  let trimmed = false;
  for (const item of scored) {
    if (item.lane === 'excluded') {
      items.push(item);
      continue;
    }
    if (used + item.chars > budget) {
      items.push({ ...item, lane: 'excluded', reason: 'no room in the budget', digest: '', chars: 0 });
      continue;
    }
    items.push(item);
    kept.push(item.digest);
    used += item.chars;
  }

  const assembled = fitToBudget(kept.join('\n'), budget);
  trimmed = assembled.trimmed;

  return { items, budget, used, trimmed, text: assembled.text };
}

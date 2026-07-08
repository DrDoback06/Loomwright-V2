import type { EntityRef, EntityType } from '@/domain/entity-types';
import { newId } from '@/lib/id';
import { entitySpec, generableFields } from '@/services/generate/spec';
import { matchArchetype, resolveTheme } from '@/services/generate/random/packs';
import { generateSkillDraft, skillsPack } from '@/services/generate/random/packs/skills';
import { createRng } from '@/services/generate/random/rng';
import type { ExtractionCandidate } from '@/services/extraction/detectors';
import { findKnownEntityMention, type KnownEntity } from '@/services/extraction/known-index';
import { emptyDelta, type StoryDelta } from './types';

/** What the offline propagation rules read: the project's known entities
 * (for id→ref resolution), a light view of the current entity rows (for
 * before-values + conflict detection), and the source text (for the
 * skill-learned scan the 12 detectors don't cover). */
export interface PropagateContext {
  projectId: string;
  known: KnownEntity[];
  entities: { id: string; type: EntityType; name: string; fields: Record<string, unknown> }[];
  text?: string;
  /** Theme id (or 'any') flavoring rich offline expansions (skills). */
  theme?: string;
}

function refById(ctx: PropagateContext, id: string | undefined): EntityRef | undefined {
  if (!id) return undefined;
  const k = ctx.known.find((e) => e.id === id);
  return k ? { id: k.id, type: k.type, name: k.name } : undefined;
}

function entityById(ctx: PropagateContext, id: string | undefined) {
  return id ? ctx.entities.find((e) => e.id === id) : undefined;
}

type Rule = (c: ExtractionCandidate, ctx: PropagateContext, delta: StoryDelta) => void;

/** item-transfer → set currentOwner (replace), append ownershipHistory, and
 * flag a conflict when the recorded owner isn't the one giving it away. */
const itemTransferRule: Rule = (c, ctx, delta) => {
  const item = entityById(ctx, c.existingEntityId ?? undefined);
  if (!item) return;
  const receiver = c.suggestedChanges?.currentOwner as EntityRef | undefined;
  if (!receiver?.id) return;
  // relatedEntityIds is [giver?, receiver?].filter(Boolean) — when the giver
  // is a pronoun the array collapses to just the receiver, so pick the giver
  // as the related id that ISN'T the receiver (undefined if none is known).
  const giver = refById(ctx, (c.relatedEntityIds ?? []).find((id) => id !== receiver.id));
  const recordedOwner = item.fields.currentOwner as EntityRef | undefined;
  const conflict = Boolean(recordedOwner?.id && giver?.id && recordedOwner.id !== giver.id);
  delta.patches.push({
    entityId: item.id, entityType: 'items', entityName: item.name,
    field: 'currentOwner', mode: 'replace',
    before: recordedOwner ?? null, after: receiver,
    confidence: c.confidence,
    reason: `${giver?.name ? `${giver.name} ` : ''}handed ${item.name} to ${receiver.name}.`,
    conflict,
  });
  delta.patches.push({
    entityId: item.id, entityType: 'items', entityName: item.name,
    field: 'ownershipHistory', mode: 'append',
    before: item.fields.ownershipHistory ?? '',
    after: `Passed to ${receiver.name}${giver ? ` (from ${giver.name})` : ''}.`,
    confidence: c.confidence, reason: 'Ownership history appended.',
  });
  if (conflict) {
    delta.warnings.push(
      `${item.name}: recorded owner ${recordedOwner?.name ?? '?'} isn't the one handing it over — flagged for review.`
    );
  }
};

/** item-loss → set status to lost/destroyed (replace). */
const itemLossRule: Rule = (c, ctx, delta) => {
  const item = entityById(ctx, c.existingEntityId ?? undefined);
  if (!item) return;
  const destroyed = Boolean(c.suggestedChanges?.destroyed);
  delta.patches.push({
    entityId: item.id, entityType: 'items', entityName: item.name,
    field: 'status', mode: 'replace',
    before: item.fields.status ?? null, after: destroyed ? 'destroyed' : 'lost',
    confidence: c.confidence,
    reason: destroyed ? `${item.name} was destroyed.` : `${item.name} was lost.`,
  });
};

/** travel → set currentLocation (replace) + append the place to travelHistory. */
const travelRule: Rule = (c, ctx, delta) => {
  const actor = entityById(ctx, c.existingEntityId ?? undefined);
  if (!actor) return;
  const placeId = (c.suggestedChanges?.location as string) ?? c.relatedEntityIds?.[0];
  const place = refById(ctx, placeId);
  if (!place) return;
  const currentLoc = actor.fields.currentLocation as EntityRef | undefined;
  if (currentLoc?.id !== place.id) {
    delta.patches.push({
      entityId: actor.id, entityType: 'cast', entityName: actor.name,
      field: 'currentLocation', mode: 'replace',
      before: currentLoc ?? null, after: place,
      confidence: c.confidence, reason: `${actor.name} travelled to ${place.name}.`,
    });
  }
  const history = (actor.fields.travelHistory as EntityRef[] | undefined) ?? [];
  if (!history.some((h) => h.id === place.id)) {
    delta.patches.push({
      entityId: actor.id, entityType: 'cast', entityName: actor.name,
      field: 'travelHistory', mode: 'append',
      before: history, after: place,
      confidence: c.confidence, reason: `${place.name} added to ${actor.name}'s travels.`,
    });
  }
};

/** relationship signal → create a relationship entity between two cast. */
const relationshipRule: Rule = (c, ctx, delta) => {
  const from = refById(ctx, c.suggestedChanges?.fromId ? String(c.suggestedChanges.fromId) : undefined);
  const to = refById(ctx, c.suggestedChanges?.toId ? String(c.suggestedChanges.toId) : undefined);
  if (!from || !to) return;
  delta.entities.push({
    localId: newId(), type: 'relationships',
    name: c.name || `${from.name} → ${to.name}`,
    aliases: [], summary: c.summary ?? '', tags: [],
    fields: { from, to, bondType: String(c.suggestedChanges?.relationshipType ?? '') },
  });
};

/** quest-progress → create/advance the quest, and hand back a concrete,
 * ready-to-accept outcome suggestion (a co-DM's finished card). */
const questProgressRule: Rule = (c, ctx, delta) => {
  const existing = c.existingEntityId ? entityById(ctx, c.existingEntityId) : undefined;
  if (existing) {
    delta.patches.push({
      entityId: existing.id, entityType: 'quests', entityName: existing.name,
      field: 'status', mode: 'replace',
      // 'Active' verbatim — the quests config status pill is capitalized.
      before: existing.fields.status ?? null, after: 'Active',
      confidence: c.confidence, reason: `${existing.name} is underway.`,
    });
  } else {
    delta.entities.push({
      localId: newId(), type: 'quests', name: c.name, aliases: [], summary: c.summary ?? '',
      tags: [], fields: { status: 'Active' },
    });
  }
  delta.suggestions.push({
    targetRef: existing ? { id: existing.id, type: 'quests', name: existing.name } : undefined,
    kind: 'quest-outcome',
    title: `${c.name}: it succeeds — but the win plants the next problem`,
    detail: `Resolve ${c.name} with a hard-won victory whose cost opens the following arc.`,
    source: 'local', confidence: 0.55,
  });
};

const RULES: Record<string, Rule> = {
  itemTransfer: itemTransferRule,
  itemLoss: itemLossRule,
  travel: travelRule,
  relationships: relationshipRule,
  questProgression: questProgressRule,
};

/** Fallback for candidates without a bespoke rule: create → a plain draft;
 * update → replace patches for keys that are real fields of the type
 * (skips detector-internal keys like `verb`/`direction`), plus the legacy
 * voiceProfile → speechStyle mapping. Never dumps junk into `fields`. */
const genericRule: Rule = (c, ctx, delta) => {
  if (c.suggestedAction === 'create') {
    const fields: Record<string, unknown> = {};
    // NEW place → infer its parent from a containment cue ("a town in the
    // Vraska region"): fuzzy-match a known location, else flag a picker.
    if (c.entityType === 'locations') {
      const { parentId, cue } = inferParentId(c, ctx);
      if (parentId) fields.parentId = parentId;
      else if (cue) {
        delta.suggestions.push({
          kind: 'location-parent',
          title: `Nest ${c.name} under its parent`,
          detail: `The text places it in “${cue}” — pick or create the parent location.`,
          source: 'local', confidence: 0.5,
        });
      }
    }
    delta.entities.push({
      localId: newId(), type: c.entityType, name: c.name, aliases: [],
      summary: c.summary ?? '', tags: [], fields,
    });
    return;
  }
  const entity = entityById(ctx, c.existingEntityId ?? undefined);
  if (!entity) return;
  // A 'merge' candidate is a discovered surface form (nickname) of an
  // existing entity — fold its name in as an alias. applyBundle's merge
  // path (existingEntityId set) unions aliases into the row.
  if (c.suggestedAction === 'merge') {
    if (c.name && c.name.toLowerCase() !== entity.name.toLowerCase()) {
      delta.entities.push({
        localId: newId(), type: c.entityType, name: entity.name, aliases: [c.name],
        summary: '', tags: [], fields: {}, existingEntityId: entity.id,
      });
    }
    return;
  }
  const spec = entitySpec(c.entityType);
  const validFields = new Set(spec ? generableFields(spec).map((f) => f.id) : []);
  for (const [key, value] of Object.entries(c.suggestedChanges ?? {})) {
    if (key === 'voiceProfile') {
      delta.patches.push({
        entityId: entity.id, entityType: c.entityType, entityName: entity.name,
        field: 'speechStyle', mode: 'append', before: entity.fields.speechStyle ?? '',
        after: String(value), confidence: c.confidence, reason: 'Speech sample captured.',
      });
    } else if (validFields.has(key)) {
      delta.patches.push({
        entityId: entity.id, entityType: c.entityType, entityName: entity.name,
        field: key, mode: 'replace', before: entity.fields[key] ?? null,
        after: value, confidence: c.confidence, reason: `${key} updated.`,
      });
    }
  }
};

const CONTAINMENT_RE =
  /\b(?:in|within|inside|part of|nestled in|deep in)\s+(?:the\s+)?([A-Z][A-Za-z' -]{2,40}?)(?=\s+(?:region|realm|province|kingdom|valley|reaches|marches|wood|hills)?\b|[.,;:!?\n]|$)/;

/** Infer a new location's parent from a containment cue in its source
 * quote — a fuzzy-matched known location (the parent ref) or, failing a
 * match, the raw cue text (so the review board can offer a picker). */
function inferParentId(
  c: ExtractionCandidate,
  ctx: PropagateContext
): { parentId?: EntityRef; cue?: string } {
  const quote = [c.sourceQuote, ...(c.sourceQuotes ?? [])].filter(Boolean).join(' ');
  const m = CONTAINMENT_RE.exec(quote);
  if (!m) return {};
  const cue = m[1].trim();
  if (cue.toLowerCase() === c.name.toLowerCase()) return {};
  const match = findKnownEntityMention(
    cue,
    ctx.known.filter((e) => e.type === 'locations'),
    { threshold: 0.85 }
  );
  if (match) return { parentId: { id: match.entity.id, type: 'locations', name: match.entity.name } };
  return { cue };
}

const SKILL_LEARNED_RE =
  /\b([A-Z][a-z]+)\s+(?:learned|mastered|studied|trained in|picked up)\s+(?:the\s+)?([A-Z][A-Za-z' -]{2,40}?)(?=\s+(?:from|with|at|in|and|to|for|when|after|before|by)\b|[.,;:!?\n]|$)/g;

function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0);
  return h % 100000;
}

/** The skill-learned rule (offline, text-driven — the 12 detectors have no
 * skill signal). When a known character learns a skill: ensure the skill
 * exists (a rich sheet via the skills pack when it's new), add it to the
 * character, and hand back tree-placement + sibling suggestions. */
export function scanSkillsLearned(text: string, ctx: PropagateContext, delta: StoryDelta): void {
  const castEntities = ctx.known.filter((e) => e.type === 'cast');
  const skillEntities = ctx.known.filter((e) => e.type === 'skills');
  const learnedThisPass = new Set<string>();
  let m: RegExpExecArray | null;
  const re = new RegExp(SKILL_LEARNED_RE);
  while ((m = re.exec(text)) !== null) {
    const actorMatch = findKnownEntityMention(m[1], castEntities, { threshold: 0.85 });
    if (!actorMatch) continue;
    const skillName = m[2].trim().replace(/\s+/g, ' ');
    if (skillName.length < 3) continue;
    const key = `${actorMatch.entity.id}|${skillName.toLowerCase()}`;
    if (learnedThisPass.has(key)) continue;
    learnedThisPass.add(key);

    const actor: EntityRef = { id: actorMatch.entity.id, type: 'cast', name: actorMatch.entity.name };
    const known = findKnownEntityMention(skillName, skillEntities, { threshold: 0.9 });
    let skillRef: EntityRef;

    if (known) {
      skillRef = { id: known.entity.id, type: 'skills', name: known.entity.name };
    } else {
      // Rich sheet: match the name to a school and generate a full skill.
      const rng = createRng(hashSeed(skillName));
      const theme = resolveTheme(rng, ctx.theme);
      const arch = matchArchetype(rng, skillsPack, theme, skillName);
      const draft = generateSkillDraft(rng, arch, { theme, hint: skillName, known: ctx.known }, { name: skillName });
      draft.fields.assignedCast = [actor];
      delta.entities.push(draft);
      skillRef = { id: draft.localId, type: 'skills', name: skillName };

      // Sibling / next-tier suggestions from the same school (finished cards).
      delta.suggestions.push({
        targetRef: skillRef,
        kind: 'skill-sibling',
        title: `${skillName} II — a stronger form in the ${arch.id} line`,
        detail: `The next tier of ${skillName}: same school, higher cost, wider reach.`,
        source: 'local', confidence: 0.6,
      });
    }

    // Add the skill onto the character (dedupe against what they already have).
    const actorRow = entityById(ctx, actor.id);
    const currentSkills = (actorRow?.fields.skills as EntityRef[] | undefined) ?? [];
    if (!currentSkills.some((s) => s.id === skillRef.id || s.name === skillRef.name)) {
      delta.patches.push({
        entityId: actor.id, entityType: 'cast', entityName: actor.name,
        field: 'skills', mode: 'append', before: currentSkills, after: skillRef,
        confidence: 0.75, reason: `${actor.name} learned ${skillName}.`,
      });
    }

    // Tree-placement suggestion: match the skill's school to an existing tree.
    delta.suggestions.push({
      targetRef: skillRef,
      kind: 'skill-placement',
      title: `Place ${skillName} on a skill tree`,
      detail: `${skillName} fits a combat/utility branch — drop it onto the matching tree.`,
      source: 'local', confidence: 0.5,
    });
  }
}

/** Turn detector candidates (+ optional source text) into a StoryDelta of
 * facts and forward-looking suggestions — all offline, all deterministic.
 * Accept applies the facts as one Undo; suggestions ride the inbox lane. */
export function propagate(candidates: ExtractionCandidate[], ctx: PropagateContext): StoryDelta {
  const delta = emptyDelta(newId(), ctx.projectId, 'local', Date.now());
  for (const c of candidates) {
    const rule = RULES[c.detector ?? ''] ?? genericRule;
    rule(c, ctx, delta);
  }
  if (ctx.text) scanSkillsLearned(ctx.text, ctx, delta);
  return delta;
}

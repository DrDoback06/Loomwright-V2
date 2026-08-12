import type { Entity, SkillTree } from '@/db/types';
import { ENTITY_TYPE_META, type EntityRef, type EntityType } from '@/domain/entity-types';
import type { ExtractionCandidate, ExtractionSignal } from '@/services/extraction/detectors';
import { confidenceBand } from '@/services/extraction/text-utils';
import { findKnownEntityMention, type KnownEntity } from '@/services/extraction/known-index';
import { toKnownEntity } from '@/services/extraction/entity-to-known';
import { deepPackFor, matchArchetype, resolveTheme } from '@/services/generate/random/packs';
import { createRng } from '@/services/generate/random/rng';
import {
  suggestForSkill,
  suggestFromRelationshipWeb,
  suggestQuestOutcome,
  type SuggestionVolume,
} from './suggestions';
import type {
  DeltaConflict,
  DeltaEntityCreate,
  DeltaGraphPlacement,
  DeltaGroup,
  DeltaHierarchyPlacement,
  DeltaLink,
  DeltaPatch,
  DeltaSuggestion,
  DeltaUnit,
} from './types';

/** What a rule may contribute. Rules never touch Dexie — they return units
 * and `applyDelta` is the only writer. That keeps them pure and testable. */
export interface RuleOutput {
  entities: DeltaEntityCreate[];
  patches: DeltaPatch[];
  graphPlacements: DeltaGraphPlacement[];
  hierarchyPlacements: DeltaHierarchyPlacement[];
  links: DeltaLink[];
  suggestions: DeltaSuggestion[];
  /** One cascade per rule firing — the board renders each as a group. */
  groups: DeltaGroup[];
  warnings: string[];
  /** Provisional ids this rule leaned on, so their create unit can follow it
   * into the same group. */
  usedProvisional?: string[];
}

export interface RuleContext {
  projectId: string;
  /** Every live entity in the project. */
  entities: Entity[];
  /** Existing skill trees, for placement matching. */
  trees: SkillTree[];
  /** How chatty the suggestions lane is (Settings ▸ Extraction). */
  volume: SuggestionVolume;
  /** Deterministic id factories — seeded in tests for stable fixtures. */
  newUnitId: () => string;
  newLocalId: () => string;
}

/**
 * Something a rule can read state off and write patches against: either a row
 * that already exists, or a draft this same delta is about to create.
 *
 * Rules used to take `Entity | undefined` and give up when the lookup missed,
 * which is why a fresh project produced nothing — every participant missed.
 * A target hides the difference, and `applyDelta` swaps draft ids for real
 * ones at accept time, so a patch written against a name discovered thirty
 * seconds ago lands on the row that name became.
 */
interface RuleTarget {
  id: string;
  type: EntityType;
  name: string;
  fields: Record<string, unknown>;
  /** True when `id` is a draft local id rather than a database id. */
  isNew: boolean;
}

/** Internal context: the public one plus whatever the introductions phase
 * discovered. Kept private so existing callers construct RuleContext as before. */
interface RuleRun extends RuleContext {
  /** Drafts created this run, by provisional id. */
  provisional: Map<string, RuleTarget>;
  /** Provisional ids a consequence cascade depends on — their create unit
   * moves into that cascade so a per-group toggle stays coherent. */
  claimed: Map<string, string>;
}

function emptyOutput(): RuleOutput {
  return {
    entities: [],
    patches: [],
    graphPlacements: [],
    hierarchyPlacements: [],
    links: [],
    suggestions: [],
    groups: [],
    warnings: [],
    usedProvisional: [],
  };
}

function mergeOutputs(outputs: RuleOutput[]): RuleOutput {
  const out = emptyOutput();
  for (const o of outputs) {
    out.entities.push(...o.entities);
    out.patches.push(...o.patches);
    out.graphPlacements.push(...o.graphPlacements);
    out.hierarchyPlacements.push(...o.hierarchyPlacements);
    out.links.push(...o.links);
    out.suggestions.push(...o.suggestions);
    out.groups.push(...o.groups);
    out.warnings.push(...o.warnings);
    out.usedProvisional!.push(...(o.usedProvisional ?? []));
  }
  return out;
}

/** Close a rule's output into one cascade the board can render and toggle.
 * The group's confidence is its weakest member — a cascade is only as
 * trustworthy as its shakiest step. */
function closeGroup(
  out: RuleOutput,
  ctx: RuleRun,
  subject: DeltaGroup['subject'],
  headline: string
): RuleOutput {
  const units: DeltaUnit[] = [
    ...out.entities,
    ...out.patches,
    ...out.graphPlacements,
    ...out.hierarchyPlacements,
    ...out.links,
    ...out.suggestions,
  ];
  if (!units.length) return out;
  const confidence = units.reduce((min, u) => Math.min(min, u.confidence), 1);
  const groupId = ctx.newUnitId();
  for (const id of out.usedProvisional ?? []) {
    if (!ctx.claimed.has(id)) ctx.claimed.set(id, groupId);
  }
  out.groups.push({
    id: groupId,
    subject,
    headline,
    unitIds: units.map((u) => u.unitId),
    confidence,
    confidenceBand: confidenceBand(confidence),
    flagged: out.patches.some((p) => p.conflict),
  });
  return out;
}

/** The DeltaUnit envelope every unit shares. */
function envelope(ctx: RuleRun, confidence: number, sourceQuote: string, origin: string): DeltaUnit {
  return {
    unitId: ctx.newUnitId(),
    confidence,
    confidenceBand: confidenceBand(confidence),
    sourceQuote,
    origin,
  };
}

function refOf(entity: Entity | KnownEntity | RuleTarget): EntityRef {
  return { id: entity.id, type: entity.type, name: entity.name };
}

function targetOf(entity: Entity): RuleTarget {
  return { id: entity.id, type: entity.type, name: entity.name, fields: entity.fields ?? {}, isNew: false };
}

/**
 * Resolve an id to a target: a real row first, then a draft this run created.
 * Recording the hit in `claimed` is what keeps the board honest — the create
 * and the consequences that depend on it end up in the same toggle group.
 */
function findTarget(ctx: RuleRun, id: string | null): RuleTarget | undefined {
  if (!id) return undefined;
  const real = ctx.entities.find((e) => e.id === id);
  if (real) return targetOf(real);
  return ctx.provisional.get(id);
}

/** Note that `out` depends on a draft, so `closeGroup` can pull the draft's
 * create unit into the same cascade. */
function dependOn(out: RuleOutput, target: RuleTarget | undefined): void {
  if (target?.isNew && !out.usedProvisional!.includes(target.id)) {
    out.usedProvisional!.push(target.id);
  }
}

function knownList(ctx: RuleRun): KnownEntity[] {
  return [
    ...ctx.entities.map((e) => toKnownEntity(e)),
    // A provisional target is a row that does not exist yet — there is no
    // stored entity to map, so this one stays hand-built.
    ...[...ctx.provisional.values()].map((t) => ({ id: t.id, type: t.type, name: t.name, aliases: [] })),
  ];
}

/** Resolve a bare name against the project (and this run's drafts), one type. */
function resolveByName(ctx: RuleRun, name: string, type: Entity['type']): RuleTarget | undefined {
  const match = findKnownEntityMention(
    name,
    knownList(ctx).filter((e) => e.type === type),
    { threshold: 0.85 }
  );
  return match ? findTarget(ctx, match.entity.id) : undefined;
}

/** A related-multi field's members, whatever shape the bag holds. */
function asMemberList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : value == null ? [] : [value];
}

/** A ref field's current value as a comparable id, whatever shape it's in. */
function refIdOf(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
// Rule: item transfer
// ─────────────────────────────────────────────────────────────────────────

/**
 * An item changed hands. Flip `currentOwner`, append a chain-of-custody row,
 * and put it in the receiver's inventory.
 *
 * The conflict flag is the point of the whole exercise: if the prose says
 * Marrow handed it over but the codex says Vex already owned it, the author
 * has a continuity error — or we misread a scene. We take the best guess so
 * Accept-all still works, and flag it with a picker either way.
 */
function ruleItemTransfer(
  signal: Extract<ExtractionSignal, { kind: 'item-transfer' }>,
  candidate: ExtractionCandidate,
  ctx: RuleRun
): RuleOutput {
  const out = emptyOutput();
  const item = findTarget(ctx, signal.itemId);
  if (!item) return out;
  dependOn(out, item);
  const receiver = findTarget(ctx, signal.toId);
  if (!receiver) {
    out.warnings.push(
      `"${signal.itemName}" changes hands but the new owner was not named — no owner change applied.`
    );
    return out;
  }

  dependOn(out, receiver);
  const quote = candidate.sourceQuote;
  const recordedOwnerId = refIdOf(item.fields.currentOwner);
  const recordedOwner = findTarget(ctx, recordedOwnerId);

  let conflict: DeltaConflict | undefined;
  if (signal.fromId && recordedOwnerId && recordedOwnerId !== signal.fromId) {
    const giver = findTarget(ctx, signal.fromId);
    conflict = {
      reason: `${signal.itemName} is recorded as ${recordedOwner?.name ?? 'someone else'}'s, but ${
        signal.fromName ?? 'another character'
      } hands it over here.`,
      recorded: item.fields.currentOwner,
      expected: giver ? refOf(giver) : signal.fromName,
      options: [
        { label: `${receiver.name} owns it now`, value: refOf(receiver) },
        ...(recordedOwner
          ? [{ label: `Keep ${recordedOwner.name} as owner`, value: refOf(recordedOwner) }]
          : []),
      ],
    };
  }

  // Confidence drops when the recorded state disagrees — the author should
  // look at this one before accepting the whole board.
  const confidence = conflict ? Math.min(candidate.confidence, 0.55) : candidate.confidence;

  out.patches.push({
    ...envelope(ctx, confidence, quote, 'itemTransfer'),
    entityId: item.id,
    entityType: 'items',
    entityName: item.name,
    fieldId: 'currentOwner',
    fieldLabel: 'Current owner',
    before: item.fields.currentOwner ?? null,
    after: refOf(receiver),
    mode: 'replace',
    conflict,
  });

  out.patches.push({
    ...envelope(ctx, confidence, quote, 'itemTransfer'),
    entityId: item.id,
    entityType: 'items',
    entityName: item.name,
    fieldId: 'ownershipHistory',
    fieldLabel: 'Ownership history',
    before: item.fields.ownershipHistory ?? [],
    after: signal.fromName
      ? `${signal.fromName} → ${receiver.name}`
      : `→ ${receiver.name}`,
    mode: 'append',
  });

  out.patches.push({
    ...envelope(ctx, confidence, quote, 'itemTransfer'),
    entityId: receiver.id,
    entityType: 'cast',
    entityName: receiver.name,
    fieldId: 'inventory',
    fieldLabel: 'Inventory',
    before: receiver.fields.inventory ?? [],
    after: refOf(item),
    mode: 'append',
  });

  // ...and the giver stops having it. Appending to the receiver without
  // removing from the giver is how a codex ends up with three people holding
  // the same sword by chapter nine.
  const giverTarget = findTarget(ctx, signal.fromId);
  if (giverTarget && giverTarget.id !== receiver.id) {
    const held = asMemberList(giverTarget.fields.inventory).some(
      (entry) => refIdOf(entry) === item.id
    );
    if (held) {
      out.patches.push({
        ...envelope(ctx, confidence, quote, 'itemTransfer'),
        entityId: giverTarget.id,
        entityType: 'cast',
        entityName: giverTarget.name,
        fieldId: 'inventory',
        fieldLabel: 'Inventory',
        before: giverTarget.fields.inventory ?? [],
        after: refOf(item),
        mode: 'remove',
      });
    }
  }

  return closeGroup(
    out,
    ctx,
    { id: item.id, type: 'items', name: item.name },
    signal.fromName
      ? `${signal.fromName} gave ${item.name} to ${receiver.name}`
      : `${item.name} passed to ${receiver.name}`
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Rule: item loss
// ─────────────────────────────────────────────────────────────────────────

function ruleItemLoss(
  signal: Extract<ExtractionSignal, { kind: 'item-loss' }>,
  candidate: ExtractionCandidate,
  ctx: RuleRun
): RuleOutput {
  const out = emptyOutput();
  const item = findTarget(ctx, signal.itemId);
  if (!item) return out;
  dependOn(out, item);
  const status = signal.destroyed ? 'destroyed' : 'lost';
  if (item.fields.status === status) return out; // already recorded

  out.patches.push({
    ...envelope(ctx, candidate.confidence, candidate.sourceQuote, 'itemLoss'),
    entityId: item.id,
    entityType: 'items',
    entityName: item.name,
    fieldId: 'status',
    fieldLabel: 'Status',
    before: item.fields.status ?? null,
    after: status,
    mode: 'replace',
  });
  if (signal.destroyed) {
    out.patches.push({
      ...envelope(ctx, candidate.confidence, candidate.sourceQuote, 'itemLoss'),
      entityId: item.id,
      entityType: 'items',
      entityName: item.name,
      fieldId: 'condition',
      fieldLabel: 'Condition',
      before: item.fields.condition ?? null,
      after: 'Destroyed',
      mode: 'replace',
    });
  }
  return closeGroup(
    out,
    ctx,
    { id: item.id, type: 'items', name: item.name },
    `${item.name} was ${signal.destroyed ? 'destroyed' : 'lost'}`
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Rule: travel
// ─────────────────────────────────────────────────────────────────────────

/**
 * A character reached a place. Move them, log the leg, and — when the place
 * is new — create it nested under the region the sentence named. Nesting is
 * the part that makes the Atlas build itself as the book is written.
 */
function ruleTravel(
  signal: Extract<ExtractionSignal, { kind: 'travel' }>,
  candidate: ExtractionCandidate,
  ctx: RuleRun
): RuleOutput {
  const out = emptyOutput();
  const actor = findTarget(ctx, signal.actorId);
  if (!actor) return out;
  dependOn(out, actor);
  const quote = candidate.sourceQuote;

  // Resolve the destination: known id → fuzzy name match → a new draft.
  let placeRef: EntityRef;
  let placeIsNew = false;
  const known = findTarget(ctx, signal.placeId) ?? resolveByName(ctx, signal.placeName, 'locations');
  if (known) {
    placeRef = refOf(known);
    placeIsNew = known.isNew;
    dependOn(out, known);
  } else {
    const localId = ctx.newLocalId();
    placeIsNew = true;
    placeRef = { id: localId, type: 'locations', name: signal.placeName };
    out.entities.push({
      ...envelope(ctx, candidate.confidence, quote, 'travel'),
      draft: {
        localId,
        type: 'locations',
        name: signal.placeName,
        aliases: [],
        summary: `First reached in this chapter.`,
        tags: [],
        // 'Settlement' was not one of the locations config's `kind` options,
        // so every place the engine created arrived with an invalid pill the
        // editor could not render as selected.
        fields: { kind: 'Other' },
      },
    });
  }

  if (refIdOf(actor.fields.currentLocation) !== placeRef.id) {
    out.patches.push({
      ...envelope(ctx, candidate.confidence, quote, 'travel'),
      entityId: actor.id,
      entityType: 'cast',
      entityName: actor.name,
      fieldId: 'currentLocation',
      fieldLabel: 'Current location',
      before: actor.fields.currentLocation ?? null,
      after: placeRef,
      mode: 'replace',
    });
  }
  out.patches.push({
    ...envelope(ctx, candidate.confidence, quote, 'travel'),
    entityId: actor.id,
    entityType: 'cast',
    entityName: actor.name,
    fieldId: 'travelHistory',
    fieldLabel: 'Travel history',
    before: actor.fields.travelHistory ?? [],
    after: placeRef,
    mode: 'append',
  });

  // Nesting. A hint from the sentence beats nothing; an unresolvable hint
  // still lands on the board as a picker rather than being dropped.
  if (placeIsNew) {
    const parent = signal.parentHint ? resolveByName(ctx, signal.parentHint, 'locations') : undefined;
    if (parent) {
      out.hierarchyPlacements.push({
        ...envelope(ctx, Math.min(candidate.confidence, 0.8), quote, 'travel'),
        childId: placeRef.id,
        childName: placeRef.name,
        parentId: parent.id,
        parentName: parent.name,
      });
    } else if (signal.parentHint) {
      out.hierarchyPlacements.push({
        ...envelope(ctx, 0.4, quote, 'travel'),
        childId: placeRef.id,
        childName: placeRef.name,
        parentId: null,
        parentName: signal.parentHint,
        unresolvedParentName: signal.parentHint,
      });
    }
  }

  const nesting = out.hierarchyPlacements[0];
  return closeGroup(
    out,
    ctx,
    { id: actor.id, type: 'cast', name: actor.name },
    `${actor.name} reached ${placeRef.name}${
      nesting ? ` — nested under ${nesting.parentName}` : placeIsNew ? ' (new place)' : ''
    }`
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Rule: skill learned
// ─────────────────────────────────────────────────────────────────────────

/**
 * The headline cascade. A character learned a skill, so:
 *   1. the skill becomes a real entity (rich sheet from the skills pack when
 *      it is new — an archetype match gives it cost/effects/type, not a bare
 *      name), and
 *   2. it attaches to that character (both directions), and
 *   3. it is placed on the tree whose branch names best match the archetype.
 *
 * Sibling and next-tier suggestions hang off this same cascade in X4.
 */
function ruleSkillLearned(
  signal: Extract<ExtractionSignal, { kind: 'skill-learned' }>,
  candidate: ExtractionCandidate,
  ctx: RuleRun
): RuleOutput {
  const out = emptyOutput();
  const actor = findTarget(ctx, signal.actorId);
  dependOn(out, actor);
  const quote = candidate.sourceQuote;

  let skillRef: EntityRef;
  const knownSkill =
    findTarget(ctx, signal.skillId) ?? resolveByName(ctx, signal.skillName, 'skills');
  if (knownSkill) {
    skillRef = refOf(knownSkill);
    dependOn(out, knownSkill);
  } else {
    const localId = ctx.newLocalId();
    skillRef = { id: localId, type: 'skills', name: signal.skillName };
    out.entities.push({
      ...envelope(ctx, candidate.confidence, quote, 'skill-learned'),
      draft: {
        localId,
        type: 'skills',
        name: signal.skillName,
        aliases: [],
        summary: actor ? `Learned by ${actor.name}.` : 'Learned in this chapter.',
        tags: [],
        fields: skillSheetFor(signal.skillName),
      },
    });
  }

  if (actor) {
    out.patches.push({
      ...envelope(ctx, candidate.confidence, quote, 'skill-learned'),
      entityId: actor.id,
      entityType: 'cast',
      entityName: actor.name,
      fieldId: 'skills',
      fieldLabel: 'Skills',
      before: actor.fields.skills ?? [],
      after: skillRef,
      mode: 'append',
    });
    if (knownSkill) {
      out.patches.push({
        ...envelope(ctx, candidate.confidence, quote, 'skill-learned'),
        entityId: knownSkill.id,
        entityType: 'skills',
        entityName: knownSkill.name,
        fieldId: 'assignedCast',
        fieldLabel: 'Assigned characters',
        before: knownSkill.fields.assignedCast ?? [],
        after: refOf(actor),
        mode: 'append',
      });
    }
  }

  // Tree placement — pick the tree whose name or branch groups best match.
  const placement = placeOnTree(ctx, signal.skillName, skillRef, candidate.confidence, quote);
  if (placement) out.graphPlacements.push(placement);

  // The ripple: what this skill grows into, what sits beside it, and who else
  // in the relationship web could plausibly learn it. All offline.
  out.suggestions.push(...suggestForSkill(skillRef.name, skillRef, ctx.volume));
  if (actor) {
    out.suggestions.push(
      ...suggestFromRelationshipWeb(actor, ctx.entities, ctx.volume, {
        learnedSkill: skillRef.name,
      })
    );
  }

  const subject = actor
    ? { id: actor.id, type: 'cast' as const, name: actor.name }
    : { id: skillRef.id, type: 'skills' as const, name: skillRef.name };
  const placedAt = placement
    ? ` → ${placement.graphName}${placement.group ? ` ▸ ${placement.group}` : ''}`
    : '';
  return closeGroup(
    out,
    ctx,
    subject,
    actor ? `${actor.name} learned ${skillRef.name}${placedAt}` : `${skillRef.name} learned${placedAt}`
  );
}

/**
 * A starter skill sheet from the archetype the name matches, so a brand-new
 * skill arrives with a cost, a type and effects rather than as an empty row.
 * The pack's own generated name is discarded — the prose already named it.
 * Seeded off the name so the same skill always rolls the same sheet.
 */
function skillSheetFor(name: string): Record<string, unknown> {
  const pack = deepPackFor('skills');
  if (!pack) return { skillType: 'active' };
  try {
    const rng = createRng(hashName(name));
    const theme = resolveTheme(rng);
    const arch = matchArchetype(rng, pack, theme, name);
    const draft = pack.generate(rng, arch, { theme, hint: name, known: [] });
    return { skillType: 'active', ...draft.fields };
  } catch {
    return { skillType: 'active' };
  }
}

/** Item type inferred from the noun the name ends in. Every value here is a
 * literal from the items config's `itemType` option list. */
const ITEM_TYPE_BY_NOUN: [RegExp, string][] = [
  [/\b(?:sword|blade|dagger|knife|axe|bow|spear|lance|mace|hammer|flail|club|whip|gun|rifle|pistol)$/i, 'Weapon'],
  [/\b(?:armour|armor|plate|mail|shield|helm|helmet|gauntlets?|boots|gloves|vest)$/i, 'Armour'],
  [/\b(?:cloak|robe|belt|brooch)$/i, 'Clothing'],
  [/\b(?:staff|wand|rod|sceptre|scepter|orb|crystal|talisman|charm)$/i, 'Magical'],
  [/\b(?:ring|amulet|crown|circlet|pendant|necklace|locket|relic|jewel|gem|stone)$/i, 'Relic'],
  [/\b(?:tome|grimoire|book|ledger)$/i, 'Book'],
  [/\b(?:scroll|map|letter|deed)$/i, 'Document'],
  [/\b(?:potion|elixir|bottle)$/i, 'Consumable'],
  [/\b(?:key)$/i, 'Key'],
  [/\b(?:lantern|compass|tool|kit)$/i, 'Tool'],
];

/**
 * The scaffolding a brand-new entry arrives with.
 *
 * The line this holds deliberately: **structure is inferred, biography never
 * is.** A skill gets a cost and an effect because the app owns what a skill
 * sheet looks like and the prose almost never spells it out — that precedent
 * already shipped for skills learned on the page. An item gets a type because
 * the name itself says so ("the Saltbrand" ends in nothing, "Ash Dagger" ends
 * in a weapon noun). A character gets nothing invented at all: making up a
 * personality for someone the author just wrote is how a codex fills with
 * confident fiction the author never agreed to.
 */
function starterSheetFor(type: EntityType, name: string): Record<string, unknown> {
  if (type === 'skills' || type === 'abilities') return skillSheetFor(name);
  if (type === 'items') {
    const hit = ITEM_TYPE_BY_NOUN.find(([re]) => re.test(name));
    return hit ? { itemType: hit[1] } : {};
  }
  if (type === 'locations') return { kind: 'Other' };
  return {};
}

// ─────────────────────────────────────────────────────────────────────────
// Rule: entity introduced
// ─────────────────────────────────────────────────────────────────────────

/**
 * A name the prose introduced that the codex has never seen.
 *
 * These are the findings the board used to throw away. Propagation only ever
 * looked at candidates carrying a signal, and a discovery carries none — so a
 * whole-book paste into a fresh project reported "nothing trackable found"
 * while holding forty new characters in its hand. Every discovery now becomes
 * a create unit, which also gives the consequence rules something to point at:
 * the draft's `localId` IS the provisional id the bootstrap pass used.
 */
function ruleEntityIntroduced(
  candidate: ExtractionCandidate,
  ctx: RuleRun
): DeltaEntityCreate | null {
  const localId = candidate.provisionalId;
  if (!localId) return null;
  const aliases = ((candidate.suggestedChanges?.aliases as string[] | undefined) ?? [])
    .filter((a): a is string => typeof a === 'string' && a.trim().length > 0)
    .map((a) => a.trim());
  const quote = candidate.sourceQuote?.trim() ?? '';
  return {
    ...envelope(ctx, candidate.confidence, quote, candidate.detector ?? 'discovery'),
    draft: {
      localId,
      type: candidate.entityType,
      // Evidence, not invention: the summary quotes the page rather than
      // guessing at who this is.
      summary: quote ? `First appears in this text: “${quote.slice(0, 160)}”` : 'First appears in this text.',
      name: candidate.name,
      aliases: [...new Set(aliases)],
      tags: [],
      fields: starterSheetFor(candidate.entityType, candidate.name),
    },
  };
}

/** Stable seed from a name so the same skill always rolls the same sheet. */
function hashName(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Choose a tree + branch for a new skill. Matching is on the archetype's
 * keywords against branch `group` names — "Venom Strike" matches the poison
 * archetype, whose keywords hit a "Toxins" branch on the Serpent Path tree.
 * No match anywhere → no placement, rather than a wrong one.
 */
function placeOnTree(
  ctx: RuleRun,
  skillName: string,
  skillRef: EntityRef,
  confidence: number,
  quote: string
): DeltaGraphPlacement | null {
  if (!ctx.trees.length) return null;
  const pack = deepPackFor('skills');
  const rng = createRng(hashName(skillName));
  const arch = pack ? matchArchetype(rng, pack, resolveTheme(rng), skillName) : null;
  // matchArchetype falls back to a RANDOM archetype when the name matches
  // nothing, so trust its vocabulary only when the name genuinely selected it.
  // "Venom Strike" hits the poison archetype on 'venom', which then lets its
  // sibling keyword 'poison' find the tree's "poison" branch — that indirection
  // is the whole point. An unmatched fallback would place skills at random.
  const nameWords = new Set(skillName.toLowerCase().split(/[^a-z0-9']+/).filter(Boolean));
  const genuineMatch = (arch?.keywords ?? []).some((k) => nameWords.has(k.toLowerCase()));
  const needles = [
    skillName.toLowerCase(),
    ...nameWords,
    ...(genuineMatch
      ? [
          ...(arch?.keywords ?? []).map((k) => k.toLowerCase()),
          ...(arch?.branchNames ?? []).map((b) => b.toLowerCase()),
        ]
      : []),
  ];

  let best: { tree: SkillTree; group?: string; score: number } | null = null;
  for (const tree of ctx.trees) {
    const groups = [...new Set(tree.nodes.map((n) => n.group).filter(Boolean))] as string[];
    for (const group of groups) {
      const g = group.toLowerCase();
      const score = needles.reduce((n, needle) => n + (g.includes(needle) || needle.includes(g) ? 1 : 0), 0);
      if (score > 0 && (!best || score > best.score)) best = { tree, group, score };
    }
    const t = tree.name.toLowerCase();
    const treeScore = needles.reduce((n, needle) => n + (t.includes(needle) ? 1 : 0), 0);
    if (treeScore > 0 && (!best || treeScore > best.score)) best = { tree, score: treeScore };
  }
  if (!best) return null;

  // Sit the new node under the deepest existing node of its branch, so the
  // tree keeps reading as a progression. layout.ts owns final positions; this
  // is a sane initial placement below the parent.
  const branchNodes = best.group
    ? best.tree.nodes.filter((n) => n.group === best!.group)
    : best.tree.nodes;
  const anchor = branchNodes.reduce<(typeof branchNodes)[number] | null>(
    (deepest, n) => (!deepest || n.y > deepest.y ? n : deepest),
    null
  );

  const nodeId = ctx.newLocalId();
  return {
    ...envelope(ctx, Math.min(confidence, 0.72), quote, 'skill-learned'),
    graphId: best.tree.id,
    graphKind: 'skilltree',
    graphName: best.tree.name,
    node: {
      id: nodeId,
      entity: skillRef,
      label: skillRef.name,
      x: anchor ? anchor.x : 0,
      y: anchor ? anchor.y + 120 : 0,
      group: best.group,
    },
    edges: anchor ? [{ id: ctx.newLocalId(), from: anchor.id, to: nodeId, directed: true }] : [],
    group: best.group,
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Rule: relationship
// ─────────────────────────────────────────────────────────────────────────

/** Map a detected interaction verb onto the relationships config vocabulary. */
const BOND_BY_VERB: Record<string, { bondType: string; valence: string }> = {
  betrayed: { bondType: 'enemy', valence: 'negative' },
  'struck': { bondType: 'enemy', valence: 'heated' },
  'shouted-at': { bondType: 'rival', valence: 'heated' },
  confronted: { bondType: 'rival', valence: 'heated' },
  saved: { bondType: 'ally', valence: 'positive' },
  comforted: { bondType: 'ally', valence: 'positive' },
  forgave: { bondType: 'ally', valence: 'positive' },
  trusted: { bondType: 'ally', valence: 'positive' },
  kissed: { bondType: 'lover', valence: 'positive' },
  embraced: { bondType: 'lover', valence: 'positive' },
  abandoned: { bondType: 'enemy', valence: 'cold' },
  'whispered-to': { bondType: 'ally', valence: 'quiet' },
};

function ruleRelationship(
  signal: Extract<ExtractionSignal, { kind: 'relationship' }>,
  candidate: ExtractionCandidate,
  ctx: RuleRun
): RuleOutput {
  const out = emptyOutput();
  const from = findTarget(ctx, signal.fromId);
  const to = findTarget(ctx, signal.toId);
  if (!from || !to) return out;
  dependOn(out, from);
  dependOn(out, to);
  const bond = BOND_BY_VERB[signal.bond] ?? { bondType: 'other', valence: 'mixed' };
  const quote = candidate.sourceQuote;

  // An existing bond between the same pair is nudged, not duplicated.
  const existing = ctx.entities.find(
    (e) =>
      e.type === 'relationships' &&
      refIdOf(e.fields.from) === from.id &&
      refIdOf(e.fields.to) === to.id
  );

  if (existing) {
    if (existing.fields.bondType !== bond.bondType) {
      out.patches.push({
        ...envelope(ctx, Math.min(candidate.confidence, 0.6), quote, 'relationships'),
        entityId: existing.id,
        entityType: 'relationships',
        entityName: existing.name,
        fieldId: 'bondType',
        fieldLabel: 'Bond type',
        before: existing.fields.bondType ?? null,
        after: bond.bondType,
        mode: 'replace',
      });
    }
    out.patches.push({
      ...envelope(ctx, candidate.confidence, quote, 'relationships'),
      entityId: existing.id,
      entityType: 'relationships',
      entityName: existing.name,
      fieldId: 'evidence',
      fieldLabel: 'Manuscript evidence',
      before: existing.fields.evidence ?? '',
      after: quote,
      mode: 'append',
    });
    return closeGroup(
      out,
      ctx,
      { id: from.id, type: 'cast', name: from.name },
      `${from.name} and ${to.name} — bond updated to ${bond.bondType}`
    );
  }

  const localId = ctx.newLocalId();
  out.entities.push({
    ...envelope(ctx, candidate.confidence, quote, 'relationships'),
    draft: {
      localId,
      type: 'relationships',
      name: `${from.name} → ${to.name}`,
      aliases: [],
      summary: candidate.summary ?? '',
      tags: [],
      fields: {
        from: refOf(from),
        to: refOf(to),
        bondType: bond.bondType,
        valence: bond.valence,
        directionality: 'one-way',
        evidence: quote,
      },
    },
  });
  out.links.push({
    ...envelope(ctx, candidate.confidence, quote, 'relationships'),
    link: { from: from.id, to: to.id, kind: bond.bondType },
    label: `${from.name} ▸ ${bond.bondType} ▸ ${to.name}`,
  });
  return closeGroup(
    out,
    ctx,
    { id: from.id, type: 'cast', name: from.name },
    `${from.name} → ${to.name} — new ${bond.bondType} bond`
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Rule: quest progress
// ─────────────────────────────────────────────────────────────────────────

/** Detector phase → the quests config's own `status` vocabulary. */
const QUEST_STATUS_BY_PHASE: Record<string, string> = {
  started: 'Active',
  advanced: 'Active',
  completed: 'Completed',
  failed: 'Failed',
};

/** Steps the prose closed out, by phase. A completed quest has no pending
 * steps left; a failed one keeps its steps but stops being active. */
type StepRow = { text?: string; status?: string };

/**
 * A quest moved. Set the status pill, log the beat as a step, and — when it
 * closed — offer what the ending opens up.
 *
 * This is the propagation the last milestone shipped without: the old quest
 * detector reported that a quest existed, which is a discovery, so there was
 * never any step-level information to act on.
 */
function ruleQuestProgress(
  signal: Extract<ExtractionSignal, { kind: 'quest-progress' }>,
  candidate: ExtractionCandidate,
  ctx: RuleRun
): RuleOutput {
  const out = emptyOutput();
  const quest = findTarget(ctx, signal.questId);
  if (!quest) return out;
  dependOn(out, quest);
  const quote = candidate.sourceQuote;
  const status = QUEST_STATUS_BY_PHASE[signal.phase] ?? 'Active';

  if (quest.fields.status !== status) {
    out.patches.push({
      ...envelope(ctx, candidate.confidence, quote, 'questProgress'),
      entityId: quest.id,
      entityType: 'quests',
      entityName: quest.name,
      fieldId: 'status',
      fieldLabel: 'Status',
      before: quest.fields.status ?? null,
      after: status,
      mode: 'replace',
    });
  }

  // The beat itself becomes a step, marked the way the prose left it.
  if (signal.step) {
    const existing = asMemberList(quest.fields.steps) as StepRow[];
    const already = existing.some(
      (row) => (row?.text ?? '').trim().toLowerCase() === signal.step!.trim().toLowerCase()
    );
    if (!already) {
      out.patches.push({
        ...envelope(ctx, Math.min(candidate.confidence, 0.7), quote, 'questProgress'),
        entityId: quest.id,
        entityType: 'quests',
        entityName: quest.name,
        fieldId: 'steps',
        fieldLabel: 'Steps',
        before: quest.fields.steps ?? [],
        after: {
          text: signal.step,
          status: signal.phase === 'completed' ? 'done' : signal.phase === 'failed' ? 'skipped' : 'active',
        },
        mode: 'append',
      });
    }
  }

  const actor = findTarget(ctx, signal.actorId);
  if (actor) {
    dependOn(out, actor);
    out.patches.push({
      ...envelope(ctx, Math.min(candidate.confidence, 0.68), quote, 'questProgress'),
      entityId: quest.id,
      entityType: 'quests',
      entityName: quest.name,
      fieldId: 'participants',
      fieldLabel: 'Participants',
      before: quest.fields.participants ?? [],
      after: refOf(actor),
      mode: 'append',
    });
  }

  if (signal.phase === 'completed' || signal.phase === 'failed') {
    out.suggestions.push(
      ...suggestQuestOutcome(quest.name, refOf(quest), signal.phase, ctx.volume)
    );
  }

  const verb =
    signal.phase === 'completed'
      ? 'completed'
      : signal.phase === 'failed'
        ? 'failed'
        : 'moved forward';
  return closeGroup(
    out,
    ctx,
    { id: quest.id, type: 'quests', name: quest.name },
    `${quest.name} ${verb}${actor ? ` — ${actor.name}` : ''}`
  );
}

// ─────────────────────────────────────────────────────────────────────────

/**
 * Run every propagation rule over a chapter's candidates.
 *
 * Deterministic and completely offline — no provider, no network. This is the
 * product's "offline smarts are free forever" line: everything that tracks or
 * propagates state works with zero AI keys, and AI only enriches on top.
 */
export function runPropagation(candidates: ExtractionCandidate[], ctx: RuleContext): RuleOutput {
  const run: RuleRun = { ...ctx, provisional: new Map(), claimed: new Map() };

  // Phase 1 — introductions. Every brand-new name becomes a draft BEFORE any
  // consequence rule runs, because a consequence needs something to point at:
  // "Marrow handed the Saltbrand to Vex" is only a cascade once all three
  // names exist, even if none of them existed a moment ago.
  // Keyed on the provisional id, NOT on "has no signal": one sentence can
  // both introduce a thing and do something with it, and those must not be
  // treated as alternatives.
  const introductions: DeltaEntityCreate[] = [];
  for (const candidate of candidates) {
    if (!candidate.provisionalId) continue;
    const create = ruleEntityIntroduced(candidate, run);
    if (!create) continue;
    introductions.push(create);
    run.provisional.set(create.draft.localId, {
      id: create.draft.localId,
      type: create.draft.type,
      name: create.draft.name,
      fields: create.draft.fields ?? {},
      isNew: true,
    });
  }

  // Phase 2 — consequences, now able to resolve either kind of participant.
  const outputs: RuleOutput[] = [];
  for (const candidate of candidates) {
    const signal = candidate.signal;
    if (!signal) continue;
    switch (signal.kind) {
      case 'item-transfer':
        outputs.push(ruleItemTransfer(signal, candidate, run));
        break;
      case 'item-loss':
        outputs.push(ruleItemLoss(signal, candidate, run));
        break;
      case 'travel':
        outputs.push(ruleTravel(signal, candidate, run));
        break;
      case 'skill-learned':
        outputs.push(ruleSkillLearned(signal, candidate, run));
        break;
      case 'relationship':
        outputs.push(ruleRelationship(signal, candidate, run));
        break;
      case 'quest-progress':
        outputs.push(ruleQuestProgress(signal, candidate, run));
        break;
    }
  }

  const merged = dedupePatches(mergeOutputs(outputs));

  // Phase 3 — file the introductions. One that a cascade leaned on joins that
  // cascade, so toggling "Vex learned Venom Strike" off also withholds the
  // Venom Strike that only exists to serve it. The rest roll up per type, so a
  // book that introduces forty characters is one line on the board, not forty.
  const claimedCreates: DeltaEntityCreate[] = [];
  const unclaimed: DeltaEntityCreate[] = [];
  for (const create of introductions) {
    const groupId = run.claimed.get(create.draft.localId);
    if (!groupId) {
      unclaimed.push(create);
      continue;
    }
    const group = merged.groups.find((g) => g.id === groupId);
    if (!group) {
      unclaimed.push(create);
      continue;
    }
    // Creates render first: the cascade reads "New character Vex → Vex learned…".
    group.unitIds.unshift(create.unitId);
    group.confidence = Math.min(group.confidence, create.confidence);
    group.confidenceBand = confidenceBand(group.confidence);
    claimedCreates.push(create);
  }

  merged.entities.unshift(...claimedCreates, ...unclaimed);

  const byType = new Map<EntityType, DeltaEntityCreate[]>();
  for (const create of unclaimed) {
    const list = byType.get(create.draft.type) ?? [];
    list.push(create);
    byType.set(create.draft.type, list);
  }
  for (const [type, list] of byType) {
    const meta = ENTITY_TYPE_META[type];
    const confidence = list.reduce((min, c) => Math.min(min, c.confidence), 1);
    merged.groups.unshift({
      id: ctx.newUnitId(),
      subject: { id: list[0].draft.localId, type, name: list[0].draft.name },
      headline:
        list.length === 1
          ? `New ${meta.label.toLowerCase()}: ${list[0].draft.name}`
          : `${list.length} new ${meta.plural.toLowerCase()}: ${list
              .slice(0, 3)
              .map((c) => c.draft.name)
              .join(', ')}${list.length > 3 ? `, +${list.length - 3} more` : ''}`,
      unitIds: list.map((c) => c.unitId),
      confidence,
      confidenceBand: confidenceBand(confidence),
      flagged: false,
    });
  }

  return merged;
}

/**
 * Two mentions of the same event in one chapter must not double-apply. Keep
 * the highest-confidence patch per (entity, field, mode) — except appends of
 * different values, which are genuinely separate additions.
 */
function dedupePatches(output: RuleOutput): RuleOutput {
  const byKey = new Map<string, DeltaPatch>();
  const kept: DeltaPatch[] = [];
  for (const patch of output.patches) {
    const key = [
      patch.entityId,
      patch.fieldId,
      patch.mode,
      patch.mode === 'append' ? JSON.stringify(patch.after) : '',
    ].join('|');
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, patch);
      kept.push(patch);
      continue;
    }
    if (patch.confidence > existing.confidence) {
      kept[kept.indexOf(existing)] = patch;
      byKey.set(key, patch);
    }
  }
  output.patches = kept;

  // Groups were closed before dedupe ran, so drop the unit ids that no longer
  // exist — otherwise the board renders slots for patches that were merged
  // away, and an empty cascade survives with nothing in it.
  const live = new Set([
    ...output.entities,
    ...output.patches,
    ...output.graphPlacements,
    ...output.hierarchyPlacements,
    ...output.links,
    ...output.suggestions,
  ].map((u) => u.unitId));
  output.groups = output.groups
    .map((g) => ({ ...g, unitIds: g.unitIds.filter((id) => live.has(id)) }))
    .filter((g) => g.unitIds.length > 0);

  return output;
}

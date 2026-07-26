import type { Entity, SkillTree } from '@/db/types';
import type { EntityRef } from '@/domain/entity-types';
import type { ExtractionCandidate, ExtractionSignal } from '@/services/extraction/detectors';
import { confidenceBand } from '@/services/extraction/text-utils';
import { findKnownEntityMention, type KnownEntity } from '@/services/extraction/known-index';
import { deepPackFor, matchArchetype, resolveTheme } from '@/services/generate/random/packs';
import { createRng } from '@/services/generate/random/rng';
import type {
  DeltaConflict,
  DeltaEntityCreate,
  DeltaGraphPlacement,
  DeltaGroup,
  DeltaHierarchyPlacement,
  DeltaLink,
  DeltaPatch,
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
  /** One cascade per rule firing — the board renders each as a group. */
  groups: DeltaGroup[];
  warnings: string[];
}

export interface RuleContext {
  projectId: string;
  /** Every live entity in the project. */
  entities: Entity[];
  /** Existing skill trees, for placement matching. */
  trees: SkillTree[];
  /** Deterministic id factories — seeded in tests for stable fixtures. */
  newUnitId: () => string;
  newLocalId: () => string;
}

function emptyOutput(): RuleOutput {
  return {
    entities: [],
    patches: [],
    graphPlacements: [],
    hierarchyPlacements: [],
    links: [],
    groups: [],
    warnings: [],
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
    out.groups.push(...o.groups);
    out.warnings.push(...o.warnings);
  }
  return out;
}

/** Close a rule's output into one cascade the board can render and toggle.
 * The group's confidence is its weakest member — a cascade is only as
 * trustworthy as its shakiest step. */
function closeGroup(
  out: RuleOutput,
  ctx: RuleContext,
  subject: DeltaGroup['subject'],
  headline: string
): RuleOutput {
  const units: DeltaUnit[] = [
    ...out.entities,
    ...out.patches,
    ...out.graphPlacements,
    ...out.hierarchyPlacements,
    ...out.links,
  ];
  if (!units.length) return out;
  const confidence = units.reduce((min, u) => Math.min(min, u.confidence), 1);
  out.groups.push({
    id: ctx.newUnitId(),
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
function envelope(ctx: RuleContext, confidence: number, sourceQuote: string, origin: string): DeltaUnit {
  return {
    unitId: ctx.newUnitId(),
    confidence,
    confidenceBand: confidenceBand(confidence),
    sourceQuote,
    origin,
  };
}

function refOf(entity: Entity | KnownEntity): EntityRef {
  return { id: entity.id, type: entity.type, name: entity.name };
}

function findEntity(ctx: RuleContext, id: string | null): Entity | undefined {
  return id ? ctx.entities.find((e) => e.id === id) : undefined;
}

function knownList(ctx: RuleContext): KnownEntity[] {
  return ctx.entities.map((e) => ({ id: e.id, type: e.type, name: e.name, aliases: e.aliases }));
}

/** Resolve a bare name against the project, restricted to one type. */
function resolveByName(ctx: RuleContext, name: string, type: Entity['type']): Entity | undefined {
  const match = findKnownEntityMention(
    name,
    knownList(ctx).filter((e) => e.type === type),
    { threshold: 0.85 }
  );
  return match ? ctx.entities.find((e) => e.id === match.entity.id) : undefined;
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
  ctx: RuleContext
): RuleOutput {
  const out = emptyOutput();
  const item = findEntity(ctx, signal.itemId);
  if (!item) return out;
  const receiver = findEntity(ctx, signal.toId);
  if (!receiver) {
    out.warnings.push(
      `"${signal.itemName}" changes hands but the new owner was not named — no owner change applied.`
    );
    return out;
  }

  const quote = candidate.sourceQuote;
  const recordedOwnerId = refIdOf(item.fields.currentOwner);
  const recordedOwner = findEntity(ctx, recordedOwnerId);

  let conflict: DeltaConflict | undefined;
  if (signal.fromId && recordedOwnerId && recordedOwnerId !== signal.fromId) {
    const giver = findEntity(ctx, signal.fromId);
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
  ctx: RuleContext
): RuleOutput {
  const out = emptyOutput();
  const item = findEntity(ctx, signal.itemId);
  if (!item) return out;
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
  ctx: RuleContext
): RuleOutput {
  const out = emptyOutput();
  const actor = findEntity(ctx, signal.actorId);
  if (!actor) return out;
  const quote = candidate.sourceQuote;

  // Resolve the destination: known id → fuzzy name match → a new draft.
  let placeRef: EntityRef;
  let placeIsNew = false;
  const known = findEntity(ctx, signal.placeId) ?? resolveByName(ctx, signal.placeName, 'locations');
  if (known) {
    placeRef = refOf(known);
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
        fields: { kind: 'Settlement' },
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
  ctx: RuleContext
): RuleOutput {
  const out = emptyOutput();
  const actor = findEntity(ctx, signal.actorId);
  const quote = candidate.sourceQuote;

  let skillRef: EntityRef;
  const knownSkill =
    findEntity(ctx, signal.skillId) ?? resolveByName(ctx, signal.skillName, 'skills');
  if (knownSkill) {
    skillRef = refOf(knownSkill);
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
    const arch = matchArchetype(rng, pack, resolveTheme(rng), name);
    const draft = pack.generate(rng, arch, { known: [], siblings: [] });
    return { skillType: 'active', ...draft.fields };
  } catch {
    return { skillType: 'active' };
  }
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
  ctx: RuleContext,
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
  ctx: RuleContext
): RuleOutput {
  const out = emptyOutput();
  const from = findEntity(ctx, signal.fromId);
  const to = findEntity(ctx, signal.toId);
  if (!from || !to) return out;
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

/**
 * Run every propagation rule over a chapter's candidates.
 *
 * Deterministic and completely offline — no provider, no network. This is the
 * product's "offline smarts are free forever" line: everything that tracks or
 * propagates state works with zero AI keys, and AI only enriches on top.
 */
export function runPropagation(candidates: ExtractionCandidate[], ctx: RuleContext): RuleOutput {
  const outputs: RuleOutput[] = [];
  for (const candidate of candidates) {
    const signal = candidate.signal;
    if (!signal) continue;
    switch (signal.kind) {
      case 'item-transfer':
        outputs.push(ruleItemTransfer(signal, candidate, ctx));
        break;
      case 'item-loss':
        outputs.push(ruleItemLoss(signal, candidate, ctx));
        break;
      case 'travel':
        outputs.push(ruleTravel(signal, candidate, ctx));
        break;
      case 'skill-learned':
        outputs.push(ruleSkillLearned(signal, candidate, ctx));
        break;
      case 'relationship':
        outputs.push(ruleRelationship(signal, candidate, ctx));
        break;
    }
  }
  return dedupePatches(mergeOutputs(outputs));
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
  ].map((u) => u.unitId));
  output.groups = output.groups
    .map((g) => ({ ...g, unitIds: g.unitIds.filter((id) => live.has(id)) }))
    .filter((g) => g.unitIds.length > 0);

  return output;
}

import { db } from '@/db/schema';
import { newId } from '@/lib/id';
import { remapRefs } from '@/lib/remap';
import { logAudit } from '@/db/repos/audit';
import { ensureScenesForProject } from '@/db/repos/scenes';
import type { Chapter, Entity, Link, SkillTree, TangleBoard } from '@/db/types';
import type { EntityRef } from '@/domain/entity-types';
import { chapterDocFromDraft } from '@/services/generate/apply';
import { deltaTitle, type StoryDelta, type SuggestionRecord } from './types';

/** Everything one accept touched — stored on the single audit entry so the
 * whole cascade reverts as one unit, exactly like `generate.apply`. */
export interface DeltaApplyRecord {
  label: string;
  entityIds: string[];
  /** ONE snapshot per entity, taken before the first patch touched it. */
  patchedEntities: { id: string; before: Entity }[];
  patchedGraphs: { id: string; kind: 'skilltree' | 'tangle'; before: SkillTree | TangleBoard }[];
  chapterIds: string[];
  linkIds: string[];
  suggestionIds: string[];
  /** Flat-queue candidates this accept satisfied, so undo can re-open them. */
  resolvedCandidateIds: string[];
}

export interface DeltaApplyResult {
  auditId: string;
  created: EntityRef[];
  updated: EntityRef[];
  chapterIds: string[];
  suggestionIds: string[];
  /** Units that were skipped because their toggle was off. */
  skipped: number;
}

export interface ApplyDeltaOptions {
  /** When present, only units whose `unitId` is in the set are applied.
   * The board's per-group toggles map straight onto this. */
  enabledUnitIds?: Set<string>;
}

function union(a: string[], b: string[]): string[] {
  const seen = new Set(a.map((v) => v.toLowerCase()));
  return [...a, ...b.filter((v) => !seen.has(v.toLowerCase()))];
}

/** Identity of an array member. Handles the two array shapes fields use:
 * plain strings (chips) and `{id}` refs (related-multi). */
function memberKey(value: unknown): string {
  if (value && typeof value === 'object' && 'id' in value) return String((value as { id: unknown }).id);
  return String(value).toLowerCase();
}

function asList(before: unknown): unknown[] {
  return Array.isArray(before) ? [...before] : before == null ? [] : [before];
}

/** Append without duplicating. */
function appendUnique(before: unknown, addition: unknown): unknown {
  const list = asList(before);
  const additions = Array.isArray(addition) ? addition : [addition];
  const seen = new Set(list.map(memberKey));
  for (const item of additions) {
    const key = memberKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    list.push(item);
  }
  return list;
}

/** Drop members by identity, leaving everything else in place and in order. */
function removeMembers(before: unknown, removal: unknown): unknown {
  const removals = new Set((Array.isArray(removal) ? removal : [removal]).map(memberKey));
  return asList(before).filter((item) => !removals.has(memberKey(item)));
}

/**
 * Write a StoryDelta to Dexie in ONE transaction, with ONE reversible audit
 * entry so a single Undo reverts the entire cascade.
 *
 * The important difference from `applyBundle`: this understands field-level
 * patches. Generation only ever merged whole field bags (`{...before.fields,
 * ...draft.fields}`), which cannot express "the sword's owner changed from
 * Marrow to Vex" — a merge would silently keep whichever value won the spread.
 * Patches carry an explicit before/after and a mode, so ownership genuinely
 * flips and history genuinely appends.
 */
export async function applyDelta(
  delta: StoryDelta,
  options: ApplyDeltaOptions = {}
): Promise<DeltaApplyResult> {
  const now = Date.now();
  const { projectId } = delta;
  const enabled = options.enabledUnitIds;
  const on = <T extends { unitId: string }>(unit: T): boolean =>
    !enabled || enabled.has(unit.unitId);

  const entities = delta.entities.filter(on);
  const patches = delta.patches.filter(on);
  const graphPlacements = delta.graphPlacements.filter(on);
  const hierarchyPlacements = delta.hierarchyPlacements.filter(on);
  const links = delta.links.filter(on);
  const chapters = delta.chapters.filter(on);
  const suggestions = delta.suggestions.filter(on);

  const totalUnits =
    delta.entities.length +
    delta.patches.length +
    delta.graphPlacements.length +
    delta.hierarchyPlacements.length +
    delta.links.length +
    delta.chapters.length +
    delta.suggestions.length;
  const appliedUnits =
    entities.length +
    patches.length +
    graphPlacements.length +
    hierarchyPlacements.length +
    links.length +
    chapters.length +
    suggestions.length;

  // Fresh id for every draft local id; duplicate-matched drafts keep their row.
  const idMap = new Map<string, string>();
  for (const create of entities) {
    idMap.set(create.draft.localId, create.draft.existingEntityId ?? newId());
  }
  for (const chapter of chapters) idMap.set(chapter.draft.localId, newId());

  const record: DeltaApplyRecord = {
    label: deltaTitle(delta),
    entityIds: [],
    patchedEntities: [],
    patchedGraphs: [],
    chapterIds: [],
    linkIds: [],
    suggestionIds: [],
    resolvedCandidateIds: [],
  };
  const created: EntityRef[] = [];
  const updatedById = new Map<string, EntityRef>();
  let auditId = '';

  await db.transaction(
    'rw',
    [
      db.entities,
      db.skillTrees,
      db.tangleBoards,
      db.chapters,
      db.links,
      db.suggestions,
      db.candidates,
      db.auditLog,
    ],
    async () => {
      // Working set of entities we mutate. Snapshotting here — once per id,
      // on first touch — is what makes undo correct when several patches in
      // the same cascade hit one entity (owner + inventory + history).
      const working = new Map<string, Entity>();
      const loadForPatch = async (id: string): Promise<Entity | null> => {
        const existing = working.get(id);
        if (existing) return existing;
        const row = await db.entities.get(id);
        if (!row) return null;
        record.patchedEntities.push({ id, before: structuredClone(row) });
        working.set(id, row);
        updatedById.set(id, { id: row.id, type: row.type, name: row.name });
        return row;
      };

      // 1. Creates — same semantics as applyBundle so drafts behave identically
      //    whether they came from generation or from extraction.
      for (const create of entities) {
        const draft = create.draft;
        const id = idMap.get(draft.localId)!;
        const fields = remapRefs(draft.fields, idMap);
        if (draft.existingEntityId) {
          const before = await loadForPatch(draft.existingEntityId);
          if (!before) continue;
          before.aliases = union(before.aliases, draft.aliases);
          before.summary = before.summary || draft.summary;
          before.tags = union(before.tags, draft.tags);
          before.fields = { ...before.fields, ...fields };
          before.updatedAt = now;
        } else {
          const entity: Entity = {
            id,
            projectId,
            type: draft.type,
            name: draft.name,
            aliases: draft.aliases,
            summary: draft.summary,
            status: 'active',
            tags: draft.tags,
            fields,
            createdAt: now,
            updatedAt: now,
          };
          await db.entities.add(entity);
          working.set(id, entity);
          record.entityIds.push(id);
          created.push({ id, type: draft.type, name: draft.name });
        }
      }

      // 2. Field patches — replace flips a value, append grows a list.
      for (const patch of patches) {
        const id = idMap.get(patch.entityId) ?? patch.entityId;
        const row = record.entityIds.includes(id)
          ? working.get(id)
          : await loadForPatch(id);
        if (!row) continue;
        const after = remapRefs(patch.after, idMap);
        const current = row.fields[patch.fieldId];
        row.fields = {
          ...row.fields,
          [patch.fieldId]:
            patch.mode === 'append'
              ? appendUnique(current, after)
              : patch.mode === 'remove'
                ? removeMembers(current, after)
                : after,
        };
        row.updatedAt = now;
      }

      // 3. Hierarchy — set the child's parent AND keep the parent's child
      //    list in sync, so the locations tree reads correctly from either end.
      for (const placement of hierarchyPlacements) {
        if (!placement.parentId) continue; // unresolved → user picks on the board
        const childId = idMap.get(placement.childId) ?? placement.childId;
        const parentId = idMap.get(placement.parentId) ?? placement.parentId;
        if (childId === parentId) continue; // never self-nest
        const child = record.entityIds.includes(childId)
          ? working.get(childId)
          : await loadForPatch(childId);
        if (child) {
          child.fields = {
            ...child.fields,
            parentId: { id: parentId, type: 'locations', name: placement.parentName },
          };
          child.updatedAt = now;
        }
        const parent = record.entityIds.includes(parentId)
          ? working.get(parentId)
          : await loadForPatch(parentId);
        if (parent) {
          parent.fields = {
            ...parent.fields,
            childLocationIds: appendUnique(parent.fields.childLocationIds, {
              id: childId,
              type: 'locations',
              name: placement.childName,
            }),
          };
          parent.updatedAt = now;
        }
      }

      // Flush every mutated row once, after all patches have composed.
      for (const row of working.values()) await db.entities.put(row);

      // 4. Graph placements — append a node (+ its edges) to an existing
      //    tree or board. Positions were computed by layout.ts, never a model.
      // The running copy and the undo snapshot MUST be separate objects. Using
      // one map for both meant a second placement onto the same tree re-read
      // the pre-first-placement snapshot and silently dropped the first node —
      // two skills learned in one chapter, one of them lost.
      const graphWorking = new Map<string, SkillTree | TangleBoard>();
      for (const placement of graphPlacements) {
        const table = placement.graphKind === 'skilltree' ? db.skillTrees : db.tangleBoards;
        const current = graphWorking.get(placement.graphId) ?? (await table.get(placement.graphId));
        if (!current) continue;
        if (!graphWorking.has(placement.graphId)) {
          graphWorking.set(placement.graphId, current);
          record.patchedGraphs.push({
            id: placement.graphId,
            kind: placement.graphKind,
            before: structuredClone(current),
          });
        }
        const node = { ...remapRefs(placement.node, idMap), id: placement.node.id };
        const edges = placement.edges.map((edge) => ({
          ...edge,
          from: idMap.get(edge.from) ?? edge.from,
          to: idMap.get(edge.to) ?? edge.to,
        }));
        const existingNodes =
          (current as TangleBoard).cards ?? (current as SkillTree).nodes;
        const merged = {
          ...(placement.graphKind === 'tangle'
            ? { cards: [...existingNodes, node] }
            : { nodes: [...existingNodes, node] }),
          edges: [...current.edges, ...edges],
          updatedAt: now,
        };
        await table.update(placement.graphId, merged as never);
        // Keep the running copy current so two placements onto one tree stack.
        Object.assign(current, merged);
      }

      // 5. Chapters.
      const chapterCount = chapters.length
        ? await db.chapters.where('projectId').equals(projectId).count()
        : 0;
      for (const [i, entry] of chapters.entries()) {
        const id = idMap.get(entry.draft.localId)!;
        const { doc, paragraphs, wordCount } = chapterDocFromDraft(entry.draft);
        const chapter: Chapter = {
          id,
          projectId,
          title: entry.draft.title || `Chapter ${chapterCount + i + 1}`,
          order: chapterCount + i,
          doc,
          paragraphs,
          wordCount,
          createdAt: now,
          updatedAt: now,
        };
        await db.chapters.add(chapter);
        record.chapterIds.push(id);
      }

      // 6. Links.
      const resolveEndpoint = async (localOrRealId: string): Promise<EntityRef | null> => {
        const realId = idMap.get(localOrRealId) ?? localOrRealId;
        const draft = entities.find((d) => d.draft.localId === localOrRealId)?.draft;
        if (draft) return { id: realId, type: draft.type, name: draft.name };
        const row = await db.entities.get(realId);
        return row ? { id: row.id, type: row.type, name: row.name } : null;
      };
      for (const entry of links) {
        const from = await resolveEndpoint(entry.link.from);
        const to = await resolveEndpoint(entry.link.to);
        if (!from || !to) continue;
        const row: Link = {
          id: newId(),
          projectId,
          from,
          to,
          kind: entry.link.kind,
          source: 'extraction',
          createdAt: now,
        };
        await db.links.add(row);
        record.linkIds.push(row.id);
      }

      // 7. Suggestions — persisted pending so they live in the inbox until
      //    the author accepts or dismisses them.
      for (const entry of suggestions) {
        const targetRef = entry.targetRef
          ? {
              ...entry.targetRef,
              id: idMap.get(entry.targetRef.id) ?? entry.targetRef.id,
            }
          : null;
        const row: SuggestionRecord = {
          id: newId(),
          projectId,
          kind: entry.kind,
          targetRef,
          targetEntityId: targetRef?.id ?? '',
          title: entry.title,
          body: entry.body,
          payload: entry.payload ? remapRefs(entry.payload, idMap) : null,
          source: delta.source,
          status: 'pending',
          createdAt: now,
        };
        await db.suggestions.add(row);
        record.suggestionIds.push(row.id);
      }

      // 8. Close out the flat review queue.
      //
      // The queue and the cascade board are two lanes over the same
      // extraction, and the board became the busier one the moment
      // discoveries started reaching it. Accepting "Maren" as a cascade used
      // to leave "Maren" sitting in the queue as a pending create, and
      // accepting it there too made a second Maren — the queue's accept path
      // has no name-based duplicate guard. Anything this transaction just
      // created or updated is no longer outstanding, whichever lane it came
      // from, so it is marked accepted rather than left to be applied twice.
      const touched = new Map<string, string>();
      for (const ref of created) touched.set(`${ref.type}|${ref.name.toLowerCase()}`, ref.id);
      for (const ref of updatedById.values()) touched.set(`${ref.type}|${ref.name.toLowerCase()}`, ref.id);
      if (touched.size) {
        const pending = await db.candidates
          .where('[projectId+status]')
          .equals([projectId, 'pending'])
          .toArray();
        for (const candidate of pending) {
          const hit = touched.get(`${candidate.entityType}|${candidate.name.toLowerCase()}`);
          if (!hit) continue;
          await db.candidates.update(candidate.id, {
            status: 'accepted',
            existingEntityId: hit,
          });
          record.resolvedCandidateIds.push(candidate.id);
        }
      }

      const entry = await logAudit({
        projectId,
        action: 'intelligence.apply',
        actor: 'extraction',
        target: { table: 'intelligence', id: delta.id, label: record.label },
        after: record,
        reversible: true,
      });
      auditId = entry.id;
    }
  );

  // Same reason as generate/apply: chapters written inside the
  // transaction bypass createChapter and arrive without scenes.
  if (record.chapterIds.length) await ensureScenesForProject(projectId);

  return {
    auditId,
    created,
    updated: [...updatedById.values()],
    chapterIds: record.chapterIds,
    suggestionIds: record.suggestionIds,
    skipped: totalUnits - appliedUnits,
  };
}

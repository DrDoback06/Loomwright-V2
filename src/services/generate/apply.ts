import { db } from '@/db/schema';
import { newId } from '@/lib/id';
import { remapRefs } from '@/lib/remap';
import { logAudit } from '@/db/repos/audit';
import type { Chapter, Entity, Link, SkillTree, TangleBoard } from '@/db/types';
import type { EntityRef } from '@/domain/entity-types';
import {
  bundleTitle,
  type BundleChapterDraft,
  type BundleEntityDraft,
  type BundleGraphDraft,
  type BundleLinkDraft,
  type EntityFieldPatch,
} from './types';

/** The structural input to applyBundle: a GenerationBundle or a Story
 * Intelligence StoryDelta both satisfy it. `patches` (field-level updates
 * to existing entities) is the only delta-specific extra. */
export interface ApplyInput {
  id: string;
  projectId: string;
  entities: BundleEntityDraft[];
  graphs: BundleGraphDraft[];
  chapters: BundleChapterDraft[];
  links: BundleLinkDraft[];
  patches?: EntityFieldPatch[];
}

/** Everything one accept created/patched — stored on the audit entry so
 * the whole bundle reverts as a single unit. */
export interface GenerateApplyRecord {
  label: string;
  entityIds: string[];
  patchedEntities: { id: string; before: Entity }[];
  /** Full pre-patch snapshots of entities changed by field patches. */
  patchedFields: { id: string; before: Entity }[];
  graphs: { id: string; kind: 'skilltree' | 'tangle' }[];
  patchedGraphs: { id: string; kind: 'skilltree' | 'tangle'; before: SkillTree | TangleBoard }[];
  chapterIds: string[];
  linkIds: string[];
}

/** Append semantics for `append`-mode patches: push onto an array field,
 * or newline-join a text field (ownership/travel history). */
export function appendFieldValue(current: unknown, item: unknown): unknown {
  const additions = Array.isArray(item) ? item : [item];
  if (Array.isArray(current)) return [...current, ...additions];
  if (current === undefined || current === null || current === '') {
    // Empty field: an array-typed append (EntityRefs, etc.) seeds a
    // one-element array; a lone string append seeds a text field.
    return typeof item === 'string' ? item : additions;
  }
  if (typeof current === 'string') {
    return [current, ...additions.map((a) => String(a))].join('\n');
  }
  return item;
}

export interface ApplyResult {
  auditId: string;
  created: EntityRef[];
  updated: EntityRef[];
  graphIds: string[];
  chapterIds: string[];
}

function union(a: string[], b: string[]): string[] {
  const seen = new Set(a.map((v) => v.toLowerCase()));
  return [...a, ...b.filter((v) => !seen.has(v.toLowerCase()))];
}

function chapterDoc(draft: BundleChapterDraft): {
  doc: unknown;
  paragraphs: { id: string; text: string }[];
  wordCount: number;
} {
  // Prose (when drafted) replaces the beat outline; otherwise the beats
  // land as scaffold paragraphs the author overwrites.
  const texts = [
    ...(draft.summary ? [draft.summary] : []),
    ...(draft.prose?.length ? draft.prose : draft.beats),
  ].filter((t) => t.trim());
  const paragraphs = texts.map((text) => ({ id: newId(), text: text.trim() }));
  const doc = {
    type: 'doc',
    content: paragraphs.map((p) => ({
      type: 'paragraph',
      attrs: { pid: p.id },
      content: [{ type: 'text', text: p.text }],
    })),
  };
  const wordCount = texts.reduce((n, t) => n + t.trim().split(/\s+/).length, 0);
  return { doc, paragraphs, wordCount };
}

/** Write a staged bundle to Dexie in one transaction: fresh ids for every
 * draft, cross-refs remapped, duplicate-matched drafts merged into their
 * existing rows, and ONE reversible audit entry covering it all. */
export async function applyBundle(bundle: ApplyInput): Promise<ApplyResult> {
  const now = Date.now();
  const { projectId } = bundle;

  // Fresh id for every local id; duplicate-matched drafts keep their row.
  const idMap = new Map<string, string>();
  for (const draft of bundle.entities) {
    idMap.set(draft.localId, draft.existingEntityId ?? newId());
  }
  for (const graph of bundle.graphs) {
    idMap.set(graph.localId, graph.targetGraphId ?? newId());
    for (const node of graph.nodes) idMap.set(node.id, newId());
    for (const edge of graph.edges) idMap.set(edge.id, newId());
  }
  for (const chapter of bundle.chapters) idMap.set(chapter.localId, newId());

  const record: GenerateApplyRecord = {
    label: bundleTitle(bundle),
    entityIds: [],
    patchedEntities: [],
    patchedFields: [],
    graphs: [],
    patchedGraphs: [],
    chapterIds: [],
    linkIds: [],
  };
  const created: EntityRef[] = [];
  const updated: EntityRef[] = [];

  let auditId = '';

  await db.transaction(
    'rw',
    [db.entities, db.skillTrees, db.tangleBoards, db.chapters, db.links, db.auditLog],
    async () => {
      // Entities — create new rows, merge duplicate-matched ones.
      for (const draft of bundle.entities) {
        const id = idMap.get(draft.localId)!;
        const fields = remapRefs(draft.fields, idMap);
        if (draft.existingEntityId) {
          const before = await db.entities.get(draft.existingEntityId);
          if (!before) continue;
          const after: Entity = {
            ...before,
            aliases: union(before.aliases, draft.aliases),
            summary: before.summary || draft.summary,
            tags: union(before.tags, draft.tags),
            fields: { ...before.fields, ...fields },
            updatedAt: now,
          };
          await db.entities.put(after);
          record.patchedEntities.push({ id, before });
          updated.push({ id, type: before.type, name: before.name });
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
          record.entityIds.push(id);
          created.push({ id, type: draft.type, name: draft.name });
        }
      }

      // Field patches — replace/append updates to EXISTING entities
      // (ownership handed over, current location moved, history appended).
      // Snapshot each touched entity once so one Undo restores it exactly.
      const patchesByEntity = new Map<string, EntityFieldPatch[]>();
      for (const patch of bundle.patches ?? []) {
        const list = patchesByEntity.get(patch.entityId);
        if (list) list.push(patch);
        else patchesByEntity.set(patch.entityId, [patch]);
      }
      for (const [entityId, patches] of patchesByEntity) {
        const before = await db.entities.get(entityId);
        if (!before) continue;
        const fields = { ...before.fields };
        for (const patch of patches) {
          // Remap so a patch can reference a draft created in the same
          // delta (e.g. a freshly-created skill linked onto a character).
          const after = remapRefs(patch.after, idMap);
          fields[patch.field] =
            patch.mode === 'append' ? appendFieldValue(fields[patch.field], after) : after;
        }
        await db.entities.put({ ...before, fields, updatedAt: now });
        record.patchedFields.push({ id: entityId, before });
        updated.push({ id: before.id, type: before.type, name: before.name });
      }

      // Graph docs — new trees/boards, or nodes+edges appended to a target.
      for (const graph of bundle.graphs) {
        const table = graph.kind === 'skilltree' ? db.skillTrees : db.tangleBoards;
        const nodes = graph.nodes.map((node) => ({
          ...remapRefs(node, idMap),
          id: idMap.get(node.id) ?? node.id,
        }));
        const edges = graph.edges.map((edge) => ({
          ...edge,
          id: idMap.get(edge.id) ?? edge.id,
          from: idMap.get(edge.from) ?? edge.from,
          to: idMap.get(edge.to) ?? edge.to,
        }));
        if (graph.targetGraphId) {
          const before = await table.get(graph.targetGraphId);
          if (!before) continue;
          const existingNodes = (before as TangleBoard).cards ?? (before as SkillTree).nodes;
          const merged = {
            ...(graph.kind === 'tangle'
              ? { cards: [...existingNodes, ...nodes] }
              : { nodes: [...existingNodes, ...nodes] }),
            edges: [...before.edges, ...edges],
            updatedAt: now,
          };
          await table.update(graph.targetGraphId, merged as never);
          record.patchedGraphs.push({ id: graph.targetGraphId, kind: graph.kind, before });
        } else {
          const id = idMap.get(graph.localId)!;
          const row = {
            id,
            projectId,
            name: graph.name,
            ...(graph.kind === 'tangle' ? { cards: nodes } : { nodes }),
            edges,
            updatedAt: now,
          };
          await table.add(row as never);
          record.graphs.push({ id, kind: graph.kind });
        }
      }

      // Chapters — scaffold (or drafted prose) as real paragraphs.
      const chapterCount = bundle.chapters.length
        ? await db.chapters.where('projectId').equals(projectId).count()
        : 0;
      for (const [i, draft] of bundle.chapters.entries()) {
        const id = idMap.get(draft.localId)!;
        const { doc, paragraphs, wordCount } = chapterDoc(draft);
        const chapter: Chapter = {
          id,
          projectId,
          title: draft.title || `Chapter ${chapterCount + i + 1}`,
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

      // Links — resolve endpoints against drafts first, then the db.
      const resolveEndpoint = async (localOrRealId: string): Promise<EntityRef | null> => {
        const realId = idMap.get(localOrRealId) ?? localOrRealId;
        const draft = bundle.entities.find((d) => d.localId === localOrRealId);
        if (draft) return { id: realId, type: draft.type, name: draft.name };
        const row = await db.entities.get(realId);
        return row ? { id: row.id, type: row.type, name: row.name } : null;
      };
      for (const link of bundle.links) {
        const from = await resolveEndpoint(link.from);
        const to = await resolveEndpoint(link.to);
        if (!from || !to) continue;
        const row: Link = {
          id: newId(),
          projectId,
          from,
          to,
          kind: link.kind,
          source: 'generate',
          createdAt: now,
        };
        await db.links.add(row);
        record.linkIds.push(row.id);
      }

      const entry = await logAudit({
        projectId,
        action: 'generate.apply',
        target: { table: 'generation', id: bundle.id, label: record.label },
        after: record,
        reversible: true,
      });
      auditId = entry.id;
    }
  );

  return {
    auditId,
    created,
    updated,
    graphIds: record.graphs.map((g) => g.id),
    chapterIds: record.chapterIds,
  };
}

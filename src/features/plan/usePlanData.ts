import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { listActs, listScenes } from '@/db/repos/scenes';
import { listChapters } from '@/db/repos/chapters';
import { paragraphsFromDoc } from '@/lib/prose';
import type { Act, Chapter, Entity, Occurrence, Scene } from '@/db/types';
import type { EntityType } from '@/domain/entity-types';
import { useProjectStore } from '@/stores/project';

/** How a scene came to be associated with something.
 *
 * The distinction is the whole point of the Matrix. `asserted` is what the
 * author said; `summary` is what their own summary says; `extracted` is
 * what the engine found in the prose. Only the last one is something no
 * competitor can render, because no competitor reads the manuscript. */
export type CellSource = 'asserted' | 'summary' | 'extracted';

export interface PlanData {
  loading: boolean;
  acts: Act[];
  chapters: Chapter[];
  scenes: Scene[];
  entities: Entity[];
  /** sceneId → chapter */
  chapterOf: Map<string, Chapter>;
  /** chapterId → its scenes, in order */
  scenesByChapter: Map<string, Scene[]>;
  /** actId (or '' for unassigned) → its chapters, in order */
  chaptersByAct: Map<string, Chapter[]>;
  /** entityId → entity */
  entityById: Map<string, Entity>;
  /** `${sceneId}|${entityId}` → how the association arose */
  presence: Map<string, CellSource>;
  totals: { scenes: number; words: number };
}

const EMPTY: PlanData = {
  loading: true,
  acts: [],
  chapters: [],
  scenes: [],
  entities: [],
  chapterOf: new Map(),
  scenesByChapter: new Map(),
  chaptersByAct: new Map(),
  entityById: new Map(),
  presence: new Map(),
  totals: { scenes: 0, words: 0 },
};

/** The one query every planning view reads.
 *
 * Outline, Board, Matrix and Timeline are four projections of the same
 * rows — none of them owns state, and all of them write back through
 * `scenes.ts`. Deriving the indexes once here is what keeps them
 * genuinely consistent rather than four hand-maintained copies. */
export function usePlanData(): PlanData {
  const projectId = useProjectStore((s) => s.currentProjectId);

  const raw = useLiveQuery(
    async () => {
      if (!projectId) return null;
      const [acts, chapters, scenes, entities, occurrences] = await Promise.all([
        listActs(projectId),
        listChapters(projectId),
        listScenes(projectId),
        db.entities.where('projectId').equals(projectId).toArray(),
        db.occurrences.where('projectId').equals(projectId).toArray(),
      ]);
      return { acts, chapters, scenes, entities, occurrences };
    },
    [projectId],
    null
  );

  return useMemo(() => {
    if (!raw) return EMPTY;
    const { acts, chapters, scenes, entities, occurrences } = raw;

    const active = entities.filter((e) => e.status === 'active');
    const entityById = new Map(active.map((e) => [e.id, e]));

    const chapterById = new Map(chapters.map((c) => [c.id, c]));
    const chapterOf = new Map<string, Chapter>();
    const scenesByChapter = new Map<string, Scene[]>();
    for (const scene of scenes) {
      const chapter = chapterById.get(scene.chapterId);
      if (chapter) chapterOf.set(scene.id, chapter);
      const list = scenesByChapter.get(scene.chapterId) ?? [];
      list.push(scene);
      scenesByChapter.set(scene.chapterId, list);
    }
    for (const list of scenesByChapter.values()) list.sort((a, b) => a.order - b.order);

    const chaptersByAct = new Map<string, Chapter[]>();
    for (const chapter of chapters) {
      const key = chapter.actId ?? '';
      const list = chaptersByAct.get(key) ?? [];
      list.push(chapter);
      chaptersByAct.set(key, list);
    }
    for (const list of chaptersByAct.values()) list.sort((a, b) => a.order - b.order);

    const presence = buildPresence(scenes, active, occurrences);

    return {
      loading: false,
      acts,
      chapters,
      scenes,
      entities: active,
      chapterOf,
      scenesByChapter,
      chaptersByAct,
      entityById,
      presence,
      totals: {
        scenes: scenes.length,
        words: scenes.reduce((sum, s) => sum + s.wordCount, 0),
      },
    };
  }, [raw]);
}

/** Work out which entities each scene is associated with, and how.
 *
 * A stronger source always wins: something the author asserted is not
 * downgraded because extraction also found it. That ordering is what makes
 * "click to promote" meaningful — the cell only stops being faint once the
 * author has actually said so. */
function buildPresence(
  scenes: Scene[],
  entities: Entity[],
  occurrences: Occurrence[]
): Map<string, CellSource> {
  const presence = new Map<string, CellSource>();
  const rank: Record<CellSource, number> = { extracted: 0, summary: 1, asserted: 2 };
  const set = (sceneId: string, entityId: string, source: CellSource) => {
    const key = `${sceneId}|${entityId}`;
    const existing = presence.get(key);
    if (!existing || rank[source] > rank[existing]) presence.set(key, source);
  };

  // An occurrence is anchored to a paragraph, and a paragraph belongs to
  // exactly one scene — so the scene is reachable even though the
  // occurrence row only records a chapter.
  //
  // Built from the **unfiltered** document rather than `scene.paragraphs`,
  // which drops sections hidden from AI. This map wants ids, not text: an
  // extracted mention inside a hidden section would otherwise stop
  // resolving, and its Matrix cell would silently downgrade from "found in
  // the prose" to nothing at all.
  const sceneOfParagraph = new Map<string, string>();
  for (const scene of scenes) {
    for (const paragraph of paragraphsFromDoc(scene.doc)) {
      sceneOfParagraph.set(paragraph.id, scene.id);
    }
  }
  for (const occurrence of occurrences) {
    if (!occurrence.entityId || !occurrence.paragraphId) continue;
    const sceneId = sceneOfParagraph.get(occurrence.paragraphId);
    if (sceneId) set(sceneId, occurrence.entityId, 'extracted');
  }

  // A name in the summary counts too: the summary is the thing the AI will
  // be sent, so what it names is genuinely present as far as context goes.
  const byLowerName = new Map<string, string>();
  for (const entity of entities) {
    byLowerName.set(entity.name.toLowerCase(), entity.id);
    for (const alias of entity.aliases) byLowerName.set(alias.toLowerCase(), entity.id);
  }
  for (const scene of scenes) {
    if (!scene.summary.trim()) continue;
    const haystack = scene.summary.toLowerCase();
    for (const [name, id] of byLowerName) {
      if (name.length < 3) continue;
      if (haystack.includes(name)) set(scene.id, id, 'summary');
    }
  }

  for (const scene of scenes) {
    for (const id of scene.characterIds) set(scene.id, id, 'asserted');
    if (scene.locationId) set(scene.id, scene.locationId, 'asserted');
    if (scene.pov) set(scene.id, scene.pov, 'asserted');
    for (const ref of scene.attachedRefs) set(scene.id, ref.id, 'asserted');
  }

  return presence;
}

/** Which codex types make sense as a Matrix axis. Everything else is
 * either not scene-scoped (stats, references) or derived from these. */
export const MATRIX_ENTITY_TYPES: EntityType[] = [
  'cast',
  'locations',
  'factions',
  'quests',
  'items',
];

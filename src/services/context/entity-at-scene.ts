import type { Entity, Progression } from '@/db/types';

/**
 * The entity as it was true at this point in the story.
 *
 * Pure and DB-free so it can be unit-tested and called per item inside the
 * context assembler without a query.
 *
 * Four rules, in order:
 *  - anything anchored **later than** this scene is invisible. That clause
 *    is the whole feature: drafting chapter 2 must not see chapter 40;
 *  - a `replacement` overrides its field, latest anchor winning;
 *  - a field whose replacements are ALL anchored later is **withheld**. The
 *    stored row holds the newest truth, so leaving it in place would send
 *    chapter 40's owner while claiming to have withheld it — the failure
 *    this function exists to prevent, dressed up as a fix;
 *  - an `addition` layers onto the summary, in story order, so the model
 *    reads the entity's history the way the book tells it.
 *
 * The stored row is never mutated — a copy goes to the prompt while the
 * codex, the roster and the Matrix keep showing current truth.
 */
export function entityAtScene(
  entity: Entity,
  progressions: readonly Progression[],
  globalOrder: number,
  /** scene id → its position in the manuscript. Resolved by the caller
   * because `resequenceScenes` rewrites those positions on every insert, so
   * a progression can only ever store the id. A progression whose scene has
   * been deleted resolves to nothing and is skipped. */
  orderOf: (sceneId: string) => number | undefined
): Entity {
  const mine: { prog: Progression; at: number }[] = [];
  for (const prog of progressions) {
    if (prog.entityId !== entity.id) continue;
    const at = orderOf(prog.sceneId);
    if (at === undefined) continue;
    mine.push({ prog, at });
  }
  if (!mine.length) return entity;
  mine.sort((a, b) => a.at - b.at || a.prog.createdAt - b.prog.createdAt);

  const fields = { ...entity.fields };
  const additions: string[] = [];
  /** Fields a progression has already spoken for at or before this scene. */
  const settled = new Set<string>();
  /** Fields whose only news is still in the future. */
  const pending = new Set<string>();

  for (const { prog, at } of mine) {
    const replaces = prog.mode === 'replacement' && prog.fieldId ? prog.fieldId : null;
    if (at <= globalOrder) {
      if (replaces) {
        fields[replaces] = prog.text;
        settled.add(replaces);
      } else {
        additions.push(prog.text);
      }
    } else if (replaces) {
      pending.add(replaces);
    }
  }

  for (const fieldId of pending) {
    if (!settled.has(fieldId)) delete fields[fieldId];
  }

  return {
    ...entity,
    fields,
    summary: additions.length
      ? [entity.summary, ...additions].filter(Boolean).join(' ')
      : entity.summary,
  };
}

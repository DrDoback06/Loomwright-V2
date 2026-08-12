import type { Scene } from '@/db/types';

export interface StoryMemoryOptions {
  /** Only scenes told from this cast member's viewpoint. */
  pov?: string;
  /** Only scenes whose chapter belongs to this act. Resolved by the caller,
   * because a scene knows its chapter and a chapter knows its act — the
   * assembler should not have to hold the whole hierarchy to answer this. */
  chapterIds?: readonly string[];
  /** Character budget. Defaults to whatever the caller's tier allows. */
  budgetChars?: number;
}

/** Enough to be worth sending. A one-word summary is noise in a prompt. */
const MIN_SUMMARY = 12;

function eligible(scenes: readonly Scene[], opts: StoryMemoryOptions): Scene[] {
  const chapters = opts.chapterIds ? new Set(opts.chapterIds) : null;
  return scenes.filter((scene) => {
    // A scene the author hid from models is hidden here too, or the
    // summary becomes the leak the checkbox was meant to close.
    if (!scene.aiVisible) return false;
    if (scene.summary.trim().length < MIN_SUMMARY) return false;
    if (opts.pov && scene.pov !== opts.pov) return false;
    if (chapters && !chapters.has(scene.chapterId)) return false;
    return true;
  });
}

function render(scene: Scene): string {
  const title = scene.title.trim();
  return title ? `${title}: ${scene.summary.trim()}` : scene.summary.trim();
}

/**
 * Take from the end until the budget runs out, then restore story order.
 *
 * Newest-first is the whole trick: what happened two scenes ago matters more
 * to the passage being written than the opening chapter does, so when the
 * book outgrows the budget it is the *beginning* that falls off. Truncating
 * from the front — the obvious implementation — hands a model the setup and
 * withholds the situation it is being asked to continue.
 */
function fitNewestFirst(scenes: readonly Scene[], budget: number): string {
  const kept: string[] = [];
  let used = 0;
  for (let i = scenes.length - 1; i >= 0; i--) {
    const line = render(scenes[i]);
    // +1 for the newline that will join it.
    if (used + line.length + 1 > budget) break;
    kept.push(line);
    used += line.length + 1;
  }
  return kept.reverse().join('\n');
}

/**
 * The ordered summaries of everything before this point in the manuscript.
 *
 * This is the scalable answer to long-book context. Raw prose stops fitting
 * somewhere around the third chapter; summaries of two hundred scenes still
 * fit, which is why continuity survives at 150k words instead of collapsing
 * into "the model forgot who she was".
 *
 * Deterministic and offline — it reads rows the author already has. A
 * project with no summaries gets an empty string and no complaint, because
 * summarising is optional and writing is not.
 */
export function storySoFar(
  scenes: readonly Scene[],
  upTo: number,
  opts: StoryMemoryOptions = {}
): string {
  const ordered = eligible(scenes, opts)
    .filter((scene) => scene.globalOrder < upTo)
    .sort((a, b) => a.globalOrder - b.globalOrder);
  return fitNewestFirst(ordered, opts.budgetChars ?? 4_000);
}

/**
 * What is still to come — the outline of scenes not yet reached.
 *
 * The mirror image, and it truncates from the *far end* rather than the
 * near one: the next three scenes are what a passage has to set up, and the
 * finale is not.
 */
export function storyToCome(
  scenes: readonly Scene[],
  from: number,
  opts: StoryMemoryOptions = {}
): string {
  const ordered = eligible(scenes, opts)
    .filter((scene) => scene.globalOrder > from)
    .sort((a, b) => a.globalOrder - b.globalOrder);
  const budget = opts.budgetChars ?? 2_000;
  const kept: string[] = [];
  let used = 0;
  for (const scene of ordered) {
    const line = render(scene);
    if (used + line.length + 1 > budget) break;
    kept.push(line);
    used += line.length + 1;
  }
  return kept.join('\n');
}

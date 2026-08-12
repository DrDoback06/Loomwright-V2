/** Deriving readable prose from a TipTap document.
 *
 * This lives in `lib/` rather than beside the editor because both the
 * editor and the scenes repo need it, and `src/db/` must not import from
 * `src/features/`. There were two implementations with the same name and
 * different semantics before this — the repo's copy would have counted a
 * scene beat's instruction text as manuscript prose. */

/** The block types that carry manuscript text and therefore a stable
 * `pid`. Anything not in this list is walked THROUGH (so a wrapper node's
 * paragraphs are still found) but never counted itself — which is exactly
 * what keeps a `sceneBeat`'s instruction out of the word count, out of
 * extraction, and out of every export. */
export const PROSE_BLOCK_TYPES = ['paragraph', 'heading', 'blockquote'] as const;

export interface ProseParagraph {
  id: string;
  text: string;
}

export interface BlockNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: BlockNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

/** Skip a node and everything inside it. */
export type BlockPredicate = (node: BlockNode) => boolean;

/* The two derivations, which are NOT the same list.
 *
 * `scene.paragraphs` is *what the story is made of* — what extraction
 * reads, and what every AI path is given. `scene.wordCount` is *what the
 * author has written*. A note to self is in neither; an alternate take you
 * want counted but never fed back at you is in the second only.
 *
 * Consequence, stated once so nobody re-derives it wrongly: from N5b on,
 * `countWords(scene.paragraphs)` will legitimately disagree with
 * `scene.wordCount`. That is the contract, not a bug. */
export const HIDDEN_FROM_AI: BlockPredicate = (node) => node.attrs?.hiddenFromAi === true;
export const HIDDEN_FROM_COUNT: BlockPredicate = (node) =>
  node.attrs?.hiddenFromWordCount === true;

/** Derive the extraction substrate from a TipTap JSON document: ordered
 * `[{ id: pid, text }]` for every block that carries manuscript text.
 *
 * `skip` excludes a node and its whole subtree. It takes a predicate
 * because a section is ONE node type carrying two independent booleans, so
 * skipping by type name cannot express it; an array of type names is still
 * accepted for the callers that only ever wanted that. Without a skip the
 * walk recurses into any unrecognised node, which is the right default and
 * exactly the wrong one for deliberately hidden content. */
export function paragraphsFromDoc(
  doc: unknown,
  skip: readonly string[] | BlockPredicate = []
): ProseParagraph[] {
  const out: ProseParagraph[] = [];
  const root = doc as { content?: BlockNode[] } | null;
  if (!root?.content) return out;

  const skipped: BlockPredicate =
    typeof skip === 'function' ? skip : (node) => skip.includes(node.type);

  const walk = (nodes: BlockNode[]) => {
    for (const node of nodes) {
      if (skipped(node)) continue;
      if (
        (PROSE_BLOCK_TYPES as readonly string[]).includes(node.type) &&
        typeof node.attrs?.pid === 'string'
      ) {
        out.push({ id: node.attrs.pid, text: textOf(node) });
      } else if (node.content) {
        walk(node.content);
      }
    }
  };
  walk(root.content);
  return out;
}

function textOf(node: BlockNode): string {
  if (node.text) return node.text;
  if (!node.content) return '';
  return node.content.map(textOf).join('');
}

export function countWords(paragraphs: { text: string }[]): number {
  return paragraphs.reduce(
    (sum, p) => sum + (p.text.trim() ? p.text.trim().split(/\s+/).length : 0),
    0
  );
}

/** A link the author made by hand, with `@`.
 *
 * Offsets are relative to the paragraph's own text, which is the same
 * contract `Occurrence.start` / `.end` use — deliberately, because a typed
 * mention becomes an occurrence row and has to sit in the same coordinate
 * space as an extracted one. */
export interface TypedMention {
  pid: string;
  start: number;
  end: number;
  entityId: string;
  entityType: string;
  /** The marked text itself. */
  text: string;
}

/** The name of the mark a typed mention wears. Lives here rather than in
 * the extension so `src/db/` and `src/lib/` can read a document without
 * importing from `src/features/`. */
export const MENTION_MARK = 'mention';

/** Collect every typed mention in a document.
 *
 * Walks the same way `textOf` does and accumulates the same offsets, so a
 * mention's `start`/`end` cannot drift from the paragraph text
 * `paragraphsFromDoc` produced for the same node — they are computed by
 * one traversal from one definition of "the text of this block".
 *
 * Adjacent text nodes carrying the same mention are merged: ProseMirror
 * splits a run wherever another mark begins or ends, so a bolded word
 * inside a mention would otherwise report as two mentions of one entity. */
export function mentionsFromDoc(
  doc: unknown,
  skip: readonly string[] | BlockPredicate = HIDDEN_FROM_AI
): TypedMention[] {
  const out: TypedMention[] = [];
  const root = doc as { content?: BlockNode[] } | null;
  if (!root?.content) return out;

  const skipped: BlockPredicate =
    typeof skip === 'function' ? skip : (node) => skip.includes(node.type);

  const walk = (nodes: BlockNode[]) => {
    for (const node of nodes) {
      if (skipped(node)) continue;
      const pid = node.attrs?.pid;
      if ((PROSE_BLOCK_TYPES as readonly string[]).includes(node.type) && typeof pid === 'string') {
        collect(node, pid, out);
      } else if (node.content) {
        walk(node.content);
      }
    }
  };
  walk(root.content);
  return out;
}

function collect(block: BlockNode, pid: string, out: TypedMention[]): void {
  let offset = 0;
  let open: TypedMention | null = null;

  const visit = (node: BlockNode) => {
    if (node.text != null) {
      const mark = node.marks?.find((m) => m.type === MENTION_MARK);
      const entityId = mark?.attrs?.entityId;
      const entityType = mark?.attrs?.entityType;
      if (typeof entityId === 'string' && typeof entityType === 'string') {
        if (open && open.entityId === entityId && open.end === offset) {
          // A run split by another mark — same mention, keep extending.
          open.end += node.text.length;
          open.text += node.text;
        } else {
          open = {
            pid,
            start: offset,
            end: offset + node.text.length,
            entityId,
            entityType,
            text: node.text,
          };
          out.push(open);
        }
      } else {
        open = null;
      }
      offset += node.text.length;
      return;
    }
    if (node.content) node.content.forEach(visit);
  };

  block.content?.forEach(visit);
}

/** Everything a scene save writes, derived from one document.
 *
 * Two of these are the same text filtered two different ways — see
 * `HIDDEN_FROM_AI` / `HIDDEN_FROM_COUNT` above. Every writer of a scene row
 * should go through this rather than deriving one value and reusing it for
 * another, which is exactly how the two would fall out of step. */
export function deriveScene(doc: unknown): {
  paragraphs: ProseParagraph[];
  wordCount: number;
  mentions: TypedMention[];
} {
  return {
    paragraphs: paragraphsFromDoc(doc, HIDDEN_FROM_AI),
    wordCount: countWords(paragraphsFromDoc(doc, HIDDEN_FROM_COUNT)),
    // A mention inside a note you hid from models is a link you can click,
    // not an appearance in the book — the rule N5b already set for text.
    mentions: mentionsFromDoc(doc, HIDDEN_FROM_AI),
  };
}

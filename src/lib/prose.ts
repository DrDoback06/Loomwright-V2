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

/** The two numbers a scene save writes, derived from one document by two
 * different filters. Every writer of a scene row should go through this
 * rather than deriving one and reusing it for the other. */
export function deriveScene(doc: unknown): {
  paragraphs: ProseParagraph[];
  wordCount: number;
} {
  return {
    paragraphs: paragraphsFromDoc(doc, HIDDEN_FROM_AI),
    wordCount: countWords(paragraphsFromDoc(doc, HIDDEN_FROM_COUNT)),
  };
}

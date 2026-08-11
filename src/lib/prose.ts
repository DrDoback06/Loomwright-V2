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

interface BlockNode {
  type: string;
  attrs?: { pid?: string };
  content?: BlockNode[];
  text?: string;
}

/** Derive the extraction substrate from a TipTap JSON document: ordered
 * `[{ id: pid, text }]` for every block that carries manuscript text.
 *
 * `skipTypes` lets a caller exclude a wrapper node's contents wholesale —
 * a section flagged hidden-from-AI, for instance. Without it the walk
 * recurses into any unrecognised node, which is the right default and the
 * wrong one for deliberately hidden content. */
export function paragraphsFromDoc(doc: unknown, skipTypes: readonly string[] = []): ProseParagraph[] {
  const out: ProseParagraph[] = [];
  const root = doc as { content?: BlockNode[] } | null;
  if (!root?.content) return out;

  const walk = (nodes: BlockNode[]) => {
    for (const node of nodes) {
      if (skipTypes.includes(node.type)) continue;
      if ((PROSE_BLOCK_TYPES as readonly string[]).includes(node.type) && node.attrs?.pid) {
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

import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { newId } from '@/lib/id';

const TYPES = ['paragraph', 'heading', 'blockquote'];

/** Gives every top-level block a stable `pid` attribute. Paragraph notes,
 * occurrences, and extraction all key off these ids, so they must survive
 * serialisation (data-pid) and never duplicate (splits copy attrs — the
 * plugin reassigns the second copy). */
export const UniqueParagraphId = Extension.create({
  name: 'uniqueParagraphId',

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          pid: {
            default: null,
            keepOnSplit: false,
            parseHTML: (element) => element.getAttribute('data-pid'),
            renderHTML: (attributes) =>
              attributes.pid ? { 'data-pid': attributes.pid } : {},
          },
        },
      },
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('uniqueParagraphId'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = newState.tr;
          const seen = new Set<string>();
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (!TYPES.includes(node.type.name)) return;
            const pid = node.attrs.pid as string | null;
            if (!pid || seen.has(pid)) {
              tr.setNodeAttribute(pos, 'pid', newId());
              changed = true;
            } else {
              seen.add(pid);
            }
          });
          return changed ? tr : null;
        },
      }),
    ];
  },
});

/** Derive the extraction substrate from a TipTap JSON document:
 * ordered [{ id: pid, text }] for every block that carries text. */
export function paragraphsFromDoc(doc: unknown): { id: string; text: string }[] {
  const out: { id: string; text: string }[] = [];
  const root = doc as { content?: BlockNode[] } | null;
  if (!root?.content) return out;
  const walk = (nodes: BlockNode[]) => {
    for (const node of nodes) {
      if (TYPES.includes(node.type) && node.attrs?.pid) {
        out.push({ id: node.attrs.pid, text: textOf(node) });
      } else if (node.content) {
        walk(node.content);
      }
    }
  };
  walk(root.content);
  return out;
}

interface BlockNode {
  type: string;
  attrs?: { pid?: string };
  content?: BlockNode[];
  text?: string;
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

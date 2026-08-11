import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { newId } from '@/lib/id';

import { PROSE_BLOCK_TYPES } from '@/lib/prose';

const TYPES: string[] = [...PROSE_BLOCK_TYPES];

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

/* The prose helpers moved to `@/lib/prose` so the scenes repo can use the
   same definitions — `src/db/` must not import from `src/features/`.
   Re-exported here because a dozen call sites already import them from
   this module, and moving a function should not mean touching all of them. */
export { paragraphsFromDoc, countWords, type ProseParagraph } from '@/lib/prose';

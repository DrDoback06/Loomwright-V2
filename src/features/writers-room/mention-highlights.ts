import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Occurrence } from '@/db/types';

const key = new PluginKey<DecorationSet>('mentionHighlights');

/** Renders entity-mention highlights as ProseMirror DECORATIONS mapped
 * from persisted Occurrence rows (paragraphId + in-paragraph offsets).
 * Decorations never mutate the document — a bad occurrence can only
 * mis-highlight, never corrupt prose. Pronoun resolutions are skipped so
 * the manuscript stays clean. */
export const MentionHighlights = Extension.create({
  name: 'mentionHighlights',

  addStorage() {
    return { occurrences: [] as Occurrence[] };
  },

  addProseMirrorPlugins() {
    const storage = this.storage as { occurrences: Occurrence[] };
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => buildDecorations(state.doc, storage.occurrences),
          apply: (tr, old, _oldState, newState) => {
            if (tr.docChanged || tr.getMeta('mentions:refresh')) {
              return buildDecorations(newState.doc, storage.occurrences);
            }
            return old.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return key.getState(state);
          },
        },
      }),
    ];
  },
});

function buildDecorations(doc: PMNode, occurrences: Occurrence[]): DecorationSet {
  if (!occurrences.length) return DecorationSet.empty;
  const byPid = new Map<string, Occurrence[]>();
  for (const o of occurrences) {
    if (o.isPronounResolution || !o.paragraphId) continue;
    const list = byPid.get(o.paragraphId) ?? [];
    list.push(o);
    byPid.set(o.paragraphId, list);
  }
  if (!byPid.size) return DecorationSet.empty;

  const decos: Decoration[] = [];
  doc.descendants((node, pos) => {
    const pid = node.attrs?.pid as string | undefined;
    if (!pid) return;
    const list = byPid.get(pid);
    if (!list) return;
    const textLen = node.content.size;
    for (const o of list) {
      if (o.start == null || o.end == null || o.end > textLen) continue;
      decos.push(
        Decoration.inline(pos + 1 + o.start, pos + 1 + o.end, {
          class: o.entityId ? 'lw-mention' : 'lw-mention lw-mention--pending',
          'data-entity-id': o.entityId ?? '',
          'data-entity-type': o.entityType,
        })
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

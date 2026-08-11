import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';
import type { Tweaks } from '@/lib/tweaks';

declare module '@tiptap/core' {
  interface Storage {
    focusDim: FocusDimStorage;
  }
}

export interface FocusDimStorage {
  mode: Tweaks['focus'];
}

const key = new PluginKey<DecorationSet>('focusDim');

/** Where a sentence ends: a full stop, question or exclamation mark, plus
 * whatever closing quote or bracket trails it. */
const SENTENCE_END = /[.!?]+["'”’)\]]*\s*/g;

/** Dim everything the author is not writing in.
 *
 * Decorations, never a document change — the same rule
 * `mention-highlights.ts` follows, and the reason a focus mode cannot
 * corrupt a manuscript however wrong its arithmetic is.
 *
 * The one way this differs from the mention plugin it is modelled on: it
 * rebuilds on **selection change**, not only when the document changes.
 * Moving the caret with an arrow key changes the lit region without
 * touching a single character. */
export const FocusDim = Extension.create<Record<string, never>, FocusDimStorage>({
  name: 'focusDim',

  addStorage(): FocusDimStorage {
    return { mode: 'off' };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_, state) => build(state, storage.mode),
          apply: (tr, old, _oldState, newState) => {
            if (tr.docChanged || tr.selectionSet || tr.getMeta('focus:refresh')) {
              return build(newState, storage.mode);
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

/** Dim every block except the one holding the caret; inside that block,
 * narrow further to the sentence or the line if asked. */
function build(state: EditorState, mode: Tweaks['focus']): DecorationSet {
  if (mode === 'off') return DecorationSet.empty;
  const { doc, selection } = state;
  const decos: Decoration[] = [];
  const caret = selection.head;

  let liveFrom = -1;
  let liveTo = -1;

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    const from = pos;
    const to = pos + node.nodeSize;
    if (caret >= from && caret <= to) {
      liveFrom = pos + 1;
      liveTo = to - 1;
      return false;
    }
    decos.push(Decoration.node(from, to, { class: 'lw-dim' }));
    return false;
  });

  if (liveFrom < 0) return DecorationSet.create(doc, decos);

  if (mode === 'sentence') {
    // Narrow further: dim the parts of the live block outside the sentence
    // the caret sits in.
    const text = state.doc.textBetween(liveFrom, liveTo, '\n', ' ');
    const offset = caret - liveFrom;
    const [start, end] = sentenceAround(text, offset);
    if (start > 0) decos.push(Decoration.inline(liveFrom, liveFrom + start, { class: 'lw-dim' }));
    if (end < text.length) decos.push(Decoration.inline(liveFrom + end, liveTo, { class: 'lw-dim' }));
  }

  return DecorationSet.create(doc, decos);
}

/** The [start, end) of the sentence containing `offset`. */
export function sentenceAround(text: string, offset: number): [number, number] {
  const bounds: number[] = [0];
  SENTENCE_END.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SENTENCE_END.exec(text))) {
    bounds.push(match.index + match[0].length);
  }
  if (bounds[bounds.length - 1] !== text.length) bounds.push(text.length);

  for (let i = 0; i < bounds.length - 1; i += 1) {
    if (offset >= bounds[i] && offset <= bounds[i + 1]) return [bounds[i], bounds[i + 1]];
  }
  return [0, text.length];
}

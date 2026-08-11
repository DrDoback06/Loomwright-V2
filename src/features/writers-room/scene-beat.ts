import { Node, mergeAttributes, textblockTypeInputRule } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { newId } from '@/lib/id';
import { SceneBeatView } from './SceneBeatView';

declare module '@tiptap/core' {
  interface Storage {
    sceneBeat: SceneBeatStorage;
  }
  interface Commands<ReturnType> {
    sceneBeat: {
      insertSceneBeat: () => ReturnType;
      exitSceneBeat: () => ReturnType;
    };
  }
}

/** A beat is an instruction that lives in the prose.
 *
 * It survives expansion: generated paragraphs land AFTER the node and the
 * node stays, so a beat can always be re-rolled or rewritten. That is the
 * difference between a beat and a prompt box — the intention stays with
 * the passage it produced.
 *
 * Deliberately NOT registered in `PROSE_BLOCK_TYPES`, so it carries no
 * `pid` and never reaches `paragraphsFromDoc`. One omission keeps beat
 * text out of the word count, out of extraction, and out of every export
 * — a beat is scaffolding, not the book.
 *
 * Only `state` is ever written back by the app. Everything transient — the
 * generated draft, the in-flight status, canon issues — lives in React
 * state in the node view, because writing it to attributes would fire
 * `onUpdate` on every frame of a generation and fill the undo stack with
 * spinner ticks. */
export interface SceneBeatStorage {
  projectId: string | null;
  sceneId: string | null;
  /** Writes anything sitting in the autosave debounce. Supplied by the
   * Writer's Room; read through at click time so it can never be a stale
   * closure. */
  flush: () => Promise<void>;
}

export const SceneBeat = Node.create<Record<string, never>, SceneBeatStorage>({
  name: 'sceneBeat',
  group: 'block',
  content: 'inline*',
  defining: true,
  /** A stray Backspace or a selection replace must not be able to merge
   * prose into a beat, or half of one into the paragraph above. */
  isolating: true,

  addAttributes() {
    return {
      beatId: { default: null },
      mode: { default: 'prose' },
      words: { default: 400 },
      /** pending | expanded — expanded only means "has produced prose at
       * least once"; the beat stays fully editable and re-expandable. */
      state: { default: 'pending' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-scene-beat]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-scene-beat': '', class: 'lw-beat' }),
      0,
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SceneBeatView);
  },

  addCommands() {
    return {
      insertSceneBeat:
        () =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContent({ type: this.name, attrs: { beatId: newId() } })
            .run(),

      exitSceneBeat:
        () =>
        ({ chain, state }) => {
          const after = state.selection.$from.after();
          return chain()
            .insertContentAt(after, { type: 'paragraph' })
            .setTextSelection(after + 1)
            .run();
        },
    };
  },

  addInputRules() {
    return [
      // `/beat ` at the start of an empty paragraph becomes a beat — the
      // same slash affordance the editor will use for sections and
      // progressions later.
      textblockTypeInputRule({
        find: /^\/beat\s$/,
        type: this.type,
        getAttributes: () => ({ beatId: newId() }),
      }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-b': () => this.editor.commands.insertSceneBeat(),
      // A beat is one instruction. Enter leaves it rather than growing it,
      // which is what every author tries first.
      Enter: () => {
        if (!this.editor.isActive(this.name)) return false;
        return this.editor.commands.exitSceneBeat();
      },
    };
  },

  addProseMirrorPlugins() {
    // Copy/paste duplicates a beatId. Two beats sharing an id is not fatal
    // today — drafts are per-node-view — but it becomes so the moment
    // anything keys off it, so repair it the way UniqueParagraphId does.
    return [
      new Plugin({
        key: new PluginKey('sceneBeatIds'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = newState.tr;
          const seen = new Set<string>();
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (node.type.name !== 'sceneBeat') return true;
            const id = node.attrs.beatId as string | null;
            if (!id || seen.has(id)) {
              tr.setNodeAttribute(pos, 'beatId', newId());
              changed = true;
            } else {
              seen.add(id);
            }
            return false; // never descend into a beat
          });
          return changed ? tr : null;
        },
      }),
    ];
  },

  /** The active scene, published by the Writer's Room so a node view can
   * snapshot and build context without prop-drilling through ProseMirror.
   * Mirrors how `MentionHighlights` receives its occurrences. */
  addStorage(): SceneBeatStorage {
    return { projectId: null, sceneId: null, flush: async () => {} };
  },
});

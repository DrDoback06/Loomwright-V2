import { Extension, InputRule } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Storage {
    slashProgress: SlashProgressStorage;
  }
}

export interface SlashProgressStorage {
  /** Installed by the Writer's Room. Opens the scene panel with the
   * progression composer focused. */
  onProgress: (() => void) | null;
}

/**
 * `/progress ` — anchor a fact to this point in the story.
 *
 * Unlike `/beat` and `/note`, this does **not** leave a node behind. A
 * progression is not prose: it is a row about the story, and putting it in
 * the document would put it in the word count, the exports and — worst —
 * the extraction substrate, where the app would then discover the fact it
 * had just been told and propose it as a candidate.
 *
 * So the slash is a shortcut to the composer, not a block. The typed text
 * is removed and the scene panel opens with the entity picker focused,
 * which is the same place the affordance lives for anyone who never
 * discovers the slash.
 */
export const SlashProgress = Extension.create<Record<string, never>, SlashProgressStorage>({
  name: 'slashProgress',

  addStorage(): SlashProgressStorage {
    return { onProgress: null };
  },

  addInputRules() {
    const storage = this.storage;
    return [
      new InputRule({
        find: /^\/progress\s$/,
        handler: ({ state, range }) => {
          state.tr.delete(range.from, range.to);
          // Out of the transaction, because opening a panel mid-dispatch
          // re-enters React while ProseMirror is still applying.
          queueMicrotask(() => storage.onProgress?.());
        },
      }),
    ];
  },
});

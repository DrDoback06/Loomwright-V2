import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Storage {
    mentionSuggest: MentionSuggestStorage;
  }
}

/** An `@` the author has started and not yet finished. */
export interface MentionQuery {
  /** Position of the `@` itself. */
  from: number;
  /** The caret. */
  to: number;
  /** What has been typed after the `@`. */
  text: string;
}

export interface MentionSuggestStorage {
  /** Installed by the popup. The plugin claims ↑ ↓ Enter Tab Escape only
   * while a query is live, and only if the popup says it handled them —
   * so a keystroke the list does not want still reaches the prose. */
  onKey: ((event: KeyboardEvent) => boolean) | null;
}

interface SuggestState {
  query: MentionQuery | null;
  /** The position of an `@` the author has dismissed with Escape. Held
   * until they start a different one, so Escape means "not this time"
   * rather than "for one keystroke". */
  dismissed: number | null;
}

export const mentionSuggestKey = new PluginKey<SuggestState>('mentionSuggest');

/** How long a name can get before this stops being a name. */
const MAX_QUERY = 32;

/** Characters that may precede an `@` for it to count as a trigger. An `@`
 * in the middle of a word is an email address or a handle, not a mention. */
const TRIGGER_BOUNDARY = /[\s(["'“‘–—-]$/;

/** Read the live `@` query out of the document, or null.
 *
 * Derived from the document and the selection on every transaction rather
 * than accumulated as the author types. Accumulating would mean tracking
 * every way a query can end — an arrow key, an undo, a click, a paste, a
 * scene switch — and getting one wrong leaves a popup floating over prose
 * it no longer describes. */
function readQuery(state: EditorState): MentionQuery | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const $from = selection.$from;
  if (!$from.parent.isTextblock) return null;

  const blockStart = $from.start();
  // `\0` for leaf nodes so a non-text node cannot look like a space and
  // let a query run backwards through it.
  const before = state.doc.textBetween(blockStart, $from.pos, '\n', '\0');
  const at = before.lastIndexOf('@');
  if (at < 0) return null;

  const preceding = before.slice(0, at);
  if (preceding && !TRIGGER_BOUNDARY.test(preceding)) return null;

  const text = before.slice(at + 1);
  if (text.length > MAX_QUERY) return null;
  // A name has no newlines and no double spaces. Both are how a query that
  // was never going to match gets to stop following the caret around.
  if (/[\n\0]/.test(text) || /\s\s/.test(text) || text.startsWith(' ')) return null;

  return { from: blockStart + at, to: $from.pos, text };
}

/** Detects `@`, and gets out of the way of everything else.
 *
 * Deliberately hand-rolled: `@tiptap/suggestion` is not installed — not
 * even transitively — and taking it would mean a new runtime dependency
 * for a hundred lines of state. The popup that reads this is positioned
 * the way `RewriteBubble.tsx` positions itself. */
export const MentionSuggest = Extension.create<Record<string, never>, MentionSuggestStorage>({
  name: 'mentionSuggest',

  addStorage(): MentionSuggestStorage {
    return { onKey: null };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;
    return [
      new Plugin<SuggestState>({
        key: mentionSuggestKey,
        state: {
          init: (_, state) => ({ query: readQuery(state), dismissed: null }),
          apply: (tr: Transaction, previous, _oldState, newState) => {
            const next = readQuery(newState);
            if (tr.getMeta('mention:dismiss')) {
              return { query: null, dismissed: next?.from ?? null };
            }
            // A dismissal survives until the author starts a different
            // `@`. Mapped through the transaction so typing before it does
            // not resurrect the popup.
            const dismissed =
              previous.dismissed == null ? null : tr.mapping.map(previous.dismissed);
            if (next && dismissed != null && next.from === dismissed) {
              return { query: null, dismissed };
            }
            return { query: next, dismissed: next ? dismissed : null };
          },
        },
        props: {
          handleKeyDown(view, event) {
            if (!mentionSuggestKey.getState(view.state)?.query) return false;
            if (event.key === 'Escape') {
              view.dispatch(view.state.tr.setMeta('mention:dismiss', true));
              return true;
            }
            return storage.onKey?.(event) ?? false;
          },
        },
      }),
    ];
  },
});

/** The live query, for the popup. */
export function mentionQuery(state: EditorState): MentionQuery | null {
  return mentionSuggestKey.getState(state)?.query ?? null;
}

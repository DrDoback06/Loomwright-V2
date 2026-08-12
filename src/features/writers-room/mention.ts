import { Mark, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { MENTION_MARK } from '@/lib/prose';
import { ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mention: {
      /** Replace `[from, to)` with the entity's name, marked. */
      insertMention: (input: {
        from: number;
        to: number;
        entityId: string;
        entityType: EntityType;
        label: string;
      }) => ReturnType;
      /** Drop the mark under the caret, keeping the words. */
      unlinkMention: (pos: number) => ReturnType;
    };
  }
}

/** A link the author made by hand.
 *
 * A **mark**, not a node, and that is the whole reason this costs nothing
 * downstream: the text under it is ordinary prose. `textOf` in
 * `@/lib/prose` reads `node.text` and ignores marks entirely, so a mention
 * is counted in the word count, read by extraction, and exported exactly as
 * the words it wraps — there is no `@Vex` in the manuscript, only "Vex".
 * The same argument that made `sceneBeat` free in N5a, run the other way.
 *
 * `label` is stored alongside the ids so a mention whose entity has since
 * been deleted can still render and explain itself rather than becoming an
 * unexplained highlight. */
export const Mention = Mark.create({
  name: MENTION_MARK,
  /** Typing straight after a mention must not extend it — the next word is
   * not part of the name. */
  inclusive: false,

  addAttributes() {
    return {
      entityId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-entity-id'),
        renderHTML: (attributes) => ({ 'data-entity-id': attributes.entityId }),
      },
      entityType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-entity-type'),
        renderHTML: (attributes) => ({ 'data-entity-type': attributes.entityType }),
      },
      label: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-label'),
        renderHTML: (attributes) => (attributes.label ? { 'data-label': attributes.label } : {}),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-entity-id]' }];
  },

  renderHTML({ mark, HTMLAttributes }) {
    // Shares `.lw-mention` with the extraction-derived decorations on
    // purpose: they are the same idea at different confidence, and two
    // existing specs already assert that class. The modifier is what says
    // "you asserted this" rather than "the engine found it".
    //
    // The tint travels as a custom property rather than sixteen CSS rules,
    // so the entity colours stay defined in exactly one place
    // (`ENTITY_TYPE_META`) instead of being copied into the stylesheet.
    const tint = mentionTint(mark.attrs.entityType as string | null);
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'lw-mention lw-mention--typed',
        ...(tint ? { style: `--mention-tint: ${tint}` } : {}),
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertMention:
        ({ from, to, entityId, entityType, label }) =>
        ({ chain }) =>
          chain()
            .focus()
            .insertContentAt(
              { from, to },
              [
                {
                  type: 'text',
                  text: label,
                  marks: [{ type: this.name, attrs: { entityId, entityType, label } }],
                },
                // A trailing space, unmarked. Without it the caret sits
                // inside the mark's boundary and the next word joins the
                // name on some browsers.
                { type: 'text', text: ' ' },
              ],
              { updateSelection: true }
            )
            .run(),

      unlinkMention:
        (pos) =>
        ({ chain, state }) => {
          const range = mentionRangeAt(state, pos);
          if (!range) return false;
          return chain()
            .setTextSelection(range)
            .unsetMark(this.name)
            .setTextSelection(range.to)
            .run();
        },
    };
  },

  addProseMirrorPlugins() {
    // A mention whose words no longer read as its name is not a mention.
    //
    // Edit "Vex" into "Vexation" and the mark rides along, silently
    // claiming a link the prose no longer makes — and, because occurrences
    // are derived from these marks, asserting it to every surface that
    // reads them. Repairing here rather than trusting the author to notice
    // is the same bargain `scene-beat.ts` makes with duplicated beat ids.
    return [
      new Plugin({
        key: new PluginKey('mentionRepair'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            if (!node.isText) return true;
            const mark = node.marks.find((m) => m.type.name === MENTION_MARK);
            if (!mark) return true;
            const label = mark.attrs.label as string | null;
            if (!label) return true;
            // The run may be a fragment of a longer label (another mark
            // split it), so only a run that is not a substring of the label
            // is genuinely wrong.
            if (label.includes(node.text ?? '')) return true;
            tr.removeMark(pos, pos + node.nodeSize, mark.type);
            changed = true;
            return true;
          });
          return changed ? tr : null;
        },
      }),
    ];
  },
});

/** The full span of the mention mark covering `pos`, or null.
 *
 * Walks outwards over neighbouring runs carrying the same mark, because
 * ProseMirror splits a text node wherever any other mark begins or ends —
 * unlinking only the run under the caret would leave half a mention
 * behind. */
export function mentionRangeAt(
  state: EditorState,
  pos: number
): { from: number; to: number } | null {
  const $pos = state.doc.resolve(pos);
  const parent = $pos.parent;
  const index = $pos.index();
  const child = parent.maybeChild(index);
  if (!child) return null;
  const mark = child.marks.find((m) => m.type.name === MENTION_MARK);
  if (!mark) return null;

  let from = $pos.start();
  for (let i = 0; i < index; i += 1) from += parent.child(i).nodeSize;
  let to = from + child.nodeSize;

  for (let i = index - 1; i >= 0; i -= 1) {
    const sibling = parent.child(i);
    if (!mark.isInSet(sibling.marks)) break;
    from -= sibling.nodeSize;
  }
  for (let i = index + 1; i < parent.childCount; i += 1) {
    const sibling = parent.child(i);
    if (!mark.isInSet(sibling.marks)) break;
    to += sibling.nodeSize;
  }
  return { from, to };
}

/** The colour a typed mention wears, so the type is readable at a glance
 * without opening anything. */
export function mentionTint(type: string | null): string | undefined {
  return type && type in ENTITY_TYPE_META
    ? ENTITY_TYPE_META[type as EntityType].color
    : undefined;
}

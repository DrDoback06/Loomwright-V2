import { Node, mergeAttributes, wrappingInputRule } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { SectionView } from './SectionView';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    section: {
      /** Wrap the current block in a note: yellow, invisible to models,
       * uncounted. The one-keystroke case. */
      setNote: () => ReturnType;
      /** Wrap the current block in a plain section — a colour band, with
       * both flags off until asked for. */
      setSection: () => ReturnType;
    };
  }
}

export type SectionColour = 'none' | 'yellow' | 'green' | 'blue' | 'red' | 'violet';

/** Named, not raw: a section stores a colour *name* and the stylesheet maps
 * it onto a semantic token, so a section written in Studio Dark still reads
 * correctly in Parchment Light. Storing `#f5c542` would have baked one
 * theme into the document. */
export const SECTION_COLOURS: { id: SectionColour; label: string }[] = [
  { id: 'none', label: 'No colour' },
  { id: 'yellow', label: 'Yellow' },
  { id: 'green', label: 'Green' },
  { id: 'blue', label: 'Blue' },
  { id: 'red', label: 'Red' },
  { id: 'violet', label: 'Violet' },
];

const NOTE_ATTRS = { colour: 'yellow', hiddenFromAi: true, hiddenFromWordCount: true };

/** A run of blocks the author has marked out: an alternate take, a note to
 * self, a passage they want tinted so they can find it again.
 *
 * The two flags are deliberately **independent**, and that is the whole
 * design. "Do not send this to a model" and "do not count this as words I
 * wrote" are different wishes: an alternate take is real writing you may
 * not want fed back at you, and a bracketed note is neither. One flag
 * could not have expressed either case honestly.
 *
 * A wrapper, not a leaf: `content: 'block+'` means the paragraphs inside
 * are ordinary paragraphs with ordinary `pid`s, so notes, occurrences and
 * the caret all behave exactly as they do outside one. The flags are read
 * once, at derivation, by `paragraphsFromDoc` — see `HIDDEN_FROM_AI` /
 * `HIDDEN_FROM_COUNT` in `@/lib/prose`. */
export const Section = Node.create({
  name: 'section',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      colour: {
        default: 'none' as SectionColour,
        parseHTML: (element) => element.getAttribute('data-colour') ?? 'none',
        renderHTML: (attributes) => ({ 'data-colour': attributes.colour }),
      },
      hiddenFromAi: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-hidden-ai') === 'true',
        renderHTML: (attributes) =>
          attributes.hiddenFromAi ? { 'data-hidden-ai': 'true' } : {},
      },
      hiddenFromWordCount: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-hidden-count') === 'true',
        renderHTML: (attributes) =>
          attributes.hiddenFromWordCount ? { 'data-hidden-count': 'true' } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-section]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-section': '', class: 'lw-section' }), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SectionView);
  },

  addCommands() {
    return {
      setNote:
        () =>
        ({ chain }) =>
          chain().focus().wrapIn(this.name, NOTE_ATTRS).run(),

      setSection:
        () =>
        ({ chain }) =>
          chain().focus().wrapIn(this.name, {}).run(),
    };
  },

  addInputRules() {
    return [
      // `wrappingInputRule`, not `textblockTypeInputRule`: a section wraps
      // blocks rather than becoming one, and the wrapping variant is also
      // what deletes the typed `/note ` on the way.
      wrappingInputRule({ find: /^\/note\s$/, type: this.type, getAttributes: NOTE_ATTRS }),
      wrappingInputRule({ find: /^\/section\s$/, type: this.type }),
    ];
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Shift-n': () => this.editor.commands.setNote(),
    };
  },
});

import type { Editor } from '@tiptap/react';
import { useEditorState } from '@tiptap/react';

interface ToolButton {
  label: string;
  aria: string;
  isActive: (editor: Editor) => boolean;
  run: (editor: Editor) => void;
}

const TOOLS: ToolButton[] = [
  {
    label: 'B',
    aria: 'Bold',
    isActive: (e) => e.isActive('bold'),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    label: 'I',
    aria: 'Italic',
    isActive: (e) => e.isActive('italic'),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    label: 'U',
    aria: 'Underline',
    isActive: (e) => e.isActive('underline'),
    run: (e) => e.chain().focus().toggleUnderline().run(),
  },
  {
    label: 'S',
    aria: 'Strikethrough',
    isActive: (e) => e.isActive('strike'),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    label: 'H',
    aria: 'Heading',
    isActive: (e) => e.isActive('heading', { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    label: '❝',
    aria: 'Quote',
    isActive: (e) => e.isActive('blockquote'),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    label: '⁂',
    aria: 'Scene break',
    isActive: () => false,
    run: (e) => e.chain().focus().setHorizontalRule().run(),
  },
];

export function Toolbar({ editor }: { editor: Editor }) {
  // Re-render on selection/content changes so active states track the caret.
  useEditorState({
    editor,
    selector: (ctx) => ({
      bold: ctx.editor.isActive('bold'),
      italic: ctx.editor.isActive('italic'),
      underline: ctx.editor.isActive('underline'),
      strike: ctx.editor.isActive('strike'),
      heading: ctx.editor.isActive('heading'),
      blockquote: ctx.editor.isActive('blockquote'),
    }),
  });

  return (
    <div className="lw-wtoolbar" role="toolbar" aria-label="Formatting">
      {TOOLS.map((tool) => (
        <button
          key={tool.aria}
          type="button"
          className={
            tool.isActive(editor) ? 'lw-wtoolbar__btn lw-wtoolbar__btn--active' : 'lw-wtoolbar__btn'
          }
          aria-label={tool.aria}
          aria-pressed={tool.isActive(editor)}
          title={tool.aria}
          onClick={() => tool.run(editor)}
        >
          {tool.label}
        </button>
      ))}
      <span className="lw-wtoolbar__gap" />
      <button
        type="button"
        className="lw-wtoolbar__btn"
        aria-label="Undo"
        title="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        ↶
      </button>
      <button
        type="button"
        className="lw-wtoolbar__btn"
        aria-label="Redo"
        title="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        ↷
      </button>
    </div>
  );
}

import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { SECTION_COLOURS, type SectionColour } from './section';
import { swallowEditorKeys } from './swallow';

/** The section's own chrome: a colour, two independent switches, and a way
 * back out.
 *
 * Both switches are phrased as permissions rather than prohibitions —
 * "Let AI read this", "Count these words" — to match the scene panel's
 * checkbox. A control that is checked when the thing is *off* is read
 * wrongly by everyone, every time. */
export function SectionView({ node, editor, getPos, updateAttributes }: ReactNodeViewProps) {
  const colour = (node.attrs.colour ?? 'none') as SectionColour;
  const hiddenFromAi = node.attrs.hiddenFromAi === true;
  const hiddenFromWordCount = node.attrs.hiddenFromWordCount === true;

  /** Unwrap: the blocks inside come back out as ordinary prose. Deliberately
   * NOT a delete — losing the marking must never be able to lose the words,
   * and there is no confirmation on a control that cannot destroy anything. */
  const unwrap = () => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos == null) return;
    const live = editor.state.doc.nodeAt(pos);
    if (!live || live.type.name !== 'section') return;
    editor
      .chain()
      .command(({ tr }) => {
        tr.replaceWith(pos, pos + live.nodeSize, live.content);
        return true;
      })
      .run();
  };

  return (
    <NodeViewWrapper
      className="lw-section"
      data-colour={colour}
      data-hidden-ai={hiddenFromAi ? 'true' : undefined}
      data-hidden-count={hiddenFromWordCount ? 'true' : undefined}
      data-testid="section"
    >
      <div className="lw-section__bar" contentEditable={false} {...swallowEditorKeys}>
        <label className="lw-section__control">
          <span className="lw-visually-hidden">Section colour</span>
          <select
            className="lw-input lw-input--sm"
            value={colour}
            onChange={(e) => updateAttributes({ colour: e.target.value })}
          >
            {SECTION_COLOURS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="lw-section__toggle">
          <input
            type="checkbox"
            checked={!hiddenFromAi}
            onChange={(e) => updateAttributes({ hiddenFromAi: !e.target.checked })}
          />
          <span>Let AI read this</span>
        </label>
        <label className="lw-section__toggle">
          <input
            type="checkbox"
            checked={!hiddenFromWordCount}
            onChange={(e) => updateAttributes({ hiddenFromWordCount: !e.target.checked })}
          />
          <span>Count these words</span>
        </label>
        <span className="lw-section__spacer" />
        <button type="button" className="lw-btn lw-btn--sm" onClick={unwrap}>
          Remove section
        </button>
      </div>
      <NodeViewContent className="lw-section__body" />
    </NodeViewWrapper>
  );
}

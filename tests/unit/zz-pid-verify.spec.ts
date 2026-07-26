// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { DOMParser as PMDOMParser, DOMSerializer, Slice } from '@tiptap/pm/model';
import { TextSelection } from '@tiptap/pm/state';
import { UniqueParagraphId } from '@/features/writers-room/paragraph-id';

function makeEditor(html: string) {
  const element = document.createElement('div');
  document.body.appendChild(element);
  const editor = new Editor({ element, extensions: [StarterKit, UniqueParagraphId] });
  editor.commands.setContent(html);
  return editor;
}

function pids(editor: Editor) {
  const out: { pid: string | null; text: string }[] = [];
  editor.state.doc.descendants((node) => {
    if (node.type.name === 'paragraph') out.push({ pid: node.attrs.pid, text: node.textContent });
  });
  return out;
}

/** Mirror what prosemirror-view does on copy → paste: serialize the slice
 * through the schema's DOM serializer, then re-parse it with parseSlice and
 * the recorded openStart/openEnd. */
function clipboardRoundTrip(editor: Editor, from: number, to: number) {
  const slice = editor.state.doc.slice(from, to);
  const serializer = DOMSerializer.fromSchema(editor.schema);
  const wrap = document.createElement('div');
  wrap.appendChild(serializer.serializeFragment(slice.content, { document }));
  const html = wrap.innerHTML;
  const parsed = PMDOMParser.fromSchema(editor.schema).parseSlice(wrap, {
    preserveWhitespace: true,
  });
  return {
    html,
    openStart: slice.openStart,
    openEnd: slice.openEnd,
    slice: new Slice(parsed.content, slice.openStart, slice.openEnd),
  };
}

describe('pid clipboard survival + dedupe ordering', () => {
  it('A: pids round-trip through clipboard HTML', () => {
    const editor = makeEditor('<p>Alpha</p><p>Beta</p><p>Gamma</p>');
    const before = pids(editor);
    expect(before.every((p) => !!p.pid)).toBe(true);
    expect(editor.getHTML()).toContain('data-pid');

    // copy Beta + Gamma (text selection spanning two blocks)
    const doc = editor.state.doc;
    let betaStart = -1;
    let gammaEnd = -1;
    doc.descendants((node, pos) => {
      if (node.type.name !== 'paragraph') return;
      if (node.textContent === 'Beta') betaStart = pos + 1;
      if (node.textContent === 'Gamma') gammaEnd = pos + 1 + node.content.size;
    });
    const trip = clipboardRoundTrip(editor, betaStart, gammaEnd);
    // eslint-disable-next-line no-console
    console.log('CLIPBOARD HTML:', trip.html, 'open', trip.openStart, trip.openEnd);
    expect(trip.html).toContain('data-pid');
    editor.destroy();
  });

  it('B: pasting a two-paragraph copy ABOVE the source renames the ORIGINAL', () => {
    const editor = makeEditor('<p>Alpha</p><p>Beta</p><p>Gamma</p>');
    const before = pids(editor);
    const betaPidBefore = before.find((p) => p.text === 'Beta')!.pid!;
    const gammaPidBefore = before.find((p) => p.text === 'Gamma')!.pid!;

    const doc = editor.state.doc;
    let betaStart = -1;
    let gammaEnd = -1;
    doc.descendants((node, pos) => {
      if (node.type.name !== 'paragraph') return;
      if (node.textContent === 'Beta') betaStart = pos + 1;
      if (node.textContent === 'Gamma') gammaEnd = pos + 1 + node.content.size;
    });
    const { slice } = clipboardRoundTrip(editor, betaStart, gammaEnd);

    // caret at the very start of the document (above the source paragraphs)
    const view = editor.view;
    const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, 1));
    tr.replaceSelection(slice);
    view.dispatch(tr);

    const after = pids(editor);
    // eslint-disable-next-line no-console
    console.log('BEFORE:', JSON.stringify(before, null, 0));
    // eslint-disable-next-line no-console
    console.log('AFTER :', JSON.stringify(after, null, 0));
    // eslint-disable-next-line no-console
    console.log('betaPidBefore', betaPidBefore, 'gammaPidBefore', gammaPidBefore);

    const holdersOfBeta = after.filter((p) => p.pid === betaPidBefore);
    const holdersOfGamma = after.filter((p) => p.pid === gammaPidBefore);
    // eslint-disable-next-line no-console
    console.log('holders of old beta pid:', JSON.stringify(holdersOfBeta));
    // eslint-disable-next-line no-console
    console.log('holders of old gamma pid:', JSON.stringify(holdersOfGamma));
    expect(new Set(after.map((p) => p.pid)).size).toBe(after.length); // no dupes remain
    editor.destroy();
  });

  it('C: the claimed repro — copy ONE paragraph, paste at its own start', () => {
    const editor = makeEditor('<p>Alpha</p><p>Beta</p><p>Gamma</p>');
    const before = pids(editor);
    const betaPidBefore = before.find((p) => p.text === 'Beta')!.pid!;

    let betaPos = -1;
    let betaSize = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === 'Beta') {
        betaPos = pos;
        betaSize = node.content.size;
      }
    });
    const { slice, html, openStart, openEnd } = clipboardRoundTrip(
      editor,
      betaPos + 1,
      betaPos + 1 + betaSize
    );
    // eslint-disable-next-line no-console
    console.log('single-para clipboard:', html, openStart, openEnd);

    const view = editor.view;
    const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, betaPos + 1));
    tr.replaceSelection(slice);
    view.dispatch(tr);

    const after = pids(editor);
    // eslint-disable-next-line no-console
    console.log('C AFTER:', JSON.stringify(after));
    // eslint-disable-next-line no-console
    console.log('C betaPidBefore', betaPidBefore);
    editor.destroy();
  });

  it('D: paste a whole-block (node-level) copy above the source', () => {
    const editor = makeEditor('<p>Alpha</p><p>Beta</p><p>Gamma</p>');
    const before = pids(editor);
    const betaPidBefore = before.find((p) => p.text === 'Beta')!.pid!;

    let betaPos = -1;
    let betaNodeSize = 0;
    editor.state.doc.descendants((node, pos) => {
      if (node.type.name === 'paragraph' && node.textContent === 'Beta') {
        betaPos = pos;
        betaNodeSize = node.nodeSize;
      }
    });
    // full node slice: openStart = openEnd = 0
    const { slice, html } = clipboardRoundTrip(editor, betaPos, betaPos + betaNodeSize);
    // eslint-disable-next-line no-console
    console.log('D clipboard:', html);

    const view = editor.view;
    const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, betaPos + 1));
    tr.replaceSelection(slice);
    view.dispatch(tr);

    const after = pids(editor);
    // eslint-disable-next-line no-console
    console.log('D AFTER:', JSON.stringify(after));
    // eslint-disable-next-line no-console
    console.log('D betaPidBefore', betaPidBefore);
    editor.destroy();
  });
});

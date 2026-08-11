import { useCallback, useEffect, useState, type RefObject } from 'react';
import { posToDOMRect, type Editor } from '@tiptap/core';
import { closeHistory } from '@tiptap/pm/history';
import { toast } from '@/stores/toasts';
import { PrivacyConfirm } from '@/features/generate/PrivacyConfirm';
import { getAiSettings, resolveProvider } from '@/services/ai/settings';
import {
  MIN_REWRITE_WORDS,
  REWRITE_OPS,
  countSelectionWords,
  type RewriteOp,
  type RewriteTweaks,
} from '@/services/ai/prompts/rewrite';
import {
  buildRewriteRequest,
  checkPastedRewrite,
  runRewrite,
  type RewriteDraft,
} from './useRewrite';
import { proseToParagraphs } from './useBeatExpansion';
import { swallowEditorKeys } from './swallow';

const ISSUE_GLYPH: Record<string, string> = {
  contradiction: '⚠',
  change: '↻',
  introduction: '＋',
};

const POV_CHOICES = ['third limited', 'third omniscient', 'first person', 'second person'];

interface Anchor {
  from: number;
  to: number;
  text: string;
  top: number;
  left: number;
  place: 'above' | 'below';
}

/** Roughly how much room the bubble needs above a selection before it can
 * sit there. Below this it flips underneath, because a popover anchored to
 * the first line of a chapter would otherwise render off the top of the
 * canvas and under the chapter header. */
const ROOM_ABOVE = 160;
/** Keeps the horizontally-centred bubble inside the canvas near an edge. */
const EDGE_MARGIN = 190;

/** Expand · Rephrase · Shorten, on a selection.
 *
 * Positioned by hand rather than with `BubbleMenu`. That component moved to
 * `@tiptap/react/menus` in v3 and pulls `@floating-ui/dom` into the bundle
 * for one popover — a runtime dependency this repo does not take — and it
 * mounts per-editor as a plugin, which fights the typewriter scrolling that
 * lands in the next step. `posToDOMRect` is exported from core and gives
 * **viewport** coordinates, so the canvas rect is subtracted and its scroll
 * offset added back.
 *
 * Like a beat, this is never a dead control: with no provider the three AI
 * actions are absent from the tree entirely and Copy prompt does the whole
 * job through the clipboard. */
export function RewriteBubble({
  editor,
  projectId,
  sceneId,
  canvasRef,
  flush,
}: {
  editor: Editor;
  projectId: string;
  sceneId: string | null;
  canvasRef: RefObject<HTMLDivElement | null>;
  flush: () => Promise<void>;
}) {
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [op, setOp] = useState<RewriteOp>('rephrase');
  const [tweaks, setTweaks] = useState<RewriteTweaks>({});
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<RewriteDraft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [promptText, setPromptText] = useState('');
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [aiReady, setAiReady] = useState(false);

  useEffect(() => {
    void resolveProvider(projectId).then((c) => setAiReady(!!c));
  }, [projectId]);

  /** Recompute from the live selection. Held open while a draft is on
   * screen: clicking a control blurs the editor, and a bubble that
   * disappeared as you reached for Apply would be unusable. */
  const sync = useCallback(() => {
    if (draft || busy || pasteOpen || confirming) return;
    const { from, to, empty } = editor.state.selection;
    const canvas = canvasRef.current;
    if (empty || !canvas) {
      setAnchor(null);
      return;
    }
    const text = editor.state.doc.textBetween(from, to, ' ', ' ');
    if (countSelectionWords(text) < MIN_REWRITE_WORDS) {
      setAnchor(null);
      return;
    }
    // `posToDOMRect` returns VIEWPORT coordinates and the bubble is
    // positioned inside the scrolling canvas, so the canvas rect comes off
    // and its scroll offset goes back on.
    const rect = posToDOMRect(editor.view, from, to);
    const box = canvas.getBoundingClientRect();
    const place = rect.top - box.top < ROOM_ABOVE ? 'below' : 'above';
    const centre = rect.left - box.left + rect.width / 2;
    setAnchor({
      from,
      to,
      text,
      top: (place === 'above' ? rect.top : rect.bottom) - box.top + canvas.scrollTop,
      left: Math.min(Math.max(centre, EDGE_MARGIN), Math.max(EDGE_MARGIN, box.width - EDGE_MARGIN)),
      place,
    });
  }, [editor, canvasRef, draft, busy, pasteOpen, confirming]);

  useEffect(() => {
    editor.on('selectionUpdate', sync);
    editor.on('transaction', sync);
    return () => {
      editor.off('selectionUpdate', sync);
      editor.off('transaction', sync);
    };
  }, [editor, sync]);

  const close = () => {
    setAnchor(null);
    setDraft(null);
    setPasteOpen(false);
    setPasted('');
    setConfirming(false);
  };

  if (!anchor) return null;

  /** The prose before the selection, read from the live document — the
   * author may have typed a sentence a moment ago that is still in the
   * autosave debounce. */
  const precedingProse = () => editor.state.doc.textBetween(0, anchor.from, '\n\n', ' ');

  // The chosen operation travels as an argument rather than being read
  // back from state: clicking "Expand" calls setOp and then runs, and
  // `setOp` has not landed by the time the handler reads it.
  const request = (chosen: RewriteOp) => ({
    projectId,
    sceneId: sceneId ?? '',
    selection: anchor.text,
    op: chosen,
    tweaks: chosen === 'rephrase' ? tweaks : {},
    precedingProse: precedingProse(),
  });

  const guard = (): boolean => {
    if (!sceneId) {
      toast('Still loading this scene — try again in a moment.', {});
      return false;
    }
    return true;
  };

  const run = async (chosen: RewriteOp) => {
    if (!guard()) return;
    setBusy(true);
    setConfirming(false);
    try {
      setDraft(await runRewrite({ ...request(chosen), flush }));
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not rewrite that.', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onRun = async (chosen: RewriteOp) => {
    if (!guard()) return;
    const settings = await getAiSettings(projectId);
    if (settings.privacy === 'ask') setConfirming(true);
    else void run(chosen);
  };

  const copyPrompt = async () => {
    if (!guard()) return;
    const { prompt } = await buildRewriteRequest(request(op));
    setPromptText(prompt);
    setPasteOpen(true);
    try {
      await navigator.clipboard.writeText(prompt);
      toast('Prompt copied — run it anywhere, then paste the rewrite back here.', {
        kind: 'success',
      });
    } catch {
      toast('Select and copy the prompt below, then paste the rewrite back here.', {});
    }
  };

  const takePasted = async () => {
    if (!pasted.trim()) return;
    setDraft(await checkPastedRewrite(projectId, anchor.text, pasted));
    setPasteOpen(false);
    setPasted('');
  };

  /** Replace the selection, in one transaction so it is one undo and one
   * save. A single-paragraph rewrite goes in as text — inserting paragraph
   * nodes there would split the block the selection sat inside. */
  const apply = () => {
    if (!draft) return;
    const content = draft.prose.includes('\n\n')
      ? proseToParagraphs(draft.prose)
      : draft.prose.replace(/\s*\n\s*/g, ' ').trim();
    editor
      .chain()
      .command(({ tr }) => {
        closeHistory(tr);
        return true;
      })
      .insertContentAt({ from: anchor.from, to: anchor.to }, content, { updateSelection: false })
      .run();
    close();
  };

  return (
    <div
      className="lw-rewrite"
      data-testid="rewrite-bubble"
      data-place={anchor.place}
      // Custom properties rather than `top`/`left` directly: the phone
      // layout pins the bubble to the bottom of the screen, and an inline
      // `top` would beat that media query outright.
      style={
        {
          '--rewrite-top': `${anchor.top}px`,
          '--rewrite-left': `${anchor.left}px`,
        } as React.CSSProperties
      }
      contentEditable={false}
      {...swallowEditorKeys}
    >
      <div className="lw-rewrite__bar">
        {aiReady
          ? REWRITE_OPS.map((o) => (
              <button
                key={o.id}
                type="button"
                className={o.id === op ? 'lw-btn lw-btn--sm lw-btn--primary' : 'lw-btn lw-btn--sm'}
                title={o.hint}
                disabled={busy}
                onClick={() => {
                  setOp(o.id);
                  void onRun(o.id);
                }}
              >
                {busy && o.id === op ? 'Writing…' : o.label}
              </button>
            ))
          : /* Without a provider the three buttons are absent from the tree
               entirely — the convention `09-ai.spec.ts` set — and the same
               three operations are chosen here instead, for the prompt the
               author will run somewhere else. */
            (
              <label className="lw-rewrite__control">
                <span className="lw-visually-hidden">Rewrite as</span>
                <select
                  className="lw-input lw-input--sm"
                  value={op}
                  onChange={(e) => setOp(e.target.value as RewriteOp)}
                >
                  {REWRITE_OPS.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
        {/* Present with or without a key, exactly as a beat's is. Without a
            provider it is the whole feature. */}
        <button type="button" className="lw-btn lw-btn--sm" onClick={() => void copyPrompt()}>
          Copy prompt
        </button>
        <button
          type="button"
          className="lw-iconbtn"
          aria-label="Close rewrite"
          onClick={close}
        >
          ×
        </button>
      </div>

      {op === 'rephrase' ? (
        <div className="lw-rewrite__tweaks">
          <label className="lw-rewrite__control">
            <span className="lw-visually-hidden">Change POV</span>
            <select
              className="lw-input lw-input--sm"
              value={tweaks.pov ?? ''}
              onChange={(e) => setTweaks((t) => ({ ...t, pov: e.target.value || null }))}
            >
              <option value="">Keep POV</option>
              {POV_CHOICES.map((pov) => (
                <option key={pov} value={pov}>
                  {pov}
                </option>
              ))}
            </select>
          </label>
          <label className="lw-rewrite__control">
            <span className="lw-visually-hidden">Change tense</span>
            <select
              className="lw-input lw-input--sm"
              value={tweaks.tense ?? ''}
              onChange={(e) =>
                setTweaks((t) => ({ ...t, tense: (e.target.value || null) as RewriteTweaks['tense'] }))
              }
            >
              <option value="">Keep tense</option>
              <option value="past">past</option>
              <option value="present">present</option>
            </select>
          </label>
          <label className="lw-rewrite__toggle">
            <input
              type="checkbox"
              checked={!!tweaks.toDialogue}
              onChange={(e) => setTweaks((t) => ({ ...t, toDialogue: e.target.checked }))}
            />
            <span>As dialogue</span>
          </label>
        </div>
      ) : null}

      {confirming ? (
        <PrivacyConfirm
          projectId={projectId}
          note="This sends the selected passage, the prose before it, and the entities in this scene to your configured provider."
          onRun={() => void run(op)}
          onCancel={() => setConfirming(false)}
        />
      ) : null}

      {pasteOpen ? (
        <div className="lw-rewrite__paste">
          <textarea
            className="lw-input lw-input--area"
            rows={4}
            readOnly
            aria-label="Rewrite prompt to send"
            value={promptText}
          />
          <textarea
            className="lw-input lw-input--area"
            rows={4}
            aria-label="Pasted rewrite"
            placeholder="Paste the rewritten passage…"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <div className="lw-rewrite__actions">
            <button
              type="button"
              className="lw-btn lw-btn--sm lw-btn--primary"
              disabled={!pasted.trim()}
              onClick={() => void takePasted()}
            >
              Use this
            </button>
            <button type="button" className="lw-btn lw-btn--sm" onClick={() => setPasteOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="lw-rewrite__draft" data-testid="rewrite-draft">
          {draft.truncated ? (
            <p className="lw-fieldnote lw-fieldnote--error">
              The model stopped mid-flow — this is cut off. Try again, or select less.
            </p>
          ) : null}
          {draft.lostNames.length ? (
            <p className="lw-fieldnote lw-fieldnote--error">
              Missing from the rewrite: {draft.lostNames.join(', ')}. Read it before you apply.
            </p>
          ) : null}
          <div className="lw-rewrite__prose">
            {draft.prose.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {draft.issues.length ? (
            <ul className="lw-compose__issues">
              {draft.issues.map((issue, i) => (
                <li key={i} className={`lw-compose__issue lw-compose__issue--${issue.kind}`}>
                  <span aria-hidden>{ISSUE_GLYPH[issue.kind]}</span> {issue.message}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="lw-rewrite__actions">
            <button type="button" className="lw-btn lw-btn--sm lw-btn--primary" onClick={apply}>
              Apply
            </button>
            {aiReady ? (
              <button
                type="button"
                className="lw-btn lw-btn--sm"
                disabled={busy}
                onClick={() => void run(op)}
              >
                Retry
              </button>
            ) : null}
            <button type="button" className="lw-btn lw-btn--sm" onClick={() => setDraft(null)}>
              Discard
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

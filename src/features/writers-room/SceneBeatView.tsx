import { useEffect, useState } from 'react';
import { NodeViewContent, NodeViewWrapper, type ReactNodeViewProps } from '@tiptap/react';
import { closeHistory } from '@tiptap/pm/history';
import { BEAT_MODES, type BeatMode } from '@/services/ai/prompts/beat';
import type { SceneBeatStorage } from './scene-beat';
import { swallowEditorKeys } from './swallow';
import { toast } from '@/stores/toasts';
import { PrivacyConfirm } from '@/features/generate/PrivacyConfirm';
import { getAiSettings, resolveProvider } from '@/services/ai/settings';
import {
  buildBeatRequest,
  checkPastedBeat,
  expandBeat,
  proseToParagraphs,
  type BeatDraft,
} from './useBeatExpansion';

const ISSUE_GLYPH: Record<string, string> = {
  contradiction: '⚠',
  change: '↻',
  introduction: '＋',
};

/** The beat, as the author sees it: an instruction they can type into,
 * with the controls for turning it into prose attached to it rather than
 * parked in a side panel.
 *
 * Everything transient lives here in React state. Nothing about a
 * generation-in-progress touches the document, so a beat cannot flood
 * autosave or fill the undo stack — only Apply writes. */
export function SceneBeatView({ node, editor, getPos, updateAttributes }: ReactNodeViewProps) {
  const mode = (node.attrs.mode ?? 'prose') as BeatMode;
  const words = Number(node.attrs.words ?? 400);
  const expanded = node.attrs.state === 'expanded';

  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<BeatDraft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [promptText, setPromptText] = useState('');
  const [aiReady, setAiReady] = useState(false);

  const storage = editor.storage.sceneBeat as SceneBeatStorage | undefined;
  const projectId = storage?.projectId ?? null;
  const sceneId = storage?.sceneId ?? null;

  useEffect(() => {
    if (projectId) void resolveProvider(projectId).then((c) => setAiReady(!!c));
  }, [projectId]);

  const beatText = node.textContent.trim();

  /** The prose above this beat, for voice and continuity. Read from the
   * live document rather than the database — the author may have typed a
   * sentence a moment ago that has not been saved yet. */
  const precedingProse = (): string => {
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos == null) return '';
    return editor.state.doc.textBetween(0, pos, '\n\n', ' ');
  };

  const guard = (): boolean => {
    if (!projectId || !sceneId) {
      toast('Still loading this scene — try again in a moment.', {});
      return false;
    }
    if (!beatText) {
      toast('Write what should happen in this beat first.', {});
      return false;
    }
    return true;
  };

  const run = async () => {
    if (!guard() || !projectId || !sceneId) return;
    setBusy(true);
    setConfirming(false);
    try {
      setDraft(
        await expandBeat({
          projectId,
          sceneId,
          beat: beatText,
          mode,
          targetWords: words,
          precedingProse: precedingProse(),
          flush: storage?.flush ?? (async () => {}),
        })
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not expand this beat.', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const onExpand = async () => {
    if (!guard() || !projectId) return;
    const settings = await getAiSettings(projectId);
    if (settings.privacy === 'ask') setConfirming(true);
    else void run();
  };

  const copyPrompt = async () => {
    if (!guard() || !projectId || !sceneId) return;
    const { prompt } = await buildBeatRequest({
      projectId,
      sceneId,
      beat: beatText,
      mode,
      targetWords: words,
      precedingProse: precedingProse(),
    });
    setPromptText(prompt);
    setPasteOpen(true);
    // The clipboard can refuse — an unfocused document, a locked-down
    // browser, a permission the user never granted. That must not strand
    // anyone, so the prompt is shown as selectable text either way and the
    // copy is only ever a convenience.
    try {
      await navigator.clipboard.writeText(prompt);
      toast('Prompt copied — run it anywhere, then paste the prose back here.', {
        kind: 'success',
      });
    } catch {
      toast('Select and copy the prompt below, then paste the prose back here.', {});
    }
  };

  const takePasted = async () => {
    if (!projectId || !pasted.trim()) return;
    setDraft({
      prose: pasted.trim(),
      issues: await checkPastedBeat(projectId, pasted),
      truncated: false,
    });
    setPasteOpen(false);
    setPasted('');
  };

  /** One chain, so the insert and the state flip are a single transaction:
   * one undo step, and one save rather than two.
   *
   * Deliberately does NOT call `.focus()` and passes `updateSelection:
   * false`. Clicking a node-view button has already blurred the editor;
   * re-focusing would scroll the caret into view and, on a phone, raise
   * the keyboard over the prose the author is trying to read. */
  const apply = () => {
    if (!draft) return;
    const pos = typeof getPos === 'function' ? getPos() : null;
    if (pos == null) return;
    // The beat may have been deleted while the model was writing.
    const live = editor.state.doc.nodeAt(pos);
    if (!live || live.type.name !== 'sceneBeat') {
      toast('That beat is gone — the prose was not inserted.', { kind: 'error' });
      setDraft(null);
      return;
    }
    const after = pos + live.nodeSize;
    editor
      .chain()
      .command(({ tr }) => {
        // Its own undo event, so Apply is never merged into the keystrokes
        // before it by prosemirror-history's grouping window.
        closeHistory(tr);
        return true;
      })
      .insertContentAt(after, proseToParagraphs(draft.prose), { updateSelection: false })
      .command(({ tr }) => {
        tr.setNodeAttribute(tr.mapping.map(pos), 'state', 'expanded');
        return true;
      })
      .run();
    setDraft(null);
  };

  return (
    <NodeViewWrapper
      className={expanded ? 'lw-beat lw-beat--expanded' : 'lw-beat'}
      data-testid="scene-beat"
    >
      <div className="lw-beat__bar" contentEditable={false} {...swallowEditorKeys}>
        <span className="lw-beat__tag" aria-hidden>
          Beat
        </span>
        <label className="lw-beat__control">
          <span className="lw-visually-hidden">Beat style</span>
          <select
            className="lw-input lw-input--sm"
            value={mode}
            onChange={(e) => updateAttributes({ mode: e.target.value })}
          >
            {BEAT_MODES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="lw-beat__control">
          <span className="lw-visually-hidden">Target words</span>
          <input
            className="lw-input lw-input--sm lw-beat__words"
            type="number"
            min={50}
            max={1200}
            step={50}
            value={words}
            onChange={(e) => updateAttributes({ words: Number(e.target.value) || 400 })}
          />
        </label>
        <span className="lw-beat__spacer" />
        {/* Copy prompt is always here, key or no key. With a provider it is
            a choice — spend your own subscription instead of this one.
            Without, it is the whole feature, and the reason a beat is never
            a dead button. */}
        <button
          type="button"
          className="lw-btn lw-btn--sm"
          onClick={() => void copyPrompt()}
        >
          Copy prompt
        </button>
        {aiReady ? (
          <button
            type="button"
            className="lw-btn lw-btn--sm lw-btn--primary"
            disabled={busy}
            onClick={() => void onExpand()}
          >
            {busy ? 'Writing…' : expanded ? 'Write again' : 'Expand'}
          </button>
        ) : null}
      </div>

      <NodeViewContent className="lw-beat__text" />

      {confirming ? (
        <div contentEditable={false} {...swallowEditorKeys}>
          <PrivacyConfirm
            projectId={projectId ?? ''}
            note="This sends the beat, the prose before it, and the entities in this scene to your configured provider."
            onRun={() => void run()}
            onCancel={() => setConfirming(false)}
          />
        </div>
      ) : null}

      {pasteOpen ? (
        <div className="lw-beat__paste" contentEditable={false} {...swallowEditorKeys}>
          <textarea
            className="lw-input lw-input--area lw-beat__prompt"
            rows={4}
            readOnly
            aria-label="Prompt to send"
            value={promptText}
          />
          <textarea
            className="lw-input lw-input--area"
            rows={5}
            aria-label="Pasted beat prose"
            placeholder="Paste the prose your AI wrote…"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
          />
          <div className="lw-beat__actions">
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
        <div className="lw-beat__draft" contentEditable={false} {...swallowEditorKeys} data-testid="beat-draft">
          {draft.truncated ? (
            <p className="lw-fieldnote lw-fieldnote--error">
              The model stopped mid-flow — this is cut off. Expand again, or lower the target.
            </p>
          ) : null}
          <div className="lw-beat__prose">
            {draft.prose.split(/\n{2,}/).map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {draft.issues.length ? (
            <ul className="lw-compose__issues">
              {draft.issues.map((issue, i) => (
                <li key={i} className={`lw-compose__issue lw-compose__issue--${issue.kind}`}>
                  <span aria-hidden>{ISSUE_GLYPH[issue.kind]}</span> {issue.message}
                  {issue.quote ? (
                    <span className="lw-compose__issuequote">“{issue.quote}”</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="lw-beat__actions">
            <button type="button" className="lw-btn lw-btn--sm lw-btn--primary" onClick={apply}>
              Apply
            </button>
            {aiReady ? (
              <button
                type="button"
                className="lw-btn lw-btn--sm"
                disabled={busy}
                onClick={() => void run()}
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
    </NodeViewWrapper>
  );
}

import { useEffect, useState } from 'react';
import { db } from '@/db/schema';
import { complete } from '@/services/ai/providers';
import { getAiSettings, resolveProvider } from '@/services/ai/settings';
import { loadKnownEntities } from '@/services/generate/known';
import { THEMES } from '@/services/generate/random/packs/lexicon';
import { buildGenerationPrompt, parseWireBundle, type WireContext } from '@/services/generate/wire';
import type { GenerationBundle, GenerationRequest } from '@/services/generate/types';
import type { GenerationDialogTarget } from '@/stores/generation';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';
import { PrivacyConfirm } from './PrivacyConfirm';

const GENERATION_SYSTEM =
  'You are a worldbuilding assistant inside the Loomwright writing app. ' +
  'You return ONLY a single JSON object matching the requested shape — no prose, no markdown fences, no commentary.';

/** In-app AI generation: type what you want, the configured provider
 * returns wire JSON, and the result stages exactly like a paste. */
export function AiTab({
  projectId,
  target,
  onDeliver,
  onCancel,
}: {
  projectId: string;
  target: GenerationDialogTarget;
  onDeliver: (bundle: GenerationBundle) => void;
  onCancel: () => void;
}) {
  const isTreeKind = target.kind === 'skilltree' || target.kind === 'skilltree-branch';
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [ask, setAsk] = useState('');
  const [theme, setTheme] = useState('any');
  const [count, setCount] = useState(isTreeKind ? 12 : 1);
  const [confirming, setConfirming] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [rawReply, setRawReply] = useState('');
  const [error, setError] = useState('');
  const setRoute = useUiStore((s) => s.setRoute);

  useEffect(() => {
    void resolveProvider(projectId).then((c) => setAiReady(!!c));
  }, [projectId]);

  const requestOf = (): GenerationRequest => ({
    kind: isTreeKind ? target.kind : count > 1 ? 'entity-batch' : target.kind,
    entityType: target.entityType,
    theme: theme === 'any' ? undefined : theme,
    hint: ask.trim() || undefined,
    count,
    targetGraphId: target.targetGraphId,
    contextRefs: target.contextRefs,
  });

  const run = async () => {
    setGenerating(true);
    setError('');
    setRawReply('');
    try {
      const config = await resolveProvider(projectId);
      if (!config) return;
      const known = await loadKnownEntities(projectId);
      const wireCtx: WireContext = {
        projectId,
        known,
        tree: target.targetGraphId ? await db.skillTrees.get(target.targetGraphId) : undefined,
      };
      const prompt = buildGenerationPrompt(requestOf(), wireCtx);
      const reply = await complete(config, { system: GENERATION_SYSTEM, prompt, maxTokens: 4000 });
      const result = parseWireBundle(reply, requestOf(), wireCtx, 'ai');
      if ('error' in result) {
        setError(result.error);
        setRawReply(reply);
        return;
      }
      onDeliver(result.bundle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The AI call failed.');
    } finally {
      setGenerating(false);
    }
  };

  const start = async () => {
    if (!ask.trim()) {
      toast('Describe what you want first.', { kind: 'error' });
      return;
    }
    const settings = await getAiSettings(projectId);
    if (settings.privacy === 'ask') {
      setConfirming(true);
      return;
    }
    await run();
  };

  if (aiReady === null) return null;
  if (!aiReady) {
    return (
      <div className="lw-gentab" data-testid="ai-tab">
        <p className="lw-fieldnote">
          In-app AI generation needs a configured provider (bring your own key, or a local
          Ollama). Until then, the Paste JSON tab works with any external AI for free.
        </p>
        <div className="lw-chips__add">
          <button
            type="button"
            className="lw-btn lw-btn--primary"
            onClick={() => {
              onCancel();
              setRoute('settings');
            }}
          >
            Configure AI in Settings
          </button>
          <button type="button" className="lw-btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lw-gentab" data-testid="ai-tab">
      <p className="lw-fieldnote">
        Describe exactly what you want — the AI builds it, then it lands in the editor (or stages
        on the canvas) for you to tweak and accept.
      </p>
      <div className="lw-genopts">
        <label className="lw-field__label" htmlFor="ai-ask">
          What do you want?
        </label>
        <textarea
          id="ai-ask"
          className="lw-input"
          rows={3}
          placeholder={
            isTreeKind
              ? 'e.g. "a poison-themed skill tree for my assassin — 12 skills, 3 branches"'
              : 'e.g. "a disgraced court physician hiding a royal secret"'
          }
          value={ask}
          onChange={(e) => setAsk(e.target.value)}
        />
        <label className="lw-field__label" htmlFor="ai-theme">
          Theme
        </label>
        <select id="ai-theme" className="lw-input" value={theme} onChange={(e) => setTheme(e.target.value)}>
          <option value="any">Let the AI decide</option>
          {THEMES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <label className="lw-field__label" htmlFor="ai-count">
          {isTreeKind ? 'How many skills' : 'How many'}
        </label>
        <input
          id="ai-count"
          className="lw-input"
          type="number"
          min={1}
          max={isTreeKind ? 40 : 24}
          value={count}
          onChange={(e) =>
            setCount(Math.max(1, Math.min(isTreeKind ? 40 : 24, Number(e.target.value) || 1)))
          }
        />
      </div>
      {confirming ? (
        <PrivacyConfirm
          projectId={projectId}
          note="This sends your request (plus existing entry names for context) to your configured provider. Continue?"
          onRun={async () => {
            setConfirming(false);
            await run();
          }}
          onCancel={() => setConfirming(false)}
        />
      ) : null}
      {error ? (
        <div className="lw-card lw-genpreview">
          <p className="lw-fieldnote lw-fieldnote--error">{error}</p>
          {rawReply ? (
            <details>
              <summary className="lw-fieldnote">Show the raw reply</summary>
              <pre className="lw-genraw">{rawReply.slice(0, 4000)}</pre>
            </details>
          ) : null}
          <p className="lw-fieldnote">
            You can retry, or copy the reply into the Paste JSON tab after fixing it by hand.
          </p>
        </div>
      ) : null}
      <div className="lw-chips__add">
        <button
          type="button"
          className="lw-btn lw-btn--primary"
          disabled={generating || confirming}
          onClick={() => void start()}
        >
          {generating ? 'Generating…' : error ? 'Retry' : '✨ Generate'}
        </button>
        <button type="button" className="lw-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

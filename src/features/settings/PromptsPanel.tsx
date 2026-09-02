import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import {
  exportPrompts,
  importPrompts,
  listPrompts,
  resetPrompt,
  savePrompt,
} from '@/db/repos/prompts';
import type { PromptTemplate, Scene } from '@/db/types';
import { KIND_LABELS, KIND_TOKENS } from '@/services/prompts/builtins';
import { resolvePrompt, type PromptScope } from '@/services/prompts/resolve';
import { codexScope } from '@/services/prompts/apply';
import { buildSceneContext } from '@/services/context/scene-context';
import { storySoFar, storyToCome } from '@/services/context/story-so-far';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';

/**
 * The prompts the app sends, as text the author can edit.
 *
 * Two fields, and the labels say exactly what each one does, because the
 * one thing worse than no prompt editor is one whose changes go nowhere.
 * A **test run** resolves the template against the author's real current
 * scene and shows the result, so a variable that does not exist is visible
 * before it reaches a model rather than after.
 *
 * Builtins are copy-on-write: editing one writes a project copy and leaves
 * the shipped row alone, so "reset to default" is a promise the app can
 * always keep.
 */
export function PromptsPanel() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const prompts = useLiveQuery(
    () => (projectId ? listPrompts(projectId) : Promise.resolve([])),
    [projectId]
  );
  const rows = prompts ?? [];

  const [openId, setOpenId] = useState<string | null>(null);
  const open = rows.find((p) => p.id === openId) ?? null;
  const [name, setName] = useState('');
  const [system, setSystem] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [importing, setImporting] = useState('');

  useEffect(() => {
    if (!open) return;
    setName(open.name);
    setSystem(open.system);
    setBody(open.body);
    setPreview(null);
  }, [open?.id]);

  const dirty = !!open && (name !== open.name || system !== open.system || body !== open.body);

  const save = async () => {
    if (!open || !projectId) return;
    const saved = await savePrompt(projectId, open, { name, system, body });
    setOpenId(saved.id);
    toast(
      open.builtin === 1
        ? 'Saved as your own copy. The shipped prompt is still there under Reset.'
        : 'Saved.',
      { kind: 'success' }
    );
  };

  /**
   * Resolve against the author's real project, not a fixture.
   *
   * The point of the test run is to answer "what will this actually send",
   * and a preview built from invented data answers a different question.
   */
  const testRun = async (template: PromptTemplate) => {
    if (!projectId) return;
    const scenes = await db.scenes.where('projectId').equals(projectId).toArray();
    const scene: Scene | undefined = scenes.sort((a, b) => a.globalOrder - b.globalOrder)[0];
    const context = scene ? await buildSceneContext(projectId, scene) : null;
    const scope: PromptScope = {
      scene: scene
        ? { title: scene.title, summary: scene.summary, labels: scene.labels, pov: scene.pov }
        : {},
      selection: '(the passage you have selected)',
      precedingProse: '(the prose just before the caret)',
      beat: '(your beat instruction)',
      targetWords: 400,
      context: context?.text ?? '',
      storySoFar: storySoFar(scenes, scene?.globalOrder ?? 0),
      storyToCome: storyToCome(scenes, scene?.globalOrder ?? 0),
      inputs: Object.fromEntries(template.inputs.map((i) => [i.name, i.default ?? `(${i.label})`])),
      ...(await codexScope(projectId)),
    };
    const sys = resolvePrompt(system, scope);
    const extra = resolvePrompt(body, scope);
    const unknown = [...new Set([...sys.unknown, ...extra.unknown])];
    setPreview(
      [
        'SYSTEM:',
        sys.text.trim() || '(the built-in system message)',
        '',
        'EXTRA INSTRUCTIONS:',
        extra.text.trim() || '(none — the built prompt is sent unchanged)',
        unknown.length
          ? `\nUNRECOGNISED VARIABLES: ${unknown.join(' ')} — these are sent as written.`
          : '',
      ].join('\n')
    );
  };

  if (!projectId) return null;

  return (
    <section className="lw-card" data-testid="settings-prompts">
      <h2 className="lw-card__title">Prompts</h2>
      <p className="lw-fieldnote">
        Every prompt the app sends, as text you can change. Edits apply to the in-app call and
        to the copy-and-paste path alike — the offline route is the same prompt, run
        somewhere else.
      </p>

      <ul className="lw-prompts">
        {rows.map((template) => (
          <li key={template.id} className="lw-prompt">
            <button
              type="button"
              className="lw-prompt__open"
              aria-expanded={openId === template.id}
              onClick={() => setOpenId((id) => (id === template.id ? null : template.id))}
            >
              <span className="lw-prompt__name">{template.name}</span>
              <span className="lw-prompt__kind">{KIND_LABELS[template.kind]}</span>
              <span className="lw-prompt__badge">
                {template.builtin === 1 ? 'default' : 'edited'}
              </span>
            </button>

            {openId === template.id ? (
              <div className="lw-prompt__editor">
                <div className="lw-field lw-field--full">
                  <label htmlFor={`p-name-${template.id}`}>Name</label>
                  <input
                    id={`p-name-${template.id}`}
                    className="lw-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="lw-field lw-field--full">
                  <label htmlFor={`p-system-${template.id}`}>How the model should behave</label>
                  <textarea
                    id={`p-system-${template.id}`}
                    className="lw-input lw-input--area"
                    rows={4}
                    value={system}
                    onChange={(e) => setSystem(e.target.value)}
                  />
                  <p className="lw-fieldnote">Replaces the built-in system message entirely.</p>
                </div>

                <div className="lw-field lw-field--full">
                  <label htmlFor={`p-body-${template.id}`}>Extra instructions</label>
                  <textarea
                    id={`p-body-${template.id}`}
                    className="lw-input lw-input--area"
                    rows={4}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />
                  <p className="lw-fieldnote">
                    Added to the end of the prompt, after the context and the canon. Leave it
                    empty and nothing changes.
                  </p>
                </div>

                <p className="lw-fieldnote">
                  Variables you can use here: {KIND_TOKENS[template.kind].join(' ')}
                </p>

                <div className="lw-chips__add">
                  <button
                    type="button"
                    className="lw-btn lw-btn--primary lw-btn--sm"
                    disabled={!dirty}
                    onClick={() => void save()}
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn--sm"
                    onClick={() => void testRun(template)}
                  >
                    Test run
                  </button>
                  {template.builtin === 0 ? (
                    <button
                      type="button"
                      className="lw-btn lw-btn--sm lw-btn--ghost"
                      onClick={() => {
                        void resetPrompt(projectId, template.slug).then(() => {
                          setOpenId(null);
                          toast('Back to the prompt Loomwright ships with.');
                        });
                      }}
                    >
                      Reset to default
                    </button>
                  ) : null}
                </div>

                {preview ? (
                  <pre className="lw-prompt__preview" data-testid="prompt-preview">
                    {preview}
                  </pre>
                ) : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="lw-field lw-field--full">
        <span className="lw-tweak__label">Share prompts</span>
        <div className="lw-chips__add">
          <button
            type="button"
            className="lw-btn lw-btn--sm"
            onClick={() => {
              const text = exportPrompts(rows);
              setImporting(text);
              void navigator.clipboard
                .writeText(text)
                .then(() => toast('Prompts copied.', { kind: 'success' }))
                .catch(() => toast('Select and copy the text below.'));
            }}
          >
            Copy all as JSON
          </button>
          <button
            type="button"
            className="lw-btn lw-btn--sm"
            disabled={!importing.trim()}
            onClick={() => {
              void importPrompts(projectId, importing).then((result) => {
                if ('error' in result) {
                  toast(result.error, { kind: 'error' });
                  return;
                }
                setImporting('');
                toast(
                  result.skipped.length
                    ? `${result.imported} imported. Skipped: ${result.skipped.join(', ')}.`
                    : `${result.imported} prompt${result.imported === 1 ? '' : 's'} imported.`,
                  { kind: 'success' }
                );
              });
            }}
          >
            Import from JSON
          </button>
        </div>
        <label htmlFor="prompt-json" className="lw-visually-hidden">
          Prompts as JSON
        </label>
        <textarea
          id="prompt-json"
          className="lw-input lw-input--area"
          rows={4}
          placeholder="Paste an export here, or press Copy all as JSON."
          value={importing}
          onChange={(e) => setImporting(e.target.value)}
        />
      </div>
    </section>
  );
}

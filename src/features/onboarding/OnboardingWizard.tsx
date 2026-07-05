import { useEffect, useRef, useState } from 'react';
import {
  applyOnboarding,
  clearOnboardingDraft,
  loadOnboardingDraft,
  saveOnboardingDraft,
  EMPTY_ANSWERS,
  type OnboardingAnswers,
} from '@/services/onboarding';
import { splitManuscript } from '@/services/manuscript-import';
import { analyzeStyle } from '@/services/style-analysis';
import { buildOnboardingPrompt, parseOnboardingReply } from '@/services/onboarding-ai';
import { discoverEntities } from '@/services/extraction/discovery';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';

const GENRES = ['Fantasy', 'Science fiction', 'Historical', 'Mystery', 'Romance', 'Thriller', 'Literary', 'Horror'];
const TONES = ['Dark', 'Grounded', 'Hopeful', 'Whimsical', 'Epic', 'Intimate'];
const POVS = ['First person', 'Third limited', 'Third omniscient', 'Multiple POV'];
const TENSES = ['Past', 'Present'];
const CAST_ROLES = ['Protagonist', 'Antagonist', 'Ally', 'Mentor', 'Rival', 'Love interest', 'Unknown'];
const PLACE_KINDS = ['City', 'Town', 'Village', 'Fortress', 'Port', 'Forest', 'Mountain Pass', 'Ruins', 'Building', 'Other'];

const STEPS = [
  { id: 'foundation', title: 'Foundation' },
  { id: 'voice', title: 'Voice & style' },
  { id: 'cast', title: 'Cast' },
  { id: 'world', title: 'World' },
  { id: 'manuscript', title: 'Manuscript' },
  { id: 'ai', title: 'AI & privacy' },
  { id: 'finish', title: 'Open the door' },
] as const;

/** The onboarding interview: seven short steps that genuinely seed the
 * project — foundation, voice analysis, cast/world seeds, manuscript
 * import with auto chapter split + first extraction, AI/privacy. Every
 * answer is consumed; drafts persist so closing loses nothing. */
export function OnboardingWizard({ onClose }: { onClose: () => void }) {
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const setRoute = useUiStore((s) => s.setRoute);

  const [a, setA] = useState<OnboardingAnswers>(EMPTY_ANSWERS);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [themeDraft, setThemeDraft] = useState('');
  const [castText, setCastText] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const loaded = useRef(false);

  // Restore a draft once; persist on every change after that.
  useEffect(() => {
    void loadOnboardingDraft().then((draft) => {
      if (draft) setA({ ...EMPTY_ANSWERS, ...draft, ...coerceLists(draft) });
      loaded.current = true;
    });
  }, []);
  useEffect(() => {
    if (loaded.current) void saveOnboardingDraft(a);
  }, [a]);

  const patch = (p: Partial<OnboardingAnswers>) => setA((prev) => ({ ...prev, ...p }));

  const split = splitManuscript(a.manuscript);
  const canContinue = step === 0 ? a.name.trim().length > 0 : true;

  const finish = async () => {
    setBusy(true);
    try {
      const result = await applyOnboarding(a);
      await clearOnboardingDraft();
      setCurrentProject(result.projectId);
      setRoute('home');
      onClose();
      toast(
        `“${a.name}” is ready — ${result.castCreated} cast, ${result.placesCreated} places, ` +
          `${result.chaptersCreated} chapters` +
          (result.candidatesFound > 0 ? `, ${result.candidatesFound} extraction candidates await review.` : '.'),
        { kind: 'success' }
      );
    } finally {
      setBusy(false);
    }
  };

  const suggestCast = () => {
    const found = discoverEntities(castText, [], { minRecurrence: 1 })
      .filter((c) => c.entityType === 'cast')
      .map((c) => c.name);
    const existing = new Set(a.cast.map((c) => c.name.toLowerCase()));
    const fresh = [...new Set(found)].filter((n) => !existing.has(n.toLowerCase()));
    if (fresh.length === 0) {
      toast('No new character names found in that text.', { kind: 'info' });
      return;
    }
    patch({ cast: [...a.cast, ...fresh.map((name) => ({ name, role: '', note: '' }))] });
    toast(`${fresh.length} character${fresh.length === 1 ? '' : 's'} suggested.`, { kind: 'success' });
  };

  const pills = (options: string[], value: string, onPick: (v: string) => void, name: string) => (
    <div className="lw-ob__pills" role="radiogroup" aria-label={name}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          className={value === o ? 'lw-btn lw-btn--sm lw-btn--primary' : 'lw-btn lw-btn--sm'}
          onClick={() => onPick(value === o ? '' : o)}
        >
          {o}
        </button>
      ))}
    </div>
  );

  // Multi-select variant: pick as many as apply (e.g. Fantasy & Romance).
  const multiPills = (options: string[], values: string[], key: 'genre' | 'tone', name: string) => (
    <div className="lw-ob__pills" role="group" aria-label={name}>
      {options.map((o) => {
        const on = values.includes(o);
        return (
          <button
            key={o}
            type="button"
            role="checkbox"
            aria-checked={on}
            className={on ? 'lw-btn lw-btn--sm lw-btn--primary' : 'lw-btn lw-btn--sm'}
            onClick={() => patch({ [key]: on ? values.filter((v) => v !== o) : [...values, o] })}
          >
            {o}
          </button>
        );
      })}
    </div>
  );

  const copyPrompt = async () => {
    const prompt = buildOnboardingPrompt();
    try {
      await navigator.clipboard.writeText(prompt);
      toast('Prompt copied — paste it into ChatGPT, Claude, or any AI, describe your story, then paste its reply back here.', {
        kind: 'success',
      });
    } catch {
      toast('Copy blocked — select the prompt text below and copy it manually.', { kind: 'info' });
    }
  };

  const fillFromReply = () => {
    const filled = parseOnboardingReply(aiReply);
    if (!filled) {
      toast("Couldn't read that reply — paste the whole answer including its { … } JSON block.", {
        kind: 'error',
      });
      return;
    }
    patch(filled);
    setAiReply('');
    setAiOpen(false);
    toast(`Filled ${Object.keys(filled).length} section${Object.keys(filled).length === 1 ? '' : 's'} from the AI reply — review and tweak anything.`, {
      kind: 'success',
    });
  };

  return (
    <div className="lw-ob-backdrop" role="dialog" aria-label="Project setup" data-testid="onboarding-wizard">
      <div className="lw-ob">
        <aside className="lw-ob__rail">
          <h1 className="lw-ob__brand">Loomwright</h1>
          <ol className="lw-ob__steps">
            {STEPS.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="lw-ob__step"
                  aria-current={i === step ? 'step' : undefined}
                  disabled={i > 0 && !a.name.trim()}
                  onClick={() => setStep(i)}
                >
                  <span className="lw-ob__stepnum">{i + 1}</span> {s.title}
                </button>
              </li>
            ))}
          </ol>
          <button type="button" className="lw-btn lw-btn--sm" onClick={onClose}>
            Close (draft is saved)
          </button>
        </aside>

        <div className="lw-ob__body">
          {step === 0 && (
            <section className="lw-ob__section">
              <h2 className="lw-ob__title">What are we making?</h2>

              <div className="lw-card lw-ob__aicard" data-testid="ob-ai-fill">
                <div className="lw-ob__aihead">
                  <div>
                    <strong>Have AI fill this in</strong>
                    <p className="lw-fieldnote" style={{ margin: 0 }}>
                      Not sure what to put? Copy a prompt, describe your story to any AI
                      (ChatGPT, Claude, a local model), and paste its reply back — it fills
                      the whole interview.
                    </p>
                  </div>
                  <button type="button" className="lw-btn lw-btn--sm" onClick={() => setAiOpen((o) => !o)}>
                    {aiOpen ? 'Hide' : 'Show'}
                  </button>
                </div>
                {aiOpen && (
                  <>
                    <div className="lw-chips__add" style={{ marginTop: 'var(--sp-4)' }}>
                      <button type="button" className="lw-btn" onClick={() => void copyPrompt()}>
                        Copy AI prompt
                      </button>
                    </div>
                    <textarea
                      className="lw-input lw-ob__aiprompt"
                      data-testid="ob-ai-prompt"
                      aria-label="AI prompt"
                      readOnly
                      rows={4}
                      value={buildOnboardingPrompt()}
                    />
                    <label className="lw-field__label" htmlFor="ob-ai-reply">
                      Paste the AI&apos;s reply
                    </label>
                    <textarea
                      id="ob-ai-reply"
                      className="lw-input"
                      aria-label="AI reply"
                      rows={4}
                      placeholder="Paste the whole answer, including its { … } JSON block…"
                      value={aiReply}
                      onChange={(e) => setAiReply(e.target.value)}
                    />
                    <div className="lw-chips__add">
                      <button type="button" className="lw-btn lw-btn--primary" onClick={fillFromReply}>
                        Fill from reply
                      </button>
                    </div>
                  </>
                )}
              </div>

              <label className="lw-field__label" htmlFor="ob-name">Project name *</label>
              <input
                id="ob-name"
                className="lw-input"
                autoFocus
                placeholder="e.g. The Hollow Crown"
                value={a.name}
                onChange={(e) => patch({ name: e.target.value })}
              />
              <label className="lw-field__label">Genre <span className="lw-fieldnote-inline">(pick any that apply)</span></label>
              {multiPills(GENRES, a.genre, 'genre', 'Genre')}
              <label className="lw-field__label" htmlFor="ob-premise">Premise — the story in a few sentences</label>
              <textarea
                id="ob-premise"
                className="lw-input"
                rows={4}
                placeholder="Who wants what, and what stands in the way?"
                value={a.premise}
                onChange={(e) => patch({ premise: e.target.value })}
              />
              <label className="lw-field__label" htmlFor="ob-theme">Themes</label>
              <div className="lw-chips__add">
                <input
                  id="ob-theme"
                  className="lw-input"
                  placeholder="Add a theme and press Enter"
                  value={themeDraft}
                  onChange={(e) => setThemeDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && themeDraft.trim()) {
                      e.preventDefault();
                      patch({ themes: [...a.themes, themeDraft.trim()] });
                      setThemeDraft('');
                    }
                  }}
                />
              </div>
              {a.themes.length > 0 && (
                <div className="lw-ob__pills">
                  {a.themes.map((t) => (
                    <button
                      key={t}
                      type="button"
                      className="lw-btn lw-btn--sm"
                      aria-label={`Remove theme ${t}`}
                      onClick={() => patch({ themes: a.themes.filter((x) => x !== t) })}
                    >
                      {t} ×
                    </button>
                  ))}
                </div>
              )}
              <label className="lw-field__label">Tone <span className="lw-fieldnote-inline">(pick any that apply)</span></label>
              {multiPills(TONES, a.tone, 'tone', 'Tone')}
              <label className="lw-field__label" htmlFor="ob-comp">It&apos;s like… (comparables)</label>
              <input
                id="ob-comp"
                className="lw-input"
                placeholder="e.g. The Goblin Emperor meets Master & Commander"
                value={a.comparables}
                onChange={(e) => patch({ comparables: e.target.value })}
              />
              <label className="lw-field__label" htmlFor="ob-isnot">It is NOT…</label>
              <input
                id="ob-isnot"
                className="lw-input"
                placeholder="e.g. grimdark; a chosen-one story"
                value={a.isNot}
                onChange={(e) => patch({ isNot: e.target.value })}
              />
            </section>
          )}

          {step === 1 && (
            <section className="lw-ob__section">
              <h2 className="lw-ob__title">How does it sound?</h2>
              <label className="lw-field__label">Point of view</label>
              {pills(POVS, a.pov, (pov) => patch({ pov }), 'Point of view')}
              <label className="lw-field__label">Tense</label>
              {pills(TENSES, a.tense, (tense) => patch({ tense }), 'Tense')}
              <label className="lw-field__label" htmlFor="ob-style">
                Paste a sample of your prose (yours, not a favourite author&apos;s)
              </label>
              <textarea
                id="ob-style"
                className="lw-input"
                rows={7}
                placeholder="A page or two is plenty…"
                value={a.styleSample}
                onChange={(e) => patch({ styleSample: e.target.value })}
              />
              <div className="lw-chips__add">
                <button
                  type="button"
                  className="lw-btn"
                  onClick={() => {
                    const profile = analyzeStyle(a.styleSample);
                    patch({ styleProfile: profile });
                    if (!profile) toast('Paste at least a paragraph (20+ words) to analyze.', { kind: 'error' });
                  }}
                >
                  Analyze style
                </button>
              </div>
              {a.styleProfile && (
                <div className="lw-card lw-ob__profile" data-testid="style-profile">
                  <h3 className="lw-card__title">Voice profile (offline analysis)</h3>
                  <ul>
                    {a.styleProfile.notes.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {step === 2 && (
            <section className="lw-ob__section">
              <h2 className="lw-ob__title">Who&apos;s in it?</h2>
              <p className="lw-fieldnote">
                Seed your main cast — each becomes a codex entry. Extraction will find the
                rest as you write.
              </p>
              {a.cast.map((seed, i) => (
                <div key={i} className="lw-ob__seedrow">
                  <input
                    className="lw-input"
                    aria-label={`Character ${i + 1} name`}
                    placeholder="Name"
                    value={seed.name}
                    onChange={(e) =>
                      patch({ cast: a.cast.map((c, j) => (j === i ? { ...c, name: e.target.value } : c)) })
                    }
                  />
                  <select
                    className="lw-input"
                    aria-label={`Character ${i + 1} role`}
                    value={seed.role}
                    onChange={(e) =>
                      patch({ cast: a.cast.map((c, j) => (j === i ? { ...c, role: e.target.value } : c)) })
                    }
                  >
                    <option value="">Role…</option>
                    {CAST_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <input
                    className="lw-input"
                    aria-label={`Character ${i + 1} note`}
                    placeholder="One line about them"
                    value={seed.note}
                    onChange={(e) =>
                      patch({ cast: a.cast.map((c, j) => (j === i ? { ...c, note: e.target.value } : c)) })
                    }
                  />
                  <button
                    type="button"
                    className="lw-iconbtn"
                    aria-label={`Remove character ${i + 1}`}
                    onClick={() => patch({ cast: a.cast.filter((_, j) => j !== i) })}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="lw-btn"
                onClick={() => patch({ cast: [...a.cast, { name: '', role: '', note: '' }] })}
              >
                + Add character
              </button>

              <label className="lw-field__label" htmlFor="ob-casttext" style={{ marginTop: 'var(--sp-6)' }}>
                Or paste some of your text and let the offline scanner suggest names
              </label>
              <textarea
                id="ob-casttext"
                className="lw-input"
                rows={4}
                value={castText}
                onChange={(e) => setCastText(e.target.value)}
              />
              <div className="lw-chips__add">
                <button type="button" className="lw-btn" onClick={suggestCast}>
                  Suggest cast from this text
                </button>
              </div>
            </section>
          )}

          {step === 3 && (
            <section className="lw-ob__section">
              <h2 className="lw-ob__title">Where does it happen?</h2>
              <p className="lw-fieldnote">Seed the places that matter — they land in the Locations codex and the Atlas.</p>
              {a.places.map((seed, i) => (
                <div key={i} className="lw-ob__seedrow lw-ob__seedrow--place">
                  <input
                    className="lw-input"
                    aria-label={`Place ${i + 1} name`}
                    placeholder="Name"
                    value={seed.name}
                    onChange={(e) =>
                      patch({ places: a.places.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)) })
                    }
                  />
                  <select
                    className="lw-input"
                    aria-label={`Place ${i + 1} type`}
                    value={seed.kind}
                    onChange={(e) =>
                      patch({ places: a.places.map((p, j) => (j === i ? { ...p, kind: e.target.value } : p)) })
                    }
                  >
                    <option value="">Type…</option>
                    {PLACE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="lw-iconbtn"
                    aria-label={`Remove place ${i + 1}`}
                    onClick={() => patch({ places: a.places.filter((_, j) => j !== i) })}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="lw-btn"
                onClick={() => patch({ places: [...a.places, { name: '', kind: '' }] })}
              >
                + Add place
              </button>
            </section>
          )}

          {step === 4 && (
            <section className="lw-ob__section">
              <h2 className="lw-ob__title">Already writing?</h2>
              <p className="lw-fieldnote">
                Paste your manuscript (or pick a .txt/.md file). Loomwright splits chapters on
                headings like “Chapter One” or “# The Short Peal”, then the offline extractor
                proposes your world for review — nothing enters the codex silently.
              </p>
              <textarea
                className="lw-input"
                aria-label="Manuscript text"
                rows={9}
                placeholder="Paste everything — chapter headings and all…"
                value={a.manuscript}
                onChange={(e) => patch({ manuscript: e.target.value })}
              />
              <div className="lw-chips__add">
                <ManuscriptFileButton onText={(text) => patch({ manuscript: a.manuscript ? `${a.manuscript}\n\n${text}` : text })} />
              </div>
              {a.manuscript.trim() && (
                <p className="lw-fieldnote" data-testid="split-preview">
                  Will import <strong>{split.length}</strong> chapter{split.length === 1 ? '' : 's'}:{' '}
                  {split.map((c) => c.title).join(' · ')}
                </p>
              )}
              <label className="lw-toggle">
                <input
                  type="checkbox"
                  checked={a.runExtraction}
                  onChange={(e) => patch({ runExtraction: e.target.checked })}
                />
                <span>Run the first extraction pass after import (results go to Review)</span>
              </label>
            </section>
          )}

          {step === 5 && (
            <section className="lw-ob__section">
              <h2 className="lw-ob__title">AI &amp; privacy</h2>
              <p className="lw-fieldnote">
                Loomwright is local-first. AI is optional and bring-your-own-key — nothing
                leaves this device unless you say so.
              </p>
              <label className="lw-toggle">
                <input
                  type="radio"
                  name="ob-ai"
                  checked={a.aiMode === 'byok'}
                  onChange={() => patch({ aiMode: 'byok' })}
                />
                <span>
                  <strong>AI available</strong> — I&apos;ll add a provider key in Settings when I
                  want drafting help or deep extraction.
                </span>
              </label>
              <label className="lw-toggle">
                <input
                  type="radio"
                  name="ob-ai"
                  checked={a.aiMode === 'local-only'}
                  onChange={() => patch({ aiMode: 'local-only' })}
                />
                <span>
                  <strong>Local-only</strong> — block every external AI call. Extraction and
                  tracking still work fully offline.
                </span>
              </label>
              <label className="lw-toggle" style={{ marginTop: 'var(--sp-5)' }}>
                <input
                  type="checkbox"
                  checked={a.privacyAsk}
                  onChange={(e) => patch({ privacyAsk: e.target.checked })}
                />
                <span>Ask before any manuscript text is sent to a provider (privacy guard).</span>
              </label>
            </section>
          )}

          {step === 6 && (
            <section className="lw-ob__section">
              <h2 className="lw-ob__title">Ready.</h2>
              <ul className="lw-ob__summary" data-testid="finish-summary">
                <li>
                  <strong>{a.name || 'Untitled project'}</strong>
                  {a.genre.length ? ` — ${a.genre.join(', ')}` : ''}
                  {a.tone.length ? `, ${a.tone.join(', ').toLowerCase()}` : ''}
                </li>
                {a.premise && <li>Premise, themes &amp; comparables → saved as references and the AI brief.</li>}
                {a.styleProfile && <li>Voice profile captured ({a.styleProfile.register}, {a.styleProfile.pacing}).</li>}
                <li>{a.cast.filter((c) => c.name.trim()).length} cast seed(s), {a.places.filter((p) => p.name.trim()).length} place(s).</li>
                <li>
                  {split.length > 0 && a.manuscript.trim()
                    ? `${split.length} chapter(s) will import${a.runExtraction ? ' + first extraction to Review' : ''}.`
                    : 'No manuscript yet — the Writer’s Room will be empty and ready.'}
                </li>
                <li>{a.aiMode === 'local-only' ? 'Local-only mode.' : 'AI available (bring your own key).'} Privacy guard {a.privacyAsk ? 'on' : 'off'}.</li>
              </ul>
              <button
                type="button"
                className="lw-btn lw-btn--primary lw-ob__finish"
                disabled={busy || !a.name.trim()}
                onClick={() => void finish()}
              >
                {busy ? 'Building your project…' : 'Open the door'}
              </button>
            </section>
          )}

          <footer className="lw-ob__foot">
            <button type="button" className="lw-btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
              ‹ Back
            </button>
            <span className="lw-fieldnote">
              Step {step + 1} of {STEPS.length}
            </span>
            {step < STEPS.length - 1 && (
              <button
                type="button"
                className="lw-btn lw-btn--primary"
                disabled={!canContinue}
                onClick={() => setStep((s) => s + 1)}
              >
                Continue ›
              </button>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
}

/** Genre/tone became multi-select — coerce a legacy string draft into an
 * array so an old saved draft can't crash the checkbox rendering. */
function coerceLists(draft: Partial<OnboardingAnswers>): Partial<OnboardingAnswers> {
  const fix = (v: unknown): string[] | undefined =>
    typeof v === 'string' ? (v ? [v] : []) : undefined;
  const out: Partial<OnboardingAnswers> = {};
  const g = fix(draft.genre);
  if (g) out.genre = g;
  const t = fix(draft.tone);
  if (t) out.tone = t;
  return out;
}

function ManuscriptFileButton({ onText }: { onText: (text: string) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <button type="button" className="lw-btn" onClick={() => ref.current?.click()}>
        From file (.txt / .md)…
      </button>
      <input
        ref={ref}
        type="file"
        accept=".txt,.md,.markdown,text/plain,text/markdown"
        aria-label="Manuscript file"
        style={{ display: 'none' }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onText(await file.text());
        }}
      />
    </>
  );
}

import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { getProject } from '@/db/repos/projects';
import { listChapters } from '@/db/repos/chapters';
import type { Chapter, Entity } from '@/db/types';
import { buildHandoffPack } from '@/services/ai/handoff';
import type { KnownEntity } from '@/services/extraction/known-index';
import { extractWholeText, type IntakeProgress } from '@/services/intelligence/intake';
import { buildMegaPrompt, importMegaResponse } from '@/services/intelligence/megaprompt';
import type { DigestDepth } from '@/services/intelligence/digest';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';

async function loadRows(projectId: string): Promise<Entity[]> {
  return db.entities.where('projectId').equals(projectId).toArray();
}
function toKnown(rows: Entity[]): KnownEntity[] {
  return rows.map((e) => ({ id: e.id, type: e.type, name: e.name, aliases: e.aliases }));
}

/** Import & Extract: onboard a whole book offline (chunk → scan → Review),
 * or hand a full-world mega-prompt to any external AI and paste the reply
 * back. Nothing is applied automatically — every finding waits in Review. */
export function HandoffSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const chapters = useLiveQuery(
    async () => (projectId ? listChapters(projectId) : []),
    [projectId],
    [] as Chapter[]
  );
  const noticeSeen = useLiveQuery(
    async () => (projectId ? Boolean((await db.settings.get(`${projectId}:megaNotice`))?.value) : true),
    [projectId],
    false as boolean
  );

  const [chapterId, setChapterId] = useState<string>('');
  const [pack, setPack] = useState('');
  const [reply, setReply] = useState('');
  const [bookText, setBookText] = useState('');
  const [progress, setProgress] = useState<IntakeProgress | null>(null);
  const [depth, setDepth] = useState<DigestDepth>('standard');
  const [showNotice, setShowNotice] = useState(false);

  if (!projectId) return null;

  const extractOffline = async () => {
    if (!bookText.trim()) return;
    setProgress({ chunk: 0, total: 1 });
    const rows = await loadRows(projectId);
    const result = await extractWholeText(projectId, bookText, toKnown(rows), (p) => setProgress(p));
    setProgress(null);
    setBookText('');
    toast(
      result.added
        ? `${result.added} finding${result.added === 1 ? '' : 's'} from ${result.chunks} chunk${result.chunks === 1 ? '' : 's'} — review them.`
        : `Scanned ${result.chunks} chunk${result.chunks === 1 ? '' : 's'} — nothing new to review yet.`,
      result.added
        ? { kind: 'success', action: { label: 'Review', run: () => setRoute('review') } }
        : { kind: 'info' }
    );
  };

  const doCopyMega = async () => {
    const rows = await loadRows(projectId);
    const project = await getProject(projectId);
    const prompt = buildMegaPrompt({ projectName: project?.name ?? 'Project', entities: rows, depth });
    await navigator.clipboard.writeText(prompt);
    await db.settings.put({ key: `${projectId}:megaNotice`, value: true });
    setShowNotice(false);
    toast('Mega-prompt copied — paste it into any AI, then paste the reply back below.', { kind: 'success' });
  };

  const copyMega = async () => {
    if (!noticeSeen) {
      setShowNotice(true);
      return;
    }
    await doCopyMega();
  };

  const buildPack = async () => {
    const project = await getProject(projectId);
    const rows = await loadRows(projectId);
    const chapter = chapters.find((c) => c.id === chapterId) ?? null;
    setPack(buildHandoffPack({ projectName: project?.name ?? 'Project', known: toKnown(rows), chapter }));
  };

  const importReply = async () => {
    const rows = await loadRows(projectId);
    const result = await importMegaResponse(projectId, reply, toKnown(rows), rows);
    if ('error' in result) {
      toast(result.error, { kind: 'error' });
      return;
    }
    setReply('');
    const bits = [
      result.facts ? `${result.facts} finding${result.facts === 1 ? '' : 's'}` : '',
      result.suggestions ? `${result.suggestions} suggestion${result.suggestions === 1 ? '' : 's'}` : '',
    ].filter(Boolean);
    toast(`Imported ${bits.join(' and ') || 'nothing new'}.`, {
      kind: 'success',
      action: { label: 'Review', run: () => setRoute('review') },
    });
  };

  return (
    <div className="lw-page lw-page--wide" data-testid="surface-handoff">
      <div>
        <h1 className="lw-page__title">Import & Extract</h1>
        <p className="lw-page__subtitle">
          Onboard a whole book offline, or hand a full-world mega-prompt to any external AI.
          Nothing touches your codex until you accept it in Review.
        </p>
      </div>

      <section className="lw-card" data-testid="whole-book-intake">
        <h2 className="lw-card__title">Paste a whole chapter or book</h2>
        <p className="lw-fieldnote">
          Fully offline — it chunks the text, scans every chunk for characters, places, items,
          ownership, travel, and story beats, and drops the findings into Review.
        </p>
        <textarea
          className="lw-input lw-input--area"
          rows={8}
          aria-label="Manuscript text"
          placeholder="Paste a chapter, several chapters, or an entire manuscript…"
          value={bookText}
          onChange={(e) => setBookText(e.target.value)}
        />
        <div className="lw-chips__add" style={{ marginTop: 'var(--sp-4)' }}>
          <button
            type="button"
            className="lw-btn lw-btn--primary"
            disabled={!bookText.trim() || !!progress}
            onClick={() => void extractOffline()}
          >
            {progress ? `Scanning ${progress.chunk}/${progress.total}…` : 'Extract offline'}
          </button>
          {progress && (
            <span className="lw-fieldnote" data-testid="intake-progress">
              Chunk {progress.chunk} of {progress.total}
            </span>
          )}
        </div>
      </section>

      <section className="lw-card" data-testid="mega-prompt">
        <h2 className="lw-card__title">Hand off to an external AI</h2>
        <p className="lw-fieldnote">
          Copy a mega-prompt carrying a digest of your whole world plus a facts-and-suggestions
          schema. Paste it into ChatGPT, Claude, or a local model, then paste the reply back.
        </p>
        <label className="lw-field__label" htmlFor="digest-depth">
          World digest depth
        </label>
        <div className="lw-viewtoggle" role="radiogroup" aria-label="Digest depth">
          {(['lean', 'standard', 'full'] as const).map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={depth === d}
              className={depth === d ? 'lw-pill lw-pill--active' : 'lw-pill'}
              onClick={() => setDepth(d)}
            >
              {d[0].toUpperCase() + d.slice(1)}
            </button>
          ))}
        </div>

        {showNotice ? (
          <div className="lw-card lw-mergebox" data-testid="mega-notice">
            <p className="lw-mergebox__note">
              The mega-prompt contains a digest of your world (names and key details) and goes
              wherever you paste it — that AI may log or train on it. This notice shows once.
            </p>
            <div className="lw-chips__add">
              <button type="button" className="lw-btn lw-btn--primary" onClick={() => void doCopyMega()}>
                Copy the mega-prompt
              </button>
              <button type="button" className="lw-btn" onClick={() => setShowNotice(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="lw-chips__add" style={{ marginTop: 'var(--sp-3)' }}>
            <button type="button" className="lw-btn lw-btn--primary" onClick={() => void copyMega()}>
              Copy mega-prompt
            </button>
          </div>
        )}

        <h3 className="lw-atlas__subhead">Or build a single-chapter pack</h3>
        <div className="lw-chips__add">
          <select
            className="lw-input"
            aria-label="Chapter to include"
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
          >
            <option value="">No chapter — I&apos;ll paste text myself</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <button type="button" className="lw-btn" onClick={() => void buildPack()}>
            Build pack
          </button>
        </div>
        {pack && (
          <>
            <textarea
              className="lw-input lw-input--area lw-handoff__pack"
              rows={8}
              readOnly
              aria-label="Handoff pack"
              value={pack}
            />
            <button
              type="button"
              className="lw-btn"
              onClick={async () => {
                await navigator.clipboard.writeText(pack);
                toast('Pack copied — paste it into your AI of choice.', { kind: 'success' });
              }}
            >
              Copy pack
            </button>
          </>
        )}

        <h3 className="lw-atlas__subhead">Paste the AI&apos;s reply</h3>
        <textarea
          className="lw-input lw-input--area"
          rows={7}
          aria-label="AI reply"
          placeholder="Paste the whole answer here — the JSON block is enough."
          value={reply}
          onChange={(e) => setReply(e.target.value)}
        />
        <div className="lw-chips__add" style={{ marginTop: 'var(--sp-4)' }}>
          <button
            type="button"
            className="lw-btn lw-btn--primary"
            disabled={!reply.trim()}
            onClick={() => void importReply()}
          >
            Import to review queue
          </button>
        </div>
        <p className="lw-fieldnote">
          Nothing is applied automatically — findings wait in Review, suggestions land in each
          dossier&apos;s ✨ inbox.
        </p>
      </section>
    </div>
  );
}

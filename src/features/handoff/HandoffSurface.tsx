import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { getProject } from '@/db/repos/projects';
import { listChapters } from '@/db/repos/chapters';
import type { Chapter } from '@/db/types';
import { buildHandoffPack, importHandoffResponse } from '@/services/ai/handoff';
import { buildMegaPrompt, buildWorldDigest, parseDeltaReply, type DigestDepth } from '@/services/intelligence/digest';
import { extractTextToDelta } from '@/services/intelligence/session';
import { useIntelligenceStore } from '@/stores/intelligence';
import type { KnownEntity } from '@/services/extraction/known-index';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';

async function loadKnown(projectId: string): Promise<KnownEntity[]> {
  const rows = await db.entities.where('projectId').equals(projectId).toArray();
  return rows.map((e) => ({ id: e.id, type: e.type, name: e.name, aliases: e.aliases }));
}

/** AI Handoff: write with any external AI for free — export a
 * self-contained prompt pack, paste the reply back, and the findings
 * land in the review queue like any extraction. */
export function HandoffSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const chapters = useLiveQuery(
    async () => (projectId ? listChapters(projectId) : []),
    [projectId],
    [] as Chapter[]
  );
  const [chapterId, setChapterId] = useState<string>('');
  const [pack, setPack] = useState('');
  const [reply, setReply] = useState('');
  const [manuscript, setManuscript] = useState('');
  const [reading, setReading] = useState(false);
  const [depth, setDepth] = useState<DigestDepth>('standard');
  const stageDelta = useIntelligenceStore((s) => s.stage);
  const readProgress = useIntelligenceStore((s) => s.progress);
  const setReadProgress = useIntelligenceStore((s) => s.setProgress);

  if (!projectId) return null;

  /** Offline whole-book intake: chunked, merged into one board. */
  const readManuscript = async () => {
    setReading(true);
    try {
      const delta = await extractTextToDelta(projectId, manuscript, {
        onProgress: (done, total) => setReadProgress(total > 1 ? { done, total } : null),
      });
      setReadProgress(null);
      if (!delta.groups.length) {
        toast('Nothing trackable found in that text yet.', {});
        return;
      }
      stageDelta(delta);
      setManuscript('');
      toast(`${delta.groups.length} change${delta.groups.length === 1 ? '' : 's'} to review.`, {
        kind: 'success',
        action: { label: 'Review', run: () => setRoute('review') },
      });
    } catch (err) {
      setReadProgress(null);
      toast(err instanceof Error ? err.message : 'Could not read that text.', { kind: 'error' });
    } finally {
      setReading(false);
    }
  };

  /** Copy the world digest + mega-prompt. The one-time notice explains what
   * the digest contains and that it goes wherever the author pastes it —
   * shown once, then never again, per the "inform once" decision. */
  const copyMegaPrompt = async () => {
    const seenKey = `${projectId}:digest-notice-seen`;
    const seen = await db.settings.get(seenKey);
    if (!seen) {
      const ok = window.confirm(
        'This copies a digest of your world — character, place and item names, ' +
          'who owns what, how places nest, and the relationship web — along with your ' +
          'manuscript text.\n\nIt goes wherever you paste it. Use the depth selector to ' +
          'send less.\n\nThis notice is shown once.'
      );
      if (!ok) return;
      await db.settings.put({ key: seenKey, value: true });
    }
    const digest = await buildWorldDigest(projectId, depth);
    const chapter = chapters.find((c) => c.id === chapterId) ?? null;
    const text = manuscript.trim() || (chapter ? chapter.paragraphs.map((p) => p.text).join('\n\n') : '');
    await navigator.clipboard.writeText(buildMegaPrompt(digest, text));
    toast('Mega-prompt copied — paste it into your AI, then bring the reply back below.', {
      kind: 'success',
    });
  };

  const generate = async () => {
    const project = await getProject(projectId);
    const known = await loadKnown(projectId);
    const chapter = chapters.find((c) => c.id === chapterId) ?? null;
    setPack(
      buildHandoffPack({
        projectName: project?.name ?? 'Project',
        known,
        chapter,
      })
    );
  };

  const importReply = async () => {
    // A mega-prompt reply carries facts our own rules can verify, so try that
    // first; anything else is still a legacy handoff pack reply.
    const delta = await parseDeltaReply(projectId, reply);
    if (!('error' in delta) && delta.groups.length) {
      stageDelta(delta);
      setReply('');
      toast(`${delta.groups.length} change${delta.groups.length === 1 ? '' : 's'} to review.`, {
        kind: 'success',
        action: { label: 'Review', run: () => setRoute('review') },
      });
      return;
    }

    const known = await loadKnown(projectId);
    const result = await importHandoffResponse(projectId, reply, known);
    if ('error' in result) {
      // Report whichever parser got furthest rather than a generic failure.
      toast('error' in delta ? delta.error : result.error, { kind: 'error' });
      return;
    }
    setReply('');
    toast(`${result.added} candidate${result.added === 1 ? '' : 's'} added to the review queue.`, {
      kind: 'success',
      action: { label: 'Review', run: () => setRoute('review') },
    });
  };

  return (
    <div className="lw-page lw-page--wide" data-testid="surface-handoff">
      <div>
        <h1 className="lw-page__title">Import &amp; Extract</h1>
        <p className="lw-page__subtitle">
          Paste a chapter — or a whole book — and Loomwright works out what changed, offline
          and free. Or hand the work to any outside AI (ChatGPT, Claude, a free tier) on your
          existing plan instead of in-app tokens, and paste the reply back.
        </p>
      </div>

      <section className="lw-card">
        <h2 className="lw-card__title">Paste manuscript</h2>
        <p className="lw-fieldnote">
          Up to a whole book. Read entirely on your machine — no keys, no network.
        </p>
        <textarea
          className="lw-input lw-input--area"
          rows={8}
          aria-label="Manuscript text"
          placeholder="Paste your chapter or manuscript here…"
          value={manuscript}
          onChange={(e) => setManuscript(e.target.value)}
        />
        <div className="lw-chips__add" style={{ marginTop: 'var(--sp-4)' }}>
          <button
            type="button"
            className="lw-btn lw-btn--primary"
            disabled={!manuscript.trim() || reading}
            onClick={() => void readManuscript()}
            data-testid="handoff-extract-paste"
          >
            {reading ? 'Reading…' : 'Extract'}
          </button>
          {readProgress ? (
            <span className="lw-fieldnote" role="status">
              Section {readProgress.done} of {readProgress.total}…
            </span>
          ) : null}
        </div>
      </section>

      <section className="lw-card">
        <h2 className="lw-card__title">1 · Build the pack</h2>
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
          <button type="button" className="lw-btn lw-btn--primary" onClick={() => void generate()}>
            Build pack
          </button>
        </div>
        <div className="lw-chips__add" style={{ marginTop: 'var(--sp-5)' }}>
          <label className="lw-fieldnote" htmlFor="lw-digest-depth">
            World digest depth
          </label>
          <select
            id="lw-digest-depth"
            className="lw-input"
            value={depth}
            onChange={(e) => setDepth(e.target.value as DigestDepth)}
          >
            <option value="lean">Lean — names only</option>
            <option value="standard">Standard — names + key state</option>
            <option value="full">Full — everything that fits</option>
          </select>
          <button
            type="button"
            className="lw-btn"
            onClick={() => void copyMegaPrompt()}
            data-testid="handoff-copy-megaprompt"
          >
            Copy mega-prompt
          </button>
        </div>
        <p className="lw-fieldnote">
          The mega-prompt carries your world digest so the AI can report consequences, not just
          names — and it comes back as cascades you accept in one click.
        </p>
        {pack && (
          <>
            <textarea
              className="lw-input lw-input--area lw-handoff__pack"
              rows={10}
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
      </section>

      <section className="lw-card">
        <h2 className="lw-card__title">2 · Paste the AI&apos;s reply</h2>
        <textarea
          className="lw-input lw-input--area"
          rows={8}
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
          Nothing is applied automatically — every finding waits in Review for your accept.
        </p>
      </section>
    </div>
  );
}

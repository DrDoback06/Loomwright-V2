import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { getProject } from '@/db/repos/projects';
import { listChapters } from '@/db/repos/chapters';
import type { Chapter } from '@/db/types';
import { buildHandoffPack, importHandoffResponse } from '@/services/ai/handoff';
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

  if (!projectId) return null;

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
    const known = await loadKnown(projectId);
    const result = await importHandoffResponse(projectId, reply, known);
    if ('error' in result) {
      toast(result.error, { kind: 'error' });
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
        <h1 className="lw-page__title">AI Handoff</h1>
        <p className="lw-page__subtitle">
          Use any outside AI (ChatGPT, Claude, a free tier) instead of in-app tokens: copy
          the pack, paste the reply back, review as usual.
        </p>
      </div>

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

import { useState } from 'react';
import { applyBundle } from '@/services/generate/apply';
import { runRandomGeneration } from '@/services/generate/staging';
import { bundleTitle } from '@/services/generate/types';
import { undoAuditEntry } from '@/db/repos/undo';
import { useGenerationStore } from '@/stores/generation';
import { toast } from '@/stores/toasts';

/** Floating Accept / Reroll / Discard bar shown whenever a bundle is
 * staged — global, so nothing can get stuck even on surfaces that don't
 * ghost-render. Nothing touches the database until Accept. */
export function StagedBundleBar() {
  const staged = useGenerationStore((s) => s.staged);
  const stage = useGenerationStore((s) => s.stage);
  const discard = useGenerationStore((s) => s.discard);
  const [busy, setBusy] = useState(false);

  if (!staged) return null;

  const accept = async () => {
    setBusy(true);
    try {
      const result = await applyBundle(staged);
      const title = bundleTitle(staged);
      discard();
      toast(`${title} created.`, {
        kind: 'success',
        action: {
          label: 'Undo',
          run: async () => {
            await undoAuditEntry(result.auditId);
            toast('Generation undone.', { kind: 'success' });
          },
        },
      });
    } finally {
      setBusy(false);
    }
  };

  const reroll = async () => {
    setBusy(true);
    try {
      const next = await runRandomGeneration(staged.request, staged.projectId);
      if ('error' in next) {
        toast(next.error, { kind: 'error' });
        return;
      }
      stage(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="lw-stagedbar" data-testid="staged-bar" role="region" aria-label="Staged generation">
      <span className="lw-stagedbar__label">
        <span aria-hidden>✨</span> Staged: {bundleTitle(staged)}
      </span>
      {staged.warnings.length ? (
        <details className="lw-stagedbar__warnings">
          <summary>
            {staged.warnings.length} note{staged.warnings.length === 1 ? '' : 's'}
          </summary>
          <ul>
            {staged.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}
      <span className="lw-stagedbar__actions">
        <button
          type="button"
          className="lw-btn lw-btn--primary"
          disabled={busy}
          onClick={() => void accept()}
        >
          Accept all
        </button>
        {staged.mode === 'random' ? (
          <button type="button" className="lw-btn" disabled={busy} onClick={() => void reroll()}>
            🎲 Reroll
          </button>
        ) : null}
        <button type="button" className="lw-btn" disabled={busy} onClick={discard}>
          Discard
        </button>
      </span>
    </div>
  );
}

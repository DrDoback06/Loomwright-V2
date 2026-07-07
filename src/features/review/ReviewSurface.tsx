import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import {
  acceptCandidate,
  denyCandidate,
  listPendingCandidates,
  markCandidatesAccepted,
  rependCandidates,
} from '@/db/repos/review';
import { undoAuditEntry } from '@/db/repos/undo';
import type { Entity, ReviewCandidate } from '@/db/types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { applyDelta } from '@/services/intelligence/apply';
import { propagate, type PropagateContext } from '@/services/intelligence/propagate';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { useFocusStore } from '@/stores/focus';
import { toast } from '@/stores/toasts';
import { buildReviewGroups } from './reviewGroups';

const BAND_LABEL: Record<ReviewCandidate['confidenceBand'], string> = {
  blue: 'Auto-add grade',
  green: 'Strong',
  orange: 'Uncertain',
  red: 'Weak',
};

/** Compact display of a patch/ref value. */
function shortValue(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'string') return v.length > 48 ? v.slice(0, 47) + '…' : v;
  if (Array.isArray(v)) return v.map(shortValue).join(', ');
  if (typeof v === 'object' && 'name' in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>).name);
  }
  return JSON.stringify(v).slice(0, 48);
}

export function ReviewSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const setCodexType = useUiStore((s) => s.setCodexType);
  const setFocus = useFocusStore((s) => s.setFocus);

  // Flat stays the default during the transition so nothing that relies on
  // it breaks; the smart board is one prominent click away.
  const [view, setView] = useState<'board' | 'flat'>('flat');
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);

  const pending = useLiveQuery(
    async () => (projectId ? listPendingCandidates(projectId) : []),
    [projectId],
    [] as ReviewCandidate[]
  );
  const rows = useLiveQuery(
    async () => (projectId ? db.entities.where('projectId').equals(projectId).toArray() : []),
    [projectId],
    [] as Entity[]
  );

  const ctx: PropagateContext = useMemo(
    () => ({
      projectId: projectId ?? '',
      known: rows.map((e) => ({ id: e.id, type: e.type, name: e.name, aliases: e.aliases })),
      entities: rows.map((e) => ({ id: e.id, type: e.type, name: e.name, fields: e.fields })),
    }),
    [projectId, rows]
  );
  const groups = useMemo(() => buildReviewGroups(pending, ctx), [pending, ctx]);

  if (!projectId) return null;

  const toggle = (key: string) =>
    setExcluded((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const includedIds = groups.filter((g) => !excluded.has(g.key)).flatMap((g) => g.candidateIds);

  const acceptBoard = async () => {
    const included = pending.filter((c) => includedIds.includes(c.id));
    if (!included.length) {
      toast('Nothing selected to accept.', { kind: 'info' });
      return;
    }
    setBusy(true);
    try {
      const delta = propagate(included, ctx);
      const result = await applyDelta(delta);
      await markCandidatesAccepted(includedIds, result.created);
      const facts = delta.entities.length + delta.patches.length + delta.links.length;
      toast(`Applied ${facts} change${facts === 1 ? '' : 's'} across ${new Set(included.map((c) => c.id)).size} findings.`, {
        kind: 'success',
        action: {
          label: 'Undo',
          run: async () => {
            await undoAuditEntry(result.auditId);
            await rependCandidates(includedIds);
            toast('Reverted — findings back in the queue.', { kind: 'success' });
          },
        },
      });
    } finally {
      setBusy(false);
    }
  };

  const dismissGroup = async (g: (typeof groups)[number]) => {
    for (const id of g.candidateIds) await denyCandidate(id);
  };

  // Flat-view accept (per-candidate, legacy path — merge-only).
  const acceptFlat = async (candidate: ReviewCandidate) => {
    const entity = await acceptCandidate(candidate.id);
    if (entity) {
      toast(`${entity.name} ${candidate.suggestedAction === 'update' ? 'updated' : 'added'} in ${ENTITY_TYPE_META[entity.type].plural}.`, {
        kind: 'success',
        action: {
          label: 'Open',
          run: () => {
            setFocus({ id: entity.id, type: entity.type, name: entity.name });
            setCodexType(entity.type);
            setRoute('codex');
          },
        },
      });
    } else {
      toast('Could not apply this candidate — its target may have been deleted.', { kind: 'error' });
    }
  };

  return (
    <div className="lw-page lw-page--wide" data-testid="surface-review">
      <div className="lw-review__head">
        <div>
          <h1 className="lw-page__title">Review board</h1>
          <p className="lw-page__subtitle">
            Everything extraction found — grouped by what it changes. Nothing touches your codex
            until you accept.
          </p>
        </div>
        <div className="lw-viewtoggle" role="radiogroup" aria-label="Review view">
          <button
            type="button"
            role="radio"
            aria-checked={view === 'board'}
            className={view === 'board' ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => setView('board')}
          >
            Board
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === 'flat'}
            className={view === 'flat' ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => setView('flat')}
          >
            Flat list
          </button>
        </div>
      </div>

      {pending.length === 0 ? (
        <div className="lw-card lw-empty lw-empty--center">
          <p className="lw-empty__title">The review board is clear.</p>
          <p className="lw-empty__note">
            Write in the Writer&apos;s Room and press “Save &amp; Extract” to scan your prose for
            characters, places, items, and story beats.
          </p>
        </div>
      ) : view === 'board' ? (
        <>
          <div className="lw-review__bar" data-testid="review-accept-bar">
            <span>
              {groups.length} group{groups.length === 1 ? '' : 's'} · {includedIds.length} finding
              {includedIds.length === 1 ? '' : 's'} selected
            </span>
            <button
              type="button"
              className="lw-btn lw-btn--primary"
              disabled={busy || includedIds.length === 0}
              onClick={() => void acceptBoard()}
            >
              Accept all selected
            </button>
          </div>
          <ul className="lw-groups">
            {groups.map((g) => {
              const included = !excluded.has(g.key);
              return (
                <li
                  key={g.key}
                  className={`lw-card lw-group${g.conflict ? ' lw-group--conflict' : ''}`}
                  data-testid="review-group"
                >
                  <header className="lw-group__head">
                    <label className="lw-group__pick">
                      <input type="checkbox" checked={included} onChange={() => toggle(g.key)} />
                      <strong>{g.title}</strong>
                    </label>
                    {g.conflict && (
                      <span className="lw-flag" data-testid="review-conflict">⚑ conflict</span>
                    )}
                    <span className="lw-group__conf">{Math.round(g.confidence * 100)}%</span>
                  </header>

                  <ul className="lw-cascade">
                    {g.delta.entities.map((e) => (
                      <li key={e.localId} className="lw-cascade__row lw-cascade__row--new">
                        <span aria-hidden>{ENTITY_TYPE_META[e.type].glyph}</span> new {ENTITY_TYPE_META[e.type].label.toLowerCase()}:{' '}
                        <strong>{e.name}</strong>
                        {Object.keys(e.fields).length > 0 && (
                          <span className="lw-cascade__fields">
                            {' '}
                            ({Object.entries(e.fields).slice(0, 3).map(([k, v]) => `${k} ${shortValue(v)}`).join(', ')})
                          </span>
                        )}
                      </li>
                    ))}
                    {g.delta.patches.map((p, i) => (
                      <li key={i} className={`lw-cascade__row${p.conflict ? ' lw-cascade__row--conflict' : ''}`}>
                        <span className="lw-cascade__field">{p.field}</span>{' '}
                        <span className="lw-cascade__before">{shortValue(p.before)}</span>
                        {' → '}
                        <span className="lw-cascade__after">{shortValue(p.after)}</span>
                        {p.conflict && <span className="lw-flag lw-flag--sm"> ⚑</span>}
                      </li>
                    ))}
                    {g.delta.links.map((l, i) => (
                      <li key={`l${i}`} className="lw-cascade__row">
                        link: {l.kind}
                      </li>
                    ))}
                  </ul>

                  {g.delta.warnings.length > 0 && (
                    <p className="lw-group__warn">{g.delta.warnings[0]}</p>
                  )}
                  {g.delta.suggestions.length > 0 && (
                    <div className="lw-group__sugs" data-testid="review-suggestions">
                      {g.delta.suggestions.map((s, i) => (
                        <span key={i} className="lw-sugchip" title={s.detail}>
                          ✨ {s.title}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="lw-group__foot">
                    <button type="button" className="lw-btn" onClick={() => void dismissGroup(g)}>
                      Dismiss group
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <ul className="lw-queue">
          {pending.map((c) => {
            const meta = ENTITY_TYPE_META[c.entityType];
            return (
              <li key={c.id} className={`lw-card lw-qcard lw-qcard--${c.confidenceBand}`}>
                <div className="lw-qcard__top">
                  <span className="lw-qcard__type" style={{ color: meta.deep, background: meta.soft }}>
                    {meta.glyph} {meta.label}
                  </span>
                  <span className={`lw-band lw-band--${c.confidenceBand}`}>
                    {BAND_LABEL[c.confidenceBand]} · {Math.round(c.confidence * 100)}%
                  </span>
                </div>
                <h2 className="lw-qcard__name">
                  {c.name}
                  <span className="lw-qcard__action">
                    {c.suggestedAction === 'create' ? 'new' : c.suggestedAction === 'merge' ? 'possible alias' : 'update'}
                  </span>
                </h2>
                {c.summary && <p className="lw-qcard__summary">{c.summary}</p>}
                {c.sourceQuote && <blockquote className="lw-qcard__quote">“{c.sourceQuote}”</blockquote>}
                <div className="lw-qcard__actions">
                  <button type="button" className="lw-btn lw-btn--primary" onClick={() => void acceptFlat(c)}>
                    {c.suggestedAction === 'merge' ? 'Merge as alias' : 'Accept'}
                  </button>
                  <button type="button" className="lw-btn" onClick={() => void denyCandidate(c.id)}>
                    Deny
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

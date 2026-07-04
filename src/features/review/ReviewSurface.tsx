import { useLiveQuery } from 'dexie-react-hooks';
import { acceptAllCandidates, acceptCandidate, denyCandidate, listPendingCandidates } from '@/db/repos/review';
import type { ReviewCandidate } from '@/db/types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { useFocusStore } from '@/stores/focus';
import { toast } from '@/stores/toasts';

const BAND_LABEL: Record<ReviewCandidate['confidenceBand'], string> = {
  blue: 'Auto-add grade',
  green: 'Strong',
  orange: 'Uncertain',
  red: 'Weak',
};

export function ReviewSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const setCodexType = useUiStore((s) => s.setCodexType);
  const setFocus = useFocusStore((s) => s.setFocus);

  const pending = useLiveQuery(
    async () => (projectId ? listPendingCandidates(projectId) : []),
    [projectId],
    [] as ReviewCandidate[]
  );

  if (!projectId) return null;

  const accept = async (candidate: ReviewCandidate) => {
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
      toast('Could not apply this candidate — its target entity may have been deleted.', {
        kind: 'error',
      });
    }
  };

  const acceptStrong = async () => {
    const strong = pending.filter((c) => c.confidenceBand === 'blue' || c.confidenceBand === 'green');
    const done = await acceptAllCandidates(projectId, strong.map((c) => c.id));
    toast(`Accepted ${done} strong candidate${done === 1 ? '' : 's'}.`, { kind: 'success' });
  };

  return (
    <div className="lw-page lw-page--wide" data-testid="surface-review">
      <div className="lw-review__head">
        <div>
          <h1 className="lw-page__title">Review queue</h1>
          <p className="lw-page__subtitle">
            Everything extraction found. Nothing touches your codex until you accept it.
          </p>
        </div>
        {pending.some((c) => c.confidenceBand === 'blue' || c.confidenceBand === 'green') && (
          <button type="button" className="lw-btn lw-btn--primary" onClick={() => void acceptStrong()}>
            Accept all strong
          </button>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="lw-card lw-empty lw-empty--center">
          <p className="lw-empty__title">The review queue is clear.</p>
          <p className="lw-empty__note">
            Write in the Writer&apos;s Room and press “Save &amp; Extract” to scan your prose for
            characters, places, items, and story beats.
          </p>
        </div>
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
                    {c.suggestedAction === 'create'
                      ? 'new'
                      : c.suggestedAction === 'merge'
                        ? 'possible alias'
                        : 'update'}
                  </span>
                </h2>
                {c.summary && <p className="lw-qcard__summary">{c.summary}</p>}
                {c.sourceQuote && <blockquote className="lw-qcard__quote">“{c.sourceQuote}”</blockquote>}
                {c.suggestedChanges && Object.keys(c.suggestedChanges).length > 0 && (
                  <p className="lw-qcard__changes">
                    {Object.entries(c.suggestedChanges)
                      .filter(([k]) => k !== 'aliases')
                      .slice(0, 4)
                      .map(([k, v]) => `${k}: ${shortValue(v)}`)
                      .join(' · ')}
                  </p>
                )}
                <div className="lw-qcard__actions">
                  <button type="button" className="lw-btn lw-btn--primary" onClick={() => void accept(c)}>
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

function shortValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.length > 40 ? v.slice(0, 40) + '…' : v;
  if (typeof v === 'object' && 'name' in (v as Record<string, unknown>)) {
    return String((v as Record<string, unknown>).name);
  }
  return JSON.stringify(v).slice(0, 40);
}

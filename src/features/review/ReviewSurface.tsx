import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { acceptCandidate, denyCandidate, listPendingCandidates, retypeCandidates } from '@/db/repos/review';
import { rememberDifferentIdentity } from '@/db/repos/identity';
import type { ReviewCandidate } from '@/db/types';
import { ALL_ENTITY_TYPES, ENTITY_TYPE_META, type EntityType, type EntityTypeSuggestion } from '@/domain/entity-types';
import {
  buildIdentityClusters,
  type IdentityCluster,
  type IdentityCertainty,
} from '@/services/identity-resolution';
import { readDragPayload, writeDragPayload } from '@/services/drag';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { useFocusStore } from '@/stores/focus';
import { useMergeStore } from '@/stores/merge';
import { toast } from '@/stores/toasts';

const BAND_LABEL: Record<ReviewCandidate['confidenceBand'], string> = {
  blue: 'Auto-add grade',
  green: 'Strong',
  orange: 'Uncertain',
  red: 'Weak',
};

const CERTAINTY_LABEL: Record<IdentityCertainty, string> = {
  certain: 'Certain identity',
  likely: 'Likely identity',
  possible: 'Possible match',
  new: 'Looks new',
};

type ReviewView = 'smart' | 'raw';
type ReviewSort = 'smart' | 'duplicates' | 'impact' | 'confidence' | 'name';

export function ReviewSurface() {
  const projectId = useProjectStore((state) => state.currentProjectId);
  const setRoute = useUiStore((state) => state.setRoute);
  const setCodexType = useUiStore((state) => state.setCodexType);
  const setPalettePurpose = useUiStore((state) => state.setPalettePurpose);
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);
  const setFocus = useFocusStore((state) => state.setFocus);
  const openMerge = useMergeStore((state) => state.open);

  const [view, setView] = useState<ReviewView>('smart');
  const [sort, setSort] = useState<ReviewSort>('smart');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragOver, setDragOver] = useState<string | null>(null);

  const pending = useLiveQuery(
    async () => (projectId ? listPendingCandidates(projectId) : []),
    [projectId],
    [] as ReviewCandidate[]
  );
  const clusters = useLiveQuery(
    async () => (projectId ? buildIdentityClusters(projectId) : []),
    [projectId],
    [] as IdentityCluster[]
  );

  const sortedClusters = useMemo(() => {
    const rows = [...clusters];
    if (sort === 'duplicates') rows.sort((a, b) => b.candidateIds.length - a.candidateIds.length);
    if (sort === 'impact') {
      rows.sort(
        (a, b) =>
          b.evidenceCount + b.chapterIds.length * 2 -
          (a.evidenceCount + a.chapterIds.length * 2)
      );
    }
    if (sort === 'confidence') rows.sort((a, b) => b.confidence - a.confidence);
    if (sort === 'name') rows.sort((a, b) => a.primaryName.localeCompare(b.primaryName));
    return rows;
  }, [clusters, sort]);

  if (!projectId) return null;

  const openClusterMerge = (cluster: IdentityCluster) => {
    openMerge({
      entityType: cluster.entityType,
      candidateIds: cluster.candidateIds,
      targetEntityId: cluster.suggestedEntity?.entity.id ?? null,
      targetCandidateIds: cluster.suggestedEntity ? [] : [cluster.candidates[0]?.id].filter(Boolean),
      canonicalName: cluster.suggestedEntity?.entity.name ?? cluster.primaryName,
    });
  };

  const findExisting = (cluster: IdentityCluster) => {
    openMerge({
      entityType: cluster.entityType,
      candidateIds: cluster.candidateIds,
      canonicalName: cluster.primaryName,
    });
    setPalettePurpose('merge-target');
    setPaletteOpen(true);
  };

  const retypeCluster = async (candidateIds: string[], entityType: EntityType, label: string) => {
    const changed = await retypeCandidates(candidateIds, entityType);
    if (changed) toast(`${label} will now be reviewed as ${ENTITY_TYPE_META[entityType].label}.`, { kind: 'success' });
  };

  const acceptNew = async (candidate: ReviewCandidate) => {
    const entity = await acceptCandidate(candidate.id);
    if (!entity) {
      toast('Could not apply this candidate — its target may have changed.', { kind: 'error' });
      return;
    }
    toast(`${entity.name} added to ${ENTITY_TYPE_META[entity.type].plural}.`, {
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
  };

  const denyCluster = async (cluster: IdentityCluster) => {
    await Promise.all(cluster.candidateIds.map((id) => denyCandidate(id)));
    toast(`Denied ${cluster.candidateIds.length} extraction${cluster.candidateIds.length === 1 ? '' : 's'}.`);
  };

  const keepClusterSeparate = async (cluster: IdentityCluster) => {
    const names = [...new Set(cluster.candidates.map((candidate) => candidate.name))];
    for (let left = 0; left < names.length; left += 1) {
      for (let right = left + 1; right < names.length; right += 1) {
        await rememberDifferentIdentity({
          projectId,
          entityType: cluster.entityType,
          left: names[left],
          right: names[right],
        });
      }
    }
    toast('Loomwright will keep these identities separate in future extraction.', { kind: 'success' });
  };

  const rejectSuggestedEntity = async (cluster: IdentityCluster) => {
    const target = cluster.suggestedEntity?.entity;
    if (!target) return;
    const leftNames = [...new Set(cluster.candidates.map((candidate) => candidate.name))];
    const rightNames = [...new Set([target.name, ...target.aliases])];
    for (const left of leftNames) {
      for (const right of rightNames) {
        await rememberDifferentIdentity({
          projectId,
          entityType: cluster.entityType,
          left,
          right,
        });
      }
    }
    toast(`Remembered: this identity cluster is not ${target.name}.`, { kind: 'success' });
  };

  const handleClusterDrop = (event: React.DragEvent, cluster: IdentityCluster) => {
    event.preventDefault();
    setDragOver(null);
    const payload = readDragPayload(event);
    if (!payload || payload.entityType !== cluster.entityType) {
      toast('Only records of the same entity type can be merged.', { kind: 'error' });
      return;
    }
    if (payload.kind === 'entity') {
      openMerge({
        entityType: cluster.entityType,
        candidateIds: cluster.candidateIds,
        targetEntityId: payload.entityId,
        canonicalName: payload.name,
      });
      return;
    }
    const candidateIds = [...new Set([...cluster.candidateIds, ...payload.candidateIds])];
    if (candidateIds.length === cluster.candidateIds.length) return;
    openMerge({
      entityType: cluster.entityType,
      candidateIds,
      targetCandidateIds: cluster.candidateIds,
      canonicalName: cluster.primaryName,
    });
  };

  const safeNew = clusters.filter(
    (cluster) =>
      cluster.candidateIds.length === 1 &&
      !cluster.suggestedEntity &&
      cluster.candidates[0]?.suggestedAction === 'create' &&
      (cluster.confidenceBand === 'blue' || cluster.confidenceBand === 'green')
  );
  const acceptSafeNew = async () => {
    let accepted = 0;
    for (const cluster of safeNew) {
      if (await acceptCandidate(cluster.candidateIds[0])) accepted += 1;
    }
    toast(`Accepted ${accepted} unambiguous new entit${accepted === 1 ? 'y' : 'ies'}.`, {
      kind: 'success',
    });
  };

  const totalReferences = clusters.reduce((sum, cluster) => sum + cluster.evidenceCount, 0);

  return (
    <div className="lw-page lw-page--wide lw-reviewcentre" data-testid="surface-review">
      <div className="lw-review__head">
        <div>
          <p className="lw-reviewcentre__eyebrow">Identity Resolution Centre</p>
          <h1 className="lw-page__title">Review queue</h1>
          <p className="lw-page__subtitle">
            {clusters.length} decision{clusters.length === 1 ? '' : 's'} · {totalReferences}{' '}
            supporting reference{totalReferences === 1 ? '' : 's'}. Similar extractions are bundled;
            raw evidence is never discarded.
          </p>
        </div>
        <div className="lw-reviewcentre__headactions">
          {safeNew.length > 0 ? (
            <button type="button" className="lw-btn" onClick={() => void acceptSafeNew()}>
              Accept {safeNew.length} safe new
            </button>
          ) : null}
          <button
            type="button"
            className="lw-btn"
            onClick={() => {
              setPalettePurpose('search');
              setPaletteOpen(true);
            }}
          >
            ⌕ Search project
          </button>
        </div>
      </div>

      <div className="lw-reviewcentre__controls">
        <div className="lw-viewtoggle" role="radiogroup" aria-label="Review view">
          <button
            type="button"
            role="radio"
            aria-checked={view === 'smart'}
            className={view === 'smart' ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => setView('smart')}
          >
            Smart decisions
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={view === 'raw'}
            className={view === 'raw' ? 'lw-pill lw-pill--active' : 'lw-pill'}
            onClick={() => setView('raw')}
          >
            Raw extractions · {pending.length}
          </button>
        </div>
        {view === 'smart' ? (
          <label className="lw-reviewcentre__sort">
            <span>Sort</span>
            <select className="lw-input" value={sort} onChange={(event) => setSort(event.target.value as ReviewSort)}>
              <option value="smart">Smart priority</option>
              <option value="duplicates">Most duplicates</option>
              <option value="impact">Most evidence / impact</option>
              <option value="confidence">Highest confidence</option>
              <option value="name">Name</option>
            </select>
          </label>
        ) : null}
      </div>

      {pending.length === 0 ? (
        <div className="lw-card lw-empty lw-empty--center">
          <p className="lw-empty__title">The review queue is clear.</p>
          <p className="lw-empty__note">
            Write in the Writer&apos;s Room and press “Save &amp; Extract” to scan your prose for
            characters, places, items, and story beats.
          </p>
        </div>
      ) : view === 'smart' ? (
        <ul className="lw-identitygrid">
          {sortedClusters.map((cluster) => {
            const meta = ENTITY_TYPE_META[cluster.entityType];
            const isExpanded = expanded.has(cluster.id);
            const isDrop = dragOver === cluster.id;
            const directNew =
              cluster.candidateIds.length === 1 &&
              !cluster.suggestedEntity &&
              cluster.candidates[0]?.suggestedAction === 'create';
            return (
              <li
                key={cluster.id}
                className={`lw-card lw-qcard lw-identitycard lw-identitycard--${cluster.confidenceBand}${isDrop ? ' lw-identitycard--drop' : ''}`}
                draggable
                onDragStart={(event) =>
                  writeDragPayload(event, {
                    kind: 'review-cluster',
                    entityType: cluster.entityType,
                    candidateIds: cluster.candidateIds,
                    name: cluster.primaryName,
                  })
                }
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                  setDragOver(cluster.id);
                }}
                onDragLeave={() => setDragOver((id) => (id === cluster.id ? null : id))}
                onDrop={(event) => handleClusterDrop(event, cluster)}
                data-testid="identity-cluster"
              >
                <div className="lw-qcard__top">
                  <span className="lw-qcard__type" style={{ color: meta.deep, background: meta.soft }}>
                    {meta.glyph} {meta.label}
                  </span>
                  <span className={`lw-band lw-band--${cluster.confidenceBand}`}>
                    {CERTAINTY_LABEL[cluster.certainty]} · {Math.round(cluster.confidence * 100)}%
                  </span>
                </div>


                <InterpretationControl
                  currentType={cluster.entityType}
                  candidates={cluster.candidates}
                  onChange={(entityType) => void retypeCluster(cluster.candidateIds, entityType, cluster.primaryName)}
                />

                <div className="lw-identitycard__title">
                  <div>
                    <h2>{cluster.primaryName}</h2>
                    <p>
                      {cluster.candidateIds.length} extracted record{cluster.candidateIds.length === 1 ? '' : 's'} ·{' '}
                      {cluster.evidenceCount} reference{cluster.evidenceCount === 1 ? '' : 's'} ·{' '}
                      {cluster.chapterIds.length} chapter{cluster.chapterIds.length === 1 ? '' : 's'}
                    </p>
                  </div>
                  <span className="lw-identitycard__drag" title="Drag onto another candidate or existing entity">
                    ⠿ Drag to merge
                  </span>
                </div>

                {cluster.proposedAliases.length > 0 ? (
                  <div className="lw-identitycard__aliases" aria-label="Proposed aliases">
                    {cluster.proposedAliases.map((alias) => <span key={alias} className="lw-chip lw-chip--static">{alias}</span>)}
                  </div>
                ) : null}

                {cluster.suggestedEntity ? (
                  <div className="lw-identitycard__match">
                    <div>
                      <strong>Likely existing: {cluster.suggestedEntity.entity.name}</strong>
                      <span>{Math.round(cluster.suggestedEntity.score * 100)}% identity match</span>
                    </div>
                    <div>
                      <button type="button" className="lw-btn lw-btn--primary" onClick={() => openClusterMerge(cluster)}>
                        Review merge
                      </button>
                      <button type="button" className="lw-btn" onClick={() => void rejectSuggestedEntity(cluster)}>
                        Not this entity
                      </button>
                    </div>
                  </div>
                ) : null}

                {cluster.reasons.length > 0 ? (
                  <p className="lw-identitycard__reason">
                    {cluster.reasons.map((reason) => reason.label).join(' · ')}
                  </p>
                ) : null}

                {cluster.candidates.some((candidate) => candidate.summary || candidate.sourceQuote) ? (
                  <div className="lw-identitycard__glance" aria-label="Extraction preview">
                    {cluster.candidates.slice(0, 2).map((candidate) => (
                      <div key={candidate.id} className="lw-identitycard__glanceitem">
                        {candidate.summary ? <p>{candidate.summary}</p> : null}
                        {candidate.sourceQuote ? <blockquote>“{candidate.sourceQuote}”</blockquote> : null}
                      </div>
                    ))}
                    {cluster.candidates.length > 2 ? (
                      <span>+ {cluster.candidates.length - 2} more extracted record{cluster.candidates.length - 2 === 1 ? '' : 's'}</span>
                    ) : null}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="lw-identitycard__evidencebtn"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (next.has(cluster.id)) next.delete(cluster.id);
                      else next.add(cluster.id);
                      return next;
                    })
                  }
                >
                  {isExpanded ? 'Hide' : 'Show'} every extracted detail and source
                </button>

                {isExpanded ? (
                  <ul className="lw-identitycard__evidence">
                    {cluster.candidates.map((candidate) => (
                      <li key={candidate.id}>
                        <header>
                          <strong>{candidate.name}</strong>
                          <span>{BAND_LABEL[candidate.confidenceBand]} · {Math.round(candidate.confidence * 100)}%</span>
                        </header>
                        {candidate.summary ? <p>{candidate.summary}</p> : null}
                        {candidate.sourceQuote ? <blockquote>“{candidate.sourceQuote}”</blockquote> : null}
                        {candidate.suggestedChanges && Object.keys(candidate.suggestedChanges).length > 0 ? (
                          <dl>
                            {Object.entries(candidate.suggestedChanges).map(([key, value]) => (
                              <div key={key}><dt>{key}</dt><dd>{shortValue(value)}</dd></div>
                            ))}
                          </dl>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="lw-qcard__actions lw-identitycard__actions">
                  {directNew ? (
                    <button type="button" className="lw-btn lw-btn--primary" onClick={() => void acceptNew(cluster.candidates[0])}>
                      {cluster.candidates[0].source === 'handoff' ? 'Accept' : 'Accept as new'}
                    </button>
                  ) : (
                    <button type="button" className="lw-btn lw-btn--primary" onClick={() => openClusterMerge(cluster)}>
                      Preview resolution
                    </button>
                  )}
                  <button type="button" className="lw-btn" onClick={() => findExisting(cluster)}>
                    ⌕ Find existing
                  </button>
                  {cluster.candidateIds.length > 1 ? (
                    <button type="button" className="lw-btn" onClick={() => void keepClusterSeparate(cluster)}>
                      Keep separate
                    </button>
                  ) : null}
                  <button type="button" className="lw-btn" onClick={() => void denyCluster(cluster)}>
                    Deny
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="lw-queue">
          {pending.map((candidate) => {
            const meta = ENTITY_TYPE_META[candidate.entityType];
            return (
              <li
                key={candidate.id}
                className={`lw-card lw-qcard lw-qcard--${candidate.confidenceBand}`}
                draggable
                onDragStart={(event) =>
                  writeDragPayload(event, {
                    kind: 'review-cluster',
                    entityType: candidate.entityType,
                    candidateIds: [candidate.id],
                    name: candidate.name,
                  })
                }
              >
                <div className="lw-qcard__top">
                  <span className="lw-qcard__type" style={{ color: meta.deep, background: meta.soft }}>
                    {meta.glyph} {meta.label}
                  </span>
                  <span className={`lw-band lw-band--${candidate.confidenceBand}`}>
                    {BAND_LABEL[candidate.confidenceBand]} · {Math.round(candidate.confidence * 100)}%
                  </span>
                </div>

                <InterpretationControl
                  currentType={candidate.entityType}
                  candidates={[candidate]}
                  onChange={(entityType) => void retypeCluster([candidate.id], entityType, candidate.name)}
                />
                <h2 className="lw-qcard__name">
                  {candidate.name}
                  <span className="lw-qcard__action">{candidate.suggestedAction}</span>
                </h2>
                {candidate.summary ? <p className="lw-qcard__summary">{candidate.summary}</p> : null}
                {candidate.sourceQuote ? <blockquote className="lw-qcard__quote">“{candidate.sourceQuote}”</blockquote> : null}
                <div className="lw-qcard__actions">
                  {candidate.suggestedAction === 'create' && !candidate.existingEntityId ? (
                    <button type="button" className="lw-btn lw-btn--primary" onClick={() => void acceptNew(candidate)}>
                      {candidate.source === 'handoff' ? 'Accept' : 'Accept as new'}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="lw-btn lw-btn--primary"
                      onClick={() =>
                        openMerge({
                          entityType: candidate.entityType,
                          candidateIds: [candidate.id],
                          targetEntityId: candidate.existingEntityId ?? null,
                          canonicalName: candidate.name,
                        })
                      }
                    >
                      Preview merge
                    </button>
                  )}
                  <button type="button" className="lw-btn" onClick={() => void denyCandidate(candidate.id)}>Deny</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}


function InterpretationControl({
  currentType,
  candidates,
  onChange,
}: {
  currentType: EntityType;
  candidates: ReviewCandidate[];
  onChange: (entityType: EntityType) => void;
}) {
  const byType = new Map<EntityType, EntityTypeSuggestion>();
  for (const candidate of candidates) {
    for (const suggestion of candidate.typeSuggestions ?? []) {
      const prior = byType.get(suggestion.type);
      if (!prior || suggestion.confidence > prior.confidence) byType.set(suggestion.type, suggestion);
    }
  }
  const suggestions = [...byType.values()].sort((a, b) => b.confidence - a.confidence).slice(0, 4);
  const notes = [...new Set(candidates.map((candidate) => candidate.interpretation?.note).filter(Boolean))];
  return (
    <div className="lw-interpretation" onPointerDown={(event) => event.stopPropagation()}>
      <label>
        <span>Interpret as</span>
        <select
          className="lw-input"
          value={currentType}
          onChange={(event) => onChange(event.target.value as EntityType)}
          aria-label={`Interpret ${candidates[0]?.name ?? 'candidate'} as entity type`}
        >
          {ALL_ENTITY_TYPES.map((entityType) => (
            <option key={entityType} value={entityType}>{ENTITY_TYPE_META[entityType].label}</option>
          ))}
        </select>
      </label>
      {suggestions.length ? (
        <div className="lw-interpretation__suggestions" aria-label="Suggested entity types">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.type}
              type="button"
              className={suggestion.type === currentType ? 'lw-chip lw-chip--static lw-chip--selected' : 'lw-chip lw-chip--static'}
              title={suggestion.reason}
              onClick={() => onChange(suggestion.type)}
            >
              {ENTITY_TYPE_META[suggestion.type].label} {Math.round(suggestion.confidence * 100)}%
            </button>
          ))}
        </div>
      ) : null}
      {notes.length ? <p>{notes.join(' ')}</p> : null}
    </div>
  );
}

function shortValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.length > 90 ? `${value.slice(0, 90)}…` : value;
  if (typeof value === 'object' && 'name' in (value as Record<string, unknown>)) {
    return String((value as Record<string, unknown>).name);
  }
  try {
    const text = JSON.stringify(value);
    return text.length > 90 ? `${text.slice(0, 90)}…` : text;
  } catch {
    return String(value);
  }
}

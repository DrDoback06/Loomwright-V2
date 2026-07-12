import { useEffect, useMemo, useState } from 'react';
import {
  buildMergePreview,
  commitMerge,
  resolveMergeFieldPreview,
  undoMergeReceipt,
  type AliasClassification,
  type MergeAliasOption,
  type MergeFieldDecision,
  type MergeFieldRow,
  type MergePreview,
} from '@/db/repos/merge';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { useFocusStore } from '@/stores/focus';
import { useMergeStore } from '@/stores/merge';
import { toast } from '@/stores/toasts';
import { useUiStore } from '@/stores/ui';

const DECISION_LABELS: Record<MergeFieldDecision, string> = {
  'keep-existing': 'Keep original',
  'use-incoming': 'Use incoming',
  combine: 'Combine both',
  historical: 'Keep original + record incoming historically',
  skip: 'Do not add',
};

const ALIAS_LABELS: Record<AliasClassification, string> = {
  alias: 'Alias / nickname',
  title: 'Title / rank',
  'former-name': 'Former name',
  spelling: 'Spelling variant',
  description: 'Description only',
};

export function MergePreviewDialog() {
  const request = useMergeStore((state) => state.request);
  const close = useMergeStore((state) => state.close);
  const setCanonicalNameInStore = useMergeStore((state) => state.setCanonicalName);
  const setPalettePurpose = useUiStore((state) => state.setPalettePurpose);
  const setPaletteOpen = useUiStore((state) => state.setPaletteOpen);
  const setFocus = useFocusStore((state) => state.setFocus);
  const clearFocusType = useFocusStore((state) => state.clearFocusType);

  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canonicalName, setCanonicalName] = useState('');
  const [aliases, setAliases] = useState<MergeAliasOption[]>([]);
  const [decisions, setDecisions] = useState<Record<string, MergeFieldDecision>>({});
  const [showEvidence, setShowEvidence] = useState(true);
  const [showRipple, setShowRipple] = useState(true);

  useEffect(() => {
    if (!request) {
      setPreview(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void buildMergePreview(request)
      .then((next) => {
        if (!active) return;
        setPreview(next);
        setCanonicalName(next.canonicalName);
        setAliases(next.aliases);
        setDecisions(
          Object.fromEntries(next.fields.map((field) => [field.key, field.defaultDecision]))
        );
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : 'Could not prepare this merge.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    if (!request) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [request, close]);

  const includedAliases = aliases.filter((alias) => alias.include || alias.locked);
  const conflicts = preview?.fields.filter((field) => field.hasConflict).length ?? 0;
  const selectedTargetLabel = preview?.targetEntity?.name ?? 'New canonical entity';
  const canConfirm = !!preview && canonicalName.trim().length > 0 && !saving;

  const exactChanges = useMemo(() => {
    if (!preview) return 0;
    return preview.fields.filter((field) => {
      const decision = decisions[field.key] ?? field.defaultDecision;
      return decision !== 'skip' && decision !== 'keep-existing';
    }).length;
  }, [preview, decisions]);

  if (!request) return null;

  const openTargetSearch = () => {
    setPalettePurpose('merge-target');
    setPaletteOpen(true);
  };

  const confirm = async () => {
    if (!preview || !canConfirm) return;
    setSaving(true);
    setError(null);
    try {
      setCanonicalNameInStore(canonicalName);
      const result = await commitMerge(preview, {
        canonicalName,
        aliases,
        fieldDecisions: decisions,
      });
      close();
      // The minor record may have been open in a full-screen mobile dossier.
      // Clear that stale focus so the canonical roster is visible immediately;
      // the toast still offers one-click access to the finished dossier.
      clearFocusType(result.entity.type);
      toast(
        `${result.entity.name} is now the canonical entity. ${preview.affected.occurrenceCount} mention${preview.affected.occurrenceCount === 1 ? '' : 's'} and every linked record were updated.`,
        {
          kind: 'success',
          action: {
            label: 'Open canonical',
            run: () =>
              setFocus({ id: result.entity.id, type: result.entity.type, name: result.entity.name }),
          },
        }
      );
      toast('This merge can be undone from merge history.', {
        action: {
          label: 'Undo merge',
          run: async () => {
            const undone = await undoMergeReceipt(result.receipt.id);
            toast(undone ? 'Merge fully undone.' : 'This merge could not be undone.', {
              kind: undone ? 'success' : 'error',
            });
          },
        },
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The merge could not be completed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="lw-mergepreview-backdrop" role="presentation" onMouseDown={close}>
      <section
        className="lw-mergepreview"
        role="dialog"
        aria-modal="true"
        aria-labelledby="merge-preview-title"
        data-testid="merge-preview"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="lw-mergepreview__head">
          <div>
            <p className="lw-mergepreview__eyebrow">Identity resolution · exact preview</p>
            <h1 id="merge-preview-title">Resolve these records into one identity</h1>
            <p>
              Nothing changes until you confirm. Every alias, field, chapter placement, mention,
              relationship, route, and linked tab affected by this merge is shown below.
            </p>
          </div>
          <button type="button" className="lw-iconbtn" aria-label="Close merge preview" onClick={close}>
            ×
          </button>
        </header>

        {loading ? (
          <div className="lw-mergepreview__loading">Building a project-wide merge preview…</div>
        ) : error && !preview ? (
          <div className="lw-card lw-mergepreview__error">{error}</div>
        ) : preview ? (
          <>
            <section className="lw-mergepreview__identity">
              <div className="lw-card lw-mergepreview__canonical">
                <span
                  className="lw-qcard__type"
                  style={{
                    color: ENTITY_TYPE_META[preview.entityType].deep,
                    background: ENTITY_TYPE_META[preview.entityType].soft,
                  }}
                >
                  {ENTITY_TYPE_META[preview.entityType].glyph}{' '}
                  {ENTITY_TYPE_META[preview.entityType].label}
                </span>
                <label className="lw-field">
                  <span className="lw-field__label">Canonical name</span>
                  <input
                    className="lw-input"
                    value={canonicalName}
                    onChange={(event) => setCanonicalName(event.target.value)}
                  />
                </label>
                <div className="lw-mergepreview__targetrow">
                  <span>
                    Main record: <strong>{selectedTargetLabel}</strong>
                  </span>
                  <button type="button" className="lw-btn" onClick={openTargetSearch}>
                    ⌕ Find a different existing entity
                  </button>
                </div>
                {preview.sourceEntities.length > 0 ? (
                  <p className="lw-fieldnote">
                    Dropped source{preview.sourceEntities.length === 1 ? '' : 's'}:{' '}
                    {preview.sourceEntities.map((entity) => entity.name).join(', ')}. These become
                    hidden redirects after confirmation; their old ids remain recoverable.
                  </p>
                ) : null}
              </div>

              <div className="lw-card lw-mergepreview__impact">
                <h2>What will update</h2>
                <dl>
                  <div><dt>Selected queue records</dt><dd>{preview.affected.directCandidateCount}</dd></div>
                  <div><dt>Other duplicates re-linked</dt><dd>{preview.affected.rescoreCandidateCount}</dd></div>
                  <div><dt>Manuscript mentions</dt><dd>{preview.affected.occurrenceCount}</dd></div>
                  <div><dt>Linked entities</dt><dd>{preview.affected.referencedEntityCount}</dd></div>
                  <div><dt>Explicit links</dt><dd>{preview.affected.linkCount}</dd></div>
                  <div><dt>Chapters represented</dt><dd>{preview.affected.chapterCount}</dd></div>
                  <div><dt>Location records/routes</dt><dd>{preview.affected.locationCount}</dd></div>
                </dl>
                <p className="lw-fieldnote">
                  {exactChanges} field change{exactChanges === 1 ? '' : 's'} selected ·{' '}
                  {includedAliases.length} learned name{includedAliases.length === 1 ? '' : 's'} ·{' '}
                  {conflicts} conflict{conflicts === 1 ? '' : 's'}
                </p>
              </div>
            </section>

            <section className="lw-mergepreview__section">
              <div className="lw-mergepreview__sectionhead">
                <div>
                  <h2>Every linked record that will change</h2>
                  <p>
                    This is the exact project-wide ripple before confirmation. It includes the
                    selected queue records, duplicates Loomwright will automatically attach,
                    manuscript occurrences, graph links, nested dossier references, and location
                    visit histories.
                  </p>
                </div>
                <button type="button" className="lw-btn" onClick={() => setShowRipple((show) => !show)}>
                  {showRipple ? 'Collapse' : 'Show'} linked records
                </button>
              </div>
              {showRipple ? (
                <div className="lw-mergeripple" data-testid="merge-ripple-details">
                  <RippleGroup
                    title="Review Queue"
                    count={preview.details.queue.length}
                    empty="No queue records need relinking."
                  >
                    {preview.details.queue.map((row) => (
                      <li key={row.id}>
                        <div>
                          <strong>{row.name}</strong>
                          <span>{row.chapterLabel}</span>
                        </div>
                        <p>{row.reason}</p>
                        <span className={row.direct ? 'lw-band lw-band--blue' : 'lw-band lw-band--green'}>
                          {row.direct ? 'Selected' : 'Auto-linked duplicate'}
                        </span>
                      </li>
                    ))}
                  </RippleGroup>

                  <RippleGroup
                    title="Manuscript mentions"
                    count={preview.details.occurrences.length}
                    empty="No stored manuscript occurrences need relinking."
                  >
                    {preview.details.occurrences.map((row) => (
                      <li key={row.id}>
                        <div>
                          <strong>“{row.exactText}”</strong>
                          <span>{row.chapterLabel}</span>
                        </div>
                        <p><s>{row.before}</s> <span aria-hidden="true">→</span> <strong>{row.after}</strong></p>
                      </li>
                    ))}
                  </RippleGroup>

                  <RippleGroup
                    title="Graph links"
                    count={preview.details.links.length}
                    empty="No explicit relationship links need rewriting."
                  >
                    {preview.details.links.map((row) => (
                      <li key={row.id}>
                        <div>
                          <strong>{row.kind}</strong>
                          <span>Canonical graph</span>
                        </div>
                        <p><s>{row.before}</s> <span aria-hidden="true">→</span> <strong>{row.after}</strong></p>
                      </li>
                    ))}
                  </RippleGroup>

                  <RippleGroup
                    title="Nested dossier references"
                    count={preview.details.referencedEntities.length}
                    empty="No other entity fields contain the duplicate ids."
                  >
                    {preview.details.referencedEntities.map((row) => (
                      <li key={row.id}>
                        <div>
                          <strong>{row.name}</strong>
                          <span>{ENTITY_TYPE_META[row.entityType].label}</span>
                        </div>
                        <p>{row.fieldPaths.length ? row.fieldPaths.join(' · ') : 'Embedded reference'}</p>
                      </li>
                    ))}
                  </RippleGroup>

                  <RippleGroup
                    title="Atlas and location history"
                    count={preview.details.locations.length}
                    empty="No location visit records are added by this merge."
                  >
                    {preview.details.locations.map((row) => (
                      <li key={row.id}>
                        <div>
                          <strong>{row.name}</strong>
                          <span>{row.visitCount} new visit{row.visitCount === 1 ? '' : 's'}</span>
                        </div>
                        <p>{row.chapters.length ? row.chapters.join(' · ') : 'No placed chapter evidence'}</p>
                      </li>
                    ))}
                  </RippleGroup>
                </div>
              ) : null}
            </section>

            <section className="lw-mergepreview__section">
              <div className="lw-mergepreview__sectionhead">
                <div>
                  <h2>Names Loomwright will learn</h2>
                  <p>
                    Checked names resolve straight to this entity in future extraction. Uncheck
                    proposed additions you do not want; names already on the canonical record stay locked.
                  </p>
                </div>
              </div>
              {aliases.length === 0 ? (
                <p className="lw-empty__note">No additional names are proposed.</p>
              ) : (
                <ul className="lw-mergepreview__aliases">
                  {aliases.map((alias, index) => (
                    <li key={`${alias.name}:${index}`}>
                      <label className="lw-toggle lw-mergepreview__aliascheck">
                        <input
                          type="checkbox"
                          checked={alias.include || alias.locked}
                          disabled={alias.locked}
                          onChange={(event) =>
                            setAliases((rows) =>
                              rows.map((row, rowIndex) =>
                                rowIndex === index ? { ...row, include: event.target.checked } : row
                              )
                            )
                          }
                        />
                        <strong>{alias.name}</strong>
                      </label>
                      <select
                        className="lw-input"
                        value={alias.classification}
                        disabled={!alias.include || alias.locked}
                        aria-label={`Classify ${alias.name}`}
                        onChange={(event) =>
                          setAliases((rows) =>
                            rows.map((row, rowIndex) =>
                              rowIndex === index
                                ? { ...row, classification: event.target.value as AliasClassification }
                                : row
                            )
                          )
                        }
                      >
                        {Object.entries(ALIAS_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <span className="lw-fieldnote">from {alias.source}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="lw-mergepreview__section">
              <div className="lw-mergepreview__sectionhead">
                <div>
                  <h2>Information to add or reconcile</h2>
                  <p>
                    Original information is shown beside every extracted or dragged value. The
                    recommended action is preselected, but every row remains under your control.
                  </p>
                </div>
              </div>
              {preview.fields.length === 0 ? (
                <p className="lw-empty__note">This merge only changes identity and references.</p>
              ) : (
                <div className="lw-mergefields">
                  {preview.fields.map((field) => (
                    <article
                      key={field.key}
                      className={field.hasConflict ? 'lw-mergefield lw-mergefield--conflict' : 'lw-mergefield'}
                    >
                      <header>
                        <h3>{field.label}</h3>
                        {field.hasConflict ? <span className="lw-band lw-band--orange">Conflict</span> : null}
                      </header>
                      <div className="lw-mergefield__compare">
                        <div>
                          <span className="lw-mergefield__label">Original</span>
                          <ValueBlock value={field.existingValue} empty="No existing value" />
                        </div>
                        <div>
                          <span className="lw-mergefield__label">Incoming</span>
                          {field.incoming.map((incoming) => (
                            <div key={`${field.key}:${incoming.sourceId}`} className="lw-mergefield__incoming">
                              <ValueBlock value={incoming.value} empty="Empty" />
                              <small>
                                {incoming.sourceLabel}
                                {incoming.chapterLabel ? ` · ${incoming.chapterLabel}` : ''}
                              </small>
                              {incoming.sourceQuote ? <blockquote>“{incoming.sourceQuote}”</blockquote> : null}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="lw-mergefield__decision">
                        <label>
                          <span>How to resolve</span>
                          <select
                            className="lw-input"
                            value={decisions[field.key] ?? field.defaultDecision}
                            onChange={(event) =>
                              setDecisions((current) => ({
                                ...current,
                                [field.key]: event.target.value as MergeFieldDecision,
                              }))
                            }
                          >
                            {Object.entries(DECISION_LABELS).map(([value, label]) => (
                              <option key={value} value={value}>{label}</option>
                            ))}
                          </select>
                        </label>
                        <FieldResultPreview
                          field={field}
                          decision={decisions[field.key] ?? field.defaultDecision}
                        />
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="lw-mergepreview__section">
              <div className="lw-mergepreview__sectionhead">
                <div>
                  <h2>Chapter-aware chronology</h2>
                  <p>
                    Chapter ids are the source of truth—not typed chapter numbers. Insert or move a
                    chapter and Loomwright re-sorts these facts, Atlas routes, location visits, and
                    timeline displays locally without running extraction again.
                  </p>
                </div>
                <button type="button" className="lw-btn" onClick={() => setShowEvidence((show) => !show)}>
                  {showEvidence ? 'Collapse' : 'Show'} chronology
                </button>
              </div>
              {showEvidence ? (
                <ol className="lw-mergechronology">
                  {preview.chronology.map((row, index) => (
                    <li
                      key={`${row.source}:${row.id}:${index}`}
                      className={row.source === 'incoming' ? 'lw-mergechrono lw-mergechrono--incoming' : 'lw-mergechrono'}
                    >
                      <span className={row.chapterMissing ? 'lw-mergechrono__chapter lw-mergechrono__chapter--missing' : 'lw-mergechrono__chapter'}>{row.chapterLabel}</span>
                      <span className="lw-mergechrono__summary">{row.summary}</span>
                      <span className="lw-mergechrono__source">
                        {row.source === 'incoming' ? 'Will be added' : 'Already recorded'}
                      </span>
                      {row.insertionNote ? <span className="lw-mergechrono__insert">{row.insertionNote}</span> : null}
                      {row.sourceQuote ? <blockquote>“{row.sourceQuote}”</blockquote> : null}
                    </li>
                  ))}
                </ol>
              ) : null}
            </section>

            {preview.warnings.length > 0 ? (
              <section className="lw-card lw-mergepreview__warnings">
                <h2>Safety notes</h2>
                <ul>
                  {preview.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                </ul>
              </section>
            ) : null}

            {error ? <div className="lw-card lw-mergepreview__error">{error}</div> : null}

            <footer className="lw-mergepreview__foot">
              <p>
                Confirmation creates one reversible merge receipt. Every merged source name teaches future
                extraction which record to use; checked names are also displayed on the dossier as aliases or titles for <strong>{canonicalName || 'the chosen identity'}</strong>.
              </p>
              <div>
                <button type="button" className="lw-btn" onClick={close}>Cancel</button>
                <button
                  type="button"
                  className="lw-btn lw-btn--primary"
                  disabled={!canConfirm}
                  onClick={() => void confirm()}
                >
                  {saving ? 'Merging project graph…' : 'Confirm merge everywhere'}
                </button>
              </div>
            </footer>
          </>
        ) : null}
      </section>
    </div>
  );
}


function RippleGroup({
  title,
  count,
  empty,
  children,
}: {
  title: string;
  count: number;
  empty: string;
  children: React.ReactNode;
}) {
  return (
    <section className="lw-mergeripple__group">
      <header>
        <h3>{title}</h3>
        <span className="lw-countbadge">{count}</span>
      </header>
      {count > 0 ? <ul>{children}</ul> : <p className="lw-empty__note">{empty}</p>}
    </section>
  );
}

function FieldResultPreview({
  field,
  decision,
}: {
  field: MergeFieldRow;
  decision: MergeFieldDecision;
}) {
  const result = resolveMergeFieldPreview(field, decision);
  return (
    <div className="lw-mergefield__result" data-testid={`merge-field-result-${field.key}`}>
      <span className="lw-mergefield__label">Exact value after merge</span>
      <ValueBlock value={result} empty="This field will remain empty" />
      <small>{DECISION_LABELS[decision]}</small>
    </div>
  );
}

function ValueBlock({ value, empty }: { value: unknown; empty: string }) {
  if (value === undefined || value === null || value === '') {
    return <span className="lw-mergefield__empty">{empty}</span>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="lw-mergefield__list">
        {value.map((item, index) => <li key={`${formatValue(item)}:${index}`}>{formatValue(item)}</li>)}
      </ul>
    );
  }
  return <span className="lw-mergefield__value">{formatValue(value)}</span>;
}

function formatValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    const row = value as Record<string, unknown>;
    if (typeof row.name === 'string') return row.name;
    if (typeof row.label === 'string') return row.label;
    if (typeof row.text === 'string') return row.text;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { EntityType } from '@/domain/entity-types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { getEntityConfig } from '@/domain/entity-configs';
import { deleteEntityToTrash, listEntities } from '@/db/repos/entities';
import { restoreFromTrash } from '@/db/repos/trash';
import type { Entity } from '@/db/types';
import { useEditorStore } from '@/stores/editor';
import { useFocusStore } from '@/stores/focus';
import { useGenerationStore } from '@/stores/generation';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';
import { EntityDetail } from './EntityDetail';
import { ReferenceImport } from './ReferenceImport';
import { TimelineView } from './TimelineView';
import { RelationshipGraph } from './RelationshipGraph';
import { useEffect } from 'react';

/** Full-page roster + detail surface for one entity type. */
export function EntityRosterSurface({ type }: { type: EntityType }) {
  const meta = ENTITY_TYPE_META[type];
  const config = getEntityConfig(type);
  const projectId = useProjectStore((s) => s.currentProjectId);
  const openCreate = useEditorStore((s) => s.openCreate);
  const openEdit = useEditorStore((s) => s.openEdit);
  const openGenerate = useGenerationStore((s) => s.openDialog);

  const focus = useFocusStore((s) => s.focus);
  const adoptionPending = useFocusStore((s) => s.adoptionPending);
  const setFocus = useFocusStore((s) => s.setFocus);
  const consumeFocus = useFocusStore((s) => s.consumeFocus);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const timelineCapable = type === 'events' || type === 'timeline';
  const graphCapable = type === 'relationships';
  const [view, setView] = useState<'list' | 'timeline' | 'graph'>('list');

  // Adopt cross-panel focus once: a mention click or review "Open" that
  // focused an entity of this type selects it here; consuming stops a
  // stale focus from hijacking the roster on later visits.
  useEffect(() => {
    if (adoptionPending && focus && focus.type === type) {
      setSelectedId(focus.id);
      consumeFocus();
    }
  }, [adoptionPending, focus, type, consumeFocus]);

  const entities = useLiveQuery(
    async () => (projectId ? listEntities(projectId, type) : []),
    [projectId, type],
    [] as Entity[]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.aliases.some((a) => a.toLowerCase().includes(q)) ||
        e.summary.toLowerCase().includes(q)
    );
  }, [entities, query]);

  const selected = entities.find((e) => e.id === selectedId) ?? null;

  const remove = async (entity: Entity) => {
    await deleteEntityToTrash(entity.id);
    if (selectedId === entity.id) setSelectedId(null);
    toast(`${entity.name} moved to trash.`, {
      action: {
        label: 'Undo',
        run: async () => {
          await restoreFromTrash(entity.id);
          toast(`${entity.name} restored.`, { kind: 'success' });
        },
      },
    });
  };

  const viewToggle = (timelineCapable || graphCapable) && (
    <div className="lw-viewtoggle" role="radiogroup" aria-label="View">
      <button
        type="button"
        role="radio"
        aria-checked={view === 'list'}
        className={view === 'list' ? 'lw-pill lw-pill--active' : 'lw-pill'}
        onClick={() => setView('list')}
      >
        List
      </button>
      {timelineCapable && (
        <button
          type="button"
          role="radio"
          aria-checked={view === 'timeline'}
          className={view === 'timeline' ? 'lw-pill lw-pill--active' : 'lw-pill'}
          onClick={() => setView('timeline')}
        >
          Timeline
        </button>
      )}
      {graphCapable && (
        <button
          type="button"
          role="radio"
          aria-checked={view === 'graph'}
          className={view === 'graph' ? 'lw-pill lw-pill--active' : 'lw-pill'}
          onClick={() => setView('graph')}
        >
          Graph
        </button>
      )}
    </div>
  );

  // Graph and timeline views take the full surface width.
  if (view !== 'list' && (graphCapable || timelineCapable)) {
    return (
      <div className="lw-altview" data-testid={`surface-${type}`}>
        <header className="lw-altview__head">
          <h1 className="lw-roster__title">
            <span style={{ color: meta.color }} aria-hidden>
              {meta.glyph}
            </span>{' '}
            {meta.plural}
            <span className="lw-roster__count">{entities.length}</span>
          </h1>
          {viewToggle}
        </header>
        <div className="lw-altview__body">
          {view === 'graph' ? (
            <RelationshipGraph relationships={entities} />
          ) : (
            <TimelineView type={type} entities={entities} onSelect={setSelectedId} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={selected ? 'lw-roster-surface lw-roster-surface--detail' : 'lw-roster-surface'}
      data-testid={`surface-${type}`}
    >
      <aside className="lw-roster">
        <header className="lw-roster__head">
          <h1 className="lw-roster__title">
            <span style={{ color: meta.color }} aria-hidden>
              {meta.glyph}
            </span>{' '}
            {meta.plural}
            <span className="lw-roster__count">{entities.length}</span>
          </h1>
          <span className="lw-splitbtn">
            <button
              type="button"
              className="lw-btn lw-btn--primary"
              onClick={() => openCreate(type)}
            >
              + Create {config?.displayName.toLowerCase() ?? meta.label.toLowerCase()}
            </button>
            <button
              type="button"
              className="lw-btn lw-btn--primary lw-splitbtn__more"
              aria-label={`Generate ${config?.displayName.toLowerCase() ?? meta.label.toLowerCase()} (random, AI, or paste JSON)`}
              title="Generate — random, AI, or paste JSON"
              onClick={() => openGenerate({ kind: 'entity', entityType: type })}
            >
              ✨
            </button>
          </span>
          {type === 'references' && projectId ? <ReferenceImport projectId={projectId} /> : null}
        </header>
        {viewToggle}
        <input
          className="lw-input lw-roster__search"
          type="search"
          placeholder={`Search ${meta.plural.toLowerCase()}…`}
          aria-label={`Search ${meta.plural}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {filtered.length === 0 ? (
          <div className="lw-empty">
            {entities.length === 0 ? (
              <>
                <p className="lw-empty__title">No {meta.plural.toLowerCase()} yet.</p>
                <p className="lw-empty__note">
                  Create one, or extract them from your manuscript once the Writer&apos;s Room
                  lands.
                </p>
              </>
            ) : (
              <p className="lw-empty__title">No matches for “{query}”.</p>
            )}
          </div>
        ) : (
          <ul className="lw-roster__list">
            {filtered.map((entity) => (
              <li key={entity.id}>
                <button
                  type="button"
                  className="lw-rostercard"
                  aria-current={entity.id === selectedId ? 'true' : undefined}
                  onClick={() => {
                    setSelectedId(entity.id);
                    setFocus({ id: entity.id, type: entity.type, name: entity.name });
                  }}
                >
                  <span
                    className="lw-rostercard__avatar"
                    style={{ background: meta.soft, color: meta.deep }}
                  >
                    {initials(entity.name)}
                  </span>
                  <span className="lw-rostercard__text">
                    <span className="lw-rostercard__name">{entity.name}</span>
                    {entity.summary ? (
                      <span className="lw-rostercard__sub">{entity.summary}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="lw-detailpane">
        {selected ? (
          <>
            <button
              type="button"
              className="lw-btn lw-backbtn"
              onClick={() => setSelectedId(null)}
            >
              ← Back to {meta.plural.toLowerCase()}
            </button>
            <EntityDetail
              entity={selected}
              onEdit={() => openEdit(type, selected.id)}
              onDelete={() => remove(selected)}
            />
          </>
        ) : (
          <div className="lw-empty lw-empty--center">
            <p className="lw-empty__title">
              {entities.length === 0
                ? `Your ${meta.plural.toLowerCase()} will appear here.`
                : `Select a ${config?.displayName.toLowerCase() ?? 'record'} to see the dossier.`}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { EntityType } from '@/domain/entity-types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { listEntities } from '@/db/repos/entities';
import type { Entity } from '@/db/types';
import { entitiesRelate } from '@/services/relations';
import { useFocusStore } from '@/stores/focus';
import { useLayoutStore } from '@/stores/layout';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';

/** A compact docked codex panel. Reacts to cross-panel focus: when an
 * entity of ANOTHER type is focused, the roster filters to records that
 * relate to it (the legacy "Filtered by X" chip). */
export function CodexPanel({ type }: { type: EntityType }) {
  const meta = ENTITY_TYPE_META[type];
  const projectId = useProjectStore((s) => s.currentProjectId);
  const closePanel = useLayoutStore((s) => s.closePanel);
  const setRoute = useUiStore((s) => s.setRoute);
  const setCodexType = useUiStore((s) => s.setCodexType);

  const focusedByType = useFocusStore((s) => s.focusedByType);
  const focus = useFocusStore((s) => s.focus);
  const setFocus = useFocusStore((s) => s.setFocus);
  const lock = useFocusStore((s) => s.lock);
  const toggleLock = useFocusStore((s) => s.toggleLock);

  const [query, setQuery] = useState('');
  const [chipDismissedFor, setChipDismissedFor] = useState<string | null>(null);

  const entities = useLiveQuery(
    async () => (projectId ? listEntities(projectId, type) : []),
    [projectId, type],
    [] as Entity[]
  );

  // The most recent foreign focus drives the filter chip.
  const foreignFocus = useMemo(() => {
    if (focus && focus.type !== type) return focus;
    const others = Object.values(focusedByType).filter((r) => r && r.type !== type);
    return others[others.length - 1] ?? null;
  }, [focus, focusedByType, type]);

  const chipActive = !!foreignFocus && chipDismissedFor !== foreignFocus.id;

  const foreignEntity = useLiveQuery(
    async () => {
      if (!chipActive || !foreignFocus) return undefined;
      const { getEntity } = await import('@/db/repos/entities');
      return getEntity(foreignFocus.id);
    },
    [chipActive, foreignFocus?.id],
    undefined
  );

  const rows = useMemo(() => {
    let list = entities;
    if (chipActive && foreignEntity) {
      list = list.filter((e) => entitiesRelate(e, foreignEntity));
    }
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q))
      );
    }
    return list;
  }, [entities, chipActive, foreignEntity, query]);

  const selectedId = focusedByType[type]?.id ?? null;

  return (
    <section className="lw-panel" data-testid={`panel-${type}`} aria-label={`${meta.plural} panel`}>
      <header className="lw-panel__head">
        <span className="lw-panel__title" style={{ color: meta.deep }}>
          <span aria-hidden>{meta.glyph}</span> {meta.plural}
          <span className="lw-panel__count">{entities.length}</span>
        </span>
        <span className="lw-panel__tools">
          <button
            type="button"
            className="lw-iconbtn"
            aria-label={`Expand ${meta.plural}`}
            title="Open full surface"
            onClick={() => {
              setCodexType(type);
              setRoute('codex');
            }}
          >
            ⤢
          </button>
          <button
            type="button"
            className="lw-iconbtn"
            aria-label={`Close ${meta.plural} panel`}
            onClick={() => projectId && closePanel(type, projectId)}
          >
            ×
          </button>
        </span>
      </header>

      {foreignFocus && (
        <div className="lw-panel__chiprow">
          {chipActive ? (
            <button
              type="button"
              className="lw-chip lw-chip--filter"
              aria-pressed="true"
              onClick={() => setChipDismissedFor(foreignFocus.id)}
              title="Clear this filter"
            >
              Filtered by {foreignFocus.name} ×
            </button>
          ) : (
            <button
              type="button"
              className="lw-chip"
              aria-pressed="false"
              onClick={() => setChipDismissedFor(null)}
            >
              Filter by {foreignFocus.name}
            </button>
          )}
        </div>
      )}

      <input
        className="lw-input lw-panel__search"
        type="search"
        aria-label={`Search ${meta.plural} panel`}
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {rows.length === 0 ? (
        <p className="lw-empty__note lw-panel__empty">
          {chipActive && foreignFocus
            ? `Nothing here relates to ${foreignFocus.name} yet.`
            : entities.length === 0
              ? `No ${meta.plural.toLowerCase()} yet.`
              : 'No matches.'}
        </p>
      ) : (
        <ul className="lw-panel__list">
          {rows.map((entity) => {
            const isLocked = lock?.id === entity.id;
            return (
              <li key={entity.id} className="lw-panel__row">
                <button
                  type="button"
                  className="lw-panel__rowmain"
                  aria-current={entity.id === selectedId ? 'true' : undefined}
                  onClick={() => setFocus({ id: entity.id, type: entity.type, name: entity.name })}
                >
                  <span className="lw-panel__rowname">{entity.name}</span>
                  {entity.summary ? (
                    <span className="lw-panel__rowsub">{entity.summary}</span>
                  ) : null}
                </button>
                <button
                  type="button"
                  className={isLocked ? 'lw-iconbtn lw-iconbtn--active' : 'lw-iconbtn'}
                  aria-label={isLocked ? `Unlock ${entity.name}` : `Lock ${entity.name} as context`}
                  aria-pressed={isLocked}
                  title={isLocked ? 'Unlock' : 'Lock as context'}
                  onClick={() =>
                    toggleLock({ id: entity.id, type: entity.type, name: entity.name })
                  }
                >
                  {isLocked ? '🔒' : '🔓'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

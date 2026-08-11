import { useMemo, useRef, useState } from 'react';
import { updateSceneMeta } from '@/db/repos/scenes';
import type { Scene } from '@/db/types';
import { ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';
import { MATRIX_ENTITY_TYPES, type CellSource, type PlanData } from './usePlanData';

const SOURCE_TITLE: Record<CellSource, string> = {
  asserted: 'You marked this',
  summary: 'Named in the scene summary',
  extracted: 'Found in the prose — click to make it yours',
};

/** Scenes down, codex entries across.
 *
 * Novelcrafter's matrix shows what you typed. This one also shows what the
 * extraction engine found in the prose, at reduced weight, so the grid
 * fills itself in as you write and a click promotes a finding to a fact.
 * No competitor can draw that column, because none of them read the book.
 */
export function MatrixView({
  data,
  onOpenScene,
}: {
  data: PlanData;
  onOpenScene: (id: string) => void;
}) {
  const [axis, setAxis] = useState<EntityType>('cast');
  const gridRef = useRef<HTMLTableElement>(null);

  const columns = useMemo(
    () =>
      data.entities
        .filter((e) => e.type === axis)
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, 40),
    [data.entities, axis]
  );

  const meta = ENTITY_TYPE_META[axis];

  const toggle = (scene: Scene, entityId: string, current: CellSource | undefined) => {
    // Only the author's own marks are removable. Un-asserting something
    // extraction found would be a lie the next save would undo, so an
    // asserted cell clears back to whatever the engine still believes.
    const asserted = new Set(scene.characterIds);
    if (axis === 'locations') {
      void updateSceneMeta(scene.id, {
        locationId: scene.locationId === entityId ? null : entityId,
      });
      return;
    }
    if (current === 'asserted') asserted.delete(entityId);
    else asserted.add(entityId);
    void updateSceneMeta(scene.id, { characterIds: [...asserted] });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTableElement>) => {
    const key = e.key;
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) return;
    const cell = (e.target as HTMLElement).closest('td, th');
    const row = cell?.parentElement as HTMLTableRowElement | null;
    if (!cell || !row) return;
    e.preventDefault();
    const columnIndex = Array.from(row.children).indexOf(cell);
    const rows = Array.from(gridRef.current?.querySelectorAll('tbody tr') ?? []);
    const rowIndex = rows.indexOf(row);

    const nextRow =
      key === 'ArrowUp' ? rows[rowIndex - 1] : key === 'ArrowDown' ? rows[rowIndex + 1] : row;
    const nextColumn =
      key === 'ArrowLeft' ? columnIndex - 1 : key === 'ArrowRight' ? columnIndex + 1 : columnIndex;
    const target = nextRow?.children[Math.max(0, nextColumn)] as HTMLElement | undefined;
    target?.querySelector('button')?.focus();
  };

  if (data.scenes.length === 0) {
    return (
      <div className="lw-empty lw-empty--center">
        <p className="lw-empty__title">No scenes to plot yet.</p>
        <p className="lw-empty__note">
          Write a scene, or paste a chapter on Import &amp; Extract — the grid fills itself in
          from what the engine finds.
        </p>
      </div>
    );
  }

  return (
    <div className="lw-matrix" data-testid="plan-matrix">
      <div className="lw-board__controls">
        <span className="lw-tweak__label" id="matrix-axis">
          Show
        </span>
        <div className="lw-tweak__options" role="group" aria-labelledby="matrix-axis">
          {MATRIX_ENTITY_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              className={type === axis ? 'lw-pill lw-pill--active' : 'lw-pill'}
              aria-pressed={type === axis}
              onClick={() => setAxis(type)}
            >
              {ENTITY_TYPE_META[type].plural}
            </button>
          ))}
        </div>
        <p className="lw-fieldnote">
          Solid is yours. Underlined came from a scene summary. Faint is what extraction
          found in the prose — click one to make it yours.
        </p>
      </div>

      {columns.length === 0 ? (
        <p className="lw-empty__note">
          No {meta.plural.toLowerCase()} in the codex yet — nothing to plot against.
        </p>
      ) : (
        <div className="lw-matrix__scroll">
          <table className="lw-matrix__grid" ref={gridRef} onKeyDown={onKeyDown}>
            <thead>
              <tr>
                <th scope="col" className="lw-matrix__corner">
                  Scene
                </th>
                {columns.map((entity) => (
                  <th key={entity.id} scope="col" className="lw-matrix__colhead">
                    <span style={{ color: meta.color }} aria-hidden>
                      {meta.glyph}
                    </span>
                    <span className="lw-matrix__colname">{entity.name}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.scenes.map((scene) => (
                <tr key={scene.id}>
                  <th scope="row" className="lw-matrix__rowhead">
                    <button
                      type="button"
                      className="lw-matrix__scenebtn"
                      onClick={() => onOpenScene(scene.id)}
                    >
                      <span className="lw-matrix__scenename">{scene.title}</span>
                      <span className="lw-matrix__scenechapter">
                        {data.chapterOf.get(scene.id)?.title ?? ''}
                      </span>
                    </button>
                  </th>
                  {columns.map((entity) => {
                    const source = data.presence.get(`${scene.id}|${entity.id}`);
                    return (
                      <td key={entity.id} className="lw-matrix__cell">
                        <button
                          type="button"
                          className={
                            source
                              ? `lw-matrix__mark lw-matrix__mark--${source}`
                              : 'lw-matrix__mark'
                          }
                          data-source={source ?? 'none'}
                          aria-pressed={source === 'asserted'}
                          title={
                            source
                              ? `${entity.name} · ${SOURCE_TITLE[source]}`
                              : `Mark ${entity.name} as present in ${scene.title}`
                          }
                          aria-label={`${entity.name} in ${scene.title}${
                            source ? ` — ${SOURCE_TITLE[source]}` : ''
                          }`}
                          style={source ? { backgroundColor: meta.color } : undefined}
                          onClick={() => toggle(scene, entity.id, source)}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

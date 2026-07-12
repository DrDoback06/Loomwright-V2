import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { getOrCreateMap, movePin, placePin, removePin, setLayer } from '@/db/repos/atlas';
import { listEntities } from '@/db/repos/entities';
import type { AtlasPin, Entity } from '@/db/types';
import { ENTITY_TYPE_META, type EntityRef } from '@/domain/entity-types';
import { useCanvas } from '@/features/canvas/useCanvas';
import { useFocusStore } from '@/stores/focus';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';
import type { ChapterAnchoredFact } from '@/services/chapter-awareness';

const WORLD = 1000; // map-space square

/** The Atlas: a pannable, zoomable world map. Place location pins, drag
 * them, and read derived character travel routes (from each cast
 * member's chapter-anchored travelTimeline (with a legacy history fallback). */
export function AtlasSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setFocus = useFocusStore((s) => s.setFocus);
  const focus = useFocusStore((s) => s.focus);

  // liveQuery must stay read-only — creation happens in the effect below.
  const map = useLiveQuery(
    async () => (projectId ? db.atlasMaps.where('projectId').equals(projectId).first() : undefined),
    [projectId]
  );
  useEffect(() => {
    if (projectId && map === undefined) void getOrCreateMap(projectId);
  }, [projectId, map]);
  const locations = useLiveQuery(
    async () => (projectId ? listEntities(projectId, 'locations') : []),
    [projectId],
    [] as Entity[]
  );
  const cast = useLiveQuery(
    async () => (projectId ? listEntities(projectId, 'cast') : []),
    [projectId],
    [] as Entity[]
  );

  const { viewport, rootRef, toCanvas, claimPointer, handlers } = useCanvas({ x: 40, y: 20, scale: 0.9 });
  const [placing, setPlacing] = useState<EntityRef | null>(null);
  const dragging = useRef<{ pinId: string } | null>(null);

  const unplaced = useMemo(
    () => locations.filter((l) => !map?.pins.some((p) => p.entity.id === l.id)),
    [locations, map?.pins]
  );

  // Derived travel routes: for each cast member, the polyline through
  // their travelHistory pins ending at currentLocation.
  const travelRoutes = useMemo(() => {
    if (!map || !map.layers.travel) return [];
    const pinByEntity = new Map(map.pins.map((p) => [p.entity.id, p]));
    const routes: { castName: string; points: AtlasPin[]; color: string }[] = [];
    for (const member of cast) {
      const stops: AtlasPin[] = [];
      const timeline = member.fields.travelTimeline;
      if (Array.isArray(timeline) && timeline.length > 0) {
        for (const fact of timeline as ChapterAnchoredFact[]) {
          const pin = fact.location ? pinByEntity.get(fact.location.id) : undefined;
          if (pin && stops[stops.length - 1]?.id !== pin.id) stops.push(pin);
        }
      } else {
        const history = member.fields.travelHistory;
        if (Array.isArray(history)) {
          for (const ref of history as EntityRef[]) {
            const pin = pinByEntity.get(ref?.id);
            if (pin && stops[stops.length - 1]?.id !== pin.id) stops.push(pin);
          }
        }
        const current = member.fields.currentLocation as EntityRef | undefined;
        if (current) {
          const pin = pinByEntity.get(current.id);
          if (pin && stops[stops.length - 1]?.id !== pin.id) stops.push(pin);
        }
      }
      if (stops.length >= 2) {
        routes.push({
          castName: member.name,
          points: stops,
          color: ENTITY_TYPE_META.cast.color,
        });
      }
    }
    return routes;
  }, [map, cast]);

  if (!projectId || !map) return null;

  const meta = ENTITY_TYPE_META.locations;

  const onCanvasClick = (e: React.MouseEvent) => {
    if (!placing) return;
    const { x, y } = toCanvas(e.clientX, e.clientY);
    if (x < 0 || y < 0 || x > WORLD || y > WORLD) return;
    void placePin(map.id, placing, Math.round(x), Math.round(y)).then(() => {
      toast(`${placing.name} pinned to the map.`, { kind: 'success' });
      setPlacing(null);
    });
  };

  const startPinDrag = (e: React.PointerEvent, pin: AtlasPin) => {
    e.stopPropagation();
    claimPointer();
    dragging.current = { pinId: pin.id };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  const onPinMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const { x, y } = toCanvas(e.clientX, e.clientY);
    void movePin(map.id, dragging.current.pinId, Math.round(x), Math.round(y));
  };
  const endPinDrag = () => {
    dragging.current = null;
  };

  return (
    <div className="lw-atlas" data-testid="surface-atlas">
      <aside className="lw-atlas__side">
        <h1 className="lw-atlas__title">
          <span style={{ color: meta.color }} aria-hidden>
            ◇
          </span>{' '}
          Atlas
        </h1>
        <p className="lw-fieldnote">
          Pin your locations, drag them into place, and watch character travel routes emerge.
        </p>

        <div className="lw-atlas__layers" role="group" aria-label="Layers">
          {(['labels', 'travel', 'grid'] as const).map((layer) => (
            <label key={layer} className="lw-toggle">
              <input
                type="checkbox"
                checked={map.layers[layer]}
                onChange={(e) => void setLayer(map.id, layer, e.target.checked)}
              />
              <span>{layer === 'travel' ? 'Travel routes' : layer[0].toUpperCase() + layer.slice(1)}</span>
            </label>
          ))}
        </div>

        <h2 className="lw-atlas__subhead">Unplaced locations</h2>
        {unplaced.length === 0 ? (
          <p className="lw-empty__note">
            {locations.length === 0
              ? 'No locations yet — create some in the Locations codex.'
              : 'Everything is on the map.'}
          </p>
        ) : (
          <ul className="lw-atlas__unplaced">
            {unplaced.map((loc) => (
              <li key={loc.id}>
                <button
                  type="button"
                  className={
                    placing?.id === loc.id ? 'lw-btn lw-btn--primary' : 'lw-btn'
                  }
                  aria-pressed={placing?.id === loc.id}
                  onClick={() =>
                    setPlacing(
                      placing?.id === loc.id
                        ? null
                        : { id: loc.id, type: loc.type, name: loc.name }
                    )
                  }
                >
                  ▲ {loc.name}
                </button>
              </li>
            ))}
          </ul>
        )}
        {placing && (
          <p className="lw-atlas__hint" data-testid="placing-hint">
            Click the map to place <strong>{placing.name}</strong>.
          </p>
        )}

        <h2 className="lw-atlas__subhead">Pinned</h2>
        <ul className="lw-atlas__pinned">
          {map.pins.map((pin) => (
            <li key={pin.id} className="lw-atlas__pinrow">
              <button
                type="button"
                className="lw-panel__rowmain"
                aria-current={focus?.id === pin.entity.id ? 'true' : undefined}
                onClick={() => setFocus(pin.entity)}
              >
                <span className="lw-panel__rowname">▲ {pin.entity.name}</span>
              </button>
              <button
                type="button"
                className="lw-iconbtn"
                aria-label={`Unpin ${pin.entity.name}`}
                onClick={() => void removePin(map.id, pin.id)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      </aside>

      <div
        ref={rootRef}
        className={placing ? 'lw-atlas__canvas lw-atlas__canvas--placing' : 'lw-atlas__canvas'}
        data-testid="atlas-canvas"
        {...handlers}
        onClick={onCanvasClick}
      >
        <svg
          className="lw-atlas__svg"
          style={{
            transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`,
          }}
          width={WORLD}
          height={WORLD}
          viewBox={`0 0 ${WORLD} ${WORLD}`}
        >
          <rect x={0} y={0} width={WORLD} height={WORLD} className="lw-atlas__parchment" rx={12} />
          {map.layers.grid && (
            <g className="lw-atlas__grid">
              {Array.from({ length: 9 }, (_, i) => (i + 1) * 100).map((v) => (
                <g key={v}>
                  <line x1={v} y1={0} x2={v} y2={WORLD} />
                  <line x1={0} y1={v} x2={WORLD} y2={v} />
                </g>
              ))}
            </g>
          )}

          {travelRoutes.map((route) => (
            <g key={route.castName} className="lw-atlas__route" data-testid="travel-route">
              <polyline
                points={route.points.map((p) => `${p.x},${p.y}`).join(' ')}
                style={{ stroke: route.color }}
              />
              {map.layers.labels && route.points.length > 0 && (
                <text
                  x={route.points[route.points.length - 1].x + 14}
                  y={route.points[route.points.length - 1].y - 14}
                  className="lw-atlas__routelabel"
                >
                  {route.castName}
                </text>
              )}
            </g>
          ))}

          {map.pins.map((pin) => (
            <g
              key={pin.id}
              className="lw-atlas__pin"
              data-testid={`pin-${pin.entity.name}`}
              transform={`translate(${pin.x}, ${pin.y})`}
              onPointerDown={(e) => startPinDrag(e, pin)}
              onPointerMove={onPinMove}
              onPointerUp={endPinDrag}
              onClick={(e) => {
                e.stopPropagation();
                setFocus(pin.entity);
              }}
            >
              {/* generous invisible hit circle for touch */}
              <circle r={22} fill="transparent" />
              <path
                d="M0 0 C -9 -14, -9 -24, 0 -26 C 9 -24, 9 -14, 0 0 Z"
                className="lw-atlas__pinshape"
                style={{ fill: meta.color }}
              />
              <circle cx={0} cy={-19} r={4} className="lw-atlas__pindot" />
              {map.layers.labels && (
                <text x={0} y={14} textAnchor="middle" className="lw-atlas__pinlabel">
                  {pin.entity.name}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

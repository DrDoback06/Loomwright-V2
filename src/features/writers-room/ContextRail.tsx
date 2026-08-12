import { useEffect, useState } from 'react';
import type { Scene } from '@/db/types';
import { updateSceneMeta } from '@/db/repos/scenes';
import { ENTITY_TYPE_META, type EntityRef } from '@/domain/entity-types';
import { readDragPayload, writeDragPayload } from '@/services/drag';
import {
  buildSceneContext,
  type ContextItem,
  type ContextLane,
  type SceneContext,
} from '@/services/context/scene-context';
import { useEditorStore } from '@/stores/editor';
import { useFocusStore } from '@/stores/focus';

const LANES: { key: ContextLane; title: string; note: string }[] = [
  { key: 'always', title: 'Always sent', note: 'In every prompt for this scene.' },
  { key: 'detected', title: 'Found in this scene', note: 'Named in the prose, or linked with @.' },
  { key: 'excluded', title: 'Not sent', note: 'Kept out, and why.' },
];

/** Where the meter turns. Below 75% there is nothing to say; past 100% the
 * assembler has already dropped entries, so the bar is reporting a fact
 * rather than warning about a risk. */
function tone(used: number, budget: number): 'ok' | 'warn' | 'risk' {
  const pct = budget > 0 ? used / budget : 0;
  return pct >= 0.98 ? 'risk' : pct >= 0.75 ? 'warn' : 'ok';
}

/**
 * What the model will be told about this scene, and why.
 *
 * The most trust-building surface in the app: the Preview is not a summary
 * of the payload, it is the payload. Everything here is computed offline by
 * `buildSceneContext`, so it is identical with or without an API key.
 *
 * Lane moves are **per-scene**. Dragging a chip to Always writes
 * `scene.attachedRefs`; dragging it out writes `scene.excludedRefs`. Neither
 * touches the entity's own policy — a gesture made while reading one scene
 * must not silently change what the other two hundred send. The global
 * setting is one click away on each chip, and is unmistakably a different
 * act.
 */
export function ContextRail({ scene, onClose }: { scene: Scene; onClose: () => void }) {
  const [ctx, setCtx] = useState<SceneContext | null>(null);
  const [openChip, setOpenChip] = useState<string | null>(null);
  const [dropLane, setDropLane] = useState<ContextLane | null>(null);
  const lock = useFocusStore((s) => s.lock);
  const openEdit = useEditorStore((s) => s.openEdit);

  // Recomputed whenever the prose, the metadata or the pin changes. Cheap and
  // synchronous apart from one Dexie read, so there is no debounce: a stale
  // Preview would be worse than a slightly eager one.
  useEffect(() => {
    let live = true;
    void buildSceneContext(scene.projectId, scene, { pinned: lock ? [lock] : [] }).then((next) => {
      if (live) setCtx(next);
    });
    return () => {
      live = false;
    };
  }, [scene, lock]);

  const move = async (ref: EntityRef, to: ContextLane) => {
    const attached = (scene.attachedRefs ?? []).filter((r) => r.id !== ref.id);
    const excluded = (scene.excludedRefs ?? []).filter((r) => r.id !== ref.id);
    if (to === 'always') attached.push(ref);
    if (to === 'excluded') excluded.push(ref);
    // 'detected' means "stop asserting either way" — let the scan decide.
    await updateSceneMeta(scene.id, { attachedRefs: attached, excludedRefs: excluded });
    // The chip has moved lanes, so a popover still anchored to where it used
    // to be is pointing at nothing.
    setOpenChip(null);
  };

  const laneItems = (lane: ContextLane) => (ctx?.items ?? []).filter((i) => i.lane === lane);
  const used = ctx?.used ?? 0;
  const budget = ctx?.budget ?? 0;
  const pct = budget > 0 ? Math.min(100, Math.round((used / budget) * 100)) : 0;

  return (
    <aside className="lw-ctxrail" aria-label="AI context" data-testid="context-rail">
      <div className="lw-ctxrail__head">
        <strong>AI context</strong>
        <button type="button" className="lw-iconbtn" aria-label="Close AI context" onClick={onClose}>
          ×
        </button>
      </div>

      <p className="lw-fieldnote">
        Exactly what a model is told about this scene. Moving a chip changes this scene only.
      </p>

      {/* The app's first meter. Characters, not tokens — there is no
          tokeniser in this repo, and a made-up token count is a number
          someone would act on. */}
      <div className="lw-budget" data-tone={tone(used, budget)}>
        <div className="lw-budget__track">
          <div className="lw-budget__fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="lw-budget__label" data-testid="context-budget">
          {used.toLocaleString()} of {budget.toLocaleString()} characters
          {ctx?.trimmed ? ' — trimmed to fit' : ''}
        </p>
      </div>

      {LANES.map((lane) => {
        const items = laneItems(lane.key);
        const droppable = lane.key !== 'detected';
        return (
          <section
            key={lane.key}
            className={
              dropLane === lane.key ? 'lw-ctxlane lw-ctxlane--drop' : 'lw-ctxlane'
            }
            aria-label={lane.title}
            onDragOver={(e) => {
              if (!droppable) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDropLane(lane.key);
            }}
            onDragLeave={() => setDropLane((l) => (l === lane.key ? null : l))}
            onDrop={(e) => {
              if (!droppable) return;
              e.preventDefault();
              setDropLane(null);
              const payload = readDragPayload(e);
              // The drag payload is entityId/entityType; an EntityRef is
              // id/type/name. Not interchangeable.
              if (payload?.kind !== 'entity') return;
              void move(
                { id: payload.entityId, type: payload.entityType, name: payload.name },
                lane.key
              );
            }}
          >
            <span className="lw-ctxlane__title">{lane.title}</span>
            <p className="lw-fieldnote">{lane.note}</p>
            {items.length === 0 ? (
              <p className="lw-empty__note">Nothing here.</p>
            ) : (
              <div className="lw-chips__row">
                {items.map((item) => (
                  <ContextChip
                    key={item.ref.id}
                    item={item}
                    open={openChip === item.ref.id}
                    onToggle={() =>
                      setOpenChip((id) => (id === item.ref.id ? null : item.ref.id))
                    }
                    onMove={(to) => void move(item.ref, to)}
                    onOpenEntity={() => {
                      openEdit(item.ref.type, item.ref.id);
                      setOpenChip(null);
                    }}
                  />
                ))}
              </div>
            )}
          </section>
        );
      })}

      <details className="lw-ctxpreview">
        <summary className="lw-fieldnote">Show exactly what gets sent</summary>
        <pre className="lw-ctxpreview__body" data-testid="context-preview">
          {ctx?.text || 'Nothing to send for this scene yet.'}
        </pre>
      </details>
    </aside>
  );
}

function ContextChip({
  item,
  open,
  onToggle,
  onMove,
  onOpenEntity,
}: {
  item: ContextItem;
  open: boolean;
  onToggle: () => void;
  onMove: (to: ContextLane) => void;
  onOpenEntity: () => void;
}) {
  const meta = ENTITY_TYPE_META[item.ref.type];
  return (
    <span className="lw-ctxchip">
      <button
        type="button"
        className="lw-chip"
        aria-expanded={open}
        onClick={onToggle}
        draggable
        onDragStart={(e) =>
          writeDragPayload(e, {
            kind: 'entity',
            entityType: item.ref.type,
            entityId: item.ref.id,
            name: item.ref.name,
          })
        }
      >
        <span aria-hidden>{meta.glyph}</span> {item.ref.name}
        <span className="lw-ctxchip__reason">{item.reason}</span>
      </button>

      {open ? (
        <div className="lw-ctxchip__pop" role="group" aria-label={`${item.ref.name} in context`}>
          {/* The keyboard and touch path for the same move — a drag handle
              alone puts this out of reach on a phone and for a screen
              reader. */}
          <div className="lw-ctxchip__moves">
            {LANES.filter((l) => l.key !== item.lane && l.key !== 'detected').map((l) => (
              <button
                key={l.key}
                type="button"
                className="lw-btn lw-btn--sm"
                onClick={() => onMove(l.key)}
              >
                {l.key === 'always' ? 'Always send' : "Don't send here"}
              </button>
            ))}
            {item.lane !== 'detected' ? (
              <button
                type="button"
                className="lw-btn lw-btn--sm"
                onClick={() => onMove('detected')}
              >
                Let the scan decide
              </button>
            ) : null}
          </div>

          {item.digest ? (
            <pre className="lw-ctxchip__digest">{item.digest}</pre>
          ) : (
            <p className="lw-fieldnote">Nothing is sent for this entry.</p>
          )}

          <button type="button" className="lw-btn lw-btn--ghost lw-btn--sm" onClick={onOpenEntity}>
            Change this everywhere…
          </button>
        </div>
      ) : null}
    </span>
  );
}

import { useMemo } from 'react';
import type { Entity } from '@/db/types';
import { ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';
import { useFocusStore } from '@/stores/focus';

/** Chronological lane for events/timeline entries. Ordering: the
 * `order`/`when`/`date` field when present (numeric or lexicographic),
 * otherwise creation time. Clicking a card focuses the entity. */
export function TimelineView({
  type,
  entities,
  onSelect,
}: {
  type: EntityType;
  entities: Entity[];
  onSelect: (id: string) => void;
}) {
  const meta = ENTITY_TYPE_META[type];
  const setFocus = useFocusStore((s) => s.setFocus);

  const ordered = useMemo(() => {
    const sortKey = (e: Entity): [number, string] => {
      const raw =
        e.fields.order ?? e.fields.when ?? e.fields.date ?? e.fields.timelinePosition ?? e.fields.chapter;
      if (typeof raw === 'number') return [raw, ''];
      if (typeof raw === 'string' && raw.trim()) {
        const n = Number(raw);
        return Number.isFinite(n) ? [n, ''] : [Number.MAX_SAFE_INTEGER / 2, raw.toLowerCase()];
      }
      return [Number.MAX_SAFE_INTEGER, String(e.createdAt)];
    };
    return [...entities].sort((a, b) => {
      const [na, sa] = sortKey(a);
      const [nb, sb] = sortKey(b);
      return na - nb || sa.localeCompare(sb) || a.createdAt - b.createdAt;
    });
  }, [entities]);

  if (ordered.length === 0) {
    return (
      <div className="lw-empty lw-empty--center">
        <p className="lw-empty__title">No {meta.plural.toLowerCase()} on the timeline yet.</p>
        <p className="lw-empty__note">
          Create events (or extract them from chapters) and give them a “when” or “order” to
          arrange them here.
        </p>
      </div>
    );
  }

  return (
    <ol className="lw-timeline" data-testid="timeline-view">
      {ordered.map((e) => {
        const when =
          (typeof e.fields.when === 'string' && e.fields.when) ||
          (typeof e.fields.date === 'string' && e.fields.date) ||
          (typeof e.fields.chapter === 'string' && e.fields.chapter) ||
          (typeof e.fields.timelinePosition === 'string' && e.fields.timelinePosition) ||
          (typeof e.fields.order === 'string' && `#${e.fields.order}`) ||
          '';
        const cause = typeof e.fields.cause === 'string' ? e.fields.cause : '';
        return (
          <li key={e.id} className="lw-timeline__item">
            <span className="lw-timeline__dot" style={{ background: meta.color }} aria-hidden />
            <button
              type="button"
              className="lw-timeline__card"
              onClick={() => {
                onSelect(e.id);
                setFocus({ id: e.id, type: e.type, name: e.name });
              }}
            >
              <span className="lw-timeline__when">{when || '—'}</span>
              <span className="lw-timeline__name">{e.name}</span>
              {e.summary ? <span className="lw-timeline__summary">{e.summary}</span> : null}
              {cause ? <span className="lw-timeline__cause">← {cause}</span> : null}
            </button>
          </li>
        );
      })}
    </ol>
  );
}

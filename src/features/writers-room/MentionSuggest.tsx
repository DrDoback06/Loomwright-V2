import { useCallback, useEffect, useMemo, useState, type RefObject } from 'react';
import { posToDOMRect, type Editor } from '@tiptap/core';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { createEntity } from '@/db/repos/entities';
import type { Entity } from '@/db/types';
import { ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';
import { toast } from '@/stores/toasts';
import { mentionQuery, type MentionQuery } from './mention-suggest';
import { swallowEditorKeys } from './swallow';

/** The types offered when creating an entity from the prose. Every type is
 * *searchable*; these are the ones it makes sense to invent mid-sentence,
 * and they are the same five the Matrix plots. */
const CREATABLE: EntityType[] = ['cast', 'locations', 'factions', 'quests', 'items'];

/** Rows shown at once. Enough to choose from, few enough to read. */
const LIMIT = 7;

/** Ranking weight per type. Nothing is hidden — all sixteen types are
 * searchable — but a codex holds far more stats and references than
 * characters, and "@vex" almost always means the person. */
const TYPE_WEIGHT = new Map<EntityType, number>(CREATABLE.map((type, i) => [type, 5 - i]));

interface Candidate {
  entity: Entity;
  score: number;
}

/** Match quality first, then how story-shaped the type is, then how often
 * the entity already appears. Same shape as `commandScore` in the command
 * palette, for the same reason: a substring match must never outrank the
 * thing whose name you actually typed. */
function score(entity: Entity, q: string, mentions: number): number {
  const name = entity.name.toLowerCase();
  const aliases = entity.aliases.map((a) => a.toLowerCase());
  let base: number;
  if (name === q) base = 0;
  else if (name.startsWith(q)) base = 1;
  else if (aliases.some((a) => a === q)) base = 2;
  else if (aliases.some((a) => a.startsWith(q))) base = 3;
  else if (name.includes(q)) base = 4;
  else if (aliases.some((a) => a.includes(q))) base = 5;
  else if (entity.summary.toLowerCase().includes(q)) base = 6;
  else return Number.POSITIVE_INFINITY;
  // Ties break towards story types, then towards entities already in play.
  return base * 100 - (TYPE_WEIGHT.get(entity.type) ?? 0) * 5 - Math.min(mentions, 20) * 0.1;
}

/** The `@` picker.
 *
 * Every one of the sixteen codex types is searchable — nothing in your
 * world should be unmentionable — and the ranking, not a filter, is what
 * keeps the list worth reading. */
export function MentionSuggest({
  editor,
  projectId,
  canvasRef,
}: {
  editor: Editor;
  projectId: string;
  canvasRef: RefObject<HTMLDivElement | null>;
}) {
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [index, setIndex] = useState(0);
  const [creating, setCreating] = useState(false);
  const [anchor, setAnchor] = useState<{ top: number; left: number } | null>(null);

  const entities = useLiveQuery(
    async () =>
      (await db.entities.where('projectId').equals(projectId).toArray()).filter(
        (e) => e.status === 'active'
      ),
    [projectId],
    [] as Entity[]
  );

  /** How many times each entity is already mentioned, for tie-breaking.
   * Cheap: one index read per project, and it only re-runs when
   * occurrences actually change. */
  const mentionCounts = useLiveQuery(
    async () => {
      const rows = await db.occurrences.where('projectId').equals(projectId).toArray();
      const counts = new Map<string, number>();
      for (const row of rows) {
        if (row.entityId) counts.set(row.entityId, (counts.get(row.entityId) ?? 0) + 1);
      }
      return counts;
    },
    [projectId],
    new Map<string, number>()
  );

  const sync = useCallback(() => {
    const next = mentionQuery(editor.state);
    setQuery(next);
    const canvas = canvasRef.current;
    if (!next || !canvas) {
      setAnchor(null);
      return;
    }
    // Viewport coordinates from `posToDOMRect`, so the canvas rect comes
    // off and its scroll offset goes back on — the same arithmetic the
    // rewrite bubble does.
    const rect = posToDOMRect(editor.view, next.from, next.to);
    const box = canvas.getBoundingClientRect();
    setAnchor({
      top: rect.bottom - box.top + canvas.scrollTop,
      left: Math.min(Math.max(rect.left - box.left, 8), Math.max(8, box.width - 300)),
    });
  }, [editor, canvasRef]);

  useEffect(() => {
    editor.on('transaction', sync);
    return () => {
      editor.off('transaction', sync);
    };
  }, [editor, sync]);

  const term = (query?.text ?? '').trim().toLowerCase();

  const matches: Candidate[] = useMemo(() => {
    if (!query) return [];
    if (!term) {
      // A bare `@` offers what is most in play rather than nothing —
      // alphabetical would put whoever you named Aaron first forever.
      return [...entities]
        .map((entity) => ({ entity, score: -(mentionCounts.get(entity.id) ?? 0) }))
        .sort((a, b) => a.score - b.score || a.entity.name.localeCompare(b.entity.name))
        .slice(0, LIMIT);
    }
    return entities
      .map((entity) => ({ entity, score: score(entity, term, mentionCounts.get(entity.id) ?? 0) }))
      .filter((c) => Number.isFinite(c.score))
      .sort((a, b) => a.score - b.score || a.entity.name.localeCompare(b.entity.name))
      .slice(0, LIMIT);
  }, [entities, mentionCounts, query, term]);

  // A create row only makes sense once there is a name to give.
  const canCreate = term.length >= 2;
  const rowCount = matches.length + (canCreate ? 1 : 0);
  const onCreateRow = canCreate && index === matches.length;

  useEffect(() => {
    setIndex(0);
    setCreating(false);
  }, [term, query?.from]);

  const link = useCallback(
    (entity: Entity) => {
      if (!query) return;
      editor.commands.insertMention({
        from: query.from,
        to: query.to,
        entityId: entity.id,
        entityType: entity.type,
        label: entity.name,
      });
    },
    [editor, query]
  );

  const create = useCallback(
    async (type: EntityType) => {
      if (!query) return;
      const name = query.text.trim();
      try {
        const entity = await createEntity({ projectId, type, name });
        link(entity);
        toast(`Created ${ENTITY_TYPE_META[type].label.toLowerCase()} “${entity.name}”.`, {
          kind: 'success',
        });
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not create that entry.', {
          kind: 'error',
        });
      }
    },
    [projectId, query, link]
  );

  /** Installed on the plugin so ↑ ↓ Enter Tab never reach the prose while
   * the list is open — and, just as importantly, so every other key does. */
  useEffect(() => {
    const storage = editor.storage.mentionSuggest;
    storage.onKey = (event: KeyboardEvent) => {
      if (!rowCount) return false;
      if (event.key === 'ArrowDown') {
        setIndex((i) => (i + 1) % rowCount);
        return true;
      }
      if (event.key === 'ArrowUp') {
        setIndex((i) => (i - 1 + rowCount) % rowCount);
        return true;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        if (onCreateRow) setCreating(true);
        else if (matches[index]) link(matches[index].entity);
        return true;
      }
      return false;
    };
    return () => {
      storage.onKey = null;
    };
  }, [editor, rowCount, index, matches, onCreateRow, link]);

  if (!query || !anchor || rowCount === 0) return null;

  return (
    <div
      className="lw-suggest"
      data-testid="mention-suggest"
      style={
        { '--suggest-top': `${anchor.top}px`, '--suggest-left': `${anchor.left}px` } as React.CSSProperties
      }
      contentEditable={false}
      {...swallowEditorKeys}
    >
      <ul className="lw-suggest__list" role="listbox" aria-label="Codex entries">
        {matches.map((candidate, i) => {
          const meta = ENTITY_TYPE_META[candidate.entity.type];
          return (
            <li key={candidate.entity.id}>
              <button
                type="button"
                role="option"
                aria-selected={i === index}
                className={i === index ? 'lw-suggest__row lw-suggest__row--on' : 'lw-suggest__row'}
                onMouseEnter={() => setIndex(i)}
                onClick={() => link(candidate.entity)}
              >
                <span className="lw-suggest__glyph" style={{ color: meta.color }} aria-hidden>
                  {meta.glyph}
                </span>
                <span className="lw-suggest__name">{candidate.entity.name}</span>
                <span className="lw-suggest__type">{meta.label}</span>
              </button>
            </li>
          );
        })}

        {canCreate ? (
          <li>
            {creating ? (
              <div className="lw-suggest__create">
                <span className="lw-suggest__createlabel">
                  Create “{query.text.trim()}” as
                </span>
                <div className="lw-suggest__types">
                  {CREATABLE.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className="lw-btn lw-btn--sm"
                      onClick={() => void create(type)}
                    >
                      <span style={{ color: ENTITY_TYPE_META[type].color }} aria-hidden>
                        {ENTITY_TYPE_META[type].glyph}
                      </span>{' '}
                      {ENTITY_TYPE_META[type].label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <button
                type="button"
                role="option"
                aria-selected={onCreateRow}
                className={
                  onCreateRow ? 'lw-suggest__row lw-suggest__row--on' : 'lw-suggest__row'
                }
                onMouseEnter={() => setIndex(matches.length)}
                onClick={() => setCreating(true)}
              >
                <span className="lw-suggest__glyph" aria-hidden>
                  ＋
                </span>
                <span className="lw-suggest__name">Create “{query.text.trim()}”…</span>
                <span className="lw-suggest__type">New entry</span>
              </button>
            )}
          </li>
        ) : null}
      </ul>
    </div>
  );
}

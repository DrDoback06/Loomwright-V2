import { useEffect, useState } from 'react';
import type { Editor } from '@tiptap/core';
import { getEntity } from '@/db/repos/entities';
import type { Entity } from '@/db/types';
import { ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';
import { useFocusStore } from '@/stores/focus';
import { useUiStore } from '@/stores/ui';

export interface MentionTarget {
  entityId: string;
  entityType: EntityType;
  /** Document position inside the mark, for Unlink. Absent for an
   * extraction-derived highlight, which is a decoration and has no mark to
   * remove. */
  pos?: number;
  /** Where the card sits, in canvas coordinates. */
  top: number;
  left: number;
}

/** Who is this, without losing your place.
 *
 * Clicking a mention used to jump straight to the codex, which answers the
 * question by taking you away from the sentence that raised it. The card
 * answers it here, and still offers the trip. */
export function MentionPreview({
  target,
  editor,
  onClose,
}: {
  target: MentionTarget;
  editor: Editor;
  onClose: () => void;
}) {
  const [entity, setEntity] = useState<Entity | null | undefined>(undefined);
  const setFocus = useFocusStore((s) => s.setFocus);
  const setCodexType = useUiStore((s) => s.setCodexType);
  const setRoute = useUiStore((s) => s.setRoute);

  useEffect(() => {
    let cancelled = false;
    // `getEntity` follows `mergedIntoId`, so a mention written before a
    // merge opens the entity it was folded into rather than a dead record.
    void getEntity(target.entityId).then((found) => {
      if (!cancelled) setEntity(found ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [target.entityId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const meta = ENTITY_TYPE_META[entity?.type ?? target.entityType];

  const open = () => {
    if (!entity) return;
    setFocus({ id: entity.id, type: entity.type, name: entity.name });
    setCodexType(entity.type);
    setRoute('codex');
    onClose();
  };

  return (
    <div
      className="lw-mentioncard"
      data-testid="mention-preview"
      style={
        {
          '--card-top': `${target.top}px`,
          '--card-left': `${target.left}px`,
        } as React.CSSProperties
      }
      contentEditable={false}
    >
      {entity === undefined ? (
        <p className="lw-fieldnote">Looking that up…</p>
      ) : entity === null ? (
        <>
          <p className="lw-mentioncard__gone">
            This entry is no longer in the codex. The words stay either way.
          </p>
          {target.pos != null ? (
            <button
              type="button"
              className="lw-btn lw-btn--sm"
              onClick={() => {
                editor.commands.unlinkMention(target.pos!);
                onClose();
              }}
            >
              Unlink
            </button>
          ) : null}
        </>
      ) : (
        <>
          <div className="lw-mentioncard__head">
            <span className="lw-mentioncard__glyph" style={{ color: meta.color }} aria-hidden>
              {meta.glyph}
            </span>
            <strong className="lw-mentioncard__name">{entity.name}</strong>
            <span className="lw-mentioncard__type">{meta.label}</span>
          </div>
          {entity.summary ? (
            <p className="lw-mentioncard__summary">{entity.summary}</p>
          ) : (
            <p className="lw-fieldnote">No summary yet.</p>
          )}
          <div className="lw-mentioncard__actions">
            <button type="button" className="lw-btn lw-btn--sm lw-btn--primary" onClick={open}>
              Open dossier
            </button>
            {target.pos != null ? (
              <button
                type="button"
                className="lw-btn lw-btn--sm"
                onClick={() => {
                  editor.commands.unlinkMention(target.pos!);
                  onClose();
                }}
              >
                Unlink
              </button>
            ) : null}
            <button type="button" className="lw-btn lw-btn--sm" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </div>
  );
}

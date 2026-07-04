import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Editor } from '@tiptap/react';
import {
  addParagraphNote,
  deleteParagraphNote,
  listChapterNotes,
  resolveParagraphNote,
} from '@/db/repos/notes';
import { toast } from '@/stores/toasts';

/** Paragraph note rail. Notes attach to the paragraph that holds the
 * caret when "Add note" is pressed, keyed by its stable pid. */
export function NotesMargin({
  projectId,
  chapterId,
  editor,
}: {
  projectId: string;
  chapterId: string;
  editor: Editor;
}) {
  const notes = useLiveQuery(
    async () => listChapterNotes(projectId, chapterId),
    [projectId, chapterId],
    []
  );
  const [draft, setDraft] = useState('');
  const [showResolved, setShowResolved] = useState(false);

  const caretParagraphId = (): string | null => {
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth >= 1; depth--) {
      const node = $from.node(depth);
      if (node.attrs?.pid) return node.attrs.pid as string;
    }
    return null;
  };

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    const pid = caretParagraphId();
    if (!pid) {
      toast('Click into a paragraph first, then add the note.', { kind: 'error' });
      return;
    }
    await addParagraphNote(projectId, chapterId, pid, text);
    setDraft('');
  };

  const visible = notes.filter((n) => showResolved || !n.resolved);
  const paragraphNumber = (pid: string): number | null => {
    let index = 0;
    let found: number | null = null;
    editor.state.doc.descendants((node) => {
      if (node.attrs?.pid) {
        index += 1;
        if (node.attrs.pid === pid) found = index;
      }
      return found === null;
    });
    return found;
  };

  return (
    <aside className="lw-notesrail" aria-label="Paragraph notes">
      <header className="lw-notesrail__head">
        <h2 className="lw-notesrail__title">Notes</h2>
        <label className="lw-toggle lw-notesrail__filter">
          <input
            type="checkbox"
            checked={showResolved}
            onChange={(e) => setShowResolved(e.target.checked)}
          />
          <span>Show resolved</span>
        </label>
      </header>

      <div className="lw-notesrail__add">
        <textarea
          className="lw-input lw-input--area"
          rows={2}
          placeholder="Note for the paragraph at the caret…"
          aria-label="New note text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="button" className="lw-btn" onClick={() => void add()}>
          Add note
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="lw-empty__note">No notes yet.</p>
      ) : (
        <ul className="lw-notesrail__list">
          {visible.map((note) => {
            const num = paragraphNumber(note.paragraphId);
            return (
              <li key={note.id} className={note.resolved ? 'lw-note lw-note--resolved' : 'lw-note'}>
                <div className="lw-note__meta">
                  <span>{num ? `¶ ${num}` : 'detached'}</span>
                  <span>{new Date(note.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
                <p className="lw-note__text">{note.text}</p>
                <div className="lw-note__actions">
                  <button
                    type="button"
                    className="lw-btn lw-btn--sm"
                    onClick={() => void resolveParagraphNote(note.id, !note.resolved)}
                  >
                    {note.resolved ? 'Reopen' : 'Resolve'}
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn--sm"
                    onClick={() => void deleteParagraphNote(note.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

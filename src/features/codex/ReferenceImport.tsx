import { useRef, useState } from 'react';
import { createEntity } from '@/db/repos/entities';
import { toast } from '@/stores/toasts';

/** Paste-or-file ingestion for the References codex: raw source
 * material lands as reference entries (title/kind/body) ready to feed
 * AI context packs. */
export function ReferenceImport({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const ingest = async (name: string, body: string) => {
    const trimmed = body.trim();
    if (!trimmed) return false;
    await createEntity({
      projectId,
      type: 'references',
      name: name.trim() || firstLine(trimmed),
      aliases: [],
      summary: trimmed.slice(0, 140).replace(/\s+/g, ' '),
      tags: [],
      fields: { kind: 'research note', body: trimmed },
    });
    return true;
  };

  const submitPaste = async () => {
    if (await ingest(title, text)) {
      toast('Reference added.', { kind: 'success' });
      setTitle('');
      setText('');
      setOpen(false);
    } else {
      toast('Paste some text first.', { kind: 'error' });
    }
  };

  const submitFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    let added = 0;
    for (const file of Array.from(files)) {
      if (await ingest(file.name.replace(/\.(txt|md|markdown)$/i, ''), await file.text())) added += 1;
    }
    toast(`${added} reference${added === 1 ? '' : 's'} imported.`, { kind: added ? 'success' : 'error' });
    if (added) setOpen(false);
  };

  return (
    <>
      <button type="button" className="lw-btn" onClick={() => setOpen(true)}>
        Import…
      </button>
      {open && (
        <div className="lw-drawer-backdrop" role="presentation" onClick={() => setOpen(false)}>
          <div
            className="lw-dialog"
            role="dialog"
            aria-label="Import reference"
            data-testid="reference-import"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="lw-card__title">Import reference material</h2>
            <p className="lw-fieldnote">
              Paste research, style samples, or canon notes — or pick .txt / .md files. Each
              becomes a reference entry.
            </p>
            <label className="lw-field__label" htmlFor="ref-title">
              Title
            </label>
            <input
              id="ref-title"
              className="lw-input"
              placeholder="e.g. Coastal trade routes — research"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <label className="lw-field__label" htmlFor="ref-body" style={{ marginTop: 'var(--sp-4)' }}>
              Text
            </label>
            <textarea
              id="ref-body"
              className="lw-input"
              rows={8}
              placeholder="Paste anything…"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="lw-chips__add" style={{ marginTop: 'var(--sp-5)' }}>
              <button type="button" className="lw-btn lw-btn--primary" onClick={() => void submitPaste()}>
                Add reference
              </button>
              <button type="button" className="lw-btn" onClick={() => fileRef.current?.click()}>
                From file(s)…
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                multiple
                aria-label="Reference files"
                style={{ display: 'none' }}
                onChange={(e) => {
                  void submitFiles(e.target.files);
                  e.target.value = '';
                }}
              />
              <button type="button" className="lw-btn" onClick={() => setOpen(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function firstLine(text: string): string {
  return text.split('\n')[0].slice(0, 80) || 'Untitled reference';
}

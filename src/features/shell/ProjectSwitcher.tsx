import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  createProject,
  deleteProjectDeep,
  listProjects,
  renameProject,
} from '@/db/repos/projects';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';

export function ProjectSwitcher() {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);

  const projects = useLiveQuery(listProjects, [], []);
  const current = projects.find((p) => p.id === currentProjectId) ?? null;

  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [draft, setDraft] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setRenaming(false);
        setConfirmingDelete(false);
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  if (!current) return null;

  const submitCreate = async () => {
    const name = draft.trim();
    if (!name) return;
    const project = await createProject(name);
    setCurrentProject(project.id);
    setDraft('');
    setCreating(false);
    setOpen(false);
    toast(`Project “${project.name}” created.`, { kind: 'success' });
  };

  const submitRename = async () => {
    const name = draft.trim();
    if (!name) return;
    await renameProject(current.id, name);
    setDraft('');
    setRenaming(false);
    toast('Project renamed.', { kind: 'success' });
  };

  const submitDelete = async () => {
    const name = current.name;
    await deleteProjectDeep(current.id);
    const rest = projects.filter((p) => p.id !== current.id);
    setCurrentProject(rest[0]?.id ?? null);
    setConfirmingDelete(false);
    setOpen(false);
    toast(`Project “${name}” deleted.`);
  };

  return (
    <div className="lw-projectswitcher" ref={rootRef}>
      <button
        type="button"
        className="lw-projectswitcher__button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="lw-projectswitcher__glyph" aria-hidden>
          ⌘
        </span>
        <span className="lw-projectswitcher__name">{current.name}</span>
        <span aria-hidden>▾</span>
      </button>

      {open && (
        <div className="lw-menu" role="menu" aria-label="Projects">
          <div className="lw-menu__group">Projects</div>
          {projects.map((p) => (
            <button
              key={p.id}
              type="button"
              role="menuitemradio"
              aria-checked={p.id === current.id}
              className="lw-menu__item"
              onClick={() => {
                setCurrentProject(p.id);
                setOpen(false);
              }}
            >
              {p.id === current.id ? '● ' : ''}
              {p.name}
            </button>
          ))}
          <div className="lw-menu__divider" />
          {creating ? (
            <form
              className="lw-menu__form"
              onSubmit={(e) => {
                e.preventDefault();
                void submitCreate();
              }}
            >
              <input
                className="lw-input"
                autoFocus
                placeholder="Project name"
                aria-label="New project name"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="lw-btn lw-btn--primary">
                Create
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="lw-menu__item"
              onClick={() => {
                setCreating(true);
                setRenaming(false);
                setConfirmingDelete(false);
                setDraft('');
              }}
            >
              + New project
            </button>
          )}
          {renaming ? (
            <form
              className="lw-menu__form"
              onSubmit={(e) => {
                e.preventDefault();
                void submitRename();
              }}
            >
              <input
                className="lw-input"
                autoFocus
                placeholder="New name"
                aria-label="Rename project"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button type="submit" className="lw-btn lw-btn--primary">
                Rename
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="lw-menu__item"
              onClick={() => {
                setRenaming(true);
                setCreating(false);
                setConfirmingDelete(false);
                setDraft(current.name);
              }}
            >
              Rename “{current.name}”
            </button>
          )}
          {confirmingDelete ? (
            <div className="lw-menu__confirm">
              <span>Delete “{current.name}” and everything in it?</span>
              <button type="button" className="lw-btn lw-btn--danger" onClick={() => void submitDelete()}>
                Delete forever
              </button>
              <button type="button" className="lw-btn" onClick={() => setConfirmingDelete(false)}>
                Keep
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="lw-menu__item lw-menu__item--danger"
              onClick={() => {
                setConfirmingDelete(true);
                setCreating(false);
                setRenaming(false);
              }}
            >
              Delete “{current.name}”…
            </button>
          )}
        </div>
      )}
    </div>
  );
}

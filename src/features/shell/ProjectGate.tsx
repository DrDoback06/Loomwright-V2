import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createProject, listProjects } from '@/db/repos/projects';
import { useProjectStore } from '@/stores/project';

/** Ensures a project exists and is selected before the app renders.
 * First run shows the create-project welcome; later this grows into the
 * full onboarding interview (M10). */
export function ProjectGate({ children }: { children: React.ReactNode }) {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const projects = useLiveQuery(listProjects, [], null);
  const [name, setName] = useState('');

  // If the remembered project vanished (or none remembered), adopt the
  // most recent existing project automatically.
  useEffect(() => {
    if (!projects) return;
    const exists = projects.some((p) => p.id === currentProjectId);
    if (!exists) {
      setCurrentProject(projects[0]?.id ?? null);
    }
  }, [projects, currentProjectId, setCurrentProject]);

  if (projects === null) return null; // booting

  if (projects.length === 0) {
    return (
      <div className="lw-gate">
        <div className="lw-card lw-gate__card">
          <h1 className="lw-page__title">Welcome to Loomwright</h1>
          <p className="lw-page__subtitle">
            Name your project to begin — a book, a series, a campaign world. Everything you
            create stays on this device.
          </p>
          <form
            className="lw-gate__form"
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = name.trim();
              if (!trimmed) return;
              void createProject(trimmed).then((p) => setCurrentProject(p.id));
            }}
          >
            <input
              className="lw-input"
              autoFocus
              placeholder="e.g. The Hollow Crown"
              aria-label="Project name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="lw-btn lw-btn--primary">
              Create project
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!currentProjectId || !projects.some((p) => p.id === currentProjectId)) return null;

  return <>{children}</>;
}

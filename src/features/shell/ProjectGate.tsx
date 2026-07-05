import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { createProject, listProjects } from '@/db/repos/projects';
import { createSampleProject } from '@/services/sample-project';
import { OnboardingWizard } from '@/features/onboarding/OnboardingWizard';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';

/** Ensures a project exists and is selected before the app renders.
 * First run offers the guided interview (the flagship path), a blank
 * project, or the explorable sample project. */
export function ProjectGate({ children }: { children: React.ReactNode }) {
  const currentProjectId = useProjectStore((s) => s.currentProjectId);
  const setCurrentProject = useProjectStore((s) => s.setCurrentProject);
  const onboardingOpen = useUiStore((s) => s.onboardingOpen);
  const setOnboardingOpen = useUiStore((s) => s.setOnboardingOpen);
  const projects = useLiveQuery(listProjects, [], null);
  const [name, setName] = useState('');
  const [blankOpen, setBlankOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

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

  const wizard = onboardingOpen ? <OnboardingWizard onClose={() => setOnboardingOpen(false)} /> : null;

  if (projects.length === 0) {
    return (
      <>
        <div className="lw-gate">
          <div className="lw-card lw-gate__card">
            <h1 className="lw-page__title">Welcome to Loomwright</h1>
            <p className="lw-page__subtitle">
              A local-first home for the book and the world behind it. Everything you create
              stays on this device.
            </p>
            <div className="lw-gate__choices">
              <button
                type="button"
                className="lw-btn lw-btn--primary lw-gate__choice"
                onClick={() => setOnboardingOpen(true)}
              >
                <strong>Guided setup</strong>
                <span>
                  A short interview — premise, voice, cast, world. Paste a manuscript and
                  Loomwright splits chapters and proposes your codex.
                </span>
              </button>
              <button
                type="button"
                className="lw-btn lw-gate__choice"
                onClick={() => setBlankOpen((o) => !o)}
              >
                <strong>Blank project</strong>
                <span>Just a name; build as you go.</span>
              </button>
              <button
                type="button"
                className="lw-btn lw-gate__choice"
                disabled={seeding}
                onClick={async () => {
                  setSeeding(true);
                  try {
                    const id = await createSampleProject();
                    setCurrentProject(id);
                    toast('Sample project loaded — poke at everything. Delete it any time from the project menu.', { kind: 'success' });
                  } finally {
                    setSeeding(false);
                  }
                }}
              >
                <strong>{seeding ? 'Building the sample…' : 'Explore a sample project'}</strong>
                <span>A small story world with cast, quests, chapters, and a review queue.</span>
              </button>
            </div>
            {blankOpen && (
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
            )}
          </div>
        </div>
        {wizard}
      </>
    );
  }

  if (!currentProjectId || !projects.some((p) => p.id === currentProjectId)) return null;

  return (
    <>
      {children}
      {wizard}
    </>
  );
}

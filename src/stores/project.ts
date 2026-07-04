import { create } from 'zustand';
import { getLastProjectId, rememberLastProject } from '@/db/repos/projects';

interface ProjectState {
  /** null until boot resolves; '' means "no project yet — show create". */
  currentProjectId: string | null;
  setCurrentProject: (id: string | null) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  currentProjectId: getLastProjectId(),
  setCurrentProject: (id) => {
    rememberLastProject(id);
    set({ currentProjectId: id });
  },
}));

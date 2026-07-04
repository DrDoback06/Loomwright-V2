import { create } from 'zustand';
import { db } from '@/db/schema';
import type { EntityType } from '@/domain/entity-types';

/** Docked codex panels that stack beside the Writer's Room. Click
 * protocol (legacy PANEL_RULES): opening an open panel brings it to
 * front — a plain click never closes; close only via the panel's ×.
 * Layout persists per project. */
interface LayoutState {
  openPanels: EntityType[];
  hydratedFor: string | null;
  openPanel: (type: EntityType, projectId: string) => void;
  closePanel: (type: EntityType, projectId: string) => void;
  hydrate: (projectId: string) => Promise<void>;
}

const MAX_PANELS = 3;

function persist(projectId: string, openPanels: EntityType[]) {
  void db.uiState.put({ key: `${projectId}:panels`, value: openPanels });
}

export const useLayoutStore = create<LayoutState>((set, get) => ({
  openPanels: [],
  hydratedFor: null,
  openPanel: (type, projectId) => {
    const current = get().openPanels;
    const without = current.filter((t) => t !== type);
    // Newest panel docks nearest the manuscript (front of the list);
    // overflow beyond MAX_PANELS drops the oldest.
    const next = [type, ...without].slice(0, MAX_PANELS);
    set({ openPanels: next });
    persist(projectId, next);
  },
  closePanel: (type, projectId) => {
    const next = get().openPanels.filter((t) => t !== type);
    set({ openPanels: next });
    persist(projectId, next);
  },
  hydrate: async (projectId) => {
    if (get().hydratedFor === projectId) return;
    const row = await db.uiState.get(`${projectId}:panels`);
    set({
      openPanels: Array.isArray(row?.value) ? (row.value as EntityType[]) : [],
      hydratedFor: projectId,
    });
  },
}));

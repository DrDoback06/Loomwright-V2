import { create } from 'zustand';
import { deltaUnits, type StoryDelta } from '@/services/intelligence/types';

interface IntelligenceState {
  /** The staged (not yet accepted) delta — memory only, exactly like
   * generation staging. Nothing touches Dexie until Accept. */
  staged: StoryDelta | null;
  /** Units currently switched on. Seeded to "everything" when a delta is
   * staged, so Accept all is the one-click default the spec asks for. */
  enabled: Set<string>;
  /** Chunk progress while a whole-book paste is being read. */
  progress: { done: number; total: number } | null;
  stage: (delta: StoryDelta) => void;
  discard: () => void;
  toggleUnit: (unitId: string) => void;
  toggleGroup: (unitIds: string[]) => void;
  /** Swap a conflicted patch's value from its correction picker. */
  resolveConflict: (unitId: string, value: unknown) => void;
  /** Pick a parent for a hierarchy placement the engine could not resolve. */
  resolveParent: (unitId: string, parentId: string, parentName: string) => void;
  setProgress: (progress: { done: number; total: number } | null) => void;
}

export const useIntelligenceStore = create<IntelligenceState>((set) => ({
  staged: null,
  enabled: new Set(),
  progress: null,

  stage: (delta) =>
    set({ staged: delta, enabled: new Set(deltaUnits(delta).map((u) => u.unitId)), progress: null }),

  discard: () => set({ staged: null, enabled: new Set(), progress: null }),

  toggleUnit: (unitId) =>
    set((state) => {
      const next = new Set(state.enabled);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return { enabled: next };
    }),

  toggleGroup: (unitIds) =>
    set((state) => {
      const next = new Set(state.enabled);
      // A group toggles as a unit: if any member is off, turn the whole
      // cascade on; otherwise switch all of it off.
      const allOn = unitIds.every((id) => next.has(id));
      for (const id of unitIds) {
        if (allOn) next.delete(id);
        else next.add(id);
      }
      return { enabled: next };
    }),

  resolveConflict: (unitId, value) =>
    set((state) => {
      if (!state.staged) return state;
      return {
        staged: {
          ...state.staged,
          patches: state.staged.patches.map((p) =>
            p.unitId === unitId
              ? // Resolving is a decision, so the flag clears and confidence
                // is restored — the author has now confirmed this one.
                { ...p, after: value, conflict: undefined, confidence: 0.95, confidenceBand: 'blue' }
              : p
          ),
        },
      };
    }),

  resolveParent: (unitId, parentId, parentName) =>
    set((state) => {
      if (!state.staged) return state;
      return {
        staged: {
          ...state.staged,
          hierarchyPlacements: state.staged.hierarchyPlacements.map((h) =>
            h.unitId === unitId
              ? {
                  ...h,
                  parentId,
                  parentName,
                  unresolvedParentName: undefined,
                  confidence: 0.95,
                  confidenceBand: 'blue',
                }
              : h
          ),
        },
      };
    }),

  setProgress: (progress) => set({ progress }),
}));

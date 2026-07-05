import { create } from 'zustand';
import type { EntityRef, EntityType } from '@/domain/entity-types';
import type { GenerationBundle, GenTargetKind } from '@/services/generate/types';

/** What the Create Anything dialog was opened for. */
export interface GenerationDialogTarget {
  kind: GenTargetKind;
  entityType?: EntityType;
  targetGraphId?: string;
  contextRefs?: EntityRef[];
}

interface GenerationState {
  /** Open dialog target, or null when closed. */
  dialog: GenerationDialogTarget | null;
  /** The staged (not yet accepted) bundle — memory only; nothing touches
   * Dexie until Accept. */
  staged: GenerationBundle | null;
  openDialog: (target: GenerationDialogTarget) => void;
  closeDialog: () => void;
  stage: (bundle: GenerationBundle) => void;
  /** Replace a staged draft node position (pre-accept drag tweaks). */
  updateStaged: (bundle: GenerationBundle) => void;
  discard: () => void;
}

export const useGenerationStore = create<GenerationState>((set) => ({
  dialog: null,
  staged: null,
  openDialog: (target) => set({ dialog: target }),
  closeDialog: () => set({ dialog: null }),
  stage: (bundle) => set({ staged: bundle, dialog: null }),
  updateStaged: (bundle) => set({ staged: bundle }),
  discard: () => set({ staged: null }),
}));

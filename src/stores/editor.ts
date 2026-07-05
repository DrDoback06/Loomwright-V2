import { create } from 'zustand';
import type { EntityType } from '@/domain/entity-types';

/** Carried when a create drawer was opened by a generator — the per-field
 * dice and "Reroll all" reuse the same theme/hint for coherent rerolls. */
export interface GenerationContext {
  theme?: string;
  hint?: string;
  seed?: number;
}

export type EditorTarget =
  | {
      mode: 'create';
      type: EntityType;
      initial?: Record<string, unknown>;
      generation?: GenerationContext;
    }
  | { mode: 'edit'; type: EntityType; entityId: string };

interface EditorState {
  target: EditorTarget | null;
  openCreate: (
    type: EntityType,
    initial?: Record<string, unknown>,
    generation?: GenerationContext
  ) => void;
  openEdit: (type: EntityType, entityId: string) => void;
  close: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  target: null,
  openCreate: (type, initial, generation) =>
    set({ target: { mode: 'create', type, initial, generation } }),
  openEdit: (type, entityId) => set({ target: { mode: 'edit', type, entityId } }),
  close: () => set({ target: null }),
}));

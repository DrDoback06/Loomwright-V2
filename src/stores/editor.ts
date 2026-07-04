import { create } from 'zustand';
import type { EntityType } from '@/domain/entity-types';

export type EditorTarget =
  | { mode: 'create'; type: EntityType; initial?: Record<string, unknown> }
  | { mode: 'edit'; type: EntityType; entityId: string };

interface EditorState {
  target: EditorTarget | null;
  openCreate: (type: EntityType, initial?: Record<string, unknown>) => void;
  openEdit: (type: EntityType, entityId: string) => void;
  close: () => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  target: null,
  openCreate: (type, initial) => set({ target: { mode: 'create', type, initial } }),
  openEdit: (type, entityId) => set({ target: { mode: 'edit', type, entityId } }),
  close: () => set({ target: null }),
}));

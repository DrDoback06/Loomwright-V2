import { create } from 'zustand';
import type { EntityRef } from '@/domain/entity-types';

/** Cross-panel entity focus. Selecting an entity anywhere broadcasts it
 * here; other surfaces subscribe and react (filter chips, opening the
 * dossier, pair views in M4).
 *
 * Navigation-style adoption (a roster auto-selecting the focused entity
 * when it mounts) is consume-once: without this, a stale focus from
 * minutes ago would keep hijacking the roster every time it re-opened. */
interface FocusState {
  focus: EntityRef | null;
  /** True until one surface has adopted this focus as its selection. */
  adoptionPending: boolean;
  setFocus: (ref: EntityRef | null) => void;
  /** Adopt-and-consume: returns the ref if it matches and is unconsumed. */
  consumeFocus: () => void;
}

export const useFocusStore = create<FocusState>((set) => ({
  focus: null,
  adoptionPending: false,
  setFocus: (ref) => set({ focus: ref, adoptionPending: ref !== null }),
  consumeFocus: () => set({ adoptionPending: false }),
}));

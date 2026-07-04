import { create } from 'zustand';
import type { EntityRef, EntityType } from '@/domain/entity-types';

/** Cross-panel entity context — the heart of "fluid tabs that interact".
 *
 * - `focusedByType` keeps the most recent selection PER TYPE, so a cast
 *   member and a location can be in context simultaneously; every other
 *   panel filters/reacts to focuses that are not its own type.
 * - `lock` pins one entity as persistent context; with a same-type focus
 *   it forms a PAIR (e.g. two cast members → relationship view).
 * - Navigation-style adoption (a roster auto-selecting the focused
 *   entity on mount) is consume-once so stale focus never hijacks a
 *   surface the user re-opens later. */
interface FocusState {
  focusedByType: Partial<Record<EntityType, EntityRef>>;
  focus: EntityRef | null;
  lock: EntityRef | null;
  adoptionPending: boolean;
  setFocus: (ref: EntityRef | null) => void;
  clearFocusType: (type: EntityType) => void;
  consumeFocus: () => void;
  toggleLock: (ref: EntityRef) => void;
  clearLock: () => void;
}

export const useFocusStore = create<FocusState>((set) => ({
  focusedByType: {},
  focus: null,
  lock: null,
  adoptionPending: false,
  setFocus: (ref) =>
    set((s) => ({
      focus: ref,
      adoptionPending: ref !== null,
      focusedByType: ref ? { ...s.focusedByType, [ref.type]: ref } : s.focusedByType,
    })),
  clearFocusType: (type) =>
    set((s) => {
      const next = { ...s.focusedByType };
      delete next[type];
      return {
        focusedByType: next,
        focus: s.focus?.type === type ? null : s.focus,
      };
    }),
  consumeFocus: () => set({ adoptionPending: false }),
  toggleLock: (ref) =>
    set((s) => ({ lock: s.lock?.id === ref.id ? null : ref })),
  clearLock: () => set({ lock: null }),
}));

import { useFocusStore } from '@/stores/focus';
import type { EntityRef } from '@/domain/entity-types';

/**
 * Cross-panel selection, as context inputs.
 *
 * One helper because the context rail and every AI path must read the
 * *same* thing. When the rail passed only the focus lock and
 * `gatherSceneContext` also folded in `focusedByType`, the Preview showed
 * less than what beats actually sent — a rail that under-reports is worse
 * than no rail, because it is believed.
 *
 * Read outside React deliberately: this is called from prompt-building
 * paths that are not components. `focusedByType` keeps one selection per
 * type, so a cast member and a location can both be in scope.
 */
export function pinnedRefs(): EntityRef[] {
  const { focusedByType, lock } = useFocusStore.getState();
  const out = new Map<string, EntityRef>();
  if (lock) out.set(lock.id, lock);
  for (const ref of Object.values(focusedByType)) if (ref) out.set(ref.id, ref);
  return [...out.values()];
}

/** Motion preference.
 *
 * Two sources, in priority order: the in-app Tweaks setting (written to
 * `data-motion-pref` on <html>), then the OS. The in-app override exists
 * because an OS setting does not cover everyone — a shared machine, a
 * borrowed laptop, or simply someone who wants a calm writing surface
 * without changing their whole system.
 *
 * Every celebration, spring and confetti path MUST consult this before it
 * animates. CSS handles the blanket reduction; this is for the cases where
 * the decision is "play a different thing", not "play it slower".
 */
export type MotionPref = 'system' | 'full' | 'reduce';

export function prefersReducedMotion(): boolean {
  const pref = document.documentElement.dataset.motionPref;
  if (pref === 'reduce') return true;
  if (pref === 'full') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Duration to use for a transition, collapsed to ~0 when motion is reduced.
 * Keeps call sites from repeating the ternary. */
export function motionDuration(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}

import type { MotionPref } from '@/lib/motion';

/** Appearance preferences that are pure presentation: they change how the
 * app looks, never what it holds. They live in localStorage rather than
 * Dexie because `index.html` must read them synchronously before first
 * paint — an async read would show a flash of the default theme on every
 * boot. Everything that is *data* still lives in Dexie.
 *
 * `data-density` and `data-typeset` have existed in tokens.css since the
 * rebuild with nothing to drive them. This is the driver. */
export type Density = 'compact' | 'balanced' | 'spacious';
export type Typeset = 'literary' | 'archive' | 'workhorse';

export interface Tweaks {
  density: Density;
  typeset: Typeset;
  motion: MotionPref;
  /** Prose line length in em. 34em ≈ 66 characters, the measure that reads
   * fastest; the range spans roughly 55–85 characters. */
  measure: number;
  /** How much of the prose stays lit in focus mode. Consumed by the
   * Writer's Room. */
  focus: 'off' | 'paragraph' | 'sentence' | 'line';
}

export const DEFAULT_TWEAKS: Tweaks = {
  density: 'balanced',
  typeset: 'workhorse',
  motion: 'system',
  measure: 34,
  focus: 'off',
};

export const MEASURE_MIN = 28;
export const MEASURE_MAX = 44;

const KEY = 'lw:tweaks';

export function loadTweaks(): Tweaks {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_TWEAKS };
    const parsed = JSON.parse(raw) as Partial<Tweaks>;
    return {
      density: parsed.density ?? DEFAULT_TWEAKS.density,
      typeset: parsed.typeset ?? DEFAULT_TWEAKS.typeset,
      motion: parsed.motion ?? DEFAULT_TWEAKS.motion,
      measure: clampMeasure(parsed.measure ?? DEFAULT_TWEAKS.measure),
      focus: parsed.focus ?? DEFAULT_TWEAKS.focus,
    };
  } catch {
    return { ...DEFAULT_TWEAKS };
  }
}

export function saveTweaks(tweaks: Tweaks): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(tweaks));
  } catch {
    /* private mode etc. — the applied attributes still hold for this session */
  }
}

/** Stamp the preferences onto <html>. Mirrors what the pre-paint script in
 * index.html does, so the two can never disagree. */
export function applyTweaks(tweaks: Tweaks): void {
  const root = document.documentElement;
  root.setAttribute('data-density', tweaks.density);
  root.setAttribute('data-typeset', tweaks.typeset);
  root.setAttribute('data-motion-pref', tweaks.motion);
  root.style.setProperty('--measure', `${clampMeasure(tweaks.measure)}em`);
}

function clampMeasure(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TWEAKS.measure;
  return Math.min(MEASURE_MAX, Math.max(MEASURE_MIN, Math.round(value)));
}

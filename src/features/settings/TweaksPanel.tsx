import { useState } from 'react';
import { ALL_THEMES, useUiStore, type Theme } from '@/stores/ui';
import {
  applyTweaks,
  loadTweaks,
  saveTweaks,
  MEASURE_MAX,
  MEASURE_MIN,
  type Density,
  type Tweaks,
  type Typeset,
} from '@/lib/tweaks';
import type { MotionPref } from '@/lib/motion';

const THEME_LABELS: Record<Theme, string> = {
  'studio-dark': 'Studio dark',
  'studio-light': 'Studio light',
  'parchment-light': 'Parchment',
  'midnight-ink': 'Midnight ink',
};

const DENSITIES: { value: Density; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'spacious', label: 'Spacious' },
];

const TYPESETS: { value: Typeset; label: string; hint: string }[] = [
  { value: 'workhorse', label: 'Workhorse', hint: 'Sans throughout — clearest at density' },
  { value: 'literary', label: 'Literary', hint: 'Garamond display over a serif body' },
  { value: 'archive', label: 'Archive', hint: 'Serif everywhere, including the chrome' },
];

const MOTIONS: { value: MotionPref; label: string; hint: string }[] = [
  { value: 'system', label: 'Match my system', hint: 'Follow the OS reduced-motion setting' },
  { value: 'full', label: 'Full motion', hint: 'Animate regardless of the OS setting' },
  { value: 'reduce', label: 'Reduced', hint: 'No movement; state changes cross-fade instead' },
];

const FOCUS_MODES: { value: Tweaks['focus']; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'paragraph', label: 'Paragraph' },
  { value: 'sentence', label: 'Sentence' },
  { value: 'line', label: 'Line' },
];

/** Appearance controls. `data-density` and `data-typeset` have been in
 * tokens.css since the rebuild with nothing to drive them; this is the
 * driver, alongside the theme, motion and prose-measure preferences. */
export function TweaksPanel() {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const [tweaks, setTweaks] = useState<Tweaks>(() => loadTweaks());

  const patch = (next: Partial<Tweaks>) => {
    const merged = { ...tweaks, ...next };
    setTweaks(merged);
    applyTweaks(merged);
    saveTweaks(merged);
  };

  return (
    <section className="lw-card" data-testid="settings-tweaks">
      <h2 className="lw-card__title">Appearance</h2>

      <div className="lw-tweak">
        <span className="lw-tweak__label" id="tweak-theme">Theme</span>
        <div className="lw-tweak__options" role="group" aria-labelledby="tweak-theme">
          {ALL_THEMES.map((value) => (
            <button
              key={value}
              type="button"
              className={value === theme ? 'lw-pill lw-pill--active' : 'lw-pill'}
              aria-pressed={value === theme}
              onClick={() => setTheme(value)}
            >
              {THEME_LABELS[value]}
            </button>
          ))}
        </div>
      </div>

      <div className="lw-tweak">
        <span className="lw-tweak__label" id="tweak-density">Density</span>
        <div className="lw-tweak__options" role="group" aria-labelledby="tweak-density">
          {DENSITIES.map((d) => (
            <button
              key={d.value}
              type="button"
              className={d.value === tweaks.density ? 'lw-pill lw-pill--active' : 'lw-pill'}
              aria-pressed={d.value === tweaks.density}
              onClick={() => patch({ density: d.value })}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lw-tweak">
        <span className="lw-tweak__label" id="tweak-typeset">Typeface</span>
        <div className="lw-tweak__options" role="group" aria-labelledby="tweak-typeset">
          {TYPESETS.map((t) => (
            <button
              key={t.value}
              type="button"
              className={t.value === tweaks.typeset ? 'lw-pill lw-pill--active' : 'lw-pill'}
              aria-pressed={t.value === tweaks.typeset}
              title={t.hint}
              onClick={() => patch({ typeset: t.value })}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lw-tweak">
        <label className="lw-tweak__label" htmlFor="tweak-measure">
          Prose width — {tweaks.measure}em
        </label>
        <input
          id="tweak-measure"
          className="lw-tweak__range"
          type="range"
          min={MEASURE_MIN}
          max={MEASURE_MAX}
          step={1}
          value={tweaks.measure}
          onChange={(e) => patch({ measure: Number(e.target.value) })}
        />
        <p className="lw-fieldnote">
          Roughly {Math.round(tweaks.measure * 1.95)} characters a line. Around 66 reads fastest.
        </p>
      </div>

      <div className="lw-tweak">
        <span className="lw-tweak__label" id="tweak-motion">Motion</span>
        <div className="lw-tweak__options" role="group" aria-labelledby="tweak-motion">
          {MOTIONS.map((m) => (
            <button
              key={m.value}
              type="button"
              className={m.value === tweaks.motion ? 'lw-pill lw-pill--active' : 'lw-pill'}
              aria-pressed={m.value === tweaks.motion}
              title={m.hint}
              onClick={() => patch({ motion: m.value })}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="lw-tweak">
        <span className="lw-tweak__label" id="tweak-focus">Focus mode</span>
        <div className="lw-tweak__options" role="group" aria-labelledby="tweak-focus">
          {FOCUS_MODES.map((f) => (
            <button
              key={f.value}
              type="button"
              className={f.value === tweaks.focus ? 'lw-pill lw-pill--active' : 'lw-pill'}
              aria-pressed={f.value === tweaks.focus}
              onClick={() => patch({ focus: f.value })}
            >
              {f.label}
            </button>
          ))}
        </div>
        <p className="lw-fieldnote">
          Dims everything but the {tweaks.focus === 'off' ? 'current line' : tweaks.focus} while
          you type in the Writer&rsquo;s Room.
        </p>
      </div>
    </section>
  );
}

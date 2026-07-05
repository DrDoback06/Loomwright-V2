import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import type { Chapter } from '@/db/types';
import {
  beatDelay,
  sentenceOf,
  srSplitWord,
  srTokenise,
  type PaceOptions,
} from '@/services/speed-reader';
import { useProjectStore } from '@/stores/project';

/** Speed Reader: RSVP over any chapter (or pasted text) with the legacy
 * pacing rules — punctuation and sentence pauses, long-word slowdown. */
export function SpeedReaderSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const chapters = useLiveQuery(
    async () =>
      projectId
        ? (await db.chapters.where('projectId').equals(projectId).toArray()).sort(
            (a, b) => a.order - b.order
          )
        : [],
    [projectId],
    null as Chapter[] | null
  );

  const [sourceId, setSourceId] = useState<string>('paste');
  const [pasted, setPasted] = useState('');
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [wpm, setWpm] = useState(300);
  const [fontScale, setFontScale] = useState(1);
  const [pace, setPace] = useState<Required<PaceOptions>>({
    punctuationPause: true,
    sentencePause: true,
    longWordSlowdown: true,
  });

  const text = useMemo(() => {
    if (sourceId === 'paste') return pasted;
    const chapter = chapters?.find((c) => c.id === sourceId);
    return chapter ? chapter.paragraphs.map((p) => p.text).join(' ') : '';
  }, [sourceId, pasted, chapters]);

  const beats = useMemo(() => srTokenise(text), [text]);
  const beat = beats[Math.min(index, beats.length - 1)];

  // The play loop: one timeout per beat, delay from the engine.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!playing) return;
    if (index >= beats.length - 1) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(() => setIndex((i) => i + 1), beatDelay(beats[index], wpm, pace));
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, index, beats, wpm, pace]);

  // New source → rewind.
  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [text]);

  if (!projectId || chapters === null) return null;

  const split = beat ? srSplitWord(beat.word) : null;
  const progress = beats.length > 1 ? index / (beats.length - 1) : 0;

  return (
    <div className="lw-page lw-page--wide" data-testid="surface-speed-reader">
      <div>
        <h1 className="lw-page__title">Speed Reader</h1>
        <p className="lw-page__subtitle">
          One word at a time, paced by punctuation. Read your own chapters back at speed.
        </p>
      </div>

      <div className="lw-toolsplit">
        <aside className="lw-toolsplit__side">
          <label className="lw-field__label" htmlFor="sr-source">
            Source
          </label>
          <select
            id="sr-source"
            className="lw-input"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
          >
            <option value="paste">Pasted text</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.wordCount.toLocaleString()} words)
              </option>
            ))}
          </select>
          {sourceId === 'paste' && (
            <textarea
              className="lw-input lw-sr__paste"
              aria-label="Paste text to read"
              placeholder="Paste anything here…"
              rows={6}
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
            />
          )}

          <label className="lw-field__label" htmlFor="sr-wpm" style={{ marginTop: 'var(--sp-5)' }}>
            Speed — {wpm} wpm
          </label>
          <input
            id="sr-wpm"
            type="range"
            min={100}
            max={800}
            step={20}
            value={wpm}
            onChange={(e) => setWpm(Number(e.target.value))}
          />
          <label className="lw-field__label" htmlFor="sr-font">
            Word size
          </label>
          <input
            id="sr-font"
            type="range"
            min={0.7}
            max={1.6}
            step={0.1}
            value={fontScale}
            onChange={(e) => setFontScale(Number(e.target.value))}
          />

          {(
            [
              ['punctuationPause', 'Pause on commas'],
              ['sentencePause', 'Pause on sentence ends'],
              ['longWordSlowdown', 'Slow long words'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="lw-toggle">
              <input
                type="checkbox"
                checked={pace[key]}
                onChange={(e) => setPace((p) => ({ ...p, [key]: e.target.checked }))}
              />
              <span>{label}</span>
            </label>
          ))}
        </aside>

        <div className="lw-toolsplit__main">
          <section className="lw-card lw-sr__stage">
            {beats.length === 0 ? (
              <p className="lw-empty__note">Pick a chapter or paste some text to begin.</p>
            ) : (
              <>
                <div
                  className="lw-sr__word"
                  data-testid="sr-word"
                  style={{ fontSize: `calc(2.6rem * ${fontScale})` }}
                  aria-live="off"
                >
                  <span className="lw-sr__before">{split?.before}</span>
                  <span className="lw-sr__pivot">{split?.pivot}</span>
                  <span className="lw-sr__after">{split?.after}</span>
                </div>
                <p className="lw-sr__sentence">{sentenceOf(beats, index)}</p>

                <div className="lw-sr__transport">
                  <button
                    type="button"
                    className="lw-btn"
                    aria-label="Previous word"
                    onClick={() => setIndex((i) => Math.max(0, i - 1))}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn--primary"
                    onClick={() => {
                      if (!playing && index >= beats.length - 1) setIndex(0);
                      setPlaying((p) => !p);
                    }}
                  >
                    {playing ? 'Pause' : 'Play'}
                  </button>
                  <button
                    type="button"
                    className="lw-btn"
                    aria-label="Next word"
                    onClick={() => setIndex((i) => Math.min(beats.length - 1, i + 1))}
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="lw-btn"
                    onClick={() => {
                      setPlaying(false);
                      setIndex(0);
                    }}
                  >
                    Restart
                  </button>
                </div>

                <input
                  className="lw-sr__scrub"
                  type="range"
                  aria-label="Reading position"
                  min={0}
                  max={Math.max(0, beats.length - 1)}
                  value={Math.min(index, beats.length - 1)}
                  onChange={(e) => {
                    setPlaying(false);
                    setIndex(Number(e.target.value));
                  }}
                />
                <p className="lw-fieldnote" style={{ textAlign: 'center' }}>
                  Word {Math.min(index + 1, beats.length)} of {beats.length} ·{' '}
                  {Math.round(progress * 100)}%
                </p>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { configuredEntityTypes, getEntityConfig } from '@/domain/entity-configs';
import { buildSearchIndex, type SearchHit } from '@/services/search';
import { useEditorStore } from '@/stores/editor';
import { useFocusStore } from '@/stores/focus';
import { useGenerationStore } from '@/stores/generation';
import { useProjectStore } from '@/stores/project';
import { useUiStore, type RouteId } from '@/stores/ui';
import { useMergeStore } from '@/stores/merge';

interface Command {
  id: string;
  title: string;
  subtitle: string;
  run: () => void;
  /** Hidden until the query matches — keeps the idle palette short. */
  searchOnly?: boolean;
  /** Rendered right-aligned on the row. This is how people learn the
   * keyboard path without being taught it — so it must be a shortcut
   * that genuinely exists, never a decoration. */
  shortcut?: string;
  /** Commands that reach an AI capability, surfaced by the `/` mode. */
  ai?: boolean;
}

interface Row {
  key: string;
  glyph: string;
  title: string;
  subtitle: string;
  run: () => void;
  shortcut?: string;
}

/** Typing a prefix narrows the palette to one kind of thing. The prefix
 * stays in the input, so Backspace at position 0 leaves the mode with no
 * extra state to track. */
type PaletteMode = 'all' | 'commands' | 'entities' | 'chapters' | 'ai';

const MODE_BY_PREFIX: Record<string, PaletteMode> = {
  '>': 'commands',
  '@': 'entities',
  '#': 'chapters',
  '/': 'ai',
};

const MODE_HINT: Record<PaletteMode, string> = {
  all: '> commands · @ codex · # chapters · / AI',
  commands: 'Commands',
  entities: 'Codex entries',
  chapters: 'Chapters',
  ai: 'AI actions',
};

function parseQuery(raw: string): { mode: PaletteMode; term: string } {
  const mode = MODE_BY_PREFIX[raw[0] ?? ''];
  return mode ? { mode, term: raw.slice(1).trim() } : { mode: 'all', term: raw.trim() };
}

/** Lower sorts first. Exact title, then title prefix, then anywhere in the
 * title, then the subtitle — the order someone typing a name expects. */
function commandScore(c: Command, q: string): number {
  if (!q) return 3;
  const title = c.title.toLowerCase();
  if (title === q) return 0;
  if (title.startsWith(q) || title.startsWith(`go to ${q}`)) return 1;
  if (title.includes(q)) return 2;
  return 3;
}

const RECENTS_KEY = 'lw:palette-recents';
const RECENTS_MAX = 6;

function loadRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    return raw ? (JSON.parse(raw) as string[]).slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}

function rememberRecent(id: string): void {
  try {
    const next = [id, ...loadRecents().filter((x) => x !== id)].slice(0, RECENTS_MAX);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
  } catch {
    /* private mode — recents are a convenience, never a requirement */
  }
}

/** The command palette (Ctrl/Cmd+K): jump anywhere, find anything.
 * Commands + a fresh minisearch pass over entities and chapters. */
export function CommandPalette({ onClose }: { onClose: () => void }) {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const palettePurpose = useUiStore((s) => s.palettePurpose);
  const setPalettePurpose = useUiStore((s) => s.setPalettePurpose);
  const mergeRequest = useMergeStore((s) => s.request);
  const setMergeTarget = useMergeStore((s) => s.setTargetEntity);
  const setCodexType = useUiStore((s) => s.setCodexType);
  const requestChapter = useUiStore((s) => s.requestChapter);
  const setFocus = useFocusStore((s) => s.setFocus);
  const openCreate = useEditorStore((s) => s.openCreate);
  const openGenerate = useGenerationStore((s) => s.openDialog);

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [active, setActive] = useState(0);
  const [searchVersion, setSearchVersion] = useState(0);
  const searchRef = useRef<((q: string, limit?: number) => SearchHit[]) | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    if (projectId) {
      void buildSearchIndex(projectId).then((search) => {
        searchRef.current = search;
        setSearchVersion((version) => version + 1);
      });
    }
  }, [projectId]);

  // Open merge-target search already seeded with the best available name, so
  // users immediately see likely canonical records instead of an empty drawer.
  useEffect(() => {
    if (palettePurpose === 'merge-target') {
      setQuery(mergeRequest?.canonicalName?.trim() || '');
    }
  }, [palettePurpose, mergeRequest?.canonicalName]);

  useEffect(() => {
    const { term } = parseQuery(query);
    setHits(term && searchRef.current ? searchRef.current(term) : []);
    setActive(0);
  }, [query, searchVersion]);

  const closePalette = () => {
    setPalettePurpose('search');
    onClose();
  };

  const go = (route: RouteId) => {
    setRoute(route);
    closePalette();
  };

  const commands: Command[] = useMemo(
    () => [
      { id: 'write', title: "Go to Writer's Room", subtitle: 'Write and extract', shortcut: 'Alt+1', run: () => go('writers-room') },
      { id: 'codex', title: 'Go to Codex', subtitle: 'Everything your story knows', shortcut: 'Alt+2', run: () => go('codex') },
      { id: 'insights', title: 'Go to Insights', subtitle: 'Overview, Today, Review', shortcut: 'Alt+3', run: () => go('insights') },
      { id: 'worlds', title: 'Go to Worlds', subtitle: 'Atlas, Tangle, Skill Trees', shortcut: 'Alt+4', run: () => go('worlds') },
      { id: 'home', title: 'Go to Home', subtitle: 'Project dashboard', run: () => go('home') },
      { id: 'today', title: 'Go to Today', subtitle: 'What to work on now', run: () => go('today') },
      { id: 'atlas', title: 'Go to Atlas', subtitle: 'The world map', run: () => go('atlas') },
      { id: 'tangle', title: 'Go to Tangle', subtitle: 'Story corkboard', run: () => go('tangle') },
      { id: 'skills', title: 'Go to Skill Trees', subtitle: 'Constellations', run: () => go('skill-trees') },
      { id: 'tables', title: 'Go to Random Tables', subtitle: 'Weighted idea generators', run: () => go('random-tables') },
      { id: 'reader', title: 'Go to Speed Reader', subtitle: 'RSVP read-back', run: () => go('speed-reader') },
      { id: 'templates', title: 'Go to Templates', subtitle: 'Reusable starters', run: () => go('templates') },
      { id: 'review', title: 'Go to Review', subtitle: 'Extraction queue', run: () => go('review') },
      { id: 'handoff', title: 'Go to AI Handoff', subtitle: 'External-AI workflow', ai: true, run: () => go('handoff') },
      { id: 'settings', title: 'Go to Settings', subtitle: 'AI, privacy, extraction', run: () => go('settings') },
      { id: 'trash', title: 'Go to Trash', subtitle: 'Restore deleted things', run: () => go('trash') },
      // Create anything, from anywhere: one manual + one generate command
      // per configured entity type.
      ...configuredEntityTypes().flatMap((type) => {
        const label = (getEntityConfig(type)?.displayName ?? ENTITY_TYPE_META[type].label).toLowerCase();
        return [
          {
            id: `create-${type}`,
            title: `Create ${label}…`,
            subtitle: 'Blank editor',
            searchOnly: true,
            run: () => {
              openCreate(type);
              closePalette();
            },
          },
          {
            id: `generate-${type}`,
            title: `Generate ${label}… ✨`,
            subtitle: 'Random, AI, or paste JSON',
            searchOnly: true,
            ai: true,
            run: () => {
              openGenerate({ kind: 'entity', entityType: type });
              closePalette();
            },
          },
        ];
      }),
    ],
    [onClose, openCreate, openGenerate]
  );

  const { mode, term } = parseQuery(query);

  const rows: Row[] = useMemo(() => {
    const q = term.toLowerCase();
    const wantCommands =
      palettePurpose !== 'merge-target' && (mode === 'all' || mode === 'commands' || mode === 'ai');

    const commandRows: Row[] = !wantCommands
      ? []
      : commands
          .filter((c) => (mode === 'ai' ? c.ai : true))
          .filter((c) =>
            q
              ? c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q)
              : // A mode is an explicit ask, so it shows its whole set
                // rather than only the short idle list.
                mode !== 'all' || !c.searchOnly
          )
          // A title match beats a subtitle match. Without this, typing
          // "today" surfaced "Go to Insights" first, because Insights
          // lists Today among its sub-views — technically a match, and
          // exactly not what was asked for.
          .sort((a, b) => commandScore(a, q) - commandScore(b, q))
          .map((c) => ({
            key: `cmd:${c.id}`,
            glyph: '›',
            title: c.title,
            subtitle: c.subtitle,
            shortcut: c.shortcut,
            run: () => {
              rememberRecent(`cmd:${c.id}`);
              c.run();
            },
          }));

    const hitRows: Row[] = hits
      .filter((h) => {
        if (mode === 'entities') return h.kind === 'entity';
        if (mode === 'chapters') return h.kind === 'chapter';
        if (mode === 'commands' || mode === 'ai') return false;
        return true;
      })
      .filter((h) => {
        if (palettePurpose !== 'merge-target') return true;
        return h.kind === 'entity' && h.entityType === mergeRequest?.entityType;
      })
      .map((h) => ({
        key: `${h.kind}:${h.id}`,
        glyph: h.kind === 'chapter' ? '✎' : (h.entityType && ENTITY_TYPE_META[h.entityType].glyph) || '◈',
        title: h.title,
        subtitle:
          palettePurpose === 'merge-target'
            ? `Merge into this ${h.entityType ? ENTITY_TYPE_META[h.entityType].label.toLowerCase() : 'entity'} · ${h.subtitle}`
            : h.kind === 'chapter'
              ? `Chapter · ${h.subtitle}`
              : `${h.entityType ? ENTITY_TYPE_META[h.entityType].label : 'Entity'} · ${h.subtitle}`,
        run: () => {
          if (palettePurpose === 'merge-target' && h.kind === 'entity') {
            setMergeTarget(h.id);
            closePalette();
            return;
          }
          if (h.kind === 'chapter') {
            requestChapter(h.id);
            setRoute('writers-room');
          } else if (h.entityType) {
            setFocus({ id: h.id, type: h.entityType, name: h.title });
            setCodexType(h.entityType);
            setRoute('codex');
          }
          closePalette();
        },
      }));
    const all = q || mode !== 'all' ? [...hitRows, ...commandRows] : commandRows;

    // Idle, with no mode: recents float to the top. They are what you are
    // most likely to want, and they teach the palette by showing it doing
    // something useful the moment it opens.
    if (!q && mode === 'all' && palettePurpose !== 'merge-target') {
      const recents = loadRecents();
      const rank = (row: Row) => {
        const i = recents.indexOf(row.key);
        return i === -1 ? recents.length : i;
      };
      return [...all].sort((a, b) => rank(a) - rank(b)).slice(0, 12);
    }
    return all.slice(0, 12);
  }, [
    commands,
    hits,
    mergeRequest?.entityType,
    mode,
    palettePurpose,
    term,
    requestChapter,
    setCodexType,
    setFocus,
    setMergeTarget,
    setRoute,
  ]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') closePalette();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, rows.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    }
    if (e.key === 'Enter' && rows[active]) {
      e.preventDefault();
      rows[active].run();
    }
  };

  return (
    <div className="lw-palette-backdrop" role="presentation" onClick={closePalette}>
      <div
        className="lw-palette"
        role="dialog"
        aria-label="Command palette"
        data-testid="command-palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          className="lw-input lw-palette__input"
          placeholder={
            palettePurpose === 'merge-target'
              ? `Find an existing ${mergeRequest ? ENTITY_TYPE_META[mergeRequest.entityType].label.toLowerCase() : 'entity'} to merge into…`
              : 'Search entities, chapters, commands…'
          }
          aria-label="Palette search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
        />
        {palettePurpose === 'merge-target' ? (
          <p className="lw-palette__mode">
            Choose the canonical existing entity. The merge preview remains open behind this search.
          </p>
        ) : (
          <p className="lw-palette__mode" data-testid="palette-mode">
            {MODE_HINT[mode]}
          </p>
        )}
        <ul className="lw-palette__list">
          {rows.length === 0 ? (
            <li className="lw-palette__empty">Nothing matches “{term}”.</li>
          ) : (
            rows.map((row, i) => (
              <li key={row.key}>
                <button
                  type="button"
                  className={i === active ? 'lw-palette__row lw-palette__row--active' : 'lw-palette__row'}
                  onClick={row.run}
                  onMouseEnter={() => setActive(i)}
                >
                  <span aria-hidden className="lw-palette__glyph">
                    {row.glyph}
                  </span>
                  <span className="lw-palette__text">
                    <span className="lw-palette__title">{row.title}</span>
                    <span className="lw-palette__sub">{row.subtitle}</span>
                  </span>
                  {row.shortcut ? (
                    <kbd className="lw-palette__kbd" aria-hidden>
                      {row.shortcut}
                    </kbd>
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

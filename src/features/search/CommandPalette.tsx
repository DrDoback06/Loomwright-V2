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
}

interface Row {
  key: string;
  glyph: string;
  title: string;
  subtitle: string;
  run: () => void;
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
    const q = query.trim();
    setHits(q && searchRef.current ? searchRef.current(q) : []);
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
      { id: 'write', title: "Go to Writer's Room", subtitle: 'Write and extract', run: () => go('writers-room') },
      { id: 'home', title: 'Go to Home', subtitle: 'Project dashboard', run: () => go('home') },
      { id: 'today', title: 'Go to Today', subtitle: 'What to work on now', run: () => go('today') },
      { id: 'atlas', title: 'Go to Atlas', subtitle: 'The world map', run: () => go('atlas') },
      { id: 'tangle', title: 'Go to Tangle', subtitle: 'Story corkboard', run: () => go('tangle') },
      { id: 'skills', title: 'Go to Skill Trees', subtitle: 'Constellations', run: () => go('skill-trees') },
      { id: 'tables', title: 'Go to Random Tables', subtitle: 'Weighted idea generators', run: () => go('random-tables') },
      { id: 'reader', title: 'Go to Speed Reader', subtitle: 'RSVP read-back', run: () => go('speed-reader') },
      { id: 'templates', title: 'Go to Templates', subtitle: 'Reusable starters', run: () => go('templates') },
      { id: 'review', title: 'Go to Review', subtitle: 'Extraction queue', run: () => go('review') },
      { id: 'handoff', title: 'Go to AI Handoff', subtitle: 'External-AI workflow', run: () => go('handoff') },
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

  const rows: Row[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    const commandRows: Row[] = palettePurpose === 'merge-target'
      ? []
      : commands
      .filter((c) => (q ? c.title.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q) : !c.searchOnly))
      .map((c) => ({ key: `cmd:${c.id}`, glyph: '›', title: c.title, subtitle: c.subtitle, run: c.run }));
    const hitRows: Row[] = hits
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
    return q ? [...hitRows, ...commandRows].slice(0, 12) : commandRows;
  }, [
    commands,
    hits,
    mergeRequest?.entityType,
    palettePurpose,
    query,
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
        ) : null}
        <ul className="lw-palette__list">
          {rows.length === 0 ? (
            <li className="lw-palette__empty">Nothing matches “{query}”.</li>
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
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}

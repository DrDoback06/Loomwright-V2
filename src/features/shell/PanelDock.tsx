import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ALL_ENTITY_TYPES, ENTITY_TYPE_META } from '@/domain/entity-types';
import { configuredEntityTypes } from '@/domain/entity-configs';
import { getEntity } from '@/db/repos/entities';
import { CodexPanel } from '@/features/codex/CodexPanel';
import { refsInFields } from '@/services/relations';
import { useFocusStore } from '@/stores/focus';
import { useLayoutStore } from '@/stores/layout';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';

/** The right-hand dock: an expandable codex rail plus stacked live panels.
 * Labels are intentionally available on demand so users never have to learn
 * Loomwright's glyphs by trial and error. */
export function PanelDock() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const openPanels = useLayoutStore((s) => s.openPanels);
  const openPanel = useLayoutStore((s) => s.openPanel);
  const hydrate = useLayoutStore((s) => s.hydrate);
  const expanded = useUiStore((s) => s.rightDockExpanded);
  const toggleRightDock = useUiStore((s) => s.toggleRightDock);

  useEffect(() => {
    if (projectId) void hydrate(projectId);
  }, [projectId, hydrate]);

  if (!projectId) return null;
  const available = ALL_ENTITY_TYPES.filter((t) => configuredEntityTypes().includes(t));

  return (
    <div
      className={expanded ? 'lw-dock lw-dock--expanded' : 'lw-dock lw-dock--collapsed'}
      data-testid="panel-dock"
    >
      {openPanels.length > 0 && (
        <div className="lw-dock__panels">
          <PairStrip />
          {openPanels.map((type) => (
            <CodexPanel key={type} type={type} />
          ))}
        </div>
      )}
      <nav className="lw-dock__strip" aria-label="Open codex panel">
        <div className="lw-dock__head">
          {expanded ? <strong>Codex panels</strong> : <span aria-hidden>◇</span>}
          <button
            type="button"
            className="lw-iconbtn"
            onClick={toggleRightDock}
            aria-label={expanded ? 'Collapse right navigation' : 'Expand right navigation'}
            title={expanded ? 'Collapse right navigation' : 'Expand right navigation'}
          >
            {expanded ? '›' : '‹'}
          </button>
        </div>
        {available.map((type) => {
          const meta = ENTITY_TYPE_META[type];
          const isOpen = openPanels.includes(type);
          return (
            <button
              key={type}
              type="button"
              className={isOpen ? 'lw-dock__glyph lw-dock__glyph--open' : 'lw-dock__glyph'}
              aria-label={`Open ${meta.plural} panel`}
              aria-pressed={isOpen}
              title={meta.plural}
              style={isOpen ? { color: meta.deep, background: meta.soft } : undefined}
              onClick={() => openPanel(type, projectId)}
            >
              <span className="lw-dock__glyphmark" aria-hidden>{meta.glyph}</span>
              {expanded ? <span className="lw-dock__glyphlabel">{meta.plural}</span> : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

/** Two same-type entities in context (one locked, one focused): show
 * them side by side with any field references that tie them together. */
function PairStrip() {
  const lock = useFocusStore((s) => s.lock);
  const focus = useFocusStore((s) => s.focus);
  const clearLock = useFocusStore((s) => s.clearLock);
  const pair =
    lock && focus && lock.type === focus.type && lock.id !== focus.id
      ? ([lock, focus] as const)
      : null;

  const relation = useLiveQuery(
    async () => {
      if (!pair) return null;
      const [a, b] = await Promise.all([getEntity(pair[0].id), getEntity(pair[1].id)]);
      if (!a || !b) return null;
      const aRefsB = refsInFields(a).some((r) => r.id === b.id);
      const bRefsA = refsInFields(b).some((r) => r.id === a.id);
      return { aRefsB, bRefsA };
    },
    [pair?.[0]?.id, pair?.[1]?.id],
    null
  );

  if (!pair) return null;

  return (
    <div className="lw-pairstrip" data-testid="pair-strip">
      <span className="lw-pairstrip__names">
        <strong>{pair[0].name}</strong> <span aria-hidden>∞</span> <strong>{pair[1].name}</strong>
      </span>
      <span className="lw-pairstrip__note">
        {relation?.aRefsB || relation?.bRefsA
          ? 'Connected in the codex'
          : 'No recorded connection yet'}
      </span>
      <button type="button" className="lw-btn lw-btn--sm" onClick={clearLock}>
        Unlock
      </button>
    </div>
  );
}

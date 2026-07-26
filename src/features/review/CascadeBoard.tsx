import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { undoAuditEntry } from '@/db/repos/undo';
import type { Entity } from '@/db/types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import { applyDelta } from '@/services/intelligence/apply';
import { deltaTitle, filterDelta, type DeltaGroup, type StoryDelta } from '@/services/intelligence/types';
import { useIntelligenceStore } from '@/stores/intelligence';
import { useProjectStore } from '@/stores/project';
import { toast } from '@/stores/toasts';

const BAND_LABEL: Record<StoryDelta['groups'][number]['confidenceBand'], string> = {
  blue: 'Certain',
  green: 'Strong',
  orange: 'Uncertain',
  red: 'Weak',
};

/** Render any field value as something a human can read in a diff. */
function displayValue(value: unknown): string {
  if (value == null || value === '') return '—';
  if (Array.isArray(value)) {
    return value.length ? value.map((v) => displayValue(v)).join(', ') : '—';
  }
  if (typeof value === 'object') {
    const named = value as { name?: unknown };
    if (typeof named.name === 'string') return named.name;
    return JSON.stringify(value);
  }
  return String(value);
}

/**
 * The smart review board: one paste (or one Save & Extract) becomes grouped
 * relational cascades. Each group is a story — "Vex learned Venom Strike →
 * +skill → Serpent Path ▸ Toxins" — that toggles as a unit, and the whole
 * board accepts in one click and reverts with one Undo.
 *
 * Lays out one column on phones with groups as expandable cards, so the
 * flags and correction pickers stay usable at the table.
 */
export function CascadeBoard() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const staged = useIntelligenceStore((s) => s.staged);
  const enabled = useIntelligenceStore((s) => s.enabled);
  const progress = useIntelligenceStore((s) => s.progress);
  const toggleGroup = useIntelligenceStore((s) => s.toggleGroup);
  const toggleUnit = useIntelligenceStore((s) => s.toggleUnit);
  const resolveConflict = useIntelligenceStore((s) => s.resolveConflict);
  const resolveParent = useIntelligenceStore((s) => s.resolveParent);
  const discard = useIntelligenceStore((s) => s.discard);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const locations = useLiveQuery(
    async () =>
      projectId
        ? db.entities.where('[projectId+type]').equals([projectId, 'locations']).toArray()
        : [],
    [projectId],
    [] as Entity[]
  );

  // Index every unit by id once so a group can render its members in order.
  const unitIndex = useMemo(() => {
    const map = new Map<string, { kind: string; node: React.ReactNode; conflictNode?: React.ReactNode }>();
    if (!staged) return map;

    for (const e of staged.entities) {
      map.set(e.unitId, {
        kind: 'create',
        node: (
          <>
            <span className="lw-cascade__verb">New</span> {ENTITY_TYPE_META[e.draft.type].label}{' '}
            <strong>{e.draft.name}</strong>
          </>
        ),
      });
    }
    for (const p of staged.patches) {
      map.set(p.unitId, {
        kind: 'patch',
        node: (
          <>
            <strong>{p.entityName}</strong> · {p.fieldLabel}{' '}
            <span className="lw-cascade__diff">
              <span className="lw-cascade__before">{displayValue(p.before)}</span>
              <span aria-hidden> → </span>
              <span className="lw-cascade__after">
                {p.mode === 'append' ? `+ ${displayValue(p.after)}` : displayValue(p.after)}
              </span>
            </span>
          </>
        ),
        conflictNode: p.conflict ? (
          <div className="lw-cascade__conflict" role="group" aria-label="Resolve conflict">
            <p className="lw-cascade__conflictreason">⚑ {p.conflict.reason}</p>
            <div className="lw-cascade__pickers">
              {p.conflict.options.map((option, i) => (
                <button
                  key={i}
                  type="button"
                  className="lw-btn lw-btn--sm"
                  onClick={() => resolveConflict(p.unitId, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : undefined,
      });
    }
    for (const g of staged.graphPlacements) {
      map.set(g.unitId, {
        kind: 'placement',
        node: (
          <>
            <span className="lw-cascade__verb">Place</span> <strong>{g.node.label}</strong> on{' '}
            {g.graphName}
            {g.group ? ` ▸ ${g.group}` : ''}
          </>
        ),
      });
    }
    for (const h of staged.hierarchyPlacements) {
      map.set(h.unitId, {
        kind: 'nesting',
        node: (
          <>
            <span className="lw-cascade__verb">Nest</span> <strong>{h.childName}</strong> under{' '}
            {h.parentId ? h.parentName : <em>{h.unresolvedParentName} — not found</em>}
          </>
        ),
        conflictNode: h.parentId ? undefined : (
          <div className="lw-cascade__conflict">
            <p className="lw-cascade__conflictreason">
              ⚑ No location called “{h.unresolvedParentName}” yet. Pick its parent:
            </p>
            <select
              className="lw-input"
              aria-label={`Parent location for ${h.childName}`}
              defaultValue=""
              onChange={(event) => {
                const found = locations.find((l) => l.id === event.target.value);
                if (found) resolveParent(h.unitId, found.id, found.name);
              }}
            >
              <option value="">Leave un-nested</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        ),
      });
    }
    for (const l of staged.links) {
      map.set(l.unitId, { kind: 'link', node: <>{l.label}</> });
    }
    for (const s of staged.suggestions) {
      map.set(s.unitId, {
        kind: 'suggestion',
        node: (
          <>
            <span className="lw-cascade__verb lw-cascade__verb--idea">Idea</span>{' '}
            <strong>{s.title}</strong> — {s.body}
          </>
        ),
      });
    }
    return map;
  }, [staged, locations, resolveConflict, resolveParent]);

  if (!staged) return null;

  const groups = staged.groups;
  const enabledCount = [...enabled].length;

  const accept = async () => {
    setBusy(true);
    try {
      const result = await applyDelta(staged, { enabledUnitIds: enabled });
      // Describe what was actually applied, not everything that was found.
      const summary = deltaTitle(filterDelta(staged, enabled));
      discard();
      toast(`Applied: ${summary}.`, {
        kind: 'success',
        action: {
          label: 'Undo',
          run: async () => {
            await undoAuditEntry(result.auditId);
            toast('Extraction undone.', { kind: 'success' });
          },
        },
      });
    } catch {
      toast('Could not apply these changes — nothing was written.', { kind: 'error' });
    } finally {
      setBusy(false);
    }
  };

  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const groupState = (group: DeltaGroup) => {
    const on = group.unitIds.filter((id) => enabled.has(id)).length;
    return { on, all: on === group.unitIds.length, none: on === 0 };
  };

  return (
    <section className="lw-cascadeboard" data-testid="cascade-board" aria-label="Extraction results">
      <header className="lw-cascadeboard__head">
        <div>
          <p className="lw-reviewcentre__eyebrow">Story intelligence</p>
          <h2 className="lw-cascadeboard__title">
            {groups.length} change{groups.length === 1 ? '' : 's'} found
          </h2>
          <p className="lw-page__subtitle">
            {deltaTitle(staged)}. Nothing is written until you accept.
          </p>
        </div>
        <div className="lw-cascadeboard__actions">
          <button
            type="button"
            className="lw-btn lw-btn--primary"
            disabled={busy || enabledCount === 0}
            onClick={() => void accept()}
            data-testid="cascade-accept-all"
          >
            Accept all
          </button>
          <button type="button" className="lw-btn" disabled={busy} onClick={discard}>
            Discard
          </button>
        </div>
      </header>

      {progress ? (
        <p className="lw-cascadeboard__progress" role="status">
          Reading chapter {progress.done} of {progress.total}…
        </p>
      ) : null}

      {staged.warnings.length ? (
        <details className="lw-cascadeboard__warnings">
          <summary>
            {staged.warnings.length} note{staged.warnings.length === 1 ? '' : 's'}
          </summary>
          <ul>
            {staged.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {groups.length === 0 ? (
        <p className="lw-empty" data-testid="cascade-empty">
          Nothing to track in this text yet. Extraction looks for characters, places, items
          changing hands, skills learned and bonds forming — keep writing and run it again.
        </p>
      ) : null}

      <ul className="lw-cascadeboard__list">
        {groups.map((group) => {
          const state = groupState(group);
          const isOpen = expanded.has(group.id);
          return (
            <li
              key={group.id}
              className={`lw-cascade lw-cascade--${group.confidenceBand}${
                group.flagged ? ' lw-cascade--flagged' : ''
              }${state.none ? ' lw-cascade--off' : ''}`}
              data-testid="cascade-group"
            >
              <div className="lw-cascade__head">
                <label className="lw-cascade__toggle">
                  <input
                    type="checkbox"
                    checked={state.all}
                    ref={(el) => {
                      // Partially-selected cascades read as indeterminate
                      // rather than lying in either direction.
                      if (el) el.indeterminate = !state.all && !state.none;
                    }}
                    onChange={() => toggleGroup(group.unitIds)}
                    aria-label={`Include: ${group.headline}`}
                  />
                  <span className="lw-cascade__headline">{group.headline}</span>
                </label>
                <span className={`lw-cascade__band lw-band--${group.confidenceBand}`}>
                  {group.flagged ? '⚑ Needs a look' : BAND_LABEL[group.confidenceBand]}
                </span>
                <button
                  type="button"
                  className="lw-btn lw-btn--sm"
                  aria-expanded={isOpen}
                  onClick={() => toggleExpanded(group.id)}
                >
                  {isOpen ? 'Hide' : `${group.unitIds.length} change${group.unitIds.length === 1 ? '' : 's'}`}
                </button>
              </div>

              {isOpen ? (
                <ul className="lw-cascade__units">
                  {group.unitIds.map((unitId) => {
                    const unit = unitIndex.get(unitId);
                    if (!unit) return null;
                    return (
                      <li key={unitId} className={`lw-cascade__unit lw-cascade__unit--${unit.kind}`}>
                        <label className="lw-cascade__unittoggle">
                          <input
                            type="checkbox"
                            checked={enabled.has(unitId)}
                            onChange={() => toggleUnit(unitId)}
                          />
                          <span>{unit.node}</span>
                        </label>
                        {unit.conflictNode}
                      </li>
                    );
                  })}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

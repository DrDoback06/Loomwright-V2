import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { configuredEntityTypes } from '@/domain/entity-configs';
import { ALL_ENTITY_TYPES, ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';
import { EntityRosterSurface } from '@/features/codex/EntityRosterSurface';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';

/** The codex, with its sixteen types as a filter strip rather than
 * sixteen rail slots. Same rosters, same dossiers — but the type list is
 * now a property of the codex instead of two thirds of the app's
 * navigation, and each chip carries its live count so an empty type is
 * visibly empty before you open it. */
export function CodexSurface() {
  const codexType = useUiStore((s) => s.codexType);
  const setCodexType = useUiStore((s) => s.setCodexType);
  const projectId = useProjectStore((s) => s.currentProjectId);

  const types = ALL_ENTITY_TYPES.filter((t) => configuredEntityTypes().includes(t));

  const counts = useLiveQuery(
    async () => {
      if (!projectId) return {} as Partial<Record<EntityType, number>>;
      const rows = await db.entities.where('projectId').equals(projectId).toArray();
      const out: Partial<Record<EntityType, number>> = {};
      for (const row of rows) {
        if (row.status !== 'active') continue;
        out[row.type] = (out[row.type] ?? 0) + 1;
      }
      return out;
    },
    [projectId],
    {} as Partial<Record<EntityType, number>>
  );

  return (
    <div className="lw-dest" data-testid="surface-codex">
      <div className="lw-typestrip" role="tablist" aria-label="Codex types">
        {types.map((type) => {
          const meta = ENTITY_TYPE_META[type];
          const count = counts[type] ?? 0;
          const active = type === codexType;
          return (
            <button
              key={type}
              type="button"
              role="tab"
              className={active ? 'lw-typechip lw-typechip--active' : 'lw-typechip'}
              aria-selected={active}
              aria-label={meta.plural}
              onClick={() => setCodexType(type)}
            >
              <span aria-hidden style={{ color: meta.color }}>
                {meta.glyph}
              </span>
              <span className="lw-typechip__label">{meta.plural}</span>
              <span className="lw-typechip__count" aria-hidden>
                {count}
              </span>
            </button>
          );
        })}
      </div>
      <div className="lw-dest__body">
        <EntityRosterSurface type={codexType} />
      </div>
    </div>
  );
}

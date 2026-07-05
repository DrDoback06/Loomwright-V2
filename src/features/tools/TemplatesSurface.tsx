import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import type { BoardTemplate, EntityTemplate, Template } from '@/db/types';
import { ENTITY_TYPE_META } from '@/domain/entity-types';
import {
  BUILTIN_ENTITY_TEMPLATES,
  deleteTemplate,
  entityInitialFrom,
  isBuiltinTemplate,
} from '@/services/templates';
import { useEditorStore } from '@/stores/editor';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';

/** Templates: reusable entity shapes (incl. nine genre starters) and
 * saved Tangle board clusters. Entity templates prefill the create
 * drawer; board templates stamp from the Tangle sidebar. */
export function TemplatesSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const openCreate = useEditorStore((s) => s.openCreate);
  const setRoute = useUiStore((s) => s.setRoute);

  const userTemplates = useLiveQuery(
    async () =>
      projectId
        ? (await db.templates.where('projectId').equals(projectId).toArray()).sort(
            (a, b) => b.createdAt - a.createdAt
          )
        : [],
    [projectId],
    null as Template[] | null
  );

  if (!projectId || userTemplates === null) return null;

  const entityTemplates: EntityTemplate[] = [
    ...BUILTIN_ENTITY_TEMPLATES,
    ...userTemplates.filter((t): t is EntityTemplate => t.kind === 'entity'),
  ];
  const boardTemplates = userTemplates.filter((t): t is BoardTemplate => t.kind === 'board');

  return (
    <div className="lw-page lw-page--wide" data-testid="surface-templates">
      <div>
        <h1 className="lw-page__title">Templates</h1>
        <p className="lw-page__subtitle">
          Start new entries from a shape you trust. Save your own from any dossier
          (&ldquo;Save as template&rdquo;) or Tangle board.
        </p>
      </div>

      <section className="lw-card">
        <h2 className="lw-card__title">Entity templates</h2>
        <div className="lw-templates">
          {entityTemplates.map((t) => (
            <div key={t.id} className="lw-template" data-testid={`template-${t.id}`}>
              <span
                aria-hidden
                className="lw-template__glyph"
                style={{ color: ENTITY_TYPE_META[t.entityType].color }}
              >
                {ENTITY_TYPE_META[t.entityType].glyph}
              </span>
              <span className="lw-template__text">
                <span className="lw-template__name">{t.name}</span>
                <span className="lw-template__sub">
                  {ENTITY_TYPE_META[t.entityType].label}
                  {t.summary ? ` · ${t.summary}` : ''}
                </span>
              </span>
              <span className="lw-template__actions">
                <button
                  type="button"
                  className="lw-btn lw-btn--sm"
                  onClick={() => openCreate(t.entityType, entityInitialFrom(t))}
                >
                  Use
                </button>
                {!isBuiltinTemplate(t) && (
                  <button
                    type="button"
                    className="lw-btn lw-btn--sm"
                    onClick={async () => {
                      await deleteTemplate(t.id);
                      toast('Template deleted.');
                    }}
                  >
                    Delete
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="lw-card">
        <h2 className="lw-card__title">Board templates</h2>
        {boardTemplates.length === 0 ? (
          <p className="lw-empty__note">
            None yet. On a Tangle board, use &ldquo;Save board as template&rdquo; to snapshot
            its cards and threads — then stamp it onto any board.
          </p>
        ) : (
          <div className="lw-templates">
            {boardTemplates.map((t) => (
              <div key={t.id} className="lw-template" data-testid={`template-${t.id}`}>
                <span aria-hidden className="lw-template__glyph">✕</span>
                <span className="lw-template__text">
                  <span className="lw-template__name">{t.name}</span>
                  <span className="lw-template__sub">
                    {t.cards.length} cards · {t.edges.length} threads
                  </span>
                </span>
                <span className="lw-template__actions">
                  <button type="button" className="lw-btn lw-btn--sm" onClick={() => setRoute('tangle')}>
                    Stamp in Tangle
                  </button>
                  <button
                    type="button"
                    className="lw-btn lw-btn--sm"
                    onClick={async () => {
                      await deleteTemplate(t.id);
                      toast('Template deleted.');
                    }}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

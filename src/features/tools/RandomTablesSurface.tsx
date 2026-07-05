import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/db/schema';
import { appendParagraphToChapter } from '@/db/repos/chapters';
import type { RandomTable } from '@/db/types';
import { ALL_ENTITY_TYPES, ENTITY_TYPE_META, type EntityType } from '@/domain/entity-types';
import { configuredEntityTypes } from '@/domain/entity-configs';
import {
  BUILTIN_TABLES,
  createTable,
  deleteTable,
  duplicateTable,
  isBuiltinTable,
  rollTable,
  updateTable,
} from '@/services/random-tables';
import { useEditorStore } from '@/stores/editor';
import { useProjectStore } from '@/stores/project';
import { useUiStore } from '@/stores/ui';
import { toast } from '@/stores/toasts';

/** Random tables: weighted brainstorm generators. Results flow onward —
 * into the manuscript or straight into a new codex entry. */
export function RandomTablesSurface() {
  const projectId = useProjectStore((s) => s.currentProjectId);
  const setRoute = useUiStore((s) => s.setRoute);
  const requestChapter = useUiStore((s) => s.requestChapter);
  const openCreate = useEditorStore((s) => s.openCreate);

  const userTables = useLiveQuery(
    async () =>
      projectId
        ? (await db.randomTables.where('projectId').equals(projectId).toArray()).sort(
            (a, b) => b.updatedAt - a.updatedAt
          )
        : [],
    [projectId],
    null as RandomTable[] | null
  );

  const [activeId, setActiveId] = useState<string>(BUILTIN_TABLES[0].id);
  const [count, setCount] = useState(1);
  const [unique, setUnique] = useState(true);
  const [results, setResults] = useState<string[]>([]);
  const [newName, setNewName] = useState('');

  if (!projectId || userTables === null) return null;

  const tables = [...BUILTIN_TABLES, ...userTables];
  const active = tables.find((t) => t.id === activeId) ?? tables[0];
  const builtin = isBuiltinTable(active);

  const roll = () => {
    const out = rollTable(active, { count, unique });
    if (out.length === 0) {
      toast('This table has no rows yet — add some below.', { kind: 'error' });
      return;
    }
    setResults(out);
  };

  const sendToWriter = async (text: string) => {
    const chapters = await db.chapters.where('projectId').equals(projectId).toArray();
    if (chapters.length === 0) {
      toast('No chapters yet — create one in the Writer’s Room first.', { kind: 'error' });
      return;
    }
    const latest = chapters.reduce((best, c) => (c.updatedAt > best.updatedAt ? c : best));
    await appendParagraphToChapter(latest.id, text);
    requestChapter(latest.id);
    setRoute('writers-room');
    toast(`Added to “${latest.title}”.`, { kind: 'success' });
  };

  const createEntityFrom = (text: string) => {
    const type: EntityType = active.category === 'none' ? 'lore' : active.category;
    // These configs call their name field 'title' (see EntityEditorDrawer).
    const titleTypes = new Set(['quests', 'events', 'lore', 'references', 'timeline']);
    openCreate(type, { [titleTypes.has(type) ? 'title' : 'name']: text });
  };

  const editRow = async (index: number, patch: { text?: string; weight?: number }) => {
    let table = active;
    if (builtin) {
      table = await duplicateTable(projectId, active);
      setActiveId(table.id);
      toast('Builtin copied to your tables — edits land on the copy.');
    }
    const rows = table.rows.map((r, i) => (i === index ? { ...r, ...patch } : r));
    await updateTable(table.id, { rows });
  };

  const addRow = async () => {
    let table = active;
    if (builtin) {
      table = await duplicateTable(projectId, active);
      setActiveId(table.id);
    }
    await updateTable(table.id, { rows: [...table.rows, { text: '', weight: 1 }] });
  };

  const removeRow = async (index: number) => {
    if (builtin) return;
    await updateTable(active.id, { rows: active.rows.filter((_, i) => i !== index) });
  };

  return (
    <div className="lw-page lw-page--wide" data-testid="surface-random-tables">
      <div>
        <h1 className="lw-page__title">Random Tables</h1>
        <p className="lw-page__subtitle">
          Weighted idea generators. Roll, then send the result into the manuscript or the
          codex.
        </p>
      </div>

      <div className="lw-toolsplit">
        <aside className="lw-toolsplit__side">
          <label className="lw-field__label" htmlFor="rt-table">
            Table
          </label>
          <select
            id="rt-table"
            className="lw-input"
            value={active.id}
            onChange={(e) => {
              setActiveId(e.target.value);
              setResults([]);
            }}
          >
            <optgroup label="Starters">
              {BUILTIN_TABLES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
            {userTables.length > 0 && (
              <optgroup label="Your tables">
                {userTables.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>

          <div className="lw-chips__add" style={{ marginTop: 'var(--sp-4)' }}>
            <input
              className="lw-input"
              aria-label="New table name"
              placeholder="New table name…"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="button"
              className="lw-btn"
              onClick={async () => {
                if (!newName.trim()) return;
                const t = await createTable(projectId, { name: newName });
                setNewName('');
                setActiveId(t.id);
              }}
            >
              + New table
            </button>
          </div>

          {!builtin && (
            <>
              <label className="lw-field__label" htmlFor="rt-category" style={{ marginTop: 'var(--sp-4)' }}>
                Create-entity type
              </label>
              <select
                id="rt-category"
                className="lw-input"
                value={active.category}
                onChange={(e) => void updateTable(active.id, { category: e.target.value as RandomTable['category'] })}
              >
                <option value="none">None (lore note)</option>
                {ALL_ENTITY_TYPES.filter((t) => configuredEntityTypes().includes(t)).map((t) => (
                  <option key={t} value={t}>
                    {ENTITY_TYPE_META[t].plural}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="lw-btn lw-btn--danger"
                style={{ marginTop: 'var(--sp-4)' }}
                onClick={async () => {
                  await deleteTable(active.id);
                  setActiveId(BUILTIN_TABLES[0].id);
                  toast('Table deleted.');
                }}
              >
                Delete table
              </button>
            </>
          )}
        </aside>

        <div className="lw-toolsplit__main">
          <section className="lw-card">
            <h2 className="lw-card__title">Roll</h2>
            <div className="lw-rollbar">
              {[1, 3, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={count === n ? 'lw-btn lw-btn--primary' : 'lw-btn'}
                  aria-pressed={count === n}
                  onClick={() => setCount(n)}
                >
                  ×{n}
                </button>
              ))}
              <label className="lw-toggle">
                <input type="checkbox" checked={unique} onChange={(e) => setUnique(e.target.checked)} />
                <span>No repeats</span>
              </label>
              <button type="button" className="lw-btn lw-btn--primary" onClick={roll}>
                Roll {active.name}
              </button>
            </div>

            {results.length > 0 && (
              <div className="lw-rollresults" data-testid="roll-results">
                {results.map((text, i) => (
                  <div key={`${i}-${text}`} className="lw-rollresult">
                    <span className="lw-rollresult__text">{text}</span>
                    <span className="lw-rollresult__actions">
                      <button type="button" className="lw-btn lw-btn--sm" onClick={() => void sendToWriter(text)}>
                        → Writer&apos;s Room
                      </button>
                      <button type="button" className="lw-btn lw-btn--sm" onClick={() => createEntityFrom(text)}>
                        Create entity
                      </button>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="lw-card">
            <h2 className="lw-card__title">Rows &amp; weights</h2>
            <p className="lw-fieldnote">
              Higher weight = more likely.
              {builtin ? ' Editing a starter copies it into your tables first.' : ''}
            </p>
            <div className="lw-tablerows">
              {active.rows.map((row, i) => (
                <div key={i} className="lw-tablerow">
                  <input
                    className="lw-input lw-tablerow__text"
                    aria-label={`Row ${i + 1} text`}
                    value={row.text}
                    onChange={(e) => void editRow(i, { text: e.target.value })}
                  />
                  <input
                    className="lw-input lw-tablerow__weight"
                    type="number"
                    min={0}
                    aria-label={`Row ${i + 1} weight`}
                    value={row.weight}
                    onChange={(e) => void editRow(i, { weight: Math.max(0, Number(e.target.value)) })}
                  />
                  {!builtin && (
                    <button
                      type="button"
                      className="lw-iconbtn"
                      aria-label={`Remove row ${i + 1}`}
                      onClick={() => void removeRow(i)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" className="lw-btn" style={{ marginTop: 'var(--sp-4)' }} onClick={() => void addRow()}>
              + Add row
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

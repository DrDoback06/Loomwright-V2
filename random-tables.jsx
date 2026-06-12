// =====================================================================
// random-tables.jsx — Random Tables panel (generators).
//
// Rollable tables for brainstorming: pick a table (built-in starters or
// your own), roll 1–5 weighted results, send a result to the Writer's
// Room or spin it into a real entity. User tables are fully editable
// (rows + weights); built-ins duplicate into editable copies. Backed by
// RandomTableService (user tables + roll history persist; built-ins are
// code, never exported).
// =====================================================================

const { useState: _rt_us, useMemo: _rt_um, useEffect: _rt_ue } = React;

const RT_CATEGORY_META = {
  names:  { label: "Names",  color: "#7a6aa3", entityType: "cast" },
  scene:  { label: "Scene",  color: "#3e6db5", entityType: "lore" },
  story:  { label: "Story",  color: "#a8553f", entityType: "events" },
  items:  { label: "Items",  color: "#b08a3e", entityType: "items" },
  places: { label: "Places", color: "#6b8a4a", entityType: "locations" },
  custom: { label: "Custom", color: "#76684c", entityType: "lore" },
};
const _rtMeta = (cat) => RT_CATEGORY_META[cat] || RT_CATEGORY_META.custom;
const _rtDispatch = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const _rtNotice = (message) => _rtDispatch("lw:backend-notice", { message });

const RandomTablesPanelBody = ({ panel }) => {
  const B = () => window.LoomwrightBackend;
  const [tick, setTick] = _rt_us(0);
  _rt_ue(() => {
    const bump = () => setTick((t) => t + 1);
    const evs = ["lw:random-tables-updated", "lw:backend-ready", "lw:project-imported"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  const tables = _rt_um(() => B()?.RandomTableService?.listSync?.() || [], [tick]);
  const history = _rt_um(() => B()?.RandomTableService?.historySync?.() || [], [tick]);

  const [selectedId, setSelectedId] = _rt_us(null);
  const [count, setCount] = _rt_us(1);
  const [unique, setUnique] = _rt_us(true);
  const [results, setResults] = _rt_us([]);
  const [editing, setEditing] = _rt_us(false);

  const table = tables.find((t) => t.id === selectedId) || tables[0] || null;
  const builtin = table ? B()?.RandomTableService?.isBuiltin?.(table.id) : false;

  const onRoll = async () => {
    if (!table) return;
    const { results: out } = await B().RandomTableService.rollAndLog(table.id, { count, unique });
    setResults(out);
  };
  const sendToWriter = (text) => {
    _rtDispatch("lw:composition-insert-draft", { text, source: "random-table" });
    _rtNotice("Sent to the Writer's Room.");
  };
  const createEntity = (text) => {
    const type = _rtMeta(table?.category).entityType;
    _rtDispatch("lw:open-entity-editor", { type, initial: { name: text }, mode: "full" });
  };
  const duplicate = async () => {
    if (!table) return;
    const copy = await B().RandomTableService.saveTable({ ...table, id: table.id, name: table.name + " (copy)" });
    setSelectedId(copy.id);
    setEditing(true);
    _rtNotice("Editable copy created.");
  };
  const newTable = async () => {
    const row = await B().RandomTableService.saveTable({
      name: "New table", category: "custom",
      rows: [{ text: "First result" }, { text: "Second result" }],
    });
    setSelectedId(row.id);
    setEditing(true);
  };
  const patchTable = async (patch) => {
    if (!table || builtin) return;
    await B().RandomTableService.saveTable({ ...table, ...patch });
  };

  return (
    <div className="rt" data-ui="RandomTablesPanelBody">
      {/* Table roster */}
      <div className="rt__roster">
        <div className="rt__sech">Tables</div>
        {tables.map((t) => {
          const m = _rtMeta(t.category);
          const isBuiltin = B()?.RandomTableService?.isBuiltin?.(t.id);
          return (
            <button key={t.id}
              className={"rt__row" + (table && t.id === table.id ? " is-on" : "")}
              onClick={() => { setSelectedId(t.id); setResults([]); setEditing(false); }}
              style={{ "--c": m.color }}>
              <span className="rt__row-dot"/>
              <span className="rt__row-main">
                <span className="rt__row-name">{t.name}</span>
                <span className="rt__row-sub">{t.dice || "d" + t.rows.length} · {t.rows.length} entries{isBuiltin ? " · starter" : ""}</span>
              </span>
            </button>
          );
        })}
        <button className="rt__add" data-callback="onCreateRandomTable" data-testid="rt-new-table" onClick={newTable}>
          <Icon name="plus" size={11}/><span>New table</span>
        </button>
      </div>

      {table ? (
        <div className="rt__main">
          <div className="rt__head">
            {editing && !builtin ? (
              <input className="rt__title-edit" defaultValue={table.name} key={table.id}
                     onBlur={(e) => patchTable({ name: e.target.value.trim() || table.name })}
                     onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}/>
            ) : (
              <div className="rt__title">{table.name}</div>
            )}
            <span className="rt__cat" style={{ "--c": _rtMeta(table.category).color }}>{_rtMeta(table.category).label}</span>
            <span style={{ flex: 1 }}/>
            {builtin
              ? <button className="rpg-btn rpg-btn--small" data-testid="rt-duplicate" onClick={duplicate}>Duplicate to edit</button>
              : <button className={"rpg-btn rpg-btn--small" + (editing ? " rpg-btn--primary" : "")} data-testid="rt-edit-toggle"
                        onClick={() => setEditing((v) => !v)}>{editing ? "Done" : "Edit rows"}</button>}
            {!builtin && (
              <button className="rpg-btn rpg-btn--small rpg-btn--ghost"
                      onClick={async () => {
                        if (window.confirm && !window.confirm(`Delete "${table.name}"?`)) return;
                        await B().RandomTableService.removeTable(table.id);
                        setSelectedId(null);
                      }}>Delete</button>
            )}
          </div>

          {/* Roll controls */}
          <div className="rt__rollbar">
            <button className="rt__roll" data-callback="onRollRandomTable" data-testid="rt-roll" onClick={onRoll}>
              <Icon name="sparkle" size={13}/><span>Roll {table.dice || ""}</span>
            </button>
            <label className="rt__opt">
              <span>Results</span>
              <select className="loc-body__filter" value={count} onChange={(e) => setCount(Number(e.target.value))}>
                {[1, 3, 5].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="rt__opt rt__opt--check">
              <input type="checkbox" checked={unique} onChange={() => setUnique((v) => !v)}/>
              <span>No repeats</span>
            </label>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="rt__results" data-ui="RtResults">
              {results.map((r, i) => (
                <div key={i} className="rt__result">
                  <span className="rt__result-glyph">✶</span>
                  <span className="rt__result-text">{r.text}</span>
                  <button className="rpg-btn rpg-btn--small" data-callback="onSendSuggestionToWriter"
                          onClick={() => sendToWriter(r.text)}>→ Writer</button>
                  <button className="rpg-btn rpg-btn--small" data-testid={"rt-create-entity-" + i}
                          onClick={() => createEntity(r.text)}>Create entity</button>
                </div>
              ))}
            </div>
          )}

          {/* Rows (read or edit) */}
          <div className="rt__sech" style={{ marginTop: 12 }}>Entries</div>
          {editing && !builtin ? (
            <div className="rt__rows" data-ui="RtRowEditor">
              {table.rows.map((row, i) => (
                <div key={row.id} className="rt__rowedit">
                  <input className="rt__rowedit-text" defaultValue={row.text} placeholder="Result text…"
                         onBlur={(e) => {
                           const rows = table.rows.map((x, ix) => ix === i ? { ...x, text: e.target.value } : x);
                           patchTable({ rows });
                         }}/>
                  <input className="rt__rowedit-weight" type="number" min="1" max="20" defaultValue={row.weight || 1}
                         title="Weight (likelihood)"
                         onBlur={(e) => {
                           const rows = table.rows.map((x, ix) => ix === i ? { ...x, weight: Number(e.target.value) || 1 } : x);
                           patchTable({ rows });
                         }}/>
                  <button className="stat-rule-row__icon"
                          onClick={() => patchTable({ rows: table.rows.filter((_, ix) => ix !== i) })}>✕</button>
                </div>
              ))}
              <button className="rt__add" data-testid="rt-add-row"
                      onClick={() => patchTable({ rows: [...table.rows, { text: "" }] })}>
                <Icon name="plus" size={11}/><span>Add entry</span>
              </button>
            </div>
          ) : (
            <div className="rt__rows rt__rows--read">
              {table.rows.map((row, i) => (
                <div key={row.id} className="rt__rowread">
                  <span className="rt__rowread-n">{i + 1}</span>
                  <span className="rt__rowread-text">{row.text}</span>
                  {Number(row.weight) > 1 && <span className="rt__rowread-w">×{row.weight}</span>}
                </div>
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <>
              <div className="rt__sech" style={{ marginTop: 12 }}>Recent rolls</div>
              <div className="rt__history">
                {history.slice(0, 6).map((h) => (
                  <div key={h.id} className="rt__hist">
                    <span className="rt__hist-table">{h.tableName}</span>
                    <span className="rt__hist-text">{h.results.join(" · ")}</span>
                    <span className="rt__hist-acts">
                      <button className="rt__hist-btn" data-callback="onRerollHistoryEntry" title="Roll this table again"
                        onClick={async () => {
                          const { results: out } = await B().RandomTableService.rollAndLog(h.tableId, { count: h.results.length || 1, unique });
                          if (out.length) { setSelectedId(h.tableId); setResults(out); }
                          else _rtNotice("That table is gone — its rolls stay in the log.");
                        }}>↻</button>
                      <button className="rt__hist-btn" data-callback="onSendSuggestionToWriter" title="Send to the Writer's Room"
                        onClick={() => sendToWriter(h.results.join(", "))}>✎</button>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="rt__main">
          <div className="rt__empty" data-ui="RtEmpty">Pick a table — or chart a new one.</div>
        </div>
      )}
    </div>
  );
};

Object.assign(window, { RandomTablesPanelBody, RT_CATEGORY_META });

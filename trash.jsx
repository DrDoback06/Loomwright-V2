// =====================================================================
// trash.jsx — Trash panel
//
// Lists deleted items across the project — chapters, entities, notes,
// references, canvas items, relationships, map objects, skill nodes,
// tangle nodes, settings snapshots.
//
// Double-confirm for permanent delete; everything else is restore-able.
// =====================================================================

const { useState: _tr_us } = React;

const TRASH_TYPES = {
  chapter:       { label: "Chapter",        icon: "feather",  color: "#7a5a3a" },
  entity:        { label: "Entity",         icon: "user",     color: "#7a6aa3" },
  note:          { label: "Note",           icon: "paper",    color: "#76684c" },
  reference:     { label: "Reference",      icon: "book",     color: "#76684c" },
  canvas:        { label: "Canvas item",    icon: "stack",    color: "#3e6db5" },
  relationship:  { label: "Relationship",   icon: "link",     color: "#b86a82" },
  map:           { label: "Map object",     icon: "compass",  color: "#6b8a4a" },
  skill:         { label: "Skill node",     icon: "tree",     color: "#3e6db5" },
  tangle:        { label: "Tangle node",    icon: "knot",     color: "#9a7b3a" },
  settings:      { label: "Settings snapshot", icon: "gear",  color: "#76684c" },
};

const INITIAL_TRASH = [
  { id: "tr1",  type: "chapter",      name: "Ch. 4 — old draft",                from: "Manuscript",            deletedAt: "2 days ago",  by: "E. Marlowe" },
  { id: "tr2",  type: "entity",       name: "The Auger (old entity)",          from: "Cast",                  deletedAt: "Today, 09:12",by: "E. Marlowe", note: "Merged into Bone Auger." },
  { id: "tr3",  type: "note",         name: "Inline note: 'Brec's voice'",     from: "Writer's Room · Ch. 3", deletedAt: "Yesterday",   by: "Ann (co-writer)" },
  { id: "tr4",  type: "reference",    name: "Mapsheet draft — Reach v1",       from: "References",            deletedAt: "5 days ago",  by: "E. Marlowe" },
  { id: "tr5",  type: "canvas",       name: "Acts II planning board (sketch)", from: "Tangle",                deletedAt: "1 week ago",  by: "E. Marlowe" },
  { id: "tr6",  type: "relationship", name: "Aelinor ↔ Mara (old)",            from: "Relationships",         deletedAt: "Today, 14:02",by: "E. Marlowe", note: "Replaced by Aelinor ↔ Saren." },
  { id: "tr7",  type: "map",          name: "Pin: 'Old Auger Cliffs'",         from: "Atlas",                 deletedAt: "3 days ago",  by: "E. Marlowe" },
  { id: "tr8",  type: "skill",        name: "Tier IV 'Bind a Treaty'",          from: "Skill Trees · Diplomacy",deletedAt: "Today, 10:31", by: "E. Marlowe" },
  { id: "tr9",  type: "tangle",       name: "Note: 'Vraska boar motif'",       from: "Tangle · Acts II–III",  deletedAt: "4 days ago",  by: "E. Marlowe" },
  { id: "tr10", type: "settings",     name: "Type set: workhorse",             from: "Settings",              deletedAt: "Yesterday",   by: "E. Marlowe" },
  { id: "tr11", type: "entity",       name: "Hess wolfhound (duplicate)",      from: "Bestiary",              deletedAt: "2 days ago",  by: "E. Marlowe", note: "Merged into canon entry." },
  { id: "tr12", type: "note",         name: "Comment thread: 'Tone of arrival'",from: "Writer's Room · Ch. 7",deletedAt: "5 hours ago", by: "Ann (co-writer)", resolved: true },
];

const mapTrashItem = (it) => ({
  id: it.id,
  type: it.type || "entity",
  name: it.name || it.title || "Untitled",
  from: it.type ? (it.type.charAt(0).toUpperCase() + it.type.slice(1)) : "Entity",
  deletedAt: it.deletedAt || "Recently",
  by: it.by || "",
  note: it.summary || it.note || "",
});

const TrashPanelBody = ({ panel }) => {
  const loadTrash = () => {
    const rows = window.LoomwrightBackend?.TrashService?.listSync() || [];
    return rows.length ? rows.map(mapTrashItem) : [];
  };
  const [items, setItems] = _tr_us(loadTrash);
  const [typeFilter, setTypeFilter] = _tr_us("all");
  const [search, setSearch] = _tr_us("");
  const [sortBy, setSortBy] = _tr_us("recent");
  const [confirming, setConfirming] = _tr_us(null); // item id pending double-confirm

  let visible = items;
  if (typeFilter !== "all") visible = visible.filter((it) => it.type === typeFilter);
  if (search) visible = visible.filter((it) => it.name.toLowerCase().includes(search.toLowerCase()) || (it.from || "").toLowerCase().includes(search.toLowerCase()));

  if (sortBy === "name")  visible = [...visible].sort((a, b) => a.name.localeCompare(b.name));
  if (sortBy === "type")  visible = [...visible].sort((a, b) => a.type.localeCompare(b.type));
  if (sortBy === "from")  visible = [...visible].sort((a, b) => (a.from || "").localeCompare(b.from || ""));
  // recent = preserve initial order (newest at top by construction)

  React.useEffect(() => {
    const refresh = () => setItems(loadTrash());
    window.addEventListener("lw:entity-store-updated", refresh);
    window.addEventListener("lw:project-imported", refresh);
    return () => {
      window.removeEventListener("lw:entity-store-updated", refresh);
      window.removeEventListener("lw:project-imported", refresh);
    };
  }, []);

  const onRestore = async (item) => {
    await window.LoomwrightBackend?.TrashService?.restore(item.id);
    setItems(loadTrash());
  };
  const onDeleteForever = async (item) => {
    if (confirming !== item.id) { setConfirming(item.id); return; }
    await window.LoomwrightBackend?.TrashService?.purge(item.id);
    setItems(loadTrash());
    setConfirming(null);
  };

  return (
    <div className="trash" data-ui="TrashPanelBody">
      <div className="trash__top">
        <div className="trash__top-row">
          <input
            value={search}
            placeholder="Search trash…"
            onChange={(e) => setSearch(e.target.value)}
            data-callback="onSearchTrash"
          />
        </div>
        <div className="trash__top-row">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} data-callback="onFilterTrashByType">
            <option value="all">All types</option>
            {Object.entries(TRASH_TYPES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} data-callback="onSortTrash">
            <option value="recent">Newest first</option>
            <option value="name">Name</option>
            <option value="type">Type</option>
            <option value="from">Origin</option>
          </select>
        </div>
      </div>
      <div className="trash__warn">
        Items in Trash are kept for 30 days. Permanent delete requires double-confirm.
      </div>

      <div className="trash__list">
        {visible.length === 0 && (
          <EmptyState icon="trash" title="Trash is empty" body="Deleted chapters, entities, notes, and other items appear here for 30 days."/>
        )}
        {visible.map((it) => {
          const t = TRASH_TYPES[it.type];
          return (
            <React.Fragment key={it.id}>
              <div className="trash__row" data-ui="TrashItemCard">
                <div className="trash__row-icon" style={{ background: t.color + "22", color: t.color }}>
                  <Icon name={t.icon} size={12}/>
                </div>
                <div className="trash__row-body">
                  <div className="trash__row-name">{it.name}</div>
                  <div className="trash__row-meta">
                    <span>{t.label}</span>
                    {it.from && <span>· {it.from}</span>}
                    <span>· {it.deletedAt}</span>
                    {it.by && <span>· by {it.by}</span>}
                    {it.note && <span>· <em>{it.note}</em></span>}
                  </div>
                </div>
                <div className="trash__row-actions">
                  <button className="rpg-btn rpg-btn--small" data-callback="onPreviewTrashItem" title="Preview">Preview</button>
                  <button className="rpg-btn rpg-btn--small rpg-btn--primary" data-callback="onRestoreTrashItem" onClick={() => onRestore(it)}>Restore</button>
                  <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onDeleteTrashItemForever" onClick={() => onDeleteForever(it)}>Delete forever</button>
                </div>
              </div>
              {confirming === it.id && (
                <div className="trash__confirm">
                  <div className="trash__confirm-title">Permanently delete "{it.name}"?</div>
                  <div className="trash__confirm-body">
                    This cannot be undone. Linked references to this item across the manuscript will show as broken.
                  </div>
                  <div className="trash__confirm-actions">
                    <button className="rpg-btn rpg-btn--small rpg-btn--ghost" onClick={() => setConfirming(null)}>Cancel</button>
                    <button className="rpg-btn rpg-btn--small" style={{ background: "#a8553f", color: "white" }} onClick={() => onDeleteForever(it)}>Yes, delete forever</button>
                  </div>
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

window.TRASH_ITEMS = INITIAL_TRASH;
window.TRASH_TYPES = TRASH_TYPES;
Object.assign(window, { TrashPanelBody });

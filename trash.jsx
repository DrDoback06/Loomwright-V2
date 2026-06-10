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

const _trAgo = (iso) => {
  if (!iso) return "recently";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "recently";
  const mins = Math.round(ms / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return mins + " min ago";
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
  const days = Math.round(hours / 24);
  if (days < 31) return days + (days === 1 ? " day ago" : " days ago");
  return Math.round(days / 30) + " months ago";
};

// Trash holds full entity records whose `type` is the ENTITY type
// ("cast", "locations", …) — normalise anything outside TRASH_TYPES to
// the generic "entity" bucket and keep the real type as the origin label.
const mapTrashItem = (it) => ({
  id: it.id,
  type: TRASH_TYPES[it.type] ? it.type : "entity",
  name: it.name || it.title || "Untitled",
  from: it.type ? (it.type.charAt(0).toUpperCase() + it.type.slice(1)) : "Entity",
  deletedAt: _trAgo(it.deletedAt),
  by: it.by || "",
  note: it.summary || it.note || "",
  raw: it,
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
  const [previewing, setPreviewing] = _tr_us(null); // item id with open preview

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
                  <button className="rpg-btn rpg-btn--small" data-callback="onPreviewTrashItem" title="Preview"
                    onClick={() => setPreviewing(previewing === it.id ? null : it.id)}>
                    {previewing === it.id ? "Hide" : "Preview"}
                  </button>
                  <button className="rpg-btn rpg-btn--small rpg-btn--primary" data-callback="onRestoreTrashItem" onClick={() => onRestore(it)}>Restore</button>
                  <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onDeleteTrashItemForever" onClick={() => onDeleteForever(it)}>Delete forever</button>
                </div>
              </div>
              {previewing === it.id && (
                <pre style={{ margin: "0 0 8px", padding: 10, maxHeight: 200, overflow: "auto", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", fontSize: 10.5, lineHeight: 1.5, color: "var(--ink-2)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                  {JSON.stringify(it.raw, null, 2)}
                </pre>
              )}
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

window.TRASH_TYPES = TRASH_TYPES;
Object.assign(window, { TrashPanelBody });

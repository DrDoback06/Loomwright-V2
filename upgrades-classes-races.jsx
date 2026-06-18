// =====================================================================
// upgrades-classes-races.jsx — Bespoke panel bodies for Classes, Races,
// and the Abilities deprecation panel.
//
// Classes/Races already have `ClassDetail`/`RaceDetail` renderers via
// RPG_DETAIL_RENDERERS; here we add the panel-body wrappers that wire
// the create button + drag handles + status pills + cross-panel links.
// Most of the heavy lifting is done by EntityTabShell.
//
// Abilities is the live catalogue of individual powers (skills + legacy
// ability records) — Skill Trees arrange them into progressions.
// =====================================================================

const { useState: _crab_us } = React;

// ---------------------------------------------------------------------
// Live-data adapters
//
// Live class/race entities keep identity fields top-level (name, summary,
// status…) and ALL custom fields under entity.data.* using the editor's
// field ids. ClassDetail / RaceDetail (rpg-entities.jsx) were written
// against flat demo objects, so a real class/race rendered with default
// facets and every section empty. Mirrors liveBestiaryToDetail etc.
// ---------------------------------------------------------------------
const _crB = () => (typeof window !== "undefined") && window.LoomwrightBackend;
function _crResolveRef(r) {
  if (!r) return null;
  if (typeof r === "object") return { id: r.id, name: r.name || r.label || r.id, label: r.name || r.label || r.id, type: r.type || "" };
  let nm = r, ty = "";
  try { const B = _crB(); const ent = B && B.EntityService && B.EntityService.getSync(r); if (ent) { nm = ent.name || r; ty = ent.type || ""; } } catch (_e) {}
  return { id: r, name: nm, label: nm, type: ty };
}
function _crRefList(arr, ty) {
  return (Array.isArray(arr) ? arr : []).map((r) => { const x = _crResolveRef(r); if (x && ty && !x.type) x.type = ty; return x; }).filter(Boolean);
}
// rule-list rows / chips -> readable strings for bullet lists
function _crRuleStrings(arr) {
  return (Array.isArray(arr) ? arr : []).map((r) => {
    if (r == null) return "";
    if (typeof r === "string") return r;
    if (typeof r === "object") {
      const target = r.target || r.stat || r.name || r.label || "";
      const delta = (r.delta != null ? r.delta : (r.value != null ? r.value : r.amount));
      const note = r.note || r.detail || r.text || "";
      const deltaStr = (delta != null && delta !== "") ? (typeof delta === "number" ? (delta > 0 ? "+" + delta : String(delta)) : String(delta)) : "";
      return [target, deltaStr, note].filter(Boolean).join(" ").trim() || "";
    }
    return String(r);
  }).filter(Boolean);
}
function _crStrList(arr) {
  return (Array.isArray(arr) ? arr : []).map((x) => (x && typeof x === "object" ? (x.name || x.label || "") : x)).filter(Boolean);
}
function _crUniqById(arr) {
  const seen = new Set(); const out = [];
  for (const x of arr) { if (!x || seen.has(x.id)) continue; seen.add(x.id); out.push(x); }
  return out;
}
// Reverse-lookup: cast members that reference this class/race id (or name)
// on any of the given data.* field ids.
function _crCastMembers(entityId, entityName, fieldIds) {
  const out = [];
  try {
    const B = _crB();
    const cast = (B && B.EntityService && B.EntityService.listSync("cast")) || [];
    for (const c of cast) {
      const cd = c.data || {};
      let hit = false;
      for (const f of fieldIds) {
        const v = cd[f];
        if (!v) continue;
        const match = (x) => { const id = (x && x.id) ? x.id : x; return id === entityId || id === entityName || (x && x.name) === entityName; };
        if (Array.isArray(v) ? v.some(match) : match(v)) { hit = true; break; }
      }
      if (hit) out.push({ id: c.id, name: c.name, label: c.name, type: "cast" });
    }
  } catch (_e) {}
  return out;
}

function liveClassToDetail(entity) {
  if (!entity) return entity;
  const top = entity, d = entity.data || {};
  const members = _crUniqById([
    ..._crRefList(d.assignedCharacters, "cast"),
    ..._crCastMembers(entity.id, entity.name, ["class", "classId", "className", "classes"]),
  ]);
  return {
    ...entity,
    category: d.category || "",
    role: d.role || "",
    first: d.firstChapter || "",
    summary: top.summary || d.summary || "",
    defaultStats: (Array.isArray(d.defaultStats) && d.defaultStats.length) ? d.defaultStats : null,
    allowedAbilities: _crRefList(d.allowedSkills, "skills"),
    skillTrees: _crRefList(d.linkedSkillTrees, "skills"),
    restrictions: _crRuleStrings(d.restrictions),
    typicalRoles: [],
    examples: members,
  };
}

function liveRaceToDetail(entity) {
  if (!entity) return entity;
  const top = entity, d = entity.data || {};
  const members = _crUniqById([
    ..._crRefList(d.linkedCast, "cast"),
    ..._crCastMembers(entity.id, entity.name, ["species", "race", "raceId", "raceName"]),
  ]);
  const originLocs = _crRefList(d.originLocations, "locations");
  return {
    ...entity,
    category: d.category || "",
    first: d.firstChapter || "",
    summary: top.summary || d.summary || "",
    origin: originLocs[0] || (d.habitat ? { name: d.habitat } : null),
    traits: _crStrList(d.traits),
    defaultStats: (Array.isArray(d.defaultStats) && d.defaultStats.length) ? d.defaultStats : null,
    abilities: _crRefList(d.innateSkills, "skills"),
    cultureNotes: d.culture || "",
    originLocations: originLocs,
    factions: _crRefList(d.factions, "factions"),
    bestiaryLinks: _crRefList(d.bestiary, "bestiary"),
    examples: members,
  };
}

// ---------------------------------------------------------------------
// ClassesPanelBody
// ---------------------------------------------------------------------
const ClassesPanelBody = ({ panel, panelContext, onSelectEntity }) => {
  const entities = window.LoomwrightBackend?.EntityService?.listSync?.("classes") || [];
  const [search, setSearch] = _crab_us("");
  const [selectedId, setSelectedId] = _crab_us(panel?.selected?.id || entities[0]?.id || null);
  // Follow host-driven selection (locked entities, lw:focus-entity).
  React.useEffect(() => { if (panel?.selected?.id) setSelectedId(panel.selected.id); }, [panel?.selected?.id]);
  const selected = entities.find((e) => e.id === selectedId);
  const filtered = search ? entities.filter((e) => (e.name || "").toLowerCase().includes(search.toLowerCase())) : entities;
  return (
    <div className="upg" data-ui="ClassesPanelBody">
      <div className="upg__toolbar">
        <div className="upg__search">
          <Icon name="search" size={11}/>
          <input placeholder="Search classes…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <button className="upg__btn upg__btn--primary"
          onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "classes" } }))}
          data-callback="onCreateClass">
          <Icon name="plus" size={11}/> Create
        </button>
      </div>

      <div className="upg__list">
        {filtered.map((e) => (
          <div key={e.id}
            className={"upg__item " + (selectedId === e.id ? "is-selected" : "")}
            onClick={() => { setSelectedId(e.id); onSelectEntity && onSelectEntity(e); }}
            draggable
            onDragStart={(ev) => {
              const payload = { entityType: "classes", id: e.id, name: e.name, summary: e.summary };
              try {
                ev.dataTransfer.setData("application/x-loom-entity", JSON.stringify(payload));
                ev.dataTransfer.setData("text/loomwright-entity", JSON.stringify({ id: e.id, name: e.name, type: "classes" }));
                ev.dataTransfer.setData("text/plain", e.name);
              } catch (_err) {}
              ev.currentTarget.classList.add("is-dragging");
              if (window.ENTITY_DRAG) window.ENTITY_DRAG.set({ active: true, payload });
            }}
            onDragEnd={(ev) => {
              ev.currentTarget.classList.remove("is-dragging");
              if (window.ENTITY_DRAG) window.ENTITY_DRAG.set({ active: false, payload: null });
            }}
          >
            <span className="ent-grip"><Icon name="grip" size={10}/></span>
            <div className="upg__item__monogram">{e.glyphChar || e.name?.slice(0, 2)}</div>
            <div className="upg__item__body">
              <div className="upg__item__name">{e.name}</div>
              <div className="upg__item__sub">{e.subtitle || e.summary}</div>
            </div>
            <div className="upg__item__meta">
              <span>{e.data?.role || "—"}</span>
              {(e.reviewQueueCount || e.queue) ? <ReviewCountBadge count={e.reviewQueueCount || e.queue}/> : null}
              {e.status && e.status !== "active" && <EntityStatusPill status={e.status}/>}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="upg__detail">
          <div className="upg__detail__head">
            <div>
              <div className="upg__detail__eyebrow">Class · {selected.data?.category || "Archetype"}</div>
              <div className="upg__detail__title">{selected.name}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <EntityCardChrome entity={selected} callbacks={{}}/>
            </div>
          </div>
          {selected.summary && <p className="upg__detail__lede">{selected.summary}</p>}
          <ClassDetail entity={liveClassToDetail(selected)} onSelectEntity={onSelectEntity}/>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// RacesPanelBody
// ---------------------------------------------------------------------
const RacesPanelBody = ({ panel, panelContext, onSelectEntity }) => {
  const entities = window.LoomwrightBackend?.EntityService?.listSync?.("races") || [];
  const [search, setSearch] = _crab_us("");
  const [selectedId, setSelectedId] = _crab_us(panel?.selected?.id || entities[0]?.id || null);
  // Follow host-driven selection (locked entities, lw:focus-entity).
  React.useEffect(() => { if (panel?.selected?.id) setSelectedId(panel.selected.id); }, [panel?.selected?.id]);
  const selected = entities.find((e) => e.id === selectedId);
  const filtered = search ? entities.filter((e) => (e.name || "").toLowerCase().includes(search.toLowerCase())) : entities;
  return (
    <div className="upg" data-ui="RacesPanelBody">
      <div className="upg__toolbar">
        <div className="upg__search">
          <Icon name="search" size={11}/>
          <input placeholder="Search races / species…" value={search} onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <button className="upg__btn upg__btn--primary"
          onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "races" } }))}
          data-callback="onCreateRace">
          <Icon name="plus" size={11}/> Create
        </button>
      </div>

      <div className="upg__list">
        {filtered.map((e) => (
          <div key={e.id}
            className={"upg__item " + (selectedId === e.id ? "is-selected" : "")}
            onClick={() => { setSelectedId(e.id); onSelectEntity && onSelectEntity(e); }}
            draggable
            onDragStart={(ev) => {
              const payload = { entityType: "races", id: e.id, name: e.name, summary: e.summary };
              try {
                ev.dataTransfer.setData("application/x-loom-entity", JSON.stringify(payload));
                ev.dataTransfer.setData("text/loomwright-entity", JSON.stringify({ id: e.id, name: e.name, type: "races" }));
                ev.dataTransfer.setData("text/plain", e.name);
              } catch (_err) {}
              ev.currentTarget.classList.add("is-dragging");
              if (window.ENTITY_DRAG) window.ENTITY_DRAG.set({ active: true, payload });
            }}
            onDragEnd={(ev) => {
              ev.currentTarget.classList.remove("is-dragging");
              if (window.ENTITY_DRAG) window.ENTITY_DRAG.set({ active: false, payload: null });
            }}
          >
            <span className="ent-grip"><Icon name="grip" size={10}/></span>
            <div className="upg__item__monogram">{e.glyphChar || e.name?.slice(0, 2)}</div>
            <div className="upg__item__body">
              <div className="upg__item__name">{e.name}</div>
              <div className="upg__item__sub">{e.subtitle || e.summary}</div>
            </div>
            <div className="upg__item__meta">
              <span>{e.data?.category || "Folk"}</span>
              {(e.reviewQueueCount || e.queue) ? <ReviewCountBadge count={e.reviewQueueCount || e.queue}/> : null}
              {e.status && e.status !== "active" && <EntityStatusPill status={e.status}/>}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="upg__detail">
          <div className="upg__detail__head">
            <div>
              <div className="upg__detail__eyebrow">Race / Species · {selected.data?.category || "Folk"}</div>
              <div className="upg__detail__title">{selected.name}</div>
            </div>
            <EntityCardChrome entity={selected} callbacks={{}}/>
          </div>
          {selected.summary && <p className="upg__detail__lede">{selected.summary}</p>}
          <RaceDetail entity={liveRaceToDetail(selected)} onSelectEntity={onSelectEntity}/>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// AbilitiesPanelBody — the live catalogue of individual powers (skills +
// legacy abilities). Skill TREES arrange these records into progressions;
// this panel owns the records themselves: browse, filter by type, edit,
// drag into compositions, and jump into the tree editor.
// ---------------------------------------------------------------------
const ABILITY_TYPES = ["all", "active", "passive", "triggered", "one-time", "innate", "item-granted", "class-granted", "race-granted"];
const AbilitiesPanelBody = ({ panel, panelContext, onSelectEntity }) => {
  const [storeVersion, setStoreVersion] = _crab_us(0);
  React.useEffect(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:backend-ready", "lw:project-imported"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  const all = React.useMemo(() => {
    const ES = window.LoomwrightBackend?.EntityService;
    const skills = (ES?.listSync?.("skills") || []).map((e) => ({ ...e, _legacy: false }));
    const legacy = (ES?.listSync?.("abilities") || []).map((e) => ({ ...e, _legacy: true }));
    return [...skills, ...legacy].filter((e) => e && e.status !== "deleted");
  }, [storeVersion]);

  const [search, setSearch] = _crab_us("");
  const [typeFilter, setTypeFilter] = _crab_us("all");
  const [selectedId, setSelectedId] = _crab_us(panel?.selected?.id || null);
  const md = useMobileMasterDetail();
  // Follow host-driven selection (locked entities, lw:focus-entity).
  React.useEffect(() => { if (panel?.selected?.id) setSelectedId(panel.selected.id); }, [panel?.selected?.id]);

  const typeOf = (e) => String(e.data?.skillType || e.data?.abilityType || e.abilityType || "passive").toLowerCase();
  const filtered = all.filter((e) => {
    if (search && !(e.name || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (typeFilter !== "all" && typeOf(e) !== typeFilter) return false;
    return true;
  });
  const selected = all.find((e) => e.id === selectedId) || filtered[0] || null;
  const d = selected ? (selected.data || {}) : {};

  const openEditor = (id) => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
    detail: { type: "skills", initial: id ? { id } : undefined, mode: "full" },
  }));
  const effects = Array.isArray(d.effects) ? d.effects : [];
  const reqs = Array.isArray(d.requirements) ? d.requirements : (d.requirements ? [d.requirements] : []);
  // Surface editor fields the detail used to drop (cost/cooldown/limit +
  // linked entities), so authored data isn't invisible.
  const meta = [["Type", selected ? typeOf(selected) : ""], ["Cost", d.cost], ["Cooldown", d.cooldown], ["Limit", d.limit]].filter(([, v]) => v != null && v !== "");
  const upgradePath = _crRuleStrings(d.upgradePath);
  const linkGroups = [
    ["Linked stats",        _crRefList(d.linkedStats, "stats")],
    ["Linked classes",      _crRefList(d.linkedClasses, "classes")],
    ["Linked races",        _crRefList(d.linkedRaces, "races")],
    ["Linked items",        _crRefList(d.linkedItems, "items")],
    ["Assigned characters", _crRefList(d.assignedCast, "cast")],
  ].filter(([, arr]) => arr.length > 0);

  return (
    <div className="upg loc-body" data-ui="AbilitiesPanelBody">
      <div className="loc-body__top">
        <div className="loc-body__search">
          <Icon name="search" size={11}/>
          <input value={search} placeholder="Search abilities…" onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <div className="loc-body__filters">
          <select className="loc-body__filter" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} data-callback="onFilterStatus">
            {ABILITY_TYPES.map((t) => <option key={t} value={t}>{t === "all" ? "All types" : t}</option>)}
          </select>
          <Btn variant="ghost" size="sm" icon="plus" data-callback="onCreateAbility" title="Create ability" onClick={() => openEditor(null)}/>
          <Btn variant="ghost" size="sm" icon="branches" data-callback="onOpenSkillTreesFromAbilities" title="Arrange in Skill Trees"
            onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "skillTrees" } }))}/>
        </div>
      </div>

      <div className="loc-body__split" {...md.splitProps}>
        {md.backButton}
        <LocTreePane title="Abilities" count={filtered.length}>
          <div className="loc-tree">
            {filtered.map((e) => (
              <div key={e.id}
                className={"loc-tree__row" + (selected && selected.id === e.id ? " is-selected" : "")}
                data-entity-id={e.id}
                draggable
                onDragStart={(ev) => {
                  const payload = { entityType: "skills", id: e.id, name: e.name, summary: e.summary };
                  try {
                    ev.dataTransfer.setData("application/x-loom-entity", JSON.stringify(payload));
                    ev.dataTransfer.setData("text/loomwright-entity", JSON.stringify(payload));
                    ev.dataTransfer.setData("text/plain", e.name);
                  } catch (_err) {}
                }}
                onClick={() => {
                  setSelectedId(e.id);
                  onSelectEntity && onSelectEntity({ id: e.id, label: e.name, entityType: "abilities" });
                }}>
                <span className="loc-tree__glyph" style={{ color: "var(--ec, #6b5a8a)" }}>✦</span>
                <span className="loc-tree__name">{e.name}</span>
                <span className="ent-status">{typeOf(e)}{e._legacy ? " · legacy" : ""}</span>
              </div>
            ))}
            {filtered.length === 0 && (
              <EmptyState icon="spark" title="No abilities yet"
                body="Create one, or let extraction find powers in your manuscript. Skill Trees arrange these records into progressions."/>
            )}
          </div>
        </LocTreePane>

        <section className="loc-body__detail">
          {selected ? (
            <>
              <div className="loc-body__detail-head">
                <div>
                  <div className="loc-body__detail-eyebrow">Ability · {typeOf(selected)}</div>
                  <div className="loc-body__detail-title">{selected.name}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <Btn variant="outline" size="sm" icon="pen" data-callback="onEditEntity" onClick={() => openEditor(selected.id)}>Edit</Btn>
                  <Btn variant="ghost" size="sm" icon="branches" data-callback="onOpenSkillTreeEditor" title="Open in the tree editor"
                    onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel-workspace", {
                      detail: { workspaceId: "skill-tree-editor", panelKind: "skills", sourcePanel: panel?.id || "p-abilities", entityId: selected.id },
                    }))}>Tree</Btn>
                </div>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
                {meta.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                    {meta.map(([k, v]) => (
                      <span key={k} className="fws-chip" style={{ fontSize: 11 }}><b style={{ textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--ink-4)" }}>{k}</b> {v}</span>
                    ))}
                  </div>
                )}
                <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: 13.5, lineHeight: 1.6, color: d.description || selected.summary ? "var(--ink-1)" : "var(--ink-3)" }}>
                  {d.description || selected.summary || "No description yet — open the editor to add one."}
                </p>
                {effects.length > 0 && (
                  <>
                    <div className="loc-body__detail-eyebrow" style={{ marginBottom: 6 }}>Effects</div>
                    {effects.map((ef, i) => (
                      <div key={i} style={{ padding: "6px 8px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12 }}>
                        {(ef && typeof ef === "object") ? [ef.trigger, ef.effect].filter(Boolean).join(" → ") : String(ef)}
                      </div>
                    ))}
                  </>
                )}
                {reqs.length > 0 && (
                  <>
                    <div className="loc-body__detail-eyebrow" style={{ margin: "10px 0 6px" }}>Requirements</div>
                    {reqs.map((r, i) => <span key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{typeof r === "object" ? (r.label || r.name || JSON.stringify(r)) : String(r)}</span>)}
                  </>
                )}
                {upgradePath.length > 0 && (
                  <>
                    <div className="loc-body__detail-eyebrow" style={{ margin: "10px 0 6px" }}>Upgrade path</div>
                    <ul className="rpg-bullets">{upgradePath.map((u, i) => <li key={i}>{u}</li>)}</ul>
                  </>
                )}
                {linkGroups.map(([label, items]) => (
                  <React.Fragment key={label}>
                    <div className="loc-body__detail-eyebrow" style={{ margin: "10px 0 6px" }}>{label}</div>
                    {typeof RpgChipRow !== "undefined"
                      ? <RpgChipRow items={items} onSelect={onSelectEntity}/>
                      : items.map((it) => <span key={it.id} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => onSelectEntity && onSelectEntity(it)}>{it.name}</span>)}
                  </React.Fragment>
                ))}
              </div>
            </>
          ) : <EmptyState icon="spark" title="No ability selected" body="Pick an ability to inspect its effects and requirements."/>}
        </section>
      </div>
    </div>
  );
};

Object.assign(window, { ClassesPanelBody, RacesPanelBody, AbilitiesPanelBody });

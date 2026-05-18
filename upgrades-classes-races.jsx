// =====================================================================
// upgrades-classes-races.jsx — Bespoke panel bodies for Classes, Races,
// and the Abilities deprecation panel.
//
// Classes/Races already have `ClassDetail`/`RaceDetail` renderers via
// RPG_DETAIL_RENDERERS; here we add the panel-body wrappers that wire
// the create button + drag handles + status pills + cross-panel links.
// Most of the heavy lifting is done by EntityTabShell.
//
// Abilities panel is overridden ENTIRELY to show a deprecation card.
// =====================================================================

const { useState: _crab_us } = React;

// ---------------------------------------------------------------------
// ClassesPanelBody
// ---------------------------------------------------------------------
const ClassesPanelBody = ({ panel, onSelectEntity }) => {
  const entities = (window.ENTITY_SAMPLES && window.ENTITY_SAMPLES.classes) || [];
  const [search, setSearch] = _crab_us("");
  const [selectedId, setSelectedId] = _crab_us(entities[0]?.id || null);
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
              <span>{e.role || "—"}</span>
              {e.queue ? <ReviewCountBadge count={e.queue}/> : null}
              {e.status && e.status !== "active" && <EntityStatusPill status={e.status}/>}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="upg__detail">
          <div className="upg__detail__head">
            <div>
              <div className="upg__detail__eyebrow">Class · {selected.category || "Archetype"}</div>
              <div className="upg__detail__title">{selected.name}</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <EntityCardChrome entity={selected} callbacks={{}}/>
            </div>
          </div>
          {selected.summary && <p className="upg__detail__lede">{selected.summary}</p>}
          <ClassDetail entity={selected} onSelectEntity={onSelectEntity}/>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// RacesPanelBody
// ---------------------------------------------------------------------
const RacesPanelBody = ({ panel, onSelectEntity }) => {
  const entities = (window.ENTITY_SAMPLES && window.ENTITY_SAMPLES.races) || [];
  const [search, setSearch] = _crab_us("");
  const [selectedId, setSelectedId] = _crab_us(entities[0]?.id || null);
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
              <span>{e.category || "Folk"}</span>
              {e.queue ? <ReviewCountBadge count={e.queue}/> : null}
              {e.status && e.status !== "active" && <EntityStatusPill status={e.status}/>}
            </div>
          </div>
        ))}
      </div>

      {selected && (
        <div className="upg__detail">
          <div className="upg__detail__head">
            <div>
              <div className="upg__detail__eyebrow">Race / Species · {selected.category || "Folk"}</div>
              <div className="upg__detail__title">{selected.name}</div>
            </div>
            <EntityCardChrome entity={selected} callbacks={{}}/>
          </div>
          {selected.summary && <p className="upg__detail__lede">{selected.summary}</p>}
          <RaceDetail entity={selected} onSelectEntity={onSelectEntity}/>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// AbilitiesPanelBody — DEPRECATION CARD (Abilities are now Skill Trees)
// ---------------------------------------------------------------------
const AbilitiesPanelBody = ({ panel, onSelectEntity }) => {
  const legacyAbilities = (window.ENTITY_SAMPLES && window.ENTITY_SAMPLES.abilities) || [];
  return (
    <div className="upg" data-ui="AbilitiesPanelBody" data-state="deprecated">
      <div style={{
        margin: "18px",
        padding: "26px 28px",
        background: "linear-gradient(135deg, var(--accent-soft), var(--bg-paper-2))",
        border: "1px solid var(--accent)",
        borderRadius: "var(--r-5)",
        boxShadow: "var(--shadow-2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 40, height: 40,
            borderRadius: "var(--r-3)",
            background: "var(--bg-paper)",
            border: "1px solid var(--accent)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            color: "var(--accent-deep)",
          }}>
            <Icon name="spark" size={20}/>
          </div>
          <div>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--accent-deep)", fontWeight: 700 }}>Merged · 2026</div>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--ink-1)" }}>Abilities are now Skill Trees / Skills</div>
          </div>
        </div>
        <p style={{ fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-2)", lineHeight: 1.6, marginBottom: 12 }}>
          Create and manage <b>active</b>, <b>passive</b>, <b>triggered</b>, <b>one-time</b>, <b>innate</b>,
          <b> item-granted</b>, <b>class-granted</b>, and <b>race-granted</b> skills inside Skill Trees. Existing
          abilities below have already been migrated as legacy skill entries — they appear in Skill Trees
          unchanged. Drag any one of them into the composition overlay or onto a cast member as before.
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            className="ee-btn ee-btn--primary"
            onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "skillTrees" } }))}
            data-callback="onOpenSkillTreesFromAbilities"
          >
            <Icon name="tree" size={11}/> Open Skill Trees
          </button>
          <button
            className="ee-btn ee-btn--outline"
            onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "skills" } }))}
            data-callback="onCreateSkill"
          >
            <Icon name="plus" size={11}/> Create skill
          </button>
          <span style={{ fontSize: 11, color: "var(--ink-4)", fontStyle: "italic", marginLeft: "auto" }}>
            This compatibility panel will be removed in a future build.
          </span>
        </div>
      </div>

      <div style={{ padding: "0 18px 18px" }}>
        <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)", fontWeight: 700, marginBottom: 8 }}>
          Legacy abilities · migrated as skills · {legacyAbilities.length}
        </div>
        {legacyAbilities.length === 0 ? (
          <EmptyState icon="spark" title="Nothing to migrate" body="No legacy abilities found in this project."/>
        ) : (
          <div className="upg__list">
            {legacyAbilities.map((e) => (
              <div key={e.id}
                className="upg__item"
                draggable
                onDragStart={(ev) => {
                  const payload = { entityType: "skills", id: e.id, name: e.name, summary: e.summary };
                  try {
                    ev.dataTransfer.setData("application/x-loom-entity", JSON.stringify(payload));
                    ev.dataTransfer.setData("text/plain", e.name);
                  } catch (_err) {}
                  ev.currentTarget.classList.add("is-dragging");
                  if (window.ENTITY_DRAG) window.ENTITY_DRAG.set({ active: true, payload });
                }}
                onDragEnd={(ev) => {
                  ev.currentTarget.classList.remove("is-dragging");
                  if (window.ENTITY_DRAG) window.ENTITY_DRAG.set({ active: false, payload: null });
                }}
                onClick={() => onSelectEntity && onSelectEntity(e)}
              >
                <span className="ent-grip"><Icon name="grip" size={10}/></span>
                <div className="upg__item__monogram">{e.glyphChar || e.name?.slice(0, 2)}</div>
                <div className="upg__item__body">
                  <div className="upg__item__name">{e.name}
                    <span className="ent-status" style={{ marginLeft: 6 }}>Skill · {e.abilityType || "passive"}</span>
                  </div>
                  <div className="upg__item__sub">{e.subtitle || e.summary}</div>
                </div>
                <div className="upg__item__meta">
                  <button className="ee-btn ee-btn--ghost" style={{ padding: "3px 8px" }}
                    onClick={(ev) => { ev.stopPropagation(); window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "skillTrees" } })); }}>
                    Open in Skill Trees →
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

Object.assign(window, { ClassesPanelBody, RacesPanelBody, AbilitiesPanelBody });

// =====================================================================
// workspaces-narrative.jsx — Full workspaces for narrative tabs.
//
// Registered:
//   • cast-dossier          — Cast Dossier Workspace
//   • bestiary-field-guide  — Bestiary Field Guide
//   • quest-log             — Quest Log
//   • event-ledger          — Event Ledger
//   • timeline-workspace    — Timeline Workspace
//   • canon-vault           — Canon Vault (Lore)
//
// Every workspace reads the LIVE entity store via useLiveEntities
// (full-workspaces.jsx) and honours workspace.entityId so the full
// editor opens on the record selected in the panel. The old
// ENTITY_SAMPLES/_wnSamples path and hardcoded fallback rosters are
// gone — an empty store renders WorkspaceEmptyState, never demo data.
// =====================================================================

const { useState: _wn_us, useMemo: _wn_um, useEffect: _wn_ue } = React;

function _wnSearch(items, q, fields = ["name", "label", "title", "subtitle", "sub"]) {
  if (!q) return items;
  const s = q.toLowerCase();
  return items.filter((it) => fields.some((f) => (it[f] || "").toLowerCase().includes(s)));
}

// =====================================================================
// CAST DOSSIER WORKSPACE -----------------------------------------------
// =====================================================================
const CastDossierWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = useLiveEntities("cast", (e) => {
    const d = _fwData(e);
    return {
      id: e.id,
      name: e.name || "Unnamed",
      title: d.title || d.role || "",
      role: String(d.role || "").toLowerCase(),
      initials: e.glyphChar || _fwInitials(e.name),
      review: (e.reviewQueueCount || 0) > 0 || e.status === "draft",
      raw: e,
    };
  });
  const liveItems = useLiveEntities("items");

  const [selectedId, setSelectedId] = useWorkspaceSelection(items, workspace?.entityId);
  const [search, setSearch] = _wn_us("");
  const [filter, setFilter] = _wn_us("all");
  const [tab, setTab] = _wn_us("relationships");

  const LEAD_ROLES = ["protagonist", "deuteragonist", "antagonist", "lead"];
  const byFilter = items.filter((it) =>
    filter === "all" ? true
    : filter === "leads" ? LEAD_ROLES.includes(it.role)
    : filter === "minor" ? !LEAD_ROLES.includes(it.role)
    : filter === "review" ? it.review
    : true);
  const filtered = _wnSearch(byFilter, search);
  const selected = items.find((x) => x.id === selectedId) || filtered[0] || null;
  const d = selected ? _fwData(selected.raw) : {};

  // Live context for the selected character only (cheap).
  const occs = _wn_um(() => (selected ? _fwOccsFor(selected.id) : []), [selected && selected.id, items]);
  const span = _fwSpan(occs);
  const heroQuote = occs.find((o) => !o.isPronounResolution && o.exactText)?.exactText || "";
  const edges = _wn_um(() => {
    if (!selected) return [];
    const all = window.LoomwrightBackend?.LinkService?.listRelationshipEdgesSync?.() || [];
    return all.filter((r) => r.a === selected.id || r.b === selected.id);
  }, [selected && selected.id, items]);
  const castName = (id) => (items.find((c) => c.id === id) || {}).name || "Unknown";
  const quests = useLiveEntities("quests");
  const events = useLiveEntities("events");
  const myQuests = selected ? quests.filter((q) => _fwReferencesEntity(q, selected.id)) : [];
  const myEvents = selected ? events.filter((ev) => _fwReferencesEntity(ev, selected.id)) : [];

  // Equipment: live items whose currentOwner is this character.
  const owned = selected ? liveItems.filter((it) => _fwRefId(_fwData(it).currentOwner) === selected.id) : [];
  const slotNames = (typeof EE_EQUIPMENT_SLOTS !== "undefined" ? EE_EQUIPMENT_SLOTS : ["Head", "Body", "Hands", "Main Hand", "Off Hand", "Accessory"]).filter((s) => s !== "Custom");
  const bySlot = {};
  const carried = [];
  for (const it of owned) {
    const slot = _fwData(it).slot;
    if (slot && slotNames.includes(slot) && !bySlot[slot]) bySlot[slot] = it;
    else carried.push(it);
  }
  const equipItem = async (payload, slot) => {
    const ES = window.LoomwrightBackend?.EntityService;
    if (!ES || !selected || !payload?.id) return;
    const item = ES.getSync(payload.id, "items");
    if (!item) {
      onRequest.setToast && onRequest.setToast({ title: "Not an item record", sub: "Drag items from the Item Vault roster." });
      return;
    }
    await ES.update("items", item.id, {
      data: { ...(item.data || {}), currentOwner: { id: selected.id, name: selected.name, type: "cast" }, slot, status: "equipped" },
    });
    onRequest.setToast && onRequest.setToast({ title: "Equipped", sub: (item.name || "Item") + " → " + slot + " (" + selected.name + ")" });
  };

  const openEditor = (sectionId) => selected && window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
    detail: { type: "cast", initial: { id: selected.id }, mode: "full", sectionId: sectionId || undefined },
  }));

  const persona = [
    { key: "Appearance", v: d.physicalDescription || d.appearance },
    { key: "Personality", v: d.personality },
    { key: "Voice", v: d.voiceProfile || d.speechStyle },
  ].filter((x) => x.v);
  const inner = [
    { k: "Goals", v: Array.isArray(d.goals) ? d.goals.join("; ") : d.goals },
    { k: "Fears", v: Array.isArray(d.fears) ? d.fears.join("; ") : d.fears },
    { k: "Secrets", v: Array.isArray(d.secrets) ? d.secrets.join("; ") : d.secrets },
    { k: "Flaws", v: Array.isArray(d.flaws) ? d.flaws.join("; ") : d.flaws },
  ].filter((x) => x.v);
  const stats = Array.isArray(d.stats) ? d.stats.filter((s) => s && s.name) : [];
  const skills = [...(Array.isArray(d.skills) ? d.skills : []), ...(Array.isArray(d.abilities) ? d.abilities : [])];

  return (
    <WorkspaceShell
      icon="feather" entityType="cast"
      eyebrow="Cast" title="Cast Dossier Workspace"
      subtitle="Characters, voices, dossiers. Deep view across every fact you've drafted."
      createLabel="Create character"
      onCreate={() => onRequest.openEntityEditor({ type: "cast" })}
      onExit={onExit} cols={items.length ? "lcr-wide" : "c"}
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={items.length ? (
        <>
          <div className="fws-section">
            <span className="fws-section__title">Roster</span>
            <span className="fws-section__count">{items.length}</span>
          </div>
          <div style={{ padding: "6px 10px 0" }}>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search cast…"
              style={{ width: "100%", padding: "6px 8px", fontSize: 12, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", color: "var(--ink-1)" }}/>
          </div>
          <WorkspaceFilters
            filters={[
              { key: "all", label: "All", count: items.length },
              { key: "leads", label: "Leads", count: items.filter((i) => LEAD_ROLES.includes(i.role)).length },
              { key: "minor", label: "Minor", count: items.filter((i) => !LEAD_ROLES.includes(i.role)).length },
              { key: "review", label: "Review", count: items.filter((i) => i.review).length },
            ]}
            active={filter} onChange={setFilter}
          />
          <div className="fws-roster">
            {filtered.map((it) => (
              <WorkspaceRosterRow key={it.id}
                item={{ ...it.raw, entityType: "cast" }}
                selected={selected && selected.id === it.id}
                onClick={() => setSelectedId(it.id)}
                onDragStart={() => {}}
                avatar={it.initials}
                name={it.name}
                sub={it.title}
                meta={it.review ? "review" : ""}
              />
            ))}
            {filtered.length === 0 && _fwTabEmpty("No cast match this filter.")}
          </div>
        </>
      ) : null}
      main={
        !items.length ? (
          <WorkspaceEmptyState entityType="cast" noun="characters" onCreate={() => onRequest.openEntityEditor({ type: "cast" })}/>
        ) : selected ? (
          <>
            <div className="fws-dossier__hero">
              <div className="fws-dossier__portrait">{selected.initials}</div>
              <div>
                <h2 className="fws-dossier__name">{selected.name}</h2>
                {heroQuote && <p className="fws-dossier__quote">"{heroQuote}"</p>}
                <div className="fws-dossier__chips">
                  {span && <span className="fws-chip">{span}</span>}
                  {selected.title && <span className="fws-chip">{selected.title}</span>}
                  {d.species && <span className="fws-chip">{_fwRefName(d.species, "races")}</span>}
                  {d.class && <span className="fws-chip">{_fwRefName(d.class, "classes")}</span>}
                  {d.faction && <span className="fws-chip">{_fwRefName(d.faction, "factions")}</span>}
                </div>
              </div>
            </div>

            <WorkspaceCard title="Biography" sub="From manuscript + dossier"
              action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => openEditor("basics")}>Edit</button>}>
              <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 14, color: d.backstory || d.description || selected.raw.summary ? "var(--ink-1)" : "var(--ink-3)", lineHeight: 1.65 }}>
                {d.backstory || d.description || selected.raw.summary || "No biography yet — open the editor to draft one, or let extraction build it from the manuscript."}
              </p>
            </WorkspaceCard>

            {persona.length > 0 && (
              <WorkspaceCard title="Appearance · Personality · Voice"
                action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => openEditor("appearance")}>Edit</button>}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(" + persona.length + ", 1fr)", gap: 12 }}>
                  {persona.map((p) => (
                    <div key={p.key}>
                      <div className="fws-section__title" style={{ marginBottom: 4 }}>{p.key}</div>
                      <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>{p.v}</p>
                    </div>
                  ))}
                </div>
              </WorkspaceCard>
            )}

            <WorkspaceCard title="Equipment & inventory" sub="Drag an item from Item Vault onto a slot">
              <div className="fws-slots">
                {slotNames.map((slot) => {
                  const item = bySlot[slot];
                  return (
                    <div key={slot} className={"fws-slot " + (item ? "is-filled" : "")}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        try {
                          const raw = e.dataTransfer.getData("text/loomwright-entity");
                          if (raw) {
                            const data = JSON.parse(raw);
                            if (data.entityType === "items" || !data.entityType) equipItem(data, slot);
                          }
                        } catch (_) {}
                      }}>
                      <span className="fws-slot__label">{slot}</span>
                      <span className="fws-slot__name">{item ? item.name : "—"}</span>
                    </div>
                  );
                })}
              </div>
              {carried.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div className="fws-section__title" style={{ marginBottom: 4 }}>Carried</div>
                  {carried.map((it) => (
                    <button key={it.id} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}
                      onClick={() => onRequest.openEntityEditor({ type: "items", initial: { id: it.id } })}>{it.name}</button>
                  ))}
                </div>
              )}
              {owned.length === 0 && (
                <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--ink-3)" }}>
                  {selected.name} holds no recorded items. Set an item's "Current owner" to {selected.name}, or drop one here from the Item Vault.
                </p>
              )}
            </WorkspaceCard>

            {inner.length > 0 && (
              <WorkspaceCard title="Goals · Fears · Secrets"
                action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => openEditor("psychology")}>Edit</button>}>
                <WorkspaceKV rows={inner}/>
              </WorkspaceCard>
            )}

            <FullRecordSection entity={selected.raw} type="cast"/>
          </>
        ) : _fwTabEmpty("Select a character.")
      }
      right={items.length && selected ? (
        <>
          <WorkspaceTabs
            tabs={[
              { id: "relationships", label: "Relationships", count: edges.length },
              { id: "stats", label: "Stats", count: stats.length },
              { id: "skills", label: "Skills", count: skills.length },
              { id: "involvement", label: "Quests · Events", count: myQuests.length + myEvents.length },
              { id: "source", label: "Source", count: occs.length },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "relationships" && (
              <>
                {edges.map((r) => {
                  const otherId = r.a === selected.id ? r.b : r.a;
                  return (
                    <div key={r.id} style={{ padding: "8px 10px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12 }}>
                      <div style={{ fontFamily: "var(--font-serif)", color: "var(--ink-1)" }}>{castName(otherId)}</div>
                      <div style={{ color: "var(--ink-3)", fontSize: 11 }}>{r.summary || r.rawType || r.type}{r.secret ? " · secret" : ""}</div>
                    </div>
                  );
                })}
                {edges.length === 0 && _fwTabEmpty("No recorded bonds yet.")}
                <button className="fws-section__action" onClick={() => onRequest.openPanel("relationships")} style={{ marginTop: 6 }}>Open Relationship Map →</button>
              </>
            )}
            {tab === "stats" && (
              <>
                {stats.map((s, i) => {
                  const max = Number(s.max) || 10;
                  const v = Number(s.value) || 0;
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 12 }}>
                      <span style={{ flex: 1, fontFamily: "var(--font-serif)" }}>{s.name}</span>
                      <div style={{ flex: 1, height: 6, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: 999, overflow: "hidden" }}>
                        <div style={{ width: Math.min(100, Math.max(0, v / max * 100)) + "%", height: "100%", background: "var(--accent)" }}/>
                      </div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>{v}/{max}</span>
                    </div>
                  );
                })}
                {stats.length === 0 && _fwTabEmpty("No stats recorded. Add them in the editor's RPG section.")}
                <button className="fws-section__action" onClick={() => onRequest.openPanel("stats")} style={{ marginTop: 6 }}>Open Stat Lab →</button>
              </>
            )}
            {tab === "skills" && (
              <>
                {skills.map((n, i) => (
                  <span key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{typeof n === "object" ? (_fwRefName(n) || "?") : String(n)}</span>
                ))}
                {skills.length === 0 && _fwTabEmpty("No skills or abilities recorded.")}
                <div style={{ marginTop: 10 }}>
                  <button className="fws-section__action" onClick={() => onRequest.openPanel("skillTrees")}>Open Skill Tree Editor →</button>
                </div>
              </>
            )}
            {tab === "involvement" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Quests</div>
                {myQuests.map((q) => (
                  <button key={q.id} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => onRequest.openPanel("quests")}>{q.name}</button>
                ))}
                {myQuests.length === 0 && <div style={{ fontSize: 11, color: "var(--ink-3)", marginBottom: 6 }}>None recorded.</div>}
                <div className="fws-section__title" style={{ marginTop: 12, marginBottom: 6 }}>Events</div>
                {myEvents.map((ev) => (
                  <button key={ev.id} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => onRequest.openPanel("events")}>{ev.name}</button>
                ))}
                {myEvents.length === 0 && <div style={{ fontSize: 11, color: "var(--ink-3)" }}>None recorded.</div>}
              </>
            )}
            {tab === "source" && (
              <>
                {occs.filter((o) => o.exactText).slice(0, 8).map((o, i) => _fwQuoteCard({ ch: o.chapterNum != null ? "Ch." + o.chapterNum : "—", q: o.exactText }, i))}
                {occs.filter((o) => o.exactText).length === 0 && _fwTabEmpty("No manuscript mentions yet. Run Save & Extract in the Writer's Room.")}
              </>
            )}
          </div>
        </>
      ) : null}
    />
  );
};

// =====================================================================
// BESTIARY FIELD GUIDE -------------------------------------------------
// =====================================================================
const BestiaryFieldGuideWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const data = useLiveEntities("bestiary", (e) => {
    const d = _fwData(e);
    return { id: e.id, name: e.name || "Unnamed", habitat: d.habitat || "", threat: d.threatLevel || d.threat || "", raw: e };
  });
  const [selectedId, setSelectedId] = useWorkspaceSelection(data, workspace?.entityId);
  const [tab, setTab] = _wn_us("encounters");
  const selected = data.find((x) => x.id === selectedId) || data[0] || null;
  const d = selected ? _fwData(selected.raw) : {};
  const occs = _wn_um(() => (selected ? _fwOccsFor(selected.id) : []), [selected && selected.id, data]);
  const traits = [...(Array.isArray(d.abilities) ? d.abilities : []), ...(Array.isArray(d.traits) ? d.traits : [])];
  const reviewItems = _wn_um(() => {
    const RS = window.LoomwrightBackend?.ReviewService;
    return (RS?.listSync?.("bestiary") || []).filter((q) => q.status === "pending");
  }, [data]);
  const kv = [
    { k: "Threat", v: selected ? (selected.threat || null) : null },
    { k: "Habitat", v: d.habitat || null },
    { k: "Disposition", v: d.disposition || null },
    { k: "Origin", v: d.origin || null },
    { k: "Weakness", v: Array.isArray(d.weaknesses) ? d.weaknesses.join(", ") : d.weaknesses },
  ].filter((r) => r.v);

  return (
    <WorkspaceShell
      icon="paw" entityType="bestiary"
      eyebrow="Bestiary" title="Bestiary Field Guide"
      subtitle="Creatures, monsters, fauna — habitats, abilities, and encounter notes."
      createLabel="Add creature"
      onCreate={() => onRequest.openEntityEditor({ type: "bestiary" })}
      onExit={onExit} cols={data.length ? "lcr" : "c"}
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={data.length ? (
        <>
          <div className="fws-section">
            <span className="fws-section__title">Creatures</span>
            <span className="fws-section__count">{data.length}</span>
          </div>
          <div className="fws-roster">
            {data.map((it) => (
              <WorkspaceRosterRow key={it.id}
                item={{ ...it.raw, entityType: "bestiary" }}
                selected={selected && selected.id === it.id}
                onClick={() => setSelectedId(it.id)}
                onDragStart={() => {}}
                avatar="✺"
                name={it.name}
                sub={it.habitat}
                meta={it.threat}
              />
            ))}
          </div>
        </>
      ) : null}
      main={
        !data.length ? (
          <WorkspaceEmptyState entityType="bestiary" noun="creatures" onCreate={() => onRequest.openEntityEditor({ type: "bestiary" })}/>
        ) : selected ? (
          <>
            <WorkspaceCard title={selected.name} sub={selected.threat ? "Threat: " + selected.threat : undefined}
              action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => onRequest.openEntityEditor({ type: "bestiary", initial: { id: selected.id } })}>Edit</button>}>
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: 14, color: d.description || selected.raw.summary ? "var(--ink-1)" : "var(--ink-3)", lineHeight: 1.6 }}>
                {d.description || selected.raw.summary || "No field notes yet — open the editor or extract from the manuscript."}
              </p>
              {kv.length > 0 && <WorkspaceKV rows={kv}/>}
            </WorkspaceCard>

            {traits.length > 0 && (
              <WorkspaceCard title="Abilities & traits">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {traits.map((t, i) => (
                    <span key={i} className="fws-chip fws-chip--accent">{typeof t === "object" ? (_fwRefName(t) || "?") : String(t)}</span>
                  ))}
                </div>
              </WorkspaceCard>
            )}

            <WorkspaceCard title="Encounter timeline" sub="From manuscript mentions">
              {occs.filter((o) => o.chapterNum != null).slice(0, 8).map((o, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr", gap: 8, padding: "6px 8px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: "var(--ink-3)" }}>Ch.{o.chapterNum}</span>
                  <span style={{ fontStyle: "italic", color: "var(--ink-2)" }}>{o.exactText || "Mentioned"}</span>
                </div>
              ))}
              {occs.length === 0 && _fwTabEmpty("No encounters recorded yet — extraction will log mentions here.")}
            </WorkspaceCard>

            <FullRecordSection entity={selected.raw} type="bestiary"/>
          </>
        ) : _fwTabEmpty("Select a creature.")
      }
      right={data.length && selected ? (
        <>
          <WorkspaceTabs
            tabs={[
              { id: "encounters", label: "Encounters", count: occs.length },
              { id: "habitat", label: "Habitat" },
              { id: "review", label: "Review", count: reviewItems.length },
              { id: "source", label: "Source" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "encounters" && (
              <>
                {[...new Set(occs.map((o) => o.chapterNum).filter((n) => n != null))].map((n, i) => (
                  <div key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>Ch.{n}</div>
                ))}
                {occs.length === 0 && _fwTabEmpty("No encounters yet.")}
              </>
            )}
            {tab === "habitat" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("atlas")}>
                <Icon name="globe" size={11}/> Show habitat on Atlas →
              </button>
            )}
            {tab === "review" && (
              reviewItems.length
                ? reviewItems.slice(0, 6).map((q) => (
                    <div key={q.id} style={{ padding: "8px 10px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12 }}>
                      <div style={{ fontFamily: "var(--font-serif)" }}>{q.name || "Candidate"}</div>
                      <button className="fws-section__action" onClick={() => onRequest.openPanel("review")}>Open review queue →</button>
                    </div>
                  ))
                : _fwTabEmpty("No review items.")
            )}
            {tab === "source" && (
              <>
                {occs.filter((o) => o.exactText).slice(0, 6).map((o, i) => _fwQuoteCard({ ch: o.chapterNum != null ? "Ch." + o.chapterNum : "—", q: o.exactText }, i))}
                {occs.filter((o) => o.exactText).length === 0 && _fwTabEmpty("No source quotes yet.")}
              </>
            )}
          </div>
        </>
      ) : null}
    />
  );
};

// =====================================================================
// QUEST LOG ------------------------------------------------------------
// =====================================================================
const QuestLogWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const data = useLiveEntities("quests", (e) => {
    const d = _fwData(e);
    return {
      id: e.id, name: e.name || d.title || "Untitled quest",
      status: d.status || "", questType: d.questType || "",
      subtitle: e.summary || d.summary || d.goal || "",
      raw: e,
    };
  });
  const [selectedId, setSelectedId] = useWorkspaceSelection(data, workspace?.entityId);
  const [tab, setTab] = _wn_us("participants");
  const selected = data.find((x) => x.id === selectedId) || data[0] || null;
  const d = selected ? _fwData(selected.raw) : {};
  const steps = Array.isArray(d.steps) ? d.steps : [];
  const occs = _wn_um(() => (selected ? _fwOccsFor(selected.id) : []), [selected && selected.id, data]);
  const openEditor = (sectionId) => selected && window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
    detail: { type: "quests", initial: { id: selected.id }, mode: "full", sectionId: sectionId || undefined },
  }));
  const refChips = (v, panelKind, related) => {
    const list = (v == null ? [] : (Array.isArray(v) ? v : [v]));
    return list.map((ref, i) => (
      <button key={i} className="fws-chip" onClick={() => onRequest.openPanel(panelKind)} style={{ marginRight: 4, marginBottom: 4 }}>
        {_fwRefName(ref, related) || "?"}
      </button>
    ));
  };
  const stepDone = (s) => {
    const st = String(s?.status || "").toLowerCase();
    return s?.done === true || st === "done" || st === "complete" || st === "completed";
  };
  const kv = [
    { k: "Status", v: selected ? (selected.status || null) : null },
    { k: "Type", v: selected ? (selected.questType || null) : null },
    { k: "Goal", v: d.goal || null },
    { k: "Owner", v: d.owner ? _fwRefName(d.owner, "cast") : null },
    { k: "Start chapter", v: d.startChapter || null },
  ].filter((r) => r.v);

  return (
    <WorkspaceShell
      icon="scroll" entityType="quests"
      eyebrow="Quests" title="Quest Log"
      subtitle="Goals, arcs, threads in motion — steps, branches, consequences."
      createLabel="Create quest"
      onCreate={() => onRequest.openEntityEditor({ type: "quests" })}
      onExit={onExit} cols={data.length ? "lcr" : "c"}
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={data.length ? (
        <>
          <div className="fws-section"><span className="fws-section__title">Quests</span><span className="fws-section__count">{data.length}</span></div>
          <div className="fws-roster">
            {data.map((q) => (
              <WorkspaceRosterRow key={q.id}
                item={{ ...q.raw, entityType: "quests" }}
                selected={selected && selected.id === q.id}
                onClick={() => setSelectedId(q.id)}
                onDragStart={() => {}}
                avatar="✦"
                name={q.name}
                sub={q.subtitle}
                meta={q.status}
              />
            ))}
          </div>
        </>
      ) : null}
      main={
        !data.length ? (
          <WorkspaceEmptyState entityType="quests" noun="quests" onCreate={() => onRequest.openEntityEditor({ type: "quests" })}/>
        ) : selected ? (
          <>
            <WorkspaceCard title={selected.name} sub={selected.subtitle}
              action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => openEditor("basics")}>Edit</button>}>
              <p style={{ margin: "0 0 10px", fontFamily: "var(--font-serif)", fontSize: 14, color: selected.raw.summary || d.summary ? "var(--ink-1)" : "var(--ink-3)", lineHeight: 1.6 }}>
                {selected.raw.summary || d.summary || "No summary yet — open the editor to describe this quest."}
              </p>
              {kv.length > 0 && <WorkspaceKV rows={kv}/>}
            </WorkspaceCard>

            <WorkspaceCard title="Steps" sub={steps.length ? steps.filter(stepDone).length + " of " + steps.length + " done" : undefined}>
              {steps.map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ width: 20, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{i + 1}.</span>
                  <span style={{ flex: 1, fontFamily: "var(--font-serif)", textDecoration: stepDone(s) ? "line-through" : "none", color: stepDone(s) ? "var(--ink-3)" : "var(--ink-1)" }}>
                    {s.title || s.label || String(s)}
                    {s.chapter != null && <span style={{ marginLeft: 6, fontSize: 10, color: "var(--ink-3)" }}>Ch.{s.chapter}</span>}
                  </span>
                  {stepDone(s) && <span className="fws-chip fws-chip--ok">done</span>}
                </div>
              ))}
              {steps.length === 0 && _fwTabEmpty("No steps yet — break the quest into beats.")}
              <button className="fws-section__action" style={{ marginTop: 6 }} data-callback="onEditEntity" onClick={() => openEditor("structure")}>+ Add step</button>
            </WorkspaceCard>

            {(_fwHasValue(d.branches) || _fwHasValue(d.outcomes) || d.rewards) && (
              <WorkspaceCard title="Branches & consequences"
                action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => openEditor("outcomes")}>Edit</button>}>
                {_fwHasValue(d.branches) && _fwFieldBody({ kind: "branch-list" }, d.branches)}
                {_fwHasValue(d.outcomes) && _fwFieldBody({ kind: "rule-list" }, d.outcomes)}
                {d.rewards && <p style={{ margin: "6px 0 0", fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 12 }}>{d.rewards}</p>}
              </WorkspaceCard>
            )}

            <FullRecordSection entity={selected.raw} type="quests"/>
          </>
        ) : _fwTabEmpty("Select a quest.")
      }
      right={data.length && selected ? (
        <>
          <WorkspaceTabs
            tabs={[
              { id: "participants", label: "Participants" },
              { id: "items", label: "Items" },
              { id: "locations", label: "Locations" },
              { id: "events", label: "Events" },
              { id: "source", label: "Source", count: occs.length },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "participants" && (
              <>
                {refChips([...(d.owner ? [d.owner] : []), ...(Array.isArray(d.participants) ? d.participants : [])], "cast", "cast")}
                {!d.owner && !(Array.isArray(d.participants) && d.participants.length) && _fwTabEmpty("No participants linked.")}
              </>
            )}
            {tab === "items" && (
              <>
                {refChips(d.items, "items", "items")}
                {!(Array.isArray(d.items) && d.items.length) && _fwTabEmpty("No items linked.")}
              </>
            )}
            {tab === "locations" && (
              <>
                {refChips(d.locations, "locations", "locations")}
                {!(Array.isArray(d.locations) && d.locations.length) && _fwTabEmpty("No locations linked.")}
              </>
            )}
            {tab === "events" && (
              <>
                {refChips(d.relatedEvents, "events", "events")}
                {!(Array.isArray(d.relatedEvents) && d.relatedEvents.length) && _fwTabEmpty("No events linked.")}
              </>
            )}
            {tab === "source" && (
              <>
                {occs.filter((o) => o.exactText).slice(0, 6).map((o, i) => _fwQuoteCard({ ch: o.chapterNum != null ? "Ch." + o.chapterNum : "—", q: o.exactText }, i))}
                {occs.filter((o) => o.exactText).length === 0 && _fwTabEmpty("No mentions linked yet.")}
              </>
            )}
          </div>
        </>
      ) : null}
    />
  );
};

// =====================================================================
// EVENT LEDGER ---------------------------------------------------------
// =====================================================================
const EventLedgerWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const data = useLiveEntities("events", (e) => {
    const d = _fwData(e);
    return {
      id: e.id, name: e.name || d.title || "Untitled event",
      eventType: d.eventType || "", subtitle: e.summary || d.summary || "",
      chapter: d.chapter || d.timelinePosition || "",
      raw: e,
    };
  });
  const [selectedId, setSelectedId] = useWorkspaceSelection(data, workspace?.entityId);
  const [tab, setTab] = _wn_us("consequence");
  const selected = data.find((x) => x.id === selectedId) || data[0] || null;
  const d = selected ? _fwData(selected.raw) : {};
  const occs = _wn_um(() => (selected ? _fwOccsFor(selected.id) : []), [selected && selected.id, data]);
  const reviewItems = _wn_um(() => {
    const RS = window.LoomwrightBackend?.ReviewService;
    return (RS?.listSync?.("events") || []).filter((q) => q.status === "pending");
  }, [data]);
  const chain = [
    { k: "Cause", v: d.cause },
    { k: "Outcome", v: d.immediateOutcome },
    { k: "Long-term", v: d.longTermConsequence },
  ].filter((r) => r.v);
  const changeKinds = [
    ["Stats", d.statChanges], ["Character state", d.characterStateChanges],
    ["Relationships", d.relationshipChanges], ["Items", d.itemStateChanges], ["Locations", d.locationChanges],
  ].filter(([, v]) => _fwHasValue(v));

  return (
    <WorkspaceShell
      icon="bolt" entityType="events"
      eyebrow="Events" title="Event Ledger"
      subtitle="Discrete things that happened — causes, outcomes, state changes."
      createLabel="Create event"
      onCreate={() => onRequest.openEntityEditor({ type: "events" })}
      onExit={onExit} cols={data.length ? "lcr" : "c"}
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={data.length ? (
        <>
          <div className="fws-section"><span className="fws-section__title">Ledger</span><span className="fws-section__count">{data.length}</span></div>
          <div className="fws-roster">
            {data.map((e) => (
              <WorkspaceRosterRow key={e.id}
                item={{ ...e.raw, entityType: "events" }}
                selected={selected && selected.id === e.id}
                onClick={() => setSelectedId(e.id)}
                onDragStart={() => {}}
                avatar="◉"
                name={e.name}
                sub={e.subtitle}
                meta={e.eventType}
              />
            ))}
          </div>
        </>
      ) : null}
      main={
        !data.length ? (
          <WorkspaceEmptyState entityType="events" noun="events" onCreate={() => onRequest.openEntityEditor({ type: "events" })}/>
        ) : selected ? (
          <>
            <WorkspaceCard title={selected.name} sub={selected.subtitle}
              action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => onRequest.openEntityEditor({ type: "events", initial: { id: selected.id } })}>Edit</button>}>
              <WorkspaceKV rows={[
                { k: "Type", v: selected.eventType || null },
                { k: "Chapter", v: selected.chapter || null },
                { k: "Location", v: d.location ? <button className="fws-chip" onClick={() => onRequest.openPanel("locations")}>{_fwRefName(d.location, "locations")}</button> : null },
                { k: "Participants", v: Array.isArray(d.participants) && d.participants.length
                    ? d.participants.map((p, i) => <button key={i} className="fws-chip" style={{ marginRight: 4 }} onClick={() => onRequest.openPanel("cast")}>{_fwRefName(p, "cast")}</button>)
                    : null },
              ].filter((r) => r.v)}/>
            </WorkspaceCard>

            {chain.length > 0 && (
              <WorkspaceCard title="Cause · Outcome · Long-term consequence">
                <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, fontSize: 12 }}>
                  {chain.map((r) => (
                    <React.Fragment key={r.k}>
                      <span style={{ color: "var(--ink-3)" }}>{r.k}</span>
                      <span style={{ fontFamily: "var(--font-serif)" }}>{r.v}</span>
                    </React.Fragment>
                  ))}
                </div>
              </WorkspaceCard>
            )}

            {changeKinds.length > 0 && (
              <WorkspaceCard title="State changes" sub="Stats · Relationships · Items">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(" + Math.min(3, changeKinds.length) + ", 1fr)", gap: 8 }}>
                  {changeKinds.map(([label, v]) => (
                    <div key={label} className="fws-card" style={{ padding: 10 }}>
                      <div className="fws-section__title" style={{ marginBottom: 6 }}>{label}</div>
                      {_fwFieldBody({ kind: "rule-list" }, v)}
                    </div>
                  ))}
                </div>
              </WorkspaceCard>
            )}

            <FullRecordSection entity={selected.raw} type="events"/>
          </>
        ) : _fwTabEmpty("Select an event.")
      }
      right={data.length && selected ? (
        <>
          <WorkspaceTabs
            tabs={[
              { id: "consequence", label: "Consequences" },
              { id: "timeline", label: "Timeline" },
              { id: "atlas", label: "Atlas" },
              { id: "review", label: "Review", count: reviewItems.length },
              { id: "source", label: "Source", count: occs.length },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "consequence" && (
              d.longTermConsequence
                ? <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 12 }}>{d.longTermConsequence}</p>
                : _fwTabEmpty("No long-term consequence recorded.")
            )}
            {tab === "timeline" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("timeline")}>
                <Icon name="clock" size={11}/> Open Timeline →
              </button>
            )}
            {tab === "atlas" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("atlas")}>
                <Icon name="globe" size={11}/> Show on Atlas →
              </button>
            )}
            {tab === "review" && (
              reviewItems.length
                ? <button className="fws-section__action" onClick={() => onRequest.openPanel("review")}>{reviewItems.length} pending — open review queue →</button>
                : _fwTabEmpty("No review items.")
            )}
            {tab === "source" && (
              <>
                {occs.filter((o) => o.exactText).slice(0, 6).map((o, i) => _fwQuoteCard({ ch: o.chapterNum != null ? "Ch." + o.chapterNum : "—", q: o.exactText }, i))}
                {occs.filter((o) => o.exactText).length === 0 && _fwTabEmpty("No source quotes yet.")}
              </>
            )}
          </div>
        </>
      ) : null}
    />
  );
};

// =====================================================================
// TIMELINE WORKSPACE ---------------------------------------------------
// =====================================================================
const TimelineWorkspaceFs = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const TRACKS = [
    { id: "book", label: "Book order" },
    { id: "chrono", label: "Chronological" },
    { id: "char", label: "Per character", type: "cast" },
    { id: "loc", label: "Per location", type: "locations" },
    { id: "quest", label: "Per quest", type: "quests" },
    { id: "faction", label: "Per faction", type: "factions" },
    { id: "item", label: "Per item", type: "items" },
  ];
  const [track, setTrack] = _wn_us("book");
  const [focusId, setFocusId] = _wn_us(null);

  const events = useLiveEntities("events");
  const trackDef = TRACKS.find((t) => t.id === track) || TRACKS[0];
  const focusEntities = useLiveEntities(trackDef.type || "events");
  // Reset the per-entity focus when the track type changes.
  _wn_ue(() => { setFocusId(null); }, [track]);

  // Chapter state (live) — re-read when chapters change.
  const [chTick, setChTick] = _wn_us(0);
  _wn_ue(() => {
    const bump = () => setChTick((t) => t + 1);
    const evs = ["lw:manuscript-chapters-updated", "lw:backend-ready", "lw:occurrences-updated"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  const { chapters, num: chapterNum } = _wn_um(() => _fwChapterState(), [chTick]);

  // Chapter number for an event: explicit data.chapter ("Ch. 5" / 5) first,
  // then the chapter of its first occurrence.
  const chapterOf = (ev) => {
    const d = _fwData(ev);
    const m = String(d.chapter || "").match(/(\d+)/);
    if (m) return Number(m[1]);
    const occ = _fwOccsFor(ev.id).find((o) => o.chapterNum != null);
    return occ ? occ.chapterNum : null;
  };

  const nodes = _wn_um(() => {
    const focus = trackDef.type ? focusId : null;
    let rows = events.map((ev) => ({
      id: ev.id,
      label: ev.name || "Untitled",
      type: _fwData(ev).eventType || "Event",
      ch: chapterOf(ev),
      when: _fwData(ev).timelinePosition || _fwData(ev).chapter || "",
      raw: ev,
    }));
    if (trackDef.type && focus) rows = rows.filter((r) => _fwReferencesEntity(r.raw, focus));
    if (track === "chrono") {
      rows.sort((a, b) => String(a.when).localeCompare(String(b.when), undefined, { numeric: true }) || (a.ch ?? 999) - (b.ch ?? 999));
    } else {
      rows.sort((a, b) => (a.ch ?? 999) - (b.ch ?? 999));
    }
    return rows;
  }, [events, track, focusId, chTick]);

  // Mention beats for the focused entity (per-X tracks): chapters where it occurs.
  const focusBeats = _wn_um(() => {
    if (!trackDef.type || !focusId) return [];
    return [...new Set(_fwOccsFor(focusId).map((o) => o.chapterNum).filter((n) => n != null))].sort((a, b) => a - b);
  }, [track, focusId, chTick, events]);

  const reviewItems = _wn_um(() => {
    const RS = window.LoomwrightBackend?.ReviewService;
    return (RS?.listSync?.("events") || []).filter((q) => q.status === "pending");
  }, [events]);

  const empty = events.length === 0 && chapters.length === 0;

  return (
    <WorkspaceShell
      icon="clock" entityType="timeline"
      eyebrow="Timeline" title="Timeline Workspace"
      subtitle="Time, ordered every way. Cycle the track to see the same events from different angles."
      createLabel="Add timeline event"
      onCreate={() => onRequest.openEntityEditor({ type: "events" })}
      onExit={onExit} cols="c"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      bottom={!empty ? (
        <>
          <span style={{ fontFamily: "var(--font-mono)" }}>Track:</span>
          {TRACKS.map((t) => (
            <button key={t.id}
              className={"fws-filter " + (track === t.id ? "is-on" : "")}
              onClick={() => setTrack(t.id)}>{t.label}</button>
          ))}
          {trackDef.type && (
            <select value={focusId || ""} onChange={(e) => setFocusId(e.target.value || null)}
              style={{ marginLeft: 8, padding: "4px 6px", fontSize: 11, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", color: "var(--ink-1)" }}>
              <option value="">Choose {trackDef.label.replace("Per ", "")}…</option>
              {focusEntities.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          )}
        </>
      ) : null}
      main={
        empty ? (
          <WorkspaceEmptyState entityType="events" noun="timeline events" onCreate={() => onRequest.openEntityEditor({ type: "events" })}/>
        ) : (
          <>
            <WorkspaceCard title={"Timeline · " + trackDef.label + (trackDef.type && focusId ? " · " + (focusEntities.find((e) => e.id === focusId)?.name || "") : "")}>
              {trackDef.type && !focusId ? (
                _fwTabEmpty("Pick a " + trackDef.label.replace("Per ", "").toLowerCase() + " below to see its thread through the story.")
              ) : nodes.length === 0 && focusBeats.length === 0 ? (
                _fwTabEmpty(trackDef.type ? "Nothing recorded involves this entity yet." : "No events yet — create one or extract from the manuscript.")
              ) : (
                <div style={{ position: "relative", minHeight: 220, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-3)", padding: "30px 20px" }}>
                  <div style={{ position: "absolute", left: 24, right: 24, top: "50%", height: 2, background: "var(--line-strong)" }}/>
                  {nodes.map((e, i) => {
                    const x = nodes.length === 1 ? 0.5 : 0.05 + 0.9 * (i / (nodes.length - 1));
                    return (
                      <div key={e.id} style={{ position: "absolute", left: `calc(24px + (100% - 48px) * ${x})`, top: "50%", transform: "translate(-50%, -50%)" }}>
                        <button className="fws-card" style={{ padding: "6px 8px", maxWidth: 140, textAlign: "left", cursor: "grab" }}
                          draggable
                          data-entity-id={e.id}
                          onDragStart={(ev) => { try { ev.dataTransfer.setData("text/loomwright-entity", JSON.stringify({ entityType: "events", id: e.id, name: e.label })); } catch (_) {} }}
                          onClick={() => onRequest.openEntityEditor({ type: "events", initial: { id: e.id } })}>
                          <div style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{e.ch != null ? "Ch." + e.ch : (e.when || "—")} · {e.type}</div>
                          <div style={{ fontFamily: "var(--font-serif)", fontSize: 12, color: "var(--ink-1)" }}>{e.label}</div>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              {trackDef.type && focusId && focusBeats.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <div className="fws-section__title" style={{ marginBottom: 4 }}>Appears in</div>
                  {focusBeats.map((n) => <span key={n} className="fws-chip" style={{ marginRight: 4 }}>Ch.{n}</span>)}
                </div>
              )}
            </WorkspaceCard>
            <WorkspaceCard title="Review queue" sub="Events that need a chapter or order">
              {reviewItems.length
                ? <button className="fws-section__action" onClick={() => onRequest.openPanel("review")}>{reviewItems.length} pending — open review queue →</button>
                : <div className="fws-empty" style={{ padding: 14 }}>No review items.</div>}
            </WorkspaceCard>
          </>
        )
      }
    />
  );
};

// =====================================================================
// CANON VAULT (Lore) ---------------------------------------------------
// =====================================================================
const CanonVaultWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const data = useLiveEntities("lore", (e) => {
    const d = _fwData(e);
    const band = String(d.band || d.canon || "soft").toLowerCase();
    return {
      id: e.id, name: e.name || d.title || "Untitled",
      band,
      subtitle: e.summary || d.summary || "",
      contradicted: !!d.contradictedBy || String(d.status || "") === "contradicted",
      raw: e,
    };
  });
  const [selectedId, setSelectedId] = useWorkspaceSelection(data, workspace?.entityId);
  const [tab, setTab] = _wn_us("contradictions");
  const selected = data.find((x) => x.id === selectedId) || data[0] || null;
  const d = selected ? _fwData(selected.raw) : {};
  const occs = _wn_um(() => (selected ? _fwOccsFor(selected.id) : []), [selected && selected.id, data]);
  const terms = _wn_um(() => {
    const set = new Set();
    for (const f of data) {
      const dd = _fwData(f.raw);
      [...(Array.isArray(dd.subjects) ? dd.subjects : []), ...(Array.isArray(dd.appliesTo) ? dd.appliesTo : []), ...(Array.isArray(dd.aliases) ? dd.aliases : [])]
        .forEach((t) => t && set.add(String(t)));
    }
    return [...set].slice(0, 24);
  }, [data]);
  const evidence = [
    ...(d.sourceQuotes ? [{ ch: d.ratifiedAt || "Source", q: String(d.sourceQuotes) }] : []),
    ...occs.filter((o) => o.exactText).slice(0, 3).map((o) => ({ ch: o.chapterNum != null ? "Ch." + o.chapterNum : "—", q: o.exactText })),
  ];

  return (
    <WorkspaceShell
      icon="book" entityType="lore"
      eyebrow="Lore / Canon" title="Canon Vault"
      subtitle="World rules, hard/soft canon, contradictions, and the AI instructions that protect them."
      createLabel="Add canon fact"
      onCreate={() => onRequest.openEntityEditor({ type: "lore" })}
      onExit={onExit} cols={data.length ? "lcr" : "c"}
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={data.length ? (
        <>
          <div className="fws-section"><span className="fws-section__title">Canon facts</span><span className="fws-section__count">{data.length}</span></div>
          <div className="fws-roster">
            {data.map((f) => (
              <WorkspaceRosterRow key={f.id}
                item={{ ...f.raw, entityType: "lore" }}
                selected={selected && selected.id === f.id}
                onClick={() => setSelectedId(f.id)}
                avatar={f.band === "hard" ? "H" : "S"}
                name={f.name}
                sub={f.subtitle}
                meta={f.band}
                badges={f.contradicted && <span className="fws-chip fws-chip--warn">!</span>}
              />
            ))}
          </div>
        </>
      ) : null}
      main={
        !data.length ? (
          <WorkspaceEmptyState entityType="lore" noun="canon facts" onCreate={() => onRequest.openEntityEditor({ type: "lore" })}/>
        ) : selected ? (
          <>
            <WorkspaceCard title={selected.name}
              sub={selected.band + " canon"}
              action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => onRequest.openEntityEditor({ type: "lore", initial: { id: selected.id } })}>Edit</button>}>
              <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 14, color: d.body || selected.subtitle ? "var(--ink-1)" : "var(--ink-3)", lineHeight: 1.6 }}>
                {d.body || selected.subtitle || "No statement yet — edit to write the rule, add evidence, or set its canon band."}
              </p>
            </WorkspaceCard>
            {evidence.length > 0 && (
              <WorkspaceCard title="Evidence">
                {evidence.map((m, i) => _fwQuoteCard(m, i))}
              </WorkspaceCard>
            )}
            <WorkspaceCard title="AI guidance">
              <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 12 }}>
                {d.doNotSuggest
                  ? "Excluded from AI suggestions. The assistant will not surface this fact."
                  : selected.band === "hard"
                    ? "Hard canon: generation must never contradict this. Drafts that do are flagged."
                    : "Soft canon: treat as true unless the manuscript overrules it; flag contradictions for review."}
              </p>
            </WorkspaceCard>
            <FullRecordSection entity={selected.raw} type="lore"/>
          </>
        ) : _fwTabEmpty("Select a canon fact.")
      }
      right={data.length && selected ? (
        <>
          <WorkspaceTabs
            tabs={[
              { id: "contradictions", label: "Contradictions" },
              { id: "terms", label: "Terminology" },
              { id: "intel", label: "Project intel" },
              { id: "refs", label: "References" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "contradictions" && (
              d.contradictedBy
                ? <div className="fws-chip fws-chip--warn">{String(d.contradictedBy)}</div>
                : _fwTabEmpty("No contradictions recorded against this fact.")
            )}
            {tab === "terms" && (
              <>
                {terms.map((n, i) => <span key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{n}</span>)}
                {terms.length === 0 && _fwTabEmpty("No terminology captured yet — add Subjects / Applies-to chips on your canon facts.")}
              </>
            )}
            {tab === "intel" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("settings")}>Open Control Centre →</button>
            )}
            {tab === "refs" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("references")}>
                <Icon name="paper" size={11}/> Open Research Library →
              </button>
            )}
          </div>
        </>
      ) : null}
    />
  );
};

// Register
Object.assign(window.WORKSPACE_COMPONENTS, {
  "cast-dossier":         CastDossierWorkspace,
  "bestiary-field-guide": BestiaryFieldGuideWorkspace,
  "quest-log":            QuestLogWorkspace,
  "event-ledger":         EventLedgerWorkspace,
  "timeline-workspace":   TimelineWorkspaceFs,
  "canon-vault":          CanonVaultWorkspace,
});

Object.assign(window, {
  CastDossierWorkspace, BestiaryFieldGuideWorkspace,
  QuestLogWorkspace, EventLedgerWorkspace,
  TimelineWorkspaceFs, CanonVaultWorkspace,
});

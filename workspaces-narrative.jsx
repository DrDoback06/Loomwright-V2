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
// =====================================================================

const { useState: _wn_us, useMemo: _wn_um } = React;

function _wnSamples(type) {
  return (window.ENTITY_SAMPLES && window.ENTITY_SAMPLES[type]) || [];
}
function _wnSearch(items, q, fields = ["name", "label", "title", "subtitle"]) {
  if (!q) return items;
  const s = q.toLowerCase();
  return items.filter((it) => fields.some((f) => (it[f] || "").toLowerCase().includes(s)));
}

// =====================================================================
// CAST DOSSIER WORKSPACE -----------------------------------------------
// =====================================================================
const CastDossierWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const cast = _wnSamples("cast");
  const fallback = [
    { id: "c-ael", name: "Aelinor Vey",   title: "Queen of the Pale Reach", initials: "AV", quote: "the small dark queen of the Pale Reach", chapters: "Ch.1–7" },
    { id: "c-bre", name: "Captain Brec",  title: "Watchhouse Captain",      initials: "CB", quote: "the cold had settled into his face — not as colour but as architecture", chapters: "Ch.2–5" },
    { id: "c-sar", name: "Saren of Hess", title: "Auger-keeper",            initials: "SH", quote: "Saren of Hess sent me to bring", chapters: "Ch.3–7" },
    { id: "c-mar", name: "Mara of Hess",  title: "Saren's sister",          initials: "MH", chapters: "Ch.4" },
    { id: "c-dav", name: "Dav the Quiet", title: "Drover",                  initials: "DQ", chapters: "Ch.6" },
  ];
  const items = cast.length ? cast.map((c, i) => ({ ...c, initials: (c.name || "C").split(/\s+/).map((w) => w[0]).slice(0,2).join("").toUpperCase() })) : fallback;

  const [selectedId, setSelectedId] = _wn_us(items[0]?.id || null);
  const [search, setSearch] = _wn_us("");
  const [filter, setFilter] = _wn_us("all");
  const [tab, setTab] = _wn_us("relationships");

  const filtered = _wnSearch(items, search);
  const selected = items.find((x) => x.id === selectedId) || filtered[0];

  // Equipment slots (mock structure on selected.equipment)
  const slots = selected?.equipment || {
    Head: null, Body: "Salt-cloak", "Off Hand": "Auger of Hess", "Main Hand": "Felt-lined case",
    Belt: "Brec's letter", Boots: "Mud-darkened boots",
  };

  return (
    <WorkspaceShell
      icon="feather" entityType="cast"
      eyebrow="Cast" title="Cast Dossier Workspace"
      subtitle="Characters, voices, dossiers. Deep view across every fact you've drafted."
      createLabel="Create character"
      onCreate={() => onRequest.openEntityEditor({ type: "cast" })}
      onExit={onExit} cols="lcr-wide"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={
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
              { key: "leads", label: "Leads" },
              { key: "minor", label: "Minor" },
              { key: "review", label: "Review" },
            ]}
            active={filter} onChange={setFilter}
          />
          <div className="fws-roster">
            {filtered.map((it) => (
              <WorkspaceRosterRow key={it.id}
                item={{ ...it, entityType: "cast" }}
                selected={selectedId === it.id}
                onClick={() => setSelectedId(it.id)}
                onDragStart={() => {}}
                avatar={it.initials || (it.name || "?")[0]}
                name={it.name}
                sub={it.title || it.subtitle}
                meta={it.chapters || it.meta}
              />
            ))}
          </div>
        </>
      }
      main={
        selected ? (
          <>
            <div className="fws-dossier__hero">
              <div className="fws-dossier__portrait">{selected.initials || (selected.name || "?")[0]}</div>
              <div>
                <h2 className="fws-dossier__name">{selected.name}</h2>
                {selected.quote && <p className="fws-dossier__quote">"{selected.quote}"</p>}
                <div className="fws-dossier__chips">
                  <span className="fws-chip">{selected.chapters || "Ch.1–7"}</span>
                  <span className="fws-chip">{selected.title || "—"}</span>
                  {selected.race && <span className="fws-chip">{selected.race}</span>}
                  {selected.class && <span className="fws-chip">{selected.class}</span>}
                </div>
              </div>
            </div>

            <WorkspaceCard title="Biography" sub="From manuscript + dossier"
              action={<button className="fws-section__action" onClick={() => onRequest.openEntityEditor({ type: "cast", initial: selected })}>Edit</button>}>
              <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.65 }}>
                {selected.biography || "A coastal noblewoman of small house and stubborn habit, born to the Pale Reach and trained in the keeping of the Auger. Aelinor returned to her family seat when Captain Brec's letter brought news of an Auger Wake. She does not yet know the cost of carrying it."}
              </p>
            </WorkspaceCard>

            <WorkspaceCard title="Appearance · Personality · Voice">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                <div>
                  <div className="fws-section__title" style={{ marginBottom: 4 }}>Appearance</div>
                  <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
                    Small, dark, sharp-featured. Hands kept gloved. Coastal pallor.
                  </p>
                </div>
                <div>
                  <div className="fws-section__title" style={{ marginBottom: 4 }}>Personality</div>
                  <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
                    Quiet, decisive, slow to forgive. Carries grief like a folded letter.
                  </p>
                </div>
                <div>
                  <div className="fws-section__title" style={{ marginBottom: 4 }}>Voice</div>
                  <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.55 }}>
                    Short, weighted sentences. Tends toward image, away from explanation.
                  </p>
                </div>
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Equipment & inventory" sub="Drag an item from Item Vault onto a slot">
              <div className="fws-slots">
                {Object.entries(slots).map(([slot, item]) => (
                  <div key={slot} className={"fws-slot " + (item ? "is-filled" : "")}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      try {
                        const raw = e.dataTransfer.getData("text/loomwright-entity");
                        if (raw) {
                          const data = JSON.parse(raw);
                          if (data.entityType === "items") {
                            onRequest.setToast && onRequest.setToast({
                              title: "Equipped",
                              sub: data.name + " → " + slot,
                            });
                          }
                        }
                      } catch (_) {}
                    }}>
                    <span className="fws-slot__label">{slot}</span>
                    <span className="fws-slot__name">{item || "—"}</span>
                  </div>
                ))}
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Goals · Fears · Secrets">
              <WorkspaceKV rows={[
                { k: "Wants", v: "To deliver the Auger of Hess and survive Pale Reach." },
                { k: "Needs", v: "To forgive what Saren did to her sister." },
                { k: "Fears", v: "Becoming her mother. Sleep. The dreams." },
                { k: "Secret", v: "She knows what the Auger does to the bearer. She did not tell Brec." },
              ]}/>
            </WorkspaceCard>
          </>
        ) : <div className="fws-empty">Select a character.</div>
      }
      right={
        <>
          <WorkspaceTabs
            tabs={[
              { id: "relationships", label: "Relationships" },
              { id: "stats", label: "Stats" },
              { id: "skills", label: "Skills" },
              { id: "involvement", label: "Quests · Events" },
              { id: "source", label: "Source" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "relationships" && (
              <>
                {[
                  { who: "Captain Brec", how: "Trusts; old debt" },
                  { who: "Saren of Hess", how: "Sister of an enemy; bound by oath" },
                  { who: "Mara of Hess", how: "Owes vengeance" },
                ].map((r, i) => (
                  <div key={i} style={{ padding: "8px 10px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12 }}>
                    <div style={{ fontFamily: "var(--font-serif)", color: "var(--ink-1)" }}>{r.who}</div>
                    <div style={{ color: "var(--ink-3)", fontSize: 11 }}>{r.how}</div>
                  </div>
                ))}
                <button className="fws-section__action" onClick={() => onRequest.openPanel("relationships")} style={{ marginTop: 6 }}>Open Relationship Map →</button>
              </>
            )}
            {tab === "stats" && (
              <>
                {[
                  { name: "Sleep",   v: 4, max: 10 },
                  { name: "Grief",   v: 6, max: 10 },
                  { name: "Cunning", v: 8, max: 10 },
                  { name: "Standing", v: 7, max: 10 },
                ].map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 8px", fontSize: 12 }}>
                    <span style={{ flex: 1, fontFamily: "var(--font-serif)" }}>{s.name}</span>
                    <div style={{ flex: 1, height: 6, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: 999, overflow: "hidden" }}>
                      <div style={{ width: (s.v / s.max * 100) + "%", height: "100%", background: "var(--accent)" }}/>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--ink-3)" }}>{s.v}/{s.max}</span>
                  </div>
                ))}
                <button className="fws-section__action" onClick={() => onRequest.openPanel("stats")} style={{ marginTop: 6 }}>Open Stat Lab →</button>
              </>
            )}
            {tab === "skills" && (
              <>
                {["Salt-walker", "Auger-reading", "Quiet step"].map((n, i) => (
                  <span key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{n}</span>
                ))}
                <div style={{ marginTop: 10 }}>
                  <button className="fws-section__action" onClick={() => onRequest.openPanel("skillTrees")}>Open Skill Tree Editor →</button>
                </div>
              </>
            )}
            {tab === "involvement" && (
              <>
                <div className="fws-section__title" style={{ marginBottom: 6 }}>Quests</div>
                {["The Auger of Hess", "The Salt-bitten Cloak"].map((n, i) => (
                  <button key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => onRequest.openPanel("quests")}>{n}</button>
                ))}
                <div className="fws-section__title" style={{ marginTop: 12, marginBottom: 6 }}>Events</div>
                {["The Auger Wake", "Brec's Letter Arrives"].map((n, i) => (
                  <button key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }} onClick={() => onRequest.openPanel("events")}>{n}</button>
                ))}
              </>
            )}
            {tab === "source" && (
              <>
                {[
                  { ch: "Ch.1", q: "…when Aelinor Vey came through the stockade gate." },
                  { ch: "Ch.2", q: "She carried the Auger of Hess in a felt-lined case…" },
                ].map((m, i) => (
                  <div key={i} style={{ padding: 10, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 6, fontSize: 12 }}>
                    <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 4 }}>{m.ch}</div>
                    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-1)" }}>"{m.q}"</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// BESTIARY FIELD GUIDE -------------------------------------------------
// =====================================================================
const BestiaryFieldGuideWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = _wnSamples("bestiary");
  const fallback = [
    { id: "b-aw", name: "Auger Wake", threat: "Severe", habitat: "Salt flats", traits: ["Phase-shift", "Salt-call"] },
    { id: "b-sg", name: "Salt-ghost", threat: "Mild", habitat: "Pale Reach", traits: ["Cold", "Soundless"] },
    { id: "b-bo", name: "Bone Auger", threat: "Lethal", habitat: "Vraska Pass", traits: ["Carrion", "Iron-aversion"] },
  ];
  const data = items.length ? items : fallback;
  const [selectedId, setSelectedId] = _wn_us(data[0]?.id || null);
  const [tab, setTab] = _wn_us("encounters");
  const selected = data.find((x) => x.id === selectedId) || data[0];

  return (
    <WorkspaceShell
      icon="paw" entityType="bestiary"
      eyebrow="Bestiary" title="Bestiary Field Guide"
      subtitle="Creatures, monsters, fauna — habitats, abilities, and encounter notes."
      createLabel="Add creature"
      onCreate={() => onRequest.openEntityEditor({ type: "bestiary" })}
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={
        <>
          <div className="fws-section">
            <span className="fws-section__title">Creatures</span>
            <span className="fws-section__count">{data.length}</span>
          </div>
          <div className="fws-roster">
            {data.map((it) => (
              <WorkspaceRosterRow key={it.id}
                item={{ ...it, entityType: "bestiary" }}
                selected={selectedId === it.id}
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
      }
      main={
        selected ? (
          <>
            <WorkspaceCard title={selected.name} sub={"Threat: " + (selected.threat || "Unknown")}
              action={<button className="fws-section__action" onClick={() => onRequest.openEntityEditor({ type: "bestiary", initial: selected })}>Edit</button>}>
              <p style={{ margin: "0 0 12px", fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.6 }}>
                {selected.summary || "A pale ribbon of cold air that walks where it should not. Encountered most often on the salt flats north of Pale Reach. Disturbs the dreams of those who survive its passing."}
              </p>
              <WorkspaceKV rows={[
                { k: "Threat", v: selected.threat || "—" },
                { k: "Habitat", v: selected.habitat || "—" },
                { k: "Origin", v: selected.origin || "Unknown" },
                { k: "Weakness", v: (selected.weaknesses || ["Iron", "Salt-water"]).join(", ") },
              ]}/>
            </WorkspaceCard>

            <WorkspaceCard title="Abilities & traits">
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(selected.traits || ["Phase-shift", "Salt-call", "Cold breath"]).map((t, i) => (
                  <span key={i} className="fws-chip fws-chip--accent">{t}</span>
                ))}
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="Encounter timeline">
              {[
                { ch: "Ch.5", where: "Pale Reach", outcome: "2 watchhouse casualties + a goat" },
                { ch: "Ch.7", where: "Vraska Pass", outcome: "Glimpsed only" },
              ].map((row, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "60px 1fr 1fr", gap: 8, padding: "6px 8px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ color: "var(--ink-3)" }}>{row.ch}</span>
                  <span style={{ fontFamily: "var(--font-serif)" }}>{row.where}</span>
                  <span style={{ fontStyle: "italic", color: "var(--ink-2)" }}>{row.outcome}</span>
                </div>
              ))}
            </WorkspaceCard>
          </>
        ) : <div className="fws-empty">Select a creature.</div>
      }
      right={
        <>
          <WorkspaceTabs
            tabs={[
              { id: "encounters", label: "Encounters" },
              { id: "habitat", label: "Habitat" },
              { id: "review", label: "Review" },
              { id: "source", label: "Source" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "encounters" && ["Ch.5: Pale Reach", "Ch.7: Vraska Pass"].map((n, i) => (
              <div key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{n}</div>
            ))}
            {tab === "habitat" && (
              <button className="fws-topbar__exit" onClick={() => onRequest.openPanel("atlas")}>
                <Icon name="globe" size={11}/> Show habitat on Atlas →
              </button>
            )}
            {tab === "review" && (
              <div className="fws-empty" style={{ padding: 20 }}>No review items.</div>
            )}
            {tab === "source" && (
              <>
                {[
                  { ch: "Ch.5", q: "The Auger Wake came through here last week. Took two of mine, and a goat." },
                ].map((m, i) => (
                  <div key={i} style={{ padding: 10, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 6, fontSize: 12 }}>
                    <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 4 }}>{m.ch}</div>
                    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-1)" }}>"{m.q}"</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// QUEST LOG ------------------------------------------------------------
// =====================================================================
const QuestLogWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = _wnSamples("quests");
  const fallback = [
    { id: "q-aug", title: "The Auger of Hess", status: "active", subtitle: "Deliver the Auger to Pale Reach" },
    { id: "q-clo", title: "The Salt-bitten Cloak", status: "active", subtitle: "Unravel the mystery of Brec's silence" },
  ];
  const data = items.length ? items : fallback;
  const [selectedId, setSelectedId] = _wn_us(data[0]?.id || null);
  const [tab, setTab] = _wn_us("steps");
  const selected = data.find((x) => x.id === selectedId) || data[0];

  return (
    <WorkspaceShell
      icon="scroll" entityType="quests"
      eyebrow="Quests" title="Quest Log"
      subtitle="Goals, arcs, threads in motion — steps, branches, consequences."
      createLabel="Create quest"
      onCreate={() => onRequest.openEntityEditor({ type: "quests" })}
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={
        <>
          <div className="fws-section"><span className="fws-section__title">Quests</span><span className="fws-section__count">{data.length}</span></div>
          <div className="fws-roster">
            {data.map((q) => (
              <WorkspaceRosterRow key={q.id}
                item={{ ...q, entityType: "quests" }}
                selected={selectedId === q.id}
                onClick={() => setSelectedId(q.id)}
                onDragStart={() => {}}
                avatar="✦"
                name={q.title || q.name}
                sub={q.subtitle}
                meta={q.status}
              />
            ))}
          </div>
        </>
      }
      main={
        selected ? (
          <>
            <WorkspaceCard title={selected.title || selected.name} sub={selected.subtitle}
              action={<button className="fws-section__action" onClick={() => onRequest.openEntityEditor({ type: "quests", initial: selected })}>Edit</button>}>
              <p style={{ margin: "0 0 10px", fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.6 }}>
                {selected.summary || "Aelinor must deliver the Auger of Hess to Pale Reach before the next Wake. The route through Vraska Pass is no longer trustworthy."}
              </p>
              <WorkspaceKV rows={[
                { k: "Status", v: selected.status || "active" },
                { k: "Type", v: selected.questType || "Main" },
                { k: "Started", v: selected.startedAt || "Ch.1" },
                { k: "Target chapter", v: selected.targetChapter || "Ch.9" },
              ]}/>
            </WorkspaceCard>

            <WorkspaceCard title="Steps">
              {(selected.steps || [
                { i: 1, label: "Receive Brec's letter", done: true },
                { i: 2, label: "Travel to Pale Reach", done: true },
                { i: 3, label: "Present the Auger to Brec", done: false },
                { i: 4, label: "Survive what it asks of you", done: false },
              ]).map((s, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 4, fontSize: 12 }}>
                  <span style={{ width: 20, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{s.i}.</span>
                  <span style={{ flex: 1, fontFamily: "var(--font-serif)", textDecoration: s.done ? "line-through" : "none", color: s.done ? "var(--ink-3)" : "var(--ink-1)" }}>{s.label}</span>
                  {s.done && <span className="fws-chip fws-chip--ok">done</span>}
                </div>
              ))}
              <button className="fws-section__action" style={{ marginTop: 6 }}>+ Add step</button>
            </WorkspaceCard>

            <WorkspaceCard title="Branches & consequences">
              <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 12 }}>
                If the Auger is given to Brec: Pale Reach is spared. If withheld: the Wake takes it from her.
              </p>
            </WorkspaceCard>
          </>
        ) : <div className="fws-empty">Select a quest.</div>
      }
      right={
        <>
          <WorkspaceTabs
            tabs={[
              { id: "steps", label: "Participants" },
              { id: "items", label: "Items" },
              { id: "locations", label: "Locations" },
              { id: "events", label: "Events" },
              { id: "source", label: "Source" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "steps" && ["Aelinor Vey", "Captain Brec", "Saren of Hess"].map((n, i) => (
              <button key={i} className="fws-chip" onClick={() => onRequest.openPanel("cast")} style={{ marginRight: 4, marginBottom: 4 }}>{n}</button>
            ))}
            {tab === "items" && ["Auger of Hess", "Vraska Lantern"].map((n, i) => (
              <button key={i} className="fws-chip" onClick={() => onRequest.openPanel("items")} style={{ marginRight: 4, marginBottom: 4 }}>{n}</button>
            ))}
            {tab === "locations" && ["Pale Reach", "Vraska Pass", "Hess"].map((n, i) => (
              <button key={i} className="fws-chip" onClick={() => onRequest.openPanel("locations")} style={{ marginRight: 4, marginBottom: 4 }}>{n}</button>
            ))}
            {tab === "events" && ["The Auger Wake", "Brec's Letter Arrives"].map((n, i) => (
              <button key={i} className="fws-chip" onClick={() => onRequest.openPanel("events")} style={{ marginRight: 4, marginBottom: 4 }}>{n}</button>
            ))}
            {tab === "source" && (
              <div className="fws-empty" style={{ padding: 20 }}>No mentions linked yet.</div>
            )}
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// EVENT LEDGER ---------------------------------------------------------
// =====================================================================
const EventLedgerWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = _wnSamples("events");
  const fallback = [
    { id: "e-wake", title: "The Auger Wake", eventType: "Reveal", subtitle: "Pale Reach lost two watchhouse guards + a goat" },
    { id: "e-letter", title: "Brec's Letter Arrives", eventType: "Trigger", subtitle: "Pulls Aelinor north" },
  ];
  const data = items.length ? items : fallback;
  const [selectedId, setSelectedId] = _wn_us(data[0]?.id || null);
  const [tab, setTab] = _wn_us("consequence");
  const selected = data.find((x) => x.id === selectedId) || data[0];

  return (
    <WorkspaceShell
      icon="bolt" entityType="events"
      eyebrow="Events" title="Event Ledger"
      subtitle="Discrete things that happened — causes, outcomes, state changes."
      createLabel="Create event"
      onCreate={() => onRequest.openEntityEditor({ type: "events" })}
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={
        <>
          <div className="fws-section"><span className="fws-section__title">Ledger</span><span className="fws-section__count">{data.length}</span></div>
          <div className="fws-roster">
            {data.map((e) => (
              <WorkspaceRosterRow key={e.id}
                item={{ ...e, entityType: "events" }}
                selected={selectedId === e.id}
                onClick={() => setSelectedId(e.id)}
                onDragStart={() => {}}
                avatar="◉"
                name={e.title || e.name}
                sub={e.subtitle}
                meta={e.eventType}
              />
            ))}
          </div>
        </>
      }
      main={
        selected ? (
          <>
            <WorkspaceCard title={selected.title || selected.name} sub={selected.subtitle}
              action={<button className="fws-section__action" onClick={() => onRequest.openEntityEditor({ type: "events", initial: selected })}>Edit</button>}>
              <WorkspaceKV rows={[
                { k: "Type", v: selected.eventType || "—" },
                { k: "Chapter", v: selected.chapter || "Ch.5" },
                { k: "Location", v: <button className="fws-chip" onClick={() => onRequest.openPanel("locations")}>Pale Reach</button> },
                { k: "Participants", v: ["Aelinor Vey", "Captain Brec"].map((n, i) => <button key={i} className="fws-chip" style={{ marginRight: 4 }} onClick={() => onRequest.openPanel("cast")}>{n}</button>) },
              ]}/>
            </WorkspaceCard>

            <WorkspaceCard title="Cause · Outcome · Long-term consequence">
              <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, fontSize: 12 }}>
                <span style={{ color: "var(--ink-3)" }}>Cause</span>
                <span style={{ fontFamily: "var(--font-serif)" }}>{selected.cause || "Saren's Bargain (Ch.3)"}</span>
                <span style={{ color: "var(--ink-3)" }}>Outcome</span>
                <span style={{ fontFamily: "var(--font-serif)" }}>{selected.outcome || "Two killed at the watchhouse; a goat taken."}</span>
                <span style={{ color: "var(--ink-3)" }}>Long-term</span>
                <span style={{ fontFamily: "var(--font-serif)" }}>{selected.longTermConsequence || "Sets the chain that ends in the Vraska break."}</span>
              </div>
            </WorkspaceCard>

            <WorkspaceCard title="State changes" sub="Stats · Relationships · Items">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
                <div className="fws-card" style={{ padding: 10 }}>
                  <div className="fws-section__title" style={{ marginBottom: 6 }}>Stats</div>
                  <div className="fws-chip">Sleep −1 (Aelinor)</div>
                  <div className="fws-chip" style={{ marginLeft: 4 }}>Grief +1 (Brec)</div>
                </div>
                <div className="fws-card" style={{ padding: 10 }}>
                  <div className="fws-section__title" style={{ marginBottom: 6 }}>Relationships</div>
                  <div className="fws-chip">Brec ↑ Aelinor</div>
                </div>
                <div className="fws-card" style={{ padding: 10 }}>
                  <div className="fws-section__title" style={{ marginBottom: 6 }}>Items</div>
                  <div className="fws-chip">Auger → carried</div>
                </div>
              </div>
            </WorkspaceCard>
          </>
        ) : <div className="fws-empty">Select an event.</div>
      }
      right={
        <>
          <WorkspaceTabs
            tabs={[
              { id: "consequence", label: "Consequences" },
              { id: "timeline", label: "Timeline" },
              { id: "atlas", label: "Atlas" },
              { id: "review", label: "Review" },
              { id: "source", label: "Source" },
            ]}
            active={tab} onChange={setTab}
          />
          <div className="fws-tab-body">
            {tab === "consequence" && (
              <p style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 12 }}>
                The Wake breaks the Greycoat oath ("never lower the banner") — the canon shift propagates to factions.
              </p>
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
              <div className="fws-empty" style={{ padding: 20 }}>No review items.</div>
            )}
            {tab === "source" && (
              <div style={{ padding: 10, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", fontSize: 12 }}>
                <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 4 }}>Ch.5</div>
                <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-1)" }}>"The Auger Wake came through here last week. Took two of mine, and a goat."</div>
              </div>
            )}
          </div>
        </>
      }
    />
  );
};

// =====================================================================
// TIMELINE WORKSPACE ---------------------------------------------------
// =====================================================================
const TimelineWorkspaceFs = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const tracks = [
    { id: "book", label: "Book order" },
    { id: "chrono", label: "Chronological" },
    { id: "char", label: "Per character" },
    { id: "loc", label: "Per location" },
    { id: "quest", label: "Per quest" },
    { id: "faction", label: "Per faction" },
    { id: "rel", label: "Per relationship" },
    { id: "item", label: "Per item" },
  ];
  const [track, setTrack] = _wn_us("book");

  const events = [
    { x: 0.05, ch: "Ch.1", label: "The Hollow Crown",     type: "Scene" },
    { x: 0.2,  ch: "Ch.2", label: "Pale Reach",            type: "Arrival" },
    { x: 0.32, ch: "Ch.3", label: "Saren's Bargain",       type: "Reveal" },
    { x: 0.46, ch: "Ch.4", label: "The Auger Wake",        type: "Disaster" },
    { x: 0.6,  ch: "Ch.5", label: "Brec's Letter",         type: "Trigger" },
    { x: 0.72, ch: "Ch.6", label: "Ash & Auger",           type: "Travel" },
    { x: 0.86, ch: "Ch.7", label: "The Auger's Door",      type: "Climax" },
  ];

  return (
    <WorkspaceShell
      icon="clock" entityType="timeline"
      eyebrow="Timeline" title="Timeline Workspace"
      subtitle="Time, ordered every way. Cycle the track to see the same events from different angles."
      createLabel="Add timeline event"
      onCreate={() => onRequest.openEntityEditor({ type: "events" })}
      onExit={onExit} cols="c"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      bottom={
        <>
          <span style={{ fontFamily: "var(--font-mono)" }}>Track:</span>
          {tracks.map((t) => (
            <button key={t.id}
              className={"fws-filter " + (track === t.id ? "is-on" : "")}
              onClick={() => setTrack(t.id)}>{t.label}</button>
          ))}
        </>
      }
      main={
        <>
          <WorkspaceCard title={"Timeline · " + (tracks.find((t) => t.id === track)?.label || "Book order")}>
            <div style={{ position: "relative", height: 220, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-3)", padding: "30px 20px" }}>
              <div style={{ position: "absolute", left: 24, right: 24, top: "50%", height: 2, background: "var(--line-strong)" }}/>
              {events.map((e, i) => (
                <div key={i} style={{ position: "absolute", left: `calc(24px + (100% - 48px) * ${e.x})`, top: "50%", transform: "translate(-50%, -50%)" }}>
                  <button className="fws-card" style={{ padding: "6px 8px", maxWidth: 140, textAlign: "left", cursor: "grab" }}
                    draggable
                    onDragStart={(ev) => { try { ev.dataTransfer.setData("text/loomwright-entity", JSON.stringify({ entityType: "events", id: e.label, name: e.label })); } catch (_) {} }}
                    onClick={() => onRequest.openPanel("events")}>
                    <div style={{ fontSize: 9, color: "var(--ink-3)", fontFamily: "var(--font-mono)" }}>{e.ch} · {e.type}</div>
                    <div style={{ fontFamily: "var(--font-serif)", fontSize: 12, color: "var(--ink-1)" }}>{e.label}</div>
                  </button>
                </div>
              ))}
            </div>
          </WorkspaceCard>
          <WorkspaceCard title="Review queue" sub="Events that need a chapter or order">
            <div className="fws-empty" style={{ padding: 14 }}>No review items.</div>
          </WorkspaceCard>
        </>
      }
    />
  );
};

// =====================================================================
// CANON VAULT (Lore) ---------------------------------------------------
// =====================================================================
const CanonVaultWorkspace = ({ workspace, onExit, onRequest, dragTargetVisible, toast, onDismissToast }) => {
  const items = _wnSamples("lore");
  const fallback = [
    { id: "l-1", title: "Greycoats lower no banner",    canon: "hard", subtitle: "Was true in Bk I. Broken in Ch.4." },
    { id: "l-2", title: "Augers attune to the bearer",  canon: "hard", subtitle: "Reaffirmed multiple chapters." },
    { id: "l-3", title: "Salt walks where it should not", canon: "soft", subtitle: "Pale-Reach folklore." },
  ];
  const data = items.length ? items : fallback;
  const [selectedId, setSelectedId] = _wn_us(data[0]?.id || null);
  const [tab, setTab] = _wn_us("contradictions");
  const selected = data.find((x) => x.id === selectedId) || data[0];

  return (
    <WorkspaceShell
      icon="book" entityType="lore"
      eyebrow="Lore / Canon" title="Canon Vault"
      subtitle="World rules, hard/soft canon, contradictions, and the AI instructions that protect them."
      createLabel="Add canon fact"
      onCreate={() => onRequest.openEntityEditor({ type: "lore" })}
      onExit={onExit} cols="lcr"
      dragTargetVisible={dragTargetVisible} toast={toast} onDismissToast={onDismissToast}
      left={
        <>
          <div className="fws-section"><span className="fws-section__title">Canon facts</span><span className="fws-section__count">{data.length}</span></div>
          <div className="fws-roster">
            {data.map((f) => (
              <WorkspaceRosterRow key={f.id}
                item={{ ...f, entityType: "lore" }}
                selected={selectedId === f.id}
                onClick={() => setSelectedId(f.id)}
                avatar={f.canon === "hard" ? "H" : "S"}
                name={f.title || f.name}
                sub={f.subtitle}
                meta={f.canon}
                badges={f.contradicted && <span className="fws-chip fws-chip--warn">!</span>}
              />
            ))}
          </div>
        </>
      }
      main={
        selected ? (
          <>
            <WorkspaceCard title={selected.title || selected.name}
              sub={(selected.canon || "soft") + " canon"}
              action={<button className="fws-section__action" onClick={() => onRequest.openEntityEditor({ type: "lore", initial: selected })}>Edit</button>}>
              <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontSize: 14, color: "var(--ink-1)", lineHeight: 1.6 }}>
                {selected.summary || "A standing rule in this world. Edit to refine, add evidence, or downgrade to soft."}
              </p>
            </WorkspaceCard>
            <WorkspaceCard title="Evidence">
              {[
                { ch: "Bk I, Ch.12", q: "The Coats keep their banner aloft until the second of two suns falls." },
                { ch: "Ch.4", q: "The Grey Coats had left only the one banner." },
              ].map((m, i) => (
                <div key={i} style={{ padding: 10, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 6, fontSize: 12 }}>
                  <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 4 }}>{m.ch}</div>
                  <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-1)" }}>"{m.q}"</div>
                </div>
              ))}
            </WorkspaceCard>
            <WorkspaceCard title="AI guidance">
              <p style={{ margin: 0, fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-2)", fontSize: 12 }}>
                Treat this as soft canon when generating; flag any draft text that contradicts it.
              </p>
            </WorkspaceCard>
          </>
        ) : <div className="fws-empty">Select a canon fact.</div>
      }
      right={
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
              <div className="fws-chip fws-chip--warn">Ch.4 breaks Bk I, Ch.12 rule on banner.</div>
            )}
            {tab === "terms" && ["Auger", "Wake", "Reach", "Vraska"].map((n, i) => <span key={i} className="fws-chip" style={{ marginRight: 4, marginBottom: 4 }}>{n}</span>)}
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
      }
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

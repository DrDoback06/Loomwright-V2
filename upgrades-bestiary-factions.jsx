// =====================================================================
// upgrades-bestiary-factions.jsx — Bestiary + Factions bespoke panels
// =====================================================================

const { useState: _bf_us, useMemo: _bf_um, useCallback: _bf_uc } = React;

// ---------------------------------------------------------------------
// Bestiary data
// ---------------------------------------------------------------------
const BESTIARY_DATA = [
  {
    id: "b1", type: "bestiary", name: "Salt-wraith", glyphChar: "Sw",
    subtitle: "Wind-borne predator of the Reach",
    summary: "A pale, ribbon-bodied predator that rides salt squalls down off the Auger Cliffs. Cannot cross a poured circle of salt — established hard canon.",
    species: "Wraith-kind", habitat: "Salt-cold littoral",
    behaviour: "Solitary; opportunistic. Hunts at low tide.",
    threat: 4, // 1-5 scale
    diet: "Carrion, gulls, occasional unwarded watcher",
    chapterRange: "Ch. 2, 5, 6",
    mentionsByChapter: [0, 4, 2, 0, 3, 6, 0, 0, 0, 0, 0, 0],
    abilities: [
      "Rides salt-storms at speed",
      "Cools the air four paces around itself",
      "Voice mimicry — calls in a familiar's pitch",
    ],
    weaknesses: [
      "A circle of poured salt cannot be crossed",
      "Iron edged with cliff-salt scores them",
      "Direct sun for more than a watch dissolves the ribbon body",
    ],
    locations: [
      { id: "a1", type: "locations", label: "Pale Reach Hold" },
      { id: "loc-auger-cliffs", type: "locations", label: "Auger Cliffs" },
    ],
    factions: [],
    encounters: [
      { id: "be1", chapter: "Ch. 2", location: "Pale Reach Hold (outer wall)", outcome: "Two watchers taken; storm broke open the wall.", cite: "Ch. 2, p. 41" },
      { id: "be2", chapter: "Ch. 5", location: "Brittlewood edge",            outcome: "Glimpsed; not engaged.",                          cite: "Ch. 5, p. 130" },
      { id: "be3", chapter: "Ch. 6", location: "Auger Cliffs",                outcome: "Circle of salt held; Aelinor unharmed.",          cite: "Ch. 6, p. 168" },
    ],
    quests: [],
    events: [{ id: "e2", type: "events", label: "First salt-storm" }],
    lore: [
      "Hard canon: cannot cross poured salt.",
      "Hard canon: have no eyes — never give them eyes.",
    ],
    sourceMentions: [
      { id: "m1", excerpt: "It came in on the salt — a long pale thing the gulls would not call to.", cite: "Ch. 2, p. 41" },
    ],
    queue: 1,
    contradictions: [],
  },
  {
    id: "b2", type: "bestiary", name: "Vraska boar", glyphChar: "Vb",
    subtitle: "Pass-dwelling tusker",
    summary: "Reclusive winter boar of the Vraska Pass. Solitary; tracks erratically.",
    species: "Beast", habitat: "Vraska Pass · upper line",
    behaviour: "Reclusive. Aggressive only when cornered.",
    threat: 2, diet: "Roots, bark, the occasional traveller's pack",
    chapterRange: "Ch. 4",
    mentionsByChapter: [0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0],
    abilities: ["Burrow into snow-walls", "Tracks the road by salt-smell"],
    weaknesses: ["Open ground", "Lance reach"],
    locations: [{ id: "a2", type: "locations", label: "Vraska Pass" }],
    factions: [],
    encounters: [{ id: "be4", chapter: "Ch. 4", location: "Vraska Pass", outcome: "Glimpsed; not engaged.", cite: "Ch. 4, p. 96" }],
    quests: [], events: [],
    lore: [], sourceMentions: [], contradictions: [],
  },
  {
    id: "b3", type: "bestiary", name: "Hess gull", glyphChar: "Hg",
    subtitle: "Common shore gull",
    summary: "Plentiful background fauna. The salt-wraiths will not call to them.",
    species: "Bird", habitat: "Coastal",
    behaviour: "Sociable", threat: 1, diet: "Fish, refuse",
    chapterRange: "Ch. 1–7",
    mentionsByChapter: [3,2,1,2,1,4,2,0,0,0,0,0],
    abilities: ["Loud"], weaknesses: ["Salt-wraith presence (silenced)"],
    locations: [{ id: "a1", type: "locations", label: "Pale Reach Hold" }],
    factions: [], encounters: [], quests: [], events: [],
    lore: [], sourceMentions: [], contradictions: [],
  },
  {
    id: "b4", type: "bestiary", name: "Hess wolfhound", glyphChar: "Wh",
    subtitle: "Grey hound at the Court door",
    summary: "Grey hound at the Glass Court door — Hess-trained, by the look of the collar. Provenance unclear.",
    species: "Canid", habitat: "Glass Court",
    behaviour: "Patient. Posted.", threat: 2, diet: "Trained",
    chapterRange: "Ch. 3",
    mentionsByChapter: [0,0,1,0,0,0,0,0,0,0,0,0],
    abilities: ["Tracks by silver"],
    weaknesses: [],
    locations: [{ id: "a3", type: "locations", label: "Glass Court" }],
    factions: [{ id: "f2", type: "factions", label: "House Hess" }],
    encounters: [], quests: [{ id: "q5", type: "quests", label: "Track of the wolfhound" }], events: [],
    lore: [], sourceMentions: [{ id: "m2", excerpt: "A grey hound at the door of the Glass Court — Hess-trained.", cite: "Ch. 3, p. 76" }],
    contradictions: [],
    queue: 1,
  },
];


// ---------------------------------------------------------------------
// BestiaryDetail
// ---------------------------------------------------------------------
const ThreatBar = ({ level }) => {
  return (
    <div className="bes-threat" data-ui="ThreatBar">
      <span style={{ fontFamily: "var(--font-sans)", fontSize: "var(--fs-2xs)", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--ink-4)" }}>Threat</span>
      <div className="bes-threat__bar">
        {[1,2,3,4,5].map((i) => (
          <div key={i} className={"bes-threat__pip" + (i <= level ? " is-on" : "")}/>
        ))}
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "var(--ink-1)" }}>{level}/5</span>
    </div>
  );
};

const BestiaryDetail = ({ entity, onSelectEntity, onOpenSourceMention, onOpenRelatedTab }) => {
  const e = entity || {};
  return (
    <div className="rpg-detail bes-detail" data-ui="BestiaryDetail">
      <RpgFacets items={[
        { k: "Species",  v: e.species || "—" },
        { k: "Habitat",  v: e.habitat || "—" },
        { k: "Behaviour",v: e.behaviour || "—" },
        e.diet ? { k: "Diet", v: e.diet } : null,
      ]}/>

      <ThreatBar level={e.threat || 1}/>

      {e.summary && (
        <RpgSection title="Description">
          <p className="rpg-prose">{e.summary}</p>
        </RpgSection>
      )}

      {(e.abilities || []).length > 0 && (
        <RpgSection title="Abilities">
          <ul className="bes-abilities">{e.abilities.map((a, i) => <li key={i}>{a}</li>)}</ul>
        </RpgSection>
      )}

      {(e.weaknesses || []).length > 0 && (
        <RpgSection title="Weaknesses">
          <ul className="bes-weaknesses">{e.weaknesses.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </RpgSection>
      )}

      {(e.locations || []).length > 0 && (
        <RpgSection title="Related locations"
                    action={{ label: "Show on Atlas →", callback: "onOpenBestiaryOnAtlas" }}>
          <RpgChipRow items={e.locations} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.factions || []).length > 0 && (
        <RpgSection title="Related factions">
          <RpgChipRow items={e.factions} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.encounters || []).length > 0 && (
        <RpgSection title="Encounters">
          <ul className="rpg-history">
            {e.encounters.map((en) => (
              <li key={en.id} className="rpg-history__row rpg-history__row--event">
                <span className="rpg-history__chap">{en.chapter}</span>
                <span className="rpg-history__what"><b>{en.location}</b> — {en.outcome}</span>
                {en.cite && <button className="rpg-history__cite" data-callback="onOpenBestiarySourceMention" onClick={() => onOpenSourceMention && onOpenSourceMention(en)}>{en.cite}</button>}
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      {(e.quests || []).length > 0 && (
        <RpgSection title="Related quests">
          <RpgChipRow items={e.quests} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.events || []).length > 0 && (
        <RpgSection title="Related events">
          <RpgChipRow items={e.events} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.lore || []).length > 0 && (
        <RpgSection title="Lore / canon facts">
          <ul className="rpg-bullets">{e.lore.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </RpgSection>
      )}

      {(e.mentionsByChapter || []).length > 0 && (
        <RpgSection title="Mentions by chapter">
          <RpgChapterSpark mentions={e.mentionsByChapter}/>
        </RpgSection>
      )}

      {(e.sourceMentions || []).length > 0 && (
        <RpgSection title="Source mentions">
          <ul className="loc-mentions">
            {e.sourceMentions.map((m) => (
              <li key={m.id} className="loc-mention">
                <button className="loc-mention__cite" data-callback="onOpenBestiarySourceMention" onClick={() => onOpenSourceMention && onOpenSourceMention(m)}>{m.cite}</button>
                <span className="loc-mention__quote">"{m.excerpt}"</span>
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      <div className="rpg-actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onCreateBestiaryEntry">+ Add creature</button>
        <button className="rpg-btn" data-callback="onAssignBestiaryHabitat">Assign habitat</button>
        <button className="rpg-btn" data-callback="onLinkBestiaryLocation">+ Location</button>
        <button className="rpg-btn" data-callback="onLinkRaceBestiary">Link race</button>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onOpenBestiaryOnAtlas">Show on Atlas</button>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onEditBestiaryEntry">Edit</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// BestiaryPanelBody
// ---------------------------------------------------------------------
const BestiaryPanelBody = ({ panel, panelContext, onSelectEntity }) => {
  const [selectedId, setSelectedId] = _bf_us(panel?.selected?.id || "b1");
  // Follow host-driven selection (locked entities, lw:focus-entity).
  React.useEffect(() => { if (panel?.selected?.id) setSelectedId(panel.selected.id); }, [panel?.selected?.id]);
  const [search, setSearch] = _bf_us("");
  // Live bestiary entries only — never the demo BESTIARY_DATA.
  const _src = (window.LoomwrightBackend?.EntityService?.listSync("bestiary")) || [];
  const filtered = _src.filter((b) => !search || (b.name || "").toLowerCase().includes(search.toLowerCase()));
  const selected = filtered.find((b) => b.id === selectedId) || null;

  return (
    <div className="loc-body" data-ui="BestiaryPanelBody">
      <div className="loc-body__top">
        <div className="loc-body__search">
          <Icon name="search" size={11}/>
          <input value={search} placeholder="Search bestiary…" onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <div className="loc-body__filters">
          <Btn variant="ghost" size="sm" icon="plus" data-callback="onCreateBestiaryEntry" title="Add creature"/>
          <Btn variant="ghost" size="sm" icon="bell" data-callback="onOpenBestiaryReviewQueue" title="Review queue"/>
        </div>
      </div>

      <div className="loc-body__split">
        <aside className="loc-body__tree">
          <div className="loc-body__tree-head">
            <span>Catalogue</span>
            <span className="loc-body__tree-count">{filtered.length}</span>
          </div>
          <div className="loc-tree">
            {filtered.map((b) => (
              <div key={b.id}
                   className={"loc-tree__row" + (b.id === selectedId ? " is-selected" : "")}
                   onClick={() => { setSelectedId(b.id); onSelectEntity && onSelectEntity({ id: b.id, type: "bestiary", label: b.name }); }}>
                <span className="loc-tree__glyph" style={{ color: "var(--ec, #a8553f)" }}>✦</span>
                <span className="loc-tree__name">{b.name}</span>
                {(b.queue || 0) > 0 && <span className="loc-tree__queue">{b.queue}</span>}
              </div>
            ))}
          </div>
        </aside>

        <section className="loc-body__detail">
          {selected ? (
            <>
              <div className="loc-body__detail-head">
                <div>
                  <div className="loc-body__detail-eyebrow">Bestiary · {selected.species || "—"}</div>
                  <div className="loc-body__detail-title">{selected.name}</div>
                </div>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
                <BestiaryDetail
                  entity={selected}
                  onSelectEntity={onSelectEntity}
                  onOpenSourceMention={() => {}}
                  onOpenRelatedTab={onSelectEntity}
                />
              </div>
            </>
          ) : <EmptyState icon="claw" title="No creature" body="Pick a bestiary entry."/>}
        </section>
      </div>
    </div>
  );
};

// =====================================================================
// Factions
// =====================================================================
const FACTIONS_DATA = [
  {
    id: "f1", type: "factions", name: "House Vey", glyphChar: "Hv",
    subtitle: "Reigning house of the Pale Reach",
    summary: "Old salt-coast house; protagonist's seat. In tension with Hess.",
    facType: "House", ideology: "Stewardship; the cold endures.",
    goals: "Hold the Reach. Keep the Auger uncompromised.",
    chapterRange: "Ch. 1–7", queue: 1,
    mentionsByChapter: [4,2,1,2,1,3,3,0,0,0,0,0],
    leaders: [
      { id: "c1", type: "cast", label: "Aelinor Vey", role: "Auger-keeper" },
    ],
    members: [
      { id: "c1", type: "cast", label: "Aelinor Vey" },
      { id: "c3", type: "cast", label: "Captain Brec" },
      { id: "c6", type: "cast", label: "Dav the Quiet" },
    ],
    territory: [
      { id: "loc-reach-region", type: "locations", label: "The Pale Reach" },
      { id: "a1", type: "locations", label: "Pale Reach Hold" },
      { id: "loc-vey-hall", type: "locations", label: "Vey Hall" },
    ],
    controlledLocations: [
      { id: "a1", type: "locations", label: "Pale Reach Hold" },
      { id: "sw", type: "locations", label: "Salt Watch" },
    ],
    resources: ["Bone Auger (heirloom)", "Reach granary"],
    quests: [{ id: "q1", type: "quests", label: "The Auger Wake" }],
    events: [{ id: "e1", type: "events", label: "Hess negotiation break" }],
    relationships: [
      { id: "fr1", with: { id: "f2", label: "House Hess" }, kind: "enemy",  note: "Negotiation broke Ch. 7." },
      { id: "fr2", with: { id: "f3", label: "Glass Court" }, kind: "rival", note: "Through Hess." },
    ],
    timeline: [
      { chapter: "Ch. 1", what: "Aelinor inherits Auger." },
      { chapter: "Ch. 4", what: "Salt-storm batters the Hold; Vey watchers killed." },
      { chapter: "Ch. 7", what: "Hess audience breaks." },
    ],
    lore: ["House Vey's banner was 'never lowered' — contradicted Ch. 7 of Bk II."],
    sourceMentions: [{ id: "m1", excerpt: "The Vey hall smelled of pitch and coriander.", cite: "Ch. 7, p. 187" }],
  },
  {
    id: "f2", type: "factions", name: "House Hess", glyphChar: "Hh",
    subtitle: "Rival mercantile house",
    summary: "Inland mercantile house. Holds the Glass Court audience right.",
    facType: "House", ideology: "Audit; the ledger remembers.",
    goals: "Secure the Auger as bond; expand witness rights into the Reach.",
    chapterRange: "Ch. 3–7",
    mentionsByChapter: [0,0,3,1,1,1,3,0,0,0,0,0],
    leaders: [{ id: "c2", type: "cast", label: "Saren of Hess", role: "First voice" }],
    members: [
      { id: "c2", type: "cast", label: "Saren of Hess" },
      { id: "c5", type: "cast", label: "Mara of Hess" },
    ],
    territory: [
      { id: "loc-hess-region", type: "locations", label: "Hessmark" },
      { id: "a3", type: "locations", label: "Glass Court" },
      { id: "loc-hess-archive", type: "locations", label: "Hess Archive" },
    ],
    controlledLocations: [
      { id: "a3", type: "locations", label: "Glass Court" },
    ],
    resources: ["Glass Throne (audience right)", "Hess Archive"],
    quests: [{ id: "q3", type: "quests", label: "The Hess negotiation" }],
    events: [{ id: "e1", type: "events", label: "Hess negotiation break" }],
    relationships: [
      { id: "fr3", with: { id: "f1", label: "House Vey" }, kind: "enemy", note: "Negotiation broke Ch. 7." },
      { id: "fr4", with: { id: "f3", label: "Glass Court" }, kind: "ally", note: "Hess controls audience right." },
    ],
    timeline: [
      { chapter: "Ch. 3", what: "Saren opens audience." },
      { chapter: "Ch. 6", what: "Auger Stone given (Saren's gift)." },
      { chapter: "Ch. 7", what: "Negotiation breaks." },
    ],
    lore: ["Glass Throne audiences last exactly three days."],
    sourceMentions: [],
  },
  {
    id: "f3", type: "factions", name: "Glass Court", glyphChar: "Gc",
    subtitle: "Audience institution of Hess",
    summary: "The audience institution of Hess; the Court runs three-day hearings under the Glass Throne.",
    facType: "Institution", ideology: "Audience and witness.",
    goals: "Preserve the three-day rule.",
    chapterRange: "Ch. 3–7",
    mentionsByChapter: [0,0,3,1,0,1,4,0,0,0,0,0],
    leaders: [], members: [],
    territory: [{ id: "a3", type: "locations", label: "Glass Court" }],
    controlledLocations: [{ id: "a3", type: "locations", label: "Glass Court" }],
    resources: ["Glass Throne"],
    quests: [], events: [],
    relationships: [
      { id: "fr5", with: { id: "f2", label: "House Hess" }, kind: "ally", note: "Hess controls the Throne." },
    ],
    timeline: [],
    lore: ["Glass Throne audiences last exactly three days."],
    sourceMentions: [],
  },
];


// ---------------------------------------------------------------------
// FactionDetail
// ---------------------------------------------------------------------
const FactionLeaderCard = ({ leader }) => {
  const initials = (leader.label || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="fac-leader" data-ui="FactionLeaderCard">
      <div className="fac-leader__avatar">{initials}</div>
      <div className="fac-leader__name">{leader.label}</div>
      <div className="fac-leader__role">{leader.role || "Leader"}</div>
    </div>
  );
};

const FactionRelGraph = ({ rels }) => {
  // Tiny inline graph — just the visual stand-in
  return (
    <div className="fac-relgraph">
      <svg viewBox="0 0 320 160" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="fac-arrow" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 z" fill="var(--ink-3)"/>
          </marker>
        </defs>
        <circle cx="160" cy="80" r="36" fill="var(--accent-soft)" stroke="var(--accent-deep)" strokeWidth="2"/>
        <text x="160" y="84" fontSize="11" fontFamily="var(--font-display)" fill="var(--ink-1)" textAnchor="middle">SELF</text>
        {rels.slice(0, 6).map((r, i) => {
          const angle = (i / Math.max(1, rels.length)) * Math.PI * 2 - Math.PI / 2;
          const cx = 160 + Math.cos(angle) * 110;
          const cy = 80  + Math.sin(angle) * 60;
          const stroke = r.kind === "ally" ? "#5d7d4e" : r.kind === "enemy" ? "#a8553f" : r.kind === "rival" ? "#c79545" : "var(--ink-3)";
          return (
            <g key={r.id}>
              <line x1="160" y1="80" x2={cx} y2={cy} stroke={stroke} strokeWidth="1.6" markerEnd="url(#fac-arrow)"/>
              <circle cx={cx} cy={cy} r="22" fill="var(--bg-paper)" stroke={stroke} strokeWidth="1.5"/>
              <text x={cx} y={cy + 3} fontSize="9" fontFamily="var(--font-serif)" fill="var(--ink-1)" textAnchor="middle">
                {(r.with.label || "").split(" ").slice(0, 2).join(" ")}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const FactionDetail = ({ entity, onSelectEntity, onOpenSourceMention, onOpenRelatedTab }) => {
  const e = entity || {};
  return (
    <div className="rpg-detail fac-detail" data-ui="FactionDetail">
      <RpgFacets items={[
        { k: "Type",    v: e.facType || "Faction" },
        { k: "Members", v: (e.members || []).length },
        { k: "Leaders", v: (e.leaders || []).length },
        { k: "Territory", v: (e.territory || []).length },
      ]}/>

      {e.summary && (
        <RpgSection title="Overview">
          <p className="rpg-prose">{e.summary}</p>
        </RpgSection>
      )}

      {e.ideology && (
        <RpgSection title="Ideology">
          <p className="rpg-prose" style={{ fontStyle: "italic" }}>{e.ideology}</p>
        </RpgSection>
      )}

      {e.goals && (
        <RpgSection title="Goals">
          <p className="rpg-prose">{e.goals}</p>
        </RpgSection>
      )}

      {(e.leaders || []).length > 0 && (
        <RpgSection title="Leaders"
                    action={{ label: "+ Assign leader", callback: "onAssignFactionLeader" }}>
          <div className="fac-leaders">
            {e.leaders.map((l) => <FactionLeaderCard key={l.id} leader={l}/>)}
          </div>
        </RpgSection>
      )}

      {(e.members || []).length > 0 && (
        <RpgSection title="Members"
                    action={{ label: "+ Assign member", callback: "onAssignFactionMember" }}>
          <RpgChipRow items={e.members} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.territory || []).length > 0 && (
        <RpgSection title="Territory"
                    action={{ label: "Show on Atlas →", callback: "onOpenFactionOnAtlas" }}>
          <RpgChipRow items={e.territory} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.controlledLocations || []).length > 0 && (
        <RpgSection title="Controlled locations">
          <RpgChipRow items={e.controlledLocations} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.relationships || []).length > 0 && (
        <RpgSection title="Relationship graph"
                    action={{ label: "Open Relationships →", callback: "onOpenFactionRelationships" }}>
          <FactionRelGraph rels={e.relationships}/>
          <ul className="fac-rel-list" style={{ marginTop: 8 }}>
            {e.relationships.map((r) => (
              <li key={r.id} className={"fac-rel-list__row fac-rel-list__row--" + r.kind}>
                <span className="fac-rel-list__kind">{r.kind}</span>
                <span className="fac-rel-list__name">{r.with.label}</span>
                <span className="fac-rel-list__note">{r.note}</span>
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      {(e.resources || []).length > 0 && (
        <RpgSection title="Resources">
          <ul className="rpg-bullets">{e.resources.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </RpgSection>
      )}

      {(e.quests || []).length > 0 && (
        <RpgSection title="Related quests">
          <RpgChipRow items={e.quests} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.events || []).length > 0 && (
        <RpgSection title="Related events"
                    action={{ label: "Open Timeline →", callback: "onOpenFactionTimeline" }}>
          <RpgChipRow items={e.events} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.timeline || []).length > 0 && (
        <RpgSection title="Faction timeline">
          <ul className="rpg-history">
            {e.timeline.map((t, i) => (
              <li key={i} className="rpg-history__row">
                <span className="rpg-history__chap">{t.chapter}</span>
                <span className="rpg-history__what">{t.what}</span>
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      {(e.lore || []).length > 0 && (
        <RpgSection title="Lore / canon">
          <ul className="rpg-bullets">{e.lore.map((l, i) => <li key={i}>{l}</li>)}</ul>
        </RpgSection>
      )}

      {(e.mentionsByChapter || []).length > 0 && (
        <RpgSection title="Mentions by chapter">
          <RpgChapterSpark mentions={e.mentionsByChapter}/>
        </RpgSection>
      )}

      <div className="rpg-actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onCreateFaction">+ Create faction</button>
        <button className="rpg-btn" data-callback="onAssignFactionLeader">+ Leader</button>
        <button className="rpg-btn" data-callback="onAssignFactionMember">+ Member</button>
        <button className="rpg-btn" data-callback="onAssignFactionTerritory">+ Territory</button>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onOpenFactionOnAtlas">Show on Atlas</button>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onOpenFactionRelationships">Relationships</button>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onOpenFactionTimeline">Timeline</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// FactionsPanelBody
// ---------------------------------------------------------------------
const FactionsPanelBody = ({ panel, panelContext, onSelectEntity }) => {
  const [selectedId, setSelectedId] = _bf_us(panel?.selected?.id || "f1");
  // Follow host-driven selection (locked entities, lw:focus-entity).
  React.useEffect(() => { if (panel?.selected?.id) setSelectedId(panel.selected.id); }, [panel?.selected?.id]);
  const [search, setSearch] = _bf_us("");
  const _src = (window.LoomwrightBackend?.EntityService?.listSync("factions")) || [];
  const filtered = _src.filter((f) => !search || (f.name || "").toLowerCase().includes(search.toLowerCase()));
  const selected = filtered.find((f) => f.id === selectedId) || null;

  return (
    <div className="loc-body" data-ui="FactionsPanelBody">
      <div className="loc-body__top">
        <div className="loc-body__search">
          <Icon name="search" size={11}/>
          <input value={search} placeholder="Search factions…" onChange={(e) => setSearch(e.target.value)}/>
        </div>
        <div className="loc-body__filters">
          <Btn variant="ghost" size="sm" icon="plus" data-callback="onCreateFaction" title="Create faction"/>
          <Btn variant="ghost" size="sm" icon="bell" data-callback="onOpenFactionsReviewQueue" title="Review queue"/>
        </div>
      </div>

      <div className="loc-body__split">
        <aside className="loc-body__tree">
          <div className="loc-body__tree-head">
            <span>Factions</span>
            <span className="loc-body__tree-count">{filtered.length}</span>
          </div>
          <div className="loc-tree">
            {filtered.map((f) => (
              <div key={f.id}
                   className={"loc-tree__row" + (f.id === selectedId ? " is-selected" : "")}
                   onClick={() => { setSelectedId(f.id); onSelectEntity && onSelectEntity({ id: f.id, type: "factions", label: f.name }); }}>
                <span className="loc-tree__glyph" style={{ color: "var(--ec, #3d3a78)" }}>▣</span>
                <span className="loc-tree__name">{f.name}</span>
                {(f.queue || 0) > 0 && <span className="loc-tree__queue">{f.queue}</span>}
                <span className="loc-tree__children">{(f.members || []).length}m</span>
              </div>
            ))}
          </div>
        </aside>

        <section className="loc-body__detail">
          {selected ? (
            <>
              <div className="loc-body__detail-head">
                <div>
                  <div className="loc-body__detail-eyebrow">Faction · {selected.facType || "—"}</div>
                  <div className="loc-body__detail-title">{selected.name}</div>
                </div>
              </div>
              <div style={{ overflowY: "auto", flex: 1, padding: 12 }}>
                <FactionDetail
                  entity={selected}
                  onSelectEntity={onSelectEntity}
                  onOpenSourceMention={() => {}}
                  onOpenRelatedTab={onSelectEntity}
                />
              </div>
            </>
          ) : <EmptyState icon="banner" title="No faction" body="Pick a faction to inspect."/>}
        </section>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Register
// ---------------------------------------------------------------------
window.BESTIARY_DATA = BESTIARY_DATA;
window.FACTIONS_DATA = FACTIONS_DATA;

window.ENTITY_SAMPLES = window.ENTITY_SAMPLES || {};

window.RPG_DETAIL_RENDERERS = window.RPG_DETAIL_RENDERERS || {};
window.RPG_DETAIL_RENDERERS.bestiary = (entity, ctx) => <BestiaryDetail entity={entity} {...ctx}/>;
window.RPG_DETAIL_RENDERERS.factions = (entity, ctx) => <FactionDetail  entity={entity} {...ctx}/>;

window.RPG_FILTERS = window.RPG_FILTERS || {};
window.RPG_FILTERS.bestiary = [
  { key: "threat:1", label: "Threat 1" },
  { key: "threat:2", label: "Threat 2" },
  { key: "threat:3", label: "Threat 3" },
  { key: "threat:4", label: "Threat 4" },
  { key: "threat:5", label: "Threat 5" },
  { key: "habitat:reach", label: "Habitat: Reach" },
  { key: "habitat:pass",  label: "Habitat: Pass" },
  { key: "queue:any", label: "Has review" },
];
window.RPG_FILTERS.factions = [
  { key: "type:house",      label: "Type: House" },
  { key: "type:institution",label: "Type: Institution" },
  { key: "type:guild",      label: "Type: Guild" },
  { key: "ally:any",        label: "Has allies" },
  { key: "enemy:any",       label: "Has enemies" },
  { key: "queue:any",       label: "Has review" },
];

Object.assign(window, {
  BestiaryDetail, BestiaryPanelBody, ThreatBar,
  FactionDetail, FactionsPanelBody, FactionLeaderCard, FactionRelGraph,
});

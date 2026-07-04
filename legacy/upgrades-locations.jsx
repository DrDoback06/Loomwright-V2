// =====================================================================
// upgrades-locations.jsx — Locations panel upgrade
//
// Replaces the generic Locations dossier with a bespoke layout:
//   - hierarchy tree (nested parent → child)
//   - rich dossier with seen-across mini-timeline,
//     connected-entities cluster, atlas placement card,
//     mentions stack, review queue surface
//   - cross-panel cues (Show on Atlas, Open Timeline, etc.)
//   - widens when panel.is-expanded via CSS
//
// Registered into window.RPG_DETAIL_RENDERERS.locations AFTER
// rpg-entities.jsx loads, so this wins.
// =====================================================================

const { useState: _loc_us, useMemo: _loc_um, useCallback: _loc_uc } = React;

// ---------------------------------------------------------------------
// Hierarchy data
// ---------------------------------------------------------------------
// Each location can have parent/children. The tree below is the seeded
// Pale Reach / Hess / Glass Court world used everywhere else.
//
// "kind" must match one of the LOCATION_KINDS below — that's how icons,
// labels, and filter chips key off.
// ---------------------------------------------------------------------
const LOCATION_KINDS = [
  { id: "world",       label: "World",          glyph: "◉" },
  { id: "realm",       label: "Realm",          glyph: "◎" },
  { id: "continent",   label: "Continent",      glyph: "◐" },
  { id: "country",     label: "Country",        glyph: "◈" },
  { id: "region",      label: "Region",         glyph: "▣" },
  { id: "city",        label: "City",           glyph: "▲" },
  { id: "town",        label: "Town",           glyph: "▴" },
  { id: "village",     label: "Village",        glyph: "▵" },
  { id: "district",    label: "District",       glyph: "◇" },
  { id: "fortress",    label: "Fortress",       glyph: "♜" },
  { id: "port",        label: "Port",           glyph: "⚓" },
  { id: "forest",      label: "Forest",         glyph: "♣" },
  { id: "mountain",    label: "Mountain pass",  glyph: "⛰" },
  { id: "valley",      label: "Valley",         glyph: "⌣" },
  { id: "river",       label: "River",          glyph: "≈" },
  { id: "coast",       label: "Coast",          glyph: "～" },
  { id: "island",      label: "Island",         glyph: "○" },
  { id: "ruins",       label: "Ruins",          glyph: "✕" },
  { id: "battlefield", label: "Battlefield",    glyph: "✕" },
  { id: "building",    label: "Building",       glyph: "▢" },
  { id: "room",        label: "Room",           glyph: "□" },
  { id: "tavern",      label: "Tavern / Inn",   glyph: "♨" },
  { id: "temple",      label: "Temple",         glyph: "✜" },
  { id: "palace",      label: "Palace",         glyph: "♚" },
  { id: "prison",      label: "Prison",         glyph: "▦" },
  { id: "library",     label: "Library",        glyph: "▤" },
  { id: "mine",        label: "Mine",           glyph: "▼" },
  { id: "dungeon",     label: "Dungeon",        glyph: "▾" },
  { id: "bridge",      label: "Bridge",         glyph: "∏" },
  { id: "gate",        label: "Gate",           glyph: "∐" },
  { id: "road",        label: "Road",           glyph: "—" },
  { id: "landmark",    label: "Landmark",       glyph: "✦" },
  { id: "portal",      label: "Portal",         glyph: "◊" },
  { id: "secret",      label: "Secret",         glyph: "?" },
  { id: "other",       label: "Other",          glyph: "·" },
];
const LOCATION_KIND_BY_ID = Object.fromEntries(LOCATION_KINDS.map((k) => [k.id, k]));

// Rich location dataset, anchored in existing sample world.
// Shape: { id, type:"locations", name, kind, parentId?, placed, first,
//   last, mentionCount, childCount, queue?, summary, status, history,
//   characters, bestiary, quests, events, items, factions, travel,
//   roads, mentionsByChapter, mentions, references, contradictions }
const LOCATIONS_DATA = [
  // ---- Roots ------------------------------------------------------
  { id: "loc-world", type: "locations", name: "The Salt-Coast", kind: "world",
    glyphChar: "◉", status: "active", placed: true, first: "Ch. 1", last: "Ch. 7",
    summary: "The known world of the manuscript — bounded by the cold sea to the north and the Hess interior to the south.",
    mentionCount: 8, childCount: 2,
    mentionsByChapter: [2,1,1,1,1,1,1,0,0,0,0,0],
  },
  { id: "loc-reach-region", type: "locations", name: "The Pale Reach", kind: "region",
    parentId: "loc-world", glyphChar: "▣", status: "active", placed: true,
    first: "Ch. 1", last: "Ch. 7", mentionCount: 24, childCount: 5,
    summary: "The salt-bleached northern coast. Seat of House Vey. Frames Acts I–III.",
    mentionsByChapter: [4,3,2,2,1,3,3,0,0,0,0,0],
    queue: 1,
  },
  { id: "loc-hess-region", type: "locations", name: "Hessmark", kind: "country",
    parentId: "loc-world", glyphChar: "◈", status: "active", placed: true,
    first: "Ch. 3", last: "Ch. 7", mentionCount: 12, childCount: 2,
    summary: "Mercantile inland country. Seat of House Hess and the Glass Court.",
    mentionsByChapter: [0,0,3,1,1,2,3,0,0,0,0,0],
  },

  // ---- Pale Reach children ---------------------------------------
  // (The main selected location — the dossier sample focuses on this.)
  { id: "a1", type: "locations", name: "Pale Reach Hold", kind: "fortress",
    parentId: "loc-reach-region", glyphChar: "♜",
    status: "active", placed: true, first: "Ch. 1, p. 4", last: "Ch. 7",
    mentionCount: 56, childCount: 4,
    summary: "Stockaded watch-hold above the salt flats. Headquarters of the Reach watch and Aelinor Vey's working seat.",
    description:
      "A salt-bleached stockade ringed by causeways that flood twice a day. Brec's watchhouse, the granary, the auger chapel, and the Vey hall sit inside the inner wall. The outer wall has fallen in two places; the locals call the larger gap 'the lung.'",
    history: [
      { chapter: 1, what: "Aelinor arrives in the cold; Brec meets her at the stockade gate.", cite: "Ch. 1, p. 4" },
      { chapter: 2, what: "First salt-storm batters the outer wall.",                          cite: "Ch. 2, p. 38" },
      { chapter: 7, what: "Negotiation break — Hess delegation withdraws to the watchhouse.",  cite: "Ch. 7, p. 188" },
    ],
    characters: [
      { id: "c1", type: "cast", label: "Aelinor Vey" },
      { id: "c3", type: "cast", label: "Captain Brec" },
      { id: "c6", type: "cast", label: "Dav the Quiet" },
    ],
    bestiary: [
      { id: "b1", type: "bestiary", label: "Salt-wraith" },
      { id: "b3", type: "bestiary", label: "Hess gull" },
    ],
    quests: [
      { id: "q1", type: "quests", label: "The Auger Wake" },
      { id: "q2", type: "quests", label: "Brec's Letter" },
    ],
    events: [
      { id: "e1", type: "events", label: "Hess negotiation" },
      { id: "e2", type: "events", label: "First salt-storm" },
    ],
    items: [
      { id: "i1", type: "items", label: "Bone Auger" },
      { id: "i4", type: "items", label: "Hess Letter-key" },
    ],
    factions: [
      { id: "f1", type: "factions", label: "House Vey" },
    ],
    travel: [
      { to: "a2", toLabel: "Vraska Pass",  via: "Salt road",   chapters: "Ch. 4–5" },
      { to: "a3", toLabel: "Glass Court", via: "By messenger", chapters: "Ch. 5"   },
    ],
    roads: [
      "Salt road (south, washed out in Ch. 2)",
      "Coastal causeway (twice-daily tide)",
      "Brittlewood track (overland, unreliable)",
    ],
    mentionsByChapter: [12, 8, 5, 9, 4, 11, 7, 0, 0, 0, 0, 0],
    mentions: [
      { id: "m1", excerpt: "Pale Reach taught patience the way the sea taught salt.",        cite: "Ch. 1, p. 14" },
      { id: "m2", excerpt: "The light over Pale Reach was the colour of cooled tin.",         cite: "Ch. 7, p. 184" },
      { id: "m3", excerpt: "Inside, the watchhouse smelled of pitch and coriander.",          cite: "Ch. 7, p. 187" },
    ],
    references: [
      { id: "ref-mapsheet", label: "Mapsheet — Reach Hold detail" },
      { id: "ref-author1",  label: "Author note: stockade has two breaches by Ch. 5" },
    ],
    contradictions: [
      { id: "ccx-1", note: "Ch. 2 says one breach; Ch. 5 says two. Decide canon." },
    ],
  },

  { id: "loc-vey-hall", type: "locations", name: "Vey Hall",       kind: "palace",
    parentId: "a1", glyphChar: "♚", status: "active", placed: true,
    first: "Ch. 1, p. 10", last: "Ch. 7", mentionCount: 9,
    summary: "Aelinor's audience hall inside the Hold.",
    mentionsByChapter: [3,0,1,1,0,1,3,0,0,0,0,0],
    characters: [{ id: "c1", type: "cast", label: "Aelinor Vey" }],
    factions:   [{ id: "f1", type: "factions", label: "House Vey" }],
    quests: [], events: [{ id: "e1", type: "events", label: "Hess negotiation" }],
    items:  [{ id: "i2", type: "items", label: "Vey Signet" }],
    bestiary: [],
    history: [
      { chapter: 7, what: "Hess negotiation breaks; Brec leaves first.", cite: "Ch. 7, p. 191" },
    ],
  },
  { id: "loc-watchhouse", type: "locations", name: "Watchhouse",   kind: "building",
    parentId: "a1", glyphChar: "▢", status: "active", placed: true,
    first: "Ch. 1", last: "Ch. 7", mentionCount: 21,
    summary: "Brec's working room; smells of pitch and coriander.",
    mentionsByChapter: [4,3,1,3,1,4,5,0,0,0,0,0],
    characters: [{ id: "c3", type: "cast", label: "Captain Brec" }],
    factions:   [{ id: "f1", type: "factions", label: "House Vey" }],
    items: [{ id: "i4", type: "items", label: "Hess Letter-key" }],
    quests: [{ id: "q2", type: "quests", label: "Brec's Letter" }],
    bestiary: [], events: [],
    history: [],
  },
  { id: "sw", type: "locations", name: "Salt Watch", kind: "landmark",
    parentId: "a1", glyphChar: "✦", status: "active", placed: false,
    first: "Ch. 2, p. 38", last: "Ch. 6", mentionCount: 4, queue: 1,
    summary: "Old watch-tower north of the Hold. Unplaced on the Atlas.",
    mentionsByChapter: [0,1,0,1,0,2,0,0,0,0,0,0],
  },
  { id: "loc-granary", type: "locations", name: "Reach Granary", kind: "building",
    parentId: "a1", glyphChar: "▢", status: "active", placed: true,
    first: "Ch. 4, p. 96", last: "Ch. 7", mentionCount: 6,
    summary: "Inner-wall granary, tied to the Vey ledger.",
    mentionsByChapter: [0,0,0,2,0,1,3,0,0,0,0,0],
  },

  // ---- Other Reach ----------------------------------------------
  { id: "a2", type: "locations", name: "Vraska Pass", kind: "mountain",
    parentId: "loc-reach-region", glyphChar: "⛰", status: "active", placed: true,
    first: "Ch. 4, p. 91", last: "Ch. 6", mentionCount: 10,
    summary: "The only walkable line between Pale Reach and Hess; salt-burned, often closed.",
    mentionsByChapter: [0,0,0,5,2,3,0,0,0,0,0,0],
    queue: 1,
    characters: [{ id: "c3", type: "cast", label: "Captain Brec" }],
    quests: [{ id: "q2", type: "quests", label: "Brec's Letter" }],
    items:  [{ id: "i3", type: "items", label: "Salt-bitten Cloak" }],
    bestiary: [{ id: "b2", type: "bestiary", label: "Vraska boar" }],
    events: [], factions: [],
  },
  { id: "bw", type: "locations", name: "Brittlewood", kind: "forest",
    parentId: "loc-reach-region", glyphChar: "♣", status: "active", placed: false,
    first: "Ch. 5, p. 130", last: "Ch. 5", mentionCount: 4,
    summary: "Coastal scrub forest. Where Brec lost the Letter-key.",
    mentionsByChapter: [0,0,0,0,4,0,0,0,0,0,0,0],
    items: [{ id: "i4", type: "items", label: "Hess Letter-key" }],
  },
  { id: "loc-auger-cliffs", type: "locations", name: "Auger Cliffs", kind: "coast",
    parentId: "loc-reach-region", glyphChar: "～", status: "active", placed: false,
    first: "Ch. 4, p. 91", last: "Ch. 6", mentionCount: 5, queue: 1,
    summary: "Cliffline above the salt flats; review queue: extracted from Ch. 4 prose, not yet placed.",
    mentionsByChapter: [0,0,0,2,0,3,0,0,0,0,0,0],
  },

  // ---- Hess children -------------------------------------------
  { id: "a3", type: "locations", name: "Glass Court", kind: "palace",
    parentId: "loc-hess-region", glyphChar: "♚", status: "active", placed: true,
    first: "Ch. 3, p. 76", last: "Ch. 7", mentionCount: 14, queue: 1,
    summary: "Hess audience hall. Audiences last exactly three days.",
    mentionsByChapter: [0,0,4,1,0,1,3,0,0,0,0,0],
    characters: [{ id: "c2", type: "cast", label: "Saren of Hess" }],
    factions:   [{ id: "f2", type: "factions", label: "House Hess" }],
    quests: [], events: [{ id: "e1", type: "events", label: "Hess negotiation" }],
    items: [], bestiary: [],
  },
  { id: "loc-hess-archive", type: "locations", name: "Hess Archive", kind: "library",
    parentId: "loc-hess-region", glyphChar: "▤", status: "active", placed: false,
    first: "Ch. 3", last: "Ch. 6", mentionCount: 3,
    summary: "Hess record-house. 'In the book' is more permanent than song.",
    mentionsByChapter: [0,0,1,0,0,2,0,0,0,0,0,0],
  },
];


// ---------------------------------------------------------------------
// Hierarchy tree component
// ---------------------------------------------------------------------
const LocHierarchyTree = ({ data, selectedId, onSelect, onAddChild, onSetParent, onDragToAtlas }) => {
  // Build adjacency
  const childrenOf = _loc_um(() => {
    const m = {};
    for (const d of data) {
      const p = d.parentId || "__roots__";
      (m[p] = m[p] || []).push(d);
    }
    return m;
  }, [data]);

  const renderNode = (node, depth) => {
    const kids = childrenOf[node.id] || [];
    const kind = LOCATION_KIND_BY_ID[node.kind] || LOCATION_KIND_BY_ID.other;
    const selected = node.id === selectedId;
    return (
      <React.Fragment key={node.id}>
        <div
          className={"loc-tree__row" + (selected ? " is-selected" : "")}
          data-callback="onSelectLocation"
          style={{ paddingLeft: 8 + depth * 14 }}
          onClick={() => onSelect && onSelect(node)}
          draggable
          onDragStart={() => onDragToAtlas && onDragToAtlas(node, "drag-start")}
        >
          <span className="loc-tree__glyph" title={kind.label}>{kind.glyph}</span>
          <span className="loc-tree__name">{node.name}</span>
          {!node.placed && <span className="loc-tree__unplaced" title="Not placed on Atlas">·</span>}
          {node.queue ? <span className="loc-tree__queue" title={node.queue + " review item(s)"}>{node.queue}</span> : null}
          {kids.length > 0 && <span className="loc-tree__children" title={kids.length + " children"}>{kids.length}</span>}
          <button
            className="loc-tree__add"
            data-callback="onCreateChildLocation"
            title="Add child"
            onClick={(e) => { e.stopPropagation(); onAddChild && onAddChild(node); }}
          >+</button>
        </div>
        {kids.map((k) => renderNode(k, depth + 1))}
      </React.Fragment>
    );
  };

  const roots = childrenOf.__roots__ || [];
  return (
    <div className="loc-tree" data-ui="LocHierarchyTree">
      {roots.map((r) => renderNode(r, 0))}
    </div>
  );
};

// ---------------------------------------------------------------------
// Mini timeline for chapter appearances (variant of RpgChapterSpark)
// ---------------------------------------------------------------------
const LocChapterTimeline = ({ data, first, last }) => {
  if (!data || !data.length) return null;
  const max = Math.max(1, ...data);
  return (
    <div className="loc-mt" data-ui="LocChapterTimeline">
      <div className="loc-mt__rail">
        {data.map((n, i) => (
          <span
            key={i}
            className={"loc-mt__cell" + (n === 0 ? " is-empty" : "")}
            style={{ "--h": (8 + (n / max) * 36) + "px" }}
            title={"Ch. " + (i + 1) + " · " + n + " mention(s)"}
          ><span/></span>
        ))}
      </div>
      <div className="loc-mt__axis">
        <span>{first || "Ch. 1"}</span>
        <span style={{ flex: 1 }}/>
        <span>{last || "Ch. 12"}</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Atlas placement mini-card (visual stand-in — Atlas is the real one)
// ---------------------------------------------------------------------
const LocAtlasCard = ({ loc, onShowOnAtlas, onOpenEditor }) => {
  return (
    <div className="loc-atlas" data-ui="LocAtlasCard">
      <div className="loc-atlas__map">
        <svg viewBox="0 0 200 110" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" aria-hidden>
          <defs>
            <pattern id="loc-grain" width="6" height="6" patternUnits="userSpaceOnUse">
              <rect width="6" height="6" fill="var(--bg-paper-2)"/>
              <circle cx="1" cy="1" r="0.5" fill="rgba(58,44,18,0.08)"/>
            </pattern>
          </defs>
          <rect width="200" height="110" fill="url(#loc-grain)"/>
          {/* Coast curve */}
          <path d="M -2 40 C 30 32, 60 50, 100 44 S 170 38, 210 50"
                fill="none" stroke="var(--ink-4)" strokeWidth="1.2"/>
          {/* Roads */}
          <path d="M 50 60 L 110 70 L 150 78" fill="none" stroke="var(--ink-4)" strokeDasharray="3 3" strokeWidth="1"/>
          {/* Pin */}
          {loc.placed ? (
            <g>
              <circle cx="68" cy="58" r="10" fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1.4"/>
              <circle cx="68" cy="58" r="3"  fill="var(--accent-deep)"/>
              <text x="80" y="61" fontSize="9" fontFamily="var(--font-serif)" fill="var(--ink-1)">{loc.name}</text>
            </g>
          ) : (
            <g opacity="0.7">
              <rect x="60" y="50" width="22" height="14" fill="none" stroke="var(--ink-3)" strokeDasharray="2 2"/>
              <text x="60" y="48" fontSize="8" fontFamily="var(--font-serif)" fill="var(--ink-3)">unplaced</text>
            </g>
          )}
        </svg>
      </div>
      <div className="loc-atlas__row">
        <span className="loc-atlas__lbl">{loc.placed ? "Placed" : "Not placed"}</span>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--small" data-callback="onShowLocationOnAtlas" onClick={onShowOnAtlas}>Show on Atlas</button>
        <button className="rpg-btn rpg-btn--small" data-callback="onOpenAtlasEditorFromLocation" onClick={onOpenEditor}>Open editor →</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Source-mention stack
// ---------------------------------------------------------------------
const LocMentionStack = ({ mentions, onOpenSourceMention }) => {
  if (!mentions?.length) return <span className="rpg-empty">No mentions indexed.</span>;
  return (
    <ul className="loc-mentions" data-ui="LocMentionStack">
      {mentions.map((m, i) => (
        <li key={m.id || i} className="loc-mention">
          <button
            className="loc-mention__cite"
            data-callback="onOpenLocationSourceMention"
            onClick={() => onOpenSourceMention && onOpenSourceMention(m)}
          >{m.cite}</button>
          <span className="loc-mention__quote">"{m.excerpt}"</span>
        </li>
      ))}
    </ul>
  );
};

// ---------------------------------------------------------------------
// Review queue card — Locations-flavoured
// ---------------------------------------------------------------------
const LocReviewCard = ({ item, onAccept, onEdit, onMerge, onDeny, onOpenSource }) => {
  const c = (window.CONFIDENCE || {})[item.level] || {};
  return (
    <div className="loc-review" data-ui="LocReviewCard"
         style={{ "--cc": c.color, "--cs": c.soft, "--cd": c.deep }}>
      <div className="loc-review__head">
        <ConfidenceBadge level={item.level} value={item.value}/>
        <span className="loc-review__kind">{item.candidateType}</span>
      </div>
      <div className="loc-review__name">{item.name}</div>
      <div className="loc-review__suggest">{item.suggested}</div>
      <blockquote className="loc-review__quote">"{item.sourceQuote}"</blockquote>
      <div className="loc-review__row">
        <button className="loc-review__cite" data-callback="onOpenLocationSourceMention"
                onClick={() => onOpenSource && onOpenSource(item)}>{item.sourceChapter}</button>
        {item.related && <span className="loc-review__related">↔ {item.related}</span>}
      </div>
      {item.warning && <div className="loc-review__warn">⚠ {item.warning}</div>}
      <div className="loc-review__actions">
        <button className="rpg-btn rpg-btn--primary rpg-btn--small" data-callback="onAcceptLocationQueueItem" onClick={() => onAccept && onAccept(item)}>Accept</button>
        <button className="rpg-btn rpg-btn--small" data-callback="onEditLocationQueueItem"   onClick={() => onEdit && onEdit(item)}>Edit</button>
        <button className="rpg-btn rpg-btn--small" data-callback="onMergeLocationQueueItem"  onClick={() => onMerge && onMerge(item)}>Merge</button>
        <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onDenyLocationQueueItem" onClick={() => onDeny && onDeny(item)}>Deny</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// LocationDetail — the bespoke dossier body
// ---------------------------------------------------------------------
const LocationDetail = ({ entity, onSelectEntity, onOpenRelatedTab, onOpenSourceMention }) => {
  const e = entity || {};
  const kind = LOCATION_KIND_BY_ID[e.kind] || LOCATION_KIND_BY_ID.other;
  const review = (window.LoomwrightBackend?.ReviewService?.listCardViewsSync?.("locations") || []).slice(0, 4);

  // Counts for the connected-entities cluster
  const counts = {
    cast:     (e.characters || []).length,
    bestiary: (e.bestiary   || []).length,
    items:    (e.items      || []).length,
    quests:   (e.quests     || []).length,
    events:   (e.events     || []).length,
    factions: (e.factions   || []).length,
  };

  return (
    <div className="rpg-detail loc-detail" data-ui="LocationDetail">
      <RpgFacets items={[
        { k: "Type",         v: kind.label },
        { k: "Status",       v: e.status || "active" },
        { k: "Placed",       v: e.placed ? "Yes" : "No", tone: e.placed ? "good" : "warn" },
        e.first ? { k: "First seen", v: e.first } : null,
        e.last  ? { k: "Last seen",  v: e.last  } : null,
        { k: "Mentions",     v: e.mentionCount ?? (e.mentionsByChapter ? e.mentionsByChapter.reduce((a, b) => a + b, 0) : 0) },
      ]}/>

      {/* Top dossier row — widens to 2-up on expanded panels via CSS */}
      <div className="loc-detail__top">
        <RpgSection title="Overview">
          <p className="rpg-prose">{e.summary || "—"}</p>
          {e.description && <p className="rpg-prose" style={{ marginTop: 8 }}>{e.description}</p>}
        </RpgSection>

        <RpgSection title="Atlas placement"
                    action={{ label: "Editor →", callback: "onOpenAtlasEditorFromLocation" }}>
          <LocAtlasCard
            loc={e}
            onShowOnAtlas={() => onOpenRelatedTab && onOpenRelatedTab({ id: e.id, type: "atlas", label: e.name })}
            onOpenEditor={() => onOpenRelatedTab && onOpenRelatedTab({ id: e.id, type: "atlas", label: e.name })}
          />
        </RpgSection>
      </div>

      <RpgSection title="Seen across chapters">
        <LocChapterTimeline data={e.mentionsByChapter || []} first={e.first} last={e.last}/>
      </RpgSection>

      <RpgSection title="Connected entities">
        <div className="loc-cluster">
          {Object.entries(counts).map(([k, n]) => (
            <button
              key={k}
              className={"loc-cluster__node loc-cluster__node--" + k + (n === 0 ? " is-empty" : "")}
              data-callback="onPinRelatedPanel"
              onClick={() => onOpenRelatedTab && onOpenRelatedTab({ type: k })}
              title={k + ": " + n}
            >
              <EntityTypeBadge type={k} size="xs" showLabel={false}/>
              <span className="loc-cluster__n">{n}</span>
              <span className="loc-cluster__lbl">{(ENTITY_TYPES[k] || {}).label || k}</span>
            </button>
          ))}
        </div>
      </RpgSection>

      {(e.characters || []).length > 0 && (
        <RpgSection title="Characters seen here"
                    action={{ label: "Open Cast →", callback: "onPinRelatedPanel" }}>
          <RpgChipRow items={e.characters} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.bestiary || []).length > 0 && (
        <RpgSection title="Creatures found here"
                    action={{ label: "Open Bestiary →", callback: "onPinRelatedPanel" }}>
          <RpgChipRow items={e.bestiary} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.quests || []).length > 0 && (
        <RpgSection title="Quests here"
                    action={{ label: "Open Quests →", callback: "onPinRelatedPanel" }}>
          <RpgChipRow items={e.quests} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.events || []).length > 0 && (
        <RpgSection title="Events here"
                    action={{ label: "Open Timeline →", callback: "onOpenLocationTimeline" }}>
          <RpgChipRow items={e.events} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.items || []).length > 0 && (
        <RpgSection title="Items found here">
          <RpgChipRow items={e.items} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.factions || []).length > 0 && (
        <RpgSection title="Factions present">
          <RpgChipRow items={e.factions} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.travel || []).length > 0 && (
        <RpgSection title="Travel routes"
                    action={{ label: "Show on Atlas →", callback: "onShowLocationOnAtlas" }}>
          <ul className="loc-travel">
            {e.travel.map((t, i) => (
              <li key={i} className="loc-travel__row">
                <span className="loc-travel__arrow">→</span>
                <button className="loc-travel__to"
                        data-callback="onPinRelatedPanel"
                        onClick={() => onSelectEntity && onSelectEntity({ id: t.to, type: "locations", label: t.toLabel })}>
                  {t.toLabel}
                </button>
                <span className="loc-travel__via">{t.via}</span>
                <span className="loc-travel__chap">{t.chapters}</span>
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      {(e.roads || []).length > 0 && (
        <RpgSection title="Roads & connections">
          <ul className="rpg-bullets">{e.roads.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </RpgSection>
      )}

      {(e.history || []).length > 0 && (
        <RpgSection title="History at this location">
          <ul className="rpg-history">
            {e.history.map((h, i) => (
              <li key={i} className="rpg-history__row rpg-history__row--event">
                <span className="rpg-history__chap">Ch. {h.chapter}</span>
                <span className="rpg-history__what">{h.what}</span>
                {h.cite && <button className="rpg-history__cite" data-callback="onOpenLocationSourceMention"
                          onClick={() => onOpenSourceMention && onOpenSourceMention(h)}>{h.cite}</button>}
              </li>
            ))}
          </ul>
        </RpgSection>
      )}

      {(e.mentions || []).length > 0 && (
        <RpgSection title="Manuscript mentions"
                    action={{ label: "Open source →", callback: "onOpenLocationSourceMention" }}>
          <LocMentionStack mentions={e.mentions} onOpenSourceMention={onOpenSourceMention}/>
        </RpgSection>
      )}

      {(e.references || []).length > 0 && (
        <RpgSection title="References">
          <RpgChipRow items={e.references} onSelect={onSelectEntity}/>
        </RpgSection>
      )}

      {(e.contradictions || []).length > 0 && (
        <RpgSection title="Unresolved data">
          <ul className="loc-warn">
            {e.contradictions.map((c) => (
              <li key={c.id} className="loc-warn__row">⚠ {c.note}</li>
            ))}
          </ul>
        </RpgSection>
      )}

      {review.length > 0 && (
        <RpgSection title="Review queue"
                    action={{ label: "Open queue →", callback: "onOpenLocationsReviewQueue" }}>
          <div className="loc-reviews">
            {review.map((r) => (
              <LocReviewCard key={r.id} item={r}
                             onAccept={() => {}} onEdit={() => {}}
                             onMerge={() => {}}  onDeny={() => {}}
                             onOpenSource={onOpenSourceMention}/>
            ))}
          </div>
        </RpgSection>
      )}

      <div className="rpg-actions">
        <button className="rpg-btn rpg-btn--primary" data-callback="onCreateChildLocation" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "locations" } }))}>+ Add child</button>
        <button className="rpg-btn" data-callback="onEditLocation" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "locations" } }))}>Edit</button>
        <button className="rpg-btn" data-callback="onSetParentLocation">Set parent</button>
        <button className="rpg-btn" data-callback="onMergeLocation">Merge</button>
        <button className="rpg-btn" data-callback="onDragLocationToAtlas">Drag to Atlas</button>
        <span style={{ flex: 1 }}/>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onShowLocationOnAtlas">Show on Atlas</button>
        <button className="rpg-btn rpg-btn--ghost" data-callback="onOpenLocationTimeline">Open Timeline</button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// LocationsPanelBody — bespoke (replaces EntityTabShell for this type).
//
// Wired in panels.jsx via entityType === "locations". The dispatcher
// renders this in place of the generic framework body.
// ---------------------------------------------------------------------
const LocationsPanelBody = ({ panel, panelContext, onSelectEntity }) => {
  const [search, setSearch] = _loc_us("");
  const [selectedId, setSelectedId] = _loc_us(panel?.selected?.id || "a1");
  // Follow host-driven selection (locked entities, lw:focus-entity).
  React.useEffect(() => { if (panel?.selected?.id) setSelectedId(panel.selected.id); }, [panel?.selected?.id]);
  const [tab, setTab] = _loc_us("dossier"); // dossier | mentions | review | references
  const [kindFilter, setKindFilter] = _loc_us("all");
  const [placedFilter, setPlacedFilter] = _loc_us("all"); // all | placed | unplaced

  // Live locations only — never the demo LOCATIONS_DATA.
  const data = (window.LoomwrightBackend?.EntityService?.listSync("locations")) || [];
  const filtered = data.filter((d) => {
    if (search && !(d.name || "").toLowerCase().includes(search.toLowerCase())) return false;
    if (kindFilter !== "all" && d.kind !== kindFilter) return false;
    if (placedFilter === "placed"   && !d.placed) return false;
    if (placedFilter === "unplaced" &&  d.placed) return false;
    return true;
  });

  const selected = filtered.find((d) => d.id === selectedId) || data.find((d) => d.id === selectedId);

  const onOpenEditor = _loc_uc(() => {
    // Route into Atlas full-screen via cross-panel context. We don't own
    // navigation here — surface as a no-op + data-callback so the host
    // can wire it.
    if (selected) onSelectEntity && onSelectEntity({ type: "atlas", id: selected.id, label: selected.name });
  }, [selected, onSelectEntity]);

  return (
    <div className="loc-body" data-ui="LocationsPanelBody">
      {/* Top chrome */}
      <div className="loc-body__top">
        <div className="loc-body__search">
          <Icon name="search" size={11}/>
          <input
            value={search} placeholder="Search locations…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="loc-body__filters">
          <select className="loc-body__filter" value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}>
            <option value="all">All types</option>
            {LOCATION_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
          </select>
          <select className="loc-body__filter" value={placedFilter} onChange={(e) => setPlacedFilter(e.target.value)}>
            <option value="all">Placed + unplaced</option>
            <option value="placed">Placed only</option>
            <option value="unplaced">Unplaced only</option>
          </select>
          <Btn variant="ghost" size="sm" icon="plus" data-callback="onCreateLocation" title="Add location" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "locations" } }))}/>
          <Btn variant="ghost" size="sm" icon="bell" data-callback="onOpenLocationsReviewQueue" title="Review queue"/>
        </div>
      </div>

      {/* Body — splits into tree + dossier; widens when expanded */}
      <div className="loc-body__split">
        <aside className="loc-body__tree">
          <div className="loc-body__tree-head">
            <span>Hierarchy</span>
            <span className="loc-body__tree-count">{filtered.length}</span>
          </div>
          <LocHierarchyTree
            data={filtered}
            selectedId={selected?.id}
            onSelect={(n) => { setSelectedId(n.id); onSelectEntity && onSelectEntity({ id: n.id, type: "locations", label: n.name }); }}
            onAddChild={() => {}}
            onSetParent={() => {}}
            onDragToAtlas={() => {}}
          />
          <div className="loc-body__tree-actions">
            <button className="rpg-btn rpg-btn--small" data-callback="onCreateLocation" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "locations" } }))}>+ Location</button>
            <button className="rpg-btn rpg-btn--small rpg-btn--ghost" data-callback="onImportLocations">Import</button>
          </div>
        </aside>

        <section className="loc-body__detail">
          {selected ? (
            <>
              <div className="loc-body__detail-head">
                <div>
                  <div className="loc-body__detail-eyebrow">{(LOCATION_KIND_BY_ID[selected.kind] || {}).label || "Location"}</div>
                  <div className="loc-body__detail-title">{selected.name}</div>
                </div>
                <div className="loc-body__tabs">
                  {[
                    ["dossier",   "Dossier"],
                    ["mentions",  "Mentions"],
                    ["review",    "Review " + ((selected.queue || 0) > 0 ? "·" + (selected.queue || 0) : "")],
                    ["references","References"],
                  ].map(([k, l]) => (
                    <button key={k} className={"loc-body__tab" + (tab === k ? " is-active" : "")} onClick={() => setTab(k)}>{l}</button>
                  ))}
                </div>
              </div>

              {tab === "dossier" && (
                <LocationDetail
                  entity={selected}
                  onSelectEntity={onSelectEntity}
                  onOpenRelatedTab={(row) => onSelectEntity && onSelectEntity(row)}
                  onOpenSourceMention={() => {}}
                />
              )}
              {tab === "mentions" && (
                <div style={{ padding: 12 }}>
                  <LocMentionStack mentions={selected.mentions} onOpenSourceMention={() => {}}/>
                </div>
              )}
              {tab === "review" && (
                <div style={{ padding: 12 }} className="loc-reviews">
                  {(window.LoomwrightBackend?.ReviewService?.listCardViewsSync?.("locations") || []).map((r) => (
                    <LocReviewCard key={r.id} item={r}
                      onAccept={(it) => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onAcceptLocationQueueItem", detail: { id: it.id } } }))}
                      onEdit={(it) => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onEditLocationQueueItem", detail: { id: it.id } } }))}
                      onMerge={(it) => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onMergeLocationQueueItem", detail: { id: it.id } } }))}
                      onDeny={(it) => window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name: "onDenyLocationQueueItem", detail: { id: it.id } } }))}/>
                  ))}
                  {(window.LoomwrightBackend?.ReviewService?.listCardViewsSync?.("locations") || []).length === 0 && (
                    <EmptyState icon="bell" title="Inbox empty" body="Location extraction candidates will appear here."/>
                  )}
                </div>
              )}
              {tab === "references" && (
                <div style={{ padding: 12 }}>
                  <RpgChipRow items={selected.references || []} emptyLabel="No references linked." onSelect={() => {}}/>
                </div>
              )}
            </>
          ) : (
            <EmptyState icon="pin" title="Pick a location" body="Select a location from the hierarchy to see its dossier."/>
          )}
        </section>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Wire into the framework
// ---------------------------------------------------------------------
window.LOCATIONS_DATA   = LOCATIONS_DATA;
window.LOCATION_KINDS   = LOCATION_KINDS;

// Override the framework sample with the rich list so other panels that
// chip-link to a location can resolve names.
window.ENTITY_SAMPLES = window.ENTITY_SAMPLES || {};

// Register the bespoke detail renderer (used inside framework body fallback).
window.RPG_DETAIL_RENDERERS = window.RPG_DETAIL_RENDERERS || {};
window.RPG_DETAIL_RENDERERS.locations = (entity, ctx) => <LocationDetail entity={entity} {...ctx}/>;

// Filter chips for the generic framework view (used outside the bespoke
// LocationsPanelBody when the user enters compare/multi/edit modes).
window.RPG_FILTERS = window.RPG_FILTERS || {};
window.RPG_FILTERS.locations = [
  { key: "placed:yes",      label: "Placed on Atlas" },
  { key: "placed:no",       label: "Unplaced" },
  { key: "kind:region",     label: "Type: Region" },
  { key: "kind:city",       label: "Type: City" },
  { key: "kind:fortress",   label: "Type: Fortress" },
  { key: "kind:building",   label: "Type: Building" },
  { key: "kind:mountain",   label: "Type: Mountain pass" },
  { key: "kind:forest",     label: "Type: Forest" },
  { key: "kind:landmark",   label: "Type: Landmark" },
  { key: "kind:secret",     label: "Type: Secret" },
  { key: "queue:any",       label: "Has review item" },
  { key: "chapter:recent",  label: "Mentioned recently" },
];

Object.assign(window, {
  LocationDetail, LocationsPanelBody, LocHierarchyTree,
  LocChapterTimeline, LocAtlasCard, LocMentionStack, LocReviewCard,
  LOCATION_KIND_BY_ID,
});

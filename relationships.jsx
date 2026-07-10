// =====================================================================
// relationships.jsx — Relationships workspace.
//
// Modes:
//   single        — focus character → top relationships, hopes, fears,
//                   conflicts, recent changes.
//   compare       — two characters → meters + history + evidence.
//   network       — group graph view (svg, parchment).
//   timeline      — relationship changes across chapters.
//   conflict      — heat map of conflicts.
//   review        — queue cards.
//
// Demo data uses the existing ATLAS_CAST (Aelinor, Saren, Brec, Mara,
// Auger, Dav) so the relationship graph feels populated.
// =====================================================================

const { useState: _re_us, useMemo: _re_um, useCallback: _re_uc, useRef: _re_ur } = React;

// ---------------------------------------------------------------------
// Demo data — relationships, evidence, change events, review queue.
// ---------------------------------------------------------------------
const REL_TYPES = {
  friend:  { id: "friend",  label: "Friend",  color: "#5d6d4e" },
  enemy:   { id: "enemy",   label: "Enemy",   color: "#a8553f" },
  family:  { id: "family",  label: "Family",  color: "#8a6a2a" },
  lover:   { id: "lover",   label: "Lover",   color: "#b86a82" },
  rival:   { id: "rival",   label: "Rival",   color: "#c98a2c" },
  mentor:  { id: "mentor",  label: "Mentor",  color: "#3e6db5" },
  faction: { id: "faction", label: "Faction", color: "#3d3a78" },
  unknown: { id: "unknown", label: "Unknown", color: "#76684c" },
};

const RELATIONSHIPS = [
  { id: "re1", a: "aelinor", b: "saren",   type: "rival",   strength: 78, trust: 22, conflict: 81, secret: false, summary: "Court-rival turned conditional ally after the Glass Audience.", chapters: [3, 4, 7] },
  { id: "re2", a: "aelinor", b: "brec",    type: "friend",  strength: 86, trust: 90, conflict: 14, secret: false, summary: "Old friend; Brec swore service to House Vey when Aelinor was a child.", chapters: [1, 2, 7] },
  { id: "re3", a: "aelinor", b: "auger",   type: "mentor",  strength: 64, trust: 55, conflict: 30, secret: true,  summary: "The Auger may have foreseen Aelinor's path. Hidden from her until Ch. 6.", chapters: [3, 6] },
  { id: "re4", a: "aelinor", b: "mara",    type: "family",  strength: 41, trust: 28, conflict: 60, secret: false, summary: "Mara is a Hess cousin twice removed; barely speaks to her.", chapters: [4, 7] },
  { id: "re5", a: "saren",   b: "mara",    type: "lover",   strength: 88, trust: 70, conflict: 24, secret: true,  summary: "Long affair, hidden from court for political reasons.", chapters: [3, 6, 7] },
  { id: "re6", a: "saren",   b: "brec",    type: "enemy",   strength: 70, trust: 8,  conflict: 90, secret: false, summary: "Brec broke Saren's brother's nose at Treaty of Brittlewood. Saren has not forgotten.", chapters: [5, 7] },
  { id: "re7", a: "brec",    b: "dav",     type: "mentor",  strength: 72, trust: 80, conflict: 10, secret: false, summary: "Brec trained Dav for the watch.", chapters: [2, 5, 7] },
  { id: "re8", a: "auger",   b: "mara",    type: "enemy",   strength: 55, trust: 5,  conflict: 70, secret: true,  summary: "Mara distrusts the Auger's prophecies. The Auger has reciprocated.", chapters: [6, 7] },
];

const REL_EVIDENCE = [
  { id: "ev1", rel: "re1", chapter: 7, quote: "…Saren bowed, but not low, and Aelinor did not bow back…", strength: "strong" },
  { id: "ev2", rel: "re2", chapter: 1, quote: "Brec set down the cup so gently it might have been a bird.", strength: "strong" },
  { id: "ev3", rel: "re3", chapter: 6, quote: "The Auger had walked the cliff three times before Aelinor was born, knowing where she would stand.", strength: "uncertain" },
  { id: "ev4", rel: "re5", chapter: 6, quote: "Mara did not say goodbye, only put her hand on the back of Saren's neck a moment too long.", strength: "high" },
  { id: "ev5", rel: "re6", chapter: 5, quote: "Saren's voice when he said 'Captain' had no captain in it at all.", strength: "strong" },
];

const REL_CHANGES = [
  { id: "rc1", rel: "re1", chapter: 7, kind: "type",     from: "enemy",   to: "rival",   note: "Glass Audience produced a brittle truce.", date: "2 days ago" },
  { id: "rc2", rel: "re2", chapter: 7, kind: "trust",    from: 78,        to: 90,        note: "Brec broke ranks to ride out with Aelinor.",    date: "2 days ago" },
  { id: "rc3", rel: "re3", chapter: 6, kind: "secret",   from: true,      to: false,     note: "Aelinor learned the Auger had been watching her since the cliffs.", date: "5 days ago" },
  { id: "rc4", rel: "re6", chapter: 5, kind: "conflict", from: 60,        to: 90,        note: "Brittlewood incident escalated.",               date: "1 week ago" },
  { id: "rc5", rel: "re5", chapter: 6, kind: "new",      from: null,      to: "lover",   note: "Affair confirmed in the harbour chapter.",     date: "5 days ago" },
];

const REL_REVIEW = [
  { id: "rq1", lvl: "strong",    title: "Auger → Mara (mistrust)",    action: "Promote to enemy?", excerpt: "…the Auger and Mara had not spoken in two years…",       cite: "Ch. 7 · p. 218" },
  { id: "rq2", lvl: "uncertain", title: "Dav loves Captain Brec?",     action: "New rel candidate", excerpt: "…Dav stood when Brec entered the room, every time.",   cite: "Ch. 5 · p. 134" },
  { id: "rq3", lvl: "weak",      title: "Aelinor ↔ The Glass Throne",  action: "Faction rel",       excerpt: "…the throne owed her something, but she could not name it…", cite: "Ch. 7 · p. 211" },
  { id: "rq4", lvl: "strong",    title: "Saren ↔ Brec — escalation",   action: "Update strength",   excerpt: "Saren's voice when he said 'Captain' had no captain in it at all.", cite: "Ch. 5 · p. 138" },
];

const REL_HOPES_FEARS = {
  aelinor: { hopes: ["Find the Stone before Hess does", "Keep Brec alive", "Find what the Auger knew"],
             fears: ["Becoming her mother", "Being right about the wraiths", "Saren breaking word"] },
  saren:   { hopes: ["Restore the Glass Throne", "Mara, openly"],
             fears: ["Court learning about Mara", "Brec coming back"] },
  brec:    { hopes: ["Keep the Reach standing", "Train Dav"],
             fears: ["Outliving Aelinor", "What the wraiths actually are"] },
  mara:    { hopes: ["Saren — alive, hers, sometime"],
             fears: ["The Auger seeing her plainly"] },
  auger:   { hopes: ["Aelinor reaches the Stone in time"],
             fears: ["Mara"] },
  dav:     { hopes: ["Be more like Brec"], fears: ["Being seen wanting that"] },
};

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------
const _castById = () => Object.fromEntries((window.ATLAS_CAST || []).map((c) => [c.id, c]));

// =====================================================================
// Live relationships model
//
// Reads the persisted store and produces the same shapes the views
// already consume (relationships / evidence / changes / review / cast /
// hopesFears). Relationships come from two sources:
//   1. Accepted `relationships` entities (fromId / toId / relationshipType).
//   2. Cast entities' related-multi fields (family, lovers, allies,
//      mentors, rivals, enemies) — the same links the Cast dossier shows.
// Deduped by unordered pair; explicit relationship entities win on type
// + summary. When the store has no cast at all (fresh / design state)
// the views fall back to the demo constants so the panel still populates.
// =====================================================================
const _B_rel = () => (typeof window !== "undefined" && window.LoomwrightBackend) || null;

const _relInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase() || "?";
};

// Stable, pleasant colour per entity id (parchment-friendly palette).
const _REL_PALETTE = ["#7a6aa3", "#a8553f", "#5d6d4e", "#b78a52", "#6b6f7a", "#8a6b58", "#3e6db5", "#b86a82", "#c98a2c", "#3d3a78"];
const _relColorFor = (seed) => {
  const s = String(seed || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return _REL_PALETTE[h % _REL_PALETTE.length];
};

// relationshipType verb / label → REL_TYPES key.
const _REL_TYPE_WORDS = [
  [/(married|wed|mother|father|sister|brother|son|daughter|cousin|kin|famil|parent|sibling|aunt|uncle|niece|nephew)/i, "family"],
  [/(lover|loves|loved|beloved|kiss|affair|romance|betroth|courted)/i, "lover"],
  [/(mentor|trained|taught|teacher|master|apprentic|serve|sworn|squire)/i, "mentor"],
  [/(rival|rivalled|competes|contend)/i, "rival"],
  [/(enem|hate|hated|fought|killed|betray|murder|attack|foe|nemesis)/i, "enemy"],
  [/(friend|ally|allies|befriend|trust|companion|comrade)/i, "friend"],
  [/(faction|order|guild|house|clan)/i, "faction"],
];
const _normRelType = (raw) => {
  const s = String(raw || "").toLowerCase();
  if (REL_TYPES[s]) return s;
  for (const [re, key] of _REL_TYPE_WORDS) if (re.test(s)) return key;
  return "unknown";
};

// Default meters per relationship type (live records don't carry numeric
// strength/trust/conflict; these give the graph honest, type-shaped values).
const _REL_TYPE_METERS = {
  friend:  { strength: 72, trust: 80, conflict: 14 },
  enemy:   { strength: 66, trust: 10, conflict: 84 },
  family:  { strength: 68, trust: 60, conflict: 30 },
  lover:   { strength: 84, trust: 72, conflict: 22 },
  rival:   { strength: 74, trust: 34, conflict: 68 },
  mentor:  { strength: 66, trust: 76, conflict: 16 },
  faction: { strength: 55, trust: 46, conflict: 40 },
  unknown: { strength: 50, trust: 50, conflict: 30 },
};

// Cast related-multi field → relationship kind (mirrors cast.jsx).
const _REL_CAST_FIELDS = [
  ["family",  "family"], ["lovers", "lover"], ["allies", "ally"],
  ["mentors", "mentor"], ["rivals", "rival"], ["enemies", "enemy"],
];

const _relLevelForConf = (conf) => {
  const c = typeof conf === "number" ? (conf > 1 ? conf / 100 : conf) : 0.6;
  if (c >= 0.9) return "high";
  if (c >= 0.75) return "strong";
  if (c >= 0.5) return "uncertain";
  return "weak";
};

const _relIdList = (raw) => {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr.map((v) => (typeof v === "string" ? v : v && v.id)).filter(Boolean);
};

// Build the live model. Returns { live, cast[], castById{}, relationships[],
// evidence[], changes[], review[], hopesFears{} } or { live:false } when the
// store has no cast (so views use the demo constants).
const buildLiveRelModel = () => {
  const B = _B_rel();
  if (!B || !B.EntityService) return { live: false };
  let castEntities = [];
  let relEntities = [];
  try { castEntities = B.EntityService.listSync("cast") || []; } catch (_e) {}
  if (!castEntities.length) return { live: false };
  try { relEntities = B.EntityService.listSync("relationships") || []; } catch (_e) {}

  // Cast list + lookup in the view's shape.
  const cast = castEntities.map((e) => ({
    id: e.id,
    name: e.name || (e.data && e.data.name) || "Unknown",
    initials: _relInitials(e.name || (e.data && e.data.name)),
    color: (e.data && e.data.color) || _relColorFor(e.id),
    role: String((e.data && e.data.role) || e.role || "supporting").toLowerCase(),
  }));
  const castById = Object.fromEntries(cast.map((c) => [c.id, c]));
  const isCast = (id) => Object.prototype.hasOwnProperty.call(castById, id);

  const byPair = new Map(); // key -> relationship record
  const pairKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);
  const evidence = [];

  const addRel = (a, b, type, { summary, secret, quote, chapter, source } = {}) => {
    if (!a || !b || a === b || !isCast(a) || !isCast(b)) return;
    const key = pairKey(a, b);
    const meters = _REL_TYPE_METERS[type] || _REL_TYPE_METERS.unknown;
    const existing = byPair.get(key);
    if (existing) {
      // Explicit relationship entities (source === "entity") win on type/summary.
      if (source === "entity") {
        existing.type = type;
        if (summary) existing.summary = summary;
        if (typeof secret === "boolean") existing.secret = secret;
        Object.assign(existing, { strength: meters.strength, trust: meters.trust, conflict: meters.conflict });
      }
      if (chapter && !existing.chapters.includes(chapter)) existing.chapters.push(chapter);
      return existing;
    }
    const rec = {
      id: "rel-live-" + key,
      a, b, type,
      strength: meters.strength, trust: meters.trust, conflict: meters.conflict,
      secret: !!secret,
      summary: summary || `${castById[a].name} and ${castById[b].name}.`,
      chapters: chapter ? [chapter] : [],
    };
    byPair.set(key, rec);
    return rec;
  };

  // Source 1 — explicit relationship entities.
  for (const e of relEntities) {
    const d = e.data || {};
    let a = d.fromId, b = d.toId;
    if ((!a || !b) && Array.isArray(d.relatedEntityIds)) { a = a || d.relatedEntityIds[0]; b = b || d.relatedEntityIds[1]; }
    if (!a || !b) continue;
    const type = _normRelType(d.relationshipType || d.type || d.kind);
    const rec = addRel(a, b, type, {
      summary: d.summary || e.summary || null,
      secret: d.secret,
      source: "entity",
    });
    const quote = d.sourceQuote || d.quote || (d.evidence && d.evidence.quote);
    if (rec && quote) {
      evidence.push({ id: "ev-" + e.id, rel: rec.id, chapter: d.chapter || d.chapterNum || "?", quote: String(quote).replace(/^["']|["']$/g, ""), strength: _relLevelForConf(e.confidence || d.confidence) });
    }
  }

  // Source 2 — cast related-multi fields.
  for (const e of castEntities) {
    const d = e.data || {};
    for (const [field, kind] of _REL_CAST_FIELDS) {
      for (const otherId of _relIdList(d[field])) addRel(e.id, otherId, _normRelType(kind), { source: "cast" });
    }
  }

  // Hopes / fears straight off the cast entities.
  const hopesFears = {};
  for (const e of castEntities) {
    const d = e.data || {};
    const hopes = Array.isArray(d.hopes) ? d.hopes : (d.hopes ? [d.hopes] : []);
    const fears = Array.isArray(d.fears) ? d.fears : (d.fears ? [d.fears] : []);
    if (hopes.length || fears.length) hopesFears[e.id] = { hopes, fears };
  }

  // Review queue — pending relationship candidates.
  let review = [];
  try {
    review = (B.ReviewService?.listSync?.("relationships") || []).map((q) => ({
      id: q.id,
      lvl: _relLevelForConf(q.confidence),
      title: q.name || q.title || "Relationship candidate",
      excerpt: (q.sourceQuote || q.summary || q.excerpt || "").replace(/^["']|["']$/g, ""),
      cite: q.chapterNum ? ("Ch. " + q.chapterNum) : (q.chapterId || q.cite || ""),
      action: q.suggestedAction === "update" ? "Update relationship" : "New relationship candidate",
    }));
  } catch (_e) {}

  return {
    live: true,
    cast,
    castById,
    relationships: Array.from(byPair.values()),
    evidence,
    changes: [], // live change-tracking lands with the timeline pass
    review,
    hopesFears,
  };
};

// Context so every view reads the same model without prop-drilling.
const RelModelContext = React.createContext(null);
const useRelModel = () => {
  const live = React.useContext(RelModelContext);
  if (live && live.live) return live;
  // Demo fallback — the design's populated state.
  return {
    live: false,
    cast: (window.ATLAS_CAST || []),
    castById: _castById(),
    relationships: RELATIONSHIPS,
    evidence: REL_EVIDENCE,
    changes: REL_CHANGES,
    review: REL_REVIEW,
    hopesFears: REL_HOPES_FEARS,
  };
};

const REL_MODES = [
  { id: "single",   label: "Single",      icon: "user" },
  { id: "compare",  label: "Compare 2",   icon: "link" },
  { id: "network",  label: "Network",     icon: "branch" },
  { id: "timeline", label: "History",     icon: "clock" },
  { id: "conflict", label: "Conflict",    icon: "warn" },
  { id: "review",   label: "Review",      icon: "bell" },
];

// ---------------------------------------------------------------------
// Meter — small bar that shows strength / trust / conflict.
// ---------------------------------------------------------------------
const RelMeter = ({ k, v, tone = "neutral" }) => (
  <div className="rel-meter">
    <span className="rel-meter__k">{k}</span>
    <div className={"rel-meter__bar rel-meter__bar--" + tone}>
      <span className="rel-meter__fill" style={{ width: v + "%" }}/>
    </div>
    <span className="rel-meter__v">{v}</span>
  </div>
);

// ---------------------------------------------------------------------
// RelAvatar
// ---------------------------------------------------------------------
const RelAvatar = ({ cast, size = 28 }) => (
  <span className="rel-avatar" style={{ "--c": cast.color, width: size, height: size, fontSize: size * 0.32 }}>
    {cast.initials}
  </span>
);

// ---------------------------------------------------------------------
// Single character view
// ---------------------------------------------------------------------
const RelSingleView = ({ characterId, onSelectCharacter, onCompare }) => {
  const M = useRelModel();
  const cast = M.castById;
  const c = cast[characterId];
  if (!c) return <div style={{ padding: 16, color: "var(--ink-3)" }}>Pick a character to begin.</div>;

  const rels = M.relationships.filter((r) => r.a === characterId || r.b === characterId);
  const groups = {};
  for (const r of rels) {
    const k = r.type;
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  }

  const hf = M.hopesFears[characterId] || { hopes: [], fears: [] };

  return (
    <div className="rel-single">
      <div className="rel-single__hero">
        <RelAvatar cast={c} size={56}/>
        <div>
          <div className="rel-single__name">{c.name}</div>
          <div className="rel-single__role">{c.role}</div>
        </div>
        <div className="rel-single__quick">
          <span><b>{rels.length}</b> relationships</span>
          <span><b>{rels.filter((r) => r.secret).length}</b> secret</span>
          <span><b>{rels.filter((r) => r.conflict > 60).length}</b> high-conflict</span>
        </div>
      </div>

      <div className="rel-grid">
        {Object.entries(groups).map(([type, items]) => {
          const t = REL_TYPES[type];
          return (
            <div key={type} className="rel-group" style={{ "--c": t.color }}>
              <div className="rel-group__head">
                <span className="rel-group__dot"/>
                <span>{t.label}s</span>
                <span className="rel-group__n">{items.length}</span>
              </div>
              {items.map((r) => {
                const other = cast[r.a === characterId ? r.b : r.a];
                return (
                  <button key={r.id} className="rel-card" onClick={() => onCompare(characterId, other.id)}>
                    <RelAvatar cast={other}/>
                    <div className="rel-card__main">
                      <div className="rel-card__name">
                        {other.name}
                        {r.secret && <span className="rel-card__secret" title="Secret">⬛</span>}
                      </div>
                      <div className="rel-card__sum">{r.summary}</div>
                      {r.chapters && r.chapters.length > 0 && (
                        <div className="rel-card__chapters">Ch. {r.chapters.join(", ")}</div>
                      )}
                    </div>
                    <div className="rel-card__meters">
                      <span className="rel-card__meter" title="Strength" style={{ "--w": r.strength + "%", "--c": t.color }}/>
                      <span className="rel-card__meter rel-card__meter--trust" title="Trust" style={{ "--w": r.trust + "%" }}/>
                      <span className="rel-card__meter rel-card__meter--conflict" title="Conflict" style={{ "--w": r.conflict + "%" }}/>
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="rel-twocol">
        <div className="rel-section">
          <div className="rel-section__head">Hopes</div>
          <ul className="rel-bullets">{hf.hopes.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </div>
        <div className="rel-section">
          <div className="rel-section__head">Fears</div>
          <ul className="rel-bullets">{hf.fears.map((h, i) => <li key={i}>{h}</li>)}</ul>
        </div>
      </div>

      <div className="rel-section">
        <div className="rel-section__head">
          Recent relationship changes
          <span style={{ flex: 1 }}/>
          <button className="rel-section__more" data-callback="onOpenRelationshipTimeline">All changes →</button>
        </div>
        {M.changes.filter((rc) => {
          const rel = M.relationships.find((r) => r.id === rc.rel);
          return rel && (rel.a === characterId || rel.b === characterId);
        }).slice(0, 4).map((rc) => {
          const rel = M.relationships.find((r) => r.id === rc.rel);
          if (!rel) return null;
          const other = cast[rel.a === characterId ? rel.b : rel.a];
          if (!other) return null;
          return (
            <div key={rc.id} className="rel-change">
              <div className="rel-change__head">
                <RelAvatar cast={other} size={20}/>
                <span className="rel-change__who">{other.name}</span>
                <span className="rel-change__kind">{rc.kind}</span>
                <span className="rel-change__date">{rc.date}</span>
              </div>
              <div className="rel-change__note">{rc.note}</div>
              <div className="rel-change__delta">
                {rc.kind === "new"   && <span>+ new relationship: <b>{rc.to}</b></span>}
                {rc.kind === "type"  && <span>{rc.from} → <b>{rc.to}</b></span>}
                {rc.kind === "trust" && <span>trust {rc.from} → <b>{rc.to}</b></span>}
                {rc.kind === "conflict" && <span>conflict {rc.from} → <b>{rc.to}</b></span>}
                {rc.kind === "secret" && <span>secret: {String(rc.from)} → <b>{String(rc.to)}</b></span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Compare view (2 characters)
// ---------------------------------------------------------------------
const RelCompareView = ({ aId, bId, onSelectCharacter }) => {
  const M = useRelModel();
  const cast = M.castById;
  const a = cast[aId], b = cast[bId];
  if (!a || !b) return <div style={{ padding: 16 }}>Pick two characters.</div>;

  const rel = M.relationships.find((r) =>
    (r.a === aId && r.b === bId) || (r.a === bId && r.b === aId));
  const evidence = M.evidence.filter((e) => rel && e.rel === rel.id);
  const changes = M.changes.filter((c) => rel && c.rel === rel.id);
  const t = rel ? REL_TYPES[rel.type] : REL_TYPES.unknown;

  return (
    <div className="rel-compare">
      <div className="rel-compare__heads">
        <button className="rel-compare__head" onClick={() => onSelectCharacter(aId)} style={{ "--c": a.color }}>
          <RelAvatar cast={a} size={48}/>
          <div className="rel-compare__name">{a.name}</div>
          <div className="rel-compare__role">{a.role}</div>
        </button>
        <div className="rel-compare__type" style={{ "--c": t.color }}>
          <div className="rel-compare__type-dot"/>
          <div className="rel-compare__type-lbl">{t.label}</div>
          {rel?.secret && <div className="rel-compare__type-secret">SECRET</div>}
        </div>
        <button className="rel-compare__head" onClick={() => onSelectCharacter(bId)} style={{ "--c": b.color }}>
          <RelAvatar cast={b} size={48}/>
          <div className="rel-compare__name">{b.name}</div>
          <div className="rel-compare__role">{b.role}</div>
        </button>
      </div>

      {rel ? (
        <>
          <p className="rel-compare__sum">{rel.summary}</p>
          <div className="rel-compare__meters">
            <RelMeter k="Strength" v={rel.strength} tone="strength"/>
            <RelMeter k="Trust"    v={rel.trust}    tone="trust"/>
            <RelMeter k="Conflict" v={rel.conflict} tone="conflict"/>
          </div>

          <div className="rel-compare__cols">
            <div className="rel-section">
              <div className="rel-section__head">Evidence</div>
              {evidence.map((e) => (
                <div key={e.id} className="rel-quote">
                  <div className="rel-quote__cite">Ch. {e.chapter}</div>
                  <p>"{e.quote}"</p>
                </div>
              ))}
              {evidence.length === 0 && <div className="rel-empty">No source evidence yet.</div>}
              <button className="rel-add" data-callback="onAddRelationshipEvidence">+ Add evidence</button>
            </div>
            <div className="rel-section">
              <div className="rel-section__head">Timeline of changes</div>
              {changes.map((c) => (
                <div key={c.id} className="rel-change">
                  <div className="rel-change__head">
                    <span className="rel-change__kind">{c.kind}</span>
                    <span style={{ flex: 1 }}/>
                    <span className="rel-change__date">Ch. {c.chapter}</span>
                  </div>
                  <div className="rel-change__note">{c.note}</div>
                </div>
              ))}
              {changes.length === 0 && <div className="rel-empty">No tracked changes yet.</div>}
            </div>
          </div>

          <div className="rel-compare__actions">
            <button data-callback="onChangeRelationshipType">Change type</button>
            <button data-callback="onCreateEventFromRelationship">Create event</button>
            <button data-callback="onOpenAtlasForSharedLocations">Show shared places</button>
            <button data-callback="onOpenCharacterDossier">Open both dossiers</button>
          </div>
        </>
      ) : (
        <div className="rel-empty rel-empty--lg">
          No tracked relationship between {a.name} and {b.name} yet.
          <button data-callback="onCreateRelationship" className="rel-add">+ Create</button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Network graph view — force-style layout (precomputed positions).
// ---------------------------------------------------------------------
const RelNetworkView = ({ onSelectCharacter, onCompare }) => {
  const M = useRelModel();
  const cast = M.castById;
  // Circular layout — deterministic. For the demo state we keep the hand-
  // placed positions; for a live cast we lay actors on a ring so any number
  // of characters graphs cleanly.
  const DEMO_POS = {
    aelinor: { x: 50, y: 30 }, saren: { x: 78, y: 50 }, brec: { x: 30, y: 52 },
    mara: { x: 72, y: 78 }, auger: { x: 22, y: 78 }, dav: { x: 50, y: 86 },
  };
  const ids = M.cast.map((c) => c.id);
  const positions = (!M.live && ids.every((id) => DEMO_POS[id]))
    ? DEMO_POS
    : Object.fromEntries(ids.map((id, i) => {
        const n = Math.max(ids.length, 1);
        const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
        return [id, { x: 50 + Math.cos(ang) * 32, y: 50 + Math.sin(ang) * 34 }];
      }));
  const W = 800, H = 540;

  return (
    <div className="rel-net">
      <svg viewBox={`0 0 ${W} ${H}`} className="rel-net__svg">
        <defs>
          <pattern id="rel-net-grain" patternUnits="userSpaceOnUse" width="4" height="4">
            <circle cx="2" cy="2" r="0.5" fill="rgba(120,96,60,0.10)"/>
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#rel-net-grain)" opacity="0.5"/>

        {/* Faint zodiac ring backdrop */}
        <circle cx={W / 2} cy={H / 2} r={180} fill="none"
                stroke="rgba(74,56,28,0.15)" strokeWidth="0.6" strokeDasharray="2 5"/>

        {/* Edges */}
        {M.relationships.map((r) => {
          const pa = positions[r.a], pb = positions[r.b];
          if (!pa || !pb) return null;
          const t = REL_TYPES[r.type];
          const sw = 0.5 + (r.strength / 100) * 3;
          const op = 0.35 + (r.strength / 100) * 0.4;
          return (
            <g key={r.id}>
              <line x1={(pa.x / 100) * W} y1={(pa.y / 100) * H}
                    x2={(pb.x / 100) * W} y2={(pb.y / 100) * H}
                    stroke={t.color}
                    strokeWidth={sw}
                    strokeOpacity={op}
                    strokeDasharray={r.secret ? "4 4" : "0"}/>
              {r.conflict > 60 && (
                <circle cx={((pa.x + pb.x) / 2 / 100) * W}
                        cy={((pa.y + pb.y) / 2 / 100) * H}
                        r={6 + (r.conflict / 100) * 6}
                        fill="#a8553f" opacity="0.18"/>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {Object.entries(positions).map(([id, p]) => {
          const c = cast[id];
          if (!c) return null;
          const x = (p.x / 100) * W, y = (p.y / 100) * H;
          return (
            <g key={id} transform={`translate(${x}, ${y})`}
               onClick={() => onSelectCharacter(id)}
               style={{ cursor: "pointer" }}>
              <circle r="36" fill="#fff" stroke={c.color} strokeWidth="2"/>
              <circle r="30" fill={c.color}/>
              <text textAnchor="middle" dominantBaseline="central"
                    fontFamily="var(--font-display)" fontWeight="700"
                    fontSize="16" fill="#fff">
                {c.initials}
              </text>
              <text y="58" textAnchor="middle"
                    fontFamily="var(--font-display)" fontSize="13" fill="#2a2218"
                    fontWeight="600">
                {c.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="rel-net__legend">
        {Object.values(REL_TYPES).filter((t) => M.relationships.some((r) => r.type === t.id)).map((t) => (
          <span key={t.id} className="rel-net__chip">
            <span className="rel-net__chip-sw" style={{ background: t.color }}/>
            {t.label}
          </span>
        ))}
        <span className="rel-net__chip rel-net__chip--secret">— — secret</span>
        <span className="rel-net__chip">
          <span className="rel-net__chip-sw" style={{ background: "#a8553f", opacity: 0.4 }}/>
          conflict heat
        </span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Timeline (relationship changes across chapters)
// ---------------------------------------------------------------------
const RelTimelineView = () => {
  const M = useRelModel();
  const cast = M.castById;
  const grouped = {};
  for (const c of M.changes) {
    grouped[c.chapter] = grouped[c.chapter] || [];
    grouped[c.chapter].push(c);
  }
  if (!M.changes.length) return <div className="rel-empty rel-empty--lg">No relationship changes tracked yet. Changes appear here as characters' bonds shift across chapters.</div>;
  return (
    <div className="rel-tl">
      {Object.entries(grouped).sort((a, b) => Number(a[0]) - Number(b[0])).map(([ch, changes]) => (
        <div key={ch} className="rel-tl__chapter">
          <div className="rel-tl__chap-head">Ch. {ch}</div>
          <div className="rel-tl__list">
            {changes.map((c) => {
              const rel = M.relationships.find((r) => r.id === c.rel);
              if (!rel) return null;
              const a = cast[rel.a], b = cast[rel.b];
              if (!a || !b) return null;
              return (
                <div key={c.id} className="rel-tl__card">
                  <div className="rel-tl__heads">
                    <RelAvatar cast={a} size={20}/>
                    <Icon name="link" size={11}/>
                    <RelAvatar cast={b} size={20}/>
                    <span className="rel-tl__rel">{a.name} ↔ {b.name}</span>
                    <span className="rel-tl__kind">{c.kind}</span>
                  </div>
                  <div className="rel-tl__note">{c.note}</div>
                  <div className="rel-tl__delta">
                    {c.kind === "new"   && <span>+ new <b>{c.to}</b> relationship</span>}
                    {c.kind === "type"  && <span>{c.from} → <b>{c.to}</b></span>}
                    {c.kind === "trust" && <span>trust {c.from} → <b>{c.to}</b></span>}
                    {c.kind === "conflict" && <span>conflict {c.from} → <b>{c.to}</b></span>}
                    {c.kind === "secret" && <span>secret revealed</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// Conflict heat view
// ---------------------------------------------------------------------
const RelConflictView = ({ onCompare }) => {
  const M = useRelModel();
  const cast = M.castById;
  const conflicts = M.relationships.filter((r) => r.conflict > 40).sort((a, b) => b.conflict - a.conflict);
  return (
    <div className="rel-conflict">
      {conflicts.map((r) => {
        const a = cast[r.a], b = cast[r.b];
        if (!a || !b) return null;
        const t = REL_TYPES[r.type];
        return (
          <button key={r.id} className="rel-conflict__row" onClick={() => onCompare(r.a, r.b)}
                  style={{ "--c": t.color }}>
            <RelAvatar cast={a} size={28}/>
            <span className="rel-conflict__between">vs</span>
            <RelAvatar cast={b} size={28}/>
            <div className="rel-conflict__main">
              <div className="rel-conflict__title">{a.name} · {b.name}</div>
              <div className="rel-conflict__sub">{r.summary}</div>
            </div>
            <div className="rel-conflict__heat" style={{ "--w": r.conflict + "%" }}>
              <span/>{r.conflict}
            </div>
          </button>
        );
      })}
      {conflicts.length === 0 && <div className="rel-empty">No active high-conflict relationships.</div>}
    </div>
  );
};

// ---------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------
const RelReviewView = () => {
  const M = useRelModel();
  if (!M.review.length) return <div className="rel-empty rel-empty--lg">No relationship candidates in review. Run extraction over a chapter to surface new bonds here.</div>;
  return (
  <div className="rel-review">
    {M.review.map((r) => (
      <div key={r.id} className={"rel-review__card rel-review__card--" + r.lvl}>
        <div className="rel-review__head">
          <ConfidenceBadge level={r.lvl}/>
          <span className="rel-review__title">{r.title}</span>
        </div>
        {r.excerpt && <p className="rel-review__quote">"{r.excerpt}"</p>}
        <div className="rel-review__meta">{r.cite}</div>
        <div className="rel-review__pill">{r.action}</div>
        <div className="rel-review__actions">
          <button data-callback="onAcceptRelationshipQueueItem" data-id={r.id}>Accept</button>
          <button data-callback="onEditRelationshipQueueItem" data-id={r.id}>Edit</button>
          <button data-callback="onMergeRelationshipQueueItem" data-id={r.id}>Merge</button>
          <button data-callback="onDenyRelationshipQueueItem" data-id={r.id}>Deny</button>
        </div>
      </div>
    ))}
  </div>
  );
};

// ---------------------------------------------------------------------
// RelationshipsPanelBody — entry point
// ---------------------------------------------------------------------
const RelationshipsPanelBody = ({ panel }) => {
  const [mode, setMode] = _re_us("single");

  // Rebuild the live model when the entity / review store changes.
  const [storeVersion, setStoreVersion] = _re_us(0);
  React.useEffect(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:review-queue-updated", "lw:occurrences-updated", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  const model = _re_um(() => buildLiveRelModel(), [storeVersion]);
  const cast = (model.live ? model.cast : (window.ATLAS_CAST || []));

  // Default the focus + compare characters to whatever the model actually has.
  const firstId = (cast.find((c) => c.role === "protagonist") || cast[0])?.id || null;
  const secondId = cast[1]?.id || firstId;
  const [characterId, setCharacterId] = _re_us(firstId);
  const [compareWith, setCompareWith] = _re_us(secondId);

  // Keep the selection valid as the cast changes (e.g. first live load).
  React.useEffect(() => {
    if (!cast.length) return;
    if (!cast.some((c) => c.id === characterId)) setCharacterId(firstId);
    if (!cast.some((c) => c.id === compareWith)) setCompareWith(secondId);
  }, [cast]); // eslint-disable-line

  const onCompare = _re_uc((a, b) => {
    setCharacterId(a); setCompareWith(b); setMode("compare");
  }, []);
  const onSelectCharacter = _re_uc((id) => { setCharacterId(id); setMode("single"); }, []);

  const reviewCount = (model.live ? model.review : REL_REVIEW).length;

  return (
    <RelModelContext.Provider value={model}>
    <div className="rel" data-ui="RelationshipsPanelBody">
      <div className="rel-bar">
        <div className="rel-bar__modes">
          {REL_MODES.map((m) => (
            <button key={m.id} className={"rel-bar__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => setMode(m.id)} data-callback="onSetRelationshipMode" data-mode={m.id}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              {m.id === "review" && reviewCount > 0 && <span className="rel-bar__q">{reviewCount}</span>}
            </button>
          ))}
        </div>
        <div className="rel-bar__cast">
          {cast.map((c) => (
            <button key={c.id}
                    className={"rel-bar__cast-b" + (characterId === c.id ? " is-on" : "") + (mode === "compare" && compareWith === c.id ? " is-pair" : "")}
                    onClick={() => mode === "compare" ? setCompareWith(c.id) : setCharacterId(c.id)}
                    style={{ "--c": c.color }}
                    title={c.name + (mode === "compare" ? " — pick as second" : "")}>
              <RelAvatar cast={c} size={22}/>
              <span>{(c.name || "").split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rel-body">
        {!cast.length ? (
          <div className="rel-empty rel-empty--lg">No cast yet. Add characters to your project and their bonds will graph here.</div>
        ) : (<>
          {mode === "single"   && <RelSingleView characterId={characterId} onSelectCharacter={onSelectCharacter} onCompare={onCompare}/>}
          {mode === "compare"  && <RelCompareView aId={characterId} bId={compareWith} onSelectCharacter={onSelectCharacter}/>}
          {mode === "network"  && <RelNetworkView onSelectCharacter={onSelectCharacter} onCompare={onCompare}/>}
          {mode === "timeline" && <RelTimelineView/>}
          {mode === "conflict" && <RelConflictView onCompare={onCompare}/>}
          {mode === "review"   && <RelReviewView/>}
        </>)}
      </div>
    </div>
    </RelModelContext.Provider>
  );
};

Object.assign(window, {
  RELATIONSHIPS, REL_EVIDENCE, REL_CHANGES, REL_REVIEW, REL_TYPES, REL_MODES,
  buildLiveRelModel,
  RelationshipsPanelBody, RelSingleView, RelCompareView, RelNetworkView,
  RelTimelineView, RelConflictView, RelReviewView,
});

// =====================================================================
// relationships.jsx — Relationships workspace (LIVE).
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
// Area 4: this panel now renders LIVE data. Cast come from the "cast"
// entity collection; relationships from the "relationships" collection
// (data.fromId / data.toId / data.relationshipType) UNION the per-cast
// related-multi fields (family / lovers / allies / mentors / rivals /
// enemies). Meters, shared chapters, and evidence are derived from real
// EntityOccurrence records; the review tab is the live relationship
// review queue and its Accept / Edit / Merge / Deny run the real
// generic handlers. Everything degrades gracefully to empty states when
// a fresh project has no cast / no relationships / no manuscript.
// =====================================================================

const { useState: _re_us, useMemo: _re_um, useCallback: _re_uc, useEffect: _re_ue } = React;

// ---------------------------------------------------------------------
// Relationship type vocabulary (kind → label + colour).
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

// Map arbitrary persisted `relationshipType` strings (verbs from the
// offline detector, editor picks, or per-cast field kinds) → a canonical
// REL_TYPES key. Anything unrecognised falls to "unknown".
const _REL_TYPE_ALIASES = {
  friend: "friend", friends: "friend", ally: "friend", allies: "friend", befriend: "friend",
  loyal: "friend", "loyal-to": "friend", sworn: "friend", "sworn-to": "friend", trusts: "friend",
  helps: "friend", saves: "friend", protects: "friend", serves: "friend", companion: "friend",
  enemy: "enemy", enemies: "enemy", foe: "enemy", hates: "enemy", kills: "enemy", killed: "enemy",
  fights: "enemy", fought: "enemy", betrays: "enemy", betrayed: "enemy", opposes: "enemy",
  attacks: "enemy", attacked: "enemy", wounds: "enemy", threatens: "enemy",
  family: "family", sister: "family", brother: "family", father: "family", mother: "family",
  cousin: "family", "sister-in-law": "family", "brother-in-law": "family", kin: "family",
  son: "family", daughter: "family", parent: "family", child: "family", uncle: "family", aunt: "family",
  lover: "lover", lovers: "lover", loves: "lover", loved: "lover", married: "lover", spouse: "lover",
  wife: "lover", husband: "lover", romance: "lover", courts: "lover", betrothed: "lover",
  rival: "rival", rivals: "rival", competes: "rival", envies: "rival",
  mentor: "mentor", mentors: "mentor", teaches: "mentor", trains: "mentor", trained: "mentor",
  "ward-of": "mentor", student: "mentor", apprentice: "mentor", guides: "mentor", master: "mentor",
  faction: "faction", allied: "faction", member: "faction",
};
const _relTypeNorm = (raw) => {
  const k = String(raw || "").toLowerCase().trim();
  if (!k) return "unknown";
  if (_REL_TYPE_ALIASES[k]) return _REL_TYPE_ALIASES[k];
  return REL_TYPES[k] ? k : "unknown";
};

// Per-cast related-multi field → relationship type (mirrors cast.jsx).
const _REL_CAST_FIELDS = [
  ["family",  "family"],
  ["lovers",  "lover"],
  ["allies",  "friend"],
  ["mentors", "mentor"],
  ["rivals",  "rival"],
  ["enemies", "enemy"],
];

const REL_MODES = [
  { id: "single",   label: "Single",      icon: "user" },
  { id: "compare",  label: "Compare 2",   icon: "link" },
  { id: "network",  label: "Network",     icon: "branch" },
  { id: "timeline", label: "History",     icon: "clock" },
  { id: "conflict", label: "Conflict",    icon: "warn" },
  { id: "review",   label: "Review",      icon: "bell" },
];

// ---------------------------------------------------------------------
// Live helpers — avatar colour / initials, meter derivation.
// ---------------------------------------------------------------------

// Persisted cast entities carry no colour; derive a stable parchment-safe
// hue from the entity id so the network graph and avatars are consistent
// across renders.
const _REL_PALETTE = ["#7a5c9e", "#3e6db5", "#5d6d4e", "#a8553f", "#8a6a2a",
  "#b86a82", "#3d3a78", "#2c7a6b", "#c98a2c", "#6a4e8a", "#4a7a4a", "#a05a7a"];
const _relColor = (id) => {
  const s = String(id || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return _REL_PALETTE[h % _REL_PALETTE.length];
};
const _relInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || parts[0]?.[1] || "";
  return (a + b).toUpperCase() || "?";
};

const _relNum = (v, fallback) => (typeof v === "number" && !Number.isNaN(v) ? Math.max(0, Math.min(100, Math.round(v))) : fallback);

// Sensible baseline meters per type when nothing is persisted. Strength is
// derived from how many chapters the pair actually co-occurs in (a real
// signal); trust / conflict follow the relationship type.
const _REL_TYPE_METERS = {
  friend:  { trust: 82, conflict: 14 },
  family:  { trust: 68, conflict: 34 },
  lover:   { trust: 78, conflict: 24 },
  mentor:  { trust: 76, conflict: 18 },
  rival:   { trust: 38, conflict: 72 },
  enemy:   { trust: 10, conflict: 86 },
  faction: { trust: 52, conflict: 40 },
  unknown: { trust: 50, conflict: 30 },
};
const _deriveMeters = (type, sharedCount, data) => {
  const base = _REL_TYPE_METERS[type] || _REL_TYPE_METERS.unknown;
  return {
    trust:    _relNum(data.trust, base.trust),
    conflict: _relNum(data.conflict, base.conflict),
    strength: _relNum(data.strength, Math.min(95, 28 + sharedCount * 16)),
  };
};

// Split a free-text or array field (goals / hopes / fears) into a clean
// list of short strings.
const _relSplitList = (v) => {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : String(v).split(/[\n;]+|(?:,\s)/);
  return arr.map((x) => (typeof x === "string" ? x : (x && (x.label || x.name || x.text))))
    .map((s) => (s ? String(s).trim() : "")).filter(Boolean).slice(0, 6);
};

// Resolve a related / related-multi value (picker objects or bare ids) to
// an array of ids.
const _relResolveIds = (raw) => {
  if (raw == null) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  const out = [];
  for (const v of arr) {
    const id = typeof v === "string" ? v : (v && v.id) || null;
    if (id) out.push(id);
  }
  return out;
};

const _relPairKey = (a, b) => (a < b ? a + "|" + b : b + "|" + a);

// ---------------------------------------------------------------------
// buildRelationshipsModel — one pass over the live store → everything the
// views need. Cheap enough to recompute on each store event.
// ---------------------------------------------------------------------
const buildRelationshipsModel = () => {
  const empty = { cast: [], castById: {}, relationships: [], reviewQueue: [], changes: [],
    chapters: [], chapterIndex: new Map(), occByEntity: new Map(), hasBackend: false };
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  if (!B || !B.EntityService) return empty;

  // --- Cast ---
  let castEntities = [];
  try { castEntities = B.EntityService.listSync("cast") || []; } catch (_) {}
  const castById = {};
  for (const e of castEntities) {
    if (!e || !e.id) continue;
    const d = e.data || {};
    castById[e.id] = {
      id: e.id,
      name: e.name || "Unnamed",
      initials: e.glyphChar || _relInitials(e.name),
      color: _relColor(e.id),
      role: String(d.role || "").toLowerCase() || "supporting",
      _data: d,
    };
  }
  const cast = Object.values(castById);

  // --- Chapters ---
  const chapterIndex = new Map();
  let chapters = [];
  try {
    const state = B.ManuscriptChapterService?.loadSync?.() || {};
    chapters = (state.chapters || []).filter((c) => !c.reserved);
    chapters.forEach((c, i) => chapterIndex.set(c.id, { index: i, num: c.num || (i + 1), title: c.title || "", id: c.id }));
  } catch (_) {}

  // --- Occurrences grouped by entity + set of chapter nums per entity ---
  const occByEntity = new Map();
  const chapterNumsByEntity = new Map();
  try {
    const occs = B.OccurrenceService?.listAllSync?.() || [];
    for (const o of occs) {
      if (!o || !o.entityId) continue;
      const list = occByEntity.get(o.entityId) || [];
      list.push(o);
      occByEntity.set(o.entityId, list);
      const num = chapterIndex.get(o.chapterId)?.num;
      if (num != null) {
        const set = chapterNumsByEntity.get(o.entityId) || new Set();
        set.add(num);
        chapterNumsByEntity.set(o.entityId, set);
      }
    }
  } catch (_) {}
  const sharedChapters = (a, b) => {
    const sa = chapterNumsByEntity.get(a), sb = chapterNumsByEntity.get(b);
    if (!sa || !sb) return [];
    return [...sa].filter((n) => sb.has(n)).sort((x, y) => x - y);
  };

  // --- Collect raw edges (persisted records first, then per-cast fields) ---
  // pairKey → { a, b, type, secret, summary, recordId, data }
  const edges = new Map();
  const addEdge = (aId, bId, type, opts = {}) => {
    if (!aId || !bId || aId === bId) return;
    if (!castById[aId] || !castById[bId]) return; // only cast↔cast edges
    const key = _relPairKey(aId, bId);
    const existing = edges.get(key);
    if (existing) {
      // Persisted record wins on identity; keep its type/record.
      if (opts.recordId && !existing.recordId) {
        existing.recordId = opts.recordId;
        existing.type = type;
        existing.summary = opts.summary || existing.summary;
        existing.secret = !!opts.secret || existing.secret;
        existing.data = opts.data || existing.data;
      }
      return;
    }
    // Canonical direction: alpha order so a/b are stable.
    const [a, b] = aId < bId ? [aId, bId] : [bId, aId];
    edges.set(key, {
      a, b, type, secret: !!opts.secret,
      summary: opts.summary || "", recordId: opts.recordId || null,
      data: opts.data || {},
    });
  };

  // Persisted "relationships" records.
  let relEntities = [];
  try { relEntities = B.EntityService.listSync("relationships") || []; } catch (_) {}
  for (const e of relEntities) {
    if (!e) continue;
    const d = e.data || {};
    const fromId = d.fromId || e.fromId || null;
    const toId = d.toId || e.toId || null;
    const type = _relTypeNorm(d.relationshipType || e.relationshipType || d.type || e.type);
    addEdge(fromId, toId, type, { recordId: e.id, summary: e.summary || d.summary || "", secret: !!d.secret, data: { ...d, strength: d.strength ?? e.strength, trust: d.trust, conflict: d.conflict } });
  }

  // Per-cast related-multi fields.
  for (const c of cast) {
    const d = c._data || {};
    for (const [field, type] of _REL_CAST_FIELDS) {
      for (const otherId of _relResolveIds(d[field])) addEdge(c.id, otherId, type, {});
    }
  }

  // --- Materialise relationships with derived meters + chapters ---
  const relationships = [];
  let relSeq = 0;
  for (const e of edges.values()) {
    const chs = sharedChapters(e.a, e.b);
    const meters = _deriveMeters(e.type, chs.length, e.data || {});
    const A = castById[e.a], Bc = castById[e.b];
    relationships.push({
      id: e.recordId || ("pair-" + (relSeq++)),
      recordId: e.recordId || null,
      a: e.a, b: e.b,
      type: e.type,
      strength: meters.strength,
      trust: meters.trust,
      conflict: meters.conflict,
      secret: e.secret,
      summary: e.summary || (A && Bc ? (A.name + " and " + Bc.name + " — " + (REL_TYPES[e.type]?.label || "Unknown").toLowerCase() + ".") : ""),
      chapters: chs,
      persisted: !!e.recordId,
      data: e.data || {},
    });
  }
  relationships.sort((x, y) => y.strength - x.strength);
  const relByPair = new Map(relationships.map((r) => [_relPairKey(r.a, r.b), r]));

  // --- Changes (History / recent). Persisted data.changes if present,
  // else a derived "first appeared together" event from the earliest
  // shared chapter — real, from occurrences. ---
  const changes = [];
  let chSeq = 0;
  for (const r of relationships) {
    const persistedChanges = Array.isArray(r.data.changes) ? r.data.changes : [];
    for (const pc of persistedChanges) {
      changes.push({
        id: "rc-" + (chSeq++), rel: r.id, chapter: pc.chapter || (r.chapters[0] ?? null),
        kind: pc.kind || "type", from: pc.from ?? null, to: pc.to ?? r.type,
        note: pc.note || "", date: pc.date || "",
      });
    }
    if (!persistedChanges.length && r.chapters.length) {
      changes.push({
        id: "rc-" + (chSeq++), rel: r.id, chapter: r.chapters[0],
        kind: "new", from: null, to: r.type,
        note: (castById[r.a]?.name || "?") + " and " + (castById[r.b]?.name || "?") + " first appear together.",
        date: "",
      });
    }
  }

  // --- Review queue (live pending relationship candidates) ---
  const reviewQueue = [];
  try {
    const q = B.ReviewService?.listSync?.("relationships") || [];
    for (const item of q) {
      if (item.status === "done" || item.status === "denied") continue;
      const conf = typeof item.confidence === "number" ? item.confidence : (typeof item.value === "number" ? item.value / 100 : 0.55);
      const pct = Math.round(conf * 100);
      const lvl = pct >= 85 ? "high" : pct >= 65 ? "strong" : pct >= 45 ? "uncertain" : "weak";
      const chNum = item.chapterId ? chapterIndex.get(item.chapterId)?.num : null;
      reviewQueue.push({
        id: item.id,
        entityType: "relationships",
        lvl,
        title: item.name || "Relationship candidate",
        action: item.suggestedAction === "update" ? "Update relationship" : "New relationship",
        excerpt: item.sourceQuote || (item.sourceQuotes && item.sourceQuotes[0]) || item.summary || "",
        cite: chNum ? ("Ch. " + chNum) : (item.reason || item.matchType || ""),
        _raw: item,
      });
    }
  } catch (_) {}

  const model = { cast, castById, relationships, relByPair, reviewQueue, changes,
    chapters, chapterIndex, occByEntity, sharedChapters, hasBackend: true };

  // Keep the diagnostics tweak-panel line (app.jsx) honest.
  try {
    window.RELATIONSHIPS = relationships;
    window.REL_CHANGES = changes;
    window.REL_REVIEW = reviewQueue;
  } catch (_) {}
  return model;
};

// Evidence for a pair — real source quotes from either participant in the
// chapters where they co-occur, plus any persisted data.evidence.
const relEvidenceFor = (rel, model) => {
  const out = [];
  const chapterSet = new Set(rel.chapters);
  const seen = new Set();
  for (const pid of [rel.a, rel.b]) {
    for (const o of (model.occByEntity.get(pid) || [])) {
      const num = model.chapterIndex.get(o.chapterId)?.num;
      if (num == null || !chapterSet.has(num)) continue;
      const text = String(o.exactText || "").trim();
      if (!text || seen.has(text)) continue;
      seen.add(text);
      out.push({ id: o.occurrenceId || (rel.id + "-" + out.length), chapter: num, quote: text });
      if (out.length >= 6) break;
    }
    if (out.length >= 6) break;
  }
  const persisted = Array.isArray(rel.data?.evidence) ? rel.data.evidence : [];
  for (const ev of persisted) {
    if (out.length >= 8) break;
    const quote = typeof ev === "string" ? ev : (ev && (ev.quote || ev.text));
    if (!quote || seen.has(quote)) continue;
    seen.add(quote);
    out.push({ id: rel.id + "-p" + out.length, chapter: (ev && ev.chapter) || null, quote: String(quote).trim() });
  }
  return out;
};

// Fire a callback through the live registry with a real detail payload.
const _relDispatch = (name, detail) => {
  try {
    if (typeof window.LoomwrightDispatchCallback === "function") window.LoomwrightDispatchCallback(name, { detail });
    else window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name, detail } }));
  } catch (_) {}
};
const _relOpenCastDossier = (id, label) => {
  window.dispatchEvent(new CustomEvent("lw:focus-entity", { detail: { panelKind: "cast", entityId: id, label } }));
};

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
  <span className="rel-avatar" style={{ "--c": (cast && cast.color) || "#76684c", width: size, height: size, fontSize: size * 0.32 }}>
    {(cast && cast.initials) || "?"}
  </span>
);

const RelEmptyPanel = ({ title, body }) => (
  <div className="rel-empty rel-empty--lg" style={{ margin: 16 }}>
    <div style={{ fontWeight: 600, marginBottom: 4 }}>{title}</div>
    <div style={{ color: "var(--ink-3)" }}>{body}</div>
  </div>
);

// ---------------------------------------------------------------------
// Single character view
// ---------------------------------------------------------------------
const RelSingleView = ({ model, characterId, onSelectCharacter, onCompare }) => {
  const cast = model.castById;
  const c = cast[characterId];
  if (!c) return <div style={{ padding: 16, color: "var(--ink-3)" }}>Pick a character to begin.</div>;

  const rels = model.relationships.filter((r) => r.a === characterId || r.b === characterId);
  const groups = {};
  for (const r of rels) {
    const k = r.type;
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  }

  const d = c._data || {};
  const hopes = _relSplitList(d.hopes || d.goals || d.wants);
  const fears = _relSplitList(d.fears);
  const recentChanges = model.changes.filter((rc) => {
    const rel = model.relationships.find((r) => r.id === rc.rel);
    return rel && (rel.a === characterId || rel.b === characterId);
  }).slice(0, 4);

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

      {rels.length === 0 && (
        <div className="rel-empty" style={{ margin: "12px 0" }}>
          No tracked relationships for {c.name} yet — accept relationship
          candidates in Review, or link allies / rivals / family from the
          character's dossier.
        </div>
      )}

      <div className="rel-grid">
        {Object.entries(groups).map(([type, items]) => {
          const t = REL_TYPES[type] || REL_TYPES.unknown;
          return (
            <div key={type} className="rel-group" style={{ "--c": t.color }}>
              <div className="rel-group__head">
                <span className="rel-group__dot"/>
                <span>{t.label}s</span>
                <span className="rel-group__n">{items.length}</span>
              </div>
              {items.map((r) => {
                const other = cast[r.a === characterId ? r.b : r.a];
                if (!other) return null;
                return (
                  <button key={r.id} className="rel-card" onClick={() => onCompare(characterId, other.id)}>
                    <RelAvatar cast={other}/>
                    <div className="rel-card__main">
                      <div className="rel-card__name">
                        {other.name}
                        {r.secret && <span className="rel-card__secret" title="Secret">⬛</span>}
                      </div>
                      <div className="rel-card__sum">{r.summary}</div>
                      <div className="rel-card__chapters">{r.chapters.length ? "Ch. " + r.chapters.join(", ") : "Not yet in the manuscript"}</div>
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

      {(hopes.length > 0 || fears.length > 0) && (
        <div className="rel-twocol">
          <div className="rel-section">
            <div className="rel-section__head">Hopes</div>
            {hopes.length ? <ul className="rel-bullets">{hopes.map((h, i) => <li key={i}>{h}</li>)}</ul>
              : <div className="rel-empty">No hopes recorded.</div>}
          </div>
          <div className="rel-section">
            <div className="rel-section__head">Fears</div>
            {fears.length ? <ul className="rel-bullets">{fears.map((h, i) => <li key={i}>{h}</li>)}</ul>
              : <div className="rel-empty">No fears recorded.</div>}
          </div>
        </div>
      )}

      <div className="rel-section">
        <div className="rel-section__head">
          Recent relationship changes
          <span style={{ flex: 1 }}/>
          <button className="rel-section__more" data-callback="onOpenRelationshipTimeline">All changes →</button>
        </div>
        {recentChanges.length === 0 && <div className="rel-empty">No tracked changes yet.</div>}
        {recentChanges.map((rc) => {
          const rel = model.relationships.find((r) => r.id === rc.rel);
          if (!rel) return null;
          const other = cast[rel.a === characterId ? rel.b : rel.a];
          if (!other) return null;
          return (
            <div key={rc.id} className="rel-change">
              <div className="rel-change__head">
                <RelAvatar cast={other} size={20}/>
                <span className="rel-change__who">{other.name}</span>
                <span className="rel-change__kind">{rc.kind}</span>
                {rc.date && <span className="rel-change__date">{rc.date}</span>}
              </div>
              <div className="rel-change__note">{rc.note}</div>
              <div className="rel-change__delta">
                {rc.kind === "new"   && <span>+ new relationship: <b>{rc.to}</b>{rc.chapter != null && <> · Ch. {rc.chapter}</>}</span>}
                {rc.kind === "type"  && <span>{String(rc.from)} → <b>{String(rc.to)}</b></span>}
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
const RelCompareView = ({ model, aId, bId, onSelectCharacter }) => {
  const cast = model.castById;
  const a = cast[aId], b = cast[bId];
  if (!a || !b) return <div style={{ padding: 16 }}>Pick two characters.</div>;

  const rel = model.relByPair.get(_relPairKey(aId, bId)) || null;
  const evidence = rel ? relEvidenceFor(rel, model) : [];
  const changes = rel ? model.changes.filter((c) => c.rel === rel.id) : [];
  const t = rel ? (REL_TYPES[rel.type] || REL_TYPES.unknown) : REL_TYPES.unknown;

  const editRel = () => {
    if (rel && rel.recordId) window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "relationships", initial: { id: rel.recordId }, mode: "full" } }));
    else _relDispatch("onCreateRelationship", { fromId: aId, toId: bId });
  };

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
                  <div className="rel-quote__cite">{e.chapter != null ? "Ch. " + e.chapter : "Source"}</div>
                  <p>"{e.quote}"</p>
                </div>
              ))}
              {evidence.length === 0 && <div className="rel-empty">No shared scenes in the manuscript yet.</div>}
            </div>
            <div className="rel-section">
              <div className="rel-section__head">Timeline of changes</div>
              {changes.map((c) => (
                <div key={c.id} className="rel-change">
                  <div className="rel-change__head">
                    <span className="rel-change__kind">{c.kind}</span>
                    <span style={{ flex: 1 }}/>
                    {c.chapter != null && <span className="rel-change__date">Ch. {c.chapter}</span>}
                  </div>
                  <div className="rel-change__note">{c.note}</div>
                </div>
              ))}
              {changes.length === 0 && <div className="rel-empty">No tracked changes yet.</div>}
            </div>
          </div>

          <div className="rel-compare__actions">
            <button onClick={editRel}>{rel.recordId ? "Edit relationship" : "Change type"}</button>
            <button data-callback="onCreateEventFromRelationship">Create event</button>
            <button onClick={() => { _relOpenCastDossier(aId, a.name); _relOpenCastDossier(bId, b.name); }}>Open both dossiers</button>
          </div>
        </>
      ) : (
        <div className="rel-empty rel-empty--lg">
          No tracked relationship between {a.name} and {b.name} yet.
          <button onClick={editRel} className="rel-add">+ Create</button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Network graph view — circular layout over the live cast that appear in
// at least one relationship (falls back to all cast).
// ---------------------------------------------------------------------
const RelNetworkView = ({ model, onSelectCharacter }) => {
  const cast = model.castById;
  const rels = model.relationships;
  // Node set: cast that participate in a relationship; else all cast.
  const participantIds = new Set();
  for (const r of rels) { participantIds.add(r.a); participantIds.add(r.b); }
  let nodeIds = [...participantIds].filter((id) => cast[id]);
  if (nodeIds.length === 0) nodeIds = model.cast.map((c) => c.id);
  nodeIds = nodeIds.slice(0, 24); // keep the graph legible

  const W = 800, H = 540;
  const cx = W / 2, cy = H / 2;
  const radius = Math.min(W, H) * (nodeIds.length <= 1 ? 0 : 0.36);
  const positions = {};
  nodeIds.forEach((id, i) => {
    const ang = (i / Math.max(1, nodeIds.length)) * Math.PI * 2 - Math.PI / 2;
    positions[id] = { x: cx + Math.cos(ang) * radius, y: cy + Math.sin(ang) * radius };
  });

  if (nodeIds.length === 0) {
    return <RelEmptyPanel title="No characters yet" body="Add cast to your project to see the relationship network."/>;
  }

  const shownRels = rels.filter((r) => positions[r.a] && positions[r.b]);

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
        <circle cx={cx} cy={cy} r={radius || 180} fill="none"
                stroke="rgba(74,56,28,0.15)" strokeWidth="0.6" strokeDasharray="2 5"/>

        {/* Edges */}
        {shownRels.map((r) => {
          const pa = positions[r.a], pb = positions[r.b];
          const t = REL_TYPES[r.type] || REL_TYPES.unknown;
          const sw = 0.5 + (r.strength / 100) * 3;
          const op = 0.35 + (r.strength / 100) * 0.4;
          return (
            <g key={r.id}>
              <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                    stroke={t.color} strokeWidth={sw} strokeOpacity={op}
                    strokeDasharray={r.secret ? "4 4" : "0"}/>
              {r.conflict > 60 && (
                <circle cx={(pa.x + pb.x) / 2} cy={(pa.y + pb.y) / 2}
                        r={6 + (r.conflict / 100) * 6} fill="#a8553f" opacity="0.18"/>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodeIds.map((id) => {
          const c = cast[id];
          if (!c) return null;
          const p = positions[id];
          return (
            <g key={id} transform={`translate(${p.x}, ${p.y})`}
               onClick={() => onSelectCharacter(id)} style={{ cursor: "pointer" }}>
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
        {Object.values(REL_TYPES).filter((t) => shownRels.some((r) => r.type === t.id)).map((t) => (
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
const RelTimelineView = ({ model }) => {
  const cast = model.castById;
  const grouped = {};
  for (const c of model.changes) {
    if (c.chapter == null) continue;
    grouped[c.chapter] = grouped[c.chapter] || [];
    grouped[c.chapter].push(c);
  }
  const chapterKeys = Object.keys(grouped);
  if (chapterKeys.length === 0) {
    return <RelEmptyPanel title="No relationship history yet" body="As characters share scenes and you accept relationship candidates, their changes appear here chapter by chapter."/>;
  }
  return (
    <div className="rel-tl">
      {chapterKeys.sort((a, b) => Number(a) - Number(b)).map((ch) => (
        <div key={ch} className="rel-tl__chapter">
          <div className="rel-tl__chap-head">Ch. {ch}</div>
          <div className="rel-tl__list">
            {grouped[ch].map((c) => {
              const rel = model.relationships.find((r) => r.id === c.rel);
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
                    {c.kind === "type"  && <span>{String(c.from)} → <b>{String(c.to)}</b></span>}
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
const RelConflictView = ({ model, onCompare }) => {
  const cast = model.castById;
  const conflicts = model.relationships.filter((r) => r.conflict > 40).sort((a, b) => b.conflict - a.conflict);
  return (
    <div className="rel-conflict">
      {conflicts.map((r) => {
        const a = cast[r.a], b = cast[r.b];
        if (!a || !b) return null;
        const t = REL_TYPES[r.type] || REL_TYPES.unknown;
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
// Review queue — live pending relationship candidates. Accept / Edit /
// Merge / Deny dispatch the real generic handlers with the queue item id.
// ---------------------------------------------------------------------
const RelReviewView = ({ model }) => {
  const queue = model.reviewQueue;
  if (queue.length === 0) {
    return <RelEmptyPanel title="No relationships to review" body="Run an extraction over a chapter — detected relationships between known characters land here for you to accept."/>;
  }
  return (
    <div className="rel-review">
      {queue.map((r) => (
        <div key={r.id} className={"rel-review__card rel-review__card--" + r.lvl}>
          <div className="rel-review__head">
            {typeof ConfidenceBadge !== "undefined" ? <ConfidenceBadge level={r.lvl}/> : <span className="rel-review__pill">{r.lvl}</span>}
            <span className="rel-review__title">{r.title}</span>
          </div>
          {r.excerpt && <p className="rel-review__quote">"{r.excerpt}"</p>}
          {r.cite && <div className="rel-review__meta">{r.cite}</div>}
          <div className="rel-review__pill">{r.action}</div>
          <div className="rel-review__actions">
            <button onClick={() => _relDispatch("onAcceptRelationshipQueueItem", r._raw)}>Accept</button>
            <button onClick={() => _relDispatch("onEditRelationshipQueueItem", r._raw)}>Edit</button>
            <button onClick={() => _relDispatch("onMergeRelationshipQueueItem", r._raw)}>Merge</button>
            <button onClick={() => _relDispatch("onDenyRelationshipQueueItem", r._raw)}>Deny</button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// RelationshipsPanelBody — entry point (LIVE).
// ---------------------------------------------------------------------
const RelationshipsPanelBody = ({ panel }) => {
  // Recompute the live model on any store event.
  const [storeVersion, setStoreVersion] = _re_us(0);
  _re_ue(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:manuscript-chapters-updated",
      "lw:occurrences-updated", "lw:review-queue-updated", "lw:set-active-chapter", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  const model = _re_um(() => buildRelationshipsModel(), [storeVersion]);

  // Cross-panel focus (Cast selected elsewhere) + a sensible default.
  const focusedCast = (typeof window !== "undefined" && window.focusedByType && window.focusedByType.cast) || null;
  const defaultChar = (panel && panel.selected && panel.selected.id)
    || (focusedCast && focusedCast.id)
    || (model.cast.find((c) => c.role === "protagonist" || c.role === "hero")?.id)
    || model.cast[0]?.id
    || null;

  const [mode, setMode] = _re_us("single");
  const [characterId, setCharacterId] = _re_us(defaultChar);
  const [compareWith, setCompareWith] = _re_us(null);

  // Keep selection valid as the live cast changes; follow external focus.
  _re_ue(() => {
    if (!model.cast.length) return;
    if (!characterId || !model.castById[characterId]) setCharacterId(defaultChar);
  }, [storeVersion]); // eslint-disable-line
  _re_ue(() => {
    if (focusedCast && focusedCast.id && model.castById[focusedCast.id]) {
      setCharacterId(focusedCast.id);
      setMode((m) => (m === "compare" ? m : "single"));
    }
  }, [focusedCast && focusedCast.id]); // eslint-disable-line

  const onCompare = _re_uc((a, b) => { setCharacterId(a); setCompareWith(b); setMode("compare"); }, []);
  const onSelectCharacter = _re_uc((id) => { setCharacterId(id); setMode("single"); }, []);

  const cast = model.cast;

  if (!model.hasBackend) {
    return <div className="rel" data-ui="RelationshipsPanelBody"><RelEmptyPanel title="Loading…" body="Waiting for the project store."/></div>;
  }
  if (cast.length === 0) {
    return (
      <div className="rel" data-ui="RelationshipsPanelBody">
        <RelEmptyPanel title="No characters yet"
          body="Add characters to your cast (or extract them from the manuscript) and their relationships will map out here."/>
      </div>
    );
  }

  // Ensure a compare partner exists when entering compare mode.
  const partner = compareWith && model.castById[compareWith] ? compareWith
    : (cast.find((c) => c.id !== characterId)?.id || characterId);

  return (
    <div className="rel" data-ui="RelationshipsPanelBody" data-entity-type="relationships">
      <div className="rel-bar">
        <div className="rel-bar__modes">
          {REL_MODES.map((m) => (
            <button key={m.id} className={"rel-bar__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => setMode(m.id)}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              {m.id === "review" && model.reviewQueue.length > 0 && <span className="rel-bar__q">{model.reviewQueue.length}</span>}
            </button>
          ))}
        </div>
        <div className="rel-bar__cast">
          {cast.map((c) => (
            <button key={c.id}
                    className={"rel-bar__cast-b" + (characterId === c.id ? " is-on" : "") + (mode === "compare" && partner === c.id ? " is-pair" : "")}
                    onClick={() => mode === "compare" ? setCompareWith(c.id) : setCharacterId(c.id)}
                    style={{ "--c": c.color }}
                    title={c.name + (mode === "compare" ? " — pick as second" : "")}>
              <RelAvatar cast={c} size={22}/>
              <span>{c.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rel-body">
        {mode === "single"   && <RelSingleView model={model} characterId={characterId} onSelectCharacter={onSelectCharacter} onCompare={onCompare}/>}
        {mode === "compare"  && <RelCompareView model={model} aId={characterId} bId={partner} onSelectCharacter={onSelectCharacter}/>}
        {mode === "network"  && <RelNetworkView model={model} onSelectCharacter={onSelectCharacter}/>}
        {mode === "timeline" && <RelTimelineView model={model}/>}
        {mode === "conflict" && <RelConflictView model={model} onCompare={onCompare}/>}
        {mode === "review"   && <RelReviewView model={model}/>}
      </div>
    </div>
  );
};

// Live diagnostics defaults (app.jsx reads .length before first render).
window.RELATIONSHIPS = window.RELATIONSHIPS || [];
window.REL_CHANGES = window.REL_CHANGES || [];
window.REL_REVIEW = window.REL_REVIEW || [];

Object.assign(window, {
  REL_TYPES, REL_MODES, buildRelationshipsModel, relEvidenceFor,
  RelationshipsPanelBody, RelSingleView, RelCompareView, RelNetworkView,
  RelTimelineView, RelConflictView, RelReviewView,
});

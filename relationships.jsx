// =====================================================================
// relationships.jsx — Relationships workspace (live).
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
// Area 4 (visual tabs): this panel now renders LIVE data. Persisted
// relationship records live in the shared entity store under type
// "relationships" (EntityService.listSync("relationships")). Two shapes
// are tolerated because two writers exist:
//   • Extraction / accept  → data: { fromId, toId, relationshipType, ... }
//   • Entity editor        → data: { from, to, bondType, intensity,
//                                     valence, summary, history, ... }
// The adapters below normalise both into the view-model the views use
// ({ a, b, type, strength, trust, conflict, secret, summary, chapters }),
// deriving meters from valence/intensity, chapters + evidence from
// OccurrenceService, and a change history from the AuditService log.
// Hopes/fears come from the live cast entity's goals/fears.
//
// The demo constants (RELATIONSHIPS, REL_EVIDENCE, …) are kept only as a
// legacy export surface (a dev diagnostics readout in app.jsx reads their
// window globals); the panel no longer renders from them.
// =====================================================================

const { useState: _re_us, useMemo: _re_um, useCallback: _re_uc, useRef: _re_ur, useEffect: _re_ue } = React;

// ---------------------------------------------------------------------
// Relationship types + colours. Covers the extraction verb buckets and
// the entity-editor bond-type options.
// ---------------------------------------------------------------------
const REL_TYPES = {
  friend:   { id: "friend",   label: "Friend",   color: "#5d6d4e" },
  ally:     { id: "ally",     label: "Ally",     color: "#5d8a5a" },
  enemy:    { id: "enemy",    label: "Enemy",    color: "#a8553f" },
  family:   { id: "family",   label: "Family",   color: "#8a6a2a" },
  lover:    { id: "lover",    label: "Lover",    color: "#b86a82" },
  rival:    { id: "rival",    label: "Rival",    color: "#c98a2c" },
  mentor:   { id: "mentor",   label: "Mentor",   color: "#3e6db5" },
  faction:  { id: "faction",  label: "Faction",  color: "#3d3a78" },
  debt:     { id: "debt",     label: "Debt",     color: "#9a7b3f" },
  oath:     { id: "oath",     label: "Oath",     color: "#4a6d8a" },
  stranger: { id: "stranger", label: "Stranger", color: "#8a8071" },
  other:    { id: "other",    label: "Other",    color: "#76684c" },
  unknown:  { id: "unknown",  label: "Unknown",  color: "#76684c" },
};

// Verb-slug (extraction) → relationship type bucket.
const _REL_VERB_TYPE = {
  "whispered-to": "friend", "shouted-at": "enemy", "confronted": "rival",
  "kissed": "lover", "embraced": "lover", "struck": "enemy",
  "saved": "ally", "betrayed": "enemy", "abandoned": "enemy",
  "forgave": "friend", "comforted": "friend", "trusted": "ally",
  "loyal-to": "ally", "sworn-to": "oath", "ward-of": "mentor",
};

// Normalise any raw relationship-type string → a REL_TYPES key.
const _normRelType = (raw) => {
  const s = String(raw || "").trim().toLowerCase().replace(/\s+/g, "-");
  if (!s) return "unknown";
  if (REL_TYPES[s]) return s;
  if (_REL_VERB_TYPE[s]) return _REL_VERB_TYPE[s];
  if (/(sister|brother|mother|father|cousin|kin|blood|family|in-law)/.test(s)) return "family";
  if (/(lover|love|romance|affair|beloved)/.test(s)) return "lover";
  if (/(rival)/.test(s)) return "rival";
  if (/(enemy|foe|hostile|nemesis)/.test(s)) return "enemy";
  if (/(mentor|master|teacher|tutor)/.test(s)) return "mentor";
  if (/(ally|friend|companion|comrade)/.test(s)) return "ally";
  if (/(faction|guild|order|house)/.test(s)) return "faction";
  if (/(oath|sworn|vow)/.test(s)) return "oath";
  if (/(debt|owe)/.test(s)) return "debt";
  return "unknown";
};

// Default strength per type (used when no explicit intensity is set).
const _REL_TYPE_STRENGTH = {
  enemy: 70, rival: 65, lover: 82, friend: 78, ally: 72, mentor: 66,
  family: 60, faction: 55, debt: 58, oath: 74, stranger: 30, other: 55, unknown: 55,
};
// Default {trust, conflict} per type when no valence is set.
const _REL_TYPE_METERS = {
  enemy: { trust: 20, conflict: 82 }, rival: { trust: 45, conflict: 68 },
  lover: { trust: 80, conflict: 26 }, friend: { trust: 82, conflict: 14 },
  ally: { trust: 78, conflict: 16 }, mentor: { trust: 72, conflict: 20 },
  family: { trust: 60, conflict: 40 }, faction: { trust: 55, conflict: 35 },
  debt: { trust: 40, conflict: 45 }, oath: { trust: 76, conflict: 24 },
  stranger: { trust: 35, conflict: 30 }, other: { trust: 50, conflict: 45 },
  unknown: { trust: 50, conflict: 45 },
};
const _REL_VALENCE_METERS = {
  positive: { trust: 78, conflict: 14 }, negative: { trust: 20, conflict: 82 },
  mixed: { trust: 50, conflict: 55 }, cold: { trust: 32, conflict: 34 },
  heated: { trust: 42, conflict: 84 }, quiet: { trust: 58, conflict: 22 },
};

// ---------------------------------------------------------------------
// Legacy demo data — NOT rendered by the panel. Retained so the
// window.RELATIONSHIPS / REL_CHANGES / REL_REVIEW globals a dev
// diagnostics readout in app.jsx reads still resolve.
// ---------------------------------------------------------------------
const RELATIONSHIPS = [
  { id: "re1", a: "aelinor", b: "saren",   type: "rival",   strength: 78, trust: 22, conflict: 81, secret: false, summary: "Court-rival turned conditional ally after the Glass Audience.", chapters: [3, 4, 7] },
  { id: "re2", a: "aelinor", b: "brec",    type: "friend",  strength: 86, trust: 90, conflict: 14, secret: false, summary: "Old friend; Brec swore service to House Vey when Aelinor was a child.", chapters: [1, 2, 7] },
];
const REL_EVIDENCE = [];
const REL_CHANGES = [];
const REL_REVIEW = [];
const REL_HOPES_FEARS = {};

// ---------------------------------------------------------------------
// Live adapters
// ---------------------------------------------------------------------
const _B = () => (typeof window !== "undefined" && window.LoomwrightBackend) || null;

const _relInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || parts[0]?.[1] || "";
  return (a + b).toUpperCase() || "?";
};

// Deterministic parchment-friendly colour per entity id.
const _REL_PALETTE = ["#a8553f", "#5d6d4e", "#8a6a2a", "#b86a82", "#3e6db5", "#3d3a78", "#c98a2c", "#7a5a8a", "#4a8a7a", "#a04a4a", "#6a8a3a", "#8a5a3a"];
const _relColor = (id) => {
  const s = String(id || "");
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return _REL_PALETTE[h % _REL_PALETTE.length];
};

const _REL_ROLE_NORM = {
  protagonist: "protagonist", antagonist: "antagonist", supporting: "supporting", minor: "minor",
  hero: "protagonist", pov: "protagonist", central: "protagonist",
  villain: "antagonist", foil: "supporting", ally: "supporting",
};
const _normRelRole = (role) => _REL_ROLE_NORM[String(role || "").toLowerCase()] || (role ? "supporting" : "minor");
const _REL_ROLE_RANK = { protagonist: 0, antagonist: 1, supporting: 2, minor: 3 };

// Pull a single entity id out of a picker value ({id,name} | "id" | [..]).
const _pickId = (v) => {
  if (v == null) return null;
  if (typeof v === "string") return v || null;
  if (Array.isArray(v)) return _pickId(v[0]);
  if (typeof v === "object") return v.id || null;
  return null;
};

const _asStringList = (v) => {
  if (!v) return [];
  const arr = Array.isArray(v) ? v : (typeof v === "string" ? v.split(/\n|[;•]/) : [v]);
  return arr.map((x) => (typeof x === "string" ? x.trim() : (x && (x.label || x.name || x.text)))).filter(Boolean);
};

const _clamp100 = (n, fallback) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.min(100, Math.round(v)));
};

// Build the per-render context once (entity index, occurrences by entity,
// chapter numbering, audit events). O(n) not O(n²).
const buildRelContext = () => {
  const B = _B();
  const ctx = { entityIndex: new Map(), occByEntity: new Map(), chapters: [], chapterIndex: new Map(), activeChapterId: null, auditEvents: [] };
  if (!B) return ctx;
  try {
    const all = B.EntityService?.listAllSync?.() || {};
    for (const byId of Object.values(all)) {
      for (const ent of Object.values(byId || {})) {
        if (ent && ent.id) ctx.entityIndex.set(ent.id, ent);
      }
    }
  } catch (_e) {}
  try {
    const occs = B.OccurrenceService?.listAllSync?.() || [];
    for (const o of occs) {
      if (!o || !o.entityId) continue;
      const list = ctx.occByEntity.get(o.entityId) || [];
      list.push(o);
      ctx.occByEntity.set(o.entityId, list);
    }
  } catch (_e) {}
  try {
    const state = B.ManuscriptChapterService?.loadSync?.() || {};
    ctx.chapters = (state.chapters || []).filter((c) => !c.reserved);
    ctx.chapters.forEach((c, i) => ctx.chapterIndex.set(c.id, { index: i, num: c.num || (i + 1), title: c.title || "", id: c.id }));
    ctx.activeChapterId = state.activeChapterId || null;
  } catch (_e) {}
  try {
    ctx.auditEvents = (B.AuditService?.loadSync?.() || {}).events || [];
  } catch (_e) {}
  return ctx;
};

// Live cast entity → the compact node record the views render.
const liveCastNode = (entity) => {
  const d = (entity && entity.data) || {};
  return {
    id: entity.id,
    name: entity.name || "Unnamed",
    initials: entity.glyphChar || _relInitials(entity.name),
    color: _relColor(entity.id),
    role: _normRelRole(d.role),
  };
};

const buildCastMap = (ctx) => {
  const B = _B();
  const map = {};
  let list = [];
  try { list = B?.EntityService?.listSync?.("cast") || []; } catch (_e) { list = []; }
  for (const e of list) if (e && e.id) map[e.id] = liveCastNode(e);
  return map;
};

// One persisted relationship entity → the view-model edge, or null when
// its endpoints can't be resolved to two distinct known cast members.
const liveRelEdge = (entity, ctx, castMap) => {
  if (!entity) return null;
  const d = entity.data || {};
  const aId = _pickId(d.fromId) || _pickId(d.from) || _pickId(d.a);
  const bId = _pickId(d.toId) || _pickId(d.to) || _pickId(d.b);
  if (!aId || !bId || aId === bId) return null;
  if (!castMap[aId] || !castMap[bId]) return null;

  const type = _normRelType(d.bondType || d.relationshipType || d.type || d.kind);
  const strength = _clamp100(d.intensity != null ? d.intensity : d.strength, _REL_TYPE_STRENGTH[type] ?? 55);

  const valence = String(d.valence || "").toLowerCase();
  const base = _REL_VALENCE_METERS[valence] || _REL_TYPE_METERS[type] || _REL_TYPE_METERS.unknown;
  const trust = _clamp100(d.trust, base.trust);
  const conflict = _clamp100(d.conflict, base.conflict);
  const secret = !!(d.secret || d.hidden || valence === "cold");

  // Chapters + evidence from this relationship's own occurrences.
  const occs = (ctx.occByEntity.get(entity.id) || []).slice().sort((x, y) => {
    const xi = ctx.chapterIndex.get(x.chapterId)?.index ?? 9999;
    const yi = ctx.chapterIndex.get(y.chapterId)?.index ?? 9999;
    return xi - yi;
  });
  const chapterSet = new Set();
  const evidence = [];
  for (const o of occs) {
    const num = ctx.chapterIndex.get(o.chapterId)?.num;
    if (num != null) chapterSet.add(num);
    const quote = String(o.exactText || "").trim();
    if (quote) evidence.push({ id: o.occurrenceId, chapter: num ?? null, quote, chapterId: o.chapterId, occurrenceId: o.occurrenceId });
  }
  // Editor "evidence" free-text, and any explicit chapter list on data.
  for (const line of _asStringList(d.evidence)) evidence.push({ id: "ev-" + line.slice(0, 12), chapter: null, quote: line });
  if (Array.isArray(d.chapters)) for (const c of d.chapters) { const n = Number(c); if (Number.isFinite(n)) chapterSet.add(n); }
  const chapters = Array.from(chapterSet).sort((x, y) => x - y);

  return {
    id: entity.id,
    a: aId,
    b: bId,
    type,
    strength,
    trust,
    conflict,
    secret,
    directionality: d.directionality || "",
    summary: d.summary || entity.summary || d.history || "",
    history: d.history || "",
    chapters,
    evidence,
    _entity: entity,
  };
};

const buildEdges = (ctx, castMap) => {
  const B = _B();
  let list = [];
  try { list = B?.EntityService?.listSync?.("relationships") || []; } catch (_e) { list = []; }
  const edges = [];
  for (const e of list) {
    const edge = liveRelEdge(e, ctx, castMap);
    if (edge) edges.push(edge);
  }
  return edges;
};

// Human "3 days ago" from an ISO timestamp (browser runtime — Date is fine).
const _relTimeAgo = (iso) => {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const s = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60); if (m < 60) return m + " min ago";
  const h = Math.floor(m / 60); if (h < 24) return h + " hr ago";
  const day = Math.floor(h / 24); if (day < 7) return day + " day" + (day === 1 ? "" : "s") + " ago";
  const wk = Math.floor(day / 7); if (wk < 5) return wk + " week" + (wk === 1 ? "" : "s") + " ago";
  const mo = Math.floor(day / 30); return mo + " month" + (mo === 1 ? "" : "s") + " ago";
};

const _REL_AUDIT_KIND = {
  "entity.create": "new", "entity.update": "update", "entity.delete": "removed",
  "review.accept": "confirmed", "review.deny": "denied", "review.merge": "merged",
};

// Change history for relationship entities, derived from the audit log.
const buildRelChanges = (ctx, edgesById) => {
  const out = [];
  for (const ev of ctx.auditEvents || []) {
    if (ev.undone) continue;
    const isRel = ev.entityType === "relationships" || (ev.targetId && edgesById.has(ev.targetId));
    if (!isRel) continue;
    out.push({
      id: ev.id,
      relId: ev.targetId || null,
      kind: _REL_AUDIT_KIND[ev.action] || (ev.action || "change").split(".").pop(),
      note: ev.label || ev.action || "",
      date: _relTimeAgo(ev.createdAt),
      createdAt: ev.createdAt || "",
    });
  }
  return out;
};

// Pending relationship candidates → review cards.
const _REL_BAND_LEVEL = { blue: "strong", green: "strong", amber: "uncertain", yellow: "uncertain", grey: "weak", red: "weak" };
const buildReviewCards = (panel, castMap, ctx = {}) => {
  const B = _B();
  const chapterIndex = ctx.chapterIndex || new Map();
  let items = (panel && Array.isArray(panel.reviewItems)) ? panel.reviewItems : null;
  if (!items) { try { items = B?.ReviewService?.listSync?.("relationships") || []; } catch (_e) { items = []; } }
  return (items || [])
    .filter((it) => it && it.status !== "done" && it.status !== "denied" && it.status !== "accepted")
    .map((it) => {
      const sc = it.suggestedChanges || {};
      const aId = _pickId(sc.fromId) || _pickId(sc.from);
      const bId = _pickId(sc.toId) || _pickId(sc.to);
      const type = _normRelType(sc.relationshipType || sc.bondType);
      const lvl = _REL_BAND_LEVEL[it.confidenceBand] || (it.confidence >= 0.9 ? "strong" : it.confidence >= 0.6 ? "uncertain" : "weak");
      // sourceQuote is a plain string in real candidates; tolerate the older
      // {text}/{quote} object shape defensively (never render an object).
      const sq = it.sourceQuote;
      const excerptFromQuote = typeof sq === "string" ? sq : (sq && typeof sq === "object" ? (sq.text || sq.quote || "") : "");
      const chNum = it.chapterId ? chapterIndex.get(it.chapterId)?.num : null;
      const cite = chNum != null ? ("Ch. " + chNum) : (it.chapterId ? "manuscript" : "");
      return {
        id: it.id,
        lvl,
        title: it.name || ((castMap[aId]?.name || "?") + " → " + (castMap[bId]?.name || "?")),
        action: it.suggestedAction === "update" ? "Update relationship" : (REL_TYPES[type] ? ("New " + REL_TYPES[type].label.toLowerCase() + " candidate") : "New relationship"),
        excerpt: excerptFromQuote || it.summary || "",
        cite,
        _item: it,
      };
    });
};

// Deterministic circular layout (percent coords) for a set of node ids.
const _relLayout = (ids) => {
  const pos = {};
  const n = ids.length;
  if (!n) return pos;
  if (n === 1) { pos[ids[0]] = { x: 50, y: 50 }; return pos; }
  const rx = 36, ry = 38;
  ids.forEach((id, i) => {
    const ang = (i / n) * Math.PI * 2 - Math.PI / 2;
    pos[id] = { x: 50 + rx * Math.cos(ang), y: 50 + ry * Math.sin(ang) };
  });
  return pos;
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
const RelAvatar = ({ cast, size = 28 }) => {
  if (!cast) return <span className="rel-avatar" style={{ "--c": "#8a8071", width: size, height: size, fontSize: size * 0.32 }}>?</span>;
  return (
    <span className="rel-avatar" style={{ "--c": cast.color, width: size, height: size, fontSize: size * 0.32 }}>
      {cast.initials}
    </span>
  );
};

const RelEmpty = ({ children, lg }) => (
  <div className={"rel-empty" + (lg ? " rel-empty--lg" : "")}>{children}</div>
);

// ---------------------------------------------------------------------
// Single character view
// ---------------------------------------------------------------------
const RelSingleView = ({ characterId, cast, edges, changes, edgesById, hopesFears, onSelectCharacter, onCompare, onOpenTimeline }) => {
  const c = cast[characterId];
  if (!c) return <RelEmpty>Pick a character to begin.</RelEmpty>;

  const rels = edges.filter((r) => r.a === characterId || r.b === characterId);
  const groups = {};
  for (const r of rels) { (groups[r.type] = groups[r.type] || []).push(r); }

  const hf = hopesFears || { hopes: [], fears: [] };
  const myChanges = changes.filter((rc) => {
    const rel = edgesById.get(rc.relId);
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

      {rels.length === 0 ? (
        <RelEmpty lg>
          No tracked relationships for {c.name} yet.
          <br/>Extract a chapter or add one from a character dossier to populate the map.
        </RelEmpty>
      ) : (
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
                        <div className="rel-card__sum">{r.summary || "—"}</div>
                        {r.chapters.length > 0 && <div className="rel-card__chapters">Ch. {r.chapters.join(", ")}</div>}
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
      )}

      {(hf.hopes.length > 0 || hf.fears.length > 0) && (
        <div className="rel-twocol">
          <div className="rel-section">
            <div className="rel-section__head">Hopes</div>
            {hf.hopes.length ? <ul className="rel-bullets">{hf.hopes.map((h, i) => <li key={i}>{h}</li>)}</ul>
              : <RelEmpty>No hopes recorded.</RelEmpty>}
          </div>
          <div className="rel-section">
            <div className="rel-section__head">Fears</div>
            {hf.fears.length ? <ul className="rel-bullets">{hf.fears.map((h, i) => <li key={i}>{h}</li>)}</ul>
              : <RelEmpty>No fears recorded.</RelEmpty>}
          </div>
        </div>
      )}

      <div className="rel-section">
        <div className="rel-section__head">
          Recent relationship changes
          <span style={{ flex: 1 }}/>
          <button className="rel-section__more" onClick={onOpenTimeline}>All changes →</button>
        </div>
        {myChanges.length === 0 ? (
          <RelEmpty>No tracked changes yet.</RelEmpty>
        ) : myChanges.map((rc) => {
          const rel = edgesById.get(rc.relId);
          const other = rel ? cast[rel.a === characterId ? rel.b : rel.a] : null;
          return (
            <div key={rc.id} className="rel-change">
              <div className="rel-change__head">
                {other && <RelAvatar cast={other} size={20}/>}
                <span className="rel-change__who">{other ? other.name : "Relationship"}</span>
                <span className="rel-change__kind">{rc.kind}</span>
                <span className="rel-change__date">{rc.date}</span>
              </div>
              <div className="rel-change__note">{rc.note}</div>
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
const RelCompareView = ({ aId, bId, cast, edges, changes, edgesById, onSelectCharacter, onEditRel, onCreateRel, onOpenDossier, onOpenAtlas, onCreateEvent }) => {
  const a = cast[aId], b = cast[bId];
  if (!a || !b) return <RelEmpty>Pick two characters.</RelEmpty>;

  const rel = edges.find((r) => (r.a === aId && r.b === bId) || (r.a === bId && r.b === aId)) || null;
  const evidence = rel ? rel.evidence : [];
  const relChanges = rel ? changes.filter((c) => c.relId === rel.id) : [];
  const t = rel ? (REL_TYPES[rel.type] || REL_TYPES.unknown) : REL_TYPES.unknown;

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
          <p className="rel-compare__sum">{rel.summary || "No summary yet."}</p>
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
                  {e.chapter != null && <div className="rel-quote__cite">Ch. {e.chapter}</div>}
                  <p>"{e.quote}"</p>
                </div>
              ))}
              {evidence.length === 0 && <RelEmpty>No source evidence yet.</RelEmpty>}
              <button className="rel-add" onClick={() => onEditRel(rel, "story")}>+ Add evidence</button>
            </div>
            <div className="rel-section">
              <div className="rel-section__head">Timeline of changes</div>
              {relChanges.map((c) => (
                <div key={c.id} className="rel-change">
                  <div className="rel-change__head">
                    <span className="rel-change__kind">{c.kind}</span>
                    <span style={{ flex: 1 }}/>
                    <span className="rel-change__date">{c.date}</span>
                  </div>
                  <div className="rel-change__note">{c.note}</div>
                </div>
              ))}
              {relChanges.length === 0 && <RelEmpty>No tracked changes yet.</RelEmpty>}
            </div>
          </div>

          <div className="rel-compare__actions">
            <button onClick={() => onEditRel(rel, "edges")}>Change type</button>
            <button onClick={() => onCreateEvent(rel)}>Create event</button>
            <button onClick={() => onOpenAtlas(rel)}>Show shared places</button>
            <button onClick={() => onOpenDossier(aId)}>Open {a.name.split(" ")[0]}</button>
          </div>
        </>
      ) : (
        <RelEmpty lg>
          No tracked relationship between {a.name} and {b.name} yet.
          <button onClick={() => onCreateRel(aId, bId)} className="rel-add">+ Create</button>
        </RelEmpty>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Network graph view — deterministic circular layout.
// ---------------------------------------------------------------------
const RelNetworkView = ({ cast, edges, onSelectCharacter, onCompare }) => {
  // Nodes = the cast members that participate in at least one edge.
  const nodeIds = _re_um(() => {
    const set = new Set();
    for (const r of edges) { set.add(r.a); set.add(r.b); }
    return Array.from(set).filter((id) => cast[id]);
  }, [edges, cast]);
  const positions = _re_um(() => _relLayout(nodeIds), [nodeIds]);
  const W = 800, H = 540;

  if (!nodeIds.length) {
    return <RelEmpty lg>No relationships to graph yet. Extract chapters or link two characters to see the web.</RelEmpty>;
  }

  return (
    <div className="rel-net">
      <svg viewBox={`0 0 ${W} ${H}`} className="rel-net__svg">
        <defs>
          <pattern id="rel-net-grain" patternUnits="userSpaceOnUse" width="4" height="4">
            <circle cx="2" cy="2" r="0.5" fill="rgba(120,96,60,0.10)"/>
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#rel-net-grain)" opacity="0.5"/>
        <circle cx={W / 2} cy={H / 2} r={180} fill="none"
                stroke="rgba(74,56,28,0.15)" strokeWidth="0.6" strokeDasharray="2 5"/>

        {edges.map((r) => {
          const pa = positions[r.a], pb = positions[r.b];
          if (!pa || !pb) return null;
          const t = REL_TYPES[r.type] || REL_TYPES.unknown;
          const sw = 0.5 + (r.strength / 100) * 3;
          const op = 0.35 + (r.strength / 100) * 0.4;
          return (
            <g key={r.id}>
              <line x1={(pa.x / 100) * W} y1={(pa.y / 100) * H}
                    x2={(pb.x / 100) * W} y2={(pb.y / 100) * H}
                    stroke={t.color} strokeWidth={sw} strokeOpacity={op}
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

        {nodeIds.map((id) => {
          const c = cast[id]; const p = positions[id];
          if (!c || !p) return null;
          const x = (p.x / 100) * W, y = (p.y / 100) * H;
          return (
            <g key={id} transform={`translate(${x}, ${y})`}
               onClick={() => onSelectCharacter(id)} style={{ cursor: "pointer" }}>
              <circle r="36" fill="#fff" stroke={c.color} strokeWidth="2"/>
              <circle r="30" fill={c.color}/>
              <text textAnchor="middle" dominantBaseline="central"
                    fontFamily="var(--font-display)" fontWeight="700" fontSize="16" fill="#fff">
                {c.initials}
              </text>
              <text y="58" textAnchor="middle"
                    fontFamily="var(--font-display)" fontSize="13" fill="#2a2218" fontWeight="600">
                {c.name}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="rel-net__legend">
        {Object.values(REL_TYPES).filter((t) => t.id !== "unknown" && edges.some((r) => r.type === t.id)).map((t) => (
          <span key={t.id} className="rel-net__chip">
            <span className="rel-net__chip-sw" style={{ background: t.color }}/>
            {t.label}
          </span>
        ))}
        {edges.some((r) => r.secret) && <span className="rel-net__chip rel-net__chip--secret">— — secret</span>}
        {edges.some((r) => r.conflict > 60) && (
          <span className="rel-net__chip">
            <span className="rel-net__chip-sw" style={{ background: "#a8553f", opacity: 0.4 }}/>
            conflict heat
          </span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Timeline (relationship changes over time)
// ---------------------------------------------------------------------
const RelTimelineView = ({ cast, edges, changes, edgesById }) => {
  if (!changes.length) {
    return <RelEmpty lg>No relationship changes recorded yet. Edits, accepts, and new links appear here as they happen.</RelEmpty>;
  }
  return (
    <div className="rel-tl">
      <div className="rel-tl__chapter">
        <div className="rel-tl__chap-head">History</div>
        <div className="rel-tl__list">
          {changes.map((c) => {
            const rel = edgesById.get(c.relId);
            const a = rel ? cast[rel.a] : null;
            const b = rel ? cast[rel.b] : null;
            return (
              <div key={c.id} className="rel-tl__card">
                <div className="rel-tl__heads">
                  {a && <RelAvatar cast={a} size={20}/>}
                  <Icon name="link" size={11}/>
                  {b && <RelAvatar cast={b} size={20}/>}
                  <span className="rel-tl__rel">{a && b ? (a.name + " ↔ " + b.name) : (c.note || "Relationship")}</span>
                  <span className="rel-tl__kind">{c.kind}</span>
                  <span style={{ flex: 1 }}/>
                  <span className="rel-change__date">{c.date}</span>
                </div>
                <div className="rel-tl__note">{c.note}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Conflict heat view
// ---------------------------------------------------------------------
const RelConflictView = ({ cast, edges, onCompare }) => {
  const conflicts = edges.filter((r) => r.conflict > 40).sort((a, b) => b.conflict - a.conflict);
  return (
    <div className="rel-conflict">
      {conflicts.map((r) => {
        const a = cast[r.a], b = cast[r.b];
        if (!a || !b) return null;
        const t = REL_TYPES[r.type] || REL_TYPES.unknown;
        return (
          <button key={r.id} className="rel-conflict__row" onClick={() => onCompare(r.a, r.b)} style={{ "--c": t.color }}>
            <RelAvatar cast={a} size={28}/>
            <span className="rel-conflict__between">vs</span>
            <RelAvatar cast={b} size={28}/>
            <div className="rel-conflict__main">
              <div className="rel-conflict__title">{a.name} · {b.name}</div>
              <div className="rel-conflict__sub">{r.summary || t.label}</div>
            </div>
            <div className="rel-conflict__heat" style={{ "--w": r.conflict + "%" }}>
              <span/>{r.conflict}
            </div>
          </button>
        );
      })}
      {conflicts.length === 0 && <RelEmpty lg>No active high-conflict relationships.</RelEmpty>}
    </div>
  );
};

// ---------------------------------------------------------------------
// Review queue
// ---------------------------------------------------------------------
const RelReviewView = ({ review, onAccept, onEdit, onMerge, onDeny }) => {
  if (!review.length) {
    return <RelEmpty lg>No relationship suggestions to review. Run an extraction to surface new bonds.</RelEmpty>;
  }
  return (
    <div className="rel-review">
      {review.map((r) => (
        <div key={r.id} className={"rel-review__card rel-review__card--" + r.lvl}>
          <div className="rel-review__head">
            <ConfidenceBadge level={r.lvl}/>
            <span className="rel-review__title">{r.title}</span>
          </div>
          {r.excerpt && <p className="rel-review__quote">"{r.excerpt}"</p>}
          {r.cite && <div className="rel-review__meta">{r.cite}</div>}
          <div className="rel-review__pill">{r.action}</div>
          <div className="rel-review__actions">
            <button onClick={() => onAccept(r._item)}>Accept</button>
            <button onClick={() => onEdit(r._item)}>Edit</button>
            <button onClick={() => onMerge(r._item)}>Merge</button>
            <button onClick={() => onDeny(r._item)}>Deny</button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// RelationshipsPanelBody — live entry point
// ---------------------------------------------------------------------
const RelationshipsPanelBody = (props) => {
  const { panel, onAcceptQueueItem, onEditQueueItem, onMergeQueueItem, onDenyQueueItem } = props || {};
  const [mode, setMode] = _re_us("single");
  const [characterId, setCharacterId] = _re_us(null);
  const [compareWith, setCompareWith] = _re_us(null);
  const [storeVersion, setStoreVersion] = _re_us(0);

  // Subscribe to the same store events the Cast dossier watches.
  _re_ue(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:review-queue-updated", "lw:occurrences-updated",
                 "lw:manuscript-chapters-updated", "lw:set-active-chapter", "lw:audit-log-updated", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  const ctx = _re_um(() => buildRelContext(), [storeVersion]);
  const castMap = _re_um(() => buildCastMap(ctx), [ctx]);
  const edges = _re_um(() => buildEdges(ctx, castMap), [ctx, castMap]);
  const edgesById = _re_um(() => new Map(edges.map((e) => [e.id, e])), [edges]);
  const changes = _re_um(() => buildRelChanges(ctx, edgesById), [ctx, edgesById]);
  const review = _re_um(() => buildReviewCards(panel, castMap, ctx), [panel, castMap, ctx, storeVersion]);

  // Character bar list — live cast, sorted by role then name.
  const castList = _re_um(() => Object.values(castMap).sort((a, b) => {
    const ra = _REL_ROLE_RANK[a.role] ?? 9, rb = _REL_ROLE_RANK[b.role] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.name.localeCompare(b.name);
  }), [castMap]);

  // Keep the selection valid as the store changes.
  _re_ue(() => {
    if (!castList.length) { if (characterId) setCharacterId(null); return; }
    if (!characterId || !castMap[characterId]) setCharacterId(castList[0].id);
    if (!compareWith || !castMap[compareWith] || compareWith === characterId) {
      const other = castList.find((c) => c.id !== (characterId || castList[0].id));
      setCompareWith(other ? other.id : null);
    }
  }, [castList, castMap]); // eslint-disable-line

  // React to cross-panel focus (a Cast/Timeline selection).
  _re_ue(() => {
    const focus = (window.focusedByType && window.focusedByType.cast) || null;
    if (focus && focus.id && castMap[focus.id]) { setCharacterId(focus.id); setMode("single"); }
  }, [castMap]); // eslint-disable-line

  const onCompare = _re_uc((a, b) => { setCharacterId(a); setCompareWith(b); setMode("compare"); }, []);
  const onSelectCharacter = _re_uc((id) => { setCharacterId(id); setMode("single"); }, []);

  // Hopes/fears for the focused character, from its live cast entity.
  const hopesFears = _re_um(() => {
    const ent = characterId ? ctx.entityIndex.get(characterId) : null;
    const d = (ent && ent.data) || {};
    return { hopes: _asStringList(d.goals).slice(0, 6), fears: _asStringList(d.fears).slice(0, 6) };
  }, [characterId, ctx]);

  // ---- Action handlers -------------------------------------------------
  const openRelEditor = _re_uc((relOrId, sectionId) => {
    const id = typeof relOrId === "string" ? relOrId : (relOrId && relOrId.id);
    window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
      detail: { type: "relationships", initial: id ? { id } : undefined, mode: "full", sectionId: sectionId || undefined },
    }));
  }, []);
  const onCreateRel = _re_uc((aId, bId) => {
    window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
      detail: { type: "relationships", mode: "full", initial: (aId && bId) ? { data: { from: aId, to: bId } } : undefined },
    }));
  }, []);
  const onOpenDossier = _re_uc((id) => {
    if (!id) return;
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "cast", focus: { entityId: id, entityType: "cast" } } }));
  }, []);
  const onOpenAtlas = _re_uc(() => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "atlas" } }));
  }, []);
  const onCreateEvent = _re_uc((rel) => {
    const a = rel && castMap[rel.a], b = rel && castMap[rel.b];
    window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
      detail: { type: "timeline", mode: "full", initial: (a && b) ? { name: a.name + " & " + b.name, data: { characters: [rel.a, rel.b] } } : undefined },
    }));
  }, [castMap]);
  const onOpenTimeline = _re_uc(() => setMode("timeline"), []);

  // Review actions — prefer the wired panel props; fall back to the shared
  // registry callbacks so the older SlidingPanel mount path also works.
  const fireQueue = _re_uc((propFn, name, item) => {
    if (typeof propFn === "function") { propFn(item); return; }
    window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name, id: item && item.id, item } }));
  }, []);
  const onAccept = _re_uc((item) => fireQueue(onAcceptQueueItem, "onAcceptQueueItem", item), [onAcceptQueueItem, fireQueue]);
  const onEdit   = _re_uc((item) => (typeof onEditQueueItem === "function" ? onEditQueueItem(item)
                    : window.dispatchEvent(new CustomEvent("lw:open-edit-candidate", { detail: { item } }))), [onEditQueueItem]);
  const onMerge  = _re_uc((item) => fireQueue(onMergeQueueItem, "onMergeQueueItem", item), [onMergeQueueItem, fireQueue]);
  const onDeny   = _re_uc((item) => fireQueue(onDenyQueueItem, "onDenyQueueItem", item), [onDenyQueueItem, fireQueue]);

  const hasCast = castList.length > 0;

  return (
    <div className="rel" data-ui="RelationshipsPanelBody">
      <div className="rel-bar">
        <div className="rel-bar__modes">
          {REL_MODES.map((m) => (
            <button key={m.id} className={"rel-bar__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => setMode(m.id)}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              {m.id === "review" && review.length > 0 && <span className="rel-bar__q">{review.length}</span>}
            </button>
          ))}
        </div>
        <div className="rel-bar__cast">
          {castList.map((c) => (
            <button key={c.id}
                    className={"rel-bar__cast-b" + (characterId === c.id ? " is-on" : "") + (mode === "compare" && compareWith === c.id ? " is-pair" : "")}
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
        {!hasCast && mode !== "review" ? (
          <RelEmpty lg>
            No characters yet. Add cast members (or run onboarding / an extraction) to start mapping relationships.
          </RelEmpty>
        ) : (
          <>
            {mode === "single"   && <RelSingleView characterId={characterId} cast={castMap} edges={edges} changes={changes} edgesById={edgesById} hopesFears={hopesFears} onSelectCharacter={onSelectCharacter} onCompare={onCompare} onOpenTimeline={onOpenTimeline}/>}
            {mode === "compare"  && <RelCompareView aId={characterId} bId={compareWith} cast={castMap} edges={edges} changes={changes} edgesById={edgesById} onSelectCharacter={onSelectCharacter} onEditRel={openRelEditor} onCreateRel={onCreateRel} onOpenDossier={onOpenDossier} onOpenAtlas={onOpenAtlas} onCreateEvent={onCreateEvent}/>}
            {mode === "network"  && <RelNetworkView cast={castMap} edges={edges} onSelectCharacter={onSelectCharacter} onCompare={onCompare}/>}
            {mode === "timeline" && <RelTimelineView cast={castMap} edges={edges} changes={changes} edgesById={edgesById}/>}
            {mode === "conflict" && <RelConflictView cast={castMap} edges={edges} onCompare={onCompare}/>}
            {mode === "review"   && <RelReviewView review={review} onAccept={onAccept} onEdit={onEdit} onMerge={onMerge} onDeny={onDeny}/>}
          </>
        )}
      </div>
    </div>
  );
};

const REL_MODES = [
  { id: "single",   label: "Single",      icon: "user" },
  { id: "compare",  label: "Compare 2",   icon: "link" },
  { id: "network",  label: "Network",     icon: "branch" },
  { id: "timeline", label: "History",     icon: "clock" },
  { id: "conflict", label: "Conflict",    icon: "warn" },
  { id: "review",   label: "Review",      icon: "bell" },
];

Object.assign(window, {
  RELATIONSHIPS, REL_EVIDENCE, REL_CHANGES, REL_REVIEW, REL_TYPES, REL_MODES,
  RelationshipsPanelBody, RelSingleView, RelCompareView, RelNetworkView,
  RelTimelineView, RelConflictView, RelReviewView,
  buildRelContext, buildCastMap, buildEdges, liveRelEdge, buildRelChanges, buildReviewCards,
});

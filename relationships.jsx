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

const { useState: _re_us, useMemo: _re_um, useCallback: _re_uc, useRef: _re_ur, useEffect: _re_ue } = React;

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
// Live data adapters — project the real entity store into the shapes the
// relationship views consume. Relationships are derived from three live
// sources: the cast editor's relationship pickers (family/lovers/allies/…),
// the legacy inline `relationships` array on a cast row, and standalone
// `relationships` entities accepted from extraction (data.fromId/toId/type).
// When the live cast store is empty we return null so the panel falls back
// to the demo constants above. All functions here are pure (no Date/random)
// so they can be unit-tested at the Node level.
// =====================================================================

// Deterministic per-character colour — the live cast entity carries no
// colour of its own, so hash the id into a parchment-friendly palette.
const _REL_PALETTE = [
  "#7a6aa3", "#a8553f", "#5d6d4e", "#b78a52", "#6b6f7a", "#8a6b58",
  "#3e6db5", "#b86a82", "#4b8a6f", "#9c6a3c", "#6d5aa0", "#417a86",
];
const _relHash = (s) => {
  let h = 0;
  const str = String(s || "");
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
};
const _relColorFor = (id) => _REL_PALETTE[_relHash(id) % _REL_PALETTE.length];

const _relInitials = (name) => {
  if (!name) return "?";
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || parts[0]?.[1] || "";
  return (a + b).toUpperCase() || "?";
};

// Map any relationship "kind" (cast picker field id, legacy cast rel kind,
// or an extraction verb) to one of the eight REL_TYPES buckets.
const _REL_KIND_TO_TYPE = {
  friend: "friend", enemy: "enemy", family: "family", lover: "lover",
  rival: "rival", mentor: "mentor", faction: "faction", unknown: "unknown",
  // editor picker field ids (plural)
  friends: "friend", enemies: "enemy", lovers: "lover", rivals: "rival",
  mentors: "mentor", allies: "friend", ally: "friend", factions: "faction",
  // legacy cast.relationships kinds
  "loyal-to": "friend", "sworn-to": "friend", "ward-of": "mentor",
  sister: "family", brother: "family", "sister-in-law": "family",
  "brother-in-law": "family", parent: "family", child: "family",
  cousin: "family", spouse: "lover", partner: "lover", betrothed: "lover",
  // extraction verbs (RELATIONSHIP_VERBS, spaces dashed)
  kissed: "lover", embraced: "lover", saved: "friend", comforted: "friend",
  forgave: "friend", trusted: "friend", "whispered-to": "friend",
  confronted: "rival", struck: "enemy", betrayed: "enemy",
  abandoned: "enemy", "shouted-at": "enemy",
};
const _relTypeForKind = (kind) =>
  _REL_KIND_TO_TYPE[String(kind || "").toLowerCase().trim().replace(/\s+/g, "-")] || "unknown";

// Default meters per type — the persisted relationship record carries no
// strength/trust/conflict, so the meters are keyed off the relationship type.
const _REL_TYPE_METERS = {
  friend:  { strength: 72, trust: 82, conflict: 14 },
  family:  { strength: 66, trust: 60, conflict: 26 },
  lover:   { strength: 84, trust: 74, conflict: 22 },
  rival:   { strength: 64, trust: 34, conflict: 66 },
  enemy:   { strength: 62, trust: 12, conflict: 82 },
  mentor:  { strength: 68, trust: 78, conflict: 16 },
  faction: { strength: 55, trust: 45, conflict: 35 },
  unknown: { strength: 48, trust: 48, conflict: 20 },
};
const _relClamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
const _relPickId = (v) => (typeof v === "string" ? v : (v && v.id) || null);

const _relToLines = (v) => {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : (x && (x.label || x.name)) || "")).filter(Boolean);
  if (typeof v === "string") return v.split(/\n|;|·/).map((s) => s.trim()).filter(Boolean);
  return [];
};

const _relNorm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const _relFindCastByName = (name, castList) => {
  const n = _relNorm(name);
  if (!n) return null;
  let hit = castList.find((c) => _relNorm(c.name) === n);
  if (hit) return hit.id;
  hit = castList.find((c) => _relNorm(c.name).split(" ")[0] === n.split(" ")[0]);
  if (hit) return hit.id;
  hit = castList.find((c) => { const cn = _relNorm(c.name); return cn.includes(n) || n.includes(cn); });
  return hit ? hit.id : null;
};

const _REL_FIELD_KINDS = ["family", "lovers", "allies", "mentors", "rivals", "enemies"];
const _REL_ROLE_RANK = { protagonist: 0, antagonist: 1, supporting: 2, minor: 3 };

// Right-click / long-press a relationship that is backed by a real
// `relationships` entity → open the adaptive wheel with its entity context
// (Open / Edit / Merge / Review). Picker-derived pairs have no entity, so the
// wheel stays inert for them.
const _relOpenWheel = (rel, clientX, clientY) => {
  const ent = rel && rel._relEntity;
  if (!ent || !ent.id) return false;
  window.dispatchEvent(new CustomEvent("lw:open-entity-wheel", {
    detail: { x: clientX, y: clientY, entityId: ent.id, entityType: "relationships", label: rel.summary || ent.name || "Relationship" },
  }));
  return true;
};

// Build the full live dataset. `B` defaults to window.LoomwrightBackend but
// is injectable for tests. Returns null when there is no live cast to render.
const buildLiveRelDataset = (B) => {
  B = B || (typeof window !== "undefined" && window.LoomwrightBackend);
  if (!B || !B.EntityService || typeof B.EntityService.listSync !== "function") return null;
  const castRows = B.EntityService.listSync("cast") || [];
  if (!castRows.length) return null;

  // ---- cast index ----
  const castMap = {};
  const castList = [];
  for (const e of castRows) {
    if (!e || !e.id) continue;
    const name = e.name || "Unknown";
    const c = {
      id: e.id,
      name,
      initials: e.glyphChar || e.initials || _relInitials(name),
      color: e.color || (e.data && e.data.color) || _relColorFor(e.id),
      role: (e.data && e.data.role) || e.role || "",
      _entity: e,
    };
    castMap[e.id] = c;
    castList.push(c);
  }
  castList.sort((a, b) =>
    (_REL_ROLE_RANK[_relNorm(a.role)] ?? 4) - (_REL_ROLE_RANK[_relNorm(b.role)] ?? 4)
    || a.name.localeCompare(b.name));

  // ---- chapter-num map + per-entity chapter sets from occurrences ----
  const chapterNum = new Map();
  try {
    const st = (B.ManuscriptChapterService && B.ManuscriptChapterService.loadSync) ? B.ManuscriptChapterService.loadSync() : {};
    (st.chapters || []).filter((c) => !c.reserved).forEach((c, i) => chapterNum.set(c.id, c.num || (i + 1)));
  } catch (_) {}
  const chaptersByEntity = new Map();
  try {
    const occs = (B.OccurrenceService && B.OccurrenceService.listAllSync) ? B.OccurrenceService.listAllSync() : [];
    for (const o of occs) {
      if (!o || !o.entityId) continue;
      const num = chapterNum.get(o.chapterId);
      if (num == null) continue;
      let set = chaptersByEntity.get(o.entityId);
      if (!set) { set = new Set(); chaptersByEntity.set(o.entityId, set); }
      set.add(num);
    }
  } catch (_) {}
  const sharedChapters = (aId, bId) => {
    const A = chaptersByEntity.get(aId), Bs = chaptersByEntity.get(bId);
    if (!A || !Bs) return [];
    return [...A].filter((n) => Bs.has(n)).sort((x, y) => x - y);
  };

  // ---- collect relationship pairs from every live source ----
  const relMap = new Map();
  const pairKey = (a, b) => [a, b].sort().join("|");
  const upsert = (aId, bId, kind, { summary, secret, relEntity } = {}) => {
    if (!aId || !bId || aId === bId) return;
    if (!castMap[aId] || !castMap[bId]) return; // only between known cast
    const key = pairKey(aId, bId);
    const type = _relTypeForKind(kind);
    const prev = relMap.get(key);
    if (prev) {
      if (prev.type === "unknown" && type !== "unknown") prev.type = type;
      if (!prev.summary && summary) prev.summary = summary;
      if (secret) prev.secret = true;
      if (relEntity && !prev._relEntity) prev._relEntity = relEntity;
      return;
    }
    const [a, b] = [aId, bId].sort();
    relMap.set(key, { id: "rel-" + key, a, b, type, secret: !!secret, summary: summary || "", _relEntity: relEntity || null });
  };

  // Source 1: cast picker fields + legacy inline relationships.
  for (const e of castRows) {
    const d = e.data || {};
    for (const field of _REL_FIELD_KINDS) {
      const raw = d[field];
      if (!Array.isArray(raw)) continue;
      for (const v of raw) { const otherId = _relPickId(v); if (otherId) upsert(e.id, otherId, field); }
    }
    const legacy = Array.isArray(e.relationships) ? e.relationships
      : (Array.isArray(d.relationships) ? d.relationships : null);
    if (legacy) for (const r of legacy) { const otherId = _relPickId(r); if (otherId) upsert(e.id, otherId, r && r.kind); }
  }

  // Source 2: standalone relationship entities.
  const relRows = B.EntityService.listSync("relationships") || [];
  for (const r of relRows) {
    const d = r.data || {};
    let aId = d.fromId || null, bId = d.toId || null;
    const kind = d.relationshipType || r.subtitle || "";
    if (!aId || !bId) {
      const parts = String(r.name || "").split(/↔|—|→|<->|->|\s-\s/).map((s) => s.trim()).filter(Boolean);
      if (parts.length === 2) { aId = _relFindCastByName(parts[0], castList); bId = _relFindCastByName(parts[1], castList); }
    }
    if (aId && bId) upsert(aId, bId, kind, { summary: r.summary || r.subtitle || "", relEntity: r });
  }

  // ---- finalise each relationship with meters + live chapters ----
  const rels = [];
  for (const rec of relMap.values()) {
    const meters = _REL_TYPE_METERS[rec.type] || _REL_TYPE_METERS.unknown;
    const chapters = sharedChapters(rec.a, rec.b);
    const bump = Math.min(chapters.length * 3, 15);
    rels.push({
      id: rec.id, a: rec.a, b: rec.b, type: rec.type,
      strength: _relClamp(meters.strength + bump), trust: meters.trust, conflict: meters.conflict,
      secret: rec.secret,
      summary: rec.summary || `${castMap[rec.a].name} & ${castMap[rec.b].name} — ${(REL_TYPES[rec.type] || REL_TYPES.unknown).label}.`,
      chapters, _relEntity: rec._relEntity,
    });
  }
  rels.sort((a, b) => b.strength - a.strength);

  // ---- evidence (persisted source quote on the relationship entity) ----
  const evidence = [];
  for (const r of rels) {
    const d = (r._relEntity && r._relEntity.data) || {};
    const quote = d.sourceQuote || d.quote || null;
    if (quote) evidence.push({ id: "ev-" + r.id, rel: r.id, chapter: r.chapters[0] || null, quote, strength: "strong" });
  }

  // ---- changes: a live "new relationship" event at its first shared chapter ----
  const changes = [];
  for (const r of rels) {
    if (!r.chapters.length) continue;
    changes.push({
      id: "chg-" + r.id, rel: r.id, chapter: r.chapters[0], kind: "new",
      from: null, to: (REL_TYPES[r.type] || REL_TYPES.unknown).label, note: r.summary, date: "",
    });
  }

  // ---- hopes / fears from cast data (goals/fears chips) ----
  const hopesFears = {};
  for (const c of castList) {
    const d = c._entity.data || {};
    const hopes = _relToLines(d.goals || d.hopes);
    const fears = _relToLines(d.fears);
    if (hopes.length || fears.length) hopesFears[c.id] = { hopes, fears };
  }

  // ---- review queue: live relationship candidates ----
  const review = [];
  try {
    const q = (B.ReviewService && B.ReviewService.listSync) ? B.ReviewService.listSync("relationships") : [];
    for (const item of q) {
      if (item.status && item.status !== "pending" && item.status !== "auto-added") continue;
      const pct = Math.round((item.confidence || 0) * 100);
      const lvl = item.level || (pct >= 90 ? "high" : pct >= 75 ? "strong" : pct >= 50 ? "uncertain" : "weak");
      const num = chapterNum.get(item.chapterId);
      review.push({
        id: item.id, lvl,
        title: item.name || "Relationship candidate",
        action: item.suggestedAction === "update" ? "Update relationship" : "New rel candidate",
        excerpt: item.sourceQuote || item.summary || "",
        cite: num != null ? ("Ch. " + num) : "",
        _item: item,
      });
    }
  } catch (_) {}

  return { live: true, castMap, castList, rels, evidence, changes, hopesFears, review };
};

// Demo dataset — wraps the existing constants so the views share one shape.
const buildDemoRelDataset = () => {
  const castMap = _castById();
  const castList = (window.ATLAS_CAST || []).map((c) => castMap[c.id]).filter(Boolean);
  return {
    live: false, castMap, castList,
    rels: RELATIONSHIPS, evidence: REL_EVIDENCE, changes: REL_CHANGES,
    hopesFears: REL_HOPES_FEARS, review: REL_REVIEW.map((r) => ({ ...r })),
  };
};

// Circular layout for the network graph — deterministic, works for any cast
// size (the old view hard-coded six positions).
const _relLayout = (castList, W, H) => {
  const n = castList.length;
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.36;
  const pos = {};
  castList.forEach((c, i) => {
    if (n <= 1) { pos[c.id] = { x: cx, y: cy }; return; }
    const ang = (-Math.PI / 2) + (i / n) * Math.PI * 2;
    pos[c.id] = { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
  });
  return pos;
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
const RelSingleView = ({ characterId, data, onSelectCharacter, onCompare }) => {
  const cast = data.castMap;
  const c = cast[characterId];
  if (!c) return <div style={{ padding: 16, color: "var(--ink-3)" }}>Pick a character to begin.</div>;

  const rels = data.rels.filter((r) => r.a === characterId || r.b === characterId);
  const groups = {};
  for (const r of rels) {
    const k = r.type;
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  }

  const hf = data.hopesFears[characterId] || { hopes: [], fears: [] };

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
        <div className="rel-empty rel-empty--lg" style={{ margin: "12px 0" }}>
          No tracked relationships for {c.name} yet.
          <button data-callback="onCreateRelationship" className="rel-add">+ Create</button>
        </div>
      )}

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
                  <button key={r.id} className="rel-card" data-rel-id={r.id}
                          onClick={() => onCompare(characterId, other.id)}
                          onContextMenu={(e) => { if (_relOpenWheel(r, e.clientX, e.clientY)) e.preventDefault(); }}>
                    <RelAvatar cast={other}/>
                    <div className="rel-card__main">
                      <div className="rel-card__name">
                        {other.name}
                        {r.secret && <span className="rel-card__secret" title="Secret">⬛</span>}
                      </div>
                      <div className="rel-card__sum">{r.summary}</div>
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
        {(() => {
          const rows = data.changes.filter((rc) => {
            const rel = data.rels.find((r) => r.id === rc.rel);
            return rel && (rel.a === characterId || rel.b === characterId);
          }).slice(0, 4);
          if (!rows.length) return <div className="rel-empty">No tracked changes yet.</div>;
          return rows.map((rc) => {
          const rel = data.rels.find((r) => r.id === rc.rel);
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
          });
        })()}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Compare view (2 characters)
// ---------------------------------------------------------------------
const RelCompareView = ({ aId, bId, data, onSelectCharacter }) => {
  const cast = data.castMap;
  const a = cast[aId], b = cast[bId];
  if (!a || !b) return <div style={{ padding: 16 }}>Pick two characters.</div>;

  const rel = data.rels.find((r) =>
    (r.a === aId && r.b === bId) || (r.a === bId && r.b === aId));
  const evidence = data.evidence.filter((e) => rel && e.rel === rel.id);
  const changes = data.changes.filter((c) => rel && c.rel === rel.id);
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
const RelNetworkView = ({ data, onSelectCharacter, onCompare }) => {
  const cast = data.castMap;
  const W = 800, H = 540;
  // Deterministic circular layout over whatever cast the project has.
  const positions = _relLayout(data.castList, W, H);

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
        {data.rels.map((r) => {
          const pa = positions[r.a], pb = positions[r.b];
          if (!pa || !pb) return null;
          const t = REL_TYPES[r.type] || REL_TYPES.unknown;
          const sw = 0.5 + (r.strength / 100) * 3;
          const op = 0.35 + (r.strength / 100) * 0.4;
          return (
            <g key={r.id}>
              <line x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y}
                    stroke={t.color}
                    strokeWidth={sw}
                    strokeOpacity={op}
                    strokeDasharray={r.secret ? "4 4" : "0"}/>
              {r.conflict > 60 && (
                <circle cx={(pa.x + pb.x) / 2}
                        cy={(pa.y + pb.y) / 2}
                        r={6 + (r.conflict / 100) * 6}
                        fill="#a8553f" opacity="0.18"/>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {data.castList.map((c) => {
          const p = positions[c.id];
          if (!p) return null;
          return (
            <g key={c.id} transform={`translate(${p.x}, ${p.y})`}
               onClick={() => onSelectCharacter(c.id)}
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
        {Object.values(REL_TYPES).filter((t) => data.rels.some((r) => r.type === t.id)).map((t) => (
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
const RelTimelineView = ({ data }) => {
  const cast = data.castMap;
  const grouped = {};
  for (const c of data.changes) {
    grouped[c.chapter] = grouped[c.chapter] || [];
    grouped[c.chapter].push(c);
  }
  if (!data.changes.length) return <div className="rel-empty rel-empty--lg" style={{ margin: 16 }}>No tracked relationship changes yet.</div>;
  return (
    <div className="rel-tl">
      {Object.entries(grouped).sort((a, b) => Number(a[0]) - Number(b[0])).map(([ch, changes]) => (
        <div key={ch} className="rel-tl__chapter">
          <div className="rel-tl__chap-head">Ch. {ch}</div>
          <div className="rel-tl__list">
            {changes.map((c) => {
              const rel = data.rels.find((r) => r.id === c.rel);
              if (!rel) return null;
              const a = cast[rel.a], b = cast[rel.b];
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
const RelConflictView = ({ data, onCompare }) => {
  const cast = data.castMap;
  const conflicts = data.rels.filter((r) => r.conflict > 40).sort((a, b) => b.conflict - a.conflict);
  return (
    <div className="rel-conflict">
      {conflicts.map((r) => {
        const a = cast[r.a], b = cast[r.b];
        const t = REL_TYPES[r.type];
        return (
          <button key={r.id} className="rel-conflict__row" data-rel-id={r.id} onClick={() => onCompare(r.a, r.b)}
                  onContextMenu={(e) => { if (_relOpenWheel(r, e.clientX, e.clientY)) e.preventDefault(); }}
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
// Route a review action through the global callback bus so it lands on the
// real ReviewService regardless of which host mounted the panel. Demo items
// (no `_item`) fall through to the generic data-callback notice.
const _relDispatch = (name, item) =>
  window.LoomwrightDispatchCallback &&
  window.LoomwrightDispatchCallback(name, { detail: item, entityId: item?.entityId, entityType: "relationships" });

const RelReviewView = ({ data }) => {
  if (!data.review.length) return <div className="rel-empty rel-empty--lg" style={{ margin: 16 }}>No relationship candidates awaiting review.</div>;
  return (
    <div className="rel-review">
      {data.review.map((r) => {
        const live = !!r._item;
        const on = (name) => (live ? { onClick: () => _relDispatch(name, r._item) } : { "data-callback": name });
        return (
          <div key={r.id} className={"rel-review__card rel-review__card--" + r.lvl}>
            <div className="rel-review__head">
              <ConfidenceBadge level={r.lvl}/>
              <span className="rel-review__title">{r.title}</span>
            </div>
            {r.excerpt && <p className="rel-review__quote">"{r.excerpt}"</p>}
            {r.cite && <div className="rel-review__meta">{r.cite}</div>}
            <div className="rel-review__pill">{r.action}</div>
            <div className="rel-review__actions">
              <button {...on("onAcceptRelationshipQueueItem")}>Accept</button>
              <button {...on("onEditRelationshipQueueItem")}>Edit</button>
              <button {...on("onMergeRelationshipQueueItem")}>Merge</button>
              <button {...on("onDenyRelationshipQueueItem")}>Deny</button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------
// RelationshipsPanelBody — entry point
// ---------------------------------------------------------------------
const RelationshipsPanelBody = ({ panel }) => {
  const [mode, setMode] = _re_us("single");
  const [characterId, setCharacterId] = _re_us(null);
  const [compareWith, setCompareWith] = _re_us(null);

  // Rebuild the dataset when the entity / occurrence / review / manuscript
  // stores change, so accepted relationships appear live without a reload.
  const [storeVersion, setStoreVersion] = _re_us(0);
  _re_ue(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:review-queue-updated", "lw:occurrences-updated", "lw:manuscript-chapters-updated", "lw:backend-ready", "lw:project-imported"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  const data = _re_um(() => buildLiveRelDataset() || buildDemoRelDataset(), [storeVersion]);
  const cast = data.castList;

  // Resolve the effective selection against the live cast so stale ids from a
  // previous project don't blank the view.
  const curChar = (characterId && data.castMap[characterId]) ? characterId
    : (cast.find((c) => _relNorm(c.role) === "protagonist")?.id || cast[0]?.id || null);
  const curPair = (compareWith && data.castMap[compareWith] && compareWith !== curChar) ? compareWith
    : (cast.find((c) => c.id !== curChar)?.id || null);

  const onCompare = _re_uc((a, b) => {
    setCharacterId(a); setCompareWith(b); setMode("compare");
  }, []);
  const onSelectCharacter = _re_uc((id) => { setCharacterId(id); setMode("single"); }, []);

  return (
    <div className="rel" data-ui="RelationshipsPanelBody">
      <div className="rel-bar">
        <div className="rel-bar__modes">
          {REL_MODES.map((m) => (
            <button key={m.id} className={"rel-bar__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => setMode(m.id)} data-callback="onSetRelationshipMode" data-mode={m.id}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              {m.id === "review" && data.review.length > 0 && <span className="rel-bar__q">{data.review.length}</span>}
            </button>
          ))}
        </div>
        <div className="rel-bar__cast">
          {cast.map((c) => (
            <button key={c.id}
                    className={"rel-bar__cast-b" + (curChar === c.id ? " is-on" : "") + (mode === "compare" && curPair === c.id ? " is-pair" : "")}
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
        {cast.length === 0
          ? <div className="rel-empty rel-empty--lg" style={{ margin: 16 }}>No cast yet — create characters to map their relationships.</div>
          : <>
            {mode === "single"   && <RelSingleView characterId={curChar} data={data} onSelectCharacter={onSelectCharacter} onCompare={onCompare}/>}
            {mode === "compare"  && <RelCompareView aId={curChar} bId={curPair} data={data} onSelectCharacter={onSelectCharacter}/>}
            {mode === "network"  && <RelNetworkView data={data} onSelectCharacter={onSelectCharacter} onCompare={onCompare}/>}
            {mode === "timeline" && <RelTimelineView data={data}/>}
            {mode === "conflict" && <RelConflictView data={data} onCompare={onCompare}/>}
            {mode === "review"   && <RelReviewView data={data}/>}
          </>}
      </div>
    </div>
  );
};

Object.assign(window, {
  RELATIONSHIPS, REL_EVIDENCE, REL_CHANGES, REL_REVIEW, REL_TYPES, REL_MODES,
  RelationshipsPanelBody, RelSingleView, RelCompareView, RelNetworkView,
  RelTimelineView, RelConflictView, RelReviewView,
  buildLiveRelDataset, buildDemoRelDataset,
});

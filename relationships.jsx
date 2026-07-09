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
// Area 4 (visual tabs): every mode now reads the live project store —
// cast come from EntityService("cast"), edges from
// EntityService("relationships"), the review queue from
// ReviewService("relationships"). No demo data; honest empty states.
// Two persisted shapes are tolerated: extraction-accepted relationships
// (data.fromId / data.toId / data.relationshipType) and editor-saved
// relationships (from / to / bondType / intensity / valence).
// =====================================================================

const { useState: _re_us, useMemo: _re_um, useCallback: _re_uc, useEffect: _re_ue } = React;

// ---------------------------------------------------------------------
// Static vocab — relationship types + mode tabs.
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

const REL_MODES = [
  { id: "single",   label: "Single",      icon: "user" },
  { id: "compare",  label: "Compare 2",   icon: "link" },
  { id: "network",  label: "Network",     icon: "branch" },
  { id: "timeline", label: "History",     icon: "clock" },
  { id: "conflict", label: "Conflict",    icon: "warn" },
  { id: "review",   label: "Review",      icon: "bell" },
];

// ---------------------------------------------------------------------
// Live-store adapters
// ---------------------------------------------------------------------
const _REL_PALETTE = [
  "#7a6aa3", "#a8553f", "#5d6d4e", "#b78a52", "#6b6f7a", "#8a6b58",
  "#3e6db5", "#b86a82", "#c98a2c", "#3d3a78", "#4f7d6a", "#9a5b7a",
];
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

const _relRole = (raw) => {
  const r = String(raw || "").toLowerCase();
  if (["protagonist", "hero", "pov", "central"].includes(r)) return "protagonist";
  if (["antagonist", "villain"].includes(r)) return "antagonist";
  if (!r) return "minor";
  if (["minor", "walk-on", "background"].includes(r)) return "minor";
  return "supporting";
};

// Read a field from either the flat entity or its nested `data.*`, trying
// each candidate key in order. Tolerates all persisted relationship shapes.
const _relPick = (e, ...keys) => {
  if (!e) return undefined;
  const d = e.data || {};
  for (const k of keys) {
    if (d[k] != null && d[k] !== "") return d[k];
    if (e[k] != null && e[k] !== "") return e[k];
  }
  return undefined;
};

// A related-picker value can be a bare id, or `{ id, name, type }`.
const _relIdOf = (v) => (typeof v === "string" ? v : (v && v.id) || null);

// Map any stored bond/verb word onto one of REL_TYPES.
const _REL_TYPE_ALIASES = {
  friend: "friend", friends: "friend", ally: "friend", allies: "friend",
  befriend: "friend", befriends: "friend", "loyal-to": "friend", sworn: "friend",
  enemy: "enemy", enemies: "enemy", hates: "enemy", hate: "enemy", fights: "enemy",
  kills: "enemy", betrays: "enemy", opposes: "enemy",
  family: "family", father: "family", mother: "family", brother: "family",
  sister: "family", son: "family", daughter: "family", parent: "family",
  cousin: "family", married: "family", wife: "family", husband: "family", oath: "family",
  lover: "lover", lovers: "lover", loves: "lover", love: "lover", kisses: "lover",
  rival: "rival", rivals: "rival", competes: "rival", debt: "rival",
  mentor: "mentor", mentors: "mentor", trains: "mentor", teaches: "mentor",
  masters: "mentor", serves: "mentor", "ward-of": "mentor",
  faction: "faction",
  stranger: "unknown", other: "unknown", unknown: "unknown",
};
const _normRelType = (raw) => {
  const k = String(raw || "").toLowerCase().replace(/[^a-z-]/g, "");
  if (REL_TYPES[k]) return k;
  return _REL_TYPE_ALIASES[k] || "unknown";
};

const _REL_TYPE_METERS = {
  friend:  { strength: 72, trust: 82, conflict: 16 },
  enemy:   { strength: 66, trust: 10, conflict: 84 },
  family:  { strength: 70, trust: 64, conflict: 32 },
  lover:   { strength: 84, trust: 72, conflict: 26 },
  rival:   { strength: 62, trust: 34, conflict: 68 },
  mentor:  { strength: 68, trust: 76, conflict: 20 },
  faction: { strength: 55, trust: 45, conflict: 40 },
  unknown: { strength: 40, trust: 40, conflict: 30 },
};

const _REL_VALENCE_ADJ = {
  positive: { trust: 15, conflict: -15 },
  negative: { trust: -15, conflict: 20 },
  mixed:    {},
  cold:     { trust: -10, conflict: 5 },
  heated:   { conflict: 20 },
  quiet:    { conflict: -10 },
};

const _relClamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

// Build the live cast index [{ id, name, initials, color, role, goals, fears }].
const _relLiveCast = () => {
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  const list = (B && B.EntityService && B.EntityService.listSync("cast")) || [];
  return list.map((e) => {
    const d = e.data || {};
    return {
      id: e.id,
      name: e.name || d.name || "Unnamed",
      initials: e.glyphChar || _relInitials(e.name || d.name),
      color: _relColor(e.id),
      role: _relRole(d.role || e.role),
      goals: Array.isArray(d.goals) ? d.goals : [],
      fears: Array.isArray(d.fears) ? d.fears : [],
    };
  });
};

// Map one persisted relationship entity → the graph shape the views expect.
// Returns null when either endpoint can't be resolved to a known cast id.
const _relLiveEdge = (e, castById, chapterNumById) => {
  if (!e) return null;
  const a = _relIdOf(_relPick(e, "fromId", "from", "a", "character1"));
  const b = _relIdOf(_relPick(e, "toId", "to", "b", "character2"));
  if (!a || !b || a === b) return null;
  if (!castById[a] || !castById[b]) return null;

  const type = _normRelType(_relPick(e, "relationshipType", "bondType", "type", "kind"));
  const base = _REL_TYPE_METERS[type] || _REL_TYPE_METERS.unknown;

  const rawStrength = Number(_relPick(e, "strength", "intensity"));
  const strength = Number.isFinite(rawStrength) ? _relClamp(rawStrength) : base.strength;

  const rawTrust = Number(_relPick(e, "trust"));
  const rawConflict = Number(_relPick(e, "conflict"));
  const valence = String(_relPick(e, "valence") || "").toLowerCase();
  const adj = _REL_VALENCE_ADJ[valence] || {};
  const trust = Number.isFinite(rawTrust) ? _relClamp(rawTrust) : _relClamp(base.trust + (adj.trust || 0));
  const conflict = Number.isFinite(rawConflict) ? _relClamp(rawConflict) : _relClamp(base.conflict + (adj.conflict || 0));

  const secret = _relPick(e, "secret") === true || valence === "cold";
  const summary = e.summary || _relPick(e, "summary") || _relPick(e, "relationshipNotes")
    || `${castById[a].name} · ${castById[b].name}`;

  // Chapters: explicit list wins; else a single stored chapter ref mapped
  // to its number; else none (the views degrade honestly).
  let chapters = _relPick(e, "chapters");
  if (Array.isArray(chapters)) {
    chapters = chapters.map((c) => (typeof c === "number" ? c : chapterNumById[c] || c)).filter((n) => n != null);
  } else {
    const single = _relPick(e, "chapter", "chapterId");
    const num = typeof single === "number" ? single : chapterNumById[single];
    chapters = num != null ? [num] : [];
  }

  return {
    id: e.id, a, b, type, strength, trust, conflict, secret, summary, chapters,
    _entity: e,
  };
};

// Flatten a live edge back into an editor-friendly initial payload, mapping
// the resolved endpoints onto the editor's `from` / `to` related pickers and
// `bondType` so an existing relationship prefills regardless of how it was
// originally persisted (extraction data.* vs editor flat fields).
const _relEditInitial = (edge, castById) => {
  const e = (edge && edge._entity) || {};
  const a = castById[edge.a], b = castById[edge.b];
  return {
    ...(e.data || {}),
    ...e,
    id: edge.id,
    from: a ? { id: a.id, name: a.name, type: "cast" } : undefined,
    to: b ? { id: b.id, name: b.name, type: "cast" } : undefined,
    bondType: edge.type,
    summary: edge.summary,
  };
};

// Evidence rows from an edge's stored evidence (string or array).
const _relLiveEvidence = (edge) => {
  if (!edge || !edge._entity) return [];
  const raw = _relPick(edge._entity, "evidence", "sourceQuote", "sourceQuotes");
  if (!raw) return [];
  const arr = Array.isArray(raw) ? raw : [raw];
  return arr
    .map((v, i) => {
      if (!v) return null;
      if (typeof v === "string") return { id: edge.id + "-ev" + i, rel: edge.id, chapter: null, quote: v };
      return { id: edge.id + "-ev" + i, rel: edge.id, chapter: v.chapter ?? null, quote: v.quote || v.text || "" };
    })
    .filter((x) => x && x.quote);
};

// Build the whole live data bundle once per render pass.
const buildRelData = () => {
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  const cast = _relLiveCast();
  const castById = Object.fromEntries(cast.map((c) => [c.id, c]));

  const chapterNumById = {};
  try {
    const state = (B && B.ManuscriptChapterService && B.ManuscriptChapterService.loadSync()) || {};
    (state.chapters || []).filter((c) => !c.reserved).forEach((c, i) => {
      chapterNumById[c.id] = c.num || (i + 1);
    });
  } catch (_e) {}

  const rawRels = (B && B.EntityService && B.EntityService.listSync("relationships")) || [];
  const relationships = rawRels
    .filter((e) => e && e.status !== "deleted")
    .map((e) => _relLiveEdge(e, castById, chapterNumById))
    .filter(Boolean);

  // Pending review candidates for relationships.
  const queue = (B && B.ReviewService && B.ReviewService.listSync("relationships")) || [];
  const review = queue
    .filter((q) => q.status === "pending")
    .map((q) => {
      const conf = typeof q.confidence === "number" ? q.confidence
        : typeof q.value === "number" ? q.value / 100 : 0.55;
      const pct = Math.round(conf * 100);
      const lvl = pct >= 80 ? "strong" : pct >= 60 ? "uncertain" : "weak";
      const changes = q.suggestedChanges || {};
      const fromName = castById[_relIdOf(changes.fromId || changes.from)]?.name;
      const toName = castById[_relIdOf(changes.toId || changes.to)]?.name;
      const title = (fromName && toName) ? `${fromName} → ${toName}` : (q.name || "Relationship candidate");
      const chNum = chapterNumById[q.chapterId];
      return {
        id: q.id,
        lvl,
        title,
        action: changes.relationshipType ? `New ${_normRelType(changes.relationshipType)} bond` : (q.action || "New rel candidate"),
        excerpt: q.sourceQuote || (q.payload && q.payload.context) || q.context || q.summary || "",
        cite: chNum ? ("Ch. " + chNum) : (q.cite || ""),
      };
    });

  return { cast, castById, relationships, review };
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
  if (!cast) return <span className="rel-avatar" style={{ width: size, height: size }}/>;
  return (
    <span className="rel-avatar" style={{ "--c": cast.color, width: size, height: size, fontSize: size * 0.32 }}>
      {cast.initials}
    </span>
  );
};

// ---------------------------------------------------------------------
// Small empty-state block used across modes.
// ---------------------------------------------------------------------
const RelModeEmpty = ({ title, body }) => (
  <div className="rel-empty rel-empty--lg" style={{ margin: 24, textAlign: "center" }}>
    <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-md)", color: "var(--ink-2)", marginBottom: 6 }}>{title}</div>
    <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-3)" }}>{body}</div>
  </div>
);

// ---------------------------------------------------------------------
// Single character view
// ---------------------------------------------------------------------
const RelSingleView = ({ data, characterId, onSelectCharacter, onCompare }) => {
  const { castById } = data;
  const c = castById[characterId];
  if (!c) return <div style={{ padding: 16, color: "var(--ink-3)" }}>Pick a character to begin.</div>;

  const rels = data.relationships.filter((r) => r.a === characterId || r.b === characterId);
  const groups = {};
  for (const r of rels) {
    const k = r.type;
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  }

  const hopes = c.goals || [];
  const fears = c.fears || [];

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
        <RelModeEmpty
          title={`No relationships tracked for ${c.name} yet`}
          body="Run extraction over the manuscript, or add a relationship from the Entity Editor, and it will appear here."/>
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
                  const other = castById[r.a === characterId ? r.b : r.a];
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

      <div className="rel-twocol">
        <div className="rel-section">
          <div className="rel-section__head">Hopes</div>
          {hopes.length
            ? <ul className="rel-bullets">{hopes.map((h, i) => <li key={i}>{h}</li>)}</ul>
            : <div className="rel-empty">No goals recorded — add them in the character's dossier.</div>}
        </div>
        <div className="rel-section">
          <div className="rel-section__head">Fears</div>
          {fears.length
            ? <ul className="rel-bullets">{fears.map((h, i) => <li key={i}>{h}</li>)}</ul>
            : <div className="rel-empty">No fears recorded — add them in the character's dossier.</div>}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Compare view (2 characters)
// ---------------------------------------------------------------------
const RelCompareView = ({ data, aId, bId, onSelectCharacter }) => {
  const { castById } = data;
  const a = castById[aId], b = castById[bId];
  if (!a || !b) return <div style={{ padding: 16 }}>Pick two characters.</div>;

  const rel = data.relationships.find((r) =>
    (r.a === aId && r.b === bId) || (r.a === bId && r.b === aId));
  const evidence = rel ? _relLiveEvidence(rel) : [];
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
                  {e.chapter != null && <div className="rel-quote__cite">Ch. {e.chapter}</div>}
                  <p>"{e.quote}"</p>
                </div>
              ))}
              {evidence.length === 0 && <div className="rel-empty">No source evidence yet.</div>}
              <button className="rel-add" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "relationships", initial: _relEditInitial(rel, castById), mode: "full" } }))}>+ Add evidence</button>
            </div>
            <div className="rel-section">
              <div className="rel-section__head">Details</div>
              <div className="rel-change">
                <div className="rel-change__head">
                  <span className="rel-change__kind">{t.label}</span>
                  <span style={{ flex: 1 }}/>
                  {rel.chapters.length > 0 && <span className="rel-change__date">Ch. {rel.chapters.join(", ")}</span>}
                </div>
                <div className="rel-change__note">{rel.summary}</div>
                <div className="rel-change__delta">
                  <span>strength <b>{rel.strength}</b> · trust <b>{rel.trust}</b> · conflict <b>{rel.conflict}</b></span>
                </div>
              </div>
            </div>
          </div>

          <div className="rel-compare__actions">
            <button onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "relationships", initial: _relEditInitial(rel, castById), mode: "full" } }))}>Edit relationship</button>
            <button onClick={() => onSelectCharacter(aId)}>Open {a.name.split(" ")[0]}</button>
            <button onClick={() => onSelectCharacter(bId)}>Open {b.name.split(" ")[0]}</button>
          </div>
        </>
      ) : (
        <div className="rel-empty rel-empty--lg">
          No tracked relationship between {a.name} and {b.name} yet.
          <button className="rel-add" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "relationships", initial: { from: { id: a.id, name: a.name, type: "cast" }, to: { id: b.id, name: b.name, type: "cast" } }, mode: "full" } }))}>+ Create</button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Network graph view — deterministic circular layout over live cast.
// ---------------------------------------------------------------------
const RelNetworkView = ({ data, onSelectCharacter, onCompare }) => {
  const { castById, relationships } = data;

  // Nodes = every cast member that participates in at least one edge.
  const ids = [];
  const seen = new Set();
  for (const r of relationships) {
    for (const id of [r.a, r.b]) {
      if (!seen.has(id) && castById[id]) { seen.add(id); ids.push(id); }
    }
  }

  if (ids.length === 0) {
    return <RelModeEmpty title="No relationship network yet"
      body="Once two characters share a tracked relationship, the graph draws them here."/>;
  }

  const W = 800, H = 540;
  const cx = 50, cy = 50, radius = ids.length <= 1 ? 0 : 34;
  const positions = {};
  ids.forEach((id, i) => {
    const ang = (i / ids.length) * 2 * Math.PI - Math.PI / 2;
    positions[id] = { x: cx + radius * Math.cos(ang), y: cy + radius * Math.sin(ang) };
  });

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
        {relationships.map((r) => {
          const pa = positions[r.a], pb = positions[r.b];
          if (!pa || !pb) return null;
          const t = REL_TYPES[r.type] || REL_TYPES.unknown;
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
        {ids.map((id) => {
          const p = positions[id];
          const c = castById[id];
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
        {Object.values(REL_TYPES).filter((t) => relationships.some((r) => r.type === t.id)).map((t) => (
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
// Timeline (relationships grouped by the chapter they first appear in)
// ---------------------------------------------------------------------
const RelTimelineView = ({ data }) => {
  const { castById, relationships } = data;
  const placed = relationships.filter((r) => r.chapters.length > 0);

  if (placed.length === 0) {
    return <RelModeEmpty title="No chapter-anchored relationships yet"
      body="Relationships discovered during extraction carry the chapter they were found in. Run extraction to populate this history."/>;
  }

  const grouped = {};
  for (const r of placed) {
    const ch = Math.min(...r.chapters);
    grouped[ch] = grouped[ch] || [];
    grouped[ch].push(r);
  }
  return (
    <div className="rel-tl">
      {Object.entries(grouped).sort((a, b) => Number(a[0]) - Number(b[0])).map(([ch, rels]) => (
        <div key={ch} className="rel-tl__chapter">
          <div className="rel-tl__chap-head">Ch. {ch}</div>
          <div className="rel-tl__list">
            {rels.map((r) => {
              const a = castById[r.a], b = castById[r.b];
              if (!a || !b) return null;
              const t = REL_TYPES[r.type] || REL_TYPES.unknown;
              return (
                <div key={r.id} className="rel-tl__card">
                  <div className="rel-tl__heads">
                    <RelAvatar cast={a} size={20}/>
                    <Icon name="link" size={11}/>
                    <RelAvatar cast={b} size={20}/>
                    <span className="rel-tl__rel">{a.name} ↔ {b.name}</span>
                    <span className="rel-tl__kind">{t.label}</span>
                  </div>
                  <div className="rel-tl__note">{r.summary}</div>
                  <div className="rel-tl__delta">
                    <span>strength <b>{r.strength}</b> · conflict <b>{r.conflict}</b></span>
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
  const { castById, relationships } = data;
  const conflicts = relationships.filter((r) => r.conflict > 40).sort((a, b) => b.conflict - a.conflict);
  return (
    <div className="rel-conflict">
      {conflicts.map((r) => {
        const a = castById[r.a], b = castById[r.b];
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
// Review queue — live pending relationship candidates.
// ---------------------------------------------------------------------
const _relQueueDispatch = (name, id) =>
  window.dispatchEvent(new CustomEvent("lw:dispatch-callback", { detail: { name, detail: { id } } }));

const RelReviewView = ({ data }) => {
  const items = data.review;
  if (!items.length) {
    return (
      <div className="rel-empty rel-empty--lg" style={{ margin: 24, textAlign: "center" }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-md)", color: "var(--ink-2)", marginBottom: 6 }}>Nothing to review</div>
        <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-3)" }}>Relationship candidates found during extraction will surface here.</div>
      </div>
    );
  }
  return (
    <div className="rel-review">
      {items.map((r) => (
        <div key={r.id} className={"rel-review__card rel-review__card--" + r.lvl}>
          <div className="rel-review__head">
            <ConfidenceBadge level={r.lvl}/>
            <span className="rel-review__title">{r.title}</span>
          </div>
          {r.excerpt && <p className="rel-review__quote">"{r.excerpt}"</p>}
          {r.cite && <div className="rel-review__meta">{r.cite}</div>}
          <div className="rel-review__pill">{r.action}</div>
          <div className="rel-review__actions">
            <button onClick={() => _relQueueDispatch("onAcceptRelationshipQueueItem", r.id)}>Accept</button>
            <button onClick={() => _relQueueDispatch("onEditRelationshipQueueItem", r.id)}>Edit</button>
            <button onClick={() => _relQueueDispatch("onMergeRelationshipQueueItem", r.id)}>Merge</button>
            <button onClick={() => _relQueueDispatch("onDenyRelationshipQueueItem", r.id)}>Deny</button>
          </div>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// Full-panel empty state — no cast at all.
// ---------------------------------------------------------------------
const RelEmpty = () => (
  <div className="rel" data-ui="RelationshipsPanelBody">
    <div className="rel-empty rel-empty--lg" style={{ margin: "48px auto", maxWidth: 460, textAlign: "center" }}>
      <div style={{ fontFamily: "var(--font-display)", fontSize: "var(--fs-lg)", color: "var(--ink-2)", marginBottom: 8 }}>No cast yet</div>
      <div style={{ fontSize: "var(--fs-sm)", color: "var(--ink-3)", lineHeight: 1.55 }}>
        Relationships map the bonds between your characters. Add people to your
        cast — or run extraction over the manuscript — and their relationships
        will appear here.
      </div>
    </div>
  </div>
);

// ---------------------------------------------------------------------
// RelationshipsPanelBody — entry point
// ---------------------------------------------------------------------
const RelationshipsPanelBody = ({ panel }) => {
  // Re-derive live data on every relevant store mutation.
  const [storeVersion, setStoreVersion] = _re_us(0);
  _re_ue(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:manuscript-chapters-updated",
      "lw:review-queue-updated", "lw:occurrences-updated", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);

  const data = _re_um(() => buildRelData(), [storeVersion]);
  const { cast } = data;

  const [mode, setMode] = _re_us("single");
  const [characterId, setCharacterId] = _re_us(null);
  const [compareWith, setCompareWith] = _re_us(null);

  // Keep the current selection valid as the live cast changes.
  _re_ue(() => {
    if (!cast.length) return;
    setCharacterId((prev) => (prev && data.castById[prev]) ? prev
      : (cast.find((c) => c.role === "protagonist")?.id || cast[0].id));
    setCompareWith((prev) => (prev && data.castById[prev]) ? prev
      : (cast[1]?.id || cast[0].id));
  }, [cast, data.castById]);

  const onCompare = _re_uc((a, b) => {
    setCharacterId(a); setCompareWith(b); setMode("compare");
  }, []);
  const onSelectCharacter = _re_uc((id) => { setCharacterId(id); setMode("single"); }, []);

  if (!cast.length) return <RelEmpty/>;

  return (
    <div className="rel" data-ui="RelationshipsPanelBody">
      <div className="rel-bar">
        <div className="rel-bar__modes">
          {REL_MODES.map((m) => (
            <button key={m.id} className={"rel-bar__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => setMode(m.id)} data-mode={m.id}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              {m.id === "review" && data.review.length > 0 && <span className="rel-bar__q">{data.review.length}</span>}
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
              <span>{c.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="rel-body">
        {mode === "single"   && <RelSingleView data={data} characterId={characterId} onSelectCharacter={onSelectCharacter} onCompare={onCompare}/>}
        {mode === "compare"  && <RelCompareView data={data} aId={characterId} bId={compareWith} onSelectCharacter={onSelectCharacter}/>}
        {mode === "network"  && <RelNetworkView data={data} onSelectCharacter={onSelectCharacter} onCompare={onCompare}/>}
        {mode === "timeline" && <RelTimelineView data={data}/>}
        {mode === "conflict" && <RelConflictView data={data} onCompare={onCompare}/>}
        {mode === "review"   && <RelReviewView data={data}/>}
      </div>
    </div>
  );
};

Object.assign(window, {
  REL_TYPES, REL_MODES, buildRelData,
  RelationshipsPanelBody, RelSingleView, RelCompareView, RelNetworkView,
  RelTimelineView, RelConflictView, RelReviewView,
});

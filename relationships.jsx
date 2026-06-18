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
// All views render LIVE project data:
//   cast strip / avatars   ← EntityService.listSync("cast")
//   edges (bonds)          ← LinkService.listRelationshipEdgesSync()
//                            (explicit `relationships` records + synthetic
//                             edges from cast family/allies/… fields)
//   hopes & fears          ← cast data.goals / data.fears
//   recent changes         ← AuditService events on relationships records
//   review queue           ← ReviewService.listSync("relationships")
// =====================================================================

const { useState: _re_us, useMemo: _re_um, useCallback: _re_uc, useRef: _re_ur } = React;

// ---------------------------------------------------------------------
// Type style table — colors for each bond bucket. Style metadata only;
// the live type vocabulary is normalised into these buckets by
// LinkService.listRelationshipEdgesSync().
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
// Live context — one snapshot of everything the views render.
// ---------------------------------------------------------------------
const REL_PALETTE = ["#5d6d4e", "#3e6db5", "#a8553f", "#8a6a2a", "#b86a82", "#3d3a78", "#c98a2c", "#76684c"];
const _relHash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const _relChips = (v) => {
  if (Array.isArray(v)) return v.map((x) => (typeof x === "string" ? x : x && (x.label || x.name))).filter(Boolean);
  if (typeof v === "string" && v.trim()) return v.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
  return [];
};
const _relInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase() || "?";
};
const _relRole = (role) => {
  const r = String(role || "").trim();
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : "";
};
const _relAgo = (iso) => {
  const t = iso ? Date.parse(iso) : NaN;
  if (!isFinite(t)) return "";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return mins + " min ago";
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
  const days = Math.round(hours / 24);
  if (days < 7) return days + (days === 1 ? " day ago" : " days ago");
  const weeks = Math.round(days / 7);
  return weeks + (weeks === 1 ? " week ago" : " weeks ago");
};

// Recent relationship changes, derived from the audit log. Maps audit
// before/after diffs onto the designed change-card kinds.
const _buildRelChanges = (B, edges) => {
  const byRecord = new Map(edges.filter((e) => e.recordId).map((e) => [e.recordId, e]));
  const events = (B?.AuditService?.listSync?.({ limit: 80 }) || [])
    .filter((ev) => ev.entityType === "relationships" && !ev.undone);
  const num = (v) => { const n = typeof v === "string" ? parseFloat(v) : v; return typeof n === "number" && isFinite(n) ? n : null; };
  const out = [];
  for (const ev of events) {
    const edge = byRecord.get(ev.targetId);
    if (!edge) continue;
    const beforeD = (ev.before && ev.before.data) || null;
    const afterD = (ev.after && ev.after.data) || {};
    let kind = "update", from = null, to = null;
    if (ev.action === "entity.create") {
      kind = "new"; to = edge.rawType || edge.type;
    } else if (beforeD) {
      const bT = beforeD.bondType ?? beforeD.relationshipType;
      const aT = afterD.bondType ?? afterD.relationshipType;
      const bI = num(beforeD.intensity ?? beforeD.strength);
      const aI = num(afterD.intensity ?? afterD.strength);
      if ((bT || aT) && bT !== aT) { kind = "type"; from = bT || "—"; to = aT || "—"; }
      else if (!!beforeD.secret !== !!afterD.secret) { kind = "secret"; from = !!beforeD.secret; to = !!afterD.secret; }
      else if (bI != null && aI != null && bI !== aI) { kind = "strength"; from = bI; to = aI; }
    }
    out.push({
      id: ev.id,
      rel: edge.id,
      chapter: edge.chapters?.[0] || 0,
      kind, from, to,
      note: ev.label || "",
      date: _relAgo(ev.createdAt),
    });
    if (out.length >= 30) break;
  }
  return out;
};

const buildRelContext = () => {
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  const ctx = { cast: {}, castList: [], relationships: [], changes: [], review: [] };
  if (!B) return ctx;
  const castEntities = (B.EntityService?.listSync?.("cast") || []).filter((e) => e && e.status !== "deleted");
  for (const e of castEntities) {
    const d = e.data || {};
    const c = {
      id: e.id,
      name: e.name || "Unnamed",
      initials: e.glyphChar || _relInitials(e.name),
      color: d.color || REL_PALETTE[_relHash(e.id) % REL_PALETTE.length],
      role: _relRole(d.role),
      hopes: _relChips(d.goals),
      fears: _relChips(d.fears),
    };
    ctx.cast[c.id] = c;
    ctx.castList.push(c);
  }
  ctx.relationships = (B.LinkService?.listRelationshipEdgesSync?.() || [])
    .filter((r) => ctx.cast[r.a] && ctx.cast[r.b]);
  ctx.changes = _buildRelChanges(B, ctx.relationships);

  // Review queue → designed card shape.
  const chapterNum = new Map();
  try {
    const chState = B.ManuscriptChapterService?.loadSync?.() || {};
    (chState.chapters || []).filter((c) => !c.reserved).forEach((c, i) => chapterNum.set(c.id, c.num || i + 1));
  } catch (_e) {}
  ctx.review = (B.ReviewService?.listSync?.("relationships") || [])
    .filter((q) => q.status === "pending")
    .map((q) => {
      const conf = typeof q.confidence === "number" ? q.confidence : (typeof q.value === "number" ? q.value / 100 : 0.6);
      const lvl = conf >= 0.95 ? "high" : conf >= 0.75 ? "strong" : conf >= 0.5 ? "uncertain" : "weak";
      const chNum = q.chapterId ? chapterNum.get(q.chapterId) : null;
      return {
        id: q.id,
        lvl,
        title: q.name || "Relationship candidate",
        action: q.suggestedAction === "create" ? "New rel candidate"
          : q.suggestedAction === "update" ? "Update relationship"
          : (q.action || "Review"),
        excerpt: q.sourceQuote || (q.payload && q.payload.sourceQuote) || q.summary || q.reason || "",
        cite: chNum ? "Ch. " + chNum : "",
      };
    });
  return ctx;
};

const _relDispatch = (name, detail) =>
  window.dispatchEvent(new CustomEvent(name, { detail }));
const _relQueueAction = (name, id) =>
  _relDispatch("lw:dispatch-callback", { name, detail: { id } });

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
const RelSingleView = ({ ctx, characterId, onSelectCharacter, onCompare, onOpenTimeline, onCreateRelationship }) => {
  const cast = ctx.cast;
  const c = cast[characterId];
  if (!c) return <div style={{ padding: 16, color: "var(--ink-3)" }}>Pick a character to begin.</div>;

  const rels = ctx.relationships.filter((r) => r.a === characterId || r.b === characterId);
  const groups = {};
  for (const r of rels) {
    const k = r.type;
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  }

  const hf = { hopes: c.hopes || [], fears: c.fears || [] };
  const changes = ctx.changes.filter((rc) => {
    const rel = ctx.relationships.find((r) => r.id === rc.rel);
    return rel && (rel.a === characterId || rel.b === characterId);
  });

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
      {rels.length === 0 && (
        <div className="rel-empty rel-empty--lg">
          No tracked relationships for {c.name} yet.
          <button className="rel-add" data-callback="onCreateRelationship"
                  onClick={() => onCreateRelationship && onCreateRelationship({ aId: characterId })}>+ Create</button>
        </div>
      )}

      <div className="rel-twocol">
        <div className="rel-section">
          <div className="rel-section__head">Hopes</div>
          {hf.hopes.length
            ? <ul className="rel-bullets">{hf.hopes.map((h, i) => <li key={i}>{h}</li>)}</ul>
            : <div className="rel-empty">No goals recorded — add them in {c.name}'s editor.</div>}
        </div>
        <div className="rel-section">
          <div className="rel-section__head">Fears</div>
          {hf.fears.length
            ? <ul className="rel-bullets">{hf.fears.map((h, i) => <li key={i}>{h}</li>)}</ul>
            : <div className="rel-empty">No fears recorded yet.</div>}
        </div>
      </div>

      <div className="rel-section">
        <div className="rel-section__head">
          Recent relationship changes
          <span style={{ flex: 1 }}/>
          <button className="rel-section__more" data-callback="onOpenRelationshipTimeline"
                  onClick={() => onOpenTimeline && onOpenTimeline()}>All changes →</button>
        </div>
        {changes.length === 0 && <div className="rel-empty">No changes recorded yet — edits to bonds appear here.</div>}
        {changes.slice(0, 4).map((rc) => {
          const rel = ctx.relationships.find((r) => r.id === rc.rel);
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
                {rc.kind === "strength" && <span>strength {rc.from} → <b>{rc.to}</b></span>}
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
const RelCompareView = ({ ctx, aId, bId, onSelectCharacter, onCreateRelationship, onChangeType, onAddEvidence, onShowSharedPlaces, onOpenDossiers }) => {
  const cast = ctx.cast;
  const a = cast[aId], b = cast[bId];
  if (!a || !b) return <div style={{ padding: 16 }}>Pick two characters.</div>;

  const rel = ctx.relationships.find((r) =>
    (r.a === aId && r.b === bId) || (r.a === bId && r.b === aId));
  const evidence = rel ? (rel.evidence || []) : [];
  const changes = ctx.changes.filter((c) => rel && c.rel === rel.id);
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
                  <div className="rel-quote__cite">Ch. {e.chapter}</div>
                  <p>"{e.quote}"</p>
                </div>
              ))}
              {evidence.length === 0 && <div className="rel-empty">No source evidence yet.</div>}
              <button className="rel-add" data-callback="onAddRelationshipEvidence"
                      onClick={() => onAddEvidence && onAddEvidence(rel, aId, bId)}>+ Add evidence</button>
            </div>
            <div className="rel-section">
              <div className="rel-section__head">Timeline of changes</div>
              {changes.map((c) => (
                <div key={c.id} className="rel-change">
                  <div className="rel-change__head">
                    <span className="rel-change__kind">{c.kind}</span>
                    <span style={{ flex: 1 }}/>
                    <span className="rel-change__date">{c.chapter ? "Ch. " + c.chapter : c.date}</span>
                  </div>
                  <div className="rel-change__note">{c.note}</div>
                </div>
              ))}
              {changes.length === 0 && <div className="rel-empty">No tracked changes yet.</div>}
            </div>
          </div>

          <div className="rel-compare__actions">
            <button data-callback="onChangeRelationshipType"
                    onClick={() => onChangeType && onChangeType(rel, aId, bId)}>Change type</button>
            <button data-testid="rel-create-event"
                    onClick={() => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "events", initial: { data: { participants: [aId, bId].filter(Boolean) } }, mode: "full" } }))}>Create event</button>
            <button data-callback="onOpenAtlasForSharedLocations"
                    onClick={() => onShowSharedPlaces && onShowSharedPlaces(aId, bId)}>Show shared places</button>
            <button data-callback="onOpenCharacterDossier"
                    onClick={() => onOpenDossiers && onOpenDossiers(aId, bId)}>Open both dossiers</button>
          </div>
        </>
      ) : (
        <div className="rel-empty rel-empty--lg">
          No tracked relationship between {a.name} and {b.name} yet.
          <button data-callback="onCreateRelationship" className="rel-add"
                  onClick={() => onCreateRelationship && onCreateRelationship({ aId, bId })}>+ Create</button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Network graph view — deterministic layout from the live cast list:
// the best-connected character holds the centre, everyone else sits on
// a ring around them.
// ---------------------------------------------------------------------
const RelNetworkView = ({ ctx, onSelectCharacter, onCompare }) => {
  const cast = ctx.cast;
  const positions = _re_um(() => {
    const degree = (id) => ctx.relationships.filter((r) => r.a === id || r.b === id).length;
    const ordered = [...ctx.castList].sort((x, y) => degree(y.id) - degree(x.id) || x.name.localeCompare(y.name));
    const pos = {};
    if (ordered.length === 1) {
      pos[ordered[0].id] = { x: 50, y: 50 };
    } else if (ordered.length > 1) {
      pos[ordered[0].id] = { x: 50, y: 48 };
      const ring = ordered.slice(1);
      ring.forEach((c, i) => {
        const ang = (i / ring.length) * 2 * Math.PI - Math.PI / 2;
        pos[c.id] = { x: 50 + 38 * Math.cos(ang), y: 50 + 36 * Math.sin(ang) };
      });
    }
    return pos;
  }, [ctx]);
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
        {ctx.relationships.map((r) => {
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
        {Object.values(REL_TYPES).filter((t) => ctx.relationships.some((r) => r.type === t.id)).map((t) => (
          <span key={t.id} className="rel-net__chip">
            <span className="rel-net__chip-sw" style={{ background: t.color }}/>
            {t.label}
          </span>
        ))}
        {ctx.relationships.some((r) => r.secret) &&
          <span className="rel-net__chip rel-net__chip--secret">— — secret</span>}
        {ctx.relationships.some((r) => r.conflict > 60) && (
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
// Timeline (relationship changes across chapters)
// ---------------------------------------------------------------------
const RelTimelineView = ({ ctx }) => {
  const cast = ctx.cast;
  const grouped = {};
  for (const c of ctx.changes) {
    grouped[c.chapter] = grouped[c.chapter] || [];
    grouped[c.chapter].push(c);
  }
  if (!ctx.changes.length) {
    return (
      <div className="rel-tl">
        <div className="rel-empty rel-empty--lg">No relationship changes recorded yet — create or edit bonds and their history collects here.</div>
      </div>
    );
  }
  return (
    <div className="rel-tl">
      {Object.entries(grouped).sort((a, b) => Number(a[0]) - Number(b[0])).map(([ch, changes]) => (
        <div key={ch} className="rel-tl__chapter">
          <div className="rel-tl__chap-head">{Number(ch) ? "Ch. " + ch : "Recent"}</div>
          <div className="rel-tl__list">
            {changes.map((c) => {
              const rel = ctx.relationships.find((r) => r.id === c.rel);
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
                    {c.kind === "strength" && <span>strength {c.from} → <b>{c.to}</b></span>}
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
const RelConflictView = ({ ctx, onCompare }) => {
  const cast = ctx.cast;
  const conflicts = ctx.relationships.filter((r) => r.conflict > 40).sort((a, b) => b.conflict - a.conflict);
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
// Review queue
// ---------------------------------------------------------------------
const RelReviewView = ({ ctx }) => (
  <div className="rel-review">
    {ctx.review.map((r) => (
      <div key={r.id} className={"rel-review__card rel-review__card--" + r.lvl}>
        <div className="rel-review__head">
          <ConfidenceBadge level={r.lvl}/>
          <span className="rel-review__title">{r.title}</span>
        </div>
        <p className="rel-review__quote">"{r.excerpt}"</p>
        <div className="rel-review__meta">{r.cite}</div>
        <div className="rel-review__pill">{r.action}</div>
        <div className="rel-review__actions">
          <button data-callback="onAcceptRelationshipQueueItem" data-testid={"rel-accept-" + r.id}
                  onClick={() => _relQueueAction("onAcceptRelationshipQueueItem", r.id)}>Accept</button>
          <button data-callback="onEditRelationshipQueueItem"
                  onClick={() => _relQueueAction("onEditRelationshipQueueItem", r.id)}>Edit</button>
          <button data-callback="onMergeRelationshipQueueItem"
                  onClick={() => _relQueueAction("onMergeRelationshipQueueItem", r.id)}>Merge</button>
          <button data-callback="onDenyRelationshipQueueItem"
                  onClick={() => _relQueueAction("onDenyRelationshipQueueItem", r.id)}>Deny</button>
        </div>
      </div>
    ))}
    {ctx.review.length === 0 && (
      <div className="rel-empty rel-empty--lg">Review queue is clear — relationship candidates from extraction land here.</div>
    )}
  </div>
);

// ---------------------------------------------------------------------
// RelEmptyState — no cast at all yet (the panel chrome stays visible).
// ---------------------------------------------------------------------
const RelEmptyState = () => (
  <div className="rel-empty rel-empty--lg" data-ui="RelEmptyState">
    No characters yet — relationships need people first.
    <span style={{ display: "inline-flex", gap: 8, marginLeft: 8 }}>
      <button className="rel-add" data-callback="onCreateEntity"
              onClick={() => _relDispatch("lw:open-entity-editor", { type: "cast", mode: "full" })}>+ Add a character</button>
      <button className="rel-add" data-callback="onExtractCast"
              onClick={() => _relDispatch("lw:open-extraction-wizard", { scope: "manuscript", typeFocus: "cast" })}>Extract from manuscript</button>
    </span>
  </div>
);

// ---------------------------------------------------------------------
// RelationshipsPanelBody — entry point
// ---------------------------------------------------------------------
const RelationshipsPanelBody = ({ panel, panelContext }) => {
  // Re-snapshot the live context when the store / queue / audit log move.
  const [storeVersion, setStoreVersion] = _re_us(0);
  React.useEffect(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:review-queue-updated", "lw:audit-log-updated",
                 "lw:manuscript-chapters-updated", "lw:occurrences-updated", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  const ctx = _re_um(() => buildRelContext(), [storeVersion]);

  const [mode, setMode] = _re_us("single");
  const [characterId, setCharacterId] = _re_us(null);
  const [compareWith, setCompareWith] = _re_us(null);

  // Cross-tab context: when another panel focuses a cast member, centre the
  // relationship views on them. (panelContext is optional — the
  // RelationshipMapWorkspace mounts this body without it.)
  const focusedCastId = panelContext?.focusedEntity?.type === "cast" ? panelContext.focusedEntity.id : null;
  React.useEffect(() => {
    if (focusedCastId && ctx.cast[focusedCastId]) setCharacterId(focusedCastId);
  }, [focusedCastId, ctx]);

  // Pair focus — "two cast selected elsewhere → show their relationship".
  // Dispatched by the cast multibar's View-relationship action.
  React.useEffect(() => {
    const onPair = (e) => {
      const { aId, bId } = e?.detail || {};
      if (!aId || !bId) return;
      setCharacterId(aId);
      setCompareWith(bId);
      setMode("compare");
    };
    window.addEventListener("lw:pair-focus", onPair);
    return () => window.removeEventListener("lw:pair-focus", onPair);
  }, []);

  // Keep selections valid as the live cast changes (first protagonist wins).
  React.useEffect(() => {
    if (!ctx.castList.length) return;
    if (!characterId || !ctx.cast[characterId]) {
      const lead = ctx.castList.find((c) => /^protagonist/i.test(c.role)) || ctx.castList[0];
      setCharacterId(lead.id);
    }
    if (!compareWith || !ctx.cast[compareWith] || compareWith === characterId) {
      const second = ctx.castList.find((c) => c.id !== (characterId || ""));
      if (second) setCompareWith(second.id);
    }
  }, [ctx, characterId, compareWith]);

  const onCompare = _re_uc((a, b) => {
    setCharacterId(a); setCompareWith(b); setMode("compare");
  }, []);
  const onSelectCharacter = _re_uc((id) => { setCharacterId(id); setMode("single"); }, []);

  // Open the entity editor on an explicit record — or prefilled for a new
  // one (also the path "change type" takes for synthetic dossier edges).
  const openRelationshipEditor = _re_uc((edge, extras = {}) => {
    const Bk = window.LoomwrightBackend;
    if (edge && edge.recordId) {
      const rec = Bk?.EntityService?.getSync?.(edge.recordId, "relationships");
      if (rec) { _relDispatch("lw:open-entity-editor", { type: "relationships", initial: rec, mode: "full" }); return; }
    }
    const mk = (id) => { const c = id && ctx.cast[id]; return c ? { id: c.id, name: c.name, type: "cast" } : undefined; };
    const initial = { data: { from: mk(extras.aId), to: mk(extras.bId), bondType: edge ? edge.type : undefined } };
    _relDispatch("lw:open-entity-editor", { type: "relationships", initial, mode: "full" });
  }, [ctx]);

  const onCreateRelationship = _re_uc(({ aId, bId } = {}) => {
    openRelationshipEditor(null, { aId, bId });
  }, [openRelationshipEditor]);

  const onShowSharedPlaces = _re_uc((aId, bId) => {
    const Bk = window.LoomwrightBackend;
    const locIds = (id) => {
      const d = (Bk?.EntityService?.getSync?.(id, "cast") || {}).data || {};
      const ids = [];
      for (const v of [d.currentLocation, d.homeLocation, d.location]) {
        const arr = Array.isArray(v) ? v : (v ? [v] : []);
        for (const x of arr) { const lid = typeof x === "string" ? x : x?.id; if (lid) ids.push(lid); }
      }
      return ids;
    };
    const shared = locIds(aId).filter((id) => locIds(bId).includes(id));
    _relDispatch("lw:open-panel", { kind: "atlas" });
    if (shared.length) {
      const loc = Bk?.EntityService?.getSync?.(shared[0], "locations");
      _relDispatch("lw:focus-entity", { panelKind: "atlas", entityId: shared[0], label: loc?.name || "" });
    } else {
      _relDispatch("lw:backend-notice", { message: "No shared tracked locations yet — set home/current locations on both characters." });
    }
  }, []);

  const onOpenDossiers = _re_uc((aId, bId) => {
    _relDispatch("lw:open-panel", { kind: "cast" });
    _relDispatch("lw:open-cast-member", { entityId: aId });
    const Bk = window.LoomwrightBackend;
    const ent = bId && Bk?.EntityService?.getSync?.(bId, "cast");
    if (ent) _relDispatch("lw:open-entity-editor", { type: "cast", initial: ent, mode: "full" });
  }, []);

  return (
    <div className="rel" data-ui="RelationshipsPanelBody">
      <div className="rel-bar">
        <div className="rel-bar__modes">
          {REL_MODES.map((m) => (
            <button key={m.id} className={"rel-bar__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => setMode(m.id)} data-callback="onSetRelationshipMode" data-mode={m.id}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              {m.id === "review" && ctx.review.length > 0 && <span className="rel-bar__q">{ctx.review.length}</span>}
            </button>
          ))}
        </div>
        <div className="rel-bar__cast">
          {ctx.castList.map((c) => (
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
        {ctx.castList.length === 0 ? (
          mode === "review" ? <RelReviewView ctx={ctx}/> : <RelEmptyState/>
        ) : (
          <>
            {mode === "single"   && <RelSingleView ctx={ctx} characterId={characterId} onSelectCharacter={onSelectCharacter} onCompare={onCompare} onOpenTimeline={() => setMode("timeline")} onCreateRelationship={onCreateRelationship}/>}
            {mode === "compare"  && <RelCompareView ctx={ctx} aId={characterId} bId={compareWith} onSelectCharacter={onSelectCharacter} onCreateRelationship={onCreateRelationship} onChangeType={(rel, aId, bId) => openRelationshipEditor(rel, { aId, bId })} onAddEvidence={(rel, aId, bId) => openRelationshipEditor(rel, { aId, bId })} onShowSharedPlaces={onShowSharedPlaces} onOpenDossiers={onOpenDossiers}/>}
            {mode === "network"  && <RelNetworkView ctx={ctx} onSelectCharacter={onSelectCharacter} onCompare={onCompare}/>}
            {mode === "timeline" && <RelTimelineView ctx={ctx}/>}
            {mode === "conflict" && <RelConflictView ctx={ctx} onCompare={onCompare}/>}
            {mode === "review"   && <RelReviewView ctx={ctx}/>}
          </>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// RelationshipPairView — compact "what binds these two?" card, rendered
// by the Cast panel when exactly two cast members are multi-selected.
// Live data via LinkService.pairContextSync: recorded bonds (synthetic
// dossier ties included), shared chapters, and co-mention quotes.
// ---------------------------------------------------------------------
const RelationshipPairView = ({ aId, bId, onClose }) => {
  const [tick, setTick] = _re_us(0);
  React.useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    const evs = ["lw:entity-store-updated", "lw:occurrences-updated", "lw:manuscript-chapters-updated"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  const Bk = window.LoomwrightBackend;
  const pair = _re_um(() => Bk?.LinkService?.pairContextSync?.(aId, bId) || { edges: [], sharedChapters: [], quotes: [] }, [aId, bId, tick]);
  const nameOf = (id) => Bk?.EntityService?.getSync?.(id, "cast")?.name || "Unknown";
  const aName = nameOf(aId);
  const bName = nameOf(bId);

  const openInRelationships = () => {
    window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "relationships" } }));
    // Defer so a freshly-mounted panel registers its lw:pair-focus listener.
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent("lw:pair-focus", { detail: { aId, bId } }));
    }, 120);
  };
  const createBond = () => {
    const mk = (id) => ({ id, name: nameOf(id), type: "cast" });
    window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
      detail: { type: "relationships", initial: { data: { from: mk(aId), to: mk(bId) } }, mode: "full" },
    }));
  };

  return (
    <div className="rel-pairview" data-ui="RelationshipPairView">
      <div className="rel-pairview__head">
        <div className="rel-pairview__names">
          <strong>{aName}</strong>
          <Icon name="link" size={11}/>
          <strong>{bName}</strong>
        </div>
        <span className="rel-pairview__spacer"/>
        <button className="rel-pairview__act" data-callback="onOpenPairInRelationships" onClick={openInRelationships}>Open in Relationships →</button>
        {onClose && (
          <button className="rel-pairview__x" data-callback="onClosePairView" onClick={onClose} title="Close pair view">
            <Icon name="close" size={10}/>
          </button>
        )}
      </div>

      {pair.edges.length === 0 && (
        <div className="rel-pairview__none">
          <p>No recorded bond between {aName} and {bName} yet.</p>
          <button className="rel-pairview__act rel-pairview__act--primary" data-callback="onCreateRelationship" onClick={createBond}>
            <Icon name="plus" size={10}/> Record their relationship
          </button>
        </div>
      )}

      {pair.edges.map((edge) => {
        const meta = REL_TYPES[edge.type] || REL_TYPES.unknown;
        return (
          <div key={edge.id} className="rel-pairview__bond" style={{ "--c": meta.color }}>
            <div className="rel-pairview__bond-head">
              <span className="rel-pairview__type">{meta.label}</span>
              {edge.rawType && edge.rawType !== edge.type && <span className="rel-pairview__raw">({edge.rawType})</span>}
              {edge.secret && <span className="rel-pairview__secret">secret</span>}
              {edge.synthetic && <span className="rel-pairview__syn" title="Derived from the cast dossier — record it to edit.">from dossier</span>}
            </div>
            {edge.summary && <p className="rel-pairview__summary">{edge.summary}</p>}
            <div className="rel-pairview__meters">
              <RelMeter k="Strength" v={edge.strength} tone="neutral"/>
              <RelMeter k="Trust" v={edge.trust} tone="good"/>
              <RelMeter k="Conflict" v={edge.conflict} tone="bad"/>
            </div>
            {edge.evidence && edge.evidence.length > 0 && (
              <div className="rel-pairview__evidence">
                {edge.evidence.slice(0, 2).map((ev) => (
                  <div key={ev.id} className="rel-pairview__quote">
                    <span className="rel-pairview__quote-ch">{ev.chapter !== "—" ? "Ch. " + ev.chapter : "—"}</span>
                    <em>"{ev.quote}"</em>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}

      {(pair.sharedChapters.length > 0 || pair.quotes.length > 0) && (
        <div className="rel-pairview__shared">
          {pair.sharedChapters.length > 0 && (
            <div className="rel-pairview__chapters">
              <span className="rel-pairview__lbl">Together in</span>
              {pair.sharedChapters.map((n) => <span key={n} className="rel-pairview__ch">Ch. {n}</span>)}
            </div>
          )}
          {pair.quotes.slice(0, 2).map((q, i) => (
            <div key={i} className="rel-pairview__quote">
              <span className="rel-pairview__quote-ch">Ch. {q.chapter}</span>
              <em>"{q.quote}"</em>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

Object.assign(window, {
  REL_TYPES, REL_MODES, buildRelContext,
  RelationshipsPanelBody, RelSingleView, RelCompareView, RelNetworkView,
  RelTimelineView, RelConflictView, RelReviewView, RelEmptyState,
  RelationshipPairView,
});

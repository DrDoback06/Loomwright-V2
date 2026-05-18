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
  const cast = _castById();
  const c = cast[characterId];
  if (!c) return <div style={{ padding: 16, color: "var(--ink-3)" }}>Pick a character to begin.</div>;

  const rels = RELATIONSHIPS.filter((r) => r.a === characterId || r.b === characterId);
  const groups = {};
  for (const r of rels) {
    const k = r.type;
    if (!groups[k]) groups[k] = [];
    groups[k].push(r);
  }

  const hf = REL_HOPES_FEARS[characterId] || { hopes: [], fears: [] };

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
                      <div className="rel-card__chapters">Ch. {r.chapters.join(", ")}</div>
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
        {REL_CHANGES.filter((rc) => {
          const rel = RELATIONSHIPS.find((r) => r.id === rc.rel);
          return rel && (rel.a === characterId || rel.b === characterId);
        }).slice(0, 4).map((rc) => {
          const rel = RELATIONSHIPS.find((r) => r.id === rc.rel);
          const other = cast[rel.a === characterId ? rel.b : rel.a];
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
  const cast = _castById();
  const a = cast[aId], b = cast[bId];
  if (!a || !b) return <div style={{ padding: 16 }}>Pick two characters.</div>;

  const rel = RELATIONSHIPS.find((r) =>
    (r.a === aId && r.b === bId) || (r.a === bId && r.b === aId));
  const evidence = REL_EVIDENCE.filter((e) => rel && e.rel === rel.id);
  const changes = REL_CHANGES.filter((c) => rel && c.rel === rel.id);
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
  const cast = _castById();
  // Pre-computed circular layout — keeps the SVG deterministic
  const positions = {
    aelinor: { x: 50, y: 30 },
    saren:   { x: 78, y: 50 },
    brec:    { x: 30, y: 52 },
    mara:    { x: 72, y: 78 },
    auger:   { x: 22, y: 78 },
    dav:     { x: 50, y: 86 },
  };
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
        {RELATIONSHIPS.map((r) => {
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
        {Object.values(REL_TYPES).filter((t) => RELATIONSHIPS.some((r) => r.type === t.id)).map((t) => (
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
  const cast = _castById();
  const grouped = {};
  for (const c of REL_CHANGES) {
    grouped[c.chapter] = grouped[c.chapter] || [];
    grouped[c.chapter].push(c);
  }
  return (
    <div className="rel-tl">
      {Object.entries(grouped).sort((a, b) => Number(a[0]) - Number(b[0])).map(([ch, changes]) => (
        <div key={ch} className="rel-tl__chapter">
          <div className="rel-tl__chap-head">Ch. {ch}</div>
          <div className="rel-tl__list">
            {changes.map((c) => {
              const rel = RELATIONSHIPS.find((r) => r.id === c.rel);
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
const RelConflictView = ({ onCompare }) => {
  const cast = _castById();
  const conflicts = RELATIONSHIPS.filter((r) => r.conflict > 40).sort((a, b) => b.conflict - a.conflict);
  return (
    <div className="rel-conflict">
      {conflicts.map((r) => {
        const a = cast[r.a], b = cast[r.b];
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
const RelReviewView = () => (
  <div className="rel-review">
    {REL_REVIEW.map((r) => (
      <div key={r.id} className={"rel-review__card rel-review__card--" + r.lvl}>
        <div className="rel-review__head">
          <ConfidenceBadge level={r.lvl}/>
          <span className="rel-review__title">{r.title}</span>
        </div>
        <p className="rel-review__quote">"{r.excerpt}"</p>
        <div className="rel-review__meta">{r.cite}</div>
        <div className="rel-review__pill">{r.action}</div>
        <div className="rel-review__actions">
          <button data-callback="onAcceptRelationshipQueueItem">Accept</button>
          <button data-callback="onEditRelationshipQueueItem">Edit</button>
          <button data-callback="onMergeRelationshipQueueItem">Merge</button>
          <button data-callback="onDenyRelationshipQueueItem">Deny</button>
        </div>
      </div>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// RelationshipsPanelBody — entry point
// ---------------------------------------------------------------------
const RelationshipsPanelBody = ({ panel }) => {
  const [mode, setMode] = _re_us("single");
  const [characterId, setCharacterId] = _re_us("aelinor");
  const [compareWith, setCompareWith] = _re_us("saren");

  const onCompare = _re_uc((a, b) => {
    setCharacterId(a); setCompareWith(b); setMode("compare");
  }, []);
  const onSelectCharacter = _re_uc((id) => { setCharacterId(id); setMode("single"); }, []);

  const cast = (window.ATLAS_CAST || []);

  return (
    <div className="rel" data-ui="RelationshipsPanelBody">
      <div className="rel-bar">
        <div className="rel-bar__modes">
          {REL_MODES.map((m) => (
            <button key={m.id} className={"rel-bar__mode" + (mode === m.id ? " is-on" : "")}
                    onClick={() => setMode(m.id)} data-callback="onSetRelationshipMode" data-mode={m.id}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              {m.id === "review" && <span className="rel-bar__q">{REL_REVIEW.length}</span>}
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
        {mode === "single"   && <RelSingleView characterId={characterId} onSelectCharacter={onSelectCharacter} onCompare={onCompare}/>}
        {mode === "compare"  && <RelCompareView aId={characterId} bId={compareWith} onSelectCharacter={onSelectCharacter}/>}
        {mode === "network"  && <RelNetworkView onSelectCharacter={onSelectCharacter} onCompare={onCompare}/>}
        {mode === "timeline" && <RelTimelineView/>}
        {mode === "conflict" && <RelConflictView onCompare={onCompare}/>}
        {mode === "review"   && <RelReviewView/>}
      </div>
    </div>
  );
};

Object.assign(window, {
  RELATIONSHIPS, REL_EVIDENCE, REL_CHANGES, REL_REVIEW, REL_TYPES, REL_MODES,
  RelationshipsPanelBody, RelSingleView, RelCompareView, RelNetworkView,
  RelTimelineView, RelConflictView, RelReviewView,
});

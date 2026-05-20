// =====================================================================
// skill-trees.jsx — Skill Trees side panel + full-screen constellation
// editor. Genre-neutral parchment-astronomy visual style.
//
// Side panel: tree roster ▸ selected preview ▸ assigned characters ▸
// orphan suggestions ▸ buttons (Open editor / Create / Assign).
//
// Full editor (overlay): toolbar + left rail (roster/nodes/tray/drafts
// /layers) + constellation canvas (centre) + right rail (inspector/
// queue/related/source) + bottom progression strip.
//
// Demo data is rich enough that the panel feels real on first render.
// =====================================================================

const { useState: _st_us, useMemo: _st_um, useCallback: _st_uc, useRef: _st_ur, useEffect: _st_ue } = React;

// ---------------------------------------------------------------------
// Demo data — 3 trees with constellation-style node layouts.
// Each node has { id, name, type, tier, x, y, locked, upgrade, review,
// chars, summary, effect, cost, requires, linkedAbilities, linkedStats }.
// ---------------------------------------------------------------------
const SKILL_TREES = [
  {
    id: "t-augur",
    name: "The Augur",
    eyebrow: "Salt magic · cliff-walkers",
    glyph: "✷",
    color: "#7a6aa3",
    summary: "A salt-line discipline — knowing what is about to come from the sea. Aelinor's path.",
    assignedChars: ["aelinor", "auger"],
    review: 3,
    constellation: "Cliffhawk",
    nodes: [
      { id: "a1", name: "Salt-Sense",     type: "passive",  tier: 1, x: 50, y: 78, summary: "Feel the change in salt water before the tide turns.",
        effect: "Reroll one Perception when within sight of the sea.", cost: "Free", requires: [], unlocked: true,  chars: 2, linkedStats: ["per"] },
      { id: "a2", name: "Tide-Walker",    type: "passive",  tier: 1, x: 30, y: 64, summary: "Walks salt flats without stumbling.",
        effect: "+2 movement in coastal terrain.", cost: "Free", requires: ["a1"], unlocked: true,  chars: 2 },
      { id: "a3", name: "Stone-Read",     type: "active",   tier: 2, x: 50, y: 56, summary: "Read meaning from worn cliff-stone.",
        effect: "Cast: gain one truth about a place's past (1/day).", cost: "1 attention", requires: ["a1"], unlocked: true,  chars: 2 },
      { id: "a4", name: "Augur-Mark",     type: "triggered",tier: 2, x: 72, y: 64, summary: "A salt-mark on the brow that wraiths cannot cross.",
        effect: "When attacked by a Wraith, the first blow misses.", cost: "Permanent mark", requires: ["a1"], unlocked: false, chars: 1, review: true },
      { id: "a5", name: "Cliffhawk's Eye",type: "active",   tier: 3, x: 40, y: 40, summary: "See the cliff as the hawk sees it.",
        effect: "+4 ranged attack from elevation; reveal one hidden enemy.", cost: "2 attention", requires: ["a3"], unlocked: false, chars: 1, upgrade: true },
      { id: "a6", name: "Salt-Bind",      type: "active",   tier: 3, x: 62, y: 40, summary: "Bind a wraith in a circle of poured salt.",
        effect: "Hold a Wraith for one round; you cannot move.", cost: "1 attention + salt", requires: ["a4"], unlocked: false, chars: 0 },
      { id: "a7", name: "Old Auger Stone",type: "one-time", tier: 4, x: 50, y: 22, summary: "Touch the Old Auger and remember a future.",
        effect: "Once per arc: rewrite one choice already made.", cost: "Visit the Old Auger", requires: ["a5","a6"], unlocked: false, chars: 0, review: true },
    ],
  },
  {
    id: "t-glass",
    name: "Glass Court",
    eyebrow: "Hess discipline · court-craft",
    glyph: "◈",
    color: "#3e6db5",
    summary: "Saren's school — politics, glass, audience. A discipline of standing very still in moving rooms.",
    assignedChars: ["saren", "mara"],
    review: 1,
    constellation: "Glass Crown",
    nodes: [
      { id: "g1", name: "Audience-Calm",  type: "passive",  tier: 1, x: 50, y: 78, summary: "The room slows when you are still.", effect: "+2 to all social rolls in formal settings.", cost: "Free", requires: [], unlocked: true, chars: 2 },
      { id: "g2", name: "Glass-Speak",    type: "active",   tier: 2, x: 32, y: 56, summary: "Speak in such a way that you cannot quite be heard wrong.", effect: "Reframe any sentence — once per scene.", cost: "1 patience", requires: ["g1"], unlocked: true, chars: 2 },
      { id: "g3", name: "Court-Step",     type: "passive",  tier: 2, x: 68, y: 56, summary: "Walk the court without disturbing it.", effect: "+3 stealth in inhabited buildings.", cost: "Free", requires: ["g1"], unlocked: true, chars: 1 },
      { id: "g4", name: "Reliquary",      type: "triggered",tier: 3, x: 50, y: 36, summary: "Hold the Glass Reliquary; cannot be lied to.", effect: "While held, sense untruth.", cost: "Held in hand", requires: ["g2","g3"], unlocked: false, chars: 1, upgrade: true },
      { id: "g5", name: "Throne-Form",    type: "one-time", tier: 4, x: 50, y: 18, summary: "Sit the Glass Throne once, by leave of Hess.", effect: "Unlock one decree per book.", cost: "Royal leave", requires: ["g4"], unlocked: false, chars: 0 },
    ],
  },
  {
    id: "t-salt",
    name: "Order of Salt",
    eyebrow: "Coastal religious order",
    glyph: "❋",
    color: "#a8553f",
    summary: "Brec's old discipline. Defends the coast against the wraiths. Less mystical, more drill.",
    assignedChars: ["brec"],
    review: 2,
    constellation: "Watchhouse",
    nodes: [
      { id: "s1", name: "Watchstand",       type: "passive",  tier: 1, x: 50, y: 76, summary: "Trained to stand watch — no skill check for fatigue.", effect: "Ignore one fatigue penalty.", cost: "Free", requires: [], unlocked: true,  chars: 1 },
      { id: "s2", name: "Salt-Volley",      type: "active",   tier: 2, x: 30, y: 56, summary: "A coordinated thrown-salt volley.", effect: "Disrupt one Wraith for 1 round.", cost: "Group of 3+", requires: ["s1"], unlocked: true,  chars: 1 },
      { id: "s3", name: "Stockade Discipline", type: "passive", tier: 2, x: 70, y: 56, summary: "Bowmen on the stockade.", effect: "+1 ranged attack from wood positions.", cost: "Free", requires: ["s1"], unlocked: false, chars: 0 },
      { id: "s4", name: "Brec's Salute",    type: "triggered",tier: 3, x: 50, y: 32, summary: "The Captain's signal — every Salt-Order soldier in earshot responds.", effect: "Rally allies within 30ft.", cost: "1/day", requires: ["s2","s3"], unlocked: false, chars: 0, review: true },
    ],
  },
];

const SKILL_ORPHANS = [
  { id: "o1", name: "Knife-Talker", source: "Ch. 3 · p. 88", suggestion: "The Augur",   reason: "Cliff-line magic. Used by Aelinor near the cliffs."           },
  { id: "o2", name: "Pale Salute",   source: "Ch. 5 · p. 134", suggestion: "Order of Salt", reason: "Watch-discipline gesture; appears among Brec's soldiers." },
  { id: "o3", name: "Audience-Hush", source: "Ch. 7 · p. 211", suggestion: "Glass Court",   reason: "Court ability — Mara performs it on entry."              },
];

const SKILL_DRAFTS = [
  { id: "d1", name: "Cliff-Catch",     tree: "t-augur", tier: 2, status: "draft", note: "Catch yourself one second of falling — 1/day." },
  { id: "d2", name: "Glass-Step",      tree: "t-glass", tier: 3, status: "draft", note: "Step through any threshold inside Glass Court." },
  { id: "d3", name: "Tide-Listener",   tree: "t-augur", tier: 3, status: "draft", note: "Hear the next tide three nights ahead." },
];

const SKILL_REVIEW = [
  { id: "r1", lvl: "strong",    name: "Augur-Mark",      tree: "t-augur", action: "Confirm trigger condition", excerpt: "…the wraith's first stroke turned aside without contact…", cite: "Ch. 6 · p. 184" },
  { id: "r2", lvl: "uncertain", name: "Glass-Step (new)",tree: "t-glass", action: "Add to tree?",              excerpt: "…and she was on the other side without a step between…",  cite: "Ch. 7 · p. 207" },
  { id: "r3", lvl: "weak",      name: "Throne-Form",     tree: "t-glass", action: "Possible contradiction",    excerpt: "…no one but the queen-mother had ever sat it…",           cite: "Ch. 7 · p. 218" },
  { id: "r4", lvl: "strong",    name: "Salt-Volley",     tree: "t-salt",  action: "Update participant count",  excerpt: "…three of the salt-men cast at once and the wraith stopped…", cite: "Ch. 6 · p. 191" },
];

// ---------------------------------------------------------------------
// Local key/value row helper. (Babel scripts don't share scope so
// each file defines its own primitives.)
// ---------------------------------------------------------------------
const STRow = ({ k, v }) => (
  <div className="stp__row">
    <span className="stp__row-k">{k}</span>
    <span className="stp__row-v">{v}</span>
  </div>
);

// ---------------------------------------------------------------------
// SkillTreeMini — small constellation preview for the side panel
// ---------------------------------------------------------------------
const SkillTreeMini = ({ tree, selectedNodeId, onSelectNode }) => {
  const W = 100, H = 100;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stp-mini__svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={"stmini-glow-" + tree.id} cx="50%" cy="50%" r="60%">
          <stop offset="0%"  stopColor={tree.color} stopOpacity="0.20"/>
          <stop offset="100%" stopColor={tree.color} stopOpacity="0"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill={"url(#stmini-glow-" + tree.id + ")"}/>
      {/* Zodiac arc */}
      <circle cx={50} cy={50} r={42} fill="none" stroke={tree.color} strokeOpacity="0.20" strokeWidth="0.3" strokeDasharray="0.6 1.4"/>
      {/* Connections */}
      {tree.nodes.map((n) =>
        n.requires.map((rid) => {
          const r = tree.nodes.find((x) => x.id === rid);
          if (!r) return null;
          return <line key={n.id + rid} x1={r.x} y1={r.y} x2={n.x} y2={n.y}
                       stroke="#76684c" strokeWidth="0.3" strokeOpacity="0.55"/>;
        }))}
      {/* Stars */}
      {tree.nodes.map((n) => (
        <g key={n.id} transform={`translate(${n.x}, ${n.y})`}
           onClick={() => onSelectNode && onSelectNode(n.id)}
           style={{ cursor: "pointer" }}>
          {selectedNodeId === n.id && <circle r={4} fill={tree.color} opacity="0.25"/>}
          <circle r={n.tier === 1 ? 1.6 : n.tier === 2 ? 1.3 : 1.1}
                  fill={n.unlocked ? "#fff" : "#9a8c6e"}
                  stroke={tree.color}
                  strokeWidth={n.tier === 1 ? 0.7 : 0.4}/>
          {n.review && <circle r={2.4} fill="none" stroke="#c98a2c" strokeWidth="0.4" strokeDasharray="0.4 0.6"/>}
        </g>
      ))}
    </svg>
  );
};

// ---------------------------------------------------------------------
// SkillTreesSidePanel — body inserted into the docked panel
// ---------------------------------------------------------------------
const SkillTreesSidePanel = ({ onOpenEditor }) => {
  const [selectedTreeId, setSelectedTreeId] = _st_us("t-augur");
  const [selectedNodeId, setSelectedNodeId] = _st_us("a3");
  const tree = SKILL_TREES.find((t) => t.id === selectedTreeId) || SKILL_TREES[0];
  const node = tree.nodes.find((n) => n.id === selectedNodeId) || tree.nodes[0];

  return (
    <div className="stp" data-ui="SkillTreesSidePanel">
      <div className="stp__roster">
        <div className="stp__sech">Trees</div>
        <div className="stp__roster-list">
          {SKILL_TREES.map((t) => (
            <button key={t.id}
              className={"stp__roster-row" + (t.id === selectedTreeId ? " is-on" : "")}
              onClick={() => { setSelectedTreeId(t.id); setSelectedNodeId(t.nodes[0]?.id); }}
              data-callback="onSelectSkillTree"
              style={{ "--c": t.color }}>
              <span className="stp__roster-glyph">{t.glyph}</span>
              <span className="stp__roster-main">
                <span className="stp__roster-name">{t.name}</span>
                <span className="stp__roster-eyebrow">{t.eyebrow}</span>
              </span>
              {t.review > 0 && <span className="stp__roster-q">{t.review}</span>}
            </button>
          ))}
          <button className="stp__roster-add" data-callback="onCreateSkillTree"
                  onClick={onOpenEditor}>
            <Icon name="plus" size={11}/>
            <span>Create tree…</span>
          </button>
        </div>
      </div>

      <div className="stp__preview">
        <div className="stp__preview-head">
          <span className="stp__preview-glyph" style={{ color: tree.color }}>{tree.glyph}</span>
          <div className="stp__preview-titles">
            <div className="stp__preview-name">{tree.name}</div>
            <div className="stp__preview-eyebrow">{tree.eyebrow} · {tree.constellation}</div>
          </div>
          <button className="stp__preview-edit" onClick={onOpenEditor} data-callback="onOpenSkillTreeEditor">
            <Icon name="expand" size={11}/>
            <span>Open editor</span>
          </button>
        </div>

        <div className="stp__mini">
          <SkillTreeMini tree={tree} selectedNodeId={selectedNodeId} onSelectNode={setSelectedNodeId}/>
          <div className="stp__mini-foot">
            <span>{tree.nodes.length} skills</span>
            <span>·</span>
            <span>{tree.nodes.filter((n) => n.unlocked).length} unlocked</span>
            <span>·</span>
            <span>{tree.assignedChars.length} bearers</span>
          </div>
        </div>

        <div className="stp__node-card" style={{ "--c": tree.color }}>
          <div className="stp__node-head">
            <span className="stp__node-tier">T{node.tier}</span>
            <span className="stp__node-name">{node.name}</span>
            <span className={"stp__node-type stp__node-type--" + node.type}>{node.type}</span>
          </div>
          <p className="stp__node-sum">{node.summary}</p>
          <div className="stp__node-rows">
            <STRow k="Effect" v={node.effect}/>
            <STRow k="Cost"   v={node.cost}/>
            {node.requires.length > 0 && (
              <STRow k="Requires" v={node.requires.map((r) => tree.nodes.find((x) => x.id === r)?.name).filter(Boolean).join(" · ")}/>
            )}
          </div>
          <div className="stp__node-actions">
            <button data-callback="onAssignSkillToCharacter">Assign…</button>
            <button data-callback="onMarkSkillUnlocked">{node.unlocked ? "Lock" : "Unlock"}</button>
            <button data-callback="onOpenSkillTreeEditor" onClick={onOpenEditor}>Edit in canvas</button>
          </div>
        </div>

        <div className="stp__chars">
          <div className="stp__sech">Assigned to</div>
          <div className="stp__chars-list">
            {tree.assignedChars.map((cid) => {
              const c = (window.ATLAS_CAST || []).find((x) => x.id === cid);
              if (!c) return null;
              return (
                <button key={cid} className="stp__char"
                        data-callback="onOpenCharacterDossier"
                        style={{ "--c": c.color }}>
                  <span className="stp__char-avatar">{c.initials}</span>
                  <span>{c.name}</span>
                </button>
              );
            })}
            <button className="stp__char stp__char--add" data-callback="onAssignSkillTreeToCharacter">
              <Icon name="plus" size={10}/><span>Assign…</span>
            </button>
          </div>
        </div>

        <div className="stp__orphans">
          <div className="stp__sech">
            Orphan skills
            <span className="stp__sech-n">{SKILL_ORPHANS.length}</span>
          </div>
          <div className="stp__orphan-list">
            {SKILL_ORPHANS.map((o) => (
              <div key={o.id} className="stp__orphan">
                <div className="stp__orphan-head">
                  <span className="stp__orphan-name">{o.name}</span>
                  <span className="stp__orphan-src">{o.source}</span>
                </div>
                <div className="stp__orphan-reason">{o.reason}</div>
                <div className="stp__orphan-actions">
                  <button data-callback="onAcceptDraftSkillNode">→ {o.suggestion}</button>
                  <button data-callback="onMergeDraftSkillNode">Merge</button>
                  <button data-callback="onCreateSkillTree">New tree</button>
                  <button data-callback="onDenyDraftSkillNode" className="stp__orphan-deny">Dismiss</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// SkillTreeCanvas — full constellation map, scaled to fit the surface.
// Nodes positioned by (x, y) in 0–100 percent space.
// ---------------------------------------------------------------------
const SkillTreeCanvas = ({ tree, selectedNodeId, onSelectNode, showLabels = true }) => {
  const W = 1000, H = 700;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="stc__svg" preserveAspectRatio="xMidYMid meet">
      <defs>
        <radialGradient id={"stc-vault-" + tree.id} cx="50%" cy="55%" r="65%">
          <stop offset="0%"  stopColor="#1a1814" stopOpacity="0.04"/>
          <stop offset="40%" stopColor="#2a2218" stopOpacity="0.02"/>
          <stop offset="100%" stopColor="#2a2218" stopOpacity="0"/>
        </radialGradient>
        <pattern id="stc-grain" patternUnits="userSpaceOnUse" width="4" height="4">
          <circle cx="2" cy="2" r="0.4" fill="rgba(120,96,60,0.10)"/>
        </pattern>
      </defs>
      <rect x="0" y="0" width={W} height={H} fill={"url(#stc-vault-" + tree.id + ")"}/>
      <rect x="0" y="0" width={W} height={H} fill="url(#stc-grain)" opacity="0.5"/>

      {/* Zodiac arcs (faint background) */}
      <g opacity="0.32">
        {[0, 1, 2, 3].map((i) => (
          <circle key={i} cx={W / 2} cy={H * 0.58} r={120 + i * 80}
                  fill="none" stroke={tree.color} strokeOpacity="0.50" strokeWidth="0.5"
                  strokeDasharray={i === 0 ? "2 5" : i === 1 ? "1 4" : "0.5 3"}/>
        ))}
      </g>

      {/* Tier rings labels */}
      <g opacity="0.7" fontFamily="var(--font-display)">
        {[1, 2, 3, 4].map((t) => {
          const y = H - 80 - (t - 1) * 145;
          return (
            <g key={t}>
              <line x1={40} y1={y} x2={W - 40} y2={y} stroke="rgba(74,56,28,0.18)" strokeWidth="0.5" strokeDasharray="2 6"/>
              <text x={48} y={y - 6} fontSize="11" fill="rgba(74,56,28,0.55)" letterSpacing="0.15em">TIER {t}</text>
            </g>
          );
        })}
      </g>

      {/* Connection lines */}
      <g>
        {tree.nodes.map((n) =>
          n.requires.map((rid) => {
            const r = tree.nodes.find((x) => x.id === rid);
            if (!r) return null;
            const x1 = (r.x / 100) * W, y1 = (r.y / 100) * H;
            const x2 = (n.x / 100) * W, y2 = (n.y / 100) * H;
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2 - 14;
            return (
              <g key={n.id + rid}>
                <path d={`M ${x1} ${y1} Q ${mx} ${my} ${x2} ${y2}`}
                      fill="none" stroke="#3a2c12" strokeOpacity={n.unlocked ? 0.55 : 0.30}
                      strokeWidth={n.unlocked ? 1.2 : 0.8}
                      strokeDasharray={n.unlocked ? "0" : "3 4"}/>
              </g>
            );
          }))}
      </g>

      {/* Nodes (stars) */}
      <g>
        {tree.nodes.map((n) => {
          const x = (n.x / 100) * W;
          const y = (n.y / 100) * H;
          const r = n.tier === 1 ? 13 : n.tier === 2 ? 10 : n.tier === 3 ? 8 : 7;
          const isSelected = n.id === selectedNodeId;
          return (
            <g key={n.id} transform={`translate(${x}, ${y})`}
               onClick={() => onSelectNode(n.id)}
               style={{ cursor: "pointer" }}>
              {/* Halo */}
              {isSelected && (
                <>
                  <circle r={r + 14} fill={tree.color} opacity="0.10"/>
                  <circle r={r + 6}  fill="none" stroke={tree.color} strokeWidth="1.5"/>
                </>
              )}
              {n.upgrade && <circle r={r + 4} fill="none" stroke="#c98a2c" strokeWidth="1" strokeDasharray="2 2"/>}
              {n.review && <circle r={r + 8} fill="none" stroke="#c98a2c" strokeWidth="0.8" strokeDasharray="1 3"/>}

              {/* Star body */}
              <circle r={r + 2} fill="rgba(255,248,230,0.95)" stroke={tree.color} strokeWidth="0.8"/>
              <circle r={r} fill={n.unlocked ? tree.color : "rgba(255,248,230,0.95)"}
                            stroke={tree.color} strokeWidth={n.unlocked ? 0 : 1.5}/>
              {/* Inner glow / type glyph */}
              {n.unlocked && <circle r={r * 0.5} fill="#fff" opacity="0.5"/>}
              <text textAnchor="middle" dominantBaseline="central"
                    fontFamily="var(--font-display)" fontWeight="700"
                    fontSize={n.tier === 1 ? 14 : 11}
                    fill={n.unlocked ? "#fff" : tree.color}>
                {n.type === "active" ? "✦" : n.type === "passive" ? "◐" : n.type === "triggered" ? "⚡" : n.type === "one-time" ? "✷" : "◇"}
              </text>

              {/* Label */}
              {showLabels && (
                <g transform={`translate(0, ${r + 18})`}>
                  <text textAnchor="middle"
                        fontFamily="var(--font-display)" fontWeight={n.unlocked ? 600 : 500}
                        fontSize="12" fill={n.unlocked ? "#2a2218" : "#76684c"}>
                    {n.name}
                  </text>
                  {n.chars > 0 && (
                    <text y="14" textAnchor="middle"
                          fontFamily="var(--font-sans)" fontSize="9.5" fill="rgba(74,56,28,0.55)"
                          letterSpacing="0.05em">
                      {n.chars} {n.chars === 1 ? "bearer" : "bearers"}
                    </text>
                  )}
                </g>
              )}
            </g>
          );
        })}
      </g>

      {/* Constellation name (faint, centre) */}
      <text x={W / 2} y={42} textAnchor="middle"
            fontFamily="var(--font-display)" fontStyle="italic" fontSize="20" fill="rgba(74,56,28,0.45)"
            letterSpacing="0.06em">
        ★ {tree.constellation} ★
      </text>
    </svg>
  );
};

// ---------------------------------------------------------------------
// SkillTreeEditor — full-screen editor overlay
// ---------------------------------------------------------------------
const SkillTreeEditor = ({ onExit }) => {
  const [activeTreeId, setActiveTreeId] = _st_us("t-augur");
  const [selectedNodeId, setSelectedNodeId] = _st_us("a3");
  const [leftTab, setLeftTab] = _st_us("roster");
  const [rightTab, setRightTab] = _st_us("inspector");
  const [showLabels, setShowLabels] = _st_us(true);
  const [activeTool, setActiveTool] = _st_us("select");

  const tree = SKILL_TREES.find((t) => t.id === activeTreeId);
  const node = tree.nodes.find((n) => n.id === selectedNodeId) || tree.nodes[0];

  const TB = ({ icon, label, value, group, onClick }) => (
    <button
      className={"ste-tb__btn" + (activeTool === value ? " is-active" : "")}
      onClick={() => { setActiveTool(value); onClick && onClick(); }}
      title={label}
    >
      <Icon name={icon} size={12}/>
      <span>{label}</span>
    </button>
  );

  return (
    <div className="ste" data-ui="SkillTreeEditor">
      {/* Toolbar */}
      <div className="ste-tb">
        <div className="ste-tb__brand">
          <span style={{ fontSize: 18 }}>{tree.glyph}</span>
          <span>Skill Tree Editor — {tree.name}</span>
        </div>
        <div className="ste-tb__group">
          <TB icon="pin-tack" label="Select"     value="select"/>
          <TB icon="grip"     label="Pan"        value="pan"/>
        </div>
        <div className="ste-tb__group">
          <TB icon="plus"     label="Add node"      value="add-node"/>
          <TB icon="branch"   label="Connect"       value="connect"/>
          <TB icon="link"     label="Prerequisite"  value="prereq"/>
          <TB icon="tree"     label="Branch"        value="branch"/>
          <TB icon="bolt"     label="Upgrade chain" value="upgrade"/>
        </div>
        <div className="ste-tb__group">
          <TB icon="stack"    label="Group"      value="group"/>
        </div>
        <div className="ste-tb__group">
          <TB icon="expand"   label="Fit view"   value="fit"/>
          <button className={"ste-tb__btn" + (showLabels ? " is-active" : "")} onClick={() => setShowLabels((v) => !v)}>
            <Icon name="paper" size={12}/><span>Labels</span>
          </button>
        </div>
        <span style={{ flex: 1 }}/>
        <button className="ste-tb__btn ste-tb__btn--queue">
          <Icon name="bell" size={12}/><span>Review</span>
          <span className="ste-tb__badge">{SKILL_REVIEW.length}</span>
        </button>
        <button className="ste-tb__exit" onClick={onExit} data-callback="onExitSkillTreeEditor">
          <Icon name="close" size={11}/><span>Exit</span>
        </button>
      </div>

      <div className="ste__body">
        {/* Left rail */}
        <div className="ste__rail ste__rail--left">
          <div className="ste__tabs">
            {[["roster","Trees","tree"], ["nodes","Nodes","bars"], ["tray","Cast","user"], ["drafts","Drafts","sparkle"], ["layers","Layers","stack"]].map(([id, label, icon]) => (
              <button key={id}
                className={"ste__tab" + (leftTab === id ? " is-on" : "")}
                onClick={() => setLeftTab(id)}>
                <Icon name={icon} size={10}/><span>{label}</span>
              </button>
            ))}
          </div>
          <div className="ste__rail-body">
            {leftTab === "roster" && (
              <div className="ste-list">
                {SKILL_TREES.map((t) => (
                  <button key={t.id}
                    className={"ste-list__row" + (t.id === activeTreeId ? " is-on" : "")}
                    onClick={() => setActiveTreeId(t.id)}
                    style={{ "--c": t.color }}>
                    <span className="ste-list__glyph">{t.glyph}</span>
                    <span className="ste-list__main">
                      <span className="ste-list__name">{t.name}</span>
                      <span className="ste-list__sub">{t.nodes.length} skills · {t.eyebrow}</span>
                    </span>
                  </button>
                ))}
                <button className="ste-list__add" data-callback="onCreateSkillTree">
                  <Icon name="plus" size={11}/><span>New tree</span>
                </button>
              </div>
            )}
            {leftTab === "nodes" && (
              <div className="ste-list">
                {tree.nodes.map((n) => (
                  <button key={n.id}
                    className={"ste-list__row" + (n.id === selectedNodeId ? " is-on" : "")}
                    onClick={() => setSelectedNodeId(n.id)}
                    style={{ "--c": tree.color }}>
                    <span className={"ste-list__type ste-list__type--" + n.type}/>
                    <span className="ste-list__main">
                      <span className="ste-list__name">{n.name}</span>
                      <span className="ste-list__sub">Tier {n.tier} · {n.type}</span>
                    </span>
                    {n.review && <span className="ste-list__q">!</span>}
                  </button>
                ))}
              </div>
            )}
            {leftTab === "tray" && (
              <div className="ste-list">
                {(window.ATLAS_CAST || []).map((c) => (
                  <button key={c.id} className="ste-list__row" style={{ "--c": c.color }}>
                    <span className="ste-list__avatar">{c.initials}</span>
                    <span className="ste-list__main">
                      <span className="ste-list__name">{c.name}</span>
                      <span className="ste-list__sub">{c.role}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {leftTab === "drafts" && (
              <div className="ste-list">
                <div className="ste-list__hint">Type a prompt to generate a starter tree, or accept drafts below.</div>
                <div className="ste-list__prompt">
                  <input placeholder="Create me a fire mage skill tree…" data-callback="onGenerateDraftSkillTree"/>
                  <button>Draft</button>
                </div>
                {SKILL_DRAFTS.map((d) => (
                  <div key={d.id} className="ste-list__draft">
                    <div className="ste-list__draft-head">
                      <span className="ste-list__draft-name">{d.name}</span>
                      <span className="ste-list__draft-tier">T{d.tier}</span>
                    </div>
                    <div className="ste-list__draft-note">{d.note}</div>
                    <div className="ste-list__draft-actions">
                      <button data-callback="onAcceptDraftSkillNode">Accept</button>
                      <button data-callback="onEditDraftSkillNode">Edit</button>
                      <button data-callback="onMergeDraftSkillNode">Merge</button>
                      <button data-callback="onDenyDraftSkillNode">Deny</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {leftTab === "layers" && (
              <div className="ste-list">
                {[["unlocked","Unlocked"],["locked","Locked"],["upgrade","Upgrade-available"],["review","In review"],["connections","Connections"],["labels","Labels"]].map(([id, lbl]) => (
                  <label key={id} className="ste-list__layer">
                    <input type="checkbox" defaultChecked/><span>{lbl}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="ste__canvas">
          <SkillTreeCanvas tree={tree} selectedNodeId={selectedNodeId}
                           onSelectNode={setSelectedNodeId} showLabels={showLabels}/>
        </div>

        {/* Right rail */}
        <div className="ste__rail ste__rail--right">
          <div className="ste__tabs">
            {[["inspector","Inspector","paper"], ["queue","Review","bell"], ["related","Related","link"], ["source","Source","book"]].map(([id, label, icon]) => (
              <button key={id}
                className={"ste__tab" + (rightTab === id ? " is-on" : "")}
                onClick={() => setRightTab(id)}>
                <Icon name={icon} size={10}/><span>{label}</span>
                {id === "queue" && <span className="ste-list__q">{SKILL_REVIEW.length}</span>}
              </button>
            ))}
          </div>
          <div className="ste__rail-body">
            {rightTab === "inspector" && (
              <div className="ste-insp">
                <div className="ste-insp__head">
                  <span className="ste-insp__tier">T{node.tier}</span>
                  <span className="ste-insp__name">{node.name}</span>
                </div>
                <div className={"ste-insp__type ste-insp__type--" + node.type}>{node.type} skill</div>
                <p className="ste-insp__sum">{node.summary}</p>
                <STRow k="Effect"  v={node.effect}/>
                <STRow k="Cost"    v={node.cost}/>
                <STRow k="Locked"  v={node.unlocked ? "Unlocked" : "Locked"}/>
                <STRow k="Bearers" v={node.chars + " character(s)"}/>
                {node.requires.length > 0 && (
                  <STRow k="Requires" v={node.requires.map((r) => tree.nodes.find((x) => x.id === r)?.name).filter(Boolean).join(" · ")}/>
                )}
                {node.linkedStats && <STRow k="Stats" v={node.linkedStats.join(", ")}/>}

                <div className="ste-insp__sec">
                  <div className="ste-insp__sech">Upgrades</div>
                  {tree.nodes.filter((x) => x.requires.includes(node.id)).map((x) => (
                    <button key={x.id} className="ste-insp__chip" onClick={() => setSelectedNodeId(x.id)}>
                      <span className={"ste-insp__chip-type ste-insp__chip-type--" + x.type}/>
                      <span>{x.name}</span>
                    </button>
                  ))}
                  {tree.nodes.filter((x) => x.requires.includes(node.id)).length === 0 && (
                    <div className="ste-insp__none">— Tip of the branch —</div>
                  )}
                </div>

                <div className="ste-insp__sec">
                  <div className="ste-insp__sech">Characters with skill</div>
                  {tree.assignedChars.slice(0, node.chars).map((cid) => {
                    const c = (window.ATLAS_CAST || []).find((x) => x.id === cid);
                    if (!c) return null;
                    return (
                      <button key={cid} className="ste-insp__chip" style={{ "--c": c.color }}>
                        <span className="ste-insp__chip-avatar">{c.initials}</span>
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="ste-insp__actions">
                  <button data-callback="onEditSkillNode">Edit node</button>
                  <button data-callback="onConnectSkillNodes">Add connection</button>
                  <button data-callback="onMarkSkillUnlocked">{node.unlocked ? "Lock" : "Unlock"}</button>
                </div>
              </div>
            )}
            {rightTab === "queue" && (
              <div className="ste-queue">
                {SKILL_REVIEW.map((r) => (
                  <div key={r.id} className={"ste-queue__card ste-queue__card--" + r.lvl}>
                    <div className="ste-queue__head">
                      <ConfidenceBadge level={r.lvl}/>
                      <span className="ste-queue__name">{r.name}</span>
                    </div>
                    <p className="ste-queue__excerpt">"{r.excerpt}"</p>
                    <div className="ste-queue__meta">{r.cite}</div>
                    <div className="ste-queue__pill">{r.action}</div>
                    <div className="ste-queue__actions">
                      <button data-callback="onAcceptDraftSkillNode">Accept</button>
                      <button data-callback="onEditDraftSkillNode">Edit</button>
                      <button data-callback="onMergeDraftSkillNode">Merge</button>
                      <button data-callback="onDenyDraftSkillNode">Deny</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {rightTab === "related" && (
              <div className="ste-related">
                <div className="ste-insp__sech">Linked abilities</div>
                <button className="ste-insp__chip">Salt-Sense · passive</button>
                <button className="ste-insp__chip">Reach Speech · spoken</button>
                <div className="ste-insp__sech" style={{ marginTop: 14 }}>Linked stats</div>
                <button className="ste-insp__chip">Perception</button>
                <button className="ste-insp__chip">Attention</button>
                <div className="ste-insp__sech" style={{ marginTop: 14 }}>Linked classes</div>
                <button className="ste-insp__chip">Augur</button>
              </div>
            )}
            {rightTab === "source" && (
              <div className="ste-source">
                <div className="ste-source__card">
                  <div className="ste-source__cite">Ch. 3 · p. 88</div>
                  <p>"…she pressed her palm to the cliff-stone and the stone gave back what it remembered."</p>
                </div>
                <div className="ste-source__card">
                  <div className="ste-source__cite">Ch. 6 · p. 184</div>
                  <p>"The first stroke of the wraith turned aside, without contact, as if the salt itself had bent it."</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom progression strip */}
      <div className="ste__strip">
        <div className="ste__strip-head">
          <span style={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: 10, color: "var(--atl-ink-3)" }}>Path · {tree.name}</span>
          <span style={{ flex: 1 }}/>
          <button className="ste__strip-btn">Validate</button>
          <button className="ste__strip-btn">Auto-layout</button>
        </div>
        <div className="ste__strip-track">
          {[1, 2, 3, 4].map((tier) => {
            const ns = tree.nodes.filter((n) => n.tier === tier);
            return (
              <div key={tier} className="ste__strip-tier">
                <div className="ste__strip-tier-head">TIER {tier}</div>
                <div className="ste__strip-tier-nodes">
                  {ns.map((n) => (
                    <button key={n.id}
                      className={"ste__strip-node" + (n.id === selectedNodeId ? " is-on" : "") + (n.unlocked ? " is-unlocked" : "")}
                      style={{ "--c": tree.color }}
                      onClick={() => setSelectedNodeId(n.id)}
                      title={n.name + " — " + n.type}>
                      <span className="ste__strip-node-glyph">
                        {n.type === "active" ? "✦" : n.type === "passive" ? "◐" : n.type === "triggered" ? "⚡" : "✷"}
                      </span>
                      <span className="ste__strip-node-name">{n.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// SkillsPanelBody — entry point used by the panel-stack dispatcher
// ---------------------------------------------------------------------
// ---------------------------------------------------------------------
// SkillTreeNodeRow — one live node (a skills entity) inside a tree.
// ---------------------------------------------------------------------
const SkillTreeNodeRow = ({ node, connectArmed, onRename, onToggleLock, onConnect, onRemove }) => (
  <div className="stm-node" data-testid={"st-node-" + node.id} style={{ "--c": node.unlocked ? "var(--accent)" : "var(--line-3)" }}>
    <input
      className="stm-node__name"
      defaultValue={node.name}
      key={node.id + ":" + node.name}
      aria-label="Skill node name"
      data-testid={"st-node-name-" + node.id}
      onBlur={(e) => onRename(node.id, e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}
    />
    <button type="button" className={"stm-btn" + (node.unlocked ? " is-on" : "")} data-testid={"st-lock-" + node.id} onClick={() => onToggleLock(node.id)} title={node.unlocked ? "Lock node" : "Unlock node"}>{node.unlocked ? "Unlocked" : "Locked"}</button>
    <button type="button" className={"stm-btn" + (connectArmed ? " is-arming" : "")} data-testid={"st-connect-" + node.id} onClick={() => onConnect(node.id)} title="Connect to another node">{connectArmed ? "Pick target…" : "Connect"}</button>
    <button type="button" className="stm-btn stm-btn--danger" data-testid={"st-remove-node-" + node.id} onClick={() => onRemove(node.id)} title="Remove node">×</button>
  </div>
);

// ---------------------------------------------------------------------
// SkillTreeLiveManager — live, persistent skill-tree editing (UAT #17).
// Backed entirely by SkillTreeService + EntityService("skills"); nodes are
// skill entities. Create tree/node, connect, assign to cast/class, lock,
// and rename all persist and survive reload. The visual constellation
// canvas remains future scope (see notice in SkillsPanelBody).
// ---------------------------------------------------------------------
const SkillTreeLiveManager = () => {
  const B = () => window.LoomwrightBackend;
  const read = () => (B() && B().SkillTreeService ? (B().SkillTreeService.loadSync().trees || []) : []);
  const [trees, setTrees] = React.useState(read);
  const [selId, setSelId] = React.useState(null);
  const [connectFrom, setConnectFrom] = React.useState(null);
  const refresh = React.useCallback(() => setTrees(read()), []);
  React.useEffect(() => {
    refresh();
    const evs = ["lw:skill-trees-updated", "lw:entity-store-updated", "lw:backend-ready", "lw:project-imported"];
    evs.forEach((e) => window.addEventListener(e, refresh));
    return () => evs.forEach((e) => window.removeEventListener(e, refresh));
  }, [refresh]);
  React.useEffect(() => {
    if (!selId && trees.length) setSelId(trees[0].id);
  }, [trees, selId]);

  const tree = trees.find((t) => t.id === selId) || null;
  const skillName = (id) => { try { const e = B().EntityService.getSync(id, "skills"); return (e && e.name) || "Untitled skill"; } catch (_e) { return "Untitled skill"; } };
  const nodes = tree ? (tree.nodeIds || []).map((id) => ({ id, name: skillName(id), unlocked: !!((tree.layout || {})[id] || {}).unlocked })) : [];
  const cast = (() => { try { return B().EntityService.listSync("cast") || []; } catch (_e) { return []; } })();
  const classes = (() => { try { return B().EntityService.listSync("classes") || []; } catch (_e) { return []; } })();

  const createTree = async () => { const s = B() && B().SkillTreeService; if (!s) return; const t = await s.addTree({ name: "New skill tree" }); if (t && t.id) setSelId(t.id); };
  const removeTree = async () => { const s = B() && B().SkillTreeService; if (!s || !tree) return; await s.removeTree(tree.id); setSelId(null); };
  const addNode = async () => {
    if (!tree) return;
    const ES = B() && B().EntityService, s = B() && B().SkillTreeService; if (!ES || !s) return;
    const skill = await ES.save("skills", { name: "New skill" }, { status: "active" });
    await s.addNode(tree.id, skill.id, { x: 20 + (nodes.length * 13) % 60, y: 30 + (nodes.length * 7) % 40 });
  };
  const renameNode = async (id, name) => { const ES = B() && B().EntityService; if (!ES) return; await ES.update("skills", id, { name: (name || "").trim() || "Untitled skill" }); refresh(); };
  const toggleLock = async (id) => { const s = B() && B().SkillTreeService; if (!s || !tree) return; await s.setNodeUnlocked(tree.id, id, !((tree.layout || {})[id] || {}).unlocked); };
  const removeNode = async (id) => { const s = B() && B().SkillTreeService; if (!s || !tree) return; await s.removeNode(tree.id, id); };
  const connect = async (id) => {
    const s = B() && B().SkillTreeService; if (!s || !tree) return;
    if (!connectFrom) { setConnectFrom(id); return; }
    if (connectFrom === id) { setConnectFrom(null); return; }
    await s.connectNodes(tree.id, connectFrom, id);
    setConnectFrom(null);
  };
  const assignCast = async (cid) => { const s = B() && B().SkillTreeService; if (!s || !tree) return; await s.assignCast(tree.id, cid); };
  const assignClass = async (clid) => { const s = B() && B().SkillTreeService; if (!s || !tree) return; await s.assignClass(tree.id, clid); };

  return (
    <div className="stm" data-ui="SkillTreeLiveManager">
      <div className="stm__trees">
        <div className="stm__sech">Skill trees</div>
        <div className="stm__tree-list">
          {trees.map((t) => (
            <button key={t.id} type="button" className={"stm__tree" + (t.id === selId ? " is-on" : "")} data-testid={"st-tree-" + t.id} onClick={() => { setSelId(t.id); setConnectFrom(null); }}>
              <span className="stm__tree-name">{t.name}</span>
              <span className="stm__tree-meta">{(t.nodeIds || []).length} nodes</span>
            </button>
          ))}
          {trees.length === 0 && <div className="stm__empty" data-testid="st-empty">No skill trees yet. Create one to start adding skill nodes.</div>}
          <button type="button" className="stm__add" data-testid="st-create-tree" onClick={createTree}><Icon name="plus" size={11}/> Create tree</button>
        </div>
      </div>

      {tree ? (
        <div className="stm__detail" data-testid="st-detail">
          <div className="stm__detail-head">
            <span className="stm__detail-name">{tree.name}</span>
            <button type="button" className="stm-btn" data-testid="st-add-node" onClick={addNode}><Icon name="plus" size={10}/> Add node</button>
            <button type="button" className="stm-btn stm-btn--danger" data-testid="st-remove-tree" onClick={removeTree} title="Delete this tree">Delete tree</button>
          </div>

          <div className="stm__sech">Nodes ({nodes.length})</div>
          <div className="stm__nodes">
            {nodes.length === 0 && <div className="stm__empty">No nodes yet — “Add node” creates a skill node that persists.</div>}
            {nodes.map((n) => (
              <SkillTreeNodeRow key={n.id} node={n} connectArmed={connectFrom === n.id}
                onRename={renameNode} onToggleLock={toggleLock} onConnect={connect} onRemove={removeNode}/>
            ))}
          </div>

          {(tree.edges || []).length > 0 && (
            <div className="stm__edges">
              <div className="stm__sech">Connections ({tree.edges.length})</div>
              {tree.edges.map((e, i) => (
                <div key={i} className="stm__edge" data-testid="st-edge">{skillName(e.from)} → {skillName(e.to)}</div>
              ))}
            </div>
          )}

          <div className="stm__assign">
            <div className="stm__sech">Assign to cast</div>
            <div className="stm__assign-row">
              {cast.length === 0 && <span className="stm__empty">No cast yet — create cast members to assign this tree.</span>}
              {cast.map((c) => {
                const on = (tree.assignedCast || []).includes(c.id);
                return <button key={c.id} type="button" className={"stm-chip" + (on ? " is-on" : "")} data-testid={"st-assign-cast-" + c.id} onClick={() => assignCast(c.id)}>{c.name}{on ? " ✓" : ""}</button>;
              })}
            </div>
            <div className="stm__sech">Assign to class</div>
            <div className="stm__assign-row">
              {classes.length === 0 && <span className="stm__empty">No classes yet.</span>}
              {classes.map((c) => {
                const on = (tree.assignedClasses || []).includes(c.id);
                return <button key={c.id} type="button" className={"stm-chip" + (on ? " is-on" : "")} data-testid={"st-assign-class-" + c.id} onClick={() => assignClass(c.id)}>{c.name}{on ? " ✓" : ""}</button>;
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="stm__detail stm__detail--empty">Select or create a skill tree to edit its nodes, connections, and assignments.</div>
      )}
    </div>
  );
};

const SkillsPanelBody = ({ panel }) => {
  const [showCanvasNote, setShowCanvasNote] = _st_us(false);
  // The standardised panel header can request the (future) full-screen canvas.
  React.useEffect(() => {
    const onOpen = (e) => {
      const d = e?.detail || {};
      if (d.panelKind === "skills" || d.panelKind === "abilities" || d.workspaceId === "skill-tree-editor") {
        setShowCanvasNote(true);
      }
    };
    window.addEventListener("lw:open-existing-fullscreen", onOpen);
    return () => window.removeEventListener("lw:open-existing-fullscreen", onOpen);
  }, []);
  return (
    <div className="stp-host">
      <SkillTreeLiveManager/>
      {showCanvasNote && (
        <div className="ste-overlay">
          <div className="ste-future" data-ui="SkillTreeCanvasFuture">
            <Icon name="tree" size={28}/>
            <h2>Visual constellation canvas</h2>
            <p>The drag-and-drop constellation canvas is a planned enhancement. For now, create and edit skill trees, nodes, connections, lock state, and cast/class assignments in the panel — every change persists and survives reload.</p>
            <button type="button" className="stm__add" data-callback="onExitSkillTreeEditor" onClick={() => setShowCanvasNote(false)}>Back to skills</button>
          </div>
        </div>
      )}
    </div>
  );
};

Object.assign(window, {
  SKILL_TREES, SKILL_ORPHANS, SKILL_DRAFTS, SKILL_REVIEW,
  SkillTreeMini, SkillTreesSidePanel, SkillTreeCanvas, SkillTreeEditor, SkillsPanelBody,
});

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
// Everything renders LIVE project data:
//   trees        ← SkillTreeService.loadSync().trees
//   stars        ← EntityService("skills") records placed via tree.layout
//   bearers      ← skill data.learnedBy + tree.assignedCast
//   drafts/queue ← ReviewService.listSync("skills")
//   sources      ← OccurrenceService quotes for the selected skill
// Canvas edits (drag, add star, connect, unlock, group) persist through
// SkillTreeService and survive reload.
// =====================================================================

const { useState: _st_us, useMemo: _st_um, useCallback: _st_uc, useRef: _st_ur, useEffect: _st_ue } = React;

const ST_GLYPHS = ["✷", "◈", "❋", "✦", "✺", "✹", "◇", "✶"];
const ST_COLORS = ["#7a6aa3", "#3e6db5", "#a8553f", "#5d6d4e", "#8a6a2a", "#b86a82", "#3d3a78", "#c98a2c"];
const _stHash = (s) => { let h = 0; for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; };
const _stInitials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts[1]?.[0] || parts[0]?.[1] || "")).toUpperCase() || "?";
};
const _stIds = (v) => {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => (typeof x === "string" ? x : x && x.id)).filter(Boolean);
};
const _stNotice = (message) => {
  try { window.dispatchEvent(new CustomEvent("lw:backend-notice", { detail: { message } })); } catch (_e) {}
};
const _stDispatch = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));

// ---------------------------------------------------------------------
// Live context — skills, trees, cast, queue, occurrences.
// ---------------------------------------------------------------------
const buildSTContext = () => {
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  const ctx = { skills: new Map(), trees: [], cast: {}, castList: [], classes: [], stats: new Map(), abilities: new Map(), queue: [], occByEntity: new Map(), chapterNumById: new Map() };
  if (!B) return ctx;
  for (const e of (B.EntityService?.listSync?.("skills") || [])) {
    if (e && e.status !== "deleted") ctx.skills.set(e.id, e);
  }
  ctx.trees = (B.SkillTreeService?.loadSync?.().trees || []);
  for (const e of (B.EntityService?.listSync?.("cast") || [])) {
    if (!e || e.status === "deleted") continue;
    const c = {
      id: e.id, name: e.name || "Unnamed",
      initials: e.glyphChar || _stInitials(e.name),
      color: (e.data && e.data.color) || ST_COLORS[_stHash(e.id) % ST_COLORS.length],
      role: (e.data && e.data.role) || "",
    };
    ctx.cast[c.id] = c;
    ctx.castList.push(c);
  }
  ctx.classes = (B.EntityService?.listSync?.("classes") || []).filter((e) => e && e.status !== "deleted");
  for (const e of (B.EntityService?.listSync?.("stats") || [])) if (e && e.status !== "deleted") ctx.stats.set(e.id, e);
  for (const e of (B.EntityService?.listSync?.("abilities") || [])) if (e && e.status !== "deleted") ctx.abilities.set(e.id, e);
  ctx.queue = (B.ReviewService?.listSync?.("skills") || []).filter((q) => q.status === "pending");
  try {
    const chState = B.ManuscriptChapterService?.loadSync?.() || {};
    (chState.chapters || []).filter((c) => !c.reserved).forEach((c, i) => ctx.chapterNumById.set(c.id, c.num || i + 1));
  } catch (_e) {}
  try {
    for (const o of (B.OccurrenceService?.listAllSync?.() || [])) {
      if (!o || !o.entityId || !ctx.skills.has(o.entityId)) continue;
      const list = ctx.occByEntity.get(o.entityId) || [];
      list.push(o);
      ctx.occByEntity.set(o.entityId, list);
    }
  } catch (_e) {}
  return ctx;
};

// Tier: explicit layout/tier field wins; otherwise derived from the
// star's height on the canvas (lower = earlier tier), matching the
// designed vertical tiering.
const _stTierOf = (pos, d) => {
  const t = Number((pos && pos.tier) ?? d.tier);
  if (t >= 1 && t <= 4) return Math.round(t);
  const y = Number(pos && pos.y);
  if (!isFinite(y)) return 1;
  return y >= 68 ? 1 : y >= 48 ? 2 : y >= 30 ? 3 : 4;
};

// Map one persisted tree onto the designed constellation shape.
const liveTreeToView = (tree, ctx) => {
  const color = tree.color || ST_COLORS[_stHash(tree.id) % ST_COLORS.length];
  const glyph = tree.glyph || ST_GLYPHS[_stHash(tree.id) % ST_GLYPHS.length];
  const layout = tree.layout || {};
  const nodeIds = (tree.nodeIds || []).filter((id) => ctx.skills.has(id));
  const queueNames = new Set(ctx.queue.map((q) => String(q.name || "").toLowerCase()));
  const nodes = nodeIds.map((id, i) => {
    const skill = ctx.skills.get(id);
    const d = skill.data || {};
    const pos = layout[id] || { x: 18 + (i * 16) % 64, y: 75 - (i % 4) * 16 };
    const requires = (tree.edges || []).filter((e) => e.to === id && nodeIds.includes(e.from)).map((e) => e.from);
    const bearerIds = _stIds(d.learnedBy || d.bearers).filter((cid) => ctx.cast[cid]);
    return {
      id,
      name: skill.name || "Untitled skill",
      type: d.skillType || "active",
      tier: _stTierOf(pos, d),
      x: Number(pos.x) || 0,
      y: Number(pos.y) || 0,
      group: pos.group || null,
      summary: skill.summary || d.summary || "",
      effect: d.effect || "",
      cost: d.cost || "",
      requires,
      unlocked: !!pos.unlocked,
      bearerIds,
      chars: bearerIds.length,
      upgrade: !!d.upgrade || (tree.edges || []).some((e) => e.to === id && e.kind === "upgrade"),
      review: queueNames.has(String(skill.name || "").toLowerCase()),
      linkedStats: _stIds(d.linkedStats).map((sid) => ctx.stats.get(sid)?.name).filter(Boolean),
      linkedAbilities: _stIds(d.linkedAbilities).map((aid) => ctx.abilities.get(aid)?.name).filter(Boolean),
      sourceQuote: typeof d.sourceQuote === "string" ? d.sourceQuote : "",
    };
  });
  return {
    id: tree.id,
    name: tree.name || "Untitled tree",
    eyebrow: tree.description || (nodes.length + " skills"),
    glyph, color,
    summary: tree.description || "",
    assignedChars: (tree.assignedCast || []).filter((cid) => ctx.cast[cid]),
    assignedClasses: (tree.assignedClasses || []),
    review: 0, // filled by the caller via suggestTreeFor
    constellation: tree.constellation || tree.name || "—",
    nodes,
    raw: tree,
  };
};

// Token-overlap suggestion: which tree does an unplaced skill belong to?
const suggestTreeFor = (text, views) => {
  const tokens = String(text || "").toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2);
  if (!tokens.length || !views.length) return views[0] || null;
  let best = null, bestScore = 0;
  for (const v of views) {
    const hay = (v.name + " " + v.summary + " " + v.eyebrow).toLowerCase();
    const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
    if (score > bestScore) { best = v; bestScore = score; }
  }
  return best || views[0] || null;
};

// A free canvas spot that doesn't sit on an existing star.
const _stFreeSpot = (view) => {
  const taken = (view?.nodes || []).map((n) => ({ x: n.x, y: n.y }));
  for (let i = 0; i < 40; i++) {
    const x = 18 + (i * 17) % 66;
    const y = 74 - (Math.floor(i / 4) * 15) % 56;
    if (!taken.some((p) => Math.abs(p.x - x) < 7 && Math.abs(p.y - y) < 7)) return { x, y };
  }
  return { x: 50, y: 50 };
};

const _stViews = (ctx) => {
  const views = ctx.trees.map((t) => liveTreeToView(t, ctx));
  for (const q of ctx.queue) {
    const v = suggestTreeFor((q.name || "") + " " + (q.summary || ""), views);
    if (v) v.review += 1;
  }
  return views;
};

// Orphans: live skills not placed in any tree (and not dismissed).
const _stOrphans = (ctx, views) => {
  const placed = new Set(views.flatMap((v) => v.nodes.map((n) => n.id)));
  const out = [];
  for (const skill of ctx.skills.values()) {
    if (placed.has(skill.id)) continue;
    const d = skill.data || {};
    if (d.orphanDismissed) continue;
    const chNum = skill.chapterId ? ctx.chapterNumById.get(skill.chapterId) : null;
    out.push({
      id: skill.id,
      name: skill.name || "Untitled skill",
      source: chNum ? "Ch. " + chNum : "Unplaced",
      suggestionTree: suggestTreeFor((skill.name || "") + " " + (skill.summary || ""), views),
      reason: skill.summary || (skill.data && skill.data.summary) || "Not yet placed in a constellation.",
    });
  }
  return out;
};

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
// Small inline picker — designed-chip list used by the Assign…/Merge
// affordances in the side panel.
// ---------------------------------------------------------------------
const STInlinePicker = ({ items, onPick, emptyLabel }) => (
  <div className="stp__picker" data-ui="STInlinePicker">
    {items.length === 0 && <div className="stp__picker-empty">{emptyLabel || "— nothing available —"}</div>}
    {items.map((it) => (
      <button key={it.id} className="stp__char" style={{ "--c": it.color || "var(--accent)" }}
              onClick={() => onPick(it)}>
        {it.initials && <span className="stp__char-avatar">{it.initials}</span>}
        <span>{it.name}</span>
      </button>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// SkillTreesSidePanel — body inserted into the docked panel
// ---------------------------------------------------------------------
const SkillTreesSidePanel = ({ ctx, views, onOpenEditor }) => {
  const [selectedTreeId, setSelectedTreeId] = _st_us(null);
  const [selectedNodeId, setSelectedNodeId] = _st_us(null);
  const [picker, setPicker] = _st_us(null); // "assign-node" | "assign-tree" | "merge:<orphanId>" | null
  const B = () => window.LoomwrightBackend;

  const tree = views.find((t) => t.id === selectedTreeId) || views[0] || null;
  _st_ue(() => {
    if (!tree) { if (selectedTreeId) setSelectedTreeId(null); return; }
    if (tree.id !== selectedTreeId) setSelectedTreeId(tree.id);
  }, [views.length]);
  const node = tree ? (tree.nodes.find((n) => n.id === selectedNodeId) || tree.nodes[0] || null) : null;

  const createTree = async () => {
    const s = B()?.SkillTreeService;
    if (!s) return;
    const row = await s.addTree({ name: "New skill tree" });
    if (row?.id) { setSelectedTreeId(row.id); onOpenEditor(row.id); }
  };
  const orphans = _st_um(() => _stOrphans(ctx, views), [ctx, views]);

  return (
    <div className="stp" data-ui="SkillTreesSidePanel">
      <div className="stp__roster">
        <div className="stp__sech">Trees</div>
        <div className="stp__roster-list">
          {views.map((t) => (
            <button key={t.id}
              className={"stp__roster-row" + (tree && t.id === tree.id ? " is-on" : "")}
              onClick={() => { setSelectedTreeId(t.id); setSelectedNodeId(t.nodes[0]?.id || null); }}
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
          {views.length === 0 && (
            <div className="stp__empty" data-ui="STEmptyRoster">No skill trees yet — chart your first constellation.</div>
          )}
          <button className="stp__roster-add" data-callback="onCreateSkillTree" data-testid="st-create-tree"
                  onClick={createTree}>
            <Icon name="plus" size={11}/>
            <span>Create tree…</span>
          </button>
        </div>
      </div>

      {tree ? (
      <div className="stp__preview">
        <div className="stp__preview-head">
          <span className="stp__preview-glyph" style={{ color: tree.color }}>{tree.glyph}</span>
          <div className="stp__preview-titles">
            <div className="stp__preview-name">{tree.name}</div>
            <div className="stp__preview-eyebrow">{tree.eyebrow} · {tree.constellation}</div>
          </div>
          <button className="stp__preview-edit" onClick={() => onOpenEditor(tree.id)} data-callback="onOpenSkillTreeEditor">
            <Icon name="expand" size={11}/>
            <span>Open editor</span>
          </button>
        </div>

        <div className="stp__mini">
          <SkillTreeMini tree={tree} selectedNodeId={node?.id} onSelectNode={setSelectedNodeId}/>
          <div className="stp__mini-foot">
            <span>{tree.nodes.length} skills</span>
            <span>·</span>
            <span>{tree.nodes.filter((n) => n.unlocked).length} unlocked</span>
            <span>·</span>
            <span>{tree.assignedChars.length} bearers</span>
          </div>
        </div>

        {node ? (
        <div className="stp__node-card" style={{ "--c": tree.color }}>
          <div className="stp__node-head">
            <span className="stp__node-tier">T{node.tier}</span>
            <span className="stp__node-name">{node.name}</span>
            <span className={"stp__node-type stp__node-type--" + node.type}>{node.type}</span>
          </div>
          <p className="stp__node-sum">{node.summary}</p>
          <div className="stp__node-rows">
            {node.effect && <STRow k="Effect" v={node.effect}/>}
            {node.cost && <STRow k="Cost" v={node.cost}/>}
            {node.requires.length > 0 && (
              <STRow k="Requires" v={node.requires.map((r) => tree.nodes.find((x) => x.id === r)?.name).filter(Boolean).join(" · ")}/>
            )}
          </div>
          <div className="stp__node-actions">
            <button data-callback="onAssignSkillToCharacter"
                    onClick={() => setPicker(picker === "assign-node" ? null : "assign-node")}>Assign…</button>
            <button data-callback="onMarkSkillUnlocked" data-testid="stp-toggle-lock"
                    onClick={async () => { await B()?.SkillTreeService?.setNodeUnlocked(tree.id, node.id, !node.unlocked); }}>
              {node.unlocked ? "Lock" : "Unlock"}</button>
            <button data-callback="onOpenSkillTreeEditor" onClick={() => onOpenEditor(tree.id)}>Edit in canvas</button>
          </div>
          {picker === "assign-node" && (
            <STInlinePicker
              items={ctx.castList.filter((c) => !node.bearerIds.includes(c.id))}
              emptyLabel="No unassigned characters."
              onPick={async (c) => {
                const skill = ctx.skills.get(node.id);
                const d = { ...((skill && skill.data) || {}) };
                const list = Array.isArray(d.learnedBy) ? [...d.learnedBy] : [];
                list.push({ id: c.id, name: c.name, type: "cast" });
                d.learnedBy = list;
                await B()?.EntityService?.update("skills", node.id, { data: d });
                await B()?.SkillTreeService?.assignCast(tree.id, c.id);
                setPicker(null);
                _stNotice(c.name + " learned " + node.name + ".");
              }}/>
          )}
        </div>
        ) : (
          <div className="stp__empty">No skills in this tree yet — open the editor and place your first star.</div>
        )}

        <div className="stp__chars">
          <div className="stp__sech">Assigned to</div>
          <div className="stp__chars-list">
            {tree.assignedChars.map((cid) => {
              const c = ctx.cast[cid];
              if (!c) return null;
              return (
                <button key={cid} className="stp__char"
                        data-callback="onOpenCharacterDossier"
                        onClick={() => {
                          _stDispatch("lw:open-panel", { kind: "cast" });
                          _stDispatch("lw:open-cast-member", { entityId: cid });
                        }}
                        style={{ "--c": c.color }}>
                  <span className="stp__char-avatar">{c.initials}</span>
                  <span>{c.name}</span>
                </button>
              );
            })}
            <button className="stp__char stp__char--add" data-callback="onAssignSkillTreeToCharacter"
                    onClick={() => setPicker(picker === "assign-tree" ? null : "assign-tree")}>
              <Icon name="plus" size={10}/><span>Assign…</span>
            </button>
          </div>
          {picker === "assign-tree" && (
            <STInlinePicker
              items={ctx.castList.filter((c) => !tree.assignedChars.includes(c.id))}
              emptyLabel="Everyone already bears this tree."
              onPick={async (c) => {
                await B()?.SkillTreeService?.assignCast(tree.id, c.id);
                setPicker(null);
                _stNotice(c.name + " now bears " + tree.name + ".");
              }}/>
          )}
        </div>

        <div className="stp__orphans">
          <div className="stp__sech">
            Orphan skills
            <span className="stp__sech-n">{orphans.length}</span>
          </div>
          <div className="stp__orphan-list">
            {orphans.length === 0 && <div className="stp__empty">No orphan skills — every skill has a constellation.</div>}
            {orphans.map((o) => (
              <div key={o.id} className="stp__orphan">
                <div className="stp__orphan-head">
                  <span className="stp__orphan-name">{o.name}</span>
                  <span className="stp__orphan-src">{o.source}</span>
                </div>
                <div className="stp__orphan-reason">{o.reason}</div>
                <div className="stp__orphan-actions">
                  {o.suggestionTree && (
                    <button data-callback="onAcceptDraftSkillNode"
                            onClick={async () => {
                              await B()?.SkillTreeService?.addNode(o.suggestionTree.id, o.id, _stFreeSpot(o.suggestionTree));
                              _stNotice(o.name + " placed in " + o.suggestionTree.name + ".");
                            }}>→ {o.suggestionTree.name}</button>
                  )}
                  <button data-callback="onMergeDraftSkillNode"
                          onClick={() => setPicker(picker === "merge:" + o.id ? null : "merge:" + o.id)}>Merge</button>
                  <button data-callback="onCreateSkillTree"
                          onClick={async () => {
                            const s = B()?.SkillTreeService;
                            if (!s) return;
                            const row = await s.addTree({ name: o.name + " path" });
                            if (row?.id) await s.addNode(row.id, o.id, { x: 50, y: 76 });
                            _stNotice("New tree charted around " + o.name + ".");
                          }}>New tree</button>
                  <button data-callback="onDenyDraftSkillNode" className="stp__orphan-deny"
                          onClick={async () => {
                            const skill = ctx.skills.get(o.id);
                            await B()?.EntityService?.update("skills", o.id, { data: { ...((skill && skill.data) || {}), orphanDismissed: true } });
                          }}>Dismiss</button>
                </div>
                {picker === "merge:" + o.id && (
                  <STInlinePicker
                    items={[...ctx.skills.values()].filter((s) => s.id !== o.id).map((s) => ({ id: s.id, name: s.name }))}
                    emptyLabel="No other skills to merge into."
                    onPick={async (target) => {
                      await B()?.LinkService?.mergeEntities(target.id, "skills", [o.id]);
                      setPicker(null);
                      _stNotice("Merged " + o.name + " into " + target.name + ".");
                      _stDispatch("lw:entity-store-updated", {});
                    }}/>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
      ) : (
        <div className="stp__preview">
          <div className="stp__empty stp__empty--lg" data-ui="STEmptyPreview">
            No constellation yet. Create a tree and start placing skills — extraction will also propose stars from your chapters.
          </div>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// SkillTreeCanvas — full constellation map with live editing.
// Nodes positioned by (x, y) in 0–100 percent space. Supports the
// editor tools (select/pan/add/connect/branch/group), wheel zoom,
// node dragging, and layer visibility — all persisted by the caller.
// ---------------------------------------------------------------------
const ST_CANVAS_W = 1000, ST_CANVAS_H = 700;

const SkillTreeCanvas = ({
  tree, selectedNodeId, onSelectNode, showLabels = true,
  tool = "select", layers = {}, armedNodeId = null,
  onMoveNode, onCanvasPoint, onNodeTap,
}) => {
  const W = ST_CANVAS_W, H = ST_CANVAS_H;
  const svgRef = _st_ur(null);
  const [view, setView] = _st_us({ x: 0, y: 0, k: 1 });
  const dragRef = _st_ur(null); // {kind:"node"|"pan", id, startX, startY, moved}
  const [dragPos, setDragPos] = _st_us(null); // {id, x, y} optimistic

  const show = (k) => layers[k] !== false;
  const visibleNodes = tree.nodes.filter((n) => (n.unlocked ? show("unlocked") : show("locked")));

  // "Fit view" tool resets pan/zoom the moment it's picked.
  _st_ue(() => { if (tool === "fit") setView({ x: 0, y: 0, k: 1 }); }, [tool]);

  // Convert a pointer event to 0–100 canvas space (compensating the
  // xMidYMid letterbox and the pan/zoom transform).
  const toPct = (evt) => {
    const rect = svgRef.current.getBoundingClientRect();
    const scale = Math.min(rect.width / W, rect.height / H) || 1;
    const ox = (rect.width - W * scale) / 2;
    const oy = (rect.height - H * scale) / 2;
    const sx = (evt.clientX - rect.left - ox) / scale;
    const sy = (evt.clientY - rect.top - oy) / scale;
    return {
      x: Math.max(0, Math.min(100, ((sx - view.x) / view.k / W) * 100)),
      y: Math.max(0, Math.min(100, ((sy - view.y) / view.k / H) * 100)),
    };
  };

  const onWheel = (e) => {
    e.preventDefault();
    setView((v) => ({ ...v, k: Math.max(0.5, Math.min(2.5, v.k * (e.deltaY < 0 ? 1.1 : 0.9))) }));
  };
  // Two-pointer pinch zoom (touch). Pointers tracked alongside dragRef.
  const pinchPointers = _st_ur(new Map());
  const pinchRef = _st_ur(null); // { startDist, startK }
  const onPointerDownBg = (e) => {
    pinchPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinchPointers.current.size === 2) {
      const [a, b] = [...pinchPointers.current.values()];
      pinchRef.current = { startDist: Math.hypot(a.x - b.x, a.y - b.y) || 1, startK: view.k };
      dragRef.current = null;
      svgRef.current.setPointerCapture?.(e.pointerId);
      return;
    }
    if (e.target.closest && e.target.closest("[data-st-node]")) return;
    if (tool === "pan" || e.button === 1) {
      dragRef.current = { kind: "pan", startX: e.clientX, startY: e.clientY, ox: view.x, oy: view.y };
      svgRef.current.setPointerCapture?.(e.pointerId);
      return;
    }
    if (tool === "add-node" || tool === "branch") {
      onCanvasPoint && onCanvasPoint(toPct(e), tool);
    }
  };
  const onPointerDownNode = (e, n) => {
    e.stopPropagation();
    pinchPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (tool === "select") {
      dragRef.current = { kind: "node", id: n.id, moved: false };
      svgRef.current.setPointerCapture?.(e.pointerId);
    } else {
      onNodeTap && onNodeTap(n, tool);
    }
  };
  const onPointerMove = (e) => {
    if (pinchPointers.current.has(e.pointerId)) {
      pinchPointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    if (pinchRef.current && pinchPointers.current.size >= 2) {
      const [a, b] = [...pinchPointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      const k = Math.max(0.5, Math.min(2.5, pinchRef.current.startK * (dist / pinchRef.current.startDist)));
      setView((v) => ({ ...v, k }));
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    if (d.kind === "pan") {
      setView((v) => ({ ...v, x: d.ox + (e.clientX - d.startX), y: d.oy + (e.clientY - d.startY) }));
    } else if (d.kind === "node") {
      const p = toPct(e);
      d.moved = true;
      setDragPos({ id: d.id, x: p.x, y: p.y });
    }
  };
  const onPointerUp = (e) => {
    if (e) {
      pinchPointers.current.delete(e.pointerId);
      if (pinchPointers.current.size < 2) pinchRef.current = null;
    }
    const d = dragRef.current;
    dragRef.current = null;
    if (d && d.kind === "node") {
      if (d.moved && dragPos && dragPos.id === d.id) {
        onMoveNode && onMoveNode(d.id, dragPos.x, dragPos.y);
      } else {
        onSelectNode && onSelectNode(d.id);
      }
    }
    setDragPos(null);
  };
  const posOf = (n) => (dragPos && dragPos.id === n.id) ? dragPos : n;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="stc__svg" preserveAspectRatio="xMidYMid meet"
         data-tool={tool}
         onWheel={onWheel} onPointerDown={onPointerDownBg}
         onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
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

      <g transform={`translate(${view.x}, ${view.y}) scale(${view.k})`}>
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
        {show("connections") && (
          <g>
            {visibleNodes.map((n) =>
              n.requires.map((rid) => {
                const r = visibleNodes.find((x) => x.id === rid);
                if (!r) return null;
                const pn = posOf(n), pr = posOf(r);
                const x1 = (pr.x / 100) * W, y1 = (pr.y / 100) * H;
                const x2 = (pn.x / 100) * W, y2 = (pn.y / 100) * H;
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
        )}

        {/* Nodes (stars) */}
        <g>
          {visibleNodes.map((n) => {
            const p = posOf(n);
            const x = (p.x / 100) * W;
            const y = (p.y / 100) * H;
            const r = n.tier === 1 ? 13 : n.tier === 2 ? 10 : n.tier === 3 ? 8 : 7;
            const isSelected = n.id === selectedNodeId;
            const isArmed = n.id === armedNodeId;
            return (
              <g key={n.id} transform={`translate(${x}, ${y})`} data-st-node={n.id}
                 onPointerDown={(e) => onPointerDownNode(e, n)}
                 style={{ cursor: tool === "select" ? "grab" : "pointer" }}>
                {/* Halo */}
                {isSelected && (
                  <>
                    <circle r={r + 14} fill={tree.color} opacity="0.10"/>
                    <circle r={r + 6}  fill="none" stroke={tree.color} strokeWidth="1.5"/>
                  </>
                )}
                {isArmed && <circle r={r + 10} fill="none" stroke={tree.color} strokeWidth="1.2" strokeDasharray="4 3"/>}
                {n.group && <circle r={r + 12} fill="none" stroke={tree.color} strokeOpacity="0.45" strokeWidth="0.8" strokeDasharray="6 4"/>}
                {show("upgrade") && n.upgrade && <circle r={r + 4} fill="none" stroke="#c98a2c" strokeWidth="1" strokeDasharray="2 2"/>}
                {show("review") && n.review && <circle r={r + 8} fill="none" stroke="#c98a2c" strokeWidth="0.8" strokeDasharray="1 3"/>}

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

        {/* Empty constellation prompt */}
        {tree.nodes.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle"
                fontFamily="var(--font-display)" fontStyle="italic" fontSize="18"
                fill="rgba(74,56,28,0.55)">
            No stars yet — pick “Add node” and tap the sky.
          </text>
        )}

        {/* Constellation name (faint, centre) */}
        <text x={W / 2} y={42} textAnchor="middle"
              fontFamily="var(--font-display)" fontStyle="italic" fontSize="20" fill="rgba(74,56,28,0.45)"
              letterSpacing="0.06em">
          ★ {tree.constellation} ★
        </text>
      </g>
    </svg>
  );
};

// ---------------------------------------------------------------------
// Tree validation + auto-layout (Validate / Auto-layout strip buttons).
// ---------------------------------------------------------------------
const _stValidate = (view) => {
  const issues = [];
  const byId = Object.fromEntries(view.nodes.map((n) => [n.id, n]));
  // Cycle detection over `requires`.
  const state = {}; // 0 visiting, 1 done
  const visit = (id, trail) => {
    if (state[id] === 1) return false;
    if (state[id] === 0) { issues.push("Cycle through " + trail.map((t) => byId[t]?.name).join(" → ")); return true; }
    state[id] = 0;
    for (const r of (byId[id]?.requires || [])) if (byId[r] && visit(r, [...trail, r])) break;
    state[id] = 1;
    return false;
  };
  for (const n of view.nodes) visit(n.id, [n.id]);
  // Tier ordering: prerequisites should sit at the same or earlier tier.
  for (const n of view.nodes) {
    for (const r of n.requires) {
      if (byId[r] && byId[r].tier > n.tier) {
        issues.push(`${n.name} (T${n.tier}) requires higher-tier ${byId[r].name} (T${byId[r].tier})`);
      }
    }
  }
  // Floating stars (no connections at all, in a tree with edges).
  if (view.nodes.length > 1) {
    const connected = new Set(view.nodes.flatMap((n) => [...n.requires, ...(n.requires.length ? [n.id] : [])]));
    for (const n of view.nodes) {
      const hasEdge = n.requires.length > 0 || view.nodes.some((x) => x.requires.includes(n.id));
      if (!hasEdge && connected.size > 0) issues.push(n.name + " floats unconnected");
    }
  }
  return issues;
};

const _stAutoLayout = async (view) => {
  const B = window.LoomwrightBackend;
  const s = B?.SkillTreeService;
  if (!s || !view.nodes.length) return;
  const byId = Object.fromEntries(view.nodes.map((n) => [n.id, n]));
  const depth = {};
  const calc = (id, seen) => {
    if (depth[id] != null) return depth[id];
    if (seen.has(id)) return 0;
    seen.add(id);
    const reqs = (byId[id]?.requires || []).filter((r) => byId[r]);
    depth[id] = reqs.length ? 1 + Math.max(...reqs.map((r) => calc(r, seen))) : 0;
    return depth[id];
  };
  const tiers = { 1: [], 2: [], 3: [], 4: [] };
  for (const n of view.nodes) {
    const t = Math.min(4, calc(n.id, new Set()) + 1);
    tiers[t].push(n);
  }
  const Y = { 1: 78, 2: 56, 3: 40, 4: 22 };
  for (const [t, row] of Object.entries(tiers)) {
    for (let i = 0; i < row.length; i++) {
      const x = Math.max(12, Math.min(88, (100 / (row.length + 1)) * (i + 1)));
      await s.updateNodeLayout(view.id, row[i].id, { x, y: Y[t], tier: Number(t) });
    }
  }
  _stNotice("Constellation re-charted by tier.");
};

// ---------------------------------------------------------------------
// SkillTreeEditor — full-screen editor overlay
// ---------------------------------------------------------------------
const SkillTreeEditor = ({ ctx, views, initialTreeId, onExit }) => {
  const [activeTreeId, setActiveTreeId] = _st_us(initialTreeId || null);
  const [selectedNodeId, setSelectedNodeId] = _st_us(null);
  const [leftTab, setLeftTab] = _st_us("roster");
  const [rightTab, setRightTab] = _st_us("inspector");
  const [showLabels, setShowLabels] = _st_us(true);
  const [activeTool, setActiveTool] = _st_us("select");
  const [layers, setLayers] = _st_us({ unlocked: true, locked: true, upgrade: true, review: true, connections: true });
  const [armedNodeId, setArmedNodeId] = _st_us(null);
  const [draftTreePick, setDraftTreePick] = _st_us({});
  const promptRef = _st_ur(null);
  const B = () => window.LoomwrightBackend;

  const tree = views.find((t) => t.id === activeTreeId) || views[0] || null;
  _st_ue(() => {
    if (!tree) { if (activeTreeId) setActiveTreeId(null); return; }
    if (tree.id !== activeTreeId) setActiveTreeId(tree.id);
  }, [views.length]);
  const node = tree ? (tree.nodes.find((n) => n.id === selectedNodeId) || tree.nodes[0] || null) : null;

  const addStarAt = async (pos, connectFromId) => {
    const ES = B()?.EntityService, s = B()?.SkillTreeService;
    if (!ES || !s || !tree) return;
    const skill = await ES.save("skills", { name: "New skill" }, { status: "active" });
    await s.addNode(tree.id, skill.id, { x: pos.x, y: pos.y });
    if (connectFromId) await s.connectNodes(tree.id, connectFromId, skill.id, "leads-to");
    setSelectedNodeId(skill.id);
    _stNotice(connectFromId ? "New star branched." : "New star placed — name it in the inspector.");
  };

  const onCanvasPoint = (pos, tool) => {
    if (tool === "add-node") addStarAt(pos);
    if (tool === "branch") {
      if (!node) { _stNotice("Select a star to branch from first."); return; }
      addStarAt(pos, node.id);
    }
  };
  const onNodeTap = async (n, tool) => {
    const s = B()?.SkillTreeService;
    if (!s || !tree) return;
    if (tool === "connect" || tool === "prereq" || tool === "upgrade") {
      if (!armedNodeId) { setArmedNodeId(n.id); _stNotice("Pick the target star."); return; }
      if (armedNodeId !== n.id) {
        const kind = tool === "prereq" ? "prereq" : tool === "upgrade" ? "upgrade" : "leads-to";
        await s.connectNodes(tree.id, armedNodeId, n.id, kind);
        _stNotice("Stars joined.");
      }
      setArmedNodeId(null);
      return;
    }
    if (tool === "group") {
      const current = (tree.raw.layout || {})[n.id]?.group || null;
      await s.updateNodeLayout(tree.id, n.id, { group: current ? null : "g1" });
      return;
    }
    setSelectedNodeId(n.id);
  };
  const onMoveNode = async (id, x, y) => {
    const s = B()?.SkillTreeService;
    if (!s || !tree) return;
    await s.updateNodePosition(tree.id, id, { x, y });
  };

  const acceptDraft = async (q) => {
    const Bk = B();
    if (!Bk) return;
    const targetTreeId = draftTreePick[q.id] || tree?.id || null;
    const payload = (q.payload && q.payload.name) ? { ...q.payload } : { name: q.name, summary: q.summary };
    if (q.suggestedChanges && Object.keys(q.suggestedChanges).length) {
      payload.data = { ...(payload.data || {}), ...q.suggestedChanges };
    }
    const saved = await Bk.EntityService.save("skills", payload, { status: "active" });
    const targetView = views.find((v) => v.id === targetTreeId);
    if (targetTreeId && saved?.id) await Bk.SkillTreeService.addNode(targetTreeId, saved.id, _stFreeSpot(targetView));
    if (q.candidateId && Bk.OccurrenceService) {
      try { await Bk.OccurrenceService.linkCandidateToEntity(q.candidateId, saved.id, "skills"); } catch (_e) {}
    }
    await Bk.ReviewService.resolve(q.id, "done");
    _stNotice(targetTreeId ? "Skill accepted into the constellation." : "Skill accepted.");
    _stDispatch("lw:entity-store-updated", {});
  };
  const denyDraft = async (q) => {
    await B()?.ReviewService?.resolve(q.id, "denied");
    _stNotice("Skill candidate denied.");
    _stDispatch("lw:entity-store-updated", {});
  };

  const TB = ({ icon, label, value, onClick }) => (
    <button
      className={"ste-tb__btn" + (activeTool === value ? " is-active" : "")}
      onClick={() => { setActiveTool(value); setArmedNodeId(null); onClick && onClick(); }}
      title={label}
    >
      <Icon name={icon} size={12}/>
      <span>{label}</span>
    </button>
  );

  if (!tree) {
    return (
      <div className="ste" data-ui="SkillTreeEditor">
        <div className="ste-tb">
          <div className="ste-tb__brand"><span>Skill Tree Editor</span></div>
          <span style={{ flex: 1 }}/>
          <button className="ste-tb__exit" onClick={onExit} data-callback="onExitSkillTreeEditor">
            <Icon name="close" size={11}/><span>Exit</span>
          </button>
        </div>
        <div className="ste__body">
          <div className="ste__canvas">
            <div className="stp__empty stp__empty--lg" style={{ margin: "auto" }}>
              No skill trees yet.
              <button className="stm__add" data-callback="onCreateSkillTree" data-testid="ste-create-first-tree"
                      onClick={async () => {
                        const row = await B()?.SkillTreeService?.addTree({ name: "New skill tree" });
                        if (row?.id) setActiveTreeId(row.id);
                      }}>
                <Icon name="plus" size={11}/> Create tree
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ste" data-ui="SkillTreeEditor">
      {/* Toolbar */}
      <div className="ste-tb">
        <div className="ste-tb__brand">
          <span style={{ fontSize: 18 }}>{tree.glyph}</span>
          <span>Skill Tree Editor —</span>
          <input
            key={tree.id}
            defaultValue={tree.name}
            title="Rename this skill tree"
            data-testid="ste-tree-name"
            aria-label="Skill tree name"
            onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== tree.name) B()?.SkillTreeService?.updateTree(tree.id, { name: v }); }}
            style={{ background: "transparent", border: "none", borderBottom: "1px dashed var(--line-3)", color: "inherit", font: "inherit", fontWeight: 600, padding: "1px 4px", minWidth: 140 }}
          />
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
          <TB icon="expand" label="Fit view" value="fit"/>
          <button className={"ste-tb__btn" + (showLabels ? " is-active" : "")} onClick={() => setShowLabels((v) => !v)}>
            <Icon name="paper" size={12}/><span>Labels</span>
          </button>
        </div>
        <span style={{ flex: 1 }}/>
        <button className="ste-tb__btn ste-tb__btn--queue" onClick={() => setRightTab("queue")}>
          <Icon name="bell" size={12}/><span>Review</span>
          {ctx.queue.length > 0 && <span className="ste-tb__badge">{ctx.queue.length}</span>}
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
                data-testid={"st-tab-" + id}
                onClick={() => setLeftTab(id)}>
                <Icon name={icon} size={10}/><span>{label}</span>
              </button>
            ))}
          </div>
          <div className="ste__rail-body">
            {leftTab === "roster" && (
              <div className="ste-list">
                {views.map((t) => (
                  <button key={t.id}
                    className={"ste-list__row" + (t.id === tree.id ? " is-on" : "")}
                    onClick={() => { setActiveTreeId(t.id); setSelectedNodeId(null); }}
                    style={{ "--c": t.color }}>
                    <span className="ste-list__glyph">{t.glyph}</span>
                    <span className="ste-list__main">
                      <span className="ste-list__name">{t.name}</span>
                      <span className="ste-list__sub">{t.nodes.length} skills · {t.eyebrow}</span>
                    </span>
                  </button>
                ))}
                <button className="ste-list__add" data-callback="onCreateSkillTree"
                        onClick={async () => {
                          const row = await B()?.SkillTreeService?.addTree({ name: "New skill tree" });
                          if (row?.id) setActiveTreeId(row.id);
                        }}>
                  <Icon name="plus" size={11}/><span>New tree</span>
                </button>
              </div>
            )}
            {leftTab === "nodes" && (
              <div className="ste-list">
                {tree.nodes.map((n) => (
                  <button key={n.id}
                    className={"ste-list__row" + (n.id === node?.id ? " is-on" : "")}
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
                {tree.nodes.length === 0 && <div className="ste-list__hint">No stars yet.</div>}
                <button className="ste-list__add" data-testid="st-add-node"
                        onClick={() => addStarAt(_stFreeSpot(tree))}>
                  <Icon name="plus" size={11}/><span>New star</span>
                </button>
              </div>
            )}
            {leftTab === "tray" && (
              <div className="ste-list">
                <div className="ste-list__hint">Tap a character to grant them this tree.</div>
                {ctx.castList.map((c) => {
                  const on = tree.assignedChars.includes(c.id);
                  return (
                    <button key={c.id} className={"ste-list__row" + (on ? " is-on" : "")} style={{ "--c": c.color }}
                            onClick={async () => {
                              const s = B()?.SkillTreeService;
                              if (!s) return;
                              if (on) await s.unassignCast(tree.id, c.id);
                              else await s.assignCast(tree.id, c.id);
                            }}>
                      <span className="ste-list__avatar">{c.initials}</span>
                      <span className="ste-list__main">
                        <span className="ste-list__name">{c.name}{on ? " ✓" : ""}</span>
                        <span className="ste-list__sub">{c.role}</span>
                      </span>
                    </button>
                  );
                })}
                {ctx.castList.length === 0 && <div className="ste-list__hint">No cast yet — create characters first.</div>}
              </div>
            )}
            {leftTab === "drafts" && (
              <div className="ste-list">
                <div className="ste-list__hint">Type a prompt to generate a starter tree, or accept extraction candidates below.</div>
                <div className="ste-list__prompt">
                  <input placeholder="Create me a fire mage skill tree…" ref={promptRef}/>
                  <button data-callback="onGenerateDraftSkillTree"
                          onClick={() => _stDispatch("lw:dispatch-callback", {
                            name: "onGenerateDraftSkillTree",
                            detail: { prompt: promptRef.current?.value || "", treeId: tree.id },
                          })}>Draft</button>
                </div>
                {ctx.queue.map((q) => (
                  <div key={q.id} className="ste-list__draft">
                    <div className="ste-list__draft-head">
                      <span className="ste-list__draft-name">{q.name}</span>
                      <span className="ste-list__draft-tier">{Math.round((q.confidence || 0.6) * 100)}%</span>
                    </div>
                    <div className="ste-list__draft-note">{q.sourceQuote || q.summary || q.reason || ""}</div>
                    <div className="ste-list__draft-tree">
                      <span>into</span>
                      <select value={draftTreePick[q.id] || tree.id}
                              onChange={(e) => setDraftTreePick((m) => ({ ...m, [q.id]: e.target.value }))}>
                        {views.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                      </select>
                    </div>
                    <div className="ste-list__draft-actions">
                      <button data-callback="onAcceptSkillQueueItem" data-testid={"st-draft-accept-" + q.id}
                              onClick={() => acceptDraft(q)}>Accept</button>
                      <button data-callback="onEditSkillQueueItem"
                              onClick={() => _stDispatch("lw:dispatch-callback", { name: "onEditSkillQueueItem", detail: { id: q.id } })}>Edit</button>
                      <button data-callback="onMergeSkillQueueItem"
                              onClick={() => _stDispatch("lw:dispatch-callback", { name: "onMergeSkillQueueItem", detail: { id: q.id } })}>Merge</button>
                      <button data-callback="onDenySkillQueueItem"
                              onClick={() => denyDraft(q)}>Deny</button>
                    </div>
                  </div>
                ))}
                {ctx.queue.length === 0 && <div className="ste-list__hint">No pending skill candidates.</div>}
              </div>
            )}
            {leftTab === "layers" && (
              <div className="ste-list">
                {[["unlocked","Unlocked"],["locked","Locked"],["upgrade","Upgrade-available"],["review","In review"],["connections","Connections"]].map(([id, lbl]) => (
                  <label key={id} className="ste-list__layer">
                    <input type="checkbox" checked={layers[id] !== false}
                           onChange={() => setLayers((l) => ({ ...l, [id]: l[id] === false }))}/>
                    <span>{lbl}</span>
                  </label>
                ))}
                <label className="ste-list__layer">
                  <input type="checkbox" checked={showLabels} onChange={() => setShowLabels((v) => !v)}/>
                  <span>Labels</span>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Canvas */}
        <div className="ste__canvas">
          <SkillTreeCanvas tree={tree} selectedNodeId={node?.id}
                           onSelectNode={setSelectedNodeId} showLabels={showLabels}
                           tool={activeTool} layers={layers} armedNodeId={armedNodeId}
                           onMoveNode={onMoveNode} onCanvasPoint={onCanvasPoint} onNodeTap={onNodeTap}/>
        </div>

        {/* Right rail */}
        <div className="ste__rail ste__rail--right">
          <div className="ste__tabs">
            {[["inspector","Inspector","paper"], ["queue","Review","bell"], ["related","Related","link"], ["source","Source","book"]].map(([id, label, icon]) => (
              <button key={id}
                className={"ste__tab" + (rightTab === id ? " is-on" : "")}
                onClick={() => setRightTab(id)}>
                <Icon name={icon} size={10}/><span>{label}</span>
                {id === "queue" && ctx.queue.length > 0 && <span className="ste-list__q">{ctx.queue.length}</span>}
              </button>
            ))}
          </div>
          <div className="ste__rail-body">
            {rightTab === "inspector" && (node ? (
              <div className="ste-insp">
                <div className="ste-insp__head">
                  <span className="ste-insp__tier">T{node.tier}</span>
                  <input className="ste-insp__name ste-insp__name--edit"
                         key={node.id + ":" + node.name}
                         defaultValue={node.name}
                         data-testid="ste-insp-name"
                         aria-label="Skill name"
                         onBlur={(e) => {
                           const name = (e.target.value || "").trim();
                           if (name && name !== node.name) B()?.EntityService?.update("skills", node.id, { name });
                         }}
                         onKeyDown={(e) => { if (e.key === "Enter") e.target.blur(); }}/>
                </div>
                <div className={"ste-insp__type ste-insp__type--" + node.type}>{node.type} skill</div>
                <p className="ste-insp__sum">{node.summary}</p>
                {node.effect && <STRow k="Effect"  v={node.effect}/>}
                {node.cost && <STRow k="Cost"    v={node.cost}/>}
                <STRow k="Locked"  v={node.unlocked ? "Unlocked" : "Locked"}/>
                <STRow k="Bearers" v={node.chars + " character(s)"}/>
                {node.requires.length > 0 && (
                  <STRow k="Requires" v={node.requires.map((r) => tree.nodes.find((x) => x.id === r)?.name).filter(Boolean).join(" · ")}/>
                )}
                {node.linkedStats.length > 0 && <STRow k="Stats" v={node.linkedStats.join(", ")}/>}

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
                  {node.bearerIds.map((cid) => {
                    const c = ctx.cast[cid];
                    if (!c) return null;
                    return (
                      <button key={cid} className="ste-insp__chip" style={{ "--c": c.color }}
                              onClick={() => {
                                _stDispatch("lw:open-panel", { kind: "cast" });
                                _stDispatch("lw:open-cast-member", { entityId: cid });
                              }}>
                        <span className="ste-insp__chip-avatar">{c.initials}</span>
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                  {node.bearerIds.length === 0 && <div className="ste-insp__none">— No bearers yet —</div>}
                </div>

                <div className="ste-insp__actions">
                  <button data-callback="onEditSkillNode"
                          onClick={() => {
                            const rec = ctx.skills.get(node.id);
                            if (rec) _stDispatch("lw:open-entity-editor", { type: "skills", initial: rec, mode: "full" });
                          }}>Edit node</button>
                  <button data-callback="onConnectSkillNodes"
                          onClick={() => { setActiveTool("connect"); setArmedNodeId(node.id); _stNotice("Pick the target star."); }}>Add connection</button>
                  <button data-callback="onMarkSkillUnlocked" data-testid="ste-toggle-lock"
                          onClick={async () => { await B()?.SkillTreeService?.setNodeUnlocked(tree.id, node.id, !node.unlocked); }}>
                    {node.unlocked ? "Lock" : "Unlock"}</button>
                  <button data-testid="ste-remove-node"
                          onClick={async () => {
                            await B()?.SkillTreeService?.removeNode(tree.id, node.id);
                            setSelectedNodeId(null);
                            _stNotice("Star removed from the constellation (skill kept as orphan).");
                          }}>Remove from tree</button>
                </div>
              </div>
            ) : (
              <div className="ste-insp"><div className="ste-insp__none">— No star selected —</div></div>
            ))}
            {rightTab === "queue" && (
              <div className="ste-queue">
                {ctx.queue.map((q) => {
                  const conf = typeof q.confidence === "number" ? q.confidence : 0.6;
                  const lvl = conf >= 0.95 ? "high" : conf >= 0.75 ? "strong" : conf >= 0.5 ? "uncertain" : "weak";
                  const chNum = q.chapterId ? ctx.chapterNumById.get(q.chapterId) : null;
                  return (
                    <div key={q.id} className={"ste-queue__card ste-queue__card--" + lvl}>
                      <div className="ste-queue__head">
                        <ConfidenceBadge level={lvl}/>
                        <span className="ste-queue__name">{q.name}</span>
                      </div>
                      <p className="ste-queue__excerpt">"{q.sourceQuote || q.summary || q.reason || ""}"</p>
                      <div className="ste-queue__meta">{chNum ? "Ch. " + chNum : ""}</div>
                      <div className="ste-queue__pill">{q.suggestedAction === "create" ? "Add to tree?" : (q.action || "Review")}</div>
                      <div className="ste-queue__actions">
                        <button data-callback="onAcceptSkillQueueItem" onClick={() => acceptDraft(q)}>Accept</button>
                        <button data-callback="onEditSkillQueueItem"
                                onClick={() => _stDispatch("lw:dispatch-callback", { name: "onEditSkillQueueItem", detail: { id: q.id } })}>Edit</button>
                        <button data-callback="onMergeSkillQueueItem"
                                onClick={() => _stDispatch("lw:dispatch-callback", { name: "onMergeSkillQueueItem", detail: { id: q.id } })}>Merge</button>
                        <button data-callback="onDenySkillQueueItem" onClick={() => denyDraft(q)}>Deny</button>
                      </div>
                    </div>
                  );
                })}
                {ctx.queue.length === 0 && <div className="ste-insp__none">— Review queue is clear —</div>}
              </div>
            )}
            {rightTab === "related" && (
              <div className="ste-related">
                <div className="ste-insp__sech">Linked abilities</div>
                {(node?.linkedAbilities || []).map((name) => (
                  <button key={name} className="ste-insp__chip">{name}</button>
                ))}
                {(!node || node.linkedAbilities.length === 0) && <div className="ste-insp__none">— none linked —</div>}
                <div className="ste-insp__sech" style={{ marginTop: 14 }}>Linked stats</div>
                {(node?.linkedStats || []).map((name) => (
                  <button key={name} className="ste-insp__chip">{name}</button>
                ))}
                {(!node || node.linkedStats.length === 0) && <div className="ste-insp__none">— none linked —</div>}
                <div className="ste-insp__sech" style={{ marginTop: 14 }}>Linked classes</div>
                {tree.assignedClasses.map((clid) => {
                  const cl = ctx.classes.find((c) => c.id === clid);
                  return cl ? <button key={clid} className="ste-insp__chip">{cl.name}</button> : null;
                })}
                {tree.assignedClasses.length === 0 && <div className="ste-insp__none">— none linked —</div>}
              </div>
            )}
            {rightTab === "source" && (
              <div className="ste-source">
                {node && node.sourceQuote && (
                  <div className="ste-source__card">
                    <div className="ste-source__cite">First evidence</div>
                    <p>"{node.sourceQuote}"</p>
                  </div>
                )}
                {node && (ctx.occByEntity.get(node.id) || []).slice(0, 4).map((o) => (
                  <div key={o.occurrenceId || o.id} className="ste-source__card">
                    <div className="ste-source__cite">Ch. {ctx.chapterNumById.get(o.chapterId) ?? "?"}</div>
                    <p>"{String(o.exactText || "").trim()}"</p>
                  </div>
                ))}
                {(!node || (!node.sourceQuote && (ctx.occByEntity.get(node.id) || []).length === 0)) && (
                  <div className="ste-insp__none">— No manuscript sources yet —</div>
                )}
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
          <button className="ste__strip-btn" data-testid="ste-validate"
                  onClick={() => {
                    const issues = _stValidate(tree);
                    _stNotice(issues.length ? ("Found " + issues.length + " issue(s): " + issues.slice(0, 3).join("; ")) : "Constellation is sound.");
                  }}>Validate</button>
          <button className="ste__strip-btn" data-testid="ste-auto-layout"
                  onClick={() => _stAutoLayout(tree)}>Auto-layout</button>
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
                      className={"ste__strip-node" + (n.id === node?.id ? " is-on" : "") + (n.unlocked ? " is-unlocked" : "")}
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
// SkillsPanelBody — entry point used by the panel-stack dispatcher.
// Side panel + the full constellation editor as an overlay.
// ---------------------------------------------------------------------
const SkillsPanelBody = ({ panel }) => {
  const [storeVersion, setStoreVersion] = _st_us(0);
  const [editor, setEditor] = _st_us(null); // { treeId } | null
  _st_ue(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:skill-trees-updated", "lw:entity-store-updated", "lw:review-queue-updated", "lw:backend-ready", "lw:project-imported"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  // The standardised panel header can request the full-screen canvas.
  _st_ue(() => {
    const onOpen = (e) => {
      const d = e?.detail || {};
      if (d.panelKind === "skills" || d.panelKind === "abilities" || d.workspaceId === "skill-tree-editor") {
        // Honour a selected entity: if it names a tree (or a skill inside
        // one), the editor opens on that tree instead of the first.
        let treeId = null;
        if (d.entityId) {
          const trees = window.LoomwrightBackend?.SkillTreeService?.loadSync?.()?.trees || [];
          const hit = trees.find((t) => t.id === d.entityId)
            || trees.find((t) => (t.nodes || []).some((n) => n.id === d.entityId || n.skillId === d.entityId));
          if (hit) treeId = hit.id;
        }
        setEditor({ treeId });
      }
    };
    window.addEventListener("lw:open-existing-fullscreen", onOpen);
    return () => window.removeEventListener("lw:open-existing-fullscreen", onOpen);
  }, []);

  const ctx = _st_um(() => buildSTContext(), [storeVersion]);
  const views = _st_um(() => _stViews(ctx), [ctx]);

  return (
    <div className="stp-host">
      <SkillTreesSidePanel ctx={ctx} views={views} onOpenEditor={(treeId) => setEditor({ treeId })}/>
      {editor && (
        <div className="ste-overlay">
          <SkillTreeEditor ctx={ctx} views={views} initialTreeId={editor.treeId} onExit={() => setEditor(null)}/>
        </div>
      )}
    </div>
  );
};

Object.assign(window, {
  buildSTContext, liveTreeToView,
  SkillTreeMini, SkillTreesSidePanel, SkillTreeCanvas, SkillTreeEditor, SkillsPanelBody,
});

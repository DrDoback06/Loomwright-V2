// =====================================================================
// lore-references.jsx — Lore / Canon panel + References panel.
//
// Both panels share a card-list visual vocabulary but track different
// objects:
//   Lore / Canon: facts and rules the world is bound to
//                 ← EntityService("lore") + ProjectIntelService.canonRules
//   References:  external materials (uploads, pasted text, instructions)
//                 ← ReferencesService
// =====================================================================

const { useState: _lr_us, useMemo: _lr_um, useCallback: _lr_uc } = React;

const CANON_SCOPES = [
  { id: "all",         label: "All",            color: "#76684c" },
  { id: "world",       label: "World rule",     color: "#3e6db5" },
  { id: "magic",       label: "Magic rule",     color: "#7a6aa3" },
  { id: "history",     label: "Historical",     color: "#7a5a3a" },
  { id: "cultural",    label: "Cultural",       color: "#5d6d4e" },
  { id: "language",    label: "Language",       color: "#998f78" },
  { id: "faction",     label: "Faction",        color: "#3d3a78" },
];

const _lrAgo = (iso) => {
  const t = iso ? Date.parse(iso) : NaN;
  if (!isFinite(t)) return "—";
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 2) return "just now";
  if (mins < 60) return mins + " min ago";
  const hours = Math.round(mins / 60);
  if (hours < 24) return hours + (hours === 1 ? " hour ago" : " hours ago");
  const days = Math.round(hours / 24);
  if (days < 7) return days + (days === 1 ? " day ago" : " days ago");
  const weeks = Math.round(days / 7);
  if (weeks < 5) return weeks + (weeks === 1 ? " week ago" : " weeks ago");
  return Math.round(days / 30) + " months ago";
};
const _lrDispatch = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const _lrNotice = (message) => _lrDispatch("lw:backend-notice", { message });
const _lrIds = (v) => {
  if (v == null) return [];
  const arr = Array.isArray(v) ? v : [v];
  return arr.map((x) => (typeof x === "string" ? x : x && x.id)).filter(Boolean);
};

// Map the lore editor's `kind` vocabulary onto the designed scope strings.
const _lrScopeOf = (kind) => {
  const k = String(kind || "").toLowerCase();
  if (/cosmology|prophecy|magic/.test(k)) return "magic rule";
  if (/historical/.test(k)) return "historical";
  if (/cultural/.test(k)) return "cultural";
  if (/language/.test(k)) return "language rule";
  if (/faction/.test(k)) return "faction rule";
  return "world rule";
};
const _lrConfidenceOf = (band) => {
  const b = String(band || "").toLowerCase();
  if (b === "canon") return "high";
  if (b === "provisional") return "strong";
  if (b === "working theory") return "uncertain";
  return "weak"; // contradicted / retconned / unknown
};

// One live snapshot for the Lore panel.
const buildLoreContext = () => {
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  const ctx = { facts: [], contradictions: [], aiRules: [], entityNames: new Map() };
  if (!B) return ctx;
  const all = B.EntityService?.listAllSync?.() || {};
  for (const byId of Object.values(all)) {
    for (const e of Object.values(byId || {})) {
      if (e && e.id) ctx.entityNames.set(e.id, e.name || e.id);
    }
  }
  const chapterChip = (d) => {
    const chips = Array.isArray(d.chapters) ? d.chapters : [];
    if (chips.length) return "Ch. " + chips.join(", ");
    if (typeof d.sourceQuotes === "string" && d.sourceQuotes.trim()) {
      const s = d.sourceQuotes.trim().replace(/\s+/g, " ");
      return '"' + (s.length > 48 ? s.slice(0, 45) + "…" : s) + '"';
    }
    return "Manual entry";
  };
  const lore = (B.EntityService?.listSync?.("lore") || []).filter((e) => e && e.status !== "deleted");
  for (const e of lore) {
    const d = e.data || {};
    const band = String(d.band || "canon").toLowerCase();
    const contradicted = band === "contradicted" || !!(typeof d.contradictedBy === "string" && d.contradictedBy.trim());
    const fact = {
      id: e.id,
      text: e.name || d.body || "Untitled fact",
      scope: _lrScopeOf(d.kind || d.loreKind),
      hardness: band === "canon" ? "hard" : "soft",
      band,
      confidence: _lrConfidenceOf(band),
      source: chapterChip(d),
      linkedEntities: _lrIds(d.relatedEntities).map((id) => ({ id, name: ctx.entityNames.get(id) || id })),
      contradictions: contradicted ? 1 : 0,
      included: d.includedInAI === true,
      lastUpdated: _lrAgo(e.updatedAt),
      note: e.summary || d.summary || "",
      raw: e,
    };
    ctx.facts.push(fact);
    if (contradicted) {
      ctx.contradictions.push({
        id: "contra-" + e.id,
        factId: e.id,
        a: { factId: e.id, source: fact.source },
        b: { source: "Flagged", text: (typeof d.contradictedBy === "string" && d.contradictedBy.trim()) || "Marked contradicted in review." },
        summary: (typeof d.contradictedBy === "string" && d.contradictedBy.trim()) || ('"' + fact.text + '" is marked contradicted.'),
        affected: fact.linkedEntities.map((x) => x.name),
        suggestion: "Pick the canonical version: keep the fact and clear the flag, or soften the band.",
        raw: e,
      });
    }
  }
  ctx.aiRules = (B.ProjectIntelService?.loadSync?.({})?.canonRules || []).filter((r) => typeof r === "string" && r.trim());
  return ctx;
};

// ---------------------------------------------------------------------
// LorePanelBody
// ---------------------------------------------------------------------
const LorePanelBody = ({ panel }) => {
  const [storeVersion, setStoreVersion] = _lr_us(0);
  React.useEffect(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:project-intel-updated", "lw:backend-ready", "lw:project-imported"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  const ctx = _lr_um(() => buildLoreContext(), [storeVersion]);

  const [scope, setScope] = _lr_us("all");
  const [view, setView] = _lr_us("facts"); // facts | contradictions | ai
  const [newRule, setNewRule] = _lr_us(null); // null | "" | text being typed
  const B = () => window.LoomwrightBackend;

  const filteredFacts = scope === "all"
    ? ctx.facts
    : ctx.facts.filter((f) => f.scope.includes(scope === "history" ? "historical" : scope));

  const updateFact = async (fact, patch) => {
    const rec = fact.raw;
    await B()?.EntityService?.update("lore", rec.id, { data: { ...(rec.data || {}), ...patch } });
  };
  const openFactEditor = (fact) => {
    _lrDispatch("lw:open-entity-editor", { type: "lore", initial: fact.raw, mode: "full" });
  };
  const saveAiRules = async (rules) => {
    const intel = B()?.ProjectIntelService?.loadSync?.({}) || {};
    await B()?.ProjectIntelService?.save({ ...intel, canonRules: rules });
    _lrDispatch("lw:project-intel-updated", {});
  };

  return (
    <div className="lore" data-ui="LorePanelBody">
      <div className="lore-bar">
        <div className="lore-bar__views">
          {[["facts","Canon facts","book"], ["contradictions","Contradictions","warn"], ["ai","AI instructions","sparkle"]].map(([id, lbl, icon]) => (
            <button key={id} className={"lore-bar__view" + (view === id ? " is-on" : "")}
                    onClick={() => setView(id)}>
              <Icon name={icon} size={10}/>
              <span>{lbl}</span>
              {id === "contradictions" && ctx.contradictions.length > 0 && (
                <span className="lore-bar__q">{ctx.contradictions.length}</span>
              )}
            </button>
          ))}
        </div>
        <button className="lore-bar__add" data-callback="onCreateCanonFact">
          <Icon name="plus" size={11}/><span>Add fact</span>
        </button>
      </div>

      {view === "facts" && (
        <div className="lore-scopes">
          {CANON_SCOPES.map((s) => (
            <button key={s.id} className={"lore-scope" + (scope === s.id ? " is-on" : "")}
                    onClick={() => setScope(s.id)}
                    style={{ "--c": s.color }}>
              <span className="lore-scope__sw"/>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="lore-body">
        {view === "facts" && (
          <div className="lore-facts">
            {filteredFacts.map((f) => (
              <article key={f.id} className={"lore-fact lore-fact--" + f.hardness} data-included={f.included}
                       data-entity-id={f.id} data-entity-type="lore">
                <div className="lore-fact__head">
                  <span className={"lore-fact__hardness lore-fact__hardness--" + f.hardness}>{f.hardness === "hard" ? "HARD CANON" : "SOFT CANON"}</span>
                  <span className="lore-fact__scope">{f.scope}</span>
                  {f.included && <span className="lore-fact__badge lore-fact__badge--include">In Project Intelligence</span>}
                  {f.contradictions > 0 && <span className="lore-fact__badge lore-fact__badge--warn">⚠ Contradiction</span>}
                  <span style={{ flex: 1 }}/>
                  <span className="lore-fact__updated">Updated {f.lastUpdated}</span>
                </div>
                <p className="lore-fact__text">{f.text}</p>
                {f.note && <p className="lore-fact__note">{f.note}</p>}
                <div className="lore-fact__foot">
                  <span className="lore-fact__source">{f.source}</span>
                  {f.linkedEntities.length > 0 && (
                    <span className="lore-fact__chips">
                      {f.linkedEntities.map((e) => (
                        <span key={e.id} className="lore-fact__chip" data-callback="onLinkCanonToEntity"
                              onClick={() => _lrDispatch("lw:open-search-result", { type: "entity", entityId: e.id, entityType: B()?.EntityService?.getSync?.(e.id)?.type })}>{e.name}</span>
                      ))}
                    </span>
                  )}
                  <span style={{ flex: 1 }}/>
                  <ConfidenceBadge level={f.confidence}/>
                </div>
                <div className="lore-fact__actions">
                  <button data-callback="onMarkHardCanon"
                          onClick={() => updateFact(f, { band: f.hardness === "hard" ? "provisional" : "canon" })}>
                    {f.hardness === "hard" ? "→ Soft" : "→ Hard"}</button>
                  <button data-callback="onEditCanonFact" onClick={() => openFactEditor(f)}>Edit</button>
                  <button data-callback="onLinkCanonToReference" onClick={() => openFactEditor(f)}>Link reference</button>
                  <button data-callback="onCopyToProjectIntelligenceFile"
                          onClick={() => { updateFact(f, { includedInAI: !f.included }); _lrNotice(f.included ? "Excluded from the AI context." : "Included in the AI context."); }}>
                    {f.included ? "Exclude from AI" : "Include in AI"}</button>
                  <button data-callback="onFlagContradiction" className="lore-fact__actions-warn"
                          onClick={() => updateFact(f, { band: "contradicted", contradictedBy: (f.raw.data && f.raw.data.contradictedBy) || "Flagged by the author." })}>Flag contradiction</button>
                </div>
              </article>
            ))}
            {filteredFacts.length === 0 && (
              <div className="lore-empty" data-ui="LoreEmpty">
                <div className="lore-empty__title">{ctx.facts.length === 0 ? "No canon facts yet" : "Nothing in this scope yet"}</div>
                <div className="lore-empty__body">Pin the rules your world must keep — add one by hand, or extract lore from your chapters.</div>
                <button className="lore-bar__add" data-callback="onCreateCanonFact">
                  <Icon name="plus" size={11}/><span>Add fact</span>
                </button>
              </div>
            )}
          </div>
        )}

        {view === "contradictions" && (
          <div className="lore-contras">
            {ctx.contradictions.map((c) => (
              <article key={c.id} className="lore-contra" data-entity-id={c.factId} data-entity-type="lore">
                <div className="lore-contra__head">
                  <Icon name="warn" size={11}/>
                  <span>Contradiction</span>
                  <span style={{ flex: 1 }}/>
                </div>
                <div className="lore-contra__split">
                  <div className="lore-contra__col">
                    <div className="lore-contra__lbl">Source A</div>
                    <div className="lore-contra__source">{c.a.source}</div>
                    <p className="lore-contra__quote">"{ctx.facts.find((f) => f.id === c.factId)?.text}"</p>
                  </div>
                  <div className="lore-contra__vs">vs</div>
                  <div className="lore-contra__col">
                    <div className="lore-contra__lbl">Source B</div>
                    <div className="lore-contra__source">{c.b.source}</div>
                    {c.b.text && <p className="lore-contra__quote">{c.b.text}</p>}
                  </div>
                </div>
                <p className="lore-contra__sum">{c.summary}</p>
                <div className="lore-contra__suggestion">
                  <Icon name="sparkle" size={10}/>
                  <span><b>Suggestion:</b> {c.suggestion}</span>
                </div>
                <div className="lore-contra__actions">
                  <button data-callback="onResolveCanonContradiction"
                          onClick={async () => {
                            await window.LoomwrightBackend?.EntityService?.update("lore", c.factId, {
                              data: { ...((c.raw && c.raw.data) || {}), band: "canon", contradictedBy: "" },
                            });
                            _lrNotice("Resolved — the fact stands as hard canon.");
                          }}>Keep as canon</button>
                  <button data-callback="onEditCanonFact"
                          onClick={() => _lrDispatch("lw:open-entity-editor", { type: "lore", initial: c.raw, mode: "full" })}>Edit</button>
                  <button data-callback="onMergeCanonFact">Merge</button>
                  <button data-callback="onDenyCanonContradiction"
                          onClick={async () => {
                            await window.LoomwrightBackend?.EntityService?.update("lore", c.factId, {
                              data: { ...((c.raw && c.raw.data) || {}), band: "provisional", contradictedBy: "" },
                            });
                            _lrNotice("Softened — the fact is provisional until you settle it.");
                          }}>Soften</button>
                </div>
              </article>
            ))}
            {ctx.contradictions.length === 0 && (
              <div className="lore-empty" data-ui="LoreContraEmpty">
                <div className="lore-empty__title">No contradictions flagged</div>
                <div className="lore-empty__body">When a canon fact gets contradicted — by you or by a continuity check — it lands here for a ruling.</div>
              </div>
            )}
          </div>
        )}

        {view === "ai" && (
          <div className="lore-ai">
            <p className="lore-ai__intro">
              These instructions are appended to the AI's context every time it generates text for this project.
            </p>
            {ctx.aiRules.map((text, ix) => (
              <div key={ix} className="lore-ai__card">
                <span className="lore-ai__bullet">▶</span>
                <p>{text}</p>
                <button data-callback="onEditCanonFact"
                        onClick={() => setNewRule({ ix, text })}>Edit</button>
                <button data-callback="onRemoveCanonFact" className="lore-ai__danger"
                        onClick={() => saveAiRules(ctx.aiRules.filter((_, i) => i !== ix))}>Remove</button>
              </div>
            ))}
            {ctx.aiRules.length === 0 && newRule === null && (
              <div className="lore-empty" data-ui="LoreAiEmpty">
                <div className="lore-empty__title">No standing AI instructions</div>
                <div className="lore-empty__body">Rules added here bind every AI generation — phrasing bans, voice constraints, things the narrator must never confirm.</div>
              </div>
            )}
            {newRule !== null ? (
              <div className="lore-ai__card lore-ai__card--edit">
                <span className="lore-ai__bullet">▶</span>
                <input autoFocus className="lore-ai__input" value={newRule.text}
                       placeholder="e.g. Never confirm the tunnel in narrator voice — frame it as rumour."
                       onChange={(e) => setNewRule({ ...newRule, text: e.target.value })}
                       onKeyDown={async (e) => {
                         if (e.key === "Escape") { setNewRule(null); return; }
                         if (e.key !== "Enter") return;
                         const text = (newRule.text || "").trim();
                         if (!text) { setNewRule(null); return; }
                         const rules = [...ctx.aiRules];
                         if (newRule.ix != null) rules[newRule.ix] = text; else rules.push(text);
                         await saveAiRules(rules);
                         setNewRule(null);
                       }}/>
                <button onClick={() => setNewRule(null)}>Cancel</button>
              </div>
            ) : (
              <button className="lore-ai__add" data-callback="onCreateCanonFact" data-testid="lore-ai-add"
                      onClick={() => setNewRule({ ix: null, text: "" })}>
                <Icon name="plus" size={11}/><span>Add AI instruction</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// References
// ---------------------------------------------------------------------
const REF_TYPE_META = {
  research:     { label: "Research",     color: "#3e6db5", icon: "book"    },
  style:        { label: "Style",        color: "#b86a82", icon: "feather" },
  image:        { label: "Image",        color: "#c97a3a", icon: "image"   },
  manuscript:   { label: "Manuscript",   color: "#5d6d4e", icon: "scroll"  },
  instructions: { label: "Instructions", color: "#c98a2c", icon: "sparkle" },
};
const _lrRefType = (kind) => {
  const k = String(kind || "").toLowerCase();
  if (REF_TYPE_META[k]) return k;
  if (/image|photo|sketch|art/.test(k)) return "image";
  if (/style|voice/.test(k)) return "style";
  if (/manuscript|draft|chapter/.test(k)) return "manuscript";
  if (/instruction|prompt|rule/.test(k)) return "instructions";
  return "research";
};
const _lrRefSize = (r) => {
  const text = typeof r.content === "string" ? r.content : "";
  if (!text) return r.size || "—";
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return words >= 1000 ? (words / 1000).toFixed(1) + "k words" : words + " words";
};

const buildRefList = () => {
  const B = (typeof window !== "undefined") && window.LoomwrightBackend;
  if (!B || !B.ReferencesService) return [];
  const names = new Map();
  const all = B.EntityService?.listAllSync?.() || {};
  for (const byId of Object.values(all)) for (const e of Object.values(byId || {})) if (e && e.id) names.set(e.id, e.name || e.id);
  return (B.ReferencesService.listSync() || [])
    .filter((r) => r && r.status !== "archived")
    .map((r) => ({
      id: r.id,
      title: r.title || "Untitled reference",
      type: _lrRefType(r.kind || r.type),
      tags: Array.isArray(r.tags) ? r.tags : [],
      linkedEntities: _lrIds(r.linkedEntities || r.linkedEntityIds).map((id) => ({ id, name: names.get(id) || id })),
      aiContext: r.aiContext !== false,
      canonSource: !!(r.canonSource || r.isCanonSource),
      styleSource: !!(r.styleSource || r.isStyleInfluence),
      lastOpened: _lrAgo(r.updatedAt || r.createdAt),
      privacy: r.privacy || "local",
      sourceState: r.pinned ? "pinned" : "active",
      size: _lrRefSize(r),
      excerpt: r.excerpt || (typeof r.content === "string" ? r.content.replace(/\s+/g, " ").slice(0, 110) : ""),
      raw: r,
    }));
};

// ---------------------------------------------------------------------
// ReferencesPanelBody
// ---------------------------------------------------------------------
const ReferencesPanelBody = ({ panel }) => {
  const [storeVersion, setStoreVersion] = _lr_us(0);
  React.useEffect(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:references-updated", "lw:entity-store-updated", "lw:backend-ready", "lw:project-imported"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  const refs = _lr_um(() => buildRefList(), [storeVersion]);

  const [filter, setFilter] = _lr_us("all");
  const [search, setSearch] = _lr_us("");
  const [tagging, setTagging] = _lr_us(null); // ref id | null
  const B = () => window.LoomwrightBackend;

  const filtered = refs.filter((r) => {
    if (filter !== "all" && r.type !== filter) return false;
    if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const saveRef = async (r, patch) => {
    await B()?.ReferencesService?.save({ ...r.raw, ...patch });
  };

  return (
    <div className="refs" data-ui="ReferencesPanelBody">
      <div className="refs-bar">
        <div className="refs-bar__search">
          <Icon name="search" size={11}/>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search references…"/>
        </div>
        <button className="refs-bar__add" data-callback="onUploadReference">
          <Icon name="plus" size={11}/><span>Upload</span>
        </button>
        <button className="refs-bar__add refs-bar__add--paste" data-callback="onPasteReference">
          <Icon name="paper" size={11}/><span>Paste</span>
        </button>
      </div>

      <div className="refs-types">
        <button className={"refs-type" + (filter === "all" ? " is-on" : "")} onClick={() => setFilter("all")}>
          <span>All</span><span className="refs-type__n">{refs.length}</span>
        </button>
        {Object.entries(REF_TYPE_META).map(([id, m]) => {
          const n = refs.filter((r) => r.type === id).length;
          return (
            <button key={id}
              className={"refs-type" + (filter === id ? " is-on" : "")}
              onClick={() => setFilter(id)}
              style={{ "--c": m.color }}>
              <Icon name={m.icon} size={10}/>
              <span>{m.label}</span>
              <span className="refs-type__n">{n}</span>
            </button>
          );
        })}
      </div>

      <div className="refs-list">
        {filtered.map((r) => {
          const t = REF_TYPE_META[r.type] || REF_TYPE_META.research;
          return (
            <article key={r.id} className="refs-card" style={{ "--c": t.color }}
                     data-entity-id={r.id} data-entity-type="references">
              <div className="refs-card__head">
                <span className="refs-card__type-dot"/>
                <span className="refs-card__type">{t.label}</span>
                <span className="refs-card__title">{r.title}</span>
                {r.privacy === "private" && <span className="refs-card__priv" title="Private — never sent to cloud">🔒</span>}
                {r.sourceState === "pinned" && <Icon name="pin-tack" size={10}/>}
              </div>
              {r.excerpt && <p className="refs-card__excerpt">{r.excerpt}</p>}
              <div className="refs-card__badges">
                {r.aiContext   && <span className="refs-card__badge refs-card__badge--ai">In AI context</span>}
                {r.canonSource && <span className="refs-card__badge refs-card__badge--canon">Canon source</span>}
                {r.styleSource && <span className="refs-card__badge refs-card__badge--style">Style ref</span>}
                {!r.aiContext  && <span className="refs-card__badge refs-card__badge--off">Excluded from AI</span>}
              </div>
              <div className="refs-card__tags">
                {r.tags.map((tag) => <span key={tag} className="refs-card__tag">#{tag}</span>)}
              </div>
              {tagging === r.id && (
                <input autoFocus className="refs-card__tag-input" placeholder="comma, separated, tags ⏎"
                       defaultValue={r.tags.join(", ")}
                       onKeyDown={async (e) => {
                         if (e.key === "Escape") { setTagging(null); return; }
                         if (e.key !== "Enter") return;
                         const tags = e.target.value.split(/[,;]+/).map((s) => s.trim()).filter(Boolean);
                         await saveRef(r, { tags });
                         setTagging(null);
                       }}/>
              )}
              {r.linkedEntities.length > 0 && (
                <div className="refs-card__entities">
                  <span className="refs-card__lbl">Linked:</span>
                  {r.linkedEntities.map((e) => (
                    <button key={e.id} className="refs-card__entity" data-callback="onOpenRelatedEntity"
                            onClick={() => _lrDispatch("lw:open-search-result", { type: "entity", entityId: e.id, entityType: window.LoomwrightBackend?.EntityService?.getSync?.(e.id)?.type })}>{e.name}</button>
                  ))}
                </div>
              )}
              <div className="refs-card__foot">
                <span>{r.size}</span>
                <span>·</span>
                <span>Last opened {r.lastOpened}</span>
                <span style={{ flex: 1 }}/>
                <div className="refs-card__actions">
                  <button data-callback="onToggleReferenceAIContext"
                          onClick={() => saveRef(r, { aiContext: !r.aiContext })}>{r.aiContext ? "Exclude" : "Include"} AI</button>
                  <button data-callback="onToggleReferenceCanonSource"
                          onClick={() => saveRef(r, { canonSource: !r.canonSource })}>Canon {r.canonSource ? "✓" : ""}</button>
                  <button data-callback="onToggleReferenceStyleSource"
                          onClick={() => saveRef(r, { styleSource: !r.styleSource, isStyleInfluence: !r.styleSource })}>Style {r.styleSource ? "✓" : ""}</button>
                  <button data-callback="onTagReference"
                          onClick={() => setTagging(tagging === r.id ? null : r.id)}>Tag</button>
                  <button data-callback="onArchiveReference" className="refs-card__actions-warn">Archive</button>
                </div>
              </div>
            </article>
          );
        })}
        {filtered.length === 0 && (
          <div className="refs-empty" data-ui="RefsEmpty">
            <Icon name="paper" size={20}/>
            <p>{refs.length === 0 ? "No references yet — Upload a file or Paste text to start your research shelf." : "No references match."}</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Sample-project reference fixtures — seeded into ReferencesService only
// when the user explicitly loads the sample project (never rendered
// directly; the panel reads the live service).
// ---------------------------------------------------------------------
const SAMPLE_REFERENCES = [
  { id: "ref1", title: "Hess Court Etiquette — research note", kind: "research",
    tags: ["worldbuilding", "hess"], aiContext: true, canonSource: true,
    content: "Audience protocol, court seating, who may speak first. Three days of audience, no more, no fewer. The petitioner stands on glass." },
  { id: "ref2", title: "Aelinor — voice profile", kind: "style",
    tags: ["voice", "aelinor", "style"], aiContext: true, styleSource: true, isStyleInfluence: true,
    content: "Reach contraction, deliberate cadence, weather metaphors. She does not use contractions of common verbs." },
  { id: "ref4", title: "Bk I draft — Ch. 11", kind: "manuscript",
    tags: ["bk1", "reference", "canon"], aiContext: true, canonSource: true, styleSource: true, pinned: true,
    content: "First Glass Audience scene — establishes the three-day rule and the petitioner's glass floor." },
  { id: "ref5", title: "Marlowe — style notes (private)", kind: "instructions",
    tags: ["author", "instructions", "style"], aiContext: true, styleSource: true, privacy: "private",
    content: "No epigraphs. Avoid prophesy unless filtered through dialogue. Keep chapters under 4k words." },
];

// ---------------------------------------------------------------------
// ActiveRefsPanelBody — the docked "Active references" panel (p-refs).
//
// The compact at-a-glance view: only references currently feeding the
// AI context (aiContext !== false). Click-through opens the full
// References panel; toggling in/out lives there.
// ---------------------------------------------------------------------
const ActiveRefsPanelBody = ({ panel }) => {
  const [tick, setTick] = React.useState(0);
  void tick;
  React.useEffect(() => {
    const refresh = () => setTick((t) => t + 1);
    window.addEventListener("lw:references-updated", refresh);
    window.addEventListener("lw:backend-ready", refresh);
    return () => {
      window.removeEventListener("lw:references-updated", refresh);
      window.removeEventListener("lw:backend-ready", refresh);
    };
  }, []);

  const active = buildRefList().filter((r) => r.aiContext);

  if (active.length === 0) {
    return (
      <EmptyState icon="paper" title="No active references"
        body="References marked 'Include in AI context' appear here — they shape what the AI knows."
        action={<Btn variant="outline" size="sm" icon="paper" data-callback="onOpenPanel"
          onClick={() => window.dispatchEvent(new CustomEvent("lw:open-panel", { detail: { kind: "references" } }))}>
          Open References</Btn>}/>
    );
  }

  return (
    <div className="panel__list" data-ui="ActiveRefsPanelBody">
      {active.map((r) => (
        <div key={r.id} className="panel__list-row" data-callback="onSelectEntity"
          title={r.title}
          onClick={() => window.dispatchEvent(new CustomEvent("lw:open-search-result", {
            detail: { type: "reference", referenceId: r.id },
          }))}>
          <Icon name={REF_TYPE_META[r.type]?.icon || "paper"} size={12}/>
          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.title}</span>
          {r.canonSource && <span className="chip chip--neutral">canon</span>}
          {r.styleSource && <span className="chip chip--neutral">style</span>}
        </div>
      ))}
    </div>
  );
};

Object.assign(window, {
  CANON_SCOPES, REF_TYPE_META, SAMPLE_REFERENCES,
  LorePanelBody, ReferencesPanelBody, ActiveRefsPanelBody,
  buildLoreContext, buildRefList,
});

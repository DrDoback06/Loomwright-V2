// =====================================================================
// lore-references.jsx — Lore / Canon panel + References panel (LIVE).
//
// Both panels share a card-list visual vocabulary but track different
// objects:
//   Lore / Canon: facts and rules the world is bound to.
//   References:  external materials (uploads, pasted text, instructions).
//
// Area 6: both panels now read the live store. Canon facts come from the
// "lore" entity collection; AI instructions from the real Project
// Intelligence canon rules + forbidden terms (the exact strings appended
// to every AI prompt). References come from ReferencesService (the same
// store onboarding seeds into) — not the old demo constant, which had
// silently become the service's fallback. All lore-* / refs-* CSS classes
// are preserved.
// =====================================================================

const { useState: _lr_us, useMemo: _lr_um, useCallback: _lr_uc, useEffect: _lr_ue } = React;

const CANON_SCOPES = [
  { id: "all",         label: "All",            color: "#76684c" },
  { id: "world",       label: "World rule",     color: "#3e6db5" },
  { id: "magic",       label: "Magic rule",     color: "#7a6aa3" },
  { id: "history",     label: "Historical",     color: "#7a5a3a" },
  { id: "cultural",    label: "Cultural",       color: "#5d6d4e" },
  { id: "language",    label: "Language",       color: "#998f78" },
  { id: "faction",     label: "Faction",        color: "#3d3a78" },
];

// ---------------------------------------------------------------------
// Live helpers
// ---------------------------------------------------------------------
const _lrB = () => (typeof window !== "undefined") && window.LoomwrightBackend;

const _lrEntityIndex = () => {
  const idx = new Map();
  const B = _lrB();
  if (!B || !B.EntityService) return idx;
  try {
    const all = B.EntityService.listAllSync() || {};
    for (const byId of Object.values(all)) {
      for (const e of Object.values(byId || {})) if (e && e.id) idx.set(e.id, e);
    }
  } catch (_) {}
  return idx;
};

// Normalise a persisted lore scope string to one of the CANON_SCOPES ids.
const _loreScope = (raw) => {
  const s = String(raw || "").toLowerCase();
  if (/world/.test(s)) return "world";
  if (/magic|arcane|spell/.test(s)) return "magic";
  if (/hist|legend|ago|era/.test(s)) return "history";
  if (/cultur|custom|social/.test(s)) return "cultural";
  if (/lang|speech|tongue/.test(s)) return "language";
  if (/faction|house|order/.test(s)) return "faction";
  return "world";
};

// ---------------------------------------------------------------------
// buildLoreModel — live canon facts (lore entities) + AI instructions
// (Project Intelligence canon rules + forbidden terms).
// ---------------------------------------------------------------------
const buildLoreModel = () => {
  const empty = { facts: [], aiInstructions: [], contradictions: [], hasBackend: false };
  const B = _lrB();
  if (!B || !B.EntityService) return empty;
  const entityIndex = _lrEntityIndex();

  // Occurrences → first source cite per lore entity.
  const firstSource = (entityId) => {
    try {
      const occs = B.OccurrenceService?.listByEntitySync?.(entityId) || [];
      const o = occs[0];
      if (o && o.chapterId) {
        const st = B.ManuscriptChapterService?.loadSync?.() || {};
        const ch = (st.chapters || []).find((c) => c.id === o.chapterId);
        if (ch) return "Ch. " + (ch.num || "?");
      }
    } catch (_) {}
    return "";
  };

  let loreEntities = [];
  try { loreEntities = B.EntityService.listSync("lore") || []; } catch (_) {}
  const facts = loreEntities.map((e) => {
    const d = e.data || {};
    const linked = (Array.isArray(d.relatedEntityIds) ? d.relatedEntityIds : (Array.isArray(d.linkedEntities) ? d.linkedEntities : []))
      .map((id) => (typeof id === "string" ? id : (id && id.id)))
      .filter(Boolean)
      .map((id) => ({ id, name: entityIndex.get(id)?.name || id }));
    const hardness = d.hardness === "hard" || d.canonical === true ? "hard" : "soft";
    return {
      id: e.id,
      text: e.summary || d.body || e.name || "Lore fragment",
      scope: d.scope || d.category || "world rule",
      scopeId: _loreScope(d.scope || d.category),
      hardness,
      confidence: d.confidence || "strong",
      source: d.source || firstSource(e.id) || "",
      linkedEntities: linked,
      included: d.includedInAI !== false,
      note: d.note || "",
    };
  });

  // AI instructions = the real strings appended to every AI prompt:
  // Project Intelligence canon rules + forbidden terms.
  const aiInstructions = [];
  try {
    const intel = B.ProjectIntelService?.loadSync?.() || {};
    (Array.isArray(intel.canonRules) ? intel.canonRules : []).forEach((r, i) => {
      if (r) aiInstructions.push({ id: "canon-" + i, text: String(r), kind: "canon" });
    });
    (Array.isArray(intel.forbidden) ? intel.forbidden : []).forEach((r, i) => {
      if (r) aiInstructions.push({ id: "forbid-" + i, text: "Never use: " + String(r), kind: "forbidden" });
    });
  } catch (_) {}

  const model = { facts, aiInstructions, contradictions: [], hasBackend: true };
  try {
    window.CANON_FACTS = facts;
    window.CANON_AI_INSTRUCTIONS = aiInstructions;
    window.CANON_CONTRADICTIONS = model.contradictions;
  } catch (_) {}
  return model;
};

const _loreUpdateData = async (id, patch) => {
  const B = _lrB();
  if (!B) return;
  const e = B.EntityService.getSync(id, "lore");
  if (!e) return;
  await B.EntityService.update("lore", id, { data: { ...(e.data || {}), ...patch } });
};
const _loreOpenEditor = (id) => window.dispatchEvent(new CustomEvent("lw:open-entity-editor", { detail: { type: "lore", initial: { id }, mode: "full" } }));

// ---------------------------------------------------------------------
// LorePanelBody (LIVE)
// ---------------------------------------------------------------------
const LorePanelBody = ({ panel }) => {
  const [storeVersion, setStoreVersion] = _lr_us(0);
  _lr_ue(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:entity-store-updated", "lw:project-intel-updated", "lw:occurrences-updated", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  const model = _lr_um(() => buildLoreModel(), [storeVersion]);

  const [scope, setScope] = _lr_us("all");
  const [view, setView] = _lr_us("facts"); // facts | contradictions | ai

  const filteredFacts = scope === "all" ? model.facts : model.facts.filter((f) => f.scopeId === scope);

  return (
    <div className="lore" data-ui="LorePanelBody" data-entity-type="lore">
      <div className="lore-bar">
        <div className="lore-bar__views">
          {[["facts","Canon facts","book"], ["contradictions","Contradictions","warn"], ["ai","AI instructions","sparkle"]].map(([id, lbl, icon]) => (
            <button key={id} className={"lore-bar__view" + (view === id ? " is-on" : "")}
                    onClick={() => setView(id)}>
              <Icon name={icon} size={10}/>
              <span>{lbl}</span>
              {id === "contradictions" && model.contradictions.length > 0 && (
                <span className="lore-bar__q">{model.contradictions.length}</span>
              )}
              {id === "ai" && model.aiInstructions.length > 0 && (
                <span className="lore-bar__q">{model.aiInstructions.length}</span>
              )}
            </button>
          ))}
        </div>
        <button className="lore-bar__add" data-callback="onCreateCanonFact">
          <Icon name="plus" size={11}/><span>Add fact</span>
        </button>
      </div>

      {view === "facts" && model.facts.length > 0 && (
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
            {model.facts.length === 0 && (
              <div className="refs-empty" style={{ padding: 24 }}>
                <Icon name="book" size={20}/>
                <p>No canon facts yet. Add one, or extract lore from the manuscript — the world rules you pin here are fed to the AI.</p>
              </div>
            )}
            {filteredFacts.map((f) => (
              <article key={f.id} className={"lore-fact lore-fact--" + f.hardness} data-included={f.included}>
                <div className="lore-fact__head">
                  <span className={"lore-fact__hardness lore-fact__hardness--" + f.hardness}>{f.hardness === "hard" ? "HARD CANON" : "SOFT CANON"}</span>
                  <span className="lore-fact__scope">{f.scope}</span>
                  {f.included && <span className="lore-fact__badge lore-fact__badge--include">In Project Intelligence</span>}
                  <span style={{ flex: 1 }}/>
                </div>
                <p className="lore-fact__text">{f.text}</p>
                {f.note && <p className="lore-fact__note">{f.note}</p>}
                <div className="lore-fact__foot">
                  {f.source && <span className="lore-fact__source">{f.source}</span>}
                  {f.linkedEntities.length > 0 && (
                    <span className="lore-fact__chips">
                      {f.linkedEntities.map((e) => (
                        <span key={e.id} className="lore-fact__chip"
                              onClick={() => window.dispatchEvent(new CustomEvent("lw:focus-entity", { detail: { entityId: e.id, label: e.name } }))}>{e.name}</span>
                      ))}
                    </span>
                  )}
                  <span style={{ flex: 1 }}/>
                  {typeof ConfidenceBadge !== "undefined" && <ConfidenceBadge level={f.confidence}/>}
                </div>
                <div className="lore-fact__actions">
                  <button onClick={() => _loreUpdateData(f.id, { hardness: f.hardness === "hard" ? "soft" : "hard" })}>{f.hardness === "hard" ? "→ Soft" : "→ Hard"}</button>
                  <button onClick={() => _loreOpenEditor(f.id)}>Edit</button>
                  <button onClick={() => _loreUpdateData(f.id, { includedInAI: !f.included })}>{f.included ? "Exclude from AI" : "Include in AI"}</button>
                </div>
              </article>
            ))}
          </div>
        )}

        {view === "contradictions" && (
          <div className="lore-contras">
            <div className="refs-empty" style={{ padding: 24 }}>
              <Icon name="warn" size={20}/>
              <p>No contradictions detected. When canon facts disagree across chapters, they'll surface here to reconcile.</p>
            </div>
          </div>
        )}

        {view === "ai" && (
          <div className="lore-ai">
            <p className="lore-ai__intro">
              These instructions are appended to the AI's context every time it generates text for this project.
              Edit them in onboarding / Project Intelligence.
            </p>
            {model.aiInstructions.length === 0 && (
              <div className="refs-empty" style={{ padding: 16 }}>
                <Icon name="sparkle" size={18}/>
                <p>No AI instructions yet. Add canon rules or forbidden terms in onboarding to steer every generation.</p>
              </div>
            )}
            {model.aiInstructions.map((i) => (
              <div key={i.id} className="lore-ai__card">
                <span className="lore-ai__bullet">▶</span>
                <p>{i.text}</p>
              </div>
            ))}
            <button className="lore-ai__add" onClick={() => window.dispatchEvent(new CustomEvent("lw:open-onboarding-answers", { detail: { sectionId: "world" } }))}>
              <Icon name="plus" size={11}/><span>Add AI instruction</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// References — type metadata + live-kind normalisation.
// ---------------------------------------------------------------------
const REF_TYPE_META = {
  research:     { label: "Research",     color: "#3e6db5", icon: "book"    },
  style:        { label: "Style",        color: "#b86a82", icon: "feather" },
  image:        { label: "Image",        color: "#c97a3a", icon: "image"   },
  manuscript:   { label: "Manuscript",   color: "#5d6d4e", icon: "scroll"  },
  instructions: { label: "Instructions", color: "#c98a2c", icon: "sparkle" },
  note:         { label: "Note",         color: "#7a6aa3", icon: "paper"   },
  canon:        { label: "Canon",        color: "#7a5a3a", icon: "book"    },
  url:          { label: "Link",         color: "#3d7a78", icon: "link"    },
};
// Map a stored reference `kind` (which can be a callback name like
// "onPasteReference", or "pasted"/"note"/…) to a REF_TYPE_META key.
const _refTypeKey = (kind) => {
  const k = String(kind || "").toLowerCase();
  if (REF_TYPE_META[k]) return k;
  if (/paste|note|text/.test(k)) return "note";
  if (/upload|research|doc/.test(k)) return "research";
  if (/url|link/.test(k)) return "url";
  if (/style|voice/.test(k)) return "style";
  if (/image|photo|img/.test(k)) return "image";
  if (/manuscript|draft/.test(k)) return "manuscript";
  if (/instruction/.test(k)) return "instructions";
  if (/canon/.test(k)) return "canon";
  return "research";
};
const _refWordCount = (s) => {
  const n = String(s || "").trim().split(/\s+/).filter(Boolean).length;
  return n ? (n >= 1000 ? (n / 1000).toFixed(1) + "k words" : n + " words") : "";
};

const buildReferencesModel = () => {
  const B = _lrB();
  if (!B || !B.ReferencesService) return { refs: [], hasBackend: false };
  const entityIndex = _lrEntityIndex();
  let raw = [];
  try { raw = B.ReferencesService.listSync() || []; } catch (_) {}
  const refs = raw
    .filter((r) => r && r.status !== "archived")
    .map((r) => {
      const typeKey = _refTypeKey(r.kind || r.type);
      const linked = (Array.isArray(r.linkedEntities) ? r.linkedEntities : [])
        .map((id) => (typeof id === "string" ? id : (id && id.id)))
        .filter(Boolean)
        .map((id) => ({ id, name: entityIndex.get(id)?.name || id }));
      return {
        id: r.id,
        title: r.title || r.name || "Untitled reference",
        typeKey,
        aiContext: r.aiContext ?? r.includedInAIContext ?? true,
        canonSource: !!(r.isCanonSource || r.canonSource || r.kind === "canon"),
        styleSource: !!(r.isStyleInfluence || r.styleSource || r.kind === "style"),
        privacy: r.privacy || (r.isPrivate ? "private" : "local"),
        pinned: r.sourceState === "pinned" || r.pinned === true,
        excerpt: r.excerpt || String(r.content || "").slice(0, 160),
        size: r.size || _refWordCount(r.content),
        tags: Array.isArray(r.tags) ? r.tags : [],
        linkedEntities: linked,
        _raw: r,
      };
    });
  return { refs, hasBackend: true };
};

const _refSave = async (patch) => {
  const B = _lrB();
  if (B && B.ReferencesService) await B.ReferencesService.save(patch);
};

// ---------------------------------------------------------------------
// ReferencesPanelBody (LIVE)
// ---------------------------------------------------------------------
const ReferencesPanelBody = ({ panel }) => {
  const [storeVersion, setStoreVersion] = _lr_us(0);
  _lr_ue(() => {
    const bump = () => setStoreVersion((v) => v + 1);
    const evs = ["lw:references-updated", "lw:entity-store-updated", "lw:backend-ready"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  const model = _lr_um(() => buildReferencesModel(), [storeVersion]);

  const [filter, setFilter] = _lr_us("all");
  const [search, setSearch] = _lr_us("");

  // Kinds that actually exist in the live references (for the type chips).
  const kindsPresent = _lr_um(() => {
    const set = new Set();
    for (const r of model.refs) set.add(r.typeKey);
    return [...set];
  }, [model]);

  const filtered = model.refs.filter((r) => {
    if (filter !== "all" && r.typeKey !== filter) return false;
    if (search && !(r.title.toLowerCase().includes(search.toLowerCase()) || r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())))) return false;
    return true;
  });

  return (
    <div className="refs" data-ui="ReferencesPanelBody" data-entity-type="references">
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
          <span>All</span><span className="refs-type__n">{model.refs.length}</span>
        </button>
        {kindsPresent.map((id) => {
          const m = REF_TYPE_META[id] || REF_TYPE_META.research;
          const n = model.refs.filter((r) => r.typeKey === id).length;
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
          const t = REF_TYPE_META[r.typeKey] || REF_TYPE_META.research;
          return (
            <article key={r.id} className="refs-card" style={{ "--c": t.color }}>
              <div className="refs-card__head">
                <span className="refs-card__type-dot"/>
                <span className="refs-card__type">{t.label}</span>
                <span className="refs-card__title">{r.title}</span>
                {r.privacy === "private" && <span className="refs-card__priv" title="Private — never sent to cloud">🔒</span>}
                {r.pinned && <Icon name="pin-tack" size={10}/>}
              </div>
              {r.excerpt && <p className="refs-card__excerpt">{r.excerpt}</p>}
              <div className="refs-card__badges">
                {r.aiContext   && <span className="refs-card__badge refs-card__badge--ai">In AI context</span>}
                {r.canonSource && <span className="refs-card__badge refs-card__badge--canon">Canon source</span>}
                {r.styleSource && <span className="refs-card__badge refs-card__badge--style">Style ref</span>}
                {!r.aiContext  && <span className="refs-card__badge refs-card__badge--off">Excluded from AI</span>}
              </div>
              {r.tags.length > 0 && (
                <div className="refs-card__tags">
                  {r.tags.map((tag) => <span key={tag} className="refs-card__tag">#{tag}</span>)}
                </div>
              )}
              {r.linkedEntities.length > 0 && (
                <div className="refs-card__entities">
                  <span className="refs-card__lbl">Linked:</span>
                  {r.linkedEntities.map((e) => (
                    <button key={e.id} className="refs-card__entity"
                            onClick={() => window.dispatchEvent(new CustomEvent("lw:focus-entity", { detail: { entityId: e.id, label: e.name } }))}>{e.name}</button>
                  ))}
                </div>
              )}
              <div className="refs-card__foot">
                {r.size && <><span>{r.size}</span><span>·</span></>}
                <span className="refs-card__lbl">{t.label}</span>
                <span style={{ flex: 1 }}/>
                <div className="refs-card__actions">
                  <button onClick={() => _refSave({ ...r._raw, aiContext: !r.aiContext })}>{r.aiContext ? "Exclude" : "Include"} AI</button>
                  <button onClick={() => _refSave({ ...r._raw, isCanonSource: !r.canonSource })}>Canon {r.canonSource ? "✓" : ""}</button>
                  <button onClick={() => _refSave({ ...r._raw, isStyleInfluence: !r.styleSource })}>Style {r.styleSource ? "✓" : ""}</button>
                  <button onClick={() => _refSave({ ...r._raw, status: "archived" })} className="refs-card__actions-warn">Archive</button>
                </div>
              </div>
            </article>
          );
        })}
        {model.refs.length === 0 && (
          <div className="refs-empty">
            <Icon name="paper" size={20}/>
            <p>No references yet. Upload or paste research, style notes, or manuscript excerpts — the ones you mark "In AI context" steer every generation.</p>
          </div>
        )}
        {model.refs.length > 0 && filtered.length === 0 && (
          <div className="refs-empty">
            <Icon name="paper" size={20}/>
            <p>No references match.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Live diagnostics defaults (app.jsx reads .length). Do NOT seed
// window.REFERENCES with demo data — it is ReferencesService's fallback.
window.CANON_FACTS = window.CANON_FACTS || [];
window.CANON_CONTRADICTIONS = window.CANON_CONTRADICTIONS || [];
window.CANON_AI_INSTRUCTIONS = window.CANON_AI_INSTRUCTIONS || [];
window.REFERENCES = window.REFERENCES || [];

Object.assign(window, {
  CANON_SCOPES, REF_TYPE_META, buildLoreModel, buildReferencesModel,
  LorePanelBody, ReferencesPanelBody,
});

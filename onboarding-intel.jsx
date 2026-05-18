// =====================================================================
// onboarding-intel.jsx — New modules layered onto the wizard:
//   StepJsonTools (side drawer + handle), JsonValidationState,
//   JsonImportPreview, MultiChoiceOptionGroup, CardChoiceGrid,
//   RankedChoiceInput, ProjectIntelligencePanel (replaces LearnedSoFar),
//   ProjectIntelligenceFileModal, ProjectPortrait, IntelSaveIndicator.
// =====================================================================

const { useState: _us_pi, useMemo: _um_pi, useEffect: _ue_pi, useRef: _ur_pi } = React;

// ---------------------------------------------------------------------
// IntelSaveIndicator — small pill shown above each step header,
// confirming what gets written to the Intelligence File on this step.
// ---------------------------------------------------------------------
const IntelSaveIndicator = ({ category, keys = [] }) => (
  <div className="ob-saveind" title={`Saving to project-intelligence.json → ${category}`}>
    <Icon name="bookmark" size={10}/>
    Saving to <span style={{ fontWeight: 700 }}>intelligence.{category}</span>
    {keys.length > 0 && <span style={{ opacity: 0.75 }}>· {keys.length} keys</span>}
  </div>
);

// ---------------------------------------------------------------------
// JsonValidationState — pill that summarises status for the drawer head
// ---------------------------------------------------------------------
const JsonValidationState = ({ kind = "empty", text }) => {
  const labels = {
    empty:    "Awaiting paste",
    valid:    "Valid · ready to apply",
    invalid:  "Invalid JSON",
    partial:  "Partial — some keys",
    conflict: "Conflict with existing data",
    preview:  "Preview ready",
    applied:  "Applied to project",
  };
  const icons = {
    empty: "paper", valid: "check", invalid: "warn",
    partial: "clock", conflict: "warn", preview: "eye", applied: "check",
  };
  return (
    <span className={"ob-jsonstate ob-jsonstate--" + kind}>
      <Icon name={icons[kind] || "paper"} size={10}/>
      {text || labels[kind]}
    </span>
  );
};

// ---------------------------------------------------------------------
// JsonImportPreview — diff-style preview of what an applied JSON
// would change in the project intelligence file
// ---------------------------------------------------------------------
const JsonImportPreview = ({ parsed, current = {} }) => {
  if (!parsed || typeof parsed !== "object") return null;
  const rows = Object.entries(parsed).slice(0, 12).map(([k, v]) => {
    const prev = current[k];
    let diff = "add";
    if (prev !== undefined && prev !== null && prev !== "") {
      diff = JSON.stringify(prev) === JSON.stringify(v) ? "keep" : "chg";
    }
    const display = Array.isArray(v) ? v.join(", ") : (typeof v === "object" ? JSON.stringify(v) : String(v));
    return { k, v: display, diff };
  });
  return (
    <div className="ob-jsonprev">
      <div className="ob-jsonprev__title">Will write {rows.length} keys</div>
      {rows.map((r) => (
        <div key={r.k} className="ob-jsonprev__row">
          <span className="ob-jsonprev__row__k">{r.k}</span>
          <span className="ob-jsonprev__row__v">{r.v || <em style={{ color: "var(--ink-4)" }}>—</em>}</span>
          <span className={"ob-jsonprev__row__diff ob-jsonprev__row__diff--" + r.diff}>
            {r.diff === "add" ? "+ new" : r.diff === "chg" ? "↻ change" : "= same"}
          </span>
        </div>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// StepJsonTools — Right-edge drawer with prompt copy + paste/import.
// Renders a vertical handle when closed; full panel when open.
// ---------------------------------------------------------------------
const StepJsonTools = ({
  category,
  prompt,
  current,
  onCopyStepJsonPrompt,
  onPasteStepJson,
  onApplyStepJson,
  onOpenIntelFile,
}) => {
  const [open, setOpen]     = _us_pi(false);
  const [tab, setTab]       = _us_pi("paste"); // "prompt" | "paste" | "preview"
  const [text, setText]     = _us_pi("");
  const [status, setStatus] = _us_pi({ kind: "empty" });
  const [parsed, setParsed] = _us_pi(null);
  const [copied, setCopied] = _us_pi(false);

  const tryParse = (val) => {
    setText(val);
    if (!val.trim()) { setStatus({ kind: "empty" }); setParsed(null); return; }
    try {
      const obj = JSON.parse(val);
      setParsed(obj);
      const keys = Object.keys(obj || {});
      const overlap = keys.filter((k) => current?.[k] !== undefined && current?.[k] !== "" && JSON.stringify(current?.[k]) !== JSON.stringify(obj[k]));
      if (keys.length === 0) {
        setStatus({ kind: "invalid", text: "Empty object" });
      } else if (overlap.length > 0) {
        setStatus({ kind: "conflict", text: `Conflicts with ${overlap.length} key(s)` });
      } else {
        setStatus({ kind: "valid", text: keys.length + " keys parsed" });
      }
      onPasteStepJson && onPasteStepJson({ category, parsed: obj, status: "valid" });
    } catch (e) {
      setStatus({ kind: "invalid", text: e.message?.slice(0, 60) || "Parse error" });
      setParsed(null);
    }
  };

  const doCopyPrompt = () => {
    try { navigator.clipboard?.writeText(prompt); } catch (e) {}
    setCopied(true);
    onCopyStepJsonPrompt && onCopyStepJsonPrompt({ category, prompt });
    setTimeout(() => setCopied(false), 1600);
  };

  const apply = () => {
    if (!parsed) return;
    onApplyStepJson && onApplyStepJson({ category, parsed });
    setStatus({ kind: "applied", text: "Applied to project" });
  };

  if (!open) {
    return (
      <button
        type="button"
        className="ob-jsontab__handle"
        onClick={() => setOpen(true)}
        style={{ position: "absolute", right: 0, top: 96, zIndex: 30 }}
        data-callback="onOpenStepJsonDrawer"
      >
        <Icon name="paper" size={11}/>
        JSON tools
      </button>
    );
  }

  return (
    <div className={"ob-jsondrawer is-open"} data-ui="StepJsonTools" data-callback="onOpenStepJsonDrawer">
      <div className="ob-jsondrawer__head">
        <button type="button" className="ob-jsondrawer__close" onClick={() => setOpen(false)} aria-label="Close drawer">
          <Icon name="x" size={12}/>
        </button>
        <div className="ob-jsondrawer__eyebrow">JSON tools · {category}</div>
        <div className="ob-jsondrawer__title">Fill this step from a chat</div>
        <div className="ob-jsondrawer__sub">Copy the prompt to ChatGPT or Claude, then paste the JSON back here. Loomwright never auto-sends.</div>
      </div>
      <div className="ob-jsondrawer__tabs">
        <button type="button" className={"ob-jsondrawer__tab " + (tab === "prompt" ? "is-active" : "")} onClick={() => setTab("prompt")}>
          <Icon name="sparkle" size={10}/>Copy prompt
        </button>
        <button type="button" className={"ob-jsondrawer__tab " + (tab === "paste" ? "is-active" : "")} onClick={() => setTab("paste")}>
          <Icon name="paper" size={10}/>Paste JSON
        </button>
        <button type="button" className={"ob-jsondrawer__tab " + (tab === "preview" ? "is-active" : "")} onClick={() => setTab("preview")} disabled={!parsed}>
          <Icon name="eye" size={10}/>Preview
        </button>
      </div>
      <div className="ob-jsondrawer__body">
        {tab === "prompt" && (
          <>
            <textarea className="ob-textarea ob-textarea--mono" readOnly value={prompt} rows={14}/>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Btn variant="primary" size="sm" icon="paper" onClick={doCopyPrompt} data-callback="onCopyStepJsonPrompt">
                {copied ? "Copied" : "Copy prompt"}
              </Btn>
              <span style={{ fontSize: "var(--fs-xs)", color: "var(--ink-3)" }}>Then paste the JSON reply in the next tab.</span>
            </div>
          </>
        )}

        {tab === "paste" && (
          <>
            <Field label={`Paste JSON for ${category}`} hint="Loomwright will validate, then preview a diff before writing.">
              <textarea
                className="ob-textarea ob-textarea--mono"
                placeholder={'{ "premise": "..." }'}
                rows={14}
                value={text}
                onChange={(e) => tryParse(e.target.value)}
                data-callback="onPasteStepJson"
              />
            </Field>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <JsonValidationState kind={status.kind} text={status.text}/>
              {status.kind === "valid" && (
                <Btn variant="ghost" size="sm" icon="eye" onClick={() => setTab("preview")}>See preview</Btn>
              )}
              {status.kind === "conflict" && (
                <Btn variant="ghost" size="sm" icon="eye" onClick={() => setTab("preview")}>Resolve in preview</Btn>
              )}
            </div>
          </>
        )}

        {tab === "preview" && parsed && (
          <>
            <JsonImportPreview parsed={parsed} current={current}/>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <Btn variant="primary" size="sm" icon="check" onClick={apply} data-callback="onApplyStepJson">Apply to project</Btn>
              <Btn variant="ghost" size="sm" icon="x" onClick={() => { setText(""); setParsed(null); setStatus({ kind: "empty" }); setTab("paste"); }}>Discard</Btn>
            </div>
          </>
        )}
      </div>
      <div className="ob-jsondrawer__foot">
        <span>Writes to project-intelligence.json · {category}</span>
        <div className="ob-jsondrawer__foot__btns">
          <Btn variant="ghost" size="xs" icon="bookmark" onClick={onOpenIntelFile} data-callback="onOpenIntelFile">View file</Btn>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// MultiChoiceOptionGroup — chip group + meta options
//   variant="chip" | "card"
// ---------------------------------------------------------------------
const MultiChoiceOptionGroup = ({
  options = [],
  value = [],
  onChange,
  variant = "chip",
  notSure = true,
  suggestLater = true,
  allowCustom = true,
  metaState = {},
  onMetaChange,
  callback,
}) => {
  const [adding, setAdding]   = _us_pi(false);
  const [draft, setDraft]     = _us_pi("");
  const isOn = (o) => value.includes(o);
  const toggle = (o) => {
    const set = new Set(value);
    set.has(o) ? set.delete(o) : set.add(o);
    onChange && onChange([...set]);
  };
  const addCustom = () => {
    const t = draft.trim();
    if (!t) { setAdding(false); return; }
    if (!value.includes(t)) onChange && onChange([...value, t]);
    setDraft(""); setAdding(false);
  };

  const meta = (k) => {
    const next = { ...metaState, [k]: !metaState[k] };
    onMetaChange && onMetaChange(next);
  };

  if (variant === "card") {
    return (
      <div data-callback={callback}>
        <div className="ob-mcgrid">
          {options.map((o) => {
            const opt = typeof o === "string" ? { id: o, label: o } : o;
            const on = isOn(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                className={"ob-mccard " + (on ? "is-on" : "")}
                onClick={() => toggle(opt.id)}
                data-callback={callback}
              >
                <span className="ob-mccard__seal"><Icon name="check" size={10}/></span>
                <span className="ob-mccard__label">{opt.label}</span>
                {opt.sub && <span className="ob-mccard__sub">{opt.sub}</span>}
              </button>
            );
          })}
        </div>
        <div className="ob-mcmeta">
          {notSure && (
            <button type="button" className={"ob-mcmeta__pill " + (metaState.notSure ? "is-on" : "")} onClick={() => meta("notSure")}>
              <Icon name="warn" size={10}/> Not sure yet
            </button>
          )}
          {suggestLater && (
            <button type="button" className={"ob-mcmeta__pill " + (metaState.suggestLater ? "is-on" : "")} onClick={() => meta("suggestLater")}>
              <Icon name="sparkle" size={10}/> Suggest after I write
            </button>
          )}
          {allowCustom && !adding && (
            <button type="button" className="ob-mcmeta__add" onClick={() => setAdding(true)}>
              <Icon name="plus" size={10}/> Add custom
            </button>
          )}
          {allowCustom && adding && (
            <span className="ob-mcmeta__add">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } if (e.key === "Escape") setAdding(false); }}
                onBlur={addCustom}
                placeholder="type and ↵"
              />
            </span>
          )}
        </div>
      </div>
    );
  }

  // chip variant
  return (
    <div data-callback={callback}>
      <div className="ob-pillrow">
        {options.map((o) => {
          const opt = typeof o === "string" ? { id: o, label: o } : o;
          return (
            <button
              key={opt.id}
              type="button"
              className={"ob-pill " + (isOn(opt.id) ? "is-on" : "")}
              onClick={() => toggle(opt.id)}
            >{opt.label}</button>
          );
        })}
      </div>
      <div className="ob-mcmeta">
        {notSure && (
          <button type="button" className={"ob-mcmeta__pill " + (metaState.notSure ? "is-on" : "")} onClick={() => meta("notSure")}>
            <Icon name="warn" size={10}/> Not sure yet
          </button>
        )}
        {suggestLater && (
          <button type="button" className={"ob-mcmeta__pill " + (metaState.suggestLater ? "is-on" : "")} onClick={() => meta("suggestLater")}>
            <Icon name="sparkle" size={10}/> Suggest after I write
          </button>
        )}
        {allowCustom && !adding && (
          <button type="button" className="ob-mcmeta__add" onClick={() => setAdding(true)}>
            <Icon name="plus" size={10}/> Add custom
          </button>
        )}
        {allowCustom && adding && (
          <span className="ob-mcmeta__add">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } if (e.key === "Escape") setAdding(false); }}
              onBlur={addCustom}
              placeholder="type and ↵"
            />
          </span>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// RankedChoiceInput — drag-handle + numeric badges, up/down buttons.
// ---------------------------------------------------------------------
const RankedChoiceInput = ({ items = [], onChange, callback }) => {
  const move = (idx, dir) => {
    const next = [...items];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    onChange && onChange(next);
  };
  return (
    <div className="ob-ranked" data-callback={callback}>
      {items.map((it, idx) => {
        const opt = typeof it === "string" ? { id: it, label: it } : it;
        return (
          <div key={opt.id} className={"ob-ranked__item " + (idx === 0 ? "is-rank-1" : "")}>
            <span className="ob-ranked__handle" aria-label="Drag to reorder"><Icon name="grip" size={12}/></span>
            <span className="ob-ranked__num">{idx + 1}</span>
            <span>
              <span className="ob-ranked__lbl">{opt.label}</span>
              {opt.sub && <span className="ob-ranked__sub" style={{ display: "block" }}>{opt.sub}</span>}
            </span>
            <span className="ob-ranked__btns">
              <button type="button" className="ob-ranked__btn" onClick={() => move(idx, -1)} disabled={idx === 0} aria-label="Move up">↑</button>
              <button type="button" className="ob-ranked__btn" onClick={() => move(idx, +1)} disabled={idx === items.length - 1} aria-label="Move down">↓</button>
            </span>
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------
// ProjectIntelligencePanel — replaces LearnedSoFarPanel.
// Sticky header (meter + 4 actions + warnings) above the existing groups.
// ---------------------------------------------------------------------
const ProjectIntelligencePanel = ({ data, percent, conflicts = [], onOpenIntelFile, onExportIntelFile, onResetIntel, onUndoLast }) => {
  // counts
  const factCount =
    (data.foundation?.themes?.length || 0) +
    (data.foundation?.toneWords?.length || 0) +
    (data.world?.canonRules?.length || 0) +
    (data.world?.forbidden?.length || 0) +
    (data.cast?.seeds?.length || 0) +
    (data.plot?.beats?.length || 0) +
    (data.references?.items?.length || 0);

  const hint = percent < 30
    ? "Just getting started — keep going."
    : percent < 60
    ? "Half-built. The shape is showing."
    : percent < 90
    ? "Solid. Most of the binding is set."
    : "Ready. The book has its skeleton.";

  return (
    <aside className="ob__learned" data-ui="ProjectIntelligencePanel">
      <div className="ob__intel__sticky">
        <div className="ob__intel__meter">
          <div className="ob__intel__meter__top">
            <span>Project intelligence</span>
            <span className="ob__intel__meter__pct">{percent}%</span>
          </div>
          <div className="ob__intel__meter__bar"><span style={{ width: percent + "%" }}/></div>
          <div className="ob__intel__meter__hint">{hint} · <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink-3)" }}>{factCount} facts captured</span></div>
        </div>

        {conflicts.length > 0 && (
          <div className="ob__intel__warn">
            <span className="ob__intel__warn__icon"><Icon name="warn" size={12}/></span>
            <div>
              <strong>{conflicts.length} conflict{conflicts.length > 1 ? "s" : ""}</strong> in your answers.
              <div style={{ fontSize: "var(--fs-2xs)", color: "var(--ink-3)", marginTop: 2 }}>{conflicts[0]}</div>
            </div>
          </div>
        )}

        <div className="ob__intel__actions">
          <button type="button" className="ob__intel__act ob__intel__act--primary" onClick={onOpenIntelFile} data-callback="onOpenIntelFile">
            <Icon name="bookmark" size={11}/> Open intelligence file
          </button>
          <button type="button" className="ob__intel__act" onClick={onExportIntelFile} data-callback="onExportIntelFile">
            <Icon name="paper" size={10}/> Export
          </button>
          <button type="button" className="ob__intel__act" onClick={onUndoLast} data-callback="onUndoLastIntel">
            <Icon name="arrow-left" size={10}/> Undo
          </button>
          <button type="button" className="ob__intel__act" onClick={onResetIntel} data-callback="onResetIntel" style={{ gridColumn: "span 2" }}>
            <Icon name="x" size={10}/> Reset to defaults
          </button>
        </div>
      </div>

      {/* keep existing learned-summary body for continuity */}
      <LearnedSoFarPanel data={data} embedded/>
    </aside>
  );
};

// ---------------------------------------------------------------------
// ProjectIntelligenceFileModal — full-screen overlay
// Card-catalogue: left tabs · main reader (or raw / portrait) · right meta
// ---------------------------------------------------------------------
const PIF_CATEGORIES = [
  { id: "portrait",   group: "OVERVIEW", num: "—",  label: "Project portrait" },
  { id: "welcome",    group: "OVERVIEW", num: "01", label: "Project setup" },
  { id: "foundation", group: "STORY",    num: "02", label: "Story foundation" },
  { id: "style",      group: "STORY",    num: "03", label: "Style profile" },
  { id: "voice",      group: "STORY",    num: "04", label: "Voice sample" },
  { id: "world",      group: "WORLD",    num: "05", label: "World & canon" },
  { id: "cast",       group: "WORLD",    num: "06", label: "Cast seeds" },
  { id: "rpg",        group: "WORLD",    num: "07", label: "Tracking systems" },
  { id: "plot",       group: "WORLD",    num: "08", label: "Plot roadmap" },
  { id: "manuscript", group: "LIBRARY",  num: "09", label: "Manuscript" },
  { id: "references", group: "LIBRARY",  num: "10", label: "References" },
  { id: "ai",         group: "TRUST",    num: "11", label: "AI & privacy" },
  { id: "review",     group: "TRUST",    num: "12", label: "Review rules" },
  { id: "workspace",  group: "TRUST",    num: "13", label: "Workspace" },
];

const PIF_KV_LABELS = {
  welcome:    { title: "Title", series: "Series", book: "Book", format: "Format", genre: "Genre", subgenre: "Subgenre", audience: "Audience", length: "Length", stage: "Stage", start: "Start mode" },
  foundation: { premise: "Premise", logline: "Logline", coreConflict: "Core conflict", themes: "Themes", toneWords: "Tone words", comparables: "Comparables", isNot: "What it isn't", pov: "POV", tense: "Tense", readerExperience: "Reader experience" },
  style:      { dials: "Style dials", narratorTone: "Narrator tone", avoid: "Avoid", signature: "Signatures" },
  voice:      { sample: "Voice sample", samples: "Additional samples", primary: "Primary?", analyzed: "Analyzed?" },
  world:      { worldType: "World type", magic: "Magic", politics: "Politics", factions: "Factions", locations: "Locations", history: "History", canonRules: "Canon rules", forbidden: "Forbidden", terminology: "Terminology" },
  cast:       { seeds: "Cast seeds" },
  rpg:        { template: "Template", suggestExamples: "Suggest examples", toggles: "Tracking toggles" },
  plot:       { beats: "Beats", targetChapters: "Target chapters" },
  manuscript: { mode: "Mode", chapters: "Chapters", autoDetect: "Auto-detect breaks", manualSplit: "Manual split", reserve: "Reserve memory", runExtraction: "Run extraction" },
  references: { items: "Items", pasteTitle: "Paste title", pasteText: "Paste text" },
  ai:         { mode: "Privacy mode", provider: "Provider", storeLocal: "Store locally", allowEgress: "Allow egress", key: "API key", validation: "Validation status" },
  review:     { autoAddHigh: "Auto-add high-confidence", showAutoInQueue: "Show auto in queue", aggressiveness: "Aggressiveness", falsePositive: "False-positive tolerance", missingTolerance: "Missing tolerance", queueDisplay: "Queue display", scan: "Scan types" },
  workspace:  { startTab: "Start tab", editorWidth: "Editor width", font: "Font", margins: "Margins", panelStack: "Panel stack", focus: "Focus mode", themeIntensity: "Theme intensity", chapterRail: "Chapter rail", authorAttribution: "Author attribution", mobileCompact: "Mobile compact" },
};

const fmtVal = (v) => {
  if (v === undefined || v === null || v === "") return <em>not set</em>;
  if (Array.isArray(v)) return v.length === 0 ? <em>none</em> : v.join(", ");
  if (typeof v === "object") {
    const entries = Object.entries(v);
    if (entries.length === 0) return <em>none</em>;
    return entries.map(([k, val]) => `${k}: ${val}`).join(" · ");
  }
  if (typeof v === "boolean") return v ? "yes" : "no";
  return String(v);
};

// crude JSON syntax highlighter for the raw view
const highlightJson = (json) => {
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return esc(json)
    .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")\s*:/g, '<span class="k">$1</span>:')
    .replace(/: ("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*")/g, ': <span class="s">$1</span>')
    .replace(/: (true|false)/g, ': <span class="b">$1</span>')
    .replace(/: (-?\d+\.?\d*)/g, ': <span class="n">$1</span>');
};

const ProjectIntelligenceFileModal = ({ data, percent, onClose, onExportIntelFile, onCopyIntelFile }) => {
  const [activeId, setActiveId] = _us_pi("portrait");
  const [view, setView]         = _us_pi("readable"); // readable | raw | portrait
  const [search, setSearch]     = _us_pi("");

  _ue_pi(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // count keys per category for sidebar badges
  const counts = _um_pi(() => {
    const c = {};
    Object.entries(data || {}).forEach(([k, v]) => {
      if (!v || typeof v !== "object") return;
      c[k] = Object.values(v).filter((x) => x !== "" && x !== null && x !== undefined && !(Array.isArray(x) && x.length === 0)).length;
    });
    return c;
  }, [data]);

  const grouped = _um_pi(() => {
    const g = {};
    PIF_CATEGORIES.forEach((c) => { (g[c.group] ||= []).push(c); });
    return g;
  }, []);

  const active = PIF_CATEGORIES.find((c) => c.id === activeId);
  const block  = data?.[activeId] || {};
  const labels = PIF_KV_LABELS[activeId] || {};

  // filter for search
  const filteredKeys = Object.keys(labels).filter((k) => {
    if (!search) return true;
    const hay = (labels[k] + " " + JSON.stringify(block?.[k] || "")).toLowerCase();
    return hay.includes(search.toLowerCase());
  });

  return (
    <div className="pif" role="dialog" aria-modal="true" data-ui="ProjectIntelligenceFileModal" data-screen-label="Project Intelligence File">
      <div className="pif__shell">
        <div className="pif__head">
          <div className="pif__seal">{BRAND.shortName}</div>
          <div className="pif__head__title">
            <div className="pif__head__eyebrow">Project intelligence file · {percent}% complete</div>
            <h1 className="pif__head__h1">{data?.welcome?.title || "Untitled project"}</h1>
          </div>
          <div className="pif__head__meta">
            <div className="pif__search">
              <Icon name="search" size={12}/>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search keys & values…"/>
            </div>
            <Btn variant="ghost" size="sm" icon="paper" onClick={onCopyIntelFile} data-callback="onCopyIntelFile">Copy JSON</Btn>
            <Btn variant="outline" size="sm" icon="bookmark" onClick={onExportIntelFile} data-callback="onExportIntelFile">Export</Btn>
            <button type="button" className="pif__close" onClick={onClose} aria-label="Close"><Icon name="x" size={14}/></button>
          </div>
        </div>

        <div className="pif__body">
          <nav className="pif__nav" aria-label="Categories">
            {Object.entries(grouped).map(([grp, items]) => (
              <React.Fragment key={grp}>
                <div className="pif__nav__group">{grp}</div>
                {items.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={"pif__navitem " + (c.id === activeId ? "is-active" : "")}
                    onClick={() => { setActiveId(c.id); if (c.id === "portrait") setView("portrait"); else if (view === "portrait") setView("readable"); }}
                  >
                    <span className="pif__navitem__num">{c.num}</span>
                    <span>{c.label}</span>
                    {counts[c.id] > 0 && <span className="pif__navitem__count">{counts[c.id]}</span>}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </nav>

          <main className="pif__main">
            {activeId !== "portrait" && (
              <div className="pif__view-tabs">
                <button type="button" className={"pif__view-tab " + (view === "readable" ? "is-active" : "")} onClick={() => setView("readable")}>Readable</button>
                <button type="button" className={"pif__view-tab " + (view === "raw" ? "is-active" : "")} onClick={() => setView("raw")}>Raw JSON</button>
              </div>
            )}

            {activeId === "portrait" || view === "portrait" ? (
              <ProjectPortrait data={data} percent={percent}/>
            ) : view === "raw" ? (
              <div className="pif__section">
                <div className="pif__section__head">
                  <div>
                    <div className="pif__section__sub">{active?.num} · {active?.group}</div>
                    <div className="pif__section__title">{active?.label} — raw</div>
                  </div>
                </div>
                <pre className="pif__rawjson" dangerouslySetInnerHTML={{ __html: highlightJson(JSON.stringify(block, null, 2)) }}/>
              </div>
            ) : (
              <div className="pif__section">
                <div className="pif__section__head">
                  <div>
                    <div className="pif__section__sub">{active?.num} · {active?.group}</div>
                    <div className="pif__section__title">{active?.label}</div>
                  </div>
                  <div className="pif__section__btns">
                    <Btn variant="ghost" size="xs" icon="paper">Edit step</Btn>
                  </div>
                </div>
                {filteredKeys.length === 0 ? (
                  <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-4)" }}>
                    {search ? "No keys match this search." : "Nothing recorded yet."}
                  </div>
                ) : (
                  <div className="pif__kvgrid">
                    {filteredKeys.map((k) => (
                      <React.Fragment key={k}>
                        <div className="pif__kvgrid__k">{labels[k] || k}</div>
                        <div className="pif__kvgrid__v">{fmtVal(block[k])}</div>
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}
          </main>

          <aside className="pif__meta">
            <div>
              <div className="pif__meta__title">File</div>
              <div className="pif__meta__row" style={{ marginTop: 6 }}>
                <strong>project-intelligence.json</strong>
                <small>~/Loomwright/projects/{(data?.welcome?.title || "untitled").toLowerCase().replace(/\s+/g, "-")}/</small>
              </div>
            </div>
            <div>
              <div className="pif__meta__title">Status</div>
              <div className="pif__meta__row" style={{ marginTop: 6 }}>
                <span><JsonValidationState kind="applied" text={percent + "% built"}/></span>
                <small style={{ marginTop: 4 }}>Last write · just now · onboarding wizard</small>
              </div>
            </div>
            <div>
              <div className="pif__meta__title">Schema</div>
              <div className="pif__meta__row" style={{ marginTop: 6, fontFamily: "var(--font-mono)", fontSize: "var(--fs-3xs)", color: "var(--ink-3)" }}>
                loomwright-project / v1.0
              </div>
            </div>
            <div className="pif__conflict">
              <span className="pif__conflict__icon"><Icon name="warn" size={12}/></span>
              <div>
                <strong>Tip.</strong> This file lives alongside your manuscript. Loomwright reads it before every AI suggestion so the model never invents what you've already decided.
              </div>
            </div>
            <div>
              <div className="pif__meta__title">Used by</div>
              <ul style={{ margin: "6px 0 0 0", paddingLeft: 14, fontSize: "var(--fs-xs)", color: "var(--ink-2)", display: "flex", flexDirection: "column", gap: 4 }}>
                <li>Writer's Room (suggestions)</li>
                <li>Reviewer (extraction)</li>
                <li>Cast & Atlas (canon)</li>
                <li>Style guard (voice mirroring)</li>
              </ul>
            </div>
          </aside>
        </div>

        <div className="pif__foot">
          <span>Esc to close · ⌘F to search · Last saved just now</span>
          <div className="pif__foot__btns">
            <Btn variant="ghost" size="xs" icon="paper" onClick={onCopyIntelFile} data-callback="onCopyIntelFile">Copy JSON</Btn>
            <Btn variant="outline" size="xs" icon="bookmark" onClick={onExportIntelFile} data-callback="onExportIntelFile">Export</Btn>
            <Btn variant="primary" size="xs" icon="x" onClick={onClose}>Close</Btn>
          </div>
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// ProjectPortrait — literary one-pager pulled from saved data.
// Acts as the "save confirmation" — if a field's missing, it shows.
// ---------------------------------------------------------------------
const ProjectPortrait = ({ data, percent }) => {
  const w = data?.welcome || {};
  const f = data?.foundation || {};
  const s = data?.style || {};
  const world = data?.world || {};
  const cast = data?.cast?.seeds || [];

  const missing = [];
  if (!w.title) missing.push("title");
  if (!f.premise) missing.push("premise");
  if (!f.themes?.length) missing.push("themes");

  const themeLine = f.themes?.length ? f.themes.slice(0, 4).join(", ") : null;
  const toneLine = f.toneWords?.length ? f.toneWords.slice(0, 5).join(" · ") : null;
  const dials = s.dials || {};
  const dialLine = Object.keys(dials).length
    ? STYLE_DIALS.filter((d) => dials[d.id] !== undefined).slice(0, 3).map((d) => d.marks[dials[d.id] ?? 2]).join(", ")
    : null;

  return (
    <div className="pif__portrait">
      <div className="pif__portrait__seal">A literary portrait · drawn from your answers</div>
      <h1 className="pif__portrait__h1">{w.title || <em style={{ color: "var(--ink-4)" }}>An untitled project</em>}</h1>
      {(w.series || w.book) && (
        <div className="pif__portrait__h2">{w.series}{w.book ? " — " + w.book : ""}</div>
      )}
      <div className="pif__portrait__hr"/>
      <div className="pif__portrait__body">
        <p>
          {w.title ? <em>{w.title}</em> : "This project"} {w.format ? "is a " + w.format.toLowerCase() : "is a work"}
          {w.genre ? " in the " + w.genre.toLowerCase() + (w.subgenre ? " (" + w.subgenre.toLowerCase() + ")" : "") + " tradition" : ""}
          {w.audience ? ", written for " + w.audience.toLowerCase() + " readers" : ""}
          {w.length ? ", aiming at " + w.length.toLowerCase() : ""}
          {w.stage ? ", currently in the " + w.stage.toLowerCase() + " stage" : ""}.{" "}
          {f.premise ? f.premise : <em style={{ color: "var(--ink-4)" }}>The premise has not yet been recorded.</em>}
        </p>
        {f.logline && (
          <p>
            In one breath: <em>{f.logline}</em>
            {f.coreConflict ? " The conflict at its centre is " + f.coreConflict.toLowerCase().replace(/\.$/, "") + "." : ""}
          </p>
        )}
        {(themeLine || toneLine) && (
          <p>
            {themeLine && <>Its themes circle <strong>{themeLine}</strong>. </>}
            {toneLine && <>The tone is held in <em>{toneLine}</em>. </>}
            {f.pov && <>It is told in {f.pov.toLowerCase()}{f.tense ? ", " + f.tense.toLowerCase() + " tense" : ""}.</>}
          </p>
        )}
        {dialLine && (
          <p>
            On the page, the prose runs {dialLine}
            {s.avoid ? ", with a deliberate distance from " + s.avoid.toLowerCase() : ""}.
            {s.signature ? " The author's signatures: " + s.signature + "." : ""}
          </p>
        )}
        {(world.worldType || world.canonRules?.length || cast.length) && (
          <p>
            {world.worldType && <>The world is a {world.worldType.toLowerCase()}. </>}
            {world.canonRules?.length > 0 && <>{world.canonRules.length} canon rule{world.canonRules.length === 1 ? "" : "s"} are locked against the AI's suggestions. </>}
            {cast.length > 0 && <>{cast.length} cast seed{cast.length === 1 ? "" : "s"} have been planted: {cast.slice(0, 3).map((c) => c.name).join(", ")}{cast.length > 3 ? ", and others" : ""}.</>}
          </p>
        )}
        {missing.length > 0 && (
          <p style={{ borderTop: "1px dashed var(--line-2)", paddingTop: 14, marginTop: 18, fontStyle: "italic", color: "var(--ink-3)" }}>
            Still to be set: {missing.join(", ")}. The portrait will deepen as you complete the rest of the ritual.
          </p>
        )}
      </div>
      <div className="pif__portrait__meta">
        <span>Compiled from project-intelligence.json</span>
        <span>{percent}% complete · {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
      </div>
    </div>
  );
};

// expose --------------------------------------------------------------
Object.assign(window, {
  IntelSaveIndicator,
  JsonValidationState,
  JsonImportPreview,
  StepJsonTools,
  MultiChoiceOptionGroup,
  RankedChoiceInput,
  ProjectIntelligencePanel,
  ProjectIntelligenceFileModal,
  ProjectPortrait,
  PIF_CATEGORIES,
});

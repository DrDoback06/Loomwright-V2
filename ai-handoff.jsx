// =====================================================================
// ai-handoff.jsx — AI Handoff Pack.
//
// Lets users export structured project context to use with external AI
// tools (token-saving), then paste results back into Loomwright.
//
// Primary surface: Writer's Room Composition Overlay
// Secondary surfaces: Entity Editor, References / Research Library,
//                     Settings → Project Intelligence
//
// Public exports (on window):
//   AIHandoffDrawer({ open, surface, context, onClose, onApplyResult })
//   buildAIHandoffPack({ outputType, detailLevel, selectedEntities,
//                        instructions, contextOptions, surface, projectContext })
//   buildAIHandoffPrompt(pack)
//   AI_HANDOFF_DETAIL_LEVELS
//   AI_HANDOFF_CONTEXT_OPTIONS
//   AI_HANDOFF_OUTPUT_TYPES
//   AI_HANDOFF_RESULT_MODES
//
// No real AI calls are made — this is a presentational + copy/paste layer
// designed to make external-AI handoff easy and cheap.
// =====================================================================

const { useState: _ah_us, useEffect: _ah_ue, useRef: _ah_ur, useMemo: _ah_um } = React;

// ---------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------
const AI_HANDOFF_OUTPUT_TYPES = [
  { id: "paragraph",  label: "Paragraph",       hint: "A single tightened paragraph" },
  { id: "scene",      label: "Scene",           hint: "One self-contained scene" },
  { id: "chapter",    label: "Chapter draft",   hint: "Full chapter, multi-scene" },
  { id: "rewrite",    label: "Rewrite",         hint: "Revise an existing passage" },
  { id: "outline",    label: "Outline",         hint: "Beat-by-beat outline" },
  { id: "bullets",    label: "Bullet beats",    hint: "Quick beat list" },
  { id: "continuity", label: "Continuity check",hint: "Find inconsistencies" },
  { id: "entity",     label: "Entity update",   hint: "Update dossier fields" },
];

const AI_HANDOFF_DETAIL_LEVELS = [
  { id: "minimal",  label: "Minimal",      hint: "Names + roles only.  Cheapest." },
  { id: "balanced", label: "Balanced",     hint: "Summaries + key facts.  Recommended." },
  { id: "full",     label: "Full context", hint: "Full dossiers, canon, sources." },
  { id: "custom",   label: "Custom",       hint: "Choose individually below." },
];

const AI_HANDOFF_CONTEXT_OPTIONS = [
  { id: "entitySummaries",       label: "Entity summaries only",        group: "Entities" },
  { id: "entityDossiers",        label: "Full entity dossiers",         group: "Entities" },
  { id: "relationships",         label: "Relationships between cast",   group: "Entities" },
  { id: "itemHistory",           label: "Item history / equipment",     group: "Entities" },
  { id: "locationAtlas",         label: "Location & Atlas notes",       group: "World" },
  { id: "questState",            label: "Quest state",                  group: "World" },
  { id: "eventTimeline",         label: "Event & timeline context",     group: "World" },
  { id: "canonRules",            label: "Canon / lore rules",           group: "World" },
  { id: "styleProfile",          label: "Writing style profile",        group: "Project" },
  { id: "currentChapter",        label: "Current chapter excerpt",      group: "Manuscript" },
  { id: "previousChapter",       label: "Previous chapter summary",     group: "Manuscript" },
  { id: "sourceMentions",        label: "Source mentions",              group: "Manuscript" },
  { id: "avoidContradictions",   label: "Avoid-contradictions list",    group: "Project" },
  { id: "projectIntelligence",   label: "Project Intelligence summary", group: "Project" },
  { id: "references",            label: "References / style samples",   group: "Project" },
  { id: "excludeDormant",        label: "Exclude dormant entities",     group: "Filters", defaultOn: true },
  { id: "includeReviewWarnings", label: "Include review warnings",      group: "Filters" },
];

const AI_HANDOFF_RESULT_MODES = [
  { id: "draft",        label: "Insert as draft",          hint: "Add below the cursor in Writer's Room" },
  { id: "below",        label: "Add below cursor",         hint: "Append in-place without scene break" },
  { id: "newChapter",   label: "Create new chapter draft", hint: "Drop as a new reserved chapter" },
  { id: "review",       label: "Create review-queue items",hint: "Treat as candidates needing review" },
  { id: "updateEntities", label: "Update selected entities", hint: "Apply field-level updates" },
  { id: "saveReference",label: "Save as reference",        hint: "Keep in References / Research Library" },
  { id: "compare",      label: "Compare against current",  hint: "Show diff against current passage" },
];

const AH_DEFAULTS_BY_LEVEL = {
  minimal:  { entitySummaries: true, canonRules: false, currentChapter: false, projectIntelligence: false, excludeDormant: true },
  balanced: { entitySummaries: true, relationships: true, questState: true, canonRules: true, styleProfile: true, currentChapter: true, projectIntelligence: true, excludeDormant: true },
  full:     { entityDossiers: true, relationships: true, itemHistory: true, locationAtlas: true, questState: true, eventTimeline: true, canonRules: true, styleProfile: true, currentChapter: true, previousChapter: true, sourceMentions: true, avoidContradictions: true, projectIntelligence: true, references: true, excludeDormant: true, includeReviewWarnings: true },
  custom:   { excludeDormant: true },
};

// ---------------------------------------------------------------------
// Pack builders
// ---------------------------------------------------------------------
function buildAIHandoffPack(opts = {}) {
  const {
    outputType = "scene",
    detailLevel = "balanced",
    selectedEntities = [],
    entityRoles = {},
    instructions = "",
    targetChapterId = null,
    pov = "Match current",
    tone = "Match current",
    length = "Medium",
    surface = "composition",
    projectContext = {},
    contextOptions = {},
  } = opts;

  const include = (key) => !!contextOptions[key];

  return {
    id: "ahp-" + Date.now(),
    schema: "loomwright/ai-handoff/v1",
    purpose: outputType,
    outputType,
    detailLevel,
    surface,
    targetChapterId,
    pov, tone, length,
    instructions: instructions || "",
    selectedEntities: selectedEntities.map((e) => ({
      id: e.id || null,
      type: e.type || e.entityType || null,
      name: e.name || "",
      role: entityRoles[e.id] || e.role || null,
      summary: include("entitySummaries") ? (e.summary || e.subtitle || "") : undefined,
      dossier: include("entityDossiers")  ? (e.dossier || e)             : undefined,
    })),
    contextOptions,
    projectContext: {
      title: projectContext.title || "",
      genre: projectContext.genre || "",
      styleProfile:        include("styleProfile")        ? (projectContext.styleProfile || null) : null,
      canonRules:          include("canonRules")          ? (projectContext.canonRules || [])     : null,
      relationships:       include("relationships")       ? (projectContext.relationships || []) : null,
      locations:           include("locationAtlas")       ? (projectContext.locations || [])     : null,
      quests:              include("questState")          ? (projectContext.quests || [])         : null,
      events:              include("eventTimeline")       ? (projectContext.events || [])         : null,
      timeline:            include("eventTimeline")       ? (projectContext.timeline || [])       : null,
      references:          include("references")          ? (projectContext.references || [])     : null,
      currentChapter:      include("currentChapter")      ? (projectContext.currentChapter || null) : null,
      previousChapterSummary: include("previousChapter")  ? (projectContext.previousChapterSummary || null) : null,
      sourceMentions:      include("sourceMentions")      ? (projectContext.sourceMentions || [])  : null,
      projectIntelligence: include("projectIntelligence") ? (projectContext.projectIntelligence || null) : null,
      avoidContradictions: include("avoidContradictions") ? (projectContext.avoidContradictions || []) : null,
      reviewWarnings:      include("includeReviewWarnings") ? (projectContext.reviewWarnings || []) : null,
    },
    constraints: {
      excludeDormant: include("excludeDormant"),
    },
    expectedReturnShape: {
      resultType:       outputType,
      prose:            "string",
      entityUpdates:    "Array<{ id, type, patch }>",
      questUpdates:     "Array<{ id, status?, steps? }>",
      eventUpdates:     "Array<{ id, patch }>",
      continuityNotes:  "Array<string>",
      suggestedReviewItems: "Array<{ kind, payload, reason }>",
    },
    ts: Date.now(),
  };
}

function buildAIHandoffPrompt(pack) {
  if (!pack) return "";
  const ent = (pack.selectedEntities || []).map((e) =>
    "- " + (e.name || e.id) + (e.type ? " (" + e.type + ")" : "") + (e.role ? " — role: " + e.role : "") + (e.summary ? "\n  " + e.summary : "")
  ).join("\n");
  const ctx = Object.entries(pack.projectContext || {}).filter(([_, v]) => v != null && (Array.isArray(v) ? v.length : true)).map(([k]) => "  · " + k).join("\n");

  return [
    "You are helping the author of a novel.",
    "",
    "Project: " + (pack.projectContext?.title || "(untitled)") + (pack.projectContext?.genre ? " — " + pack.projectContext.genre : ""),
    "",
    "TASK: " + (pack.outputType || "scene") + (pack.targetChapterId ? " (target: chapter " + pack.targetChapterId + ")" : ""),
    "POV: " + (pack.pov || "—") + " · Tone: " + (pack.tone || "—") + " · Length: " + (pack.length || "—"),
    "Detail level: " + (pack.detailLevel || "balanced"),
    "",
    pack.instructions ? "AUTHOR INSTRUCTIONS:\n" + pack.instructions + "\n" : "",
    ent ? "SELECTED ENTITIES:\n" + ent + "\n" : "",
    ctx ? "PROJECT CONTEXT INCLUDED:\n" + ctx + "\n" : "",
    "Return STRICT JSON matching this shape:",
    "```json\n" + JSON.stringify(pack.expectedReturnShape, null, 2) + "\n```",
    "",
    "The structured pack is attached below.",
    "",
    "```json",
    JSON.stringify(pack, null, 2),
    "```",
  ].filter(Boolean).join("\n");
}

// Rough token estimate (1 token ≈ 4 chars).
function ahpEstimateTokens(s) {
  if (!s) return 0;
  return Math.ceil((typeof s === "string" ? s.length : JSON.stringify(s).length) / 4);
}

// ---------------------------------------------------------------------
// AIHandoffDrawer — Export + Import in one drawer.
//
// Props:
//   open, onClose
//   surface     : "composition" | "entity-editor" | "references" |
//                 "project-intelligence"
//   context     : initial data — selected entities, project info,
//                 instructions, target chapter, etc.
//   onApplyResult({ mode, result, raw })   ← optional
// ---------------------------------------------------------------------
const AIHandoffDrawer = ({ open, onClose, surface = "composition", context = {}, onApplyResult }) => {
  const [tab, setTab] = _ah_us("export"); // "export" | "import"
  const [outputType, setOutputType] = _ah_us(context.outputType || "scene");
  const [detailLevel, setDetailLevel] = _ah_us("balanced");
  const [instructions, setInstructions] = _ah_us(context.instructions || "");
  const [targetChapter, setTargetChapter] = _ah_us(context.targetChapterId || "");
  const [pov, setPov] = _ah_us(context.pov || "Match current");
  const [tone, setTone] = _ah_us(context.tone || "Match current");
  const [length, setLength] = _ah_us(context.length || "Medium");
  const [contextOpts, setContextOpts] = _ah_us(() => ({ ...AH_DEFAULTS_BY_LEVEL.balanced }));

  // Import side
  const [resultMode, setResultMode] = _ah_us("draft");
  const [resultRaw, setResultRaw] = _ah_us("");
  const [parseState, setParseState] = _ah_us({ kind: "idle" }); // idle | json | prose | error

  // Reset context defaults when detail level changes
  _ah_ue(() => {
    if (detailLevel === "custom") return;
    setContextOpts({ ...AH_DEFAULTS_BY_LEVEL[detailLevel] });
  }, [detailLevel]);

  const setOpt = (id, v) => {
    setContextOpts((s) => ({ ...s, [id]: v }));
    if (detailLevel !== "custom") setDetailLevel("custom");
  };

  // ----- Build pack
  const pack = _ah_um(() => buildAIHandoffPack({
    outputType, detailLevel,
    selectedEntities: context.selectedEntities || [],
    entityRoles: context.entityRoles || {},
    instructions, targetChapterId: targetChapter,
    pov, tone, length, surface,
    projectContext: context.projectContext || {},
    contextOptions: contextOpts,
  }), [outputType, detailLevel, context.selectedEntities, context.entityRoles, instructions, targetChapter, pov, tone, length, surface, context.projectContext, contextOpts]);

  const promptText = _ah_um(() => buildAIHandoffPrompt(pack), [pack]);
  const packJson   = _ah_um(() => JSON.stringify(pack, null, 2), [pack]);
  const promptTokens = _ah_um(() => ahpEstimateTokens(promptText), [promptText]);

  // ----- Copy helpers
  const safeCopy = async (s) => {
    try { await navigator.clipboard.writeText(s); return true; } catch (e) { return false; }
  };
  const onCopyJson = () => {
    safeCopy(packJson);
    if (typeof HandoffService !== "undefined") HandoffService.saveLastPack(pack).catch(() => {});
    window.dispatchEvent(new CustomEvent("lw:ai-handoff-copy-json", { detail: { pack } }));
  };
  const onCopyPrompt = () => {
    safeCopy(promptText);
    if (typeof HandoffService !== "undefined") HandoffService.saveLastPack(pack).catch(() => {});
    window.dispatchEvent(new CustomEvent("lw:ai-handoff-copy-prompt", { detail: { pack, prompt: promptText } }));
  };
  const onDownload = () => {
    if (typeof HandoffService !== "undefined") {
      HandoffService.downloadPack(pack);
    } else {
      try {
        const blob = new Blob([packJson], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ai-handoff-pack-" + Date.now() + ".json";
        document.body.appendChild(a); a.click();
        setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 500);
      } catch (e) { /* noop */ }
    }
    window.dispatchEvent(new CustomEvent("lw:ai-handoff-download", { detail: { pack } }));
  };
  const onSavePack = () => {
    if (typeof HandoffService !== "undefined") HandoffService.saveLastPack(pack).catch(() => {});
    window.dispatchEvent(new CustomEvent("lw:ai-handoff-save", { detail: { pack } }));
  };

  // ----- Parse the user's pasted result
  const parseResult = (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed) { setParseState({ kind: "idle" }); return; }
    // Try JSON
    try {
      const parsed = JSON.parse(trimmed);
      setParseState({ kind: "json", value: parsed });
      return;
    } catch (e) { /* fall through */ }
    // Try JSON inside ``` fences
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) {
      try {
        const parsed = JSON.parse(fence[1].trim());
        setParseState({ kind: "json", value: parsed });
        return;
      } catch (e) { /* noop */ }
    }
    setParseState({ kind: "prose" });
  };
  _ah_ue(() => parseResult(resultRaw), [resultRaw]);

  const onApply = () => {
    const payload = {
      mode: resultMode,
      raw: resultRaw,
      result: parseState.kind === "json" ? parseState.value : { prose: resultRaw },
      surface,
    };
    if (onApplyResult) onApplyResult(payload);
    window.dispatchEvent(new CustomEvent("lw:ai-handoff-import", { detail: payload }));
    if (resultMode === "review") window.dispatchEvent(new CustomEvent("lw:ai-handoff-create-review-items", { detail: payload }));
    if (resultMode === "updateEntities") window.dispatchEvent(new CustomEvent("lw:ai-handoff-update-entities", { detail: payload }));
    if (resultMode === "saveReference") window.dispatchEvent(new CustomEvent("lw:ai-handoff-save-reference", { detail: payload }));
    onClose && onClose();
  };

  if (!open) return null;

  // Group context options for the checkbox grid
  const grouped = _ah_um(() => {
    const map = {};
    AI_HANDOFF_CONTEXT_OPTIONS.forEach((o) => { (map[o.group] = map[o.group] || []).push(o); });
    return map;
  }, []);

  const detailColour = detailLevel === "minimal" ? "ahp-detail--minimal" :
                       detailLevel === "balanced" ? "ahp-detail--balanced" :
                       detailLevel === "full" ? "ahp-detail--full" : "ahp-detail--custom";

  return (
    <>
      <div className="ahp-backdrop" onClick={onClose}/>
      <div className="ahp-drawer" role="dialog" aria-modal="true" aria-label="AI Handoff Pack">
        {/* Header */}
        <div className="ahp-head">
          <div className="ahp-head__icon"><Icon name="sparkle" size={16}/></div>
          <div className="ahp-head__titles">
            <div className="ahp-head__eyebrow">AI Handoff Pack</div>
            <div className="ahp-head__title">Use external AI without using your in-app API keys</div>
            <div className="ahp-head__sub">Export a structured JSON context, work with any AI tool, then paste results back here. Reviewed before they update your project.</div>
          </div>
          <button className="ahp-head__close" onClick={onClose} aria-label="Close"><Icon name="close" size={14}/></button>
        </div>

        {/* Tabs */}
        <div className="ahp-tabs">
          <button className={"ahp-tab " + (tab === "export" ? "is-active" : "")} onClick={() => setTab("export")}>
            <Icon name="download" size={11}/> Export context pack
          </button>
          <button className={"ahp-tab " + (tab === "import" ? "is-active" : "")} onClick={() => setTab("import")}>
            <Icon name="quill" size={11}/> Import AI result
          </button>
          <span className="ahp-tabs__spacer"/>
          <span className={"ahp-token-est " + detailColour}>
            ~{promptTokens.toLocaleString()} tokens · {(context.selectedEntities || []).length} entities
          </span>
        </div>

        {/* Body */}
        <div className="ahp-body">
          {tab === "export" ? (
            <div className="ahp-export">
              {/* Output type */}
              <div className="ahp-row">
                <div className="ahp-label">Output type</div>
                <div className="ahp-pills">
                  {AI_HANDOFF_OUTPUT_TYPES.map((t) => (
                    <button key={t.id} className={"ahp-pill " + (outputType === t.id ? "is-on" : "")}
                      onClick={() => setOutputType(t.id)} title={t.hint}>{t.label}</button>
                  ))}
                </div>
              </div>

              {/* Target / POV / tone / length */}
              <div className="ahp-row ahp-row--3">
                <div>
                  <div className="ahp-label">Target chapter</div>
                  <input className="ahp-input" type="text" value={targetChapter} onChange={(e) => setTargetChapter(e.target.value)} placeholder="Ch. 7 — Ash & Auger"/>
                </div>
                <div>
                  <div className="ahp-label">POV</div>
                  <input className="ahp-input" type="text" value={pov} onChange={(e) => setPov(e.target.value)} placeholder="Match current"/>
                </div>
                <div>
                  <div className="ahp-label">Length</div>
                  <input className="ahp-input" type="text" value={length} onChange={(e) => setLength(e.target.value)} placeholder="Medium (400–800 words)"/>
                </div>
              </div>

              {/* Instructions */}
              <div className="ahp-row">
                <div className="ahp-label">Instructions to the external AI</div>
                <textarea className="ahp-textarea" rows={3} value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="e.g. 'Aelinor enters, refuses Brec's deal, and leaves with the Auger. Keep prose terse, cold, restrained.'"/>
              </div>

              {/* Detail level */}
              <div className="ahp-row">
                <div className="ahp-label">Detail level — token budget</div>
                <div className="ahp-pills">
                  {AI_HANDOFF_DETAIL_LEVELS.map((d) => (
                    <button key={d.id} className={"ahp-pill ahp-pill--detail " + (detailLevel === d.id ? "is-on" : "")}
                      onClick={() => setDetailLevel(d.id)} title={d.hint}>
                      <b>{d.label}</b><span>{d.hint}</span>
                    </button>
                  ))}
                </div>
                <div className="ahp-hint">
                  Summaries only = cheaper external AI prompts. Full dossiers give better results but create larger prompts.
                </div>
              </div>

              {/* Context options */}
              <div className="ahp-row">
                <div className="ahp-label">Context to include</div>
                <div className="ahp-grid">
                  {Object.entries(grouped).map(([group, opts]) => (
                    <div key={group} className="ahp-grid__col">
                      <div className="ahp-grid__head">{group}</div>
                      {opts.map((o) => (
                        <label key={o.id} className="ahp-chk">
                          <input type="checkbox" checked={!!contextOpts[o.id]} onChange={(e) => setOpt(o.id, e.target.checked)}/>
                          <span>{o.label}</span>
                        </label>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Privacy note */}
              <div className="ahp-warn">
                <Icon name="alert" size={11}/>
                <span>External AI receives whatever you copy. Manuscript text is only included if you tick "Current chapter excerpt".</span>
              </div>

              {/* Preview */}
              <div className="ahp-row">
                <div className="ahp-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  Prompt preview
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--ink-3)", textTransform: "none", letterSpacing: 0 }}>
                    ~{promptTokens.toLocaleString()} tok
                  </span>
                </div>
                <pre className="ahp-preview">{promptText}</pre>
              </div>
            </div>
          ) : (
            <div className="ahp-import">
              <div className="ahp-row">
                <div className="ahp-label">Paste the AI's response</div>
                <textarea className="ahp-textarea ahp-textarea--lg" rows={10}
                  value={resultRaw}
                  onChange={(e) => setResultRaw(e.target.value)}
                  placeholder='Paste prose, or JSON matching the expected return shape — e.g. { "resultType": "scene", "prose": "...", "entityUpdates": [], "continuityNotes": [] }'/>
                <div className={"ahp-parse-banner " + (
                  parseState.kind === "json"  ? "is-json"  :
                  parseState.kind === "prose" ? "is-prose" : "is-idle"
                )}>
                  {parseState.kind === "json"  && (<><Icon name="check" size={11}/> Parsed valid JSON. Detected fields: {Object.keys(parseState.value || {}).join(", ")}</>)}
                  {parseState.kind === "prose" && (<><Icon name="paper" size={11}/> Treating as prose — you can still apply as a draft.</>)}
                  {parseState.kind === "idle"  && (<><Icon name="paper" size={11}/> Paste anything: prose, JSON, or JSON in a ```fenced block```.</>)}
                </div>
              </div>

              <div className="ahp-row">
                <div className="ahp-label">Apply as…</div>
                <div className="ahp-pills">
                  {AI_HANDOFF_RESULT_MODES.map((m) => (
                    <button key={m.id} className={"ahp-pill ahp-pill--detail " + (resultMode === m.id ? "is-on" : "")}
                      onClick={() => setResultMode(m.id)} title={m.hint}>
                      <b>{m.label}</b><span>{m.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="ahp-warn">
                <Icon name="alert" size={11}/>
                <span>Imported results land in the review queue (or as drafts) before they change your project. You can revert.</span>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ahp-foot">
          {tab === "export" ? (
            <>
              <span className="ahp-foot__hint">Use any external AI tool. Paste the response in <b>Import</b>.</span>
              <button className="ee-btn ee-btn--ghost" onClick={onSavePack} data-callback="onSaveHandoffPack">
                <Icon name="bookmark" size={11}/> Save pack
              </button>
              <button className="ee-btn ee-btn--ghost" onClick={onDownload} data-callback="onDownloadHandoffJson">
                <Icon name="download" size={11}/> Download JSON
              </button>
              <button className="ee-btn ee-btn--outline" onClick={onCopyJson} data-callback="onCopyHandoffJson">
                <Icon name="code" size={11}/> Copy JSON
              </button>
              <button className="ee-btn ee-btn--primary" onClick={onCopyPrompt} data-callback="onCopyHandoffPrompt">
                <Icon name="sparkle" size={11}/> Copy prompt + JSON
              </button>
              <button className="ee-btn ee-btn--accent" onClick={() => setTab("import")}>
                Import result <Icon name="arrow-right" size={11}/>
              </button>
            </>
          ) : (
            <>
              <span className="ahp-foot__hint">Imported result will be staged — nothing replaces your work until you confirm.</span>
              <button className="ee-btn ee-btn--ghost" onClick={() => setTab("export")}>
                <Icon name="arrow-left" size={11}/> Back to export
              </button>
              <button className="ee-btn ee-btn--primary" onClick={onApply} disabled={!resultRaw.trim()} data-callback="onImportAIResult">
                Apply
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------
// AIHandoffButton — a small button that opens the drawer. Used by any
// surface that wants to expose the handoff pack inline.
// ---------------------------------------------------------------------
const AIHandoffButton = ({ surface = "composition", context = {}, label = "AI Handoff", icon = "sparkle", variant = "outline", onApplyResult, compact = false }) => {
  const [open, setOpen] = _ah_us(false);
  const cls = "ee-btn ee-btn--" + variant;
  return (
    <>
      <button className={cls} onClick={() => setOpen(true)} data-callback="onOpenAIHandoffPack" title="Export context for external AI · paste results back">
        <Icon name={icon} size={11}/> {compact ? "Handoff" : label}
      </button>
      <AIHandoffDrawer open={open} onClose={() => setOpen(false)} surface={surface} context={context} onApplyResult={onApplyResult}/>
    </>
  );
};

Object.assign(window, {
  AIHandoffDrawer,
  AIHandoffButton,
  buildAIHandoffPack,
  buildAIHandoffPrompt,
  AI_HANDOFF_DETAIL_LEVELS,
  AI_HANDOFF_CONTEXT_OPTIONS,
  AI_HANDOFF_OUTPUT_TYPES,
  AI_HANDOFF_RESULT_MODES,
});

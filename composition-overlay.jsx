// =====================================================================
// composition-overlay.jsx — Floating Writer's Room composition overlay.
//
// Lives over the manuscript ONLY (rendered inside WritersRoomScreen).
// - Floating, draggable, pinnable, minimisable, resizable.
// - Drop zone accepts entities from any panel.
// - Coexists with the side-panel stack; the user can keep dragging
//   more entities into it while writing.
//
// Public API:
//   <CompositionOverlay
//     open
//     droppedEntities={[{entityType, id, name, summary, role}]}
//     instructions, settings, contextOptions
//     onClose, onMinimise, onTogglePin
//     onDropEntity(payload)
//     onRemoveEntity(idx)
//     onUpdateRole(idx, role)
//     onUpdateInstructions(text)
//     onSetMode(mode)         · onSetPOV(pov) · onSetLength(len) · onSetTone(tone)
//     onSetChapterTarget(id)
//     onToggleContext(key)
//     onGenerateDraft, onInsertDraft, onCreateChapter, onCopyPrompt, onSavePreset
//     onClearAll
//   />
//
// Backend hookups (callbacks expected by ENTITY_COMPOSITION_HOOKUP.md):
//   onOpenEntityCompositionOverlay
//   onCloseEntityCompositionOverlay
//   onMinimiseEntityCompositionOverlay
//   onPinEntityCompositionOverlay
//   onDropEntityIntoComposition
//   onRemoveEntityFromComposition
//   onUpdateCompositionEntityRole
//   onUpdateCompositionInstructions
//   onSetCompositionMode / onSetCompositionPOV / onSetCompositionLength
//   onToggleCompositionContextOption
//   onGenerateCompositionDraft / onInsertCompositionDraft /
//   onCreateChapterFromComposition / onCopyCompositionPrompt /
//   onSaveCompositionPreset
// =====================================================================

const { useState: _co_us, useEffect: _co_ue, useRef: _co_ur, useCallback: _co_uc, useMemo: _co_um } = React;

const CO_MODES = [
  { id: "new-chapter",  label: "New chapter" },
  { id: "new-scene",    label: "New scene" },
  { id: "paragraphs",   label: "Paragraphs" },
  { id: "add-in",       label: "Add into passage" },
  { id: "continue",     label: "Continue from cursor" },
  { id: "rewrite",      label: "Rewrite selected" },
  { id: "outline",      label: "Outline only" },
  { id: "beats",        label: "Bullet beats" },
];

const CO_POVS    = ["First person","Third limited","Third omniscient","Second person","Match current"];
const CO_LENGTHS = ["Short (200–400)","Medium (400–800)","Long (800–1500)","Very long (1500+)","Match current scene"];
const CO_TONES   = ["Match manuscript voice","Spare / literary","Lush / lyrical","Pacey / tight","Wry","Grave","Match POV character"];

const CO_DEFAULT_ROLES_BY_TYPE = {
  cast:        "supporting actor",
  items:       "used by character",
  locations:   "scene setting",
  quests:      "progressed",
  events:      "current happening",
  classes:     "class context",
  races:       "background culture",
  stats:       "central stat",
  skills:      "used skill",
  abilities:   "used skill",
  bestiary:    "encounter",
  factions:    "ally",
  lore:        "must include",
  references:  "background",
};

const CO_ROLES_BY_TYPE = {
  cast:        ["protagonist","POV character","supporting actor","antagonist","witness","target","speaker"],
  items:       ["used by character","found","lost","traded","equipped","destroyed","revealed","clue"],
  locations:   ["scene setting","destination","origin","hidden place","conflict site","discovery site"],
  quests:      ["started","progressed","completed","failed","revealed","complicated"],
  events:      ["cause","consequence","current happening","flashback","reveal"],
  classes:     ["class of protagonist","class of antagonist","class context","required class","class restriction"],
  races:       ["protagonist race","antagonist race","background culture","contested ancestry"],
  stats:       ["central stat","threshold stat","background stat"],
  skills:      ["used skill","required skill","newly acquired","newly upgraded"],
  abilities:   ["used skill","required skill","newly acquired","newly upgraded"],
  bestiary:    ["encounter","ally","danger","background creature"],
  factions:    ["ally","enemy","authority","hidden influence","conflict source"],
  lore:        ["must include","must not contradict","background rule","reveal"],
  references:  ["background","quoted","source"],
};

const CO_CONTEXT_OPTIONS = [
  { id: "currentChapter",    label: "Use current chapter context", defaultOn: true },
  { id: "projectIntel",      label: "Use Project Intelligence File", defaultOn: true },
  { id: "selectedRefs",      label: "Use selected references" },
  { id: "obeyCanon",         label: "Obey canon rules", defaultOn: true },
  { id: "preserveVoices",    label: "Preserve character voices", defaultOn: true },
  { id: "avoidContradictions", label: "Avoid contradictions", defaultOn: true },
];

const TYPE_LABELS = {
  cast: "Cast",
  items: "Items",
  locations: "Locations",
  quests: "Quests",
  events: "Events",
  classes: "Classes",
  races: "Races / Species",
  stats: "Stats",
  skills: "Skill Trees / Skills",
  abilities: "Skill Trees / Skills",
  bestiary: "Bestiary",
  factions: "Factions",
  lore: "Lore / Canon",
  references: "References",
};

// ---------------------------------------------------------------------
// CompositionOverlay
// ---------------------------------------------------------------------
const CompositionOverlay = ({
  open,
  droppedEntities = [],
  instructions = "",
  settings = {},
  contextOptions = {},
  pinned, minimised,
  onClose, onMinimise, onTogglePin,
  onDropEntity, onRemoveEntity, onUpdateRole,
  onUpdateInstructions, onSetMode, onSetPOV, onSetLength, onSetTone, onSetChapterTarget,
  onToggleContext,
  onGenerateDraft, onInsertDraft, onCreateChapter, onCopyPrompt, onSavePreset,
  onClearAll,
}) => {
  // Position state — open near top-right of viewport by default
  const [pos, setPos] = _co_us(() => ({
    x: Math.max(80, (window.innerWidth || 1280) - 480),
    y: 100,
  }));
  const [size, setSize] = _co_us({ w: 440, h: 0 }); // h:0 => natural height
  const dragging = _co_ur(null);
  const resizing = _co_ur(null);

  // Mode (always have a default)
  const mode = settings.mode || "new-scene";
  const pov  = settings.pov  || "Match current";
  const length = settings.length || "Medium (400–800)";
  const tone = settings.tone || "Match manuscript voice";

  // ---- Drag the overlay by header ----
  const onHeadDown = (e) => {
    if (e.button !== 0) return;
    if (e.target.closest(".co-head__btn")) return;
    dragging.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y };
    e.preventDefault();
  };
  _co_ue(() => {
    const onMove = (e) => {
      if (dragging.current) {
        const dx = e.clientX - dragging.current.sx;
        const dy = e.clientY - dragging.current.sy;
        setPos({
          x: Math.max(8, Math.min(window.innerWidth - 200, dragging.current.px + dx)),
          y: Math.max(60, Math.min(window.innerHeight - 80, dragging.current.py + dy)),
        });
      }
      if (resizing.current) {
        const dw = e.clientX - resizing.current.sx;
        const dh = e.clientY - resizing.current.sy;
        setSize({
          w: Math.max(360, Math.min(720, resizing.current.pw + dw)),
          h: Math.max(380, Math.min(900, resizing.current.ph + dh)),
        });
      }
    };
    const onUp = () => { dragging.current = null; resizing.current = null; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // ---- Drop target ----
  const drop = useEntityDropTarget({
    kind: "composition",
    accepts: ["*"],
    onDrop: (payload) => onDropEntity && onDropEntity(payload),
  });

  // Group dropped entities by type
  const grouped = _co_um(() => {
    const g = {};
    (droppedEntities || []).forEach((e, i) => {
      const k = e.entityType || "other";
      if (!g[k]) g[k] = [];
      g[k].push({ ...e, _idx: i });
    });
    return g;
  }, [droppedEntities]);

  // ---- Build preview prompt summary ----
  const buildPrompt = () => {
    if (!droppedEntities.length && !instructions) return "Drop entities and add an instruction to build a prompt.";
    const byType = Object.entries(grouped).map(([t, list]) =>
      "• " + (TYPE_LABELS[t] || t) + ": " + list.map((e) => e.name + (e.role ? " (" + e.role + ")" : "")).join(", ")
    ).join("\n");
    const modeLabel = CO_MODES.find((m) => m.id === mode)?.label || mode;
    return [
      "Mode: " + modeLabel + " · POV: " + pov + " · Length: " + length + " · Tone: " + tone,
      byType,
      instructions ? "Instruction:\n" + instructions : "",
    ].filter(Boolean).join("\n\n");
  };

  if (!open) return null;

  const style = {
    left: pos.x,
    top: pos.y,
    width: size.w,
    ...(size.h ? { height: size.h, maxHeight: size.h } : {}),
  };

  // Minimised "ribbon" mode
  if (minimised) {
    return (
      <div className={"co-root is-minimised " + (pinned ? "is-pinned" : "")} style={style} data-ui="CompositionOverlay" data-state="minimised">
        <div className="co-head" onMouseDown={onHeadDown}>
          <div className="co-head__title">
            <Icon name="sparkle" size={12}/>
            Composition
            <span className="co-head__count">{droppedEntities.length}</span>
          </div>
          <div className="co-head__actions">
            <button type="button" className="co-head__btn" onClick={onMinimise} title="Restore"><Icon name="expand" size={11}/></button>
            <button type="button" className="co-head__btn" onClick={onClose} title="Close"><Icon name="close" size={11}/></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={"co-root " + (pinned ? "is-pinned" : "")} style={style} data-ui="CompositionOverlay" data-state="open">
      {/* Header (drag handle) */}
      <div className="co-head" onMouseDown={onHeadDown}>
        <div className="co-head__title">
          <Icon name="sparkle" size={13}/>
          Compose With Entities
          {droppedEntities.length > 0 && <span className="co-head__count">{droppedEntities.length}</span>}
        </div>
        <div className="co-head__actions">
          <button type="button"
            className={"co-head__btn " + (pinned ? "is-active" : "")}
            onClick={onTogglePin}
            data-callback="onPinEntityCompositionOverlay"
            title={pinned ? "Unpin overlay" : "Pin overlay"}>
            <Icon name="pin-tack" size={11}/>
          </button>
          <button type="button"
            className="co-head__btn"
            onClick={onClearAll}
            data-callback="onClearComposition"
            title="Clear all entities"
            disabled={droppedEntities.length === 0}>
            <Icon name="trash" size={11}/>
          </button>
          <button type="button"
            className="co-head__btn"
            onClick={onMinimise}
            data-callback="onMinimiseEntityCompositionOverlay"
            title="Minimise">
            <Icon name="bars" size={11}/>
          </button>
          <button type="button"
            className="co-head__btn"
            onClick={onClose}
            data-callback="onCloseEntityCompositionOverlay"
            title="Close">
            <Icon name="close" size={11}/>
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="co-body">
        {/* Drop zone (always visible — explicit dashed target) */}
        <div
          className={"co-dropzone " + (drop._isOver ? "is-over" : "")}
          onDragOver={drop.onDragOver}
          onDragLeave={drop.onDragLeave}
          onDrop={drop.onDrop}
          data-ent-drop={drop["data-ent-drop"]}
        >
          <div className="co-dropzone__icon">⊕</div>
          <div className="co-dropzone__title">
            {droppedEntities.length === 0 ? "Drop entities here" : "Drop more entities here"}
          </div>
          <div className="co-dropzone__hint">
            Cast · Items · Locations · Quests · Events · Classes · Races · Stats · Skills · Lore · Refs
          </div>
        </div>

        {/* Dropped entities grouped by type */}
        {Object.entries(grouped).map(([t, list]) => {
          const colors = (window.ENTITY_TYPES && window.ENTITY_TYPES[t]) || {};
          return (
            <div key={t} className="co-group">
              <div className="co-group__head">
                {t in TYPE_LABELS ? TYPE_LABELS[t] : t}
                <span className="co-group__count">{list.length}</span>
              </div>
              {list.map((e) => (
                <div
                  key={e._idx + "-" + e.id}
                  className="co-chip"
                  style={{ "--ec": colors.color, "--es": colors.soft, "--ed": colors.deep }}
                >
                  <div className="co-chip__icon">{(e.name || "?").slice(0, 1)}</div>
                  <div className="co-chip__body">
                    <div className="co-chip__name">{e.name}</div>
                    <div className="co-chip__sub">
                      {e.summary ? <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.summary}</span> : <span style={{ fontStyle: "italic" }}>(no summary)</span>}
                    </div>
                  </div>
                  <div className="co-chip__actions">
                    <select className="co-chip__role-select"
                      value={e.role || CO_DEFAULT_ROLES_BY_TYPE[t] || ""}
                      onChange={(ev) => onUpdateRole && onUpdateRole(e._idx, ev.target.value)}
                      data-callback="onUpdateCompositionEntityRole"
                    >
                      {(CO_ROLES_BY_TYPE[t] || ["referenced"]).map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                    <button
                      type="button" className="co-chip__x"
                      onClick={() => onRemoveEntity && onRemoveEntity(e._idx)}
                      data-callback="onRemoveEntityFromComposition"
                      title="Remove"
                    >×</button>
                  </div>
                </div>
              ))}
            </div>
          );
        })}

        {/* Instructions */}
        <div className="co-instructions">
          <div className="co-instructions__head">What should happen?</div>
          <textarea
            placeholder="A short instruction for the AI. e.g. 'Aelinor uses the Auger to break the Glass Court audience; ends on Saren's reply.'"
            value={instructions}
            onChange={(e) => onUpdateInstructions && onUpdateInstructions(e.target.value)}
            data-callback="onUpdateCompositionInstructions"
          />
        </div>

        {/* Mode */}
        <div>
          <div className="co-set__lbl" style={{ marginBottom: 4 }}>Output mode</div>
          <div className="co-modes">
            {CO_MODES.map((m) => (
              <button key={m.id} type="button"
                className={"co-mode " + (mode === m.id ? "is-active" : "")}
                onClick={() => onSetMode && onSetMode(m.id)}
                data-callback="onSetCompositionMode"
              >{m.label}</button>
            ))}
          </div>
        </div>

        {/* Settings */}
        <div className="co-settings">
          <div className="co-set">
            <span className="co-set__lbl">POV</span>
            <select value={pov} onChange={(e) => onSetPOV && onSetPOV(e.target.value)} data-callback="onSetCompositionPOV">
              {CO_POVS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="co-set">
            <span className="co-set__lbl">Length</span>
            <select value={length} onChange={(e) => onSetLength && onSetLength(e.target.value)} data-callback="onSetCompositionLength">
              {CO_LENGTHS.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="co-set">
            <span className="co-set__lbl">Tone / Style</span>
            <select value={tone} onChange={(e) => onSetTone && onSetTone(e.target.value)} data-callback="onSetCompositionTone">
              {CO_TONES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          <div className="co-set">
            <span className="co-set__lbl">Target chapter</span>
            <select value={settings.chapterTarget || ""} onChange={(e) => onSetChapterTarget && onSetChapterTarget(e.target.value)} data-callback="onSetCompositionChapterTarget">
              <option value="">— current —</option>
              <option>Ch. 7 — Ash & Auger</option>
              <option>Ch. 8 — (reserved)</option>
              <option>Ch. 9 — The Auger's Door</option>
              <option>+ New chapter</option>
            </select>
          </div>
        </div>

        {/* Context options */}
        <div>
          <div className="co-set__lbl" style={{ marginBottom: 4 }}>Context controls</div>
          <div className="co-toggles">
            {CO_CONTEXT_OPTIONS.map((c) => (
              <label key={c.id} className="co-toggle">
                <input
                  type="checkbox"
                  checked={contextOptions[c.id] != null ? contextOptions[c.id] : !!c.defaultOn}
                  onChange={() => onToggleContext && onToggleContext(c.id)}
                />
                {c.label}
              </label>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="co-preview">
          <div className="co-preview__head">
            <Icon name="paper" size={10}/>
            Prompt summary
            <span className="ee-ai-badge" style={{ marginLeft: "auto" }}><Icon name="sparkle" size={9}/> simulated</span>
          </div>
          <pre className="co-preview__summary" style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-serif)", margin: 0 }}>{buildPrompt()}</pre>
          {droppedEntities.length === 0 && (
            <div className="co-preview__warn">Drop at least one entity before generating.</div>
          )}
          {!instructions && droppedEntities.length > 0 && (
            <div className="co-preview__warn">No instruction yet — generated output will rely on entity roles only.</div>
          )}
          {(contextOptions.useManuscriptText || settings.usesAIRemote) && (
            <div className="co-preview__warn">⚠ AI would need to send manuscript text remotely — privacy mode says local-only.</div>
          )}
          <div className="co-preview__meta">
            <span>~{Math.max(200, droppedEntities.length * 80 + instructions.length / 2 | 0)} tok context</span>
            <span>·</span>
            <span>{droppedEntities.length} entities</span>
            <span>·</span>
            <span>{Object.keys(grouped).length} types</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="co-foot">
        <button type="button" className="ee-btn ee-btn--primary" onClick={onGenerateDraft} disabled={droppedEntities.length === 0} data-callback="onGenerateCompositionDraft">
          <Icon name="sparkle" size={11}/> Generate draft
        </button>
        {typeof AIHandoffButton !== "undefined" && (
          <AIHandoffButton
            surface="composition"
            variant="accent"
            label="AI Handoff"
            icon="download"
            context={{
              selectedEntities: droppedEntities,
              entityRoles: (droppedEntities || []).reduce((acc, e) => { if (e && e.id && e.role) acc[e.id] = e.role; return acc; }, {}),
              instructions,
              outputType: (mode === "new-chapter" ? "chapter" :
                           mode === "new-scene"   ? "scene"   :
                           mode === "rewrite"     ? "rewrite" :
                           mode === "outline"     ? "outline" : "paragraph"),
              targetChapterId: settings.targetChapterId || "",
              pov, tone, length,
              projectContext: {
                title: (typeof window !== "undefined" && window.LW_BRAND && window.LW_BRAND.title) || "",
                genre: (typeof window !== "undefined" && window.LW_BRAND && window.LW_BRAND.genre) || "",
              },
            }}
          />
        )}
        <button type="button" className="ee-btn ee-btn--accent" onClick={onInsertDraft} data-callback="onInsertCompositionDraft" title="Insert generated draft below cursor">
          <Icon name="plus" size={11}/> Insert as draft
        </button>
        <button type="button" className="ee-btn ee-btn--outline" onClick={onCreateChapter} data-callback="onCreateChapterFromComposition" title="Create a new chapter from this composition">
          <Icon name="book" size={11}/> New chapter draft
        </button>
        <button type="button" className="ee-btn ee-btn--ghost" onClick={onCopyPrompt} data-callback="onCopyCompositionPrompt" title="Copy raw prompt to clipboard">
          <Icon name="paper" size={11}/> Copy prompt
        </button>
        <button type="button" className="ee-btn ee-btn--ghost" onClick={onSavePreset} data-callback="onSaveCompositionPreset" title="Save as preset for reuse">
          <Icon name="bookmark" size={11}/> Save preset
        </button>
      </div>

      {/* Resize handle */}
      <div className="co-resize" onMouseDown={(e) => {
        if (e.button !== 0) return;
        resizing.current = { sx: e.clientX, sy: e.clientY, pw: size.w, ph: size.h || 600 };
        e.preventDefault();
      }} title="Resize"/>
    </div>
  );
};

Object.assign(window, {
  CompositionOverlay,
  CO_MODES, CO_POVS, CO_LENGTHS, CO_TONES,
  CO_DEFAULT_ROLES_BY_TYPE, CO_ROLES_BY_TYPE, CO_CONTEXT_OPTIONS,
});

// =====================================================================
// entity-drag.jsx — Global entity drag/drop system + status/flag/dormant.
//
// Provides:
//   - ENTITY_DRAG: a tiny pub-sub for the current drag (entityType, id, label)
//   - useEntityDrag()    : hook that returns dragging state
//   - useEntityDraggable(): hook that returns props to spread on any card
//   - useEntityDropTarget(): hook for drop targets, returns props + isOver
//   - EntityStatusPill / EntityStatusMenu / MentionGapWarning / SleepButton
//   - ENTITY_STATUSES constant
//
// Drag payload format (serialized on dataTransfer 'application/x-loom-entity'):
//   { entityType, id, name, summary?, sourcePanelId? }
//
// Drop targets opt in by spreading useEntityDropTarget() props and tagging
// themselves with data-ent-drop="<kind>" (writer-room, composition,
// atlas, timeline, cast, item, location, quest, event, skill-tree).
//
// While ANY drag is in flight, document.body gets data-ent-dragging="<type>"
// so CSS in entity-drag.css can light every valid target.
// =====================================================================

const { useState: _ed_us, useEffect: _ed_ue, useCallback: _ed_uc, useRef: _ed_ur } = React;

// ---------------------------------------------------------------------
// Pub-sub for in-flight drag.
// ---------------------------------------------------------------------
const ENTITY_DRAG = (() => {
  let listeners = new Set();
  let state = { active: false, payload: null };
  return {
    get: () => state,
    set: (next) => {
      state = next;
      if (next.active && next.payload) {
        document.body.setAttribute("data-ent-dragging", next.payload.entityType || "entity");
      } else {
        document.body.removeAttribute("data-ent-dragging");
      }
      listeners.forEach((l) => l(state));
    },
    subscribe: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
  };
})();

const useEntityDrag = () => {
  const [s, set] = _ed_us(ENTITY_DRAG.get());
  _ed_ue(() => ENTITY_DRAG.subscribe(set), []);
  return s;
};

// ---------------------------------------------------------------------
// useEntityDraggable — spread on the card. Optionally pass {handleOnly:true}
// to require the drag to start on a child .ent-grip element.
// ---------------------------------------------------------------------
const useEntityDraggable = ({ entityType, id, name, summary, sourcePanelId, disabled }) => {
  const onDragStart = (e) => {
    if (disabled) { e.preventDefault(); return; }
    const payload = { entityType, id, name, summary, sourcePanelId };
    try {
      e.dataTransfer.setData("application/x-loom-entity", JSON.stringify(payload));
      e.dataTransfer.setData("text/plain", name || id);
      e.dataTransfer.effectAllowed = "copyMove";
    } catch (_err) { /* IE/old */ }
    // Hide the default ghost; show our pretty preview via CSS .is-dragging
    e.currentTarget.classList.add("is-dragging");
    ENTITY_DRAG.set({ active: true, payload });
    // Broadcast app-level callback if attached
    if (typeof window.onStartEntityDrag === "function") {
      try { window.onStartEntityDrag(payload); } catch (_err) { /* */ }
    }
  };
  const onDragEnd = (e) => {
    e.currentTarget.classList.remove("is-dragging");
    ENTITY_DRAG.set({ active: false, payload: null });
    if (typeof window.onEndEntityDrag === "function") {
      try { window.onEndEntityDrag(); } catch (_err) { /* */ }
    }
  };
  return {
    draggable: !disabled,
    onDragStart,
    onDragEnd,
    "data-ent-draggable": entityType,
    "data-ent-id": id,
    className: "ent-draggable",
  };
};

// ---------------------------------------------------------------------
// useEntityDropTarget — spread on the receiving element.
// onDrop receives the payload object.
// ---------------------------------------------------------------------
const useEntityDropTarget = ({ kind, accepts, onDrop, disabled }) => {
  const [isOver, setOver] = _ed_us(false);
  const onDragOver = (e) => {
    if (disabled) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!isOver) setOver(true);
  };
  const onDragLeave = (e) => {
    // Only clear if leaving for outside this element
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setOver(false);
  };
  const handleDrop = (e) => {
    e.preventDefault();
    setOver(false);
    if (disabled) return;
    let payload = null;
    try {
      const raw = e.dataTransfer.getData("application/x-loom-entity");
      if (raw) payload = JSON.parse(raw);
    } catch (_err) { /* */ }
    if (!payload) return;
    if (accepts && !accepts.includes(payload.entityType) && !accepts.includes("*")) return;
    if (onDrop) onDrop(payload, e);
  };
  return {
    onDragOver,
    onDragLeave,
    onDrop: handleDrop,
    "data-ent-drop": kind,
    className: isOver ? "is-hover" : "",
    "data-ent-over": isOver ? "true" : undefined,
    _isOver: isOver,
  };
};

// ---------------------------------------------------------------------
// Drag grip handle — a tiny visual handle. Doesn't affect draggability
// (the whole card is draggable already), it's just a visual cue.
// ---------------------------------------------------------------------
const EntityGrip = ({ size = 12 }) => (
  <span className="ent-grip" aria-hidden="true" title="Drag to composition / panels">
    <Icon name="grip" size={size}/>
  </span>
);

// ---------------------------------------------------------------------
// ENTITY_STATUSES — every entity in the system can carry one of these.
// ---------------------------------------------------------------------
const ENTITY_STATUSES = [
  { id: "active",        label: "Active",        kind: "presence",   tone: "good",     hint: "In play; eligible for suggestions" },
  { id: "important",     label: "Important",     kind: "presence",   tone: "accent",   hint: "Pinned for attention" },
  { id: "needs-review",  label: "Needs review",  kind: "flag",       tone: "warn",     hint: "Missing data or unverified" },
  { id: "unresolved",    label: "Unresolved",    kind: "flag",       tone: "warn",     hint: "Open thread — should resolve before publish" },
  { id: "contradiction", label: "Contradiction", kind: "flag",       tone: "danger",   hint: "Conflicts with another canonical statement" },
  { id: "dormant",       label: "Dormant",       kind: "presence",   tone: "muted",    hint: "Not currently suggested" },
  { id: "retired",       label: "Retired",       kind: "presence",   tone: "muted",    hint: "Removed from active story" },
  { id: "hidden",        label: "Hidden",        kind: "presence",   tone: "muted",    hint: "Hidden from rosters" },
  { id: "draft",         label: "Draft",         kind: "lifecycle",  tone: "muted",    hint: "Not yet active in project" },
  { id: "archived",      label: "Archived",      kind: "lifecycle",  tone: "muted",    hint: "Long-term storage" },
];
const ENTITY_STATUS_BY_ID = Object.fromEntries(ENTITY_STATUSES.map((s) => [s.id, s]));

// ---------------------------------------------------------------------
// EntityStatusPill
// ---------------------------------------------------------------------
const EntityStatusPill = ({ status, onClick, size = "sm", showLabel = true }) => {
  const s = ENTITY_STATUS_BY_ID[status] || ENTITY_STATUS_BY_ID.active;
  return (
    <button
      type="button"
      className={"ent-status ent-status--" + s.id}
      data-ui="EntityStatusPill"
      data-callback="onSetEntityStatus"
      onClick={onClick}
      title={s.hint}
      style={size === "xs" ? { fontSize: 9, padding: "0 5px 0 3px", lineHeight: "14px" } : {}}
    >
      {showLabel ? s.label : ""}
    </button>
  );
};

// ---------------------------------------------------------------------
// EntityStatusMenu — full menu, mounted by EntityFlagButton.
// ---------------------------------------------------------------------
const EntityStatusMenu = ({
  current, doNotSuggest, dormant,
  onSetStatus, onToggleDormant, onToggleDoNotSuggest,
  onFlagImportant, onFlagNeedsReview, onArchive,
  onClose, anchorRect,
}) => {
  const ref = _ed_ur(null);
  _ed_ue(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose && onClose(); };
    setTimeout(() => document.addEventListener("mousedown", onDoc), 0);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [onClose]);

  const style = anchorRect ? {
    top: anchorRect.bottom + 4,
    left: Math.max(8, Math.min(window.innerWidth - 240, anchorRect.left)),
  } : { top: 40, right: 12 };

  const groups = [
    { label: "Presence", items: ENTITY_STATUSES.filter((s) => s.kind === "presence") },
    { label: "Flags",    items: ENTITY_STATUSES.filter((s) => s.kind === "flag") },
    { label: "Lifecycle",items: ENTITY_STATUSES.filter((s) => s.kind === "lifecycle") },
  ];

  return (
    <div className="ent-status-menu" ref={ref} style={style} data-ui="EntityStatusMenu">
      {groups.map((g) => (
        <React.Fragment key={g.label}>
          <div className="ent-status-menu__group">{g.label}</div>
          {g.items.map((s) => (
            <div
              key={s.id}
              className={"ent-status-menu__item " + (current === s.id ? "ent-status-menu__item--current" : "")}
              onClick={() => { onSetStatus && onSetStatus(s.id); onClose && onClose(); }}
            >
              <EntityStatusPill status={s.id} showLabel={false}/>
              <span style={{ flex: 1 }}>{s.label}</span>
              <span style={{ fontSize: 10, color: "var(--ink-4)", maxWidth: 130, textAlign: "right", lineHeight: 1.3 }}>{s.hint}</span>
            </div>
          ))}
        </React.Fragment>
      ))}
      <div className="ent-status-menu__sep"/>
      <div className="ent-status-menu__item" onClick={() => { onToggleDormant && onToggleDormant(); onClose && onClose(); }}>
        <Icon name="moon" size={12}/>
        <span style={{ flex: 1 }}>{dormant ? "Wake entity" : "Put to sleep"}</span>
      </div>
      <div className="ent-status-menu__item" onClick={() => { onToggleDoNotSuggest && onToggleDoNotSuggest(); onClose && onClose(); }}>
        <Icon name={doNotSuggest ? "check" : "close"} size={12}/>
        <span style={{ flex: 1 }}>{doNotSuggest ? "Allow suggestions" : "Do not suggest"}</span>
      </div>
      <div className="ent-status-menu__sep"/>
      <div className="ent-status-menu__item ent-status-menu__item--danger" onClick={() => { onArchive && onArchive(); onClose && onClose(); }}>
        <Icon name="archive" size={12}/>
        <span style={{ flex: 1 }}>Archive</span>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// EntityFlagButton — small icon button that opens EntityStatusMenu.
// ---------------------------------------------------------------------
const EntityFlagButton = ({ status, dormant, doNotSuggest, callbacks }) => {
  const [open, setOpen] = _ed_us(false);
  const [rect, setRect] = _ed_us(null);
  const btnRef = _ed_ur(null);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="rpg-btn rpg-btn--ghost"
        title="Flags / status"
        data-callback="onSetEntityStatus"
        onClick={() => {
          const r = btnRef.current && btnRef.current.getBoundingClientRect();
          setRect(r); setOpen(true);
        }}
        style={{ padding: "3px 6px", display: "inline-flex", alignItems: "center", gap: 4 }}
      >
        <Icon name="bookmark" size={11}/>
      </button>
      {open && (
        <EntityStatusMenu
          current={status}
          dormant={dormant}
          doNotSuggest={doNotSuggest}
          anchorRect={rect}
          onSetStatus={(s) => callbacks?.onSetEntityStatus && callbacks.onSetEntityStatus(s)}
          onToggleDormant={() => callbacks?.onToggleEntityDormant && callbacks.onToggleEntityDormant()}
          onToggleDoNotSuggest={() => callbacks?.onToggleEntityDoNotSuggest && callbacks.onToggleEntityDoNotSuggest()}
          onArchive={() => callbacks?.onArchiveEntity && callbacks.onArchiveEntity()}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

// ---------------------------------------------------------------------
// MentionGapWarning
// ---------------------------------------------------------------------
const MentionGapWarning = ({ chapters, threshold = 3, lastSeen }) => {
  if (chapters == null || chapters < threshold) return null;
  return (
    <span className="ent-mention-gap" title={lastSeen ? "Last mentioned " + lastSeen : ""}>
      <span className="ent-mention-gap__icon">⚠</span>
      {chapters} ch. since mention
    </span>
  );
};

// ---------------------------------------------------------------------
// SleepButton — explicit "put to sleep" / "wake" toggle.
// ---------------------------------------------------------------------
const SleepButton = ({ dormant, onToggle }) => (
  <button
    type="button"
    className={"ent-sleep-btn " + (dormant ? "ent-sleep-btn--wake" : "")}
    data-callback={dormant ? "onWakeEntity" : "onToggleEntityDormant"}
    onClick={onToggle}
    title={dormant ? "Wake this entity (will be suggested again)" : "Put to sleep (will not be actively suggested)"}
  >
    {dormant ? "↑ Wake" : "☾ Sleep"}
  </button>
);

// ---------------------------------------------------------------------
// EntityCardChrome — small composite for dossier headers: status pill +
// flag button + sleep button + (optional) mention-gap warning. Wires
// onSet* callbacks to whatever the panel passes in.
// ---------------------------------------------------------------------
const EntityCardChrome = ({ entity, callbacks }) => {
  const status = entity?.status || "active";
  const dormant = entity?.dormant || status === "dormant";
  const doNotSuggest = entity?.doNotSuggest;
  const lastMentionChapter = entity?.lastMentionChapter;
  const currentChapter = entity?.currentChapter || 7;
  const gap = lastMentionChapter != null ? (currentChapter - lastMentionChapter) : null;
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <EntityStatusPill status={status}/>
      {gap != null && gap >= 3 && (
        <MentionGapWarning chapters={gap} lastSeen={"Ch. " + lastMentionChapter}/>
      )}
      {doNotSuggest && (
        <span className="ent-status ent-status--hidden" title="Excluded from Today / AI Writer suggestions">No-suggest</span>
      )}
      <SleepButton dormant={dormant} onToggle={() => callbacks?.onToggleEntityDormant && callbacks.onToggleEntityDormant()}/>
      <EntityFlagButton status={status} dormant={dormant} doNotSuggest={doNotSuggest} callbacks={callbacks}/>
    </div>
  );
};

// ---------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------
Object.assign(window, {
  ENTITY_DRAG, useEntityDrag, useEntityDraggable, useEntityDropTarget,
  EntityGrip,
  ENTITY_STATUSES, ENTITY_STATUS_BY_ID,
  EntityStatusPill, EntityStatusMenu, EntityFlagButton,
  MentionGapWarning, SleepButton, EntityCardChrome,
});

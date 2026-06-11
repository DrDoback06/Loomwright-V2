// =====================================================================
// full-workspaces.jsx — Full-screen workspace shell + host.
//
// This file provides:
//   • WorkspaceShell           — common top toolbar + body grid (left /
//                                centre / right inspector). Consistent
//                                Exit button + + Create primary action
//                                wired to PANEL_ACCESS metadata.
//   • WorkspaceDragTarget      — the "Drop into Writer's Room" overlay
//                                that appears when a card is dragged
//                                inside an active full workspace.
//   • WorkspaceRelatedToast    — "Related panel opened behind this
//                                workspace" toast.
//   • FullWorkspaceHost        — dispatches by workspaceId to the right
//                                workspace component (see
//                                workspaces-*.jsx for the bodies).
//
// All workspaces share these props from app.jsx (via Host):
//   open, workspaceId, panelKind, sourcePanel, onExit, onOpenEntityEditor,
//   onOpenPanel, onDropEntityIntoComposition, onOpenRelatedPanel,
//   onWorkspaceDragStart, onSetRelatedToast, etc.
// =====================================================================

const { useState: _fw_us, useEffect: _fw_ue, useRef: _fw_ur, useCallback: _fw_uc, useMemo: _fw_um } = React;

// ---------------------------------------------------------------------
// WorkspaceShell — generic shell every workspace renders inside.
// ---------------------------------------------------------------------
const WorkspaceShell = ({
  // Identity
  icon = "stack",
  eyebrow,            // e.g. "Cast"
  title,              // e.g. "Cast Dossier Workspace"
  subtitle,           // serif italic
  crumbs = [],        // [{ label, onClick }]
  entityType,         // for tint
  // Actions
  createLabel,
  onCreate,
  extraActions,       // ReactNode rendered between exit and primary
  onExit,
  // Body
  cols = "lcr",       // "lcr" | "lc" | "cr" | "c" | "lcr-wide"
  left, main, right,
  bottom,
  // Drag-into-WritersRoom + related-panel overlays
  dragTargetVisible,
  toast,
  onDismissToast,
}) => {
  const t = entityType ? ENTITY_TYPES[entityType] : null;
  const style = t ? { "--ec": t.color, "--es": t.soft, "--ed": t.deep } : {};

  return (
    <div className="fws-overlay paper-grain" data-ui="WorkspaceShell" style={style}
      data-entity={entityType || undefined}>
      <div className="fws-topbar">
        <div className="fws-topbar__lead">
          <div className="fws-topbar__icon">
            {t ? <span style={{ fontFamily: "var(--font-display)", fontSize: 14 }}>{t.glyph}</span> : <Icon name={icon} size={16}/>}
          </div>
          <div className="fws-topbar__titles">
            {eyebrow && <div className="fws-topbar__eyebrow">{eyebrow}</div>}
            <div className="fws-topbar__title">{title}</div>
            {subtitle && <div className="fws-topbar__sub">{subtitle}</div>}
          </div>
          {crumbs.length > 0 && (
            <div className="fws-topbar__crumbs">
              {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="fws-topbar__crumbs__sep">›</span>}
                  {c.onClick
                    ? <button className="fws-section__action" onClick={c.onClick}>{c.label}</button>
                    : <span>{c.label}</span>}
                </React.Fragment>
              ))}
            </div>
          )}
        </div>
        <div className="fws-topbar__spacer"/>
        <div className="fws-topbar__actions">
          {typeof HelpButton !== "undefined" && <HelpButton title="Help for this workspace"/>}
          {extraActions}
          {createLabel && onCreate && (
            <button type="button" className="fws-topbar__primary"
              onClick={onCreate}
              data-callback="onWorkspaceCreateEntity">
              <Icon name="plus" size={11}/> {createLabel}
            </button>
          )}
          <button type="button" className="fws-topbar__exit"
            onClick={onExit}
            data-callback="onExitPanelWorkspace"
            title="Exit workspace (Esc)">
            <Icon name="close" size={11}/> Exit Workspace
          </button>
        </div>
      </div>

      <div className="fws-body" data-cols={cols}>
        {left  && <div className="fws-left" data-ui="WorkspaceLeftRail">{left}</div>}
        <div className="fws-main">
          <div className="fws-main__inner">{main}</div>
        </div>
        {right && <div className="fws-right" data-ui="WorkspaceRightInspector">{right}</div>}
      </div>

      {bottom && <div className="fws-strip">{bottom}</div>}

      {dragTargetVisible && (
        <div className="fws-drag-target" data-ui="WorkspaceDragTarget">
          <div className="fws-drag-target__card">
            <Icon name="feather" size={14}/> Drop into Writer's Room composition
          </div>
        </div>
      )}

      {toast && (
        <div className="fws-toast" data-ui="WorkspaceRelatedToast">
          <Icon name="info" size={12}/>
          <div>
            <div className="fws-toast__title">{toast.title || "Related panel opened"}</div>
            {toast.sub && <div style={{ color: "var(--ink-3)", fontSize: 11 }}>{toast.sub}</div>}
          </div>
          {toast.action && (
            <button className="fws-toast__action" onClick={toast.action.onClick}>{toast.action.label}</button>
          )}
          <button className="fws-toast__action" onClick={onDismissToast} title="Dismiss">Dismiss</button>
        </div>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------
// Common building blocks used by workspaces.
// ---------------------------------------------------------------------
const WorkspaceSection = ({ title, count, action, children }) => (
  <>
    <div className="fws-section">
      <span className="fws-section__title">{title}</span>
      {count !== undefined && <span className="fws-section__count">{count}</span>}
      <span className="fws-section__spacer"/>
      {action && <button className="fws-section__action" onClick={action.onClick}>{action.label}</button>}
    </div>
    {children}
  </>
);

const WorkspaceFilters = ({ filters, active, onChange }) => (
  <div className="fws-filters">
    {filters.map((f) => (
      <button key={f.key}
        className={"fws-filter " + (active === f.key ? "is-on" : "")}
        onClick={() => onChange(f.key)}>
        {f.icon && <Icon name={f.icon} size={9}/>}
        <span>{f.label}</span>
        {f.count !== undefined && <span>({f.count})</span>}
      </button>
    ))}
  </div>
);

const WorkspaceRosterRow = ({
  item, selected, onClick, onDragStart, avatar, name, sub, meta, badges,
}) => {
  const dragHandlers = onDragStart ? {
    draggable: true,
    onDragStart: (e) => {
      e.dataTransfer.effectAllowed = "copy";
      // Set generic + Loomwright-specific payloads so Composition Overlay
      // and other drop targets can claim it.
      try {
        e.dataTransfer.setData("text/loomwright-entity", JSON.stringify(item));
      } catch (_) { /* nothing */ }
      try { e.dataTransfer.setData("text/plain", item.name || item.label || item.id || ""); } catch (_) {}
      onDragStart(item, e);
    },
  } : {};
  return (
    <div className={"fws-roster__row " + (selected ? "is-selected" : "")}
      data-ui="WorkspaceRosterRow"
      data-entity-id={item?.id}
      {...dragHandlers}
      onClick={onClick}>
      {avatar !== false && (
        <div className="fws-roster__row__avatar">{avatar || (name || "?").slice(0, 1)}</div>
      )}
      <div className="fws-roster__row__body">
        <div className="fws-roster__row__name">{name}</div>
        {sub && <div className="fws-roster__row__sub">{sub}</div>}
      </div>
      {meta && <div className="fws-roster__row__meta">{meta}</div>}
      {badges}
    </div>
  );
};

const WorkspaceTabs = ({ tabs, active, onChange }) => (
  <div className="fws-tabs">
    {tabs.map((t) => (
      <button key={t.id}
        className={"fws-tabs__btn " + (active === t.id ? "is-on" : "")}
        onClick={() => onChange(t.id)}>
        {t.label}
        {t.count !== undefined && t.count > 0 && (
          <span style={{
            marginLeft: 4,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 14,
            height: 14,
            padding: "0 4px",
            borderRadius: 7,
            background: "var(--accent-soft)",
            color: "var(--accent-deep)",
            fontSize: 9,
          }}>{t.count}</span>
        )}
      </button>
    ))}
  </div>
);

const WorkspaceCard = ({ title, sub, action, children, style, testId }) => (
  <div className="fws-card" style={style} data-testid={testId || undefined}>
    {(title || sub || action) && (
      <div className="fws-card__head">
        {title && <span className="fws-card__title">{title}</span>}
        {sub && <span className="fws-card__sub">{sub}</span>}
        <span className="fws-card__spacer"/>
        {action}
      </div>
    )}
    {children}
  </div>
);

const WorkspaceKV = ({ rows }) => (
  <div className="fws-kv">
    {rows.map((r, i) => (
      <React.Fragment key={i}>
        <div className="fws-kv__k">{r.k}</div>
        <div className="fws-kv__v">{r.v ?? <span style={{ color: "var(--ink-4)" }}>—</span>}</div>
      </React.Fragment>
    ))}
  </div>
);

// ---------------------------------------------------------------------
// Live-store plumbing shared by every full workspace.
//
// Workspaces must read the LIVE entity store (EntityService) — never the
// boot-time ENTITY_SAMPLES globals, which are quarantined to {} on real
// projects (see backend-services sample handling). useLiveEntities
// subscribes to store updates; useWorkspaceSelection honours the entityId
// the opening panel passed so the full editor lands on the tab's
// selected record instead of items[0].
// ---------------------------------------------------------------------
const useLiveEntities = (type, map) => {
  const [tick, setTick] = _fw_us(0);
  _fw_ue(() => {
    const bump = () => setTick((t) => t + 1);
    const evs = ["lw:entity-store-updated", "lw:backend-ready", "lw:project-imported", "lw:occurrences-updated"];
    evs.forEach((e) => window.addEventListener(e, bump));
    return () => evs.forEach((e) => window.removeEventListener(e, bump));
  }, []);
  return _fw_um(() => {
    const rows = (window.LoomwrightBackend?.EntityService?.listSync?.(type) || [])
      .filter((e) => e && e.status !== "deleted");
    return map ? rows.map(map).filter(Boolean) : rows;
  }, [type, tick]);
};

const useWorkspaceSelection = (items, entityId) => {
  const [selectedId, setSelectedId] = _fw_us(() => entityId || items[0]?.id || null);
  // Re-focus when the host hands us a (new) entityId — e.g. the user
  // selected a different row in the panel and reopened the workspace.
  _fw_ue(() => {
    if (entityId) setSelectedId(entityId);
  }, [entityId]);
  // If the selected record vanishes from the store (deleted elsewhere),
  // fall back to the first row rather than rendering a ghost.
  _fw_ue(() => {
    if (!items.length) { if (selectedId !== null) setSelectedId(null); return; }
    if (!items.some((x) => x.id === selectedId)) setSelectedId(entityId && items.some((x) => x.id === entityId) ? entityId : items[0].id);
  }, [items, selectedId, entityId]);
  return [selectedId, setSelectedId];
};

const WorkspaceEmptyState = ({ entityType, noun, onCreate }) => (
  <div className="fws-empty" data-ui="WorkspaceEmptyState">
    <div className="fws-empty__icon"><Icon name={(typeof ENTITY_TYPES !== "undefined" && ENTITY_TYPES[entityType]?.icon) || "stack"} size={22}/></div>
    <h3>No {noun || "records"} yet</h3>
    <p>Nothing has been recorded here. Create one by hand, or let extraction find them in your manuscript.</p>
    <div className="fws-empty__actions">
      {onCreate && (
        <button type="button" className="fws-topbar__primary" onClick={onCreate} data-callback="onWorkspaceCreateEntity">
          <Icon name="plus" size={11}/> Create
        </button>
      )}
      <button type="button" className="fws-topbar__exit"
        data-callback="onRunChapterExtraction"
        onClick={() => window.dispatchEvent(new CustomEvent("lw:open-extraction-wizard", { detail: { scope: "manuscript", typeFocus: entityType || null } }))}>
        <Icon name="sparkle" size={11}/> Extract from manuscript
      </button>
    </div>
  </div>
);

// Generic record/reference helpers shared by all workspace files
// (this file loads before workspaces-rpg/-narrative/-system in the shell).
const _fwData = (e) => (e && e.data && typeof e.data === "object" ? e.data : {});
const _fwRefId = (v) => (v == null ? null : (typeof v === "object" ? (v.id || null) : String(v)));
const _fwInitials = (name) => (name || "?").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

// Chapter id → number map + ordered chapter list (live read).
const _fwChapterState = () => {
  const B = window.LoomwrightBackend;
  let chapters = [];
  try { chapters = (B?.ManuscriptChapterService?.loadSync?.()?.chapters || []).filter((c) => c && !c.reserved); } catch (_) {}
  const num = new Map();
  chapters.forEach((c, i) => num.set(c.id, c.num || i + 1));
  return { chapters, num };
};

// Occurrences for an entity, decorated with chapter numbers, prose first.
const _fwOccsFor = (entityId) => {
  const B = window.LoomwrightBackend;
  if (!entityId || !B?.OccurrenceService?.listByEntitySync) return [];
  const { num } = _fwChapterState();
  return (B.OccurrenceService.listByEntitySync(entityId) || [])
    .map((o) => ({ ...o, chapterNum: num.get(o.chapterId) ?? null }))
    .sort((a, b) => (a.chapterNum ?? 999) - (b.chapterNum ?? 999) || (a.isPronounResolution ? 1 : 0) - (b.isPronounResolution ? 1 : 0));
};

const _fwSpan = (occs) => {
  const nums = [...new Set(occs.map((o) => o.chapterNum).filter((n) => n != null))].sort((a, b) => a - b);
  if (!nums.length) return "";
  return nums.length === 1 ? "Ch." + nums[0] : "Ch." + nums[0] + "–" + nums[nums.length - 1];
};

// Does a record's data reference the given entity id anywhere? Ids are
// uuids, so a substring scan over the serialised data is exact enough
// and far cheaper than walking every related-multi field by name.
const _fwReferencesEntity = (rec, id) => {
  if (!rec || !id) return false;
  try { return JSON.stringify(rec.data || {}).includes(id); } catch (_) { return false; }
};

const _fwQuoteCard = (m, i) => (
  <div key={i} style={{ padding: 10, background: "var(--bg-paper-2)", border: "1px solid var(--line-2)", borderRadius: "var(--r-2)", marginBottom: 6, fontSize: 12 }}>
    <div style={{ fontSize: 10, color: "var(--ink-3)", marginBottom: 4 }}>{m.ch}</div>
    <div style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", color: "var(--ink-1)" }}>"{m.q}"</div>
  </div>
);

const _fwTabEmpty = (text) => <div className="fws-empty" style={{ padding: 20 }}>{text}</div>;

// ---------------------------------------------------------------------
// FullRecordSection — the config-driven "everything the schema knows"
// renderer appended to every full workspace. Reads the same
// ENTITY_EDITOR_CONFIGS the entity editor uses, so the workspace is a
// strict superset of the panel view and can never drift from the schema.
// ---------------------------------------------------------------------
const _fwRefName = (ref, relatedType) => {
  if (ref == null || ref === "") return null;
  const ES = window.LoomwrightBackend?.EntityService;
  if (typeof ref === "string" || typeof ref === "number") {
    const ent = ES?.getSync?.(String(ref), relatedType);
    return ent ? (ent.name || ent.title || String(ref)) : String(ref);
  }
  if (typeof ref === "object") {
    if (ref.id) {
      const ent = ES?.getSync?.(ref.id, ref.type || relatedType);
      if (ent) return ent.name || ent.title || ref.name || ref.id;
    }
    return ref.name || ref.title || ref.label || (ref.id ? String(ref.id) : null);
  }
  return String(ref);
};

const _fwHasValue = (v) => {
  if (v == null || v === "") return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.values(v).some((x) => x != null && x !== "");
  return true;
};

const _fwFieldBody = (field, value) => {
  const kind = field.kind || "text";
  if (kind === "toggle") return <span>{value ? "Yes" : "No"}</span>;
  if (kind === "related" || kind === "parent-picker") return <span>{_fwRefName(value, field.related) || "—"}</span>;
  if (Array.isArray(value)) {
    if (kind === "step-list" || kind === "branch-list") {
      return (
        <ol className="fws-frs__list">
          {value.map((s, i) => (
            <li key={i}>
              {(s && typeof s === "object" ? (s.title || s.label || s.name || "Step " + (i + 1)) : String(s))}
              {s && typeof s === "object" && (s.status || s.chapter != null) && (
                <span className="fws-frs__list-meta">
                  {[s.status, s.chapter != null ? "Ch. " + s.chapter : null].filter(Boolean).join(" · ")}
                </span>
              )}
            </li>
          ))}
        </ol>
      );
    }
    if (kind === "stat-grid") {
      return <span>{value.map((s) => (s?.name || "?") + (s?.value != null ? " " + s.value : "")).join(" · ")}</span>;
    }
    if (kind === "rule-list" || kind === "effects-list" || kind === "extraction-rule-list") {
      return (
        <ul className="fws-frs__list">
          {value.map((r, i) => (
            <li key={i}>{[
              r?.target || r?.name || r?.phrase || r?.trigger,
              r?.delta != null ? (r.delta > 0 ? "+" + r.delta : String(r.delta)) : null,
              r?.note || r?.effect || r?.treatedAs,
            ].filter(Boolean).join(" — ") || JSON.stringify(r)}</li>
          ))}
        </ul>
      );
    }
    return (
      <div className="fws-frs__chips">
        {value.map((v, i) => (
          <span key={i} className="fws-chip">{typeof v === "object" ? (_fwRefName(v, field.related) || "?") : String(v)}</span>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    if (kind === "dual-number" || (value.x != null && value.y != null)) return <span>{value.x + ", " + value.y}</span>;
    if (value.id || value.name) return <span>{_fwRefName(value, field.related)}</span>;
    const entries = Object.entries(value).filter(([, v2]) => v2 != null && v2 !== "");
    return <span>{entries.map(([k, v2]) => k + ": " + (typeof v2 === "object" ? JSON.stringify(v2) : v2)).join(" · ")}</span>;
  }
  if (kind === "longtext" || kind === "textarea") return <p className="fws-frs__para">{String(value)}</p>;
  return <span>{String(value)}</span>;
};

const FullRecordSection = ({ entity, type, title }) => {
  if (!entity) return null;
  const reg = window.ENTITY_EDITOR_CONFIGS || {};
  const cfg = reg[type] || reg.generic;
  if (!cfg) return null;
  const data = entity.data && typeof entity.data === "object" ? entity.data : {};
  const valueFor = (f) => (data[f.id] !== undefined ? data[f.id] : entity[f.id]);
  const sections = (cfg.sections || [])
    .map((s) => ({ ...s, populated: (s.fields || []).filter((f) => _fwHasValue(valueFor(f))) }))
    .filter((s) => s.populated.length > 0);
  const openEditor = (sectionId) => {
    window.dispatchEvent(new CustomEvent("lw:open-entity-editor", {
      detail: { type, initial: { id: entity.id }, mode: "full", sectionId: sectionId || undefined },
    }));
  };
  return (
    <div className="fws-frs" data-ui="FullRecordSection">
      <WorkspaceSection title={title || "Full record"}
        count={sections.reduce((n, s) => n + s.populated.length, 0)}
        action={{ label: "Open editor", onClick: () => openEditor() }}/>
      {sections.length === 0 && (
        <WorkspaceCard>
          <p className="fws-frs__para" style={{ color: "var(--ink-3)" }}>
            Only the basics are recorded so far. Open the editor to fill out this record.
          </p>
        </WorkspaceCard>
      )}
      {sections.map((s) => (
        <WorkspaceCard key={s.id} title={s.title} testId={"frs-" + s.id}
          action={<button className="fws-section__action" data-callback="onEditEntity" onClick={() => openEditor(s.id)}>Edit</button>}>
          <div className="fws-frs__grid">
            {s.populated.map((f) => (
              <React.Fragment key={f.id}>
                <div className="fws-kv__k">{f.label}</div>
                <div className="fws-kv__v">{_fwFieldBody(f, valueFor(f))}</div>
              </React.Fragment>
            ))}
          </div>
        </WorkspaceCard>
      ))}
    </div>
  );
};

// ---------------------------------------------------------------------
// FullWorkspaceHost — dispatcher. Picks the right workspace by id.
//
// Workspace component contract: ({ context, onExit, onRequest }) => JSX
// where `context` includes panelKind/sourcePanel and `onRequest` lets
// the workspace ask the app shell to open the entity editor, open a
// related panel, drop into composition, or set the related-panel toast.
// ---------------------------------------------------------------------
const FullWorkspaceHost = ({
  workspace,                  // { id, panelKind, sourcePanel, entityId, name }
  onExit,
  onOpenEntityEditor,
  onOpenPanel,
  onDropEntityIntoComposition,
  onSwitchWorkspaceRequest,
}) => {
  const [dragTargetVisible, setDragTargetVisible] = _fw_us(false);
  const [toast, setToast] = _fw_us(null);

  // Esc closes workspace.
  _fw_ue(() => {
    if (!workspace?.id) return;
    const onKey = (e) => {
      if (e.key === "Escape") onExit && onExit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workspace?.id, onExit]);

  // Global drag listeners — when the user drags an entity from anywhere
  // inside the workspace, show the WritersRoom drop target overlay so
  // they can release it.
  _fw_ue(() => {
    if (!workspace?.id) return;
    let dragging = false;
    const onDragStart = (e) => {
      // Only respond to entity-typed drags
      const types = e.dataTransfer?.types;
      if (!types) return;
      if (Array.from(types).some((tt) => tt.includes("loomwright-entity"))) {
        dragging = true;
        setDragTargetVisible(true);
      }
    };
    const onDragEnd = () => {
      if (dragging) {
        dragging = false;
        setDragTargetVisible(false);
      }
    };
    const onDrop = (e) => {
      if (!dragging) return;
      dragging = false;
      setDragTargetVisible(false);
      try {
        const raw = e.dataTransfer?.getData("text/loomwright-entity");
        if (raw) {
          const data = JSON.parse(raw);
          onDropEntityIntoComposition && onDropEntityIntoComposition({
            entityType: data.entityType || workspace.panelKind,
            id: data.id || ("ws-" + Date.now()),
            name: data.name || data.label || data.title || "Untitled",
            summary: data.summary,
          });
          setToast({
            title: "Added to Writer's Room",
            sub: (data.name || "Entity") + " queued in Composition overlay.",
            action: { label: "Exit to view", onClick: onExit },
          });
          setTimeout(() => setToast(null), 4200);
        }
      } catch (_) { /* swallow */ }
    };
    window.addEventListener("dragstart", onDragStart);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("drop", onDrop, true);
    return () => {
      window.removeEventListener("dragstart", onDragStart);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("drop", onDrop, true);
    };
  }, [workspace?.id, workspace?.panelKind, onDropEntityIntoComposition, onExit]);

  if (!workspace || !workspace.id) return null;

  const onRequest = {
    openEntityEditor: (opts) => onOpenEntityEditor && onOpenEntityEditor(opts),
    openPanel: (kind, ctx) => {
      onOpenPanel && onOpenPanel(kind, ctx);
      setToast({
        title: "Related panel opened behind this workspace",
        sub: "Exit the workspace to see it in the panel stack.",
        action: { label: "Exit to view", onClick: onExit },
      });
      setTimeout(() => setToast(null), 4200);
    },
    setToast,
    dropIntoComposition: (payload) => {
      onDropEntityIntoComposition && onDropEntityIntoComposition(payload);
      setToast({ title: "Added to Writer's Room", sub: (payload.name || "Entity") + " queued.", action: { label: "Exit to view", onClick: onExit }});
      setTimeout(() => setToast(null), 4200);
    },
    switchWorkspace: (newId) => onSwitchWorkspaceRequest && onSwitchWorkspaceRequest(newId),
  };

  // Lookup the workspace component on window.
  const registry = window.WORKSPACE_COMPONENTS || {};
  const Comp = registry[workspace.id];

  if (!Comp) {
    return (
      <WorkspaceShell
        icon="warn"
        eyebrow="Workspace"
        title={workspace.name || workspace.id}
        subtitle={"Workspace not registered for id: " + workspace.id}
        cols="c"
        main={
          <div className="fws-empty">
            <p>No workspace component is registered for <code>{workspace.id}</code>.</p>
            <p style={{ marginTop: 8 }}>Register it via <code>window.WORKSPACE_COMPONENTS["{workspace.id}"]</code>.</p>
          </div>
        }
        onExit={onExit}
      />
    );
  }

  return (
    // data-workspace-id lets tests (and other observers) identify which
    // workspace is currently open without parsing the inner DOM. Pure
    // attribute addition; doesn't affect layout, styling, or behaviour.
    <div data-ui="FullWorkspaceHost" data-workspace-id={workspace.id} style={{ display: "contents" }}>
      <Comp
        workspace={workspace}
        onExit={onExit}
        onRequest={onRequest}
        dragTargetVisible={dragTargetVisible}
        toast={toast}
        onDismissToast={() => setToast(null)}
      />
    </div>
  );
};

Object.assign(window, {
  WorkspaceShell,
  WorkspaceSection,
  WorkspaceFilters,
  WorkspaceRosterRow,
  WorkspaceTabs,
  WorkspaceCard,
  WorkspaceKV,
  useLiveEntities,
  useWorkspaceSelection,
  WorkspaceEmptyState,
  FullRecordSection,
  FullWorkspaceHost,
});

// Initialise the registry — workspace files register themselves into it.
if (!window.WORKSPACE_COMPONENTS) window.WORKSPACE_COMPONENTS = {};

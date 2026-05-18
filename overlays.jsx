// =====================================================================
// overlays.jsx — CommandPalette + AdaptiveWheelHost
//
// State coverage:
//   - empty, loading, error, partial, hover, focus, selected, disabled
//   - review-queue badges where relevant (palette rows + wheel slots)
//   - mobile collapse note baked into footer hints
//
// Strict callback / data-attr coverage on every interactive element.
// All callback names mirror the global namespace (onRunCommand,
// onClosePalette, onScopeChange, onRunWheelAction, onCloseWheel,
// onPinSlot, onOpenPanel, etc.).
// =====================================================================

const { useState: _us_cp, useEffect: _ue_cp, useRef: _ur_cp, useMemo: _um_cp, useCallback: _uc_cp } = React;

// ---------------------------------------------------------------------
// CommandPalette
// ---------------------------------------------------------------------
const PALETTE_DATA = {
  recent: [
    { id: "r1", icon: "feather", title: "Open Writer's Room",  sub: "Recent",        kbd: ["⌘", "1"] },
    { id: "r2", icon: "user",    title: "Aelinor Vey",          sub: "Cast • Recent", entity: "cast",   queue: 2 },
    { id: "r3", icon: "scroll",  title: "Quest: The Glass Vow", sub: "Quests",        entity: "quests", queue: 1 },
  ],
  suggested: [
    { id: "s1", icon: "plus",     title: "Create new chapter",            sub: "Action",        kbd: ["⌘", "⇧", "N"] },
    { id: "s2", icon: "sparkle",  title: "Run extraction on chapter 7",   sub: "AI Action",     kbd: ["⌘", "E"] },
    { id: "s3", icon: "wheel",    title: "Open Adaptive Wheel here",      sub: "Action",        kbd: ["␣"] },
    { id: "s4", icon: "lock",     title: "Toggle privacy mode",            sub: "AI Action",     kbd: ["⌘", "⇧", "P"], disabled: true, reason: "Cloud sync unavailable offline" },
  ],
  entities: [
    { id: "e1", icon: "user",  entity: "cast",      title: "Saren of Hess",          sub: "Cast" },
    { id: "e2", icon: "pin",   entity: "locations", title: "Pale Reach, the",        sub: "Locations", queue: 1 },
    { id: "e3", icon: "gem",   entity: "items",     title: "Auger of Hess",          sub: "Items" },
    { id: "e4", icon: "book",  entity: "lore",      title: "The Hollowing (canon)",  sub: "Lore",   queue: 3 },
  ],
  chapters: [
    { id: "c1", icon: "book", title: "Ch. 1 — A small dark queen",  sub: "Manuscript" },
    { id: "c2", icon: "book", title: "Ch. 7 — Glass and bone",       sub: "Manuscript", queue: 5 },
    { id: "c3", icon: "book", title: "Ch. 9 — (reserved)",            sub: "Manuscript", disabled: true, reason: "Reserved by another author" },
  ],
  tabs: [
    { id: "t1", icon: "feather", title: "Go to Writer's Room", sub: "Tab", kbd: ["G", "W"] },
    { id: "t2", icon: "compass", title: "Go to Atlas",         sub: "Tab", kbd: ["G", "A"] },
    { id: "t3", icon: "scroll",  title: "Go to Quests",        sub: "Tab", kbd: ["G", "Q"] },
  ],
};

const PALETTE_SCOPES = [
  { id: "all",      label: "All",      icon: "search" },
  { id: "entities", label: "Entities", icon: "stack" },
  { id: "chapters", label: "Chapters", icon: "book" },
  { id: "actions",  label: "Actions",  icon: "bolt" },
];

const CommandPalette = ({
  open,
  state = "ready",          // "ready" | "loading" | "error" | "empty-source" | "partial"
  errorMessage,
  onClose,
  onRunCommand,
  onScopeChange,
  onRetry,
}) => {
  const [q, setQ] = _us_cp("");
  const [sel, setSel] = _us_cp(0);
  const [scope, setScope] = _us_cp("all");
  const inputRef = _ur_cp(null);

  _ue_cp(() => { if (open) { setQ(""); setSel(0); setTimeout(() => inputRef.current?.focus(), 50); } }, [open]);

  const filtered = _um_cp(() => {
    const ql = q.trim().toLowerCase();
    const filterRows = (rows) => !ql ? rows : rows.filter((r) => r.title.toLowerCase().includes(ql) || (r.sub || "").toLowerCase().includes(ql));
    const groups = [
      { id: "recent",    label: "Recent",            rows: filterRows(PALETTE_DATA.recent) },
      { id: "suggested", label: "Suggested actions", rows: filterRows(PALETTE_DATA.suggested) },
      { id: "entities",  label: "Entities",          rows: filterRows(PALETTE_DATA.entities) },
      { id: "chapters",  label: "Chapters",          rows: filterRows(PALETTE_DATA.chapters) },
      { id: "tabs",      label: "Tabs & navigation", rows: filterRows(PALETTE_DATA.tabs) },
    ];
    // Scope filter
    const byScope = (g) => {
      if (scope === "all") return true;
      if (scope === "entities") return g.id === "entities" || g.id === "recent";
      if (scope === "chapters") return g.id === "chapters";
      if (scope === "actions")  return g.id === "suggested" || g.id === "tabs";
      return true;
    };
    return groups.filter((g) => g.rows.length && byScope(g));
  }, [q, scope]);

  const flat = _um_cp(() => filtered.flatMap((g) => g.rows.map((r) => ({ ...r, group: g.id }))), [filtered]);

  const handleScope = _uc_cp((id) => { setScope(id); setSel(0); onScopeChange && onScopeChange(id); }, [onScopeChange]);

  // Skip disabled rows when navigating with keyboard
  _ue_cp(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose && onClose(); }
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSel((s) => {
          let next = s;
          for (let i = 0; i < flat.length; i++) {
            next = Math.min(flat.length - 1, next + 1);
            if (!flat[next]?.disabled) break;
          }
          return next;
        });
      }
      else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSel((s) => {
          let next = s;
          for (let i = 0; i < flat.length; i++) {
            next = Math.max(0, next - 1);
            if (!flat[next]?.disabled) break;
          }
          return next;
        });
      }
      else if (e.key === "Enter") {
        e.preventDefault();
        const row = flat[sel];
        if (row && !row.disabled) { onRunCommand && onRunCommand(row); onClose && onClose(); }
      }
      else if ((e.metaKey || e.ctrlKey) && /^[1-4]$/.test(e.key)) {
        e.preventDefault();
        handleScope(PALETTE_SCOPES[parseInt(e.key, 10) - 1].id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, flat, sel, onClose, onRunCommand, handleScope]);

  if (!open) return null;

  // ----- body renderers per state -----
  const renderBody = () => {
    if (state === "loading") {
      return (
        <div className="palette__state">
          <LoadingState title="Searching index…" lines={4}/>
        </div>
      );
    }
    if (state === "error") {
      return (
        <div className="palette__state">
          <ErrorState
            title="Search index didn't respond"
            body={errorMessage || "Your manuscript is safe. Try again, or work offline."}
            onRetry={onRetry}
          />
        </div>
      );
    }
    if (state === "empty-source") {
      return (
        <div className="palette__state">
          <EmptyState
            icon="search"
            title="No history yet"
            body="Recent commands and entities will appear here as you work."
          />
        </div>
      );
    }
    if (filtered.length === 0) {
      return (
        <div className="palette__state">
          <EmptyState
            icon="search"
            title="No matches"
            body={"Nothing for \u201c" + q + "\u201d in this scope. Try a chapter name, entity, or another scope."}
            action={
              <Btn
                variant="ghost" size="sm" icon="stack"
                data-callback="onScopeChange" data-testid="palette-empty-broaden"
                onClick={() => handleScope("all")}
              >
                Search all
              </Btn>
            }
          />
        </div>
      );
    }

    let runningIdx = -1;
    return filtered.map((g) => (
      <div key={g.id} className="palette__group" data-ui="CommandPaletteGroup" data-group={g.id}>
        <div className="palette__group-lbl">{g.label}</div>
        {g.rows.map((r) => {
          runningIdx += 1;
          const idx = runningIdx;
          const isSel = idx === sel;
          const cls = [
            "palette__row",
            isSel && !r.disabled ? "is-selected" : "",
            r.disabled ? "is-disabled" : "",
          ].filter(Boolean).join(" ");
          return (
            <div
              key={r.id}
              className={cls}
              data-ui="CommandPaletteRow"
              data-callback="onRunCommand"
              data-testid={"palette-row-" + r.id}
              data-disabled={r.disabled || undefined}
              role="option"
              aria-disabled={r.disabled || undefined}
              aria-selected={isSel || undefined}
              tabIndex={r.disabled ? -1 : 0}
              onMouseEnter={() => !r.disabled && setSel(idx)}
              onClick={() => { if (r.disabled) return; onRunCommand && onRunCommand(r); onClose && onClose(); }}
              title={r.disabled ? r.reason : undefined}
            >
              <span className="palette__row__icon">
                {r.entity ? <span className="e-dot" style={{ "--ec": ENTITY_TYPES[r.entity]?.color }}/> : <Icon name={r.icon} size={14}/>}
              </span>
              <span className="palette__row__title">{r.title}</span>
              {r.queue ? <ReviewCountBadge count={r.queue} tone="warn"/> : null}
              {r.disabled && <span className="palette__row__lock"><Icon name="lock" size={11}/></span>}
              <span className="palette__row__sub">{r.disabled ? (r.reason || "Disabled") : r.sub}</span>
              {r.kbd && !r.disabled && (
                <span className="palette__row__kbd">{r.kbd.map((k, i) => <Kbd key={i}>{k}</Kbd>)}</span>
              )}
            </div>
          );
        })}
      </div>
    ));
  };

  return (
    <div
      className="palette-backdrop"
      data-ui="CommandPalette"
      data-state={state}
      data-testid="command-palette"
      onClick={onClose}
    >
      <div
        className="palette"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
        aria-busy={state === "loading" || undefined}
      >
        <div className="palette__input">
          <Icon name="search" size={16}/>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            placeholder="Search entities, chapters, commands…"
            data-ui="CommandPaletteInput"
            data-callback="onQueryChange"
            data-testid="palette-input"
            aria-label="Search command palette"
            disabled={state === "loading"}
          />
          {q && state !== "loading" && (
            <button
              type="button"
              className="palette__input__clear"
              data-ui="CommandPaletteClear"
              data-callback="onQueryChange"
              data-testid="palette-clear"
              aria-label="Clear search"
              onClick={() => { setQ(""); inputRef.current?.focus(); }}
            >
              <Icon name="close" size={11}/>
            </button>
          )}
          <Kbd>esc</Kbd>
          <button
            type="button"
            className="palette__input__close"
            data-ui="CommandPaletteClose"
            data-callback="onClosePalette"
            data-testid="palette-close"
            aria-label="Close palette"
            onClick={onClose}
          >
            <Icon name="close" size={12}/>
          </button>
        </div>

        <div className="palette__scopes" role="tablist" aria-label="Search scope">
          {PALETTE_SCOPES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={scope === s.id}
              className={"palette__scope " + (scope === s.id ? "is-active" : "")}
              data-ui="CommandPaletteScope"
              data-callback="onScopeChange"
              data-testid={"palette-scope-" + s.id}
              onClick={() => handleScope(s.id)}
            >
              <Icon name={s.icon} size={11}/>
              <span>{s.label}</span>
              <Kbd>{"⌘" + (i + 1)}</Kbd>
            </button>
          ))}
        </div>

        <div className="palette__body" data-state={state}>
          {renderBody()}
        </div>

        <div className="palette__footer">
          <span className="palette__footer__hint"><Kbd>↑</Kbd><Kbd>↓</Kbd> navigate</span>
          <span className="palette__footer__hint"><Kbd>↵</Kbd> open</span>
          <span className="palette__footer__hint"><Kbd>esc</Kbd> close</span>
          <span className="palette__footer__spacer"/>
          <span className="palette__footer__brand">{BRAND.name} · {BRAND.tagline}</span>
        </div>

        {/* Mobile: palette becomes a full-screen sheet anchored to the bottom; scope chips scroll horizontally; footer hints collapse. */}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// AdaptiveWheelHost
//
// Slot states:
//   - default
//   - hover           (CSS)
//   - focus           (CSS, keyboard)
//   - selected        (active === slot.id)
//   - disabled        (slot.disabled, with optional .reason)
//   - loading         (busySlotId === slot.id, ring spinner)
//   - error           (errorSlotId === slot.id, red ring)
//   - queue badge     (slot.queue count > 0)
// ---------------------------------------------------------------------
const DEFAULT_WHEEL_SLOTS = [
  { id: "extract", icon: "sparkle", lbl: "Extract" },
  { id: "create",  icon: "plus",    lbl: "Create" },
  { id: "tag",     icon: "bookmark",lbl: "Tag" },
  { id: "merge",   icon: "link",    lbl: "Merge" },
  { id: "review",  icon: "bell",    lbl: "Review",  queue: 12 },
  { id: "speed",   icon: "eye",     lbl: "Speed" },
  { id: "tangle",  icon: "knot",    lbl: "Tangle",  disabled: true, reason: "Coming soon" },
  { id: "more",    icon: "more",    lbl: "More…" },
];

const AdaptiveWheelHost = ({
  open,
  x,
  y,
  contextLabel = "Workspace",
  slots = DEFAULT_WHEEL_SLOTS,
  state = "ready",          // "ready" | "loading" | "error"
  busySlotId,               // which slot is mid-action
  errorSlotId,              // which slot just failed
  errorMessage,
  activeSlotId,             // primary action for current context (selected ring)
  onClose,
  onRunWheelAction,
  onPinSlot,
  onRetry,
}) => {
  const [focusIdx, setFocusIdx] = _us_cp(0);
  const ref = _ur_cp(null);

  // Reset focus when opening
  _ue_cp(() => { if (open) setFocusIdx(0); }, [open]);

  // Keyboard nav inside the wheel
  _ue_cp(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); onClose && onClose(); return; }
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIdx((i) => {
          let n = i;
          for (let k = 0; k < slots.length; k++) {
            n = (n + 1) % slots.length;
            if (!slots[n].disabled) break;
          }
          return n;
        });
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIdx((i) => {
          let n = i;
          for (let k = 0; k < slots.length; k++) {
            n = (n - 1 + slots.length) % slots.length;
            if (!slots[n].disabled) break;
          }
          return n;
        });
      }
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const s = slots[focusIdx];
        if (s && !s.disabled) onRunWheelAction && onRunWheelAction(s.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, slots, focusIdx, onClose, onRunWheelAction]);

  if (!open) return null;
  // Wheel sizing — ring diameter + slot orbit radius are tuned so labels
  // sit OUTSIDE the ring, not inside it, and never collide with the hub.
  const wheelSize = 360;            // outer hit area
  const ringDiameter = 220;         // visible parchment ring
  const orbitRadius = 150;          // distance from center to slot center
  // Position the wheel so it stays on screen no matter where x/y land.
  const margin = wheelSize / 2 + 16;
  const vw = (typeof window !== "undefined") ? window.innerWidth : 1280;
  const vh = (typeof window !== "undefined") ? window.innerHeight : 800;
  const cx = Math.max(margin, Math.min(vw - margin, x));
  const cy = Math.max(margin, Math.min(vh - margin, y));

  return (
    <div
      ref={ref}
      className="wheel-overlay"
      data-ui="AdaptiveWheelHost"
      data-state={state}
      data-testid="adaptive-wheel"
      style={{ "--wx": cx + "px", "--wy": cy + "px", "--wheel-size": wheelSize + "px", "--wheel-ring": ringDiameter + "px" }}
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); onClose && onClose(); }}
      role="dialog"
      aria-label={"Adaptive wheel for " + contextLabel}
    >
      <div className="wheel-overlay__bg"/>
      <div className="wheel" onClick={(e) => e.stopPropagation()}>
        <div className="wheel__ring"/>
        <div className="wheel__ring-inner"/>

        {state === "loading" && (
          <div className="wheel__overlay-state" data-ui="AdaptiveWheelLoading">
            <div className="wheel__spinner" aria-hidden/>
            <div className="wheel__overlay-state__lbl">Working…</div>
          </div>
        )}

        {state === "error" && (
          <div className="wheel__overlay-state wheel__overlay-state--error" data-ui="AdaptiveWheelError">
            <Icon name="warn" size={16}/>
            <div className="wheel__overlay-state__lbl">{errorMessage || "Action failed"}</div>
            <button
              type="button"
              className="wheel__overlay-state__retry"
              data-ui="AdaptiveWheelRetry"
              data-callback="onRetry"
              data-testid="wheel-retry"
              onClick={(e) => { e.stopPropagation(); onRetry && onRetry(); }}
            >
              Try again
            </button>
          </div>
        )}

        {slots.map((s, i) => {
          const angle = (i / slots.length) * Math.PI * 2 - Math.PI / 2;
          const sx = Math.cos(angle) * orbitRadius;
          const sy = Math.sin(angle) * orbitRadius;
          const isBusy   = busySlotId  === s.id;
          const isError  = errorSlotId === s.id;
          const isActive = activeSlotId === s.id;
          const isFocus  = focusIdx === i;
          const cls = [
            "wheel__slot",
            isBusy   ? "is-loading"  : "",
            isError  ? "is-error"    : "",
            isActive ? "is-selected" : "",
            isFocus  ? "is-focus"    : "",
            s.disabled ? "is-disabled" : "",
          ].filter(Boolean).join(" ");
          return (
            <button
              key={s.id}
              type="button"
              className={cls}
              style={{ left: "calc(50% + " + sx + "px)", top: "calc(50% + " + sy + "px)", transform: "translate(-50%, -50%)" }}
              onClick={(e) => {
                if (s.disabled) return;
                if (e.shiftKey && onPinSlot) { onPinSlot(s.id); return; }
                onRunWheelAction && onRunWheelAction(s.id);
              }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (!s.disabled && onPinSlot) onPinSlot(s.id); }}
              onFocus={() => setFocusIdx(i)}
              onMouseEnter={() => !s.disabled && setFocusIdx(i)}
              data-ui="AdaptiveWheelSlot"
              data-callback="onRunWheelAction"
              data-testid={"wheel-" + s.id}
              data-slot={s.id}
              data-disabled={s.disabled || undefined}
              data-busy={isBusy || undefined}
              aria-disabled={s.disabled || undefined}
              aria-pressed={isActive || undefined}
              tabIndex={s.disabled ? -1 : 0}
              title={s.disabled ? s.reason : s.lbl}
            >
              <span className="wheel__slot__pill">
                {isBusy
                  ? <span className="wheel__slot__spinner" aria-hidden/>
                  : <Icon name={s.icon} size={16}/>}
                {s.queue ? (
                  <span className="wheel__slot__queue" aria-label={s.queue + " items in queue"}>
                    {s.queue > 99 ? "99+" : s.queue}
                  </span>
                ) : null}
                {s.disabled && <span className="wheel__slot__lock" aria-hidden><Icon name="lock" size={9}/></span>}
              </span>
              <span className="wheel__slot__lbl">{s.lbl}</span>
            </button>
          );
        })}

        <div
          className="wheel__hub"
          data-ui="AdaptiveWheelHub"
          data-callback="onCloseWheel"
          data-testid="wheel-hub"
          role="button"
          tabIndex={0}
          onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClose && onClose(); } }}
          title="Close wheel"
        >
          <div className="wheel__hub__lbl">Adaptive</div>
          <div className="wheel__hub__ctx">{contextLabel}</div>
        </div>

        <div className="wheel__hint">Right-click · long-press · ⌘K-hold · Shift-click to pin</div>
      </div>

      {/* Mobile: wheel opens via long-press at touch point; slot labels stay visible; hub doubles as cancel; arrow-key nav becomes swipe. */}
    </div>
  );
};

Object.assign(window, { CommandPalette, AdaptiveWheelHost, PALETTE_SCOPES, DEFAULT_WHEEL_SLOTS });
